function createRouter() {
  const router = require("express").Router();
  const { authenticateToken, authorizeRoles } = require("../middleware/auth");
  const { handler, uuid, fail } = require("../services/commercialValidation");
  const ops = require("../services/workshopOperations");
  const { Vehicle, WorkOrder, Customer, User, Sale } = require("../models");
  const manager = authorizeRoles("admin", "gerente");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("workshop"),
  );
  router.get(
    "/vehicles",
    handler(async (req, res) =>
      res.json(
        await Vehicle.findAll({
          include: [
            { model: Customer, as: "customer", attributes: ["id", "name"] },
          ],
          order: [["plate", "ASC"]],
        }),
      ),
    ),
  );
  router.post(
    "/vehicles",
    manager,
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.saveVehicle({ body: req.body, user: req.user })),
    ),
  );
  router.put(
    "/vehicles/:id",
    manager,
    handler(async (req, res) =>
      res.json(
        await ops.saveVehicle({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.get(
    "/staff",
    handler(async (req, res) =>
      res.json(
        await User.findAll({
          where: { active: true, platformUserId: null },
          attributes: ["id", "username"],
          order: [["username", "ASC"]],
        }),
      ),
    ),
  );
  const include = [
    {
      model: Sale,
      as: "sale",
      attributes: ["id", "status", "payments", "total_amount", "created_at"],
    },
  ];
  router.get(
    "/orders",
    handler(async (req, res) =>
      res.json(
        await WorkOrder.findAll({ include, order: [["number", "DESC"]] }),
      ),
    ),
  );
  router.post(
    "/orders",
    manager,
    handler(async (req, res) =>
      res
        .status(201)
        .json(await ops.saveOrder({ body: req.body, user: req.user })),
    ),
  );
  router.get(
    "/orders/:id",
    handler(async (req, res) => {
      const order = await WorkOrder.findByPk(uuid(req.params.id), { include });
      if (!order) throw fail("Ordem de serviço não encontrada", 404);
      res.json(order);
    }),
  );
  router.put(
    "/orders/:id",
    manager,
    handler(async (req, res) =>
      res.json(
        await ops.saveOrder({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.post(
    "/orders/:id/status",
    handler(async (req, res) =>
      res.json(
        await ops.transition({
          id: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.post(
    "/orders/:id/checkout",
    manager,
    handler(async (req, res) =>
      res.status(201).json(
        await require("../services/saleOperations").create({
          workOrderId: req.params.id,
          body: req.body,
          user: req.user,
        }),
      ),
    ),
  );
  router.get(
    "/orders/:id/pdf",
    handler(async (req, res) => {
      const o = await WorkOrder.findByPk(uuid(req.params.id), { include });
      if (!o) throw fail("Ordem de serviço não encontrada", 404);
      const doc = new (require("pdfkit"))({ margin: 40 });
      res.type("application/pdf").attachment(`ordem-servico-${o.number}.pdf`);
      doc.pipe(res);
      await require("../services/businessSettingsService").printHeader(doc);
      const money = (value) =>
        Number(value).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });
      const stamp = (value) =>
        new Date(value).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });
      const add = (line, bold = false) => {
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(10)
          .text(line);
        doc.moveDown(0.3);
      };
      doc.fontSize(17).text(`Ordem de serviço #${o.number}`);
      doc.moveDown();
      add(
        "Documento não fiscal. " +
          (o.sale?.status === "completed"
            ? "Recebimento registrado."
            : "Não comprova pagamento."),
      );
      add(`Situação: ${ops.states[o.status]} | Entrada: ${stamp(o.createdAt)}`);
      add(
        `Cliente: ${o.customerSnapshot.name} | Telefone: ${o.customerSnapshot.phone || "Não informado"}`,
      );
      add(
        `Veículo: ${o.vehicleSnapshot.plate} | ${o.vehicleSnapshot.brand} ${o.vehicleSnapshot.model} | Ano: ${o.vehicleSnapshot.year || "Não informado"} | Cor: ${o.vehicleSnapshot.color || "Não informada"} | ${o.mileage} km`,
      );
      add(`Responsável: ${o.assignedName || "Não definido"}`);
      add(`Relato: ${o.complaint}`);
      add(`Diagnóstico: ${o.diagnosis || "Pendente"}`);
      add("Checklist de entrada", true);
      const checkNames = {
        ok: "Conferido / OK",
        attention: "Atenção",
        not_checked: "Não conferido",
      };
      for (const [key, label] of Object.entries(ops.checkLabels))
        add(`${label}: ${checkNames[o.checklist[key]]}`);
      const fuel = {
        empty: "Vazio",
        quarter: "1/4",
        half: "1/2",
        three_quarters: "3/4",
        full: "Cheio",
        not_checked: "Não conferido",
      };
      add(`Combustível: ${fuel[o.checklist.fuelLevel]}`);
      if (o.checklist.notes) add(o.checklist.notes);
      add("Peças e mão de obra", true);
      for (const line of o.lines)
        add(
          `${line.itemType === "service" ? "Serviço" : "Peça"}: ${line.name} | ${line.quantity} ${line.unit} × ${money(line.unitPrice)} = ${money(line.total)}`,
        );
      add(
        `Subtotal: ${money(o.subtotal)} | Desconto: ${money(o.discount)} | Total: ${money(o.total)}`,
        true,
      );
      add(o.notes);
      if (o.approvedAt)
        add(`Aprovação em ${stamp(o.approvedAt)}: ${o.approvalNote}`);
      if (o.sale) {
        add(
          `Venda #${o.sale.id} — ${o.sale.status === "completed" ? "Recebida" : "Cancelada"}`,
        );
        const methods = {
          dinheiro: "Dinheiro",
          pix: "Pix",
          cartao_credito: "Cartão de crédito",
          cartao_debito: "Cartão de débito",
        };
        for (const p of o.sale.payments || [])
          add(`${methods[p.method] || p.method}: ${money(p.amount)}`);
      }
      add("Histórico", true);
      for (const e of o.events)
        add(
          `${stamp(e.at)} | ${e.username} | ${ops.states[e.action] || { created: "Criada", revised: "Revisada", paid: "Recebida", payment_cancelled: "Pagamento cancelado", photo_added: "Foto anexada", photo_archived: "Foto arquivada", signature_recorded: "Assinatura registrada", signature_voided: "Registro de assinatura cancelado" }[e.action] || e.action}${e.note ? " | " + e.note : ""}`,
        );
      add(
        "Estoque das peças movimentado no recebimento. Serviços não movimentam estoque.",
      );
      await require("../services/workshopEvidence").appendPdf(doc, o);
      doc.end();
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(createRouter);
