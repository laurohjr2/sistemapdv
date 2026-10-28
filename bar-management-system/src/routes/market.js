function factory() {
  const router = require("express").Router(),
    { Op } = require("sequelize");
  const {
    sequelize,
    Product,
    StockLot,
    StockMovement,
    AuditLog,
  } = require("../models");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    {
      handler,
      fail,
      uuid,
      text,
      quantity,
      date,
      today,
    } = require("../services/commercialValidation");
  const ops = require("../services/lotOperations"),
    models = { StockLot, Product };
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("market"),
  );
  const manager = authorizeRoles("gerente", "admin");
  const audit = (user, action, details, transaction) =>
    AuditLog.create(
      { userId: user.id, action, details: JSON.stringify(details) },
      { transaction },
    );
  async function lock(transaction) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("../services/businessSettingsService").getSettings(
          transaction,
        ),
      ).market
    )
      throw fail("Módulo de lotes desativado", 403);
  }
  async function list() {
    return (
      await StockLot.findAll({
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["id", "name", "unitOfMeasure", "active", "lotTracked"],
          },
        ],
        order: [
          ["expirationDate", "ASC NULLS LAST"],
          ["createdAt", "ASC"],
        ],
      })
    ).map((l) => {
      const row = l.toJSON();
      return {
        ...row,
        status:
          row.kind !== "identified"
            ? "pending"
            : row.expirationDate < today()
              ? "expired"
              : row.expirationDate <=
                  new Date(Date.parse(today() + "T12:00:00Z") + 30 * 86400000)
                    .toISOString()
                    .slice(0, 10)
                ? "soon"
                : "valid",
      };
    });
  }
  router.get(
    "/lots",
    handler(async (req, res) => res.json(await list())),
  );
  router.get(
    "/products",
    handler(async (req, res) =>
      res.json(
        await Product.findAll({
          where: { itemType: "product" },
          order: [["name", "ASC"]],
        }),
      ),
    ),
  );
  router.post(
    "/products/:id/control",
    manager,
    handler(async (req, res) => {
      if (typeof req.body?.enabled !== "boolean")
        throw fail("Controle inválido");
      await sequelize.transaction(async (transaction) => {
        await lock(transaction);
        const p = await Product.findByPk(uuid(req.params.id), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p || p.itemType === "service")
          throw fail("Produto não encontrado", 404);
        if (p.lotTracked === req.body.enabled) return;
        if (!req.body.enabled && ops.units(p.currentStock) !== 0)
          throw fail("Zere o saldo do produto antes de desativar o controle");
        if (req.body.enabled && ops.units(p.currentStock) > 0) {
          const lot = await ops.destination(
            models,
            p.id,
            { kind: "unidentified" },
            transaction,
          );
          await lot.update(
            { quantity: Number(p.currentStock), revision: lot.revision + 1 },
            { transaction },
          );
        }
        await p.update({ lotTracked: req.body.enabled }, { transaction });
        await audit(
          req.user,
          "lot_control_changed",
          { productId: p.id, enabled: p.lotTracked },
          transaction,
        );
      });
      res.json({ message: "Controle atualizado." });
    }),
  );
  router.post(
    "/lots/:id/identify",
    manager,
    handler(async (req, res) => {
      const amount = quantity(req.body?.quantity),
        batchNumber = text(req.body?.batchNumber, "Lote", 100),
        expirationDate = date(req.body?.expirationDate, "Validade"),
        note = text(req.body?.note, "Justificativa", 2000);
      await sequelize.transaction(async (transaction) => {
        await lock(transaction);
        const snapshot = await StockLot.findByPk(uuid(req.params.id), {
          transaction,
        });
        if (!snapshot) throw fail("Lote não encontrado", 404);
        const p = await Product.findByPk(snapshot.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const source = await StockLot.findByPk(snapshot.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p.lotTracked) throw fail("Controle por lote desativado");
        if (source.revision !== req.body.revision)
          throw fail("O saldo mudou. Recarregue antes de identificar.", 409);
        if (source.kind === "identified")
          throw fail("Somente saldos pendentes podem ser identificados");
        if (ops.units(amount) > ops.units(source.quantity))
          throw fail("Quantidade superior ao saldo pendente");
        const target = await ops.destination(
          models,
          p.id,
          { kind: "identified", batchNumber, expirationDate },
          transaction,
        );
        await source.update(
          {
            quantity: (ops.units(source.quantity) - ops.units(amount)) / 1000,
            revision: source.revision + 1,
          },
          { transaction },
        );
        await target.update(
          {
            quantity: (ops.units(target.quantity) + ops.units(amount)) / 1000,
            revision: target.revision + 1,
          },
          { transaction },
        );
        await audit(
          req.user,
          "lot_identified",
          {
            productId: p.id,
            sourceLotId: source.id,
            targetLotId: target.id,
            quantity: amount,
            note,
          },
          transaction,
        );
      });
      res.json({ message: "Saldo identificado sem alterar o estoque total." });
    }),
  );
  router.post(
    "/lots/:id/discard",
    manager,
    handler(async (req, res) => {
      const amount = quantity(req.body?.quantity),
        note = text(req.body?.note, "Justificativa", 2000);
      await sequelize.transaction(async (transaction) => {
        const snapshot = await StockLot.findByPk(uuid(req.params.id), {
          transaction,
        });
        if (!snapshot) throw fail("Lote não encontrado", 404);
        const p = await Product.findByPk(snapshot.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const lot = await StockLot.findByPk(snapshot.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p.lotTracked) throw fail("Controle desativado");
        if (lot.revision !== req.body.revision)
          throw fail("Saldo alterado. Recarregue antes da baixa.", 409);
        if (ops.units(amount) > ops.units(lot.quantity))
          throw fail("Quantidade superior ao saldo do lote");
        await p.update(
          {
            currentStock:
              (ops.units(p.currentStock) - ops.units(amount)) / 1000,
          },
          { transaction },
        );
        await StockMovement.create(
          {
            productId: p.id,
            lotId: lot.id,
            userId: req.user.id,
            type: "saida",
            quantity: amount,
            reason:
              lot.expirationDate && lot.expirationDate < today()
                ? "expiration"
                : "loss",
            notes: note,
          },
          { transaction },
        );
        await audit(
          req.user,
          "lot_discarded",
          { lotId: lot.id, quantity: amount, note },
          transaction,
        );
      });
      res.json({ message: "Baixa registrada no estoque." });
    }),
  );
  router.get(
    "/report",
    handler(async (req, res) => {
      const rows = await list(),
        doc = new (require("pdfkit"))({ margin: 40 });
      res.type("application/pdf").attachment("lotes-validade.pdf");
      doc.pipe(res);
      await require("../services/businessSettingsService").printHeader(doc);
      doc.fontSize(16).text("Lotes e validade");
      doc.moveDown();
      doc
        .fontSize(10)
        .text(
          "Data: " +
            today() +
            " | Saldos positivos. Conferir fisicamente a separação dos lotes.",
        );
      for (const l of rows.filter((l) => Number(l.quantity) > 0))
        doc
          .moveDown()
          .text(
            `${l.product.name} | ${l.batchNumber || "Sem lote / pendente"} | Validade: ${l.expirationDate || "Não informada"} | ${Number(l.quantity)} ${l.product.unitOfMeasure} | ${{ pending: "Pendente de identificação", expired: "Vencido", soon: "Vence em até 30 dias", valid: "Válido" }[l.status]}`,
          );
      doc.end();
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
