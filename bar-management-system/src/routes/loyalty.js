function factory() {
  const router = require("express").Router(),
    {
      sequelize,
      LoyaltyProfile: P,
      LoyaltyBenefit: B,
      Customer,
      Sale,
      AuditLog,
    } = require("../models"),
    { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    {
      handler,
      fail,
      uuid,
      text,
      cents,
      date,
    } = require("../services/commercialValidation");
  router.use(authenticateToken, authorizeRoles("admin", "gerente"));
  router.get(
    "/profiles",
    handler(async (req, res) =>
      res.json(await P.findAll({ order: [["updatedAt", "DESC"]] })),
    ),
  );
  router.get(
    "/profiles/:id",
    handler(async (req, res) =>
      res.json(await P.findByPk(uuid(req.params.id))),
    ),
  );
  router.put(
    "/profiles/:id",
    handler(async (req, res) => {
      const b = req.body || {},
        label = text(b.label, "Nome do benefício", 80),
        reason = text(b.reason, "Motivo da alteração", 1000),
        basisPoints = cents(b.percent, "Percentual", true),
        validUntil = b.validUntil ? date(b.validUntil) : null;
      if (basisPoints > 5000 || typeof b.active !== "boolean")
        throw fail("Informe percentual de 0 a 50 e situação válida");
      res.json(
        await sequelize.transaction(async (t) => {
          await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
            transaction: t,
          });
          const id = uuid(req.params.id),
            c = await Customer.findByPk(id, { transaction: t });
          if (!c) throw fail("Cliente não encontrado", 404);
          if (b.active && !c.active)
            throw fail("Ative o cliente antes de conceder o benefício");
          const p = await P.findByPk(id, {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if ((p?.revision || 0) !== b.revision)
            throw fail("Benefício alterado. Recarregue.", 409);
          const event = {
              at: new Date().toISOString(),
              userId: req.user.id,
              username: req.user.platformUserId
                ? "Master/Admin"
                : req.user.username,
              reason,
              label,
              basisPoints,
              active: b.active,
              validUntil,
            },
            values = {
              label,
              basisPoints,
              active: b.active,
              validUntil,
              revision: (p?.revision || 0) + 1,
              events: [...(p?.events || []), event],
            };
          const result = p
            ? await p.update(values, { transaction: t })
            : await P.create({ ...values, customerId: id }, { transaction: t });
          await AuditLog.create(
            {
              userId: req.user.id,
              action: "loyalty_profile_updated",
              details: JSON.stringify({ customerId: id, ...event }),
            },
            { transaction: t },
          );
          return result;
        }),
      );
    }),
  );
  router.post(
    "/quote",
    handler(async (req, res) =>
      res.json(
        await require("../services/loyaltyOperations").quote(
          req.body?.customerId,
          cents(req.body?.subtotal, "Subtotal", true),
          req.body?.revision,
        ),
      ),
    ),
  );
  async function history(id) {
    const where = id ? { customerId: uuid(id) } : {};
    const benefits = await B.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: 500,
    });
    const records = [];
    for (const b of benefits) {
      const s = await Sale.findByPk(b.saleId, {
        attributes: ["id", "status", "created_at", "total_amount"],
      });
      records.push({ ...b.toJSON(), sale: s });
    }
    return records;
  }
  router.get(
    "/history",
    handler(async (req, res) => res.json(await history(req.query.customerId))),
  );
  router.get(
    "/history.pdf",
    handler(async (req, res) => {
      const records = await history(req.query.customerId),
        doc = new (require("pdfkit"))({ margin: 40 });
      res.type("pdf");
      res.set("Content-Disposition", 'attachment; filename="fidelidade.pdf"');
      doc.pipe(res);
      doc.fontSize(18).text("Histórico de benefícios de fidelidade").moveDown();
      doc
        .fontSize(10)
        .text(
          "Até 500 registros recentes. Vendas canceladas são identificadas e não compõem a economia efetiva.",
        )
        .moveDown();
      let centsTotal = 0;
      for (const b of records) {
        const cancelled = b.sale?.status !== "completed";
        if (!cancelled) centsTotal += cents(b.discount, "Desconto", true);
        doc.text(
          "Venda #" +
            b.saleId +
            " · " +
            (cancelled ? "Cancelada" : "Concluída") +
            " · " +
            b.profile.label +
            " · " +
            b.profile.basisPoints / 100 +
            "% · R$ " +
            Number(b.discount).toFixed(2),
        );
      }
      doc
        .moveDown()
        .text(
          "Descontos em vendas concluídas: R$ " + (centsTotal / 100).toFixed(2),
        );
      doc.end();
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
