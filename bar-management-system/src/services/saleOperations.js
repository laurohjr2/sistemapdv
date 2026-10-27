function factory() {
  const {
    sequelize,
    Sale,
    SaleItem,
    Product,
    StockMovement,
    CashRegister,
    Customer,
    Quote,
    AuditLog,
  } = require("../models");
  const {
    fail,
    uuid,
    cents,
    quantity,
    lineCents,
    today,
  } = require("./commercialValidation");
  async function create({ body, user }) {
    const source = body.sourceQuoteId ? uuid(body.sourceQuoteId) : null;
    let discount = cents(body.discount_amount ?? 0, "Desconto", true);
    if (!source && discount && !["admin", "gerente"].includes(user.role))
      throw fail("Somente gerente e administrador podem dar descontos", 403);
    if (!body.cash_register_id)
      throw fail("Você precisa abrir um caixa para vender");
    if (
      !["dinheiro", "cartao_credito", "cartao_debito", "pix"].includes(
        body.payment_method,
      )
    )
      throw fail("Método de pagamento inválido");
    return sequelize.transaction(async (transaction) => {
      const cash = await CashRegister.findByPk(body.cash_register_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!cash?.is_open) throw fail("Você precisa abrir um caixa para vender");
      const quote = source
        ? await Quote.findByPk(source, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (source && !quote) throw fail("Orçamento não encontrado", 404);
      if (quote && (quote.status !== "approved" || quote.saleId))
        throw fail(
          "Apenas um orçamento aprovado pode ser convertido uma única vez",
          409,
        );
      if (quote && quote.validUntil < today())
        throw fail("Orçamento vencido. Crie uma nova proposta para aprovação.");
      const items = quote
        ? quote.lines.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
          }))
        : body.items;
      if (!Array.isArray(items) || !items.length || items.length > 200)
        throw fail("Informe de 1 a 200 itens");
      const quantities = new Map();
      for (const item of items) {
        const id = uuid(item.product_id),
          q = quantity(item.quantity);
        quantities.set(id, quantity((quantities.get(id) || 0) + q));
      }
      const customerId = quote ? quote.customerId : body.customerId;
      const customer = customerId
        ? await Customer.findByPk(uuid(customerId), { transaction })
        : null;
      if (customerId && !customer?.active)
        throw fail("Cliente não encontrado ou inativo");
      const lines = [];
      let total = 0;
      for (const [id, q] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const product = await Product.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product?.active) throw fail("Produto não encontrado ou inativo");
        const quoted = quote?.lines.find((l) => l.productId === id);
        if (quoted && quoted.itemType !== product.itemType)
          throw fail(
            "O tipo de um item do orçamento foi alterado. Revise a proposta.",
          );
        const stockTracked = product.itemType !== "service";
        if (stockTracked && Number(product.currentStock) < q)
          throw fail(`Estoque insuficiente para ${product.name}`);
        const unitPrice = quoted ? quoted.unitPrice : Number(product.salePrice),
          amount = lineCents(q, cents(unitPrice, "Preço", true));
        total += amount;
        lines.push({ product, quantity: q, amount, unitPrice, stockTracked });
      }
      if (quote) discount = cents(quote.discount, "Desconto", true);
      if (total > 9999999999 || discount > total)
        throw fail("Desconto ou total inválido");
      total -= discount;
      const payments = require("./payments").settlement(
        body.payments,
        body.payment_method,
        total / 100,
      );
      const sale = await Sale.create(
        {
          sourceQuoteId: source,
          customerId: customer?.id || null,
          discount_amount: discount / 100,
          payments,
          user_id: user.id,
          cash_register_id: cash.id,
          payment_method: body.payment_method,
          total_amount: total / 100,
          status: "completed",
        },
        { transaction },
      );
      for (const line of lines) {
        const { product, stockTracked } = line;
        await SaleItem.create(
          {
            sale_id: sale.id,
            product_id: product.id,
            quantity: line.quantity,
            unit_price: line.unitPrice,
            total_price: line.amount / 100,
            stockTracked,
          },
          { transaction },
        );
        if (stockTracked) {
          await product.update(
            { currentStock: Number(product.currentStock) - line.quantity },
            { transaction },
          );
          await StockMovement.create(
            {
              productId: product.id,
              userId: user.id,
              type: "saida",
              quantity: line.quantity,
              reason: "sale",
              notes: `Venda #${sale.id}`,
            },
            { transaction },
          );
        }
      }
      if (quote)
        await quote.update(
          { status: "converted", saleId: sale.id },
          { transaction },
        );
      await AuditLog.create(
        {
          userId: user.id,
          action: "sale_created",
          details: JSON.stringify({
            saleId: sale.id,
            sourceQuoteId: source,
            total: total / 100,
          }),
        },
        { transaction },
      );
      return sale;
    });
  }
  return { create };
}
module.exports = require("../tenancy/scopedModule")(factory, ["create"]);
