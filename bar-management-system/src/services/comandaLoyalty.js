function factory() {
  const {
      sequelize,
      Comanda,
      ComandaItem,
      LoyaltyComandaBenefit,
      AuditLog,
    } = require("../models"),
    { fail, uuid, cents } = require("./commercialValidation"),
    { digest } = require("./workshopEvidenceValidation");
  async function scope(c, transaction) {
    const rows = await ComandaItem.findAll({
      where: { comandaId: c.id },
      attributes: [
        "id",
        "productId",
        "quantity",
        "priceAtSale",
        "totalItemValue",
      ],
      order: [["id", "ASC"]],
      transaction,
      raw: true,
    });
    if (!rows.length) throw fail("Inclua itens antes de aplicar fidelidade");
    const subtotal = cents(c.totalValue, "Subtotal", true);
    if (
      rows.reduce(
        (sum, r) => sum + cents(r.totalItemValue, "Item", true),
        0,
      ) !== subtotal
    )
      throw fail(
        "Os valores da comanda precisam ser conferidos antes de aplicar fidelidade",
        409,
      );
    return {
      subtotal,
      scopeDigest: digest({
        id: c.id,
        customerId: c.customerId,
        updatedAt: new Date(c.updated_at).toISOString(),
        rows,
        subtotal,
      }),
    };
  }
  async function inspect(c, revision, transaction) {
    if (!c || c.status !== "aberta")
      throw fail("Selecione uma comanda aberta", 404);
    if (!c.customerId)
      throw fail(
        "Vincule e salve um cliente cadastrado na comanda antes de aplicar fidelidade",
      );
    const state = await scope(c, transaction),
      quote = await require("./loyaltyOperations").quote(
        c.customerId,
        state.subtotal,
        revision,
        transaction,
      );
    return {
      ...quote,
      ...state,
      comandaId: c.id,
      comandaUpdatedAt: new Date(c.updated_at).toISOString(),
      revision,
    };
  }
  async function quote(id, revision) {
    return sequelize.transaction(async (transaction) => {
      await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
        transaction,
      });
      const c = await Comanda.findByPk(uuid(id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      return inspect(c, revision, transaction);
    });
  }
  async function apply(
    c,
    selection,
    discount,
    percent,
    userId,
    role,
    transaction,
  ) {
    if (!["gerente", "admin"].includes(role))
      throw fail("Fidelidade exige gerente ou administrador", 403);
    if (
      !selection ||
      typeof selection !== "object" ||
      Array.isArray(selection) ||
      selection.comandaId !== c.id ||
      selection.customerId !== c.customerId
    )
      throw fail("Confira novamente o cliente e a comanda da fidelidade", 409);
    const current = await inspect(c, selection.revision, transaction);
    if (
      current.scopeDigest !== selection.scopeDigest ||
      cents(discount, "Desconto", true) !== current.discount ||
      Number(percent) !== 0
    )
      throw fail(
        "A comanda mudou ou há outro desconto. Confira novamente a fidelidade.",
        409,
      );
    if (
      await LoyaltyComandaBenefit.findOne({
        where: { comandaId: c.id },
        transaction,
      })
    )
      throw fail("Benefício já registrado nesta comanda", 409);
    const record = await LoyaltyComandaBenefit.create(
      {
        comandaId: c.id,
        customerId: c.customerId,
        profile: {
          ...current.snapshot,
          customerName: c.customerName || "",
          type: c.type,
        },
        discount: current.discount / 100,
        subtotal: current.subtotal / 100,
        scopeDigest: current.scopeDigest,
        createdBy: userId,
      },
      { transaction },
    );
    await AuditLog.create(
      {
        userId,
        action: "loyalty_comanda_applied",
        details: JSON.stringify({
          comandaId: c.id,
          customerId: c.customerId,
          discount: current.discount / 100,
          profile: current.snapshot,
        }),
      },
      { transaction },
    );
    return record;
  }
  return { quote, apply };
}
module.exports = require("../tenancy/scopedModule")(factory, [
  "quote",
  "apply",
]);
