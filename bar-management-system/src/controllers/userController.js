function factory() {
  const { User, sequelize, AuditLog } = require("../models"),
    { fail, uuid } = require("../services/commercialValidation");
  const handler = (fn) => async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      if (e.name === "SequelizeUniqueConstraintError")
        return res.status(409).json({ error: "Nome de usuário já cadastrado" });
      next(e);
    }
  };
  const audit = (req, action, details, t) =>
    AuditLog.create(
      { userId: req.user.id, action, details: JSON.stringify(details) },
      { transaction: t },
    );
  async function lock(req, t) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction: t,
    });
    const actor = await User.findByPk(req.user.id, { transaction: t });
    if (!actor?.active || actor.role !== "admin")
      throw fail("Sessão administrativa alterada. Entre novamente.", 403);
  }
  async function target(id, t) {
    const u = await User.findByPk(uuid(id), {
      paranoid: false,
      transaction: t,
      ...(t ? { lock: t.LOCK.UPDATE } : {}),
    });
    if (!u || u.platformUserId) throw fail("Usuário não encontrado", 404);
    return u;
  }
  async function keepAdmin(u, data, t) {
    if (
      u.role === "admin" &&
      u.active &&
      !u.deleted_at &&
      (data.active === false || (data.role && data.role !== "admin")) &&
      (await User.count({
        where: { role: "admin", active: true, platformUserId: null },
        transaction: t,
      })) < 2
    )
      throw fail(
        "Mantenha ao menos um administrador ativo na empresa antes de retirar este acesso",
      );
  }
  const getAllUsers = handler(async (_req, res) =>
    res.json(
      await User.findAll({
        where: { platformUserId: null },
        paranoid: false,
        order: [["created_at", "DESC"]],
      }),
    ),
  );
  const getUserById = handler(async (req, res) =>
    res.json(await target(req.params.id)),
  );
  const updateUser = handler(async (req, res) => {
    const b = req.body || {},
      data = {};
    if (b.username !== undefined) {
      if (
        typeof b.username !== "string" ||
        b.username.trim().length < 3 ||
        b.username.trim().length > 50 ||
        ["master.local", "support.local"].includes(
          b.username.trim().toLowerCase(),
        )
      )
        throw fail("Nome de usuário inválido ou reservado");
      data.username = b.username.trim();
    }
    if (b.role !== undefined) {
      if (!["admin", "gerente", "garcom"].includes(b.role))
        throw fail("Papel inválido");
      data.role = b.role;
    }
    if (b.active !== undefined) {
      if (typeof b.active !== "boolean") throw fail("Status inválido");
      data.active = b.active;
    }
    if (b.email !== undefined) {
      if (
        typeof b.email !== "string" ||
        b.email.length > 150 ||
        (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))
      )
        throw fail("E-mail inválido");
      data.email = b.email.trim();
    }
    if (b.password) {
      if (typeof b.password !== "string" || b.password.length < 6)
        throw fail("Senha deve ter ao menos seis caracteres");
      data.passwordHash = b.password;
    }
    const user = await sequelize.transaction(async (t) => {
      await lock(req, t);
      const u = await target(req.params.id, t);
      if (
        u.id === req.user.id &&
        (data.active === false || (data.role && data.role !== "admin"))
      )
        throw fail(
          "Não é possível retirar seu próprio acesso de administrador",
        );
      await keepAdmin(u, data, t);
      const before = { username: u.username, role: u.role, active: u.active };
      if (data.active === true && u.deleted_at)
        await u.restore({ transaction: t });
      await u.update(data, { transaction: t });
      await audit(
        req,
        "user_updated",
        {
          updatedUserId: u.id,
          before,
          after: { username: u.username, role: u.role, active: u.active },
          changes: Object.keys(data).filter((k) => k !== "passwordHash"),
        },
        t,
      );
      return u;
    });
    res.json({ message: "Usuário atualizado", user });
  });
  const deleteUser = handler(async (req, res) => {
    await sequelize.transaction(async (t) => {
      await lock(req, t);
      const u = await target(req.params.id, t);
      if (u.id === req.user.id)
        throw fail("Não é possível inativar a própria conta");
      await keepAdmin(u, { active: false }, t);
      await u.update({ active: false }, { transaction: t });
      await audit(
        req,
        "user_inactivated",
        { deletedUserId: u.id, username: u.username },
        t,
      );
    });
    res.json({ message: "Usuário inativado. O histórico foi preservado." });
  });
  return { getAllUsers, getUserById, updateUser, deleteUser };
}
module.exports = require("../tenancy/scopedModule")(factory, [
  "getAllUsers",
  "getUserById",
  "updateUser",
  "deleteUser",
]);
