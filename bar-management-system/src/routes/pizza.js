function factory() {
  const router = require("express").Router(),
    { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    { handler, fail } = require("../services/commercialValidation"),
    ops = require("../services/pizzaOperations");
  const { sequelize, Sale, SaleItem, AuditLog } = require("../models");
  const { Op } = require("sequelize");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("pizza"),
  );
  router.get(
    "/catalog",
    handler(async (_req, res) => res.json(await ops.catalog())),
  );
  router.put(
    "/catalog",
    authorizeRoles("admin", "gerente"),
    handler(async (req, res) => res.json(await ops.save(req.body, req.user))),
  );
  router.post(
    "/price",
    handler(async (req, res) => res.json(await ops.resolve(req.body))),
  );
  router.get(
    "/kitchen",
    require("../middleware/businessModule")("kitchen"),
    handler(async (_req, res) => {
      res.json(
        await SaleItem.findAll({
          where: {
            pizza: { [Op.ne]: null },
            preparationStatus: {
              [Op.in]: ["pendente", "preparando", "pronto"],
            },
          },
          include: [
            {
              model: Sale,
              as: "sale",
              where: { status: "completed" },
              attributes: ["id", "created_at"],
            },
          ],
          order: [["created_at", "ASC"]],
        }),
      );
    }),
  );
  router.put(
    "/kitchen/:id",
    require("../middleware/businessModule")("kitchen"),
    handler(async (req, res) => {
      if (
        !/^\d+$/.test(req.params.id) ||
        !["pendente", "preparando", "pronto", "entregue"].includes(
          req.body.status,
        )
      )
        throw fail("Item ou situação inválidos");
      const result = await sequelize.transaction(async (transaction) => {
        const snapshot = await SaleItem.findByPk(req.params.id, {
          transaction,
        });
        if (!snapshot?.pizza) throw fail("Pizza não encontrada", 404);
        const sale = await Sale.findByPk(snapshot.sale_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (sale.status !== "completed") throw fail("Venda cancelada", 409);
        const item = await SaleItem.findByPk(snapshot.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const allowed = {
          pendente: ["preparando"],
          preparando: ["pronto"],
          pronto: ["entregue"],
        };
        if (item.preparationStatus === req.body.status) return item;
        if (!allowed[item.preparationStatus]?.includes(req.body.status))
          throw fail("Siga as etapas de preparo, pronto e entregue", 409);
        const data = { preparationStatus: req.body.status };
        data[
          req.body.status === "preparando"
            ? "preparationStartedAt"
            : req.body.status === "pronto"
              ? "preparationCompletedAt"
              : "deliveredAt"
        ] = new Date();
        await item.update(data, { transaction });
        await AuditLog.create(
          {
            userId: req.user.id,
            action: "pizza_sale_preparation",
            details: JSON.stringify({
              itemId: item.id,
              status: item.preparationStatus,
            }),
          },
          { transaction },
        );
        return item;
      });
      res.json(result);
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
