function createRouter() {
  const router = require("express").Router(),
    { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    guard = require("../middleware/businessModule");
  const {
      handler,
      fail,
      uuid,
      text,
      date,
      cents,
      today,
    } = require("../services/commercialValidation"),
    ops = require("../services/commercialOperations");
  const {
    sequelize,
    Supplier,
    Quote,
    PurchaseOrder,
    PurchaseReceipt,
    FinancialEntry,
    FinancialPayment,
    AuditLog,
  } = require("../models");
  const manager = authorizeRoles("admin", "gerente");
  router.use(authenticateToken);
  router.use("/quotes", guard("quotes"));
  router.use("/suppliers", manager, guard("purchasing"));
  router.use("/purchases", manager, guard("purchasing"));
  router.use("/finance", manager, guard("finance"));
  async function pdf(res, title, lines) {
    const doc = new (require("pdfkit"))({ margin: 40 });
    res.type("application/pdf").attachment("documento.pdf");
    doc.pipe(res);
    await require("../services/businessSettingsService").printHeader(doc);
    doc.fontSize(16).text(title);
    doc.moveDown();
    for (const line of lines) doc.fontSize(10).text(String(line));
    doc.end();
  }
  const money = (n) =>
    Number(n || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  router.get(
    "/quotes",
    handler(async (req, res) =>
      res.json(await Quote.findAll({ order: [["createdAt", "DESC"]] })),
    ),
  );
  router.post(
    "/quotes",
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.saveQuote({ body: req.body, user: req.user })),
    ),
  );
  router.get(
    "/quotes/:id/pdf",
    handler(async (req, res) => {
      const q = await Quote.findByPk(uuid(req.params.id));
      if (!q) throw fail("Orçamento não encontrado", 404);
      await pdf(res, `Orçamento #${q.number}`, [
        `Cliente: ${q.customerName}`,
        `Validade: ${q.validUntil}`,
        `Situação: ${q.status}`,
        "Proposta comercial — não comprova pagamento.",
        ...q.lines.map(
          (l) =>
            `${l.name} | ${l.quantity} ${l.unit || ""} × ${money(l.unitPrice)} = ${money(l.total)}`,
        ),
        `Subtotal: ${money(q.subtotal)}`,
        `Desconto: ${money(q.discount)}`,
        `Total: ${money(q.total)}`,
        q.notes,
        q.approvalNote ? `Aceite registrado: ${q.approvalNote}` : "",
      ]);
    }),
  );
  router.get(
    "/quotes/:id",
    handler(async (req, res) => {
      const q = await Quote.findByPk(uuid(req.params.id));
      if (!q) throw fail("Orçamento não encontrado", 404);
      res.json(q);
    }),
  );
  router.put(
    "/quotes/:id",
    handler(async (req, res) =>
      res.json(
        await ops.saveQuote({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.post(
    "/quotes/:id/status",
    handler(async (req, res) =>
      res.json(
        await ops.quoteStatus({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.post(
    "/quotes/:id/convert",
    handler(async (req, res) =>
      res.status(201).json(
        await require("../services/saleOperations").create({
          body: { ...req.body, sourceQuoteId: req.params.id },
          user: req.user,
        }),
      ),
    ),
  );
  router.get(
    "/suppliers",
    handler(async (req, res) =>
      res.json(await Supplier.findAll({ order: [["name", "ASC"]] })),
    ),
  );
  const saveSupplier = handler(async (req, res) => {
    const values = {};
    for (const [key, max] of Object.entries({
      name: 150,
      document: 30,
      phone: 40,
      email: 150,
      contact: 100,
      notes: 2000,
    }))
      values[key] = text(req.body[key] ?? "", key, max, key === "name");
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))
      throw fail("E-mail inválido");
    if (req.body.active !== undefined && typeof req.body.active !== "boolean")
      throw fail("Situação inválida");
    values.active = req.body.active !== false;
    const result = await sequelize.transaction(async (transaction) => {
      const existing = req.params.id
        ? await Supplier.findByPk(uuid(req.params.id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (req.params.id && !existing)
        throw fail("Fornecedor não encontrado", 404);
      const record = existing
        ? await existing.update(values, { transaction })
        : await Supplier.create(values, { transaction });
      await AuditLog.create(
        {
          userId: req.user.id,
          action: existing ? "supplier_updated" : "supplier_created",
          details: JSON.stringify({ id: record.id }),
        },
        { transaction },
      );
      return record;
    });
    res.status(req.params.id ? 200 : 201).json(result);
  });
  router.post("/suppliers", saveSupplier);
  router.put("/suppliers/:id", saveSupplier);
  router.get(
    "/purchases",
    handler(async (req, res) =>
      res.json(
        await PurchaseOrder.findAll({
          order: [["createdAt", "DESC"]],
        }),
      ),
    ),
  );
  router.post(
    "/purchases",
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.createPurchase({ body: req.body, user: req.user })),
    ),
  );
  router.get(
    "/purchases/:id",
    handler(async (req, res) => {
      const order = await PurchaseOrder.findByPk(uuid(req.params.id));
      if (!order) throw fail("Pedido não encontrado", 404);
      res.json({
        ...order.toJSON(),
        receipts: await PurchaseReceipt.findAll({
          where: { purchaseOrderId: order.id },
          order: [["createdAt", "ASC"]],
        }),
      });
    }),
  );
  router.get(
    "/purchases/:id/pdf",
    handler(async (req, res) => {
      const order = await PurchaseOrder.findByPk(uuid(req.params.id));
      if (!order) throw fail("Pedido não encontrado", 404);
      await pdf(res, `Pedido de compra #${order.number}`, [
        `Fornecedor: ${order.supplierName}`,
        `Previsão: ${order.expectedDate || "Não informada"}`,
        ...order.lines.map(
          (l) =>
            `${l.name} | Pedido: ${l.quantity} | Recebido: ${l.receivedQuantity} | Custo unitário: ${money(l.unitCost)}`,
        ),
        `Total pedido: ${money(order.total)}`,
        order.notes,
      ]);
    }),
  );
  router.post(
    "/purchases/:id/receive",
    handler(async (req, res) => {
      const enabled = require("../config/businessProfiles").effectiveModules(
        await require("../services/businessSettingsService").getSettings(),
      );
      if (!enabled.finance)
        throw fail(
          "Ative o financeiro para registrar as contas a pagar do recebimento",
        );
      res.status(201).json(
        await ops.receivePurchase({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      );
    }),
  );
  router.post(
    "/purchases/:id/cancel",
    handler(async (req, res) => {
      res.json(
        await sequelize.transaction(async (transaction) => {
          const order = await PurchaseOrder.findByPk(uuid(req.params.id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!order) throw fail("Pedido não encontrado", 404);
          if (
            order.status !== "ordered" ||
            order.lines.some((l) => l.receivedQuantity > 0)
          )
            throw fail(
              "Somente pedidos sem recebimento podem ser cancelados",
              409,
            );
          await order.update({ status: "cancelled" }, { transaction });
          await AuditLog.create(
            {
              userId: req.user.id,
              action: "purchase_cancelled",
              details: JSON.stringify({ id: order.id }),
            },
            { transaction },
          );
          return order;
        }),
      );
    }),
  );
  async function listEntries(query) {
    const where = {};
    if (query.direction) {
      if (!["payable", "receivable"].includes(query.direction))
        throw fail("Tipo de conta inválido");
      where.direction = query.direction;
    }
    const { Op } = require("sequelize");
    if (query.from || query.to) {
      where.dueDate = {};
      if (query.from) where.dueDate[Op.gte] = date(query.from);
      if (query.to) where.dueDate[Op.lte] = date(query.to);
      if (query.from && query.to && query.from > query.to)
        throw fail("Período inválido");
    }
    const rows = await FinancialEntry.findAll({
      where,
      include: [{ model: FinancialPayment, as: "payments" }],
      order: [
        ["dueDate", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
    const result = await Promise.all(rows.map((e) => ops.entryView(e)));
    if (
      query.status &&
      !["open", "partial", "paid", "cancelled", "overdue"].includes(
        query.status,
      )
    )
      throw fail("Situação inválida");
    return result.filter(
      (e) =>
        !query.status ||
        (query.status === "overdue" ? e.overdue : e.status === query.status),
    );
  }
  router.get(
    "/finance",
    handler(async (req, res) => {
      const entries = await listEntries(req.query);
      const outstanding = entries.filter((e) => !e.cancelled);
      res.json({
        entries,
        today: today(),
        summary: {
          payable:
            outstanding
              .filter((e) => e.direction === "payable")
              .reduce((n, e) => n + Math.round(e.balance * 100), 0) / 100,
          receivable:
            outstanding
              .filter((e) => e.direction === "receivable")
              .reduce((n, e) => n + Math.round(e.balance * 100), 0) / 100,
          overdue: entries.filter((e) => e.overdue).length,
        },
      });
    }),
  );
  router.get(
    "/finance/export.pdf",
    handler(async (req, res) => {
      const entries = await listEntries(req.query);
      await pdf(
        res,
        "Contas a pagar e receber",
        entries.map(
          (e) =>
            `${e.direction === "payable" ? "A pagar" : "A receber"} | ${e.description} | ${e.partyName} | Venc.: ${e.dueDate} | Total: ${money(e.amount)} | Pago: ${money(e.paid)} | Saldo: ${money(e.balance)}${e.overdue ? " | VENCIDA" : ""}${e.cancelled ? " | CANCELADA" : ""}`,
        ),
      );
    }),
  );
  router.post(
    "/finance",
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.createEntry({ body: req.body, user: req.user })),
    ),
  );
  router.get(
    "/finance/:id",
    handler(async (req, res) => {
      const entry = await FinancialEntry.findByPk(uuid(req.params.id));
      if (!entry) throw fail("Conta não encontrada", 404);
      res.json(await ops.entryView(entry));
    }),
  );
  router.post(
    "/finance/:id/payments",
    handler(async (req, res) =>
      res.status(201).json(
        await ops.settleEntry({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.post(
    "/finance/:id/cancel",
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (transaction) => {
          const entry = await FinancialEntry.findByPk(uuid(req.params.id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!entry) throw fail("Conta não encontrada", 404);
          const view = await ops.entryView(entry, transaction);
          if (entry.sourceKey || view.paid || view.cancelled)
            throw fail(
              "Somente contas avulsas sem pagamentos podem ser canceladas",
              409,
            );
          await entry.update({ cancelled: true }, { transaction });
          await AuditLog.create(
            {
              userId: req.user.id,
              action: "financial_entry_cancelled",
              details: JSON.stringify({ id: entry.id }),
            },
            { transaction },
          );
          return ops.entryView(entry, transaction);
        }),
      ),
    ),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(createRouter);
