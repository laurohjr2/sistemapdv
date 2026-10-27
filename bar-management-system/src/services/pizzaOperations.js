function factory() {
  const { sequelize, PizzaCatalog, Product, AuditLog } = require("../models");
  const { fail, uuid, text, cents } = require("./commercialValidation");
  const enabled = async (transaction) => {
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("./businessSettingsService").getSettings(transaction),
      ).pizza
    )
      throw fail("Ative o módulo Pizzaria nas configurações da empresa", 403);
  };
  async function catalog(transaction, lock = false) {
    // A fixed transaction advisory lock also serializes creation of the singleton.
    if (lock)
      await sequelize.query("SELECT pg_advisory_xact_lock(882022)", {
        transaction,
      });
    const [row] = await PizzaCatalog.findOrCreate({
      where: { id: 1 },
      transaction,
    });
    return row;
  }
  const integer = (v, min, max, label) => {
    if (!Number.isInteger(v) || v < min || v > max)
      throw fail(label + " inválido");
    return v;
  };
  function rows(value, max, label) {
    if (!Array.isArray(value) || value.length > max)
      throw fail(label + " inválidos");
    const ids = new Set();
    return value.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row))
        throw fail(label + " inválidos");
      const id = uuid(row.id);
      if (ids.has(id)) throw fail("Identificador repetido em " + label);
      ids.add(id);
      if (typeof row.active !== "boolean")
        throw fail("Informe a situação de " + label);
      return { id, name: text(row.name, label, 100), active: row.active };
    });
  }
  async function save(body, user) {
    await enabled();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw fail("Cardápio inválido");
    return sequelize.transaction(async (transaction) => {
      const current = await catalog(transaction, true);
      if (body.revision !== current.revision)
        throw fail(
          "O cardápio mudou em outra sessão. Recarregue antes de salvar.",
          409,
        );
      if (!["highest", "average"].includes(body.pricingRule))
        throw fail("Regra de preço inválida");
      const sizes = rows(body.sizes, 20, "tamanhos");
      for (let i = 0; i < sizes.length; i++) {
        const source = body.sizes[i],
          s = sizes[i];
        s.productId = uuid(source.productId);
        s.maxFlavors = integer(source.maxFlavors, 1, 4, "Limite de sabores");
        s.slices = integer(source.slices, 1, 24, "Quantidade de fatias");
        const p = await Product.findByPk(s.productId, { transaction });
        if (!p || p.itemType === "service" || (s.active && !p.active))
          throw fail(
            "O produto-base precisa ser um produto ativo, com estoque por unidade",
          );
        if (p.unitOfMeasure !== "unidade")
          throw fail("O produto-base da pizza deve usar a unidade Unidade");
      }
      const values = {
        sizes,
        pricingRule: body.pricingRule,
        revision: current.revision + 1,
      };
      for (const [kind, max] of [
        ["flavors", 200],
        ["crusts", 40],
        ["extras", 80],
      ]) {
        values[kind] = rows(
          body[kind],
          max,
          kind === "flavors"
            ? "sabores"
            : kind === "crusts"
              ? "bordas"
              : "adicionais",
        );
        values[kind].forEach((r, i) => {
          const raw = body[kind][i].prices;
          if (!raw || typeof raw !== "object" || Array.isArray(raw))
            throw fail("Informe os preços por tamanho");
          r.prices = {};
          for (const [id, value] of Object.entries(raw)) {
            if (!sizes.some((s) => s.id === id))
              throw fail("Preço associado a tamanho inexistente");
            if (value !== "" && value !== null)
              r.prices[id] = cents(value, "Preço", kind !== "flavors") / 100;
          }
          if (
            r.active &&
            !sizes.some((s) => s.active && Object.hasOwn(r.prices, s.id))
          )
            throw fail(
              "Cada opção ativa precisa de preço em pelo menos um tamanho ativo",
            );
        });
      }
      await current.update(values, { transaction });
      await AuditLog.create(
        {
          userId: user.id,
          action: "pizza_catalog_updated",
          details: JSON.stringify({ revision: values.revision }),
        },
        { transaction },
      );
      return current;
    });
  }
  async function resolve(selection, transaction) {
    // Serialize assembly with module changes, so disabling cannot miss an in-flight order.
    if (transaction)
      await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
        transaction,
      });
    await enabled(transaction);
    if (!selection || typeof selection !== "object" || Array.isArray(selection))
      throw fail("Informe a montagem da pizza");
    const menu = await catalog(transaction, Boolean(transaction));
    if (
      selection.catalogRevision !== undefined &&
      selection.catalogRevision !== menu.revision
    )
      throw fail(
        "O cardápio mudou. Monte novamente a pizza para confirmar a composição e o preço atuais.",
        409,
      );
    const size = menu.sizes.find(
      (s) => s.id === uuid(selection.sizeId) && s.active,
    );
    if (!size) throw fail("Tamanho indisponível");
    if (
      !Array.isArray(selection.flavorIds) ||
      selection.flavorIds.length < 1 ||
      selection.flavorIds.length > size.maxFlavors ||
      new Set(selection.flavorIds).size !== selection.flavorIds.length
    )
      throw fail("Selecione sabores distintos dentro do limite do tamanho");
    function option(kind, id) {
      const row = menu[kind].find((o) => o.id === uuid(id) && o.active);
      if (!row || !Object.hasOwn(row.prices, size.id))
        throw fail("Opção indisponível para este tamanho");
      return {
        id: row.id,
        name: row.name,
        unitPrice: Number(row.prices[size.id]),
      };
    }
    const flavors = [...selection.flavorIds]
      .sort()
      .map((id) => option("flavors", id));
    const crust = selection.crustId
      ? option("crusts", selection.crustId)
      : null;
    const inputExtras = selection.extras ?? [];
    if (
      !Array.isArray(inputExtras) ||
      inputExtras.some(
        (e) => !e || typeof e !== "object" || Array.isArray(e),
      ) ||
      inputExtras.length > 20 ||
      new Set(inputExtras.map((e) => e.id)).size !== inputExtras.length
    )
      throw fail("Adicionais inválidos");
    const extras = [...inputExtras]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((e) => {
        const row = option("extras", e.id),
          quantity = integer(e.quantity, 1, 5, "Quantidade do adicional");
        return {
          ...row,
          quantity,
          total: (cents(row.unitPrice, "Preço", true) * quantity) / 100,
        };
      });
    const prices = flavors.map((f) => cents(f.unitPrice)),
      flavorCents =
        menu.pricingRule === "highest"
          ? Math.max(...prices)
          : Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const total =
      flavorCents +
      (crust ? cents(crust.unitPrice, "Borda", true) : 0) +
      extras.reduce((sum, e) => sum + cents(e.total, "Adicional", true), 0);
    cents(total / 100, "Total");
    const description = `Pizza ${size.name} (${size.slices} fatias): ${flavors.map((f) => (flavors.length > 1 ? "1/" + flavors.length + " " : "") + f.name).join(" + ")}${crust ? " | Borda: " + crust.name : ""}${extras.length ? " | Adicionais: " + extras.map((e) => e.quantity + "x " + e.name).join(", ") : ""}`;
    return {
      productId: size.productId,
      unitPrice: total / 100,
      pizza: {
        catalogRevision: menu.revision,
        pricingRule: menu.pricingRule,
        size: { id: size.id, name: size.name, slices: size.slices },
        flavors,
        crust,
        extras,
        flavorPrice: flavorCents / 100,
        unitPrice: total / 100,
        description,
        selection: {
          catalogRevision: menu.revision,
          sizeId: size.id,
          flavorIds: flavors.map((f) => f.id),
          crustId: crust?.id || null,
          extras: extras.map((e) => ({ id: e.id, quantity: e.quantity })),
        },
      },
    };
  }
  async function baseIds(transaction) {
    const menu = await PizzaCatalog.findByPk(1, { transaction });
    return new Set(
      (menu?.sizes || []).filter((s) => s.active).map((s) => s.productId),
    );
  }
  return { enabled, catalog, save, resolve, baseIds };
}
module.exports = require("../tenancy/scopedModule")(factory, [
  "enabled",
  "catalog",
  "save",
  "resolve",
  "baseIds",
]);
