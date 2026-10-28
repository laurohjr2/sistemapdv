function factory() {
  const router = require("express").Router(),
    {
      sequelize,
      WorkshopWarranty: W,
      WorkshopReturn: R,
      WorkOrder,
      Sale,
      AuditLog,
    } = require("../models");
  const { authenticateToken, authorizeRoles } = require("../middleware/auth"),
    {
      handler,
      fail,
      uuid,
      text,
      date,
      today,
    } = require("../services/commercialValidation"),
    ops = require("../services/workshopOperations");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("workshop"),
  );
  const manager = authorizeRoles("admin", "gerente");
  const ev = (record, user, action, note) => [
    ...(record?.events || []),
    {
      at: new Date().toISOString(),
      username: user.platformUserId ? "Master/Admin" : user.username,
      userId: user.id,
      action,
      note,
    },
  ];
  async function audit(u, details, t) {
    await AuditLog.create(
      {
        userId: u.id,
        action: "workshop_warranty",
        details: JSON.stringify(details),
      },
      { transaction: t },
    );
  }
  async function locked(Model, id, b, t) {
    await ops.enabled(t);
    const a = await Model.findByPk(uuid(id), {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!a) throw fail("Registro não encontrado", 404);
    if (a.revision !== b.revision)
      throw fail("Registro alterado. Recarregue.", 409);
    return a;
  }
  const mileage = (v) => {
    if (
      !["number", "string"].includes(typeof v) ||
      v === "" ||
      !Number.isInteger(Number(v)) ||
      Number(v) < 0 ||
      Number(v) > 9999999
    )
      throw fail("Quilometragem inválida");
    return Number(v);
  };
  router.get(
    "/",
    handler(async (req, res) =>
      res.json({
        warranties: await W.findAll({ order: [["createdAt", "DESC"]] }),
        returns: await R.findAll({ order: [["createdAt", "DESC"]] }),
      }),
    ),
  );
  router.post(
    "/",
    manager,
    handler(async (req, res) => {
      const b = req.body || {},
        terms = text(b.terms, "Condições da garantia", 5000),
        expiresOn = date(b.expiresOn),
        mileageLimit =
          b.mileageLimit == null || b.mileageLimit === ""
            ? null
            : mileage(b.mileageLimit);
      res.status(201).json(
        await sequelize.transaction(async (t) => {
          await ops.enabled(t);
          const o = await WorkOrder.findByPk(uuid(b.orderId), {
            transaction: t,
            lock: t.LOCK.UPDATE,
          });
          if (
            !o ||
            o.status !== "delivered" ||
            !o.saleId ||
            (await Sale.findByPk(o.saleId, { transaction: t }))?.status !==
              "completed"
          )
            throw fail("A garantia precisa de uma OS entregue e recebida");
          if (await W.findOne({ where: { orderId: o.id }, transaction: t }))
            throw fail("Esta OS já possui um registro de garantia", 409);
          const delivered =
              o.events.filter((e) => e.action === "delivered").at(-1)?.at ||
              o.updatedAt,
            startsOn = new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
            }).format(new Date(delivered));
          if (
            expiresOn < startsOn ||
            (mileageLimit !== null && mileageLimit < o.mileage)
          )
            throw fail("Prazo ou limite de km anterior à entrega");
          const w = await W.create(
            {
              orderId: o.id,
              startsOn,
              expiresOn,
              mileageLimit,
              terms,
              snapshot: {
                number: o.number,
                customerId: o.customerId,
                vehicleId: o.vehicleId,
                customer: o.customerSnapshot,
                vehicle: o.vehicleSnapshot,
                mileage: o.mileage,
                lines: o.lines,
                total: o.total,
                saleId: o.saleId,
              },
              createdBy: req.user.id,
              events: ev(null, req.user, "issued", terms),
            },
            { transaction: t },
          );
          await audit(
            req.user,
            { id: w.id, action: "issued", orderId: o.id },
            t,
          );
          return w;
        }),
      );
    }),
  );
  router.post(
    "/:id/void",
    manager,
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          const b = req.body || {},
            w = await locked(W, req.params.id, b, t),
            reason = text(b.reason, "Motivo", 2000);
          if (w.voidedAt) throw fail("Registro já cancelado", 409);
          await w.update(
            {
              voidedAt: new Date(),
              voidReason: reason,
              revision: w.revision + 1,
              events: ev(w, req.user, "voided", reason),
            },
            { transaction: t },
          );
          await audit(req.user, { id: w.id, action: "voided", reason }, t);
          return w;
        }),
      ),
    ),
  );
  router.post(
    "/:id/returns",
    manager,
    handler(async (req, res) =>
      res.status(201).json(
        await sequelize.transaction(async (t) => {
          const b = req.body || {},
            w = await locked(W, req.params.id, b, t),
            reason = text(b.reason, "Relato do retorno", 3000),
            km = mileage(b.mileage),
            receivedOn = today();
          if (w.voidedAt) throw fail("Registro de garantia cancelado");
          if (km < w.snapshot.mileage)
            throw fail("Quilometragem inferior à entrega original");
          if (
            await R.count({
              where: { warrantyId: w.id, status: ["open", "accepted"] },
              transaction: t,
            })
          )
            throw fail("Já existe um retorno em análise ou atendimento", 409);
          const eligibility = {
            withinDate: receivedOn <= w.expiresOn,
            withinMileage: w.mileageLimit === null || km <= w.mileageLimit,
            expiresOn: w.expiresOn,
            mileageLimit: w.mileageLimit,
          };
          const r = await R.create(
            {
              warrantyId: w.id,
              reason,
              mileage: km,
              receivedOn,
              eligibility,
              createdBy: req.user.id,
              events: ev(null, req.user, "open", reason),
            },
            { transaction: t },
          );
          await w.update(
            {
              revision: w.revision + 1,
              events: ev(w, req.user, "return_opened", r.id),
            },
            { transaction: t },
          );
          await audit(
            req.user,
            { id: w.id, returnId: r.id, action: "return_opened" },
            t,
          );
          return r;
        }),
      ),
    ),
  );
  router.post(
    "/returns/:id/status",
    manager,
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          const b = req.body || {},
            r = await locked(R, req.params.id, b, t),
            note = text(b.note, "Parecer", 3000),
            allowed = {
              open: ["accepted", "rejected"],
              accepted: ["completed"],
            };
          if (!allowed[r.status]?.includes(b.status))
            throw fail("Mudança de situação inválida");
          await r.update(
            {
              status: b.status,
              revision: r.revision + 1,
              events: ev(r, req.user, b.status, note),
            },
            { transaction: t },
          );
          await audit(req.user, { returnId: r.id, status: b.status, note }, t);
          return r;
        }),
      ),
    ),
  );
  router.post(
    "/returns/:id/order",
    manager,
    handler(async (req, res) =>
      res.json(
        await sequelize.transaction(async (t) => {
          const b = req.body || {},
            r = await locked(R, req.params.id, b, t),
            w = await W.findByPk(r.warrantyId, { transaction: t }),
            o = await WorkOrder.findByPk(uuid(b.orderId), { transaction: t });
          if (r.orderId || r.status !== "accepted")
            throw fail(
              "Vincule a OS a um retorno aceito sem outro vínculo",
              409,
            );
          if (
            !o ||
            o.id === w.orderId ||
            o.vehicleId !== w.snapshot.vehicleId ||
            o.customerId !== w.snapshot.customerId ||
            ["cancelled", "delivered"].includes(o.status)
          )
            throw fail("Escolha outra OS ativa do mesmo cliente e veículo");
          await r.update(
            {
              orderId: o.id,
              revision: r.revision + 1,
              events: ev(r, req.user, "order_linked", "OS #" + o.number),
            },
            { transaction: t },
          );
          await audit(req.user, { returnId: r.id, orderId: o.id }, t);
          return r;
        }),
      ),
    ),
  );
  router.get(
    "/:id/pdf",
    handler(async (req, res) => {
      const w = await W.findByPk(uuid(req.params.id));
      if (!w) throw fail("Garantia não encontrada", 404);
      const PDF = require("pdfkit"),
        doc = new PDF({ margin: 40 });
      res.type("pdf");
      res.set(
        "Content-Disposition",
        'attachment; filename="garantia-oficina.pdf"',
      );
      doc.pipe(res);
      doc
        .fontSize(18)
        .text("Registro de garantia — OS #" + w.snapshot.number)
        .moveDown();
      doc
        .fontSize(11)
        .text("Cliente: " + w.snapshot.customer.name)
        .text("Veículo: " + w.snapshot.vehicle.plate)
        .text("Entrega: " + w.startsOn + " · Prazo informado: " + w.expiresOn)
        .text("Limite de km: " + (w.mileageLimit ?? "Não informado"))
        .moveDown()
        .text(w.terms)
        .moveDown()
        .text(
          "Condições informadas pelo estabelecimento. Este registro não substitui os direitos legais do consumidor. Não é comprovante de pagamento.",
        );
      if (w.voidedAt)
        doc.moveDown().text("REGISTRO CANCELADO: " + w.voidReason);
      for (const r of await R.findAll({
        where: { warrantyId: w.id },
        order: [["createdAt", "ASC"]],
      })) {
        doc
          .addPage()
          .fontSize(15)
          .text(
            "Retorno — " +
              {
                open: "Em análise",
                accepted: "Aceito",
                rejected: "Recusado",
                completed: "Concluído",
              }[r.status],
          );
        doc
          .fontSize(11)
          .text("Recebido: " + r.receivedOn + " · " + r.mileage + " km")
          .text(r.reason)
          .text(
            "Prazo: " +
              (r.eligibility.withinDate ? "Dentro" : "Fora") +
              " · Quilometragem: " +
              (r.eligibility.withinMileage ? "Dentro" : "Fora"),
          );
        for (const e of r.events)
          doc
            .moveDown(0.3)
            .text(
              new Date(e.at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
              }) +
                " · " +
                e.username +
                " · " +
                e.note,
            );
      }
      doc.end();
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
