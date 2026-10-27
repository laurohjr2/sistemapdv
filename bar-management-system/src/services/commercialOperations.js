function factory() {
  const M = require("../models");
  const {
    sequelize,
    Product,
    Customer,
    Supplier,
    Quote,
    PurchaseOrder,
    PurchaseReceipt,
    FinancialEntry,
    FinancialPayment,
    CashRegister,
    CashMovement,
    StockMovement,
    AuditLog,
  } = M;
  const V = require("./commercialValidation");
  const { fail, uuid, text, cents, quantity, lineCents, date, today, digest } =
    V;
  const audit = (user, action, details, transaction) =>
    AuditLog.create(
      { userId: user.id, action, details: JSON.stringify(details) },
      { transaction },
    );
  const manager = (user) => ["admin", "gerente"].includes(user.role);
  async function quoteLines(lines, user, transaction) {
    if (!Array.isArray(lines) || !lines.length || lines.length > 200)
      throw fail("Informe de 1 a 200 itens");
    const seen = new Set(),
      result = [];
    for (const l of lines) {
      const id = uuid(l.productId);
      if (seen.has(id)) throw fail("Agrupe a quantidade dos itens repetidos");
      seen.add(id);
      const p = await Product.findByPk(id, { transaction });
      if (!p?.active)
        throw fail("Produto ou serviço não encontrado ou inativo");
      const qty = quantity(l.quantity),
        unit = cents(l.unitPrice ?? p.salePrice, "Preço", true);
      if (unit !== cents(p.salePrice, "Preço", true) && !manager(user))
        throw fail(
          "Somente gerente e administrador podem alterar o preço do orçamento",
          403,
        );
      result.push({
        productId: id,
        name: p.name,
        itemType: p.itemType,
        unit: p.unitOfMeasure,
        quantity: qty,
        unitPrice: unit / 100,
        total: lineCents(qty, unit) / 100,
      });
    }
    return result;
  }
  async function saveQuote({ id, body, user }) {
    return sequelize.transaction(async (transaction) => {
      const quote = id
        ? await Quote.findByPk(uuid(id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (id && !quote) throw fail("Orçamento não encontrado", 404);
      if (
        quote &&
        (quote.status !== "draft" ||
          (!manager(user) && quote.createdBy !== user.id))
      )
        throw fail("Apenas o rascunho autorizado pode ser editado", 403);
      const customer = body.customerId
        ? await Customer.findByPk(uuid(body.customerId), { transaction })
        : null;
      if (body.customerId && !customer?.active)
        throw fail("Cliente não encontrado ou inativo");
      const lines = await quoteLines(body.lines, user, transaction),
        subtotal = lines.reduce((n, l) => n + cents(l.total, "Total", true), 0),
        discount = cents(body.discount ?? 0, "Desconto", true);
      if (discount && !manager(user))
        throw fail("Desconto exige gerente ou administrador", 403);
      if (discount > subtotal || subtotal > 9999999999)
        throw fail("Desconto ou total inválido");
      const values = {
        customerId: customer?.id || null,
        customerName: customer?.name || text(body.customerName, "Cliente", 150),
        lines,
        subtotal: subtotal / 100,
        discount: discount / 100,
        total: (subtotal - discount) / 100,
        validUntil: date(body.validUntil, "Validade"),
        notes: text(body.notes ?? "", "Observações", 2000, false),
      };
      if (values.validUntil < today())
        throw fail("A validade não pode ser anterior a hoje");
      const result = quote
        ? await quote.update(values, { transaction })
        : await Quote.create(
            { ...values, createdBy: user.id },
            { transaction },
          );
      await audit(
        user,
        quote ? "quote_updated" : "quote_created",
        { id: result.id, total: result.total },
        transaction,
      );
      return result;
    });
  }
  async function quoteStatus({ id, body, user }) {
    return sequelize.transaction(async (transaction) => {
      const q = await Quote.findByPk(uuid(id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!q) throw fail("Orçamento não encontrado", 404);
      if (!manager(user) && q.createdBy !== user.id)
        throw fail("Sem permissão para alterar este orçamento", 403);
      const transitions = {
        draft: ["sent", "cancelled"],
        sent: ["approved", "rejected", "cancelled"],
        approved: ["cancelled"],
      };
      if (!transitions[q.status]?.includes(body.status))
        throw fail("Mudança de situação não permitida", 409);
      const values = { status: body.status };
      if (body.status === "approved") {
        if (!manager(user))
          throw fail("Aprovação exige gerente ou administrador", 403);
        if (q.validUntil < today()) throw fail("Orçamento vencido");
        values.approvedBy = user.id;
        values.approvalNote = text(
          body.approvalNote,
          "Registro do aceite",
          2000,
        );
        values.approvedAt = new Date();
      }
      await q.update(values, { transaction });
      await audit(
        user,
        "quote_status_changed",
        { id: q.id, status: q.status },
        transaction,
      );
      return q;
    });
  }
  async function createPurchase({ body, user }) {
    return sequelize.transaction(async (transaction) => {
      const supplier = await Supplier.findByPk(uuid(body.supplierId), {
        transaction,
      });
      if (!supplier?.active) throw fail("Fornecedor não encontrado ou inativo");
      if (
        !Array.isArray(body.lines) ||
        !body.lines.length ||
        body.lines.length > 200
      )
        throw fail("Informe de 1 a 200 itens");
      const seen = new Set(),
        lines = [];
      let total = 0;
      for (const l of body.lines) {
        const id = uuid(l.productId);
        if (seen.has(id))
          throw fail("Agrupe a quantidade dos produtos repetidos");
        seen.add(id);
        const p = await Product.findByPk(id, { transaction });
        if (!p?.active || p.itemType === "service")
          throw fail("Compras de estoque aceitam somente produtos ativos");
        const qty = quantity(l.quantity),
          unit = cents(l.unitCost, "Custo", true);
        total += lineCents(qty, unit);
        lines.push({
          lineId: require("node:crypto").randomUUID(),
          productId: id,
          name: p.name,
          quantity: qty,
          unitCost: unit / 100,
          receivedQuantity: 0,
        });
      }
      if (total <= 0 || total > 9999999999)
        throw fail(
          "O pedido deve ter um valor total positivo dentro do limite",
        );
      const order = await PurchaseOrder.create(
        {
          supplierId: supplier.id,
          supplierName: supplier.name,
          lines,
          total: total / 100,
          expectedDate: body.expectedDate ? date(body.expectedDate) : null,
          notes: text(body.notes ?? "", "Observações", 2000, false),
          createdBy: user.id,
        },
        { transaction },
      );
      await audit(
        user,
        "purchase_created",
        { id: order.id, total: order.total },
        transaction,
      );
      return order;
    });
  }
  async function receivePurchase({ id, body, user }) {
    id = uuid(id);
    const requestKey = uuid(body.requestKey),
      dueDate = date(body.dueDate, "Vencimento");
    if (!Array.isArray(body.lines) || !body.lines.length)
      throw fail("Informe os itens recebidos");
    const receiptLines = body.lines
      .map((l) => ({ lineId: uuid(l.lineId), quantity: quantity(l.quantity) }))
      .sort((a, b) => a.lineId.localeCompare(b.lineId));
    if (new Set(receiptLines.map((l) => l.lineId)).size !== receiptLines.length)
      throw fail("Item de recebimento repetido");
    const requestHash = digest({ id, dueDate, lines: receiptLines });
    return sequelize.transaction(async (transaction) => {
      const order = await PurchaseOrder.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw fail("Pedido não encontrado", 404);
      const prior = await PurchaseReceipt.findOne({
        where: { requestKey },
        transaction,
      });
      if (prior) {
        if (prior.requestHash !== requestHash)
          throw fail("Identificador já usado em outro recebimento", 409);
        return { order, receipt: prior, replayed: true };
      }
      if (!["ordered", "partial"].includes(order.status))
        throw fail("Pedido não está disponível para recebimento", 409);
      const lines = structuredClone(order.lines),
        received = [];
      let total = 0;
      for (const r of receiptLines) {
        const line = lines.find((l) => l.lineId === r.lineId);
        if (
          !line ||
          Math.round(r.quantity * 1000) >
            Math.round((line.quantity - line.receivedQuantity) * 1000)
        )
          throw fail("Recebimento excede a quantidade pendente");
        const previousQuantity = line.receivedQuantity;
        line.receivedQuantity =
          (Math.round(line.receivedQuantity * 1000) +
            Math.round(r.quantity * 1000)) /
          1000;
        const unit = cents(line.unitCost, "Custo", true);
        // Allocate rounding cumulatively so partial receipts sum to the order.
        const receivedCents =
          lineCents(line.receivedQuantity, unit) -
          (previousQuantity ? lineCents(previousQuantity, unit) : 0);
        total += receivedCents;
        received.push({
          ...r,
          productId: line.productId,
          name: line.name,
          unitCost: line.unitCost,
          total: receivedCents / 100,
        });
      }
      if (total <= 0 || total > 9999999999)
        throw fail("O recebimento precisa ter valor total positivo");
      for (const r of [...received].sort((a, b) =>
        a.productId.localeCompare(b.productId),
      )) {
        const p = await Product.findByPk(r.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p || p.itemType === "service")
          throw fail("Produto indisponível para recebimento");
        await p.update(
          {
            currentStock: quantity(
              (Math.round(Number(p.currentStock) * 1000) +
                Math.round(r.quantity * 1000)) /
                1000,
            ),
          },
          { transaction },
        );
        await StockMovement.create(
          {
            productId: p.id,
            userId: user.id,
            type: "entrada",
            quantity: r.quantity,
            unitCost: r.unitCost,
            totalCost: r.total,
            reason: "purchase",
            notes: `Recebimento do pedido #${order.number}`,
          },
          { transaction },
        );
      }
      const receipt = await PurchaseReceipt.create(
        {
          purchaseOrderId: id,
          requestKey,
          requestHash,
          lines: received,
          total: total / 100,
          createdBy: user.id,
        },
        { transaction },
      );
      await FinancialEntry.create(
        {
          direction: "payable",
          description: `Compra #${order.number} — recebimento`,
          partyName: order.supplierName,
          supplierId: order.supplierId,
          amount: total / 100,
          dueDate,
          sourceKey: "purchase:" + receipt.id,
          createdBy: user.id,
        },
        { transaction },
      );
      await order.update(
        {
          lines,
          status: lines.every(
            (l) =>
              Math.round(l.quantity * 1000) ===
              Math.round(l.receivedQuantity * 1000),
          )
            ? "received"
            : "partial",
        },
        { transaction },
      );
      await audit(
        user,
        "purchase_received",
        { orderId: id, receiptId: receipt.id, total: receipt.total },
        transaction,
      );
      return { order, receipt };
    });
  }
  async function cashTotals(cashRegisterId, transaction) {
    const rows = await CashMovement.findAll({
      where: { cashRegisterId },
      transaction,
    });
    const incoming = rows
        .filter((r) => r.direction === "in")
        .reduce((n, r) => n + cents(r.amount), 0),
      outgoing = rows
        .filter((r) => r.direction === "out")
        .reduce((n, r) => n + cents(r.amount), 0);
    return {
      financialCashIn: incoming / 100,
      financialCashOut: outgoing / 100,
    };
  }
  async function entryView(entry, transaction) {
    const payments =
      entry.payments ||
      (await FinancialPayment.findAll({
        where: { entryId: entry.id },
        order: [["createdAt", "ASC"]],
        transaction,
      }));
    const amount = cents(entry.amount),
      paid = payments.reduce((n, p) => n + cents(p.amount), 0);
    return {
      ...entry.toJSON(),
      payments,
      paid: paid / 100,
      balance: entry.cancelled ? 0 : (amount - paid) / 100,
      status: entry.cancelled
        ? "cancelled"
        : paid === amount
          ? "paid"
          : paid
            ? "partial"
            : "open",
      overdue: !entry.cancelled && paid < amount && entry.dueDate < today(),
    };
  }
  async function createEntry({ body, user }) {
    return sequelize.transaction(async (transaction) => {
      if (!["payable", "receivable"].includes(body.direction))
        throw fail("Tipo de conta inválido");
      const direction = body.direction;
      let partyName = text(
          body.partyName ?? "",
          "Cliente / fornecedor",
          150,
          false,
        ),
        customerId = null,
        supplierId = null;
      if (direction === "receivable" && body.customerId) {
        const p = await Customer.findByPk(uuid(body.customerId), {
          transaction,
        });
        if (!p?.active) throw fail("Cliente não encontrado ou inativo");
        customerId = p.id;
        partyName = p.name;
      }
      if (direction === "payable" && body.supplierId) {
        const p = await Supplier.findByPk(uuid(body.supplierId), {
          transaction,
        });
        if (!p?.active) throw fail("Fornecedor não encontrado ou inativo");
        supplierId = p.id;
        partyName = p.name;
      }
      if (!partyName) throw fail("Informe o cliente ou fornecedor");
      const entry = await FinancialEntry.create(
        {
          direction,
          partyName,
          customerId,
          supplierId,
          description: text(body.description, "Descrição", 200),
          amount: cents(body.amount) / 100,
          dueDate: date(body.dueDate, "Vencimento"),
          createdBy: user.id,
        },
        { transaction },
      );
      await audit(
        user,
        "financial_entry_created",
        { id: entry.id },
        transaction,
      );
      return entryView(entry, transaction);
    });
  }
  async function settleEntry({ id, body, user }) {
    id = uuid(id);
    const amount = cents(body.amount),
      paidOn = date(body.paidOn, "Data do pagamento"),
      requestKey = uuid(body.requestKey),
      method = body.method;
    if (paidOn > today()) throw fail("A data de pagamento não pode ser futura");
    if (
      ![
        "dinheiro",
        "pix",
        "cartao_credito",
        "cartao_debito",
        "transferencia",
        "boleto",
      ].includes(method)
    )
      throw fail("Forma de pagamento inválida");
    const requestHash = digest({ id, amount, paidOn, method });
    const replay = async (prior, transaction) => {
      if (prior.requestHash !== requestHash)
        throw fail("Identificador já usado em outro pagamento", 409);
      return {
        ...(await entryView(
          await FinancialEntry.findByPk(id, { transaction }),
          transaction,
        )),
        replayed: true,
      };
    };
    const prior = await FinancialPayment.findOne({ where: { requestKey } });
    if (prior) return replay(prior);
    return sequelize.transaction(async (transaction) => {
      // Same lock order as POS and cash closing: cash before the financial entry.
      const cash =
        method === "dinheiro"
          ? await CashRegister.findOne({
              where: { is_open: true },
              transaction,
              lock: transaction.LOCK.UPDATE,
            })
          : null;
      const entry = await FinancialEntry.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!entry) throw fail("Conta não encontrada", 404);
      const previous = await FinancialPayment.findOne({
        where: { requestKey },
        transaction,
      });
      if (previous) return replay(previous, transaction);
      if (method === "dinheiro" && !cash)
        throw fail("Abra o caixa para registrar um pagamento em dinheiro");
      const current = await entryView(entry, transaction);
      if (current.cancelled || amount > cents(current.balance, "Saldo", true))
        throw fail("Pagamento excede o saldo ou conta está cancelada", 409);
      if (cash && entry.direction === "payable") {
        const moves = await cashTotals(cash.id, transaction),
          rev = require("./revenueService");
        const available =
          Number(cash.opening_amount) +
          rev.summary(
            await rev.revenue({ cashRegisterId: cash.id, transaction }),
          ).cashRevenue +
          moves.financialCashIn -
          moves.financialCashOut;
        if (amount > Math.round(available * 100))
          throw fail("Saldo insuficiente no caixa para esta saída em dinheiro");
      }
      const payment = await FinancialPayment.create(
        {
          entryId: id,
          requestKey,
          requestHash,
          amount: amount / 100,
          paidOn,
          method,
          createdBy: user.id,
        },
        { transaction },
      );
      if (cash)
        await CashMovement.create(
          {
            cashRegisterId: cash.id,
            paymentId: payment.id,
            direction: entry.direction === "receivable" ? "in" : "out",
            amount: amount / 100,
            description: entry.description,
            userId: user.id,
          },
          { transaction },
        );
      await audit(
        user,
        "financial_payment_registered",
        { entryId: id, paymentId: payment.id, amount: amount / 100, method },
        transaction,
      );
      return entryView(entry, transaction);
    });
  }
  return {
    saveQuote,
    quoteStatus,
    createPurchase,
    receivePurchase,
    createEntry,
    settleEntry,
    entryView,
    cashTotals,
  };
}
module.exports = require("../tenancy/scopedModule")(factory, [
  "saveQuote",
  "quoteStatus",
  "createPurchase",
  "receivePurchase",
  "createEntry",
  "settleEntry",
  "entryView",
  "cashTotals",
]);
