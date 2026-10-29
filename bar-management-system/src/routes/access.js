function factory() {
  const router = require("express").Router(),
    { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    { handler, uuid, fail } = require("../services/commercialValidation"),
    access = require("../services/userAccess"),
    { User } = require("../models");
  router.use(authenticateToken);
  router.get(
    "/me",
    handler(async (req, res) =>
      res.json({
        ...(await access.info(req.user)),
        definitions: access.permissions,
      }),
    ),
  );
  router.get("/catalog", authorizeRoles("admin"), (_req, res) =>
    res.json({
      permissions: access.permissions,
      templates: access.templates,
      navigation: access.navigation,
      dependencies: access.dependencies,
      roles: ["garcom", "gerente", "admin"],
    }),
  );
  router.get(
    "/users/:id",
    authorizeRoles("admin"),
    handler(async (req, res) => {
      const u = await User.findByPk(uuid(req.params.id), { paranoid: false });
      if (!u || u.platformUserId) throw fail("Usuário não encontrado", 404);
      res.json({ user: u, access: await access.info(u) });
    }),
  );
  const {
    sequelize,
    UserAccess,
    UserAccessEvent,
    AuditLog,
  } = require("../models");
  router.get(
    "/users/:id/history",
    authorizeRoles("admin"),
    handler(async (req, res) => {
      const u = await User.findByPk(uuid(req.params.id), { paranoid: false });
      if (!u || u.platformUserId) throw fail("Usuário não encontrado", 404);
      res.json(
        await UserAccessEvent.findAll({
          where: { userId: u.id },
          order: [["createdAt", "DESC"]],
          limit: 100,
        }),
      );
    }),
  );
  router.put(
    "/users/:id",
    authorizeRoles("admin"),
    handler(async (req, res) => {
      const b = req.body || {},
        reason = require("../services/commercialValidation").text(
          b.reason,
          "Motivo da alteração",
          1000,
        );
      if (
        !["legacy", "restricted"].includes(b.mode) ||
        !Number.isInteger(b.revision) ||
        b.revision < 0
      )
        throw fail("Configuração de acessos inválida");
      const result = await sequelize.transaction(async (transaction) => {
        await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
          transaction,
        });
        const actor = await User.findByPk(req.user.id, { transaction });
        if (!actor?.active || actor.role !== "admin")
          throw fail("Sessão administrativa alterada. Entre novamente.", 403);
        const u = await User.findByPk(uuid(req.params.id), {
          paranoid: false,
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!u || u.platformUserId) throw fail("Usuário não encontrado", 404);
        if (u.role === "admin")
          throw fail(
            "Administradores mantêm controle integral da própria empresa. Configure perfis operacionais para outros usuários.",
          );
        const old = await UserAccess.findByPk(u.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if ((old?.revision || 0) !== b.revision)
          throw fail(
            "Os acessos foram alterados. Recarregue antes de salvar.",
            409,
          );
        let permissions = [],
          template = null;
        if (b.mode === "restricted") {
          if (
            !Array.isArray(b.permissions) ||
            b.permissions.length > access.permissions.length ||
            b.permissions.some((p) => typeof p !== "string") ||
            new Set(b.permissions).size !== b.permissions.length
          )
            throw fail("Lista de permissões inválida");
          const allowed = new Set(access.ceiling(u.role));
          if (b.permissions.some((p) => !allowed.has(p)))
            throw fail("Permissão fora do limite deste papel");
          permissions = [...b.permissions].sort();
          if (access.expand(permissions).some((p) => !permissions.includes(p)))
            throw fail(
              "Inclua as consultas e permissões necessárias às ações selecionadas",
            );
          if (b.template) {
            const selected = access.templates.find(
              (t) => t.id === b.template && t.roles.includes(u.role),
            );
            if (!selected)
              throw fail("Perfil incompatível com o papel do usuário");
            template = selected.id;
          }
        }
        const values = {
            mode: b.mode,
            template,
            permissions,
            revision: (old?.revision || 0) + 1,
          },
          before = old?.toJSON() || null;
        const record = old
          ? await old.update(values, { transaction })
          : await UserAccess.create(
              { ...values, userId: u.id },
              { transaction },
            );
        await UserAccessEvent.create(
          {
            userId: u.id,
            actorId: req.user.id,
            actorName: req.master ? "Master/Admin" : req.user.username,
            reason,
            before,
            after: { ...values, role: u.role },
          },
          { transaction },
        );
        await AuditLog.create(
          {
            userId: req.user.id,
            action: "user_access_changed",
            details: JSON.stringify({
              targetUserId: u.id,
              reason,
              before,
              after: values,
            }),
          },
          { transaction },
        );
        return {
          user: u,
          access: await access.info(u, transaction),
          configuration: record,
        };
      });
      res.json(result);
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
