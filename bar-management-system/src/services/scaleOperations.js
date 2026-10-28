const {
  fail,
  cents,
  lineCents,
  quantity: validateQuantity,
} = require("./commercialValidation");
const { valid } = require("./ean13");
const presets = [
  {
    id: "weight_5",
    name: "Peso — PLU 5 dígitos",
    codeLength: 5,
    mode: "weight",
    prefix: "20",
  },
  {
    id: "price_5",
    name: "Preço total — PLU 5 dígitos",
    codeLength: 5,
    mode: "price",
    prefix: "20",
  },
  {
    id: "weight_6",
    name: "Peso — PLU 6 dígitos",
    codeLength: 6,
    mode: "weight",
    prefix: "2",
  },
  {
    id: "price_6",
    name: "Preço total — PLU 6 dígitos",
    codeLength: 6,
    mode: "price",
    prefix: "2",
  },
];
function factory() {
  const {
    sequelize,
    ScaleSettings,
    ScaleProduct,
    Product,
  } = require("../models");
  async function enabled(transaction) {
    await sequelize.query("SELECT pg_advisory_xact_lock(882021)", {
      transaction,
    });
    if (
      !require("../config/businessProfiles").effectiveModules(
        await require("./businessSettingsService").getSettings(transaction),
      ).market
    )
      throw fail("Ative o módulo Mercado para ler etiquetas de balança", 403);
  }
  const settings = async (transaction) =>
    (await ScaleSettings.findByPk(1, { transaction }))?.toJSON() || {
      id: 1,
      enabled: false,
      preset: "weight_5",
      prefix: "20",
      revision: 0,
    };
  async function decode(barcode, transaction, confirmedQuantity) {
    if (typeof barcode !== "string" || !valid(barcode))
      throw fail(
        "Código EAN-13 inválido. Confira os 13 dígitos e o verificador.",
      );
    if (
      await Product.findOne({ where: { barcode, active: true }, transaction })
    )
      throw fail(
        "Código ambíguo: também cadastrado como código comum. Confira o cadastro.",
        409,
      );
    const cfg = await settings(transaction),
      preset = presets.find((p) => p.id === cfg.preset);
    if (!cfg.enabled || !preset)
      throw fail("Leitura de etiquetas de balança desativada");
    if (!barcode.startsWith(cfg.prefix))
      throw fail("Prefixo da etiqueta não corresponde à configuração");
    const plu = Number(
        barcode.slice(cfg.prefix.length, cfg.prefix.length + preset.codeLength),
      ),
      payload = Number(barcode.slice(7, 12));
    if (!plu || !payload) throw fail("Etiqueta com PLU ou peso/preço zerado");
    const binding = await ScaleProduct.findOne({ where: { plu }, transaction });
    if (!binding) throw fail("PLU da etiqueta não vinculado a um produto");
    const p = await Product.findByPk(binding.productId, { transaction });
    if (!p?.active || p.itemType !== "product" || p.unitOfMeasure !== "kg")
      throw fail(
        "O PLU precisa corresponder a um produto ativo vendido por kg",
      );
    const unit = cents(p.salePrice, "Preço por kg");
    let quantity = payload / 1000;
    if (preset.mode === "price") {
      if (cents(binding.unitPriceSnapshot) !== unit)
        throw fail(
          "Preço/kg alterado. Confira o preço na balança e salve novamente o vínculo do PLU.",
          409,
        );
      quantity =
        confirmedQuantity === undefined
          ? Math.round((payload / unit) * 1000) / 1000
          : validateQuantity(confirmedQuantity);
      if (quantity <= 0 || lineCents(quantity, unit) !== payload)
        throw fail(
          "Não é possível converter o preço da etiqueta em peso com três casas decimais. Use etiqueta por peso ou confira a balança.",
        );
    }
    return {
      productId: p.id,
      productName: p.name,
      barcode,
      plu,
      mode: preset.mode,
      unitPrice: unit / 100,
      quantity,
      total: lineCents(quantity, unit) / 100,
      settingsRevision: cfg.revision,
      bindingRevision: binding.revision,
      quantityConfirmed:
        preset.mode === "price" && confirmedQuantity !== undefined,
    };
  }
  return { enabled, settings, decode };
}
module.exports = {
  presets,
  ...require("../tenancy/scopedModule")(factory, [
    "enabled",
    "settings",
    "decode",
  ]),
};
