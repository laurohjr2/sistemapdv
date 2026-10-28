module.exports = function (central) {
  const router = require("express").Router(),
    jwt = require("jsonwebtoken"),
    crypto = require("node:crypto"),
    { handler, fail, text, uuid } = require("../services/commercialValidation"),
    G = central.SupportGrant;
  const hash = (code) => crypto.createHash("sha256").update(code).digest("hex");
  const tokenFor = (user, session, tenant) =>
    jwt.sign(
      {
        scope: "support-session",
        supportUserId: user.id,
        version: user.updatedAt.toISOString(),
        sessionId: session.id,
        company: tenant.slug,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: Math.max(
          1,
          Math.floor((session.expiresAt - Date.now()) / 1000),
        ),
        audience: "pdv-tenant",
        issuer: "pdv-platform",
      },
    );
  async function master(req, res, next) {
    try {
      const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1],
        claims = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: ["HS256"],
          audience: "pdv-support",
          issuer: "pdv-platform",
        });
      if (claims.scope !== "support") return res.sendStatus(401);
      const user = await central.SupportUser.findByPk(claims.supportUserId);
      if (!user?.active || user.updatedAt.toISOString() !== claims.version)
        return res.sendStatus(401);
      if (!user.isMaster)
        return res
          .status(403)
          .json({ error: "Acesso exclusivo da conta Master" });
      req.operator = user;
      next();
    } catch {
      return res.sendStatus(401);
    }
  }
  router.get(
    "/access-codes/operators",
    master,
    handler(async (_req, res) =>
      res.json(
        await central.SupportUser.findAll({
          where: { active: true, isMaster: false },
          attributes: ["id", "username"],
          order: [["username", "ASC"]],
        }),
      ),
    ),
  );
  router.get(
    "/access-codes",
    master,
    handler(async (req, res) => {
      const where = {};
      if (req.query.company) {
        const tenant = await central.Tenant.findOne({
          where: { slug: text(req.query.company, "Empresa", 63) },
        });
        if (!tenant) throw fail("Empresa não encontrada", 404);
        where.tenantId = tenant.id;
      }
      const grants = await G.findAll({
        where,
        attributes: { exclude: ["codeHash"] },
        order: [["createdAt", "DESC"]],
        limit: 100,
      });
      res.json(grants);
    }),
  );
  router.post(
    "/access-codes",
    master,
    handler(async (req, res) => {
      const b = req.body || {},
        reason = text(b.reason, "Motivo do acesso", 1000),
        minutes = Number(b.minutes);
      if (![5, 15, 30, 60].includes(minutes))
        throw fail("Escolha validade de 5, 15, 30 ou 60 minutos");
      const code = crypto.randomBytes(32).toString("base64url");
      const result = await central.sequelize.transaction(async (t) => {
        const tenant = await central.Tenant.findOne({
            where: { slug: text(b.company, "Empresa", 63) },
            transaction: t,
          }),
          user = await central.SupportUser.findByPk(uuid(b.supportUserId), {
            transaction: t,
          });
        if (
          !tenant ||
          tenant.status !== "active" ||
          !user?.active ||
          user.isMaster
        )
          throw fail("Selecione empresa ativa e operador de suporte ativo");
        const g = await G.create(
          {
            tenantId: tenant.id,
            supportUserId: user.id,
            createdBy: req.operator.id,
            reason,
            codeHash: hash(code),
            expiresAt: new Date(Date.now() + minutes * 60000),
          },
          { transaction: t },
        );
        await central.SupportAudit.create(
          {
            supportUserId: req.operator.id,
            tenantId: tenant.id,
            action: "temporary_access_issued:" + g.id,
          },
          { transaction: t },
        );
        return g;
      });
      const value = result.toJSON();
      delete value.codeHash;
      res.status(201).json({ ...value, code });
    }),
  );
  router.post(
    "/access-codes/:id/revoke",
    master,
    handler(async (req, res) => {
      const reason = text(req.body?.reason, "Motivo da revogação", 1000);
      await central.sequelize.transaction(async (t) => {
        const g = await G.findByPk(uuid(req.params.id), {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!g) throw fail("Acesso não encontrado", 404);
        if (!g.revokedAt) {
          await g.update(
            { revokedAt: new Date(), revokeReason: reason },
            { transaction: t },
          );
          if (g.sessionId)
            await central.SupportSession.update(
              { revoked: true },
              { where: { id: g.sessionId }, transaction: t },
            );
          await central.SupportAudit.create(
            {
              supportUserId: req.operator.id,
              tenantId: g.tenantId,
              action: "temporary_access_revoked:" + g.id,
            },
            { transaction: t },
          );
        }
      });
      res.json({
        message: "Acesso revogado; eventual sessão vinculada foi encerrada.",
      });
    }),
  );
  const attempts = new Map();
  router.post(
    "/access-code",
    handler(async (req, res) => {
      const key = req.ip,
        now = Date.now();
      let window = attempts.get(key);
      if (!window || now - window.at >= 60000) {
        window = { at: now, count: 0 };
        attempts.set(key, window);
      }
      if (++window.count > 30)
        throw fail("Muitas tentativas. Aguarde um minuto.", 429);
      if (attempts.size > 1000) attempts.delete(attempts.keys().next().value);
      const b = req.body || {};
      if (
        typeof b.username !== "string" ||
        b.username.length > 100 ||
        typeof b.code !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(b.code)
      )
        throw fail("Código ou acesso inválido", 401);
      const session = await central.sequelize.transaction(async (t) => {
        const user = await central.SupportUser.findOne({
          where: { username: b.username.trim() },
          transaction: t,
        });
        if (!user?.active || user.isMaster)
          throw fail("Código ou acesso inválido", 401);
        const grant = await G.findOne({
          where: { codeHash: hash(b.code), supportUserId: user.id },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (
          !grant ||
          grant.revokedAt ||
          grant.usedAt ||
          grant.expiresAt <= new Date()
        )
          throw fail("Código ou acesso inválido", 401);
        const tenant = await central.Tenant.findByPk(grant.tenantId, {
          transaction: t,
        });
        if (!tenant || tenant.status !== "active")
          throw fail("Código ou acesso inválido", 401);
        const session = await central.SupportSession.create(
          {
            supportUserId: user.id,
            tenantId: tenant.id,
            expiresAt: new Date(
              Math.min(+grant.expiresAt, Date.now() + 15 * 60000),
            ),
          },
          { transaction: t },
        );
        await grant.update(
          { usedAt: new Date(), sessionId: session.id },
          { transaction: t },
        );
        await central.SupportAudit.create(
          {
            supportUserId: user.id,
            tenantId: tenant.id,
            action: "temporary_access_redeemed:" + grant.id,
          },
          { transaction: t },
        );
        return { user, session, tenant };
      });
      res.json({
        token: tokenFor(session.user, session.session, session.tenant),
        expiresAt: session.session.expiresAt,
        user: {
          id: session.user.id,
          username: session.user.username,
          role: "gerente",
          master: false,
          support: true,
          company: session.tenant.slug,
        },
      });
    }),
  );
  return router;
};
