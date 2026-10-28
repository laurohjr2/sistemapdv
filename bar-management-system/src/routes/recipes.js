function factory() {
  const router = require("express").Router(),
    { Op } = require("sequelize");
  const {
    sequelize,
    Product,
    Recipe,
    ComandaItem,
    Comanda,
    Ticket,
    SaleItem,
    Sale,
    CashRegister,
    AuditLog,
  } = require("../models");
  const {
    handler,
    fail,
    uuid,
    quantity,
    text,
  } = require("../services/commercialValidation");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("recipes"),
  );
  router.get(
    "/",
    handler(async (req, res) =>
      res.json(await Recipe.findAll({ order: [["updatedAt", "DESC"]] })),
    ),
  );
  router.put(
    "/:id",
    authorizeRoles("gerente", "admin"),
    handler(async (req, res) => {
      const b = req.body;
      if (
        !b ||
        typeof b !== "object" ||
        Array.isArray(b) ||
        typeof b.enabled !== "boolean"
      )
        throw fail("Ficha técnica inválida");
      const yieldQuantity = quantity(b.yieldQuantity),
        notes = text(b.notes ?? "", "Observações", 4000, false);
      if (
        !Array.isArray(b.ingredients) ||
        !b.ingredients.length ||
        b.ingredients.length > 100
      )
        throw fail("Escolha de 1 a 100 insumos");
      const ids = b.ingredients.map((i) => uuid(i?.productId).toLowerCase());
      if (new Set(ids).size !== ids.length) throw fail("Insumo repetido");
      const result = await sequelize.transaction(async (transaction) => {
        await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
          transaction,
        });
        if (
          !require("../config/businessProfiles").effectiveModules(
            await require("../services/businessSettingsService").getSettings(
              transaction,
            ),
          ).recipes
        )
          throw fail("Módulo desativado", 403);
        const p = await Product.findByPk(uuid(req.params.id), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p || p.itemType === "service")
          throw fail("Escolha um produto preparado, não um serviço");
        const old = await Recipe.findByPk(p.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (b.revision !== (old?.revision || 0))
          throw fail("Ficha alterada em outro terminal. Recarregue.", 409);
        if (ids.includes(p.id))
          throw fail("O produto não pode ser insumo de si mesmo");
        if (
          b.enabled &&
          (!p.active || p.lotTracked || Number(p.currentStock) !== 0)
        )
          throw fail(
            "Para ativar, use produto ativo, sem estoque físico e sem controle de lote no item pronto. Os lotes pertencem aos insumos.",
          );
        if (b.enabled !== p.recipeEnabled) {
          if (
            await ComandaItem.count({
              where: { productId: p.id },
              include: [
                { model: Comanda, as: "comanda", where: { status: "aberta" } },
              ],
              transaction,
            })
          )
            throw fail(
              "Conclua as comandas abertas deste produto antes de alterar o controle",
            );
          if (
            await Ticket.count({
              where: { product_id: p.id, status: "pending" },
              transaction,
            })
          )
            throw fail(
              "Conclua os tickets pendentes antes de alterar o controle",
            );
          if (
            b.enabled &&
            (await SaleItem.count({
              where: { product_id: p.id, stockTracked: true },
              include: [
                {
                  model: Sale,
                  as: "sale",
                  where: { status: "completed" },
                  include: [
                    {
                      model: CashRegister,
                      as: "cashRegister",
                      where: { is_open: true },
                    },
                  ],
                },
              ],
              transaction,
            }))
          )
            throw fail(
              "Feche o caixa das vendas físicas deste produto antes de mudar para receita",
            );
        }
        if (b.enabled) {
          for (const other of await Recipe.findAll({ transaction })) {
            if (
              other.productId !== p.id &&
              (await Product.findByPk(other.productId, { transaction }))
                ?.recipeEnabled &&
              other.ingredients.some((i) => i.productId === p.id)
            )
              throw fail(
                "Este produto é insumo de outra ficha ativa. Não são permitidas receitas aninhadas.",
              );
          }
        }
        if (b.enabled && !p.recipeEnabled) {
          const open = await ComandaItem.findAll({
            where: { recipe: { [Op.ne]: null } },
            include: [
              { model: Comanda, as: "comanda", where: { status: "aberta" } },
            ],
            transaction,
          });
          if (
            open.some((i) =>
              i.recipe.plan.ingredients.some((c) => c.productId === p.id),
            )
          )
            throw fail(
              "Este insumo está em uma comanda aberta. Finalize o atendimento antes de mudar seu tipo.",
            );
        }
        const ingredients = [];
        for (let i = 0; i < ids.length; i++) {
          const input = await Product.findByPk(ids[i], { transaction });
          if (
            !input ||
            (b.enabled && !input.active) ||
            input.itemType === "service" ||
            input.recipeEnabled
          )
            throw fail(
              "Escolha apenas insumos físicos ativos, sem outra receita",
            );
          ingredients.push({
            productId: input.id,
            name: input.name,
            unit: input.unitOfMeasure,
            quantity: quantity(b.ingredients[i].quantity),
          });
        }
        const values = {
          yieldQuantity,
          outputUnit: p.unitOfMeasure,
          ingredients,
          notes,
          revision: (old?.revision || 0) + 1,
        };
        const saved = old
          ? await old.update(values, { transaction })
          : await Recipe.create(
              { ...values, productId: p.id },
              { transaction },
            );
        await p.update({ recipeEnabled: b.enabled }, { transaction });
        await AuditLog.create(
          {
            userId: req.user.id,
            action: "recipe_updated",
            details: JSON.stringify({
              productId: p.id,
              enabled: b.enabled,
              definition: values,
            }),
          },
          { transaction },
        );
        return saved;
      });
      res.json(result);
    }),
  );
  router.get(
    "/kitchen",
    require("../middleware/businessModule")("kitchen"),
    handler(async (_req, res) => {
      res.json(
        await SaleItem.findAll({
          where: {
            recipe: { [Op.ne]: null },
            pizza: null,
            preparationStatus: {
              [Op.in]: ["pendente", "preparando", "pronto"],
            },
          },
          include: [
            { model: Product, as: "product", attributes: ["name"] },
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
        if (!snapshot?.recipe || snapshot.pizza)
          throw fail("Pedido preparado não encontrado", 404);
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
            action: "recipe_sale_preparation",
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
