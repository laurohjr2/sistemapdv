function factory() {
  const router = require("express").Router(),
    { authenticateToken } = require("../middleware/auth"),
    { handler, uuid } = require("../services/commercialValidation"),
    { DeliveryOrder, Sale } = require("../models"),
    ops = require("../services/deliveryOperations");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("delivery"),
  );
  router.get(
    "/",
    handler(async (req, res) =>
      res.json(
        await DeliveryOrder.findAll({
          include: [{ model: Sale, as: "sale", attributes: ["status"] }],
          order: [["createdAt", "DESC"]],
          limit: 200,
        }),
      ),
    ),
  );
  router.post(
    "/",
    handler(async (req, res) =>
      res.status(201).json(await ops.create(req.body, req.user)),
    ),
  );
  router.get(
    "/:id/pdf",
    handler(async (req, res) => {
      const o = await DeliveryOrder.findByPk(uuid(req.params.id));
      if (!o) return res.sendStatus(404);
      const sale = await Sale.findByPk(o.saleId);
      const PDF = require("pdfkit"),
        doc = new PDF({ margin: 45 });
      res.type("application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="entrega-' + o.saleId + '.pdf"',
      );
      doc.pipe(res);
      await require("../services/businessSettingsService").printHeader(doc);
      const labels = {
        received: "Recebido",
        preparing: "Em separação/preparo",
        ready: "Pronto",
        dispatched: "Saiu para entrega",
        delivered: "Entregue",
        cancelled: "Entrega cancelada",
      };
      doc
        .fontSize(17)
        .text("Pedido de entrega — venda #" + o.saleId)
        .moveDown();
      doc.fontSize(11).text("Situação: " + labels[o.status]);
      doc.text("Cliente: " + o.customerName).text("Telefone: " + o.phone);
      const a = o.address;
      for (const line of [
        a.street + ", " + a.number,
        a.complement,
        [a.district, a.city, a.state, a.postalCode].filter(Boolean).join(" · "),
        a.reference && "Referência: " + a.reference,
        o.courierName && "Entregador: " + o.courierName,
      ])
        if (line) doc.text(line);
      doc.moveDown();
      for (const i of o.items) {
        doc.text(
          Number(i.quantity).toLocaleString("pt-BR") +
            " " +
            i.unit +
            " × " +
            i.name +
            " — " +
            Number(i.total).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
        );
        if (i.notes)
          doc
            .fontSize(10)
            .text("Obs.: " + i.notes)
            .fontSize(11);
      }
      doc.moveDown().text(
        "Total registrado na venda: " +
          Number(o.paidTotal).toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          }),
      );
      if (o.notes) doc.text("Observações da entrega: " + o.notes);
      doc
        .moveDown()
        .fontSize(9)
        .text(
          sale?.status === "cancelled"
            ? "Venda cancelada. Não realizar entrega nem cobrança. Documento sem valor fiscal."
            : "Pagamento já registrado na venda. Não cobrar novamente. Documento de separação/entrega, sem valor fiscal.",
        );
      doc.end();
    }),
  );
  router.put(
    "/:id",
    handler(async (req, res) =>
      res.json(await ops.edit(uuid(req.params.id), req.body, req.user)),
    ),
  );
  router.post(
    "/:id/status",
    handler(async (req, res) =>
      res.json(await ops.transition(uuid(req.params.id), req.body, req.user)),
    ),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
