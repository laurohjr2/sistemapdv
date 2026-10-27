const {
  fail,
  uuid,
  text,
  cents,
  quantity,
  lineCents,
} = require("./commercialValidation");
const checkFields = ["body", "tires", "lights", "accessories"];
const states = {
  draft: "Rascunho",
  waiting: "Aguardando aprovação",
  approved: "Aprovada",
  in_progress: "Em execução",
  ready: "Pronta",
  delivered: "Entregue",
  rejected: "Recusada",
  cancelled: "Cancelada",
};
const checkLabels = {
  body: "Carroceria",
  tires: "Pneus",
  lights: "Luzes",
  accessories: "Acessórios e ferramentas",
};
function integer(value, label, min = 0, max = 9999999) {
  if (
    !["string", "number"].includes(typeof value) ||
    value === "" ||
    !Number.isInteger(Number(value)) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw fail(`${label} inválido`);
  return Number(value);
}
const revision = (record, value) => {
  if (value !== record.revision)
    throw fail(
      "Este registro foi alterado em outro terminal. Recarregue antes de continuar.",
      409,
    );
};
function checklist(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw fail("Checklist inválido");
  const result = {};
  for (const key of checkFields) {
    result[key] = value[key] ?? "not_checked";
    if (!["ok", "attention", "not_checked"].includes(result[key]))
      throw fail("Item do checklist inválido");
  }
  result.fuelLevel = value.fuelLevel ?? "not_checked";
  if (
    ![
      "empty",
      "quarter",
      "half",
      "three_quarters",
      "full",
      "not_checked",
    ].includes(result.fuelLevel)
  )
    throw fail("Nível de combustível inválido");
  result.notes = text(value.notes ?? "", "Observações de entrada", 2000, false);
  return result;
}
function factory() {
  const {
    sequelize,
    Vehicle,
    WorkOrder,
    Product,
    Customer,
    User,
    AuditLog,
    Sale,
  } = require("../models");
  async function enabled(transaction) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("./businessSettingsService").getSettings(transaction),
      ).workshop
    )
      throw fail("Módulo Oficina desativado", 403);
  }
  const audit = (user, action, details, transaction) =>
    AuditLog.create(
      { userId: user.id, action, details: JSON.stringify(details) },
      { transaction },
    );
  const event = (record, user, action, note = "") => [
    ...record.events,
    {
      at: new Date().toISOString(),
      userId: user.id,
      username: user.platformUserId ? "Master/Admin" : user.username,
      action,
      note,
      ...(action === "approved"
        ? {
            budget: {
              lines: record.lines,
              discount: record.discount,
              total: record.total,
            },
          }
        : {}),
    },
  ];
  async function saveVehicle({ id, body, user }) {
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw fail("Cadastro de veículo inválido");
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const record = id
        ? await Vehicle.findByPk(uuid(id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (id && !record) throw fail("Veículo não encontrado", 404);
      if (record) revision(record, body.revision);
      const customer = await Customer.findByPk(uuid(body.customerId), {
        transaction,
      });
      if (!customer?.active) throw fail("Cliente não encontrado ou inativo");
      const plate = text(body.plate, "Placa", 10)
        .toUpperCase()
        .replace(/[-\s]/g, "");
      if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))
        throw fail("Informe uma placa brasileira válida (ABC1234 ou ABC1D23)");
      const mileage = integer(body.mileage, "Quilometragem");
      if (record && mileage < record.mileage)
        throw fail("A quilometragem não pode retroceder");
      if (body.active !== undefined && typeof body.active !== "boolean")
        throw fail("Situação do veículo inválida");
      if (
        record &&
        (customer.id !== record.customerId || body.active === false) &&
        (await WorkOrder.count({
          where: {
            vehicleId: record.id,
            status: ["draft", "waiting", "approved", "in_progress", "ready"],
          },
          transaction,
        }))
      )
        throw fail(
          "Finalize as ordens abertas antes de transferir ou inativar este veículo",
        );
      const data = {
        customerId: customer.id,
        plate,
        brand: text(body.brand, "Marca", 60),
        model: text(body.model, "Modelo", 100),
        year:
          body.year === "" || body.year == null
            ? null
            : integer(body.year, "Ano", 1900, new Date().getFullYear() + 1),
        mileage,
        color: text(body.color ?? "", "Cor", 50, false),
        notes: text(body.notes ?? "", "Observações", 2000, false),
        active: body.active !== false,
        revision: (record?.revision || 0) + 1,
      };
      const saved = record
        ? await record.update(data, { transaction })
        : await Vehicle.create(data, { transaction });
      await audit(
        user,
        record ? "vehicle_updated" : "vehicle_created",
        { vehicleId: saved.id },
        transaction,
      );
      return saved;
    });
  }
  async function saveOrder({ id, body, user }) {
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw fail("Ordem de serviço inválida");
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const record = id
        ? await WorkOrder.findByPk(uuid(id), {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      if (id && !record) throw fail("Ordem de serviço não encontrada", 404);
      if (record) {
        revision(record, body.revision);
        if (!["draft", "rejected"].includes(record.status) || record.saleId)
          throw fail(
            "Somente rascunhos ou ordens recusadas sem venda podem ser editados",
          );
      }
      const vehicle = await Vehicle.findByPk(uuid(body.vehicleId), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!vehicle?.active) throw fail("Veículo não encontrado ou inativo");
      const customer = await Customer.findByPk(vehicle.customerId, {
        transaction,
      });
      if (!customer?.active)
        throw fail("Cliente do veículo não encontrado ou inativo");
      const mileage = integer(body.mileage, "Quilometragem");
      if (mileage < vehicle.mileage)
        throw fail(
          "A quilometragem não pode ser inferior ao cadastro do veículo",
        );
      const assigned = body.assignedUserId
        ? await User.findByPk(uuid(body.assignedUserId), { transaction })
        : null;
      if (body.assignedUserId && (!assigned?.active || assigned.platformUserId))
        throw fail("Responsável não encontrado ou inativo");
      if (!Array.isArray(body.lines) || body.lines.length > 100)
        throw fail("Informe até 100 peças ou serviços");
      const lines = [],
        ids = new Set();
      let total = 0;
      for (const row of body.lines) {
        if (!row || typeof row !== "object" || Array.isArray(row))
          throw fail("Item da OS inválido");
        const productId = uuid(row.productId);
        if (ids.has(productId))
          throw fail("Agrupe a quantidade dos itens repetidos");
        ids.add(productId);
        const product = await Product.findByPk(productId, { transaction });
        if (!product?.active)
          throw fail("Produto ou serviço não encontrado ou inativo");
        const q = quantity(row.quantity),
          price = cents(row.unitPrice, "Preço", true),
          amount = lineCents(q, price);
        total += amount;
        lines.push({
          productId,
          name: product.name,
          itemType: product.itemType,
          unit: product.unitOfMeasure,
          quantity: q,
          unitPrice: price / 100,
          total: amount / 100,
        });
      }
      const discount = cents(body.discount ?? 0, "Desconto", true);
      if (total > 9999999999 || discount > total)
        throw fail("Total ou desconto inválido");
      const data = {
        vehicleId: vehicle.id,
        customerId: customer.id,
        customerSnapshot: { name: customer.name, phone: customer.phone },
        vehicleSnapshot: {
          plate: vehicle.plate,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          color: vehicle.color,
        },
        assignedUserId: assigned?.id || null,
        assignedName: assigned?.username || "",
        complaint: text(body.complaint, "Problema relatado", 4000),
        diagnosis: text(body.diagnosis ?? "", "Diagnóstico", 4000, false),
        notes: text(body.notes ?? "", "Observações", 4000, false),
        mileage,
        checklist: checklist(body.checklist),
        lines,
        subtotal: total / 100,
        discount: discount / 100,
        total: (total - discount) / 100,
        status: "draft",
        approvalNote: null,
        approvedAt: null,
        revision: (record?.revision || 0) + 1,
        events: record
          ? event(record, user, "revised")
          : [
              {
                at: new Date().toISOString(),
                userId: user.id,
                username: user.platformUserId ? "Master/Admin" : user.username,
                action: "created",
              },
            ],
      };
      const saved = record
        ? await record.update(data, { transaction })
        : await WorkOrder.create(
            { ...data, createdBy: user.id },
            { transaction },
          );
      if (mileage > vehicle.mileage)
        await vehicle.update(
          { mileage, revision: vehicle.revision + 1 },
          { transaction },
        );
      await audit(
        user,
        record ? "work_order_updated" : "work_order_created",
        { orderId: saved.id, number: saved.number },
        transaction,
      );
      return saved;
    });
  }
  async function transition({ id, body, user }) {
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw fail("Ação inválida");
    return sequelize.transaction(async (transaction) => {
      await enabled(transaction);
      const record = await WorkOrder.findByPk(uuid(id), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw fail("Ordem de serviço não encontrada", 404);
      revision(record, body.revision);
      const manager = ["admin", "gerente"].includes(user.role),
        target = body.status;
      if (
        !manager &&
        (!["in_progress", "ready"].includes(target) ||
          record.assignedUserId !== user.id)
      )
        throw fail(
          "Somente o responsável pode atualizar a execução; demais ações exigem gerente ou administrador",
          403,
        );
      const allowed = {
        draft: ["waiting", "cancelled"],
        waiting: ["approved", "rejected", "draft", "cancelled"],
        approved: ["in_progress", "draft", "cancelled"],
        in_progress: ["ready", "draft", "cancelled"],
        ready: ["delivered", "draft", "cancelled"],
        rejected: ["draft", "cancelled"],
      };
      if (!allowed[record.status]?.includes(target))
        throw fail("Mudança de situação inválida");
      const sale = record.saleId
        ? await Sale.findByPk(record.saleId, { transaction })
        : null;
      if (
        ["draft", "cancelled"].includes(target) &&
        sale?.status === "completed"
      )
        throw fail(
          "Cancele o recebimento em Vendas antes de revisar ou cancelar a OS",
        );
      if (target === "draft" && record.saleId)
        throw fail(
          "Uma OS com recebimento registrado não pode ser reescrita. Cancele e abra uma nova para preservar o histórico.",
        );
      if (target === "waiting" && (!record.lines.length || !record.diagnosis))
        throw fail(
          "Informe o diagnóstico e os itens antes de enviar para aprovação",
        );
      if (
        target === "in_progress" &&
        (!record.assignedUserId ||
          !(await User.findByPk(record.assignedUserId, { transaction }))
            ?.active)
      )
        throw fail("Defina um responsável na revisão da OS antes de iniciar");
      const note = text(
        body.note ?? "",
        "Registro da ação",
        2000,
        ["approved", "rejected", "cancelled", "draft"].includes(target),
      );
      if (target === "delivered" && sale?.status !== "completed")
        throw fail("Receba a ordem de serviço antes de registrar a entrega");
      const values = {
        status: target,
        revision: record.revision + 1,
        events: event(record, user, target, note),
      };
      if (target === "approved") {
        values.approvedAt = new Date();
        values.approvalNote = note;
      }
      if (target === "draft") {
        values.approvedAt = null;
        values.approvalNote = null;
      }
      await record.update(values, { transaction });
      await audit(
        user,
        "work_order_status",
        { orderId: record.id, status: target, note },
        transaction,
      );
      return record;
    });
  }
  return { enabled, saveVehicle, saveOrder, transition, event };
}
module.exports = {
  ...require("../tenancy/scopedModule")(factory, [
    "enabled",
    "saveVehicle",
    "saveOrder",
    "transition",
    "event",
  ]),
  states,
  checkLabels,
};
