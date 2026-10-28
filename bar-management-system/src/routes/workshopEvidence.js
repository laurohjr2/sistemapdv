function factory() {
  const router = require("express").Router(),
    { authenticateToken } = require("../middleware/auth"),
    { handler } = require("../services/commercialValidation"),
    ops = require("../services/workshopEvidence");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("workshop"),
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
  );
  router.get(
    "/:id/evidence",
    handler(async (req, res) => res.json(await ops.list(req.params.id))),
  );
  router.post(
    "/:id/photos",
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.addPhoto(req.params.id, req.body, req.user)),
    ),
  );
  router.post(
    "/:id/photos/:photoId/archive",
    handler(async (req, res) => {
      await ops.archivePhoto(
        req.params.id,
        req.params.photoId,
        req.body,
        req.user,
      );
      res.json({ message: "Foto arquivada. Original preservado." });
    }),
  );
  router.get(
    "/:id/photos/:photoId/file",
    handler(async (req, res) => {
      const p = await ops.file(req.params.id, req.params.photoId);
      res.set("X-Content-Type-Options", "nosniff").type(p.mime).send(p.data);
    }),
  );
  router.post(
    "/:id/signatures",
    handler(async (req, res) =>
      res.status(201).json(await ops.sign(req.params.id, req.body, req.user)),
    ),
  );
  router.post(
    "/:id/signatures/:signatureId/void",
    handler(async (req, res) => {
      await ops.voidSignature(
        req.params.id,
        req.params.signatureId,
        req.body,
        req.user,
      );
      res.json({ message: "Registro cancelado. Original preservado." });
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
