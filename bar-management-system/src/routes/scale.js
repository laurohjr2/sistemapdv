function factory() {
  const router = require("express").Router(),
    { Op } = require("sequelize");
  const {
      sequelize,
      ScaleSettings,
      ScaleProduct,
      Product,
      AuditLog,
    } = require("../models"),
    ops = require("../services/scaleOperations");
  const {
      handler,
      fail,
      uuid,
      cents,
    } = require("../services/commercialValidation"),
    { authenticateToken, authorizeRoles } = require("../middleware/auth");
  router.use(
    authenticateToken,
    require("../middleware/businessModule")("market"),
  );
  const manager = authorizeRoles("admin", "gerente");
  const audit = (user, action, details, transaction) =>
    AuditLog.create(
      { userId: user.id, action, details: JSON.stringify(details) },
      { transaction },
    );
  router.get(
    "/settings",
    handler(async (req, res) =>
      res.json({ ...(await ops.settings()), presets: ops.presets }),
    ),
  );
  router.put(
    "/settings",
    manager,
    handler(async (req, res) => {
      const b = req.body,
        preset = ops.presets.find((p) => p.id === b?.preset);
      if (
        !preset ||
        typeof b.enabled !== "boolean" ||
        typeof b.prefix !== "string" ||
        !(preset.codeLength === 5 ? /^2\d$/ : /^2$/).test(b.prefix)
      )
        throw fail("Formato ou prefixo inválido");
      if (b.enabled && preset.mode === "price" && b.priceConfirmed !== true)
        throw fail(
          "Confirme que o preço/kg está sincronizado com a balança para usar etiquetas por preço",
        );
      const result = await sequelize.transaction(async (transaction) => {
        await ops.enabled(transaction);
        const record = await ScaleSettings.findByPk(1, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (b.revision !== (record?.revision || 0))
          throw fail(
            "Configuração alterada em outro terminal. Recarregue.",
            409,
          );
        if (
          preset.codeLength === 5 &&
          (await ScaleProduct.count({
            where: { plu: { [Op.gt]: 99999 } },
            transaction,
          }))
        )
          throw fail(
            "Existem PLUs com seis dígitos. Corrija os vínculos antes de mudar para cinco dígitos.",
          );
        const data = {
          preset: preset.id,
          prefix: b.prefix,
          enabled: b.enabled,
          revision: (record?.revision || 0) + 1,
        };
        const saved = record
          ? await record.update(data, { transaction })
          : await ScaleSettings.create({ ...data, id: 1 }, { transaction });
        await audit(
          req.user,
          "scale_settings_updated",
          { ...data, priceConfirmed: b.priceConfirmed === true },
          transaction,
        );
        return saved;
      });
      res.json(result);
    }),
  );
  router.get(
    "/products",
    handler(async (req, res) =>
      res.json(await ScaleProduct.findAll({ order: [["plu", "ASC"]] })),
    ),
  );
  router.put(
    "/products/:id",
    manager,
    handler(async (req, res) => {
      const plu = Number(req.body?.plu);
      if (
        !["number", "string"].includes(typeof req.body?.plu) ||
        !/^\d{1,6}$/.test(String(req.body.plu)) ||
        plu < 1
      )
        throw fail("Informe um PLU de 1 a 999999");
      const saved = await sequelize.transaction(async (transaction) => {
        await ops.enabled(transaction);
        const cfg = await ops.settings(transaction),
          preset = ops.presets.find((p) => p.id === cfg.preset);
        if (plu >= 10 ** preset.codeLength)
          throw fail("PLU maior que o formato selecionado");
        const p = await Product.findByPk(uuid(req.params.id), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!p?.active || p.itemType !== "product" || p.unitOfMeasure !== "kg")
          throw fail("Escolha um produto ativo vendido por kg");
        cents(p.salePrice, "Preço/kg");
        const record = await ScaleProduct.findByPk(p.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (req.body.revision !== (record?.revision || 0))
          throw fail("Vínculo alterado em outro terminal. Recarregue.", 409);
        const duplicate = await ScaleProduct.findOne({
          where: { plu },
          transaction,
        });
        if (duplicate && duplicate.productId !== p.id)
          throw fail("Este PLU já está vinculado a outro produto", 409);
        const values = {
          productId: p.id,
          plu,
          unitPriceSnapshot: p.salePrice,
          revision: (record?.revision || 0) + 1,
        };
        const result = record
          ? await record.update(values, { transaction })
          : await ScaleProduct.create(values, { transaction });
        await audit(req.user, "scale_product_updated", values, transaction);
        return result;
      });
      res.json(saved);
    }),
  );
  router.delete(
    "/products/:id",
    manager,
    handler(async (req, res) => {
      await sequelize.transaction(async (transaction) => {
        await ops.enabled(transaction);
        const row = await ScaleProduct.findByPk(uuid(req.params.id), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!row) throw fail("Vínculo não encontrado", 404);
        await audit(
          req.user,
          "scale_product_removed",
          row.toJSON(),
          transaction,
        );
        await row.destroy({ transaction });
      });
      res.sendStatus(204);
    }),
  );
  router.post(
    "/scan",
    handler(async (req, res) => {
      const code = req.body?.barcode;
      if (typeof code !== "string" || !code.trim() || code.length > 50)
        throw fail("Código inválido");
      const cfg = await ops.settings(),
        regular = await Product.findOne({
          where: { barcode: code, active: true },
        });
      if (cfg.enabled && code.startsWith(cfg.prefix)) {
        if (regular)
          throw fail(
            "Código ambíguo: também cadastrado como código comum. Confira o cadastro.",
            409,
          );
        return res.json({
          kind: "scale",
          ...(await ops.decode(code, undefined, req.body.quantity)),
        });
      }
      if (!regular)
        throw fail("Produto não encontrado com este código de barras", 404);
      res.json({ kind: "regular", productId: regular.id });
    }),
  );
  router.post(
    "/labels",
    manager,
    handler(async (req, res) => {
      const items = req.body?.items;
      if (!Array.isArray(items) || !items.length || items.length > 100)
        throw fail("Escolha de 1 a 100 produtos");
      const rows = [];
      let copies = 0;
      const ids = new Set();
      for (const item of items) {
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw fail("Item de etiqueta inválido");
        const id = uuid(item.productId).toLowerCase();
        if (ids.has(id)) throw fail("Produto repetido na seleção");
        ids.add(id);
        if (
          !Number.isInteger(item.copies) ||
          item.copies < 1 ||
          item.copies > 100
        )
          throw fail("Quantidade de etiquetas inválida");
        copies += item.copies;
        if (copies > 200) throw fail("Imprima até 200 etiquetas por vez");
        const p = await Product.findByPk(id);
        if (!p?.active || p.itemType !== "product")
          throw fail("Produto indisponível para etiqueta");
        if (
          cents(item.expectedPrice, "Preço esperado", true) !==
          cents(p.salePrice, "Preço", true)
        )
          throw fail(
            "Preço alterado. Recarregue os produtos antes de imprimir.",
            409,
          );
        rows.push({ p, copies: item.copies });
      }
      await audit(req.user, "shelf_labels_generated", {
        products: rows.map((r) => ({
          id: r.p.id,
          price: r.p.salePrice,
          copies: r.copies,
        })),
      });
      const doc = new (require("pdfkit"))({
          size: "A4",
          margin: 0,
          autoFirstPage: false,
        }),
        mm = (n) => (n * 72) / 25.4;
      res.type("application/pdf").attachment("etiquetas-gondola.pdf");
      doc.pipe(res);
      let index = 0;
      const { companyName } =
        await require("../services/businessSettingsService").getSettings();
      for (const { p, copies } of rows)
        for (let n = 0; n < copies; n++, index++) {
          if (index % 8 === 0) doc.addPage();
          const x = mm(13.5 + (index % 2) * 93),
            y = mm(14 + (Math.floor(index / 2) % 4) * 63);
          doc
            .rect(x, y, mm(90), mm(60))
            .strokeColor("#aaaaaa")
            .lineWidth(0.3)
            .stroke();
          doc
            .fillColor("#000000")
            .font("Helvetica")
            .fontSize(8)
            .text(companyName, x + mm(3), y + mm(2), {
              width: mm(84),
              height: mm(4),
              ellipsis: true,
            });
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .text(p.name, x + mm(3), y + mm(7), {
              width: mm(84),
              height: mm(9),
              ellipsis: true,
            });
          doc.fontSize(24).text(
            Number(p.salePrice).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            }),
            x + mm(3),
            y + mm(17),
            { width: mm(84), height: mm(11) },
          );
          doc
            .font("Helvetica")
            .fontSize(9)
            .text(
              `por ${p.unitOfMeasure === "kg" ? "kg" : p.unitOfMeasure}`,
              x + mm(3),
              y + mm(28),
            );
          const bars = require("../services/ean13").bits(p.barcode);
          if (bars) {
            const unit = mm(0.35),
              start = x + mm(25) + 11 * unit;
            for (let b = 0; b < bars.length; b++)
              if (bars[b] === "1")
                doc.rect(start + b * unit, y + mm(33), unit, mm(18.5)).fill();
            doc.fontSize(9).text(p.barcode, x + mm(23), y + mm(52), {
              width: mm(44),
              align: "center",
            });
          } else
            doc
              .fontSize(9)
              .text(
                p.barcode
                  ? `Código: ${p.barcode}`
                  : "Sem código EAN-13 cadastrado",
                x + mm(3),
                y + mm(39),
                { width: mm(84), height: mm(12), ellipsis: true },
              );
          doc
            .fontSize(6)
            .text(
              "Preço conferido em " +
                require("../services/commercialValidation").today(),
              x + mm(3),
              y + mm(57),
              { width: mm(84) },
            );
        }
      doc.end();
    }),
  );
  return router;
}
module.exports = require("../tenancy/scopedModule").router(factory);
