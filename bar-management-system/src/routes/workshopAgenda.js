function factory() {
  const router = require("express").Router(),
    { Op } = require("sequelize");
  const {
    sequelize,
    WorkshopAppointment: A,
    Vehicle,
    Customer,
    User,
    WorkOrder,
    AuditLog,
  } = require("../models");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    { handler, fail, uuid, text } = require("../services/commercialValidation"),
    ops = require("../services/workshopOperations");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("workshop"),
  );
  const manager = authorizeRoles("admin", "gerente");
  const events = (a, u, action, note) => [
    ...(a?.events || []),
    {
      at: new Date().toISOString(),
      userId: u.id,
      username: u.platformUserId ? "Master/Admin" : u.username,
      action,
      note,
    },
  ];
  async function audit(u, a, t) {
    await AuditLog.create(
      {
        userId: u.id,
        action: "workshop_appointment",
        details: JSON.stringify(a),
      },
      { transaction: t },
    );
  }
  router.get(
    "/",
    handler(async (req, res) => {
      const where = {};
      if (req.query.from || req.query.to) {
        const from = new Date(req.query.from),
          to = new Date(req.query.to);
        if (
          !Number.isFinite(+from) ||
          !Number.isFinite(+to) ||
          to <= from ||
          to - from > 93 * 86400000
        )
          throw fail("Selecione um período de até 93 dias");
        where.startsAt = { [Op.lt]: to };
        where.endsAt = { [Op.gt]: from };
      }
      res.json(
        await A.findAll({ where, order: [["startsAt", "ASC"]], limit: 1000 }),
      );
    }),
  );
  async function save(req, res) {
    const b = req.body || {},
      reason = text(b.reason, "Motivo", 1000),
      start = new Date(b.startsAt),
      end = new Date(b.endsAt);
    if (
      typeof b.startsAt !== "string" ||
      typeof b.endsAt !== "string" ||
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      end - start < 15 * 60000 ||
      end - start > 8 * 3600000
    )
      throw fail("Agende entre 15 minutos e 8 horas, com datas válidas");
    const result = await sequelize.transaction(async (t) => {
      await ops.enabled(t);
      const a = req.params.id
        ? await A.findByPk(uuid(req.params.id), {
            transaction: t,
            lock: t.LOCK.UPDATE,
          })
        : null;
      if (req.params.id && !a) throw fail("Agendamento não encontrado", 404);
      if (a && (a.revision !== b.revision || a.status !== "scheduled"))
        throw fail(
          "Recarregue um agendamento ainda marcado antes de editar",
          409,
        );
      const v = await Vehicle.findByPk(uuid(b.vehicleId), { transaction: t }),
        u = await User.findByPk(uuid(b.assignedUserId), { transaction: t });
      const c = v
        ? await Customer.findByPk(v.customerId, { transaction: t })
        : null;
      if (!v?.active || !c?.active || !u?.active || u.platformUserId)
        throw fail("Selecione veículo, cliente e responsável ativos");
      const conflicts = await A.findAll({
        where: {
          status: ["scheduled", "arrived"],
          startsAt: { [Op.lt]: end },
          endsAt: { [Op.gt]: start },
          [Op.or]: [{ assignedUserId: u.id }, { vehicleId: v.id }],
        },
        transaction: t,
      });
      if (conflicts.some((x) => x.id !== a?.id))
        throw fail("Há conflito de horário para o veículo ou responsável", 409);
      const data = {
        vehicleId: v.id,
        customerId: c.id,
        assignedUserId: u.id,
        snapshot: {
          customer: c.name,
          phone: c.phone,
          plate: v.plate,
          vehicle: v.brand + " " + v.model,
          assigned: u.username,
        },
        startsAt: start,
        endsAt: end,
        reason,
        events: events(a, req.user, a ? "rescheduled" : "scheduled", reason),
        revision: (a?.revision || 0) + 1,
      };
      const out = a
        ? await a.update(data, { transaction: t })
        : await A.create(
            { ...data, createdBy: req.user.id },
            { transaction: t },
          );
      await audit(
        req.user,
        { id: out.id, action: a ? "rescheduled" : "scheduled" },
        t,
      );
      return out;
    });
    res.status(req.params.id ? 200 : 201).json(result);
  }
  router.post("/", manager, handler(save));
  router.put("/:id", manager, handler(save));
  router.post(
    "/:id/status",
    manager,
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          await ops.enabled(t);
          const a = await A.findByPk(uuid(req.params.id), {
              transaction: t,
              lock: t.LOCK.UPDATE,
            }),
            b = req.body || {};
          if (!a) throw fail("Agendamento não encontrado", 404);
          if (a.revision !== b.revision)
            throw fail("Agendamento alterado. Recarregue.", 409);
          const allowed = {
            scheduled: ["arrived", "cancelled", "no_show"],
            arrived: ["completed", "cancelled"],
          };
          if (!allowed[a.status]?.includes(b.status))
            throw fail("Mudança de situação inválida");
          const note = text(b.note, "Observação", 1000);
          await a.update(
            {
              status: b.status,
              revision: a.revision + 1,
              events: events(a, req.user, b.status, note),
            },
            { transaction: t },
          );
          await audit(req.user, { id: a.id, status: b.status, note }, t);
          return a;
        }),
      ),
    ),
  );
  router.post(
    "/:id/order",
    manager,
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          await ops.enabled(t);
          const a = await A.findByPk(uuid(req.params.id), {
              transaction: t,
              lock: t.LOCK.UPDATE,
            }),
            b = req.body || {};
          if (!a) throw fail("Agendamento não encontrado", 404);
          if (
            a.revision !== b.revision ||
            a.orderId ||
            !["scheduled", "arrived"].includes(a.status)
          )
            throw fail("Recarregue um agendamento ativo sem OS vinculada", 409);
          const o = await WorkOrder.findByPk(uuid(b.orderId), {
            transaction: t,
          });
          if (
            !o ||
            o.vehicleId !== a.vehicleId ||
            o.customerId !== a.customerId ||
            ["cancelled", "delivered"].includes(o.status)
          )
            throw fail(
              "A OS deve estar ativa e pertencer ao mesmo cliente e veículo",
            );
          await a.update(
            {
              orderId: o.id,
              revision: a.revision + 1,
              events: events(a, req.user, "order_linked", "OS #" + o.number),
            },
            { transaction: t },
          );
          await audit(req.user, { id: a.id, orderId: o.id }, t);
          return a;
        }),
      ),
    ),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
