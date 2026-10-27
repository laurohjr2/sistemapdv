function createRouter() {
  const router = require("express").Router(),
    crypto = require("node:crypto");
  const { PasswordReset, User, sequelize } = require("../models");
  const { Op } = require("sequelize");
  const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
  const message =
    "Se os dados estiverem corretos, você receberá um link de recuperação no e-mail cadastrado.";
  router.post("/forgot-password", async (req, res, next) => {
    try {
      const { username, email } = req.body;
      if (
        typeof username !== "string" ||
        typeof email !== "string" ||
        username.length > 50 ||
        email.length > 150
      )
        return res
          .status(400)
          .json({ error: "Informe usuário e e-mail cadastrado" });
      const user = await User.findOne({
        where: { username, email, active: true },
      });
      if (
        user &&
        email &&
        process.env.SMTP_HOST &&
        process.env.MAIL_FROM &&
        process.env.APP_PUBLIC_URL
      ) {
        // Limite persistente por usuário para evitar bombardeio de e-mails.
        const token = crypto.randomBytes(32).toString("hex");
        let reset;
        await sequelize.transaction(async (transaction) => {
          await User.findByPk(user.id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (
            await PasswordReset.count({
              where: {
                userId: user.id,
                createdAt: { [Op.gt]: new Date(Date.now() - 60000) },
              },
              transaction,
            })
          )
            return;
          reset = await PasswordReset.create(
            {
              userId: user.id,
              tokenHash: hash(token),
              expiresAt: new Date(Date.now() + 15 * 60000),
            },
            { transaction },
          );
        });
        if (reset) {
          const url = new URL("/reset-password", process.env.APP_PUBLIC_URL);
          url.searchParams.set("company", req.tenant.slug);
          url.searchParams.set("token", token);
          const mailer = require("nodemailer").createTransport({
            host: process.env.SMTP_HOST,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === "true",
            requireTLS: process.env.SMTP_SECURE !== "true",
            ...(process.env.SMTP_USER
              ? {
                  auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                  },
                }
              : {}),
          });
          try {
            await mailer.sendMail({
              from: process.env.MAIL_FROM,
              to: email,
              subject: "Recuperação de senha — PDV",
              text: `Para definir uma nova senha, acesse: ${url}. O link vale por 15 minutos. Se você não solicitou, ignore esta mensagem.`,
            });
          } catch {
            await reset.update({ usedAt: new Date() });
            console.error(
              "Não foi possível enviar o e-mail de recuperação. Confira a configuração SMTP.",
            );
          }
        }
      }
      res.json({ message });
    } catch (e) {
      next(e);
    }
  });
  router.post("/reset-password", async (req, res, next) => {
    try {
      const { token, password } = req.body;
      if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/.test(token) ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      )
        return res.status(400).json({
          error: "Link inválido ou senha fora do limite de 12 a 128 caracteres",
        });
      const candidate = await PasswordReset.findOne({
        where: { tokenHash: hash(token) },
      });
      if (!candidate)
        return res.status(400).json({ error: "Link inválido ou expirado" });
      await sequelize.transaction(async (transaction) => {
        const user = await User.findByPk(candidate.userId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const reset = await PasswordReset.findOne({
          where: { tokenHash: hash(token) },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!reset || reset.usedAt || reset.expiresAt <= new Date())
          throw Object.assign(new Error("Link inválido ou expirado"), {
            status: 400,
          });
        if (!user?.active)
          throw Object.assign(new Error("Link inválido ou expirado"), {
            status: 400,
          });
        await user.update({ passwordHash: password }, { transaction });
        await reset.update({ usedAt: new Date() }, { transaction });
        await PasswordReset.update(
          { usedAt: new Date() },
          { where: { userId: user.id, usedAt: null }, transaction },
        );
      });
      res.json({ message: "Senha redefinida. Faça login com a nova senha." });
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      next(e);
    }
  });
  return router;
}
module.exports = require("../tenancy/scopedModule").router(createRouter);
