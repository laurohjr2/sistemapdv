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
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
