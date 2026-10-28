const { fail, text } = require("./commercialValidation");
const active = ["received", "preparing", "ready", "dispatched"];
function contact(b) {
  if (
    !b ||
    typeof b !== "object" ||
    Array.isArray(b) ||
    !b.address ||
    typeof b.address !== "object" ||
    Array.isArray(b.address)
  )
    throw fail("Informe contato e endereço de entrega");
  const a = b.address,
    phone = text(b.phone, "Telefone", 30);
  if (!/^[+()\d\s.-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8)
    throw fail("Telefone de contato inválido");
  const state = text(a.state, "UF", 2).toUpperCase();
  if (
    !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
      state,
    )
  )
    throw fail("UF inválida");
  const postalCode = text(a.postalCode ?? "", "CEP", 9, false);
  if (postalCode && !/^\d{5}-?\d{3}$/.test(postalCode))
    throw fail("CEP inválido");
  return {
    customerName: text(b.customerName, "Cliente", 150),
    phone,
    address: {
      street: text(a.street, "Logradouro", 200),
      number: text(a.number, "Número ou s/n", 30),
      district: text(a.district, "Bairro", 100),
      city: text(a.city, "Cidade", 100),
      state,
      postalCode,
      complement: text(a.complement ?? "", "Complemento", 150, false),
      reference: text(a.reference ?? "", "Referência", 200, false),
    },
    notes: text(b.notes ?? "", "Observações", 2000, false),
  };
}
const event = (order, user, action, note, extra = {}) => [
  ...(order.history || []),
  {
    at: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    action,
    note,
    ...extra,
  },
];
function factory() {
  const {
    sequelize,
    DeliveryOrder,
    Sale,
    SaleItem,
    Product,
    Ticket,
    AuditLog,
  } = require("../models");
  const enabled = async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("./businessSettingsService").getSettings(transaction),
      ).delivery
    )
      throw fail("Ative o módulo de entregas nas configurações", 403);
  };
  const audit = (order, user, action, transaction) =>
    AuditLog.create(
      {
        userId: user.id,
        action: "delivery_" + action,
        details: JSON.stringify({
          id: order.id,
          saleId: order.saleId,
          revision: order.revision,
          status: order.status,
        }),
      },
      { transaction },
    );
  const saleId = (id) => {
    const n = Number(id);
    if (
      !["string", "number"].includes(typeof id) ||
      !Number.isSafeInteger(n) ||
      n < 1
    )
      throw fail("Venda inválida");
    return n;
  };
  async function create(body, user) {
    const values = contact(body),
      id = saleId(body.saleId);
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const sale = await Sale.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!sale || sale.status !== "completed")
        throw fail("Escolha uma venda concluída da empresa");
      if (await Ticket.count({ where: { sale_id: sale.id }, transaction }))
        throw fail("Tickets de retirada não podem virar pedidos de entrega");
      if (await DeliveryOrder.findOne({ where: { saleId: id }, transaction }))
        throw fail(
          "Esta venda já tem um pedido de entrega. Atualize a lista.",
          409,
        );
      const lines = await SaleItem.findAll({
        where: { sale_id: id },
        include: [
          {
            model: Product,
            as: "product",
            attributes: ["name", "unitOfMeasure"],
          },
        ],
        order: [["id", "ASC"]],
        transaction,
      });
      if (!lines.length) throw fail("Venda sem itens");
      const order = await DeliveryOrder.create(
        {
          ...values,
          saleId: id,
          customerId: sale.customerId,
          paidTotal: sale.total_amount,
          items: lines.map((i) => ({
            productId: i.product_id,
            name: i.pizza?.description || i.product.name,
            unit: i.product.unitOfMeasure,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unit_price),
            total: Number(i.total_price),
            notes: i.notes,
          })),
          history: event({}, user, "received", "Pedido vinculado à venda paga"),
        },
        { transaction },
      );
      await audit(order, user, "created", transaction);
      return order;
    });
  }
  async function locked(id, transaction) {
    const snapshot = await DeliveryOrder.findByPk(id, { transaction });
    if (!snapshot) throw fail("Entrega não encontrada", 404);
    const sale = await Sale.findByPk(snapshot.saleId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const order = await DeliveryOrder.findByPk(snapshot.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    return { sale, order };
  }
  const revision = (order, b) => {
    if (b.revision !== order.revision)
      throw fail("Pedido alterado em outro terminal. Recarregue.", 409);
    if (order.history.length >= 200)
      throw fail(
        "Limite de alterações atingido. Contate a administração.",
        409,
      );
  };
  async function edit(id, body, user) {
    const values = contact(body);
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const { sale, order } = await locked(id, transaction);
      revision(order, body);
      if (
        sale.status !== "completed" ||
        !["received", "preparing", "ready"].includes(order.status)
      )
        throw fail(
          "Contato só pode ser alterado antes da saída para entrega",
          409,
        );
      await order.update(
        {
          ...values,
          revision: order.revision + 1,
          history: event(
            order,
            user,
            "contact_updated",
            "Contato/endereço atualizado",
            {
              before: {
                customerName: order.customerName,
                phone: order.phone,
                address: order.address,
                notes: order.notes,
              },
              after: values,
            },
          ),
        },
        { transaction },
      );
      await audit(order, user, "edited", transaction);
      return order;
    });
  }
  async function transition(id, body, user) {
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw fail("Etapa inválida");
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const { sale, order } = await locked(id, transaction);
      revision(order, body);
      if (sale.status !== "completed") throw fail("Venda cancelada", 409);
      const target = body.status,
        allowed = {
          received: ["preparing", "cancelled"],
          preparing: ["ready", "cancelled"],
          ready: ["dispatched", "cancelled"],
          dispatched: ["delivered"],
        };
      if (!allowed[order.status]?.includes(target))
        throw fail("Siga a sequência do atendimento", 409);
      if (target === "cancelled" && !["admin", "gerente"].includes(user.role))
        throw fail("Cancelamento exige gerente ou administrador", 403);
      const reason =
        target === "cancelled"
          ? text(body.reason, "Motivo do cancelamento da entrega", 1000)
          : text(body.reason ?? "", "Observação da etapa", 1000, false);
      const courierName =
        target === "dispatched"
          ? text(body.courierName, "Entregador/transportador responsável", 120)
          : order.courierName;
      if (["ready", "dispatched"].includes(target)) {
        const items = await SaleItem.findAll({
          where: { sale_id: sale.id },
          order: [["id", "ASC"]],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        const kitchenEnabled =
          require("../config/businessProfiles").effectiveModules(
            await require("./businessSettingsService").getSettings(transaction),
          ).kitchen;
        const pending = items.filter((i) =>
          ["pendente", "preparando"].includes(i.preparationStatus),
        );
        if (kitchenEnabled && pending.length)
          throw fail(
            "A cozinha ainda tem itens em preparo para esta venda",
            409,
          );
        if (!kitchenEnabled && target === "ready")
          for (const i of pending)
            await i.update(
              {
                preparationStatus: "pronto",
                preparationCompletedAt: new Date(),
              },
              { transaction },
            );
        if (target === "dispatched")
          for (const i of items)
            if (i.preparationStatus === "pronto")
              await i.update(
                { preparationStatus: "entregue", deliveredAt: new Date() },
                { transaction },
              );
      }
      await order.update(
        {
          status: target,
          courierName,
          revision: order.revision + 1,
          history: event(order, user, target, reason || "Etapa atualizada", {
            courierName: target === "dispatched" ? courierName : undefined,
          }),
        },
        { transaction },
      );
      await audit(order, user, target, transaction);
      return order;
    });
  }
  return { create, edit, transition };
}
module.exports = {
  active,
  event,
  ...require("../tenancy/scopedModule")(factory, [
    "create",
    "edit",
    "transition",
  ]),
};
