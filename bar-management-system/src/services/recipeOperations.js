const { fail, quantity, cents, lineCents } = require("./commercialValidation");
const units = (n) => Math.round(Number(n) * 1000);
const required = (amount, per, yieldQuantity) =>
  Number(
    (BigInt(units(amount)) * BigInt(units(per)) +
      BigInt(units(yieldQuantity)) -
      1n) /
      BigInt(units(yieldQuantity)),
  ) / 1000;
function factory() {
  const {
      sequelize,
      Product,
      Recipe,
      StockLot,
      StockMovement,
      AuditLog,
    } = require("../models"),
    { Op } = require("sequelize");
  async function physicalLocks(ids, transaction) {
    const map = new Map();
    for (const id of [...new Set(ids)].sort()) {
      const p = await Product.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!p) throw fail("Produto ou insumo não encontrado");
      map.set(p.id, p);
      map.set(id, p);
    }
    return map;
  }
  const planOf = (r) => ({
    productId: r.productId,
    revision: r.revision,
    yieldQuantity: Number(r.yieldQuantity),
    outputUnit: r.outputUnit,
    ingredients: r.ingredients,
  });
  async function lockProducts(ids, transaction, overrides = {}) {
    const initial = await Product.findAll({
        where: { id: { [Op.in]: ids } },
        transaction,
      }),
      plans = new Map();
    for (const p of initial) {
      if (Object.hasOwn(overrides, p.id)) plans.set(p.id, overrides[p.id]);
      else if (p.recipeEnabled) {
        const recipe = await Recipe.findByPk(p.id, { transaction });
        if (!recipe) throw fail("Ficha técnica ausente");
        plans.set(p.id, planOf(recipe));
      }
    }
    const all = [
      ...ids,
      ...[...plans.values()]
        .filter(Boolean)
        .flatMap((p) => p.ingredients.map((i) => i.productId)),
    ];
    const products = await physicalLocks(all, transaction);
    for (const p of initial) {
      const current = products.get(p.id);
      if (current.recipeEnabled !== p.recipeEnabled)
        throw fail(
          "Tipo de estoque alterado durante a operação. Recarregue.",
          409,
        );
      const plan = plans.get(p.id);
      if (plan && !Object.hasOwn(overrides, p.id)) {
        const fresh = await Recipe.findByPk(p.id, { transaction });
        if (fresh?.revision !== plan.revision)
          throw fail("Ficha técnica alterada. Recarregue os itens.", 409);
      }
    }
    return { products, plans };
  }
  async function available(products, transaction) {
    const map = new Map(products.map((p) => [p.id, p])),
      quantities = new Map(
        products.map((p) => [p.id, p.active ? units(p.currentStock) : 0]),
      );
    const tracked = products.filter((p) => p.lotTracked);
    if (tracked.length) {
      for (const p of tracked) quantities.set(p.id, 0);
      for (const lot of await StockLot.findAll({
        where: {
          productId: { [Op.in]: tracked.map((p) => p.id) },
          kind: "identified",
          expirationDate: {
            [Op.gte]: require("./commercialValidation").today(),
          },
          quantity: { [Op.gt]: 0 },
        },
        transaction,
        raw: true,
      }))
        quantities.set(
          lot.productId,
          (quantities.get(lot.productId) || 0) + units(lot.quantity),
        );
    }
    return { map, quantities };
  }
  async function availability(ids, transaction) {
    const recipes = await Recipe.findAll({
      where: { productId: { [Op.in]: ids } },
      transaction,
    });
    const ingredients = await Product.findAll({
      where: {
        id: {
          [Op.in]: [
            ...new Set(
              recipes.flatMap((r) => r.ingredients.map((i) => i.productId)),
            ),
          ],
        },
      },
      transaction,
    });
    const { map, quantities } = await available(ingredients, transaction),
      result = new Map();
    for (const r of recipes) {
      let max = 9999999999;
      for (const i of r.ingredients) {
        const p = map.get(i.productId);
        if (
          !p?.active ||
          p.recipeEnabled ||
          p.itemType === "service" ||
          p.unitOfMeasure !== i.unit
        ) {
          max = 0;
          break;
        }
        max = Math.min(
          max,
          Number(
            (BigInt(quantities.get(p.id) || 0) *
              BigInt(units(r.yieldQuantity))) /
              BigInt(units(i.quantity)),
          ),
        );
      }
      result.set(r.productId, max / 1000);
    }
    return result;
  }
  const audit = (userId, action, details, transaction) =>
    AuditLog.create(
      { userId, action, details: JSON.stringify(details) },
      { transaction },
    );
  async function moveIngredient(
    p,
    amount,
    out,
    { userId, transaction, sourceComandaId, note, unitCost },
  ) {
    if (p.itemType === "service" || p.recipeEnabled)
      throw fail(
        "Insumo alterado para serviço ou receita. Confira a ficha técnica.",
        409,
      );
    if (out && !p.active) throw fail("Insumo inativo: " + p.name);
    if (out && units(p.currentStock) < units(amount))
      throw fail("Estoque insuficiente do insumo " + p.name);
    await p.update(
      {
        currentStock:
          (units(p.currentStock) + (out ? -1 : 1) * units(amount)) / 1000,
      },
      { transaction },
    );
    await StockMovement.create(
      {
        productId: p.id,
        userId,
        sourceComandaId: sourceComandaId || null,
        type: out ? "saida" : "entrada",
        quantity: amount,
        unitCost: unitCost ?? p.costPrice,
        reason: out ? "sale" : "return",
        notes: note,
      },
      { transaction },
    );
  }
  async function resize(snapshot, plan, amount, restore, ctx) {
    const consumed = [],
      before = new Map((snapshot?.consumed || []).map((i) => [i.productId, i]));
    let cost = 0;
    for (const i of plan.ingredients) {
      const p = ctx.locked.products.get(i.productId);
      if (!p || p.unitOfMeasure !== i.unit)
        throw fail("Unidade do insumo alterada. Revise a ficha técnica.", 409);
      const next = amount
          ? required(amount, i.quantity, plan.yieldQuantity)
          : 0,
        old = before.get(i.productId)?.quantity || 0,
        delta = (units(next) - units(old)) / 1000;
      if (delta > 0) await moveIngredient(p, delta, true, ctx);
      if (delta < 0) {
        if (restore)
          await moveIngredient(p, -delta, false, {
            ...ctx,
            unitCost: before.get(i.productId)?.unitCost,
          });
        else
          await audit(
            ctx.userId,
            "recipe_ingredients_kept",
            {
              productId: plan.productId,
              ingredientId: p.id,
              quantity: -delta,
              note: ctx.note,
            },
            ctx.transaction,
          );
      }
      if (next) {
        consumed.push({
          productId: p.id,
          name: i.name,
          unit: i.unit,
          quantity: next,
          unitCost: Number(p.costPrice),
        });
        cost += lineCents(next, cents(p.costPrice, "Custo", true));
      }
    }
    return { plan, amount, consumed, estimatedCost: cost / 100 };
  }
  async function consume(productId, amount, ctx) {
    const plan = ctx.locked.plans.get(productId);
    if (!plan) return null;
    const p = ctx.locked.products.get(productId);
    if (p.unitOfMeasure !== plan.outputUnit)
      throw fail(
        "Unidade do produto preparado alterada. Revise sua ficha técnica.",
        409,
      );
    return resize(null, plan, quantity(amount), false, ctx);
  }
  async function restore(snapshot, doRestore, ctx) {
    if (!snapshot) return;
    if (!doRestore) {
      await audit(
        ctx.userId,
        "recipe_ingredients_kept",
        { snapshot, note: ctx.note },
        ctx.transaction,
      );
      return;
    }
    for (const i of snapshot.consumed) {
      const p = ctx.locked.products.get(i.productId);
      if (!p || p.unitOfMeasure !== i.unit)
        throw fail(
          "Unidade do insumo mudou; cancele sem reposição e confira o estoque.",
          409,
        );
      await moveIngredient(p, i.quantity, false, {
        ...ctx,
        unitCost: i.unitCost,
      });
    }
    await audit(
      ctx.userId,
      "recipe_ingredients_returned",
      {
        productId: snapshot.plan.productId,
        ingredients: snapshot.consumed,
        note: ctx.note,
      },
      ctx.transaction,
    );
  }
  return {
    lockProducts,
    physicalLocks,
    availability,
    consume,
    resize,
    restore,
    planOf,
  };
}
module.exports = {
  required,
  ...require("../tenancy/scopedModule")(factory, [
    "lockProducts",
    "physicalLocks",
    "availability",
    "consume",
    "resize",
    "restore",
    "planOf",
  ]),
};
