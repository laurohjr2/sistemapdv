function factory() {
  const router = require("express").Router(),
    { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    { handler } = require("../services/commercialValidation"),
    { MenuBundle } = require("../models"),
    ops = require("../services/bundleOperations");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("bundles"),
  );
  router.get(
    "/",
    handler(async (req, res) =>
      res.json(await MenuBundle.findAll({ order: [["name", "ASC"]] })),
    ),
  );
  router.post(
    "/",
    authorizeRoles("admin", "gerente"),
    handler(async (req, res) =>
      res.status(201).json(await ops.save(null, req.body, req.user)),
    ),
  );
  router.put(
    "/:id",
    authorizeRoles("admin", "gerente"),
    handler(async (req, res) =>
      res.json(await ops.save(req.params.id, req.body, req.user)),
    ),
  );
  router.post(
    "/price",
    handler(async (req, res) => {
      const { sequelize } = require("../models");
      res.json(await sequelize.transaction((t) => ops.resolve(req.body, t)));
    }),
  );
  router.post(
    "/comandas/:id",
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.addToComanda(req.params.id, req.body, req.user)),
    ),
  );
  router.delete(
    "/comandas/:id/:groupId",
    handler(async (req, res) => {
      await ops.removeFromComanda(
        req.params.id,
        req.params.groupId,
        req.body,
        req.user,
      );
      res.json({ message: "Combo removido" });
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
