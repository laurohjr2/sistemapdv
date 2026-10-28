const { fail, date, today, text, quantity } = require("./commercialValidation");
const units = (value) => Math.round(Number(value) * 1000);
async function destination(
  models,
  productId,
  { batchNumber, expirationDate, kind = "unidentified" },
  transaction,
) {
  if (kind === "identified") {
    batchNumber = text(batchNumber, "Lote", 100);
    expirationDate = date(expirationDate, "Validade");
    const existing = await models.StockLot.findOne({
      where: { productId, batchNumber, kind },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) {
      if (existing.expirationDate !== expirationDate)
        throw fail(
          "Este lote já possui outra validade cadastrada. Confira a identificação.",
        );
      return existing;
    }
  } else {
    batchNumber = null;
    expirationDate = null;
    const existing = await models.StockLot.findOne({
      where: { productId, kind },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing) return existing;
  }
  return models.StockLot.create(
    { productId, batchNumber, expirationDate, kind, quantity: 0 },
    { transaction },
  );
}
async function apply(models, movement, options) {
  const transaction = options.transaction;
  const p = await models.Product.findByPk(movement.productId, { transaction });
  if(p?.recipeEnabled)throw fail('Produto preparado por ficha técnica não recebe estoque físico. Movimente os insumos.');
  if (!p?.lotTracked) return;
  if (!transaction) throw fail("Movimentação por lote exige transação");
  let remaining = units(movement.quantity);
  const allocations = [];
  if (movement.type === "entrada") {
    const hasBatch = Boolean(movement.batchNumber),
      hasDate = Boolean(movement.expirationDate);
    if (hasBatch !== hasDate)
      throw fail("Informe lote e validade juntos para este produto controlado");
    const kind =
      movement.reason === "return"
        ? "return"
        : hasBatch
          ? "identified"
          : "unidentified";
    const expirationDate = hasDate
      ? new Date(movement.expirationDate).toISOString().slice(0, 10)
      : null;
    const lot = await destination(
      models,
      p.id,
      { kind, batchNumber: movement.batchNumber, expirationDate },
      transaction,
    );
    await lot.update(
      {
        quantity: (units(lot.quantity) + remaining) / 1000,
        revision: lot.revision + 1,
      },
      { transaction },
    );
    allocations.push({ lotId: lot.id, quantity: remaining / 1000 });
  } else {
    const lots = await models.StockLot.findAll({
      where: { productId: p.id },
      order: [
        ["expirationDate", "ASC NULLS LAST"],
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const chosen = lots.filter(
      (l) =>
        (!movement.lotId || l.id === movement.lotId) &&
        (movement.reason !== "sale" ||
          (l.kind === "identified" && l.expirationDate >= today())),
    );
    for (const lot of chosen) {
      const amount = Math.min(remaining, units(lot.quantity));
      if (amount <= 0) continue;
      await lot.update(
        {
          quantity: (units(lot.quantity) - amount) / 1000,
          revision: lot.revision + 1,
        },
        { transaction },
      );
      allocations.push({ lotId: lot.id, quantity: amount / 1000 });
      remaining -= amount;
      if (!remaining) break;
    }
    if (remaining)
      throw fail(
        movement.reason === "sale"
          ? `Lotes válidos insuficientes para ${p.name}. Identifique os saldos pendentes e confira os vencimentos.`
          : "Saldo insuficiente no lote selecionado",
      );
  }
  await movement.update(
    { lotAllocations: allocations },
    { transaction, hooks: false },
  );
}
module.exports = { apply, destination, units };
