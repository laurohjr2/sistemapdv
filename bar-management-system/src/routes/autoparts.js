function factory() {
  const router = require("express").Router();
  const {
    sequelize,
    Product,
    PartDetail,
    PartEquivalence,
    AuditLog,
  } = require("../models");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth");
  const {
    handler,
    fail,
    uuid,
    text,
  } = require("../services/commercialValidation");
  const { matches, normalize } = require("../services/partSearch");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("autoparts"),
  );
  const manager = authorizeRoles("gerente", "admin");
  async function lock(transaction) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("../services/businessSettingsService").getSettings(
          transaction,
        ),
      ).autoparts
    )
      throw fail("Módulo Autopeças desativado", 403);
  }
  const audit = (user, action, details, transaction) =>
    AuditLog.create(
      { userId: user.id, action, details: JSON.stringify(details) },
      { transaction },
    );
  async function product(id, transaction) {
    const p = await Product.findByPk(uuid(id), { transaction });
    if (!p) throw fail("Produto não encontrado", 404);
    if (p.itemType === "service")
      throw fail("O cadastro técnico é destinado a produtos, não a serviços");
    return p;
  }
  async function catalog() {
    const [products, details, links] = await Promise.all([
      Product.findAll({
        where: { itemType: "product" },
        order: [["name", "ASC"]],
        raw: true,
      }),
      PartDetail.findAll({ raw: true }),
      PartEquivalence.findAll({ raw: true }),
    ]);
    const detailMap = new Map(details.map((d) => [d.productId, d])),
      productMap = new Map(products.map((p) => [p.id, p]));
    return products.map((p) => ({
      ...p,
      partDetails: detailMap.get(p.id) || null,
      equivalents: links
        .filter((l) => l.firstProductId === p.id || l.secondProductId === p.id)
        .map((l) => {
          const other = productMap.get(
            l.firstProductId === p.id ? l.secondProductId : l.firstProductId,
          );
          return {
            productId: other.id,
            name: other.name,
            active: other.active,
            currentStock: other.currentStock,
            salePrice: other.salePrice,
            manufacturer: detailMap.get(other.id)?.manufacturer || "",
            partNumber: detailMap.get(other.id)?.partNumber || "",
            note: l.note,
          };
        }),
    }));
  }
  router.get(
    "/catalog",
    handler(async (req, res) => {
      for (const key of [
        "search",
        "brand",
        "model",
        "engine",
        "version",
        "year",
        "active",
      ])
        if (
          req.query[key] !== undefined &&
          (typeof req.query[key] !== "string" || req.query[key].length > 200)
        )
          throw fail("Filtro inválido");
      if (
        req.query.year &&
        (!/^\d{4}$/.test(req.query.year) ||
          Number(req.query.year) < 1900 ||
          Number(req.query.year) > 2100)
      )
        throw fail("Ano inválido");
      if (
        req.query.active !== undefined &&
        !["", "true", "false"].includes(req.query.active)
      )
        throw fail("Situação inválida");
      res.json((await catalog()).filter((p) => matches(p, req.query)));
    }),
  );
  router.get(
    "/parts/:id",
    handler(async (req, res) => {
      const p = await product(req.params.id);
      res.json((await catalog()).find((row) => row.id === p.id));
    }),
  );
  router.put(
    "/parts/:id",
    manager,
    handler(async (req, res) => {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw fail("Cadastro técnico inválido");
      const manufacturer = text(
          body.manufacturer ?? "",
          "Fabricante",
          100,
          false,
        ),
        partNumber = text(body.partNumber ?? "", "Referência", 100, false),
        notes = text(body.notes ?? "", "Observações", 4000, false);
      if (!Array.isArray(body.originalCodes) || body.originalCodes.length > 50)
        throw fail("Informe até 50 códigos originais");
      const originalCodes = [
        ...new Map(
          body.originalCodes.map((c) => {
            const v = text(c, "Código original", 100);
            return [normalize(v), v];
          }),
        ).values(),
      ];
      if (!Array.isArray(body.applications) || body.applications.length > 200)
        throw fail("Informe até 200 aplicações");
      const applications = body.applications.map((a) => {
        if (!a || typeof a !== "object" || Array.isArray(a))
          throw fail("Aplicação inválida");
        const values = {};
        for (const [key, max] of Object.entries({
          brand: 60,
          model: 100,
          engine: 100,
          version: 100,
          notes: 1000,
        }))
          values[key] = text(
            a[key] ?? "",
            key,
            max,
            ["brand", "model"].includes(key),
          );
        for (const key of ["yearFrom", "yearTo"]) {
          if (
            !["string", "number"].includes(typeof a[key]) ||
            !/^\d{4}$/.test(String(a[key])) ||
            Number(a[key]) < 1900 ||
            Number(a[key]) > 2100
          )
            throw fail("Ano da aplicação inválido");
          values[key] = Number(a[key]);
        }
        if (values.yearTo < values.yearFrom)
          throw fail("Ano final deve ser igual ou posterior ao inicial");
        return values;
      });
      if (
        new Set(
          applications.map((a) =>
            JSON.stringify([
              normalize(a.brand),
              normalize(a.model),
              a.yearFrom,
              a.yearTo,
              normalize(a.engine),
              normalize(a.version),
            ]),
          ),
        ).size !== applications.length
      )
        throw fail("Aplicação repetida");
      const saved = await sequelize.transaction(async (transaction) => {
        await lock(transaction);
        const p = await product(req.params.id, transaction);
        const current = await PartDetail.findByPk(p.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (body.revision !== (current?.revision || 0))
          throw fail(
            "O cadastro foi alterado em outro terminal. Recarregue para continuar.",
            409,
          );
        const before = current?.toJSON() || null;
        const data = {
          manufacturer,
          partNumber,
          originalCodes,
          applications,
          notes,
          revision: (current?.revision || 0) + 1,
        };
        const result = current
          ? await current.update(data, { transaction })
          : await PartDetail.create(
              { ...data, productId: p.id },
              { transaction },
            );
        await audit(
          req.user,
          "part_details_updated",
          { productId: p.id, before, after: data },
          transaction,
        );
        return result;
      });
      res.json(saved);
    }),
  );
  function pair(first, second) {
    const ids = [uuid(first).toLowerCase(), uuid(second).toLowerCase()].sort();
    if (ids[0] === ids[1]) throw fail("Escolha outro produto como equivalente");
    return { firstProductId: ids[0], secondProductId: ids[1] };
  }
  router.post(
    "/equivalences",
    manager,
    handler(async (req, res) => {
      const ids = pair(req.body?.productId, req.body?.equivalentId),
        note = text(req.body?.note, "Justificativa da equivalência", 1000);
      await sequelize.transaction(async (transaction) => {
        await lock(transaction);
        for (const id of Object.values(ids)) {
          const p = await product(id, transaction);
          if (!p.active)
            throw fail("Ative os produtos antes de relacionar equivalências");
        }
        if (await PartEquivalence.findOne({ where: ids, transaction }))
          throw fail("Esta equivalência já está cadastrada", 409);
        await PartEquivalence.create({ ...ids, note }, { transaction });
        await audit(
          req.user,
          "part_equivalence_added",
          { ...ids, note },
          transaction,
        );
      });
      res
        .status(201)
        .json({ message: "Equivalência cadastrada nos dois produtos." });
    }),
  );
  router.delete(
    "/equivalences/:first/:second",
    manager,
    handler(async (req, res) => {
      const ids = pair(req.params.first, req.params.second);
      await sequelize.transaction(async (transaction) => {
        await lock(transaction);
        const link = await PartEquivalence.findOne({
          where: ids,
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!link) throw fail("Equivalência não encontrada", 404);
        await audit(
          req.user,
          "part_equivalence_removed",
          link.toJSON(),
          transaction,
        );
        await link.destroy({ transaction });
      });
      res.sendStatus(204);
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
