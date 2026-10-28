function factory() {
  const router = require("express").Router(),
    {
      sequelize,
      Product,
      PartDetail,
      PartImport: I,
      AuditLog,
    } = require("../models");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    {
      handler,
      fail,
      text,
      uuid,
    } = require("../services/commercialValidation"),
    { digest } = require("../services/workshopEvidenceValidation"),
    csv = require("../services/partCsv"),
    { normalize } = require("../services/partSearch");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("autoparts"),
    authorizeRoles("admin", "gerente"),
  );
  async function enabled(t) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction: t,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("../services/businessSettingsService").getSettings(t),
      ).autoparts
    )
      throw fail("Módulo Autopeças desativado", 403);
  }
  async function conflicts(rows, t) {
    const products = await Product.findAll({
        attributes: ["name", "barcode"],
        transaction: t,
        raw: true,
      }),
      parts = await PartDetail.findAll({
        attributes: ["manufacturer", "partNumber"],
        transaction: t,
        raw: true,
      });
    const names = new Set(
        products.map((p) => p.name.trim().toLocaleLowerCase("pt-BR")),
      ),
      codes = new Set(products.filter((p) => p.barcode).map((p) => p.barcode)),
      refs = new Set(
        parts
          .filter((p) => p.manufacturer && p.partNumber)
          .map(
            (p) => normalize(p.manufacturer) + "|" + normalize(p.partNumber),
          ),
      );
    return rows.map((row) => {
      const errors = [...row.errors];
      if (row.values) {
        const p = row.values.product,
          d = row.values.details,
          name = p.name.toLocaleLowerCase("pt-BR"),
          ref =
            d.manufacturer && d.partNumber
              ? normalize(d.manufacturer) + "|" + normalize(d.partNumber)
              : null;
        if (names.has(name))
          errors.push("Nome já cadastrado ou repetido no arquivo");
        if (p.barcode && codes.has(p.barcode))
          errors.push("Código de barras já cadastrado ou repetido");
        if (ref && refs.has(ref))
          errors.push("Fabricante e referência já cadastrados ou repetidos");
        names.add(name);
        if (p.barcode) codes.add(p.barcode);
        if (ref) refs.add(ref);
      }
      return { ...row, errors };
    });
  }
  router.get(
    "/",
    handler(async (req, res) =>
      res.json(
        await I.findAll({
          attributes: { exclude: ["payload"] },
          order: [["createdAt", "DESC"]],
          limit: 100,
        }),
      ),
    ),
  );
  router.post(
    "/headers",
    handler(async (req, res) => {
      const parsed = csv.parse(req.body?.csv, req.body?.separator);
      res.json({
        headers: parsed.headers,
        count: parsed.rows.length,
        fields: csv.fields,
      });
    }),
  );
  router.post(
    "/preview",
    handler(async (req, res) => {
      const b = req.body || {},
        filename = text(b.filename, "Arquivo", 150),
        source = text(b.source, "Fonte do catálogo", 200),
        payload = csv.mapped(b.csv, b.separator, b.mapping, source);
      const batch = await sequelize.transaction(async (t) => {
        await enabled(t);
        const rows = await conflicts(payload.rows, t),
          value = { ...payload, rows };
        return I.create(
          {
            filename,
            source,
            payload: value,
            digest: digest(value),
            createdBy: req.user.id,
            expiresAt: new Date(Date.now() + 86400000),
          },
          { transaction: t },
        );
      });
      res.status(201).json(batch);
    }),
  );
  router.get(
    "/:id",
    handler(async (req, res) => {
      const batch = await I.findByPk(uuid(req.params.id));
      if (!batch) throw fail("Importação não encontrada", 404);
      res.json(batch);
    }),
  );
  router.post(
    "/:id/confirm",
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          await enabled(t);
          const batch = await I.findByPk(uuid(req.params.id), {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (!batch) throw fail("Importação não encontrada", 404);
          if (batch.createdBy !== req.user.id)
            throw fail("Confirme com o usuário que preparou a importação", 403);
          if (batch.status === "committed") return batch;
          if (
            batch.expiresAt <= new Date() ||
            batch.digest !== req.body?.digest ||
            digest(batch.payload) !== batch.digest ||
            req.body?.confirmed !== true
          )
            throw fail(
              "Prévia vencida ou não conferida. Prepare novamente.",
              409,
            );
          const rows = await conflicts(batch.payload.rows, t);
          if (rows.some((r) => r.errors.length))
            throw fail(
              "Há erros ou duplicidades. Corrija o arquivo e prepare nova prévia.",
              409,
            );
          const productIds = [];
          for (const row of rows) {
            const p = await Product.create(row.values.product, {
              transaction: t,
            });
            await PartDetail.create(
              { ...row.values.details, productId: p.id },
              { transaction: t },
            );
            productIds.push(p.id);
          }
          await batch.update(
            {
              status: "committed",
              result: {
                productIds,
                count: productIds.length,
                committedAt: new Date().toISOString(),
              },
            },
            { transaction: t },
          );
          await AuditLog.create(
            {
              userId: req.user.id,
              action: "parts_catalog_imported",
              details: JSON.stringify({
                id: batch.id,
                source: batch.source,
                count: productIds.length,
                digest: batch.digest,
              }),
            },
            { transaction: t },
          );
          return batch;
        }),
      ),
    ),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
