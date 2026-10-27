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
    WorkOrder,
  } = require("../models");
  const {
    fail,
    uuid,
    cents,
    quantity,
    lineCents,
    today,
  } = require("./commercialValidation");
  async function create({ body, user, workOrderId }) {
    if (body.sourceWorkOrderId) throw fail("Receba a OS pelo menu Oficina");
    if (workOrderId && body.sourceQuoteId)
      throw fail("Origem do recebimento inválida");
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
      if (workOrderId)
        await require("./workshopOperations").enabled(transaction);
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
      const workOrder = workOrderId
        ? await WorkOrder.findByPk(uuid(workOrderId), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (workOrderId && !workOrder)
        throw fail("Ordem de serviço não encontrada", 404);
      if (workOrder) {
        if (workOrder.revision !== body.revision)
          throw fail(
            "A OS mudou em outro terminal. Recarregue antes de receber.",
            409,
          );
        if (workOrder.status !== "ready")
          throw fail("Somente uma OS pronta pode ser recebida");
        if (
          workOrder.saleId &&
          (await Sale.findByPk(workOrder.saleId, { transaction }))?.status ===
            "completed"
        )
          throw fail("Esta OS já foi recebida", 409);
      }
      const document = quote || workOrder;
      const items = document
        ? document.lines.map((l) => ({
            product_id: l.productId,
            quantity: l.quantity,
          }))
        : body.items;
      if (!Array.isArray(items) || !items.length || items.length > 200)
        throw fail("Informe de 1 a 200 itens");
      const pizzaOps = require("./pizzaOperations");
      const pizzaEnabled =
        require("../config/businessProfiles").effectiveModules(
          await require("./businessSettingsService").getSettings(transaction),
        ).pizza;
      const baseIds = pizzaEnabled
        ? await pizzaOps.baseIds(transaction)
        : new Set();
      const quantities = new Map(),
        requested = [];
      for (const item of items) {
        const resolved = item.pizza
          ? await pizzaOps.resolve(item.pizza, transaction)
          : null;
        if (
          resolved &&
          item.unit_price !== undefined &&
          cents(item.unit_price, "Preço") !== cents(resolved.unitPrice)
        )
          throw fail(
            "O preço da pizza mudou. Remova e monte novamente para confirmar o valor atual.",
            409,
          );
        const id = resolved ? resolved.productId : uuid(item.product_id),
          q = quantity(item.quantity);
        if (resolved && (!Number.isInteger(q) || q > 99))
          throw fail("Informe de 1 a 99 pizzas inteiras por item");
        if (resolved && item.product_id && item.product_id !== id)
          throw fail("Produto-base divergente da montagem");
        if (!document && !resolved && baseIds.has(id))
          throw fail("Use Montar pizza para escolher os sabores deste produto");
        quantities.set(id, quantity((quantities.get(id) || 0) + q));
        requested.push({
          id,
          quantity: q,
          pizza: resolved?.pizza || null,
          notes: item.notes
            ? require("./commercialValidation").text(
                item.notes,
                "Observações",
                1000,
                false,
              )
            : null,
        });
      }
      const customerId = document ? document.customerId : body.customerId;
      const customer = customerId
        ? await Customer.findByPk(uuid(customerId), { transaction })
        : null;
      if (customerId && !customer?.active)
        throw fail("Cliente não encontrado ou inativo");
      const products = new Map();
      for (const [id, q] of [...quantities].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const product = await Product.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product?.active) throw fail("Produto não encontrado ou inativo");
        if (product.itemType !== "service" && Number(product.currentStock) < q)
          throw fail(`Estoque insuficiente para ${product.name}`);
        products.set(id, product);
      }
      const lines = [];
      let total = 0;
      // Aggregate ordinary items as before; distinct pizza assemblies remain separate.
      const merged = [];
      for (const row of requested) {
        const existing =
          !row.pizza && merged.find((m) => !m.pizza && m.id === row.id);
        if (existing) existing.quantity += row.quantity;
        else merged.push({ ...row });
      }
      for (const row of merged) {
        const product = products.get(row.id),
          quoted = document?.lines.find((l) => l.productId === row.id);
        if (quoted && quoted.itemType !== product.itemType)
          throw fail(
            "O tipo de um item do orçamento foi alterado. Revise a proposta.",
          );
        const stockTracked = product.itemType !== "service";
        const unitPrice = row.pizza
          ? row.pizza.unitPrice
          : quoted
            ? quoted.unitPrice
            : Number(product.salePrice);
        const amount = lineCents(row.quantity, cents(unitPrice, "Preço", true));
        total += amount;
        lines.push({ ...row, product, unitPrice, stockTracked, amount });
      }
      if (document) discount = cents(document.discount, "Desconto", true);
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
          sourceWorkOrderId: workOrder?.id || null,
          notes: workOrder
            ? `Ordem de serviço #${workOrder.number} — ${workOrder.vehicleSnapshot.plate}`
            : null,
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
            pizza: line.pizza,
            notes: line.notes,
            preparationStatus: line.pizza ? "pendente" : null,
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
      if (workOrder)
        await workOrder.update(
          {
            saleId: sale.id,
            revision: workOrder.revision + 1,
            events: require("./workshopOperations").event(
              workOrder,
              user,
              "paid",
              `Venda #${sale.id}`,
            ),
          },
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
      sale.setDataValue(
        "items",
        await SaleItem.findAll({ where: { sale_id: sale.id }, transaction }),
      );
      return sale;
    });
  }
  return { create };
}
module.exports = require("../tenancy/scopedModule")(factory, ["create"]);
