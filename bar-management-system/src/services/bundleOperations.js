const { fail, uuid, text, cents } = require("./commercialValidation");
const integer = (v, max = 99) => {
  if (
    !["string", "number"].includes(typeof v) ||
    !Number.isInteger(Number(v)) ||
    Number(v) < 1 ||
    Number(v) > max
  )
    throw fail("Informe uma quantidade inteira entre 1 e " + max);
  return Number(v);
};
// Largest remainder, in cents, per physical unit. Components sum exactly to the offer.
function allocate(total, weights) {
  const base = weights.some((w) => w > 0) ? weights : weights.map(() => 1),
    sum = base.reduce((a, b) => a + BigInt(b), 0n);
  const rows = base.map((w, i) => ({
    i,
    value: (BigInt(total) * BigInt(w)) / sum,
    remainder: (BigInt(total) * BigInt(w)) % sum,
  }));
  let left = BigInt(total) - rows.reduce((n, r) => n + r.value, 0n);
  for (const r of [...rows].sort((a, b) =>
    a.remainder === b.remainder
      ? a.i - b.i
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (!left) break;
    r.value++;
    left--;
  }
  return rows.map((r) => Number(r.value));
}
function factory() {
  const {
    sequelize,
    MenuBundle,
    Product,
    Comanda,
    ComandaItem,
    AuditLog,
  } = require("../models");
  const enabled = async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    const m = require("../config/businessProfiles").effectiveModules(
      await require("./businessSettingsService").getSettings(transaction),
    );
    if (!m.bundles)
      throw fail("Ative Combos e adicionais nas configurações", 403);
    return m;
  };
  async function products(ids, transaction, modules) {
    const map = new Map();
    const pizzaIds = modules.pizza
      ? await require("./pizzaOperations").baseIds(transaction)
      : new Set();
    for (const id of [...new Set(ids)]) {
      const p = await Product.findByPk(id, { transaction });
      if (!p?.active) throw fail("Produto não encontrado ou inativo");
      if (p.unitOfMeasure !== "unidade" && p.itemType !== "service")
        throw fail(
          "Use produtos em unidade ou porção com ficha técnica para o combo",
        );
      if (pizzaIds.has(p.id))
        throw fail(
          "Pizzas personalizadas devem ser montadas pelo botão Montar pizza",
        );
      map.set(p.id, p);
    }
    return map;
  }
  async function save(id, b, user) {
    if (
      !b ||
      typeof b !== "object" ||
      Array.isArray(b) ||
      typeof b.active !== "boolean"
    )
      throw fail("Cadastro de combo inválido");
    const name = text(b.name, "Nome", 150),
      price = cents(b.price, "Preço", true) / 100;
    const parse = (rows, extra = false) => {
      if (!Array.isArray(rows) || rows.length > 30 || (!extra && !rows.length))
        throw fail("Informe de 1 a 30 componentes e até 30 adicionais");
      const result = rows.map((r) => ({
        productId: uuid(r?.productId).toLowerCase(),
        [extra ? "maxQuantity" : "quantity"]: integer(
          r[extra ? "maxQuantity" : "quantity"],
          10,
        ),
      }));
      if (new Set(result.map((r) => r.productId)).size !== result.length)
        throw fail("Produto repetido na mesma lista");
      return result;
    };
    const components = parse(b.components),
      extras = parse(b.extras || [], true);
    if (
      components.reduce((n, i) => n + i.quantity, 0) > 50 ||
      extras.reduce((n, i) => n + i.maxQuantity, 0) > 30
    )
      throw fail("Use até 50 unidades na base e até 30 nos adicionais");
    return sequelize.transaction(async (transaction) => {
      const modules = await enabled(transaction);
      const old = id
        ? await MenuBundle.findByPk(uuid(id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (id && !old) throw fail("Combo não encontrado", 404);
      if (b.revision !== (old?.revision || 0))
        throw fail("Combo alterado em outro terminal. Recarregue.", 409);
      if (b.active)
        await products(
          [...components, ...extras].map((i) => i.productId),
          transaction,
          modules,
        );
      const values = {
        name,
        price,
        components,
        extras,
        active: b.active,
        revision: (old?.revision || 0) + 1,
      };
      const saved = old
        ? await old.update(values, { transaction })
        : await MenuBundle.create(values, { transaction });
      await AuditLog.create(
        {
          userId: user.id,
          action: "bundle_saved",
          details: JSON.stringify({ id: saved.id, ...values }),
        },
        { transaction },
      );
      return saved;
    });
  }
  async function resolve(selection, transaction) {
    if (!selection || typeof selection !== "object" || Array.isArray(selection))
      throw fail("Seleção de combo inválida");
    const modules = await enabled(transaction),
      b = await MenuBundle.findByPk(uuid(selection.id), { transaction });
    if (!b?.active) throw fail("Combo não encontrado ou inativo");
    if (selection.revision !== b.revision)
      throw fail("A composição do combo mudou. Selecione novamente.", 409);
    const selected = selection.extras || [];
    if (!Array.isArray(selected) || selected.length > 30)
      throw fail("Adicionais inválidos");
    const extras = selected.map((e) => {
      const id = uuid(e?.productId).toLowerCase(),
        option = b.extras.find((i) => i.productId === id);
      if (!option) throw fail("Adicional não pertence a este combo");
      return {
        productId: id,
        quantity: integer(e.quantity, option.maxQuantity),
      };
    });
    if (new Set(extras.map((e) => e.productId)).size !== extras.length)
      throw fail("Adicional repetido");
    const map = await products(
        [...b.components, ...extras].map((i) => i.productId),
        transaction,
        modules,
      ),
      slots = b.components.flatMap((i) =>
        Array.from({ length: i.quantity }, () => map.get(i.productId)),
      ),
      prices = allocate(
        cents(b.price, "Preço", true),
        slots.map((p) => cents(p.salePrice, "Preço", true)),
      );
    const lines = slots.map((p, i) => ({
      productId: p.id,
      name: p.name,
      unitPrice: prices[i] / 100,
      kind: "base",
    }));
    for (const e of extras)
      for (let n = 0; n < e.quantity; n++) {
        const p = map.get(e.productId);
        lines.push({
          productId: p.id,
          name: p.name,
          unitPrice: Number(p.salePrice),
          kind: "extra",
        });
      }
    const total = lines.reduce(
      (n, l) => n + cents(l.unitPrice, "Preço", true),
      0,
    );
    if (total > 9999999999) throw fail("Total do combo excede o limite");
    return {
      id: b.id,
      revision: b.revision,
      name: b.name,
      baseUnitPrice: Number(b.price),
      unitPrice: total / 100,
      extras,
      lines,
    };
  }
  const snapshot = (resolved, groupId, quantity, index) => ({
    id: resolved.id,
    revision: resolved.revision,
    name: resolved.name,
    groupId,
    quantity,
    unitPrice: resolved.unitPrice,
    baseUnitPrice: resolved.baseUnitPrice,
    extras: resolved.extras,
    components: index === 0 ? resolved.lines : undefined,
    component: resolved.lines[index],
    index,
    allocatedUnitPrice: resolved.lines[index].unitPrice,
  });
  async function addToComanda(id, b, user) {
    if (!b || typeof b !== "object" || Array.isArray(b))
      throw fail("Lançamento de combo inválido");
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      if (
        !require("../config/businessProfiles").effectiveModules(
          await require("./businessSettingsService").getSettings(transaction),
        ).tables
      )
        throw fail("Mesas e comandas desativadas", 403);
      const c = await Comanda.findByPk(uuid(id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!c || c.status !== "aberta")
        throw fail("Abra a comanda antes de lançar o combo");
      const resolved = await resolve(b.selection, transaction),
        amount = integer(b.quantity);
      if (
        cents(b.expectedUnitPrice, "Preço", true) !==
        cents(resolved.unitPrice, "Preço", true)
      )
        throw fail("Preço alterado. Selecione novamente.", 409);
      if (
        cents(c.totalValue, "Total", true) +
          cents(resolved.unitPrice, "Preço", true) * amount >
        9999999999
      )
        throw fail("Total da comanda excede o limite permitido");
      const inventory = await require("./recipeOperations").lockProducts(
          resolved.lines.map((l) => l.productId),
          transaction,
        ),
        groupId = require("node:crypto").randomUUID(),
        items = [];
      for (const l of resolved.lines) {
        const p = inventory.products.get(l.productId);
        if (p.itemType !== "service" && p.unitOfMeasure !== "unidade")
          throw fail("Unidade do componente mudou. Revise o combo.", 409);
        if (
          l.kind === "extra" &&
          cents(l.unitPrice, "Preço", true) !==
            cents(p.salePrice, "Preço", true)
        )
          throw fail("Preço do adicional mudou. Selecione novamente.", 409);
      }
      for (let i = 0; i < resolved.lines.length; i++)
        items.push(
          await require("./comandaOperations").changeItem({
            comandaId: c.id,
            productId: resolved.lines[i].productId,
            amount,
            userId: user.id,
            role: user.role,
            notes: `Combo: ${resolved.name} · grupo ${groupId.slice(0, 8)}${b.notes ? " · " + text(b.notes, "Observações", 500) : ""}`,
            bundleSnapshot: snapshot(resolved, groupId, amount, i),
            transactionContext: transaction,
            lockedInventory: inventory,
          }),
        );
      return { groupId, items };
    });
  }
  async function removeFromComanda(id, groupId, b, user) {
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const c = await Comanda.findByPk(uuid(id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!c || c.status !== "aberta")
        throw fail("A comanda deve estar aberta");
      const items = await ComandaItem.findAll({
        where: { comandaId: c.id, "bundle.groupId": uuid(groupId) },
        transaction,
      });
      if (!items.length) throw fail("Grupo não encontrado", 404);
      const overrides = Object.fromEntries(
          items.map((i) => [i.productId, i.recipe?.plan || null]),
        ),
        inventory = await require("./recipeOperations").lockProducts(
          items.map((i) => i.productId),
          transaction,
          overrides,
        );
      for (const i of items)
        await require("./comandaOperations").changeItem({
          comandaId: c.id,
          itemId: i.id,
          remove: true,
          userId: user.id,
          role: user.role,
          restoreIngredients: b?.restoreIngredients === true,
          transactionContext: transaction,
          lockedInventory: inventory,
          bundleGroupRemoval: true,
        });
      await AuditLog.create(
        {
          userId: user.id,
          action: "bundle_removed",
          details: JSON.stringify({
            comandaId: c.id,
            groupId,
            restoreIngredients: b?.restoreIngredients === true,
            items: items.map((i) => ({
              id: i.id,
              productId: i.productId,
              quantity: i.quantity,
              priceAtSale: i.priceAtSale,
              totalItemValue: i.totalItemValue,
              bundle: i.bundle,
              recipe: i.recipe,
              notes: i.notes,
            })),
          }),
        },
        { transaction },
      );
    });
  }
  return { save, resolve, snapshot, addToComanda, removeFromComanda };
}
module.exports = {
  integer,
  allocate,
  ...require("../tenancy/scopedModule")(factory, [
    "save",
    "resolve",
    "snapshot",
    "addToComanda",
    "removeFromComanda",
  ]),
};
