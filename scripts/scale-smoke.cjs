// Synthetic tenants only. Never run against a customer installation.
const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const {
  project,
  client,
  credentials,
} = require("./testing/commercial-context.cjs");
const { request: r, count } = client();
const password = crypto.randomBytes(24).toString("hex");
const slug = "etiquetas-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Etiquetas teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "-i",
    "--network",
    project + "_default",
    "--mount",
    "type=volume,source=" + project + "_platform_data,target=/state",
    "--mount",
    "type=volume,source=" +
      project +
      "_install_secrets,target=/secrets,readonly",
    "-e",
    "DB_HOST=database",
    "-e",
    "DB_USER=postgres",
    "-e",
    "PLATFORM_CONFIG_FILE=/state/platform.json",
    image,
    "node",
  ],
  { input: fixture, stdio: ["pipe", "pipe", "pipe"] },
);
const ean = require("../bar-management-system/src/services/ean13");
const label = (prefix, plu, digits, payload) => {
  const body =
    prefix +
    String(plu).padStart(digits, "0") +
    String(payload).padStart(5, "0");
  return body + ean.checkDigit(body);
};
(async () => {
  assert.ok(ean.valid("4006381333931"));
  assert.ok(ean.valid("5901234123457"));
  assert.equal(ean.bits("4006381333931").length, 95);
  assert.equal(ean.valid("4006381333932"), false);
  assert.equal(ean.bits("bad"), null);
  const login = await r("/auth/login", {
      method: "POST",
      body: { company: slug, username: "catalog.admin", password },
    }),
    token = login.token;
  const req = (path, method = "GET", body, status = 200, auth = token) =>
    r(path, { method, body, status, token: auth });
  await req("/scale/settings", "GET", undefined, 403);
  await req("/settings", "PUT", { businessProfile: "mercado" });
  let cfg = await req("/scale/settings");
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.presets.length, 4);
  const make = async (name, unitOfMeasure, barcode) =>
    (
      await req(
        "/products",
        "POST",
        {
          name,
          category: "alimentos",
          unitOfMeasure,
          costPrice: 1,
          salePrice: unitOfMeasure === "kg" ? 20 : 3,
          barcode,
        },
        201,
      )
    ).product;
  const kg = await make(
      "Arroz por kg teste de etiquetas",
      "kg",
      "5901234123457",
    ),
    normal = await make(
      "Produto comum teste de etiquetas",
      "unidade",
      "4006381333931",
    );
  await req("/market/products/" + kg.id + "/control", "POST", {
    enabled: true,
  });
  await req(
    "/stock/add",
    "POST",
    {
      productId: kg.id,
      quantity: 10,
      batchNumber: "BAL-01",
      expirationDate: "2099-01-01",
    },
    201,
  );
  await req("/stock/add", "POST", { productId: normal.id, quantity: 5 }, 201);
  assert.equal(
    (await req("/scale/scan", "POST", { barcode: normal.barcode })).kind,
    "regular",
  );
  const saveCfg = async (preset, prefix, enabled = true) =>
    (cfg = await req("/scale/settings", "PUT", {
      preset,
      prefix,
      enabled,
      revision: cfg.revision,
      priceConfirmed: true,
    }));
  await req(
    "/scale/settings",
    "PUT",
    { preset: "weight_5", prefix: "99", enabled: true, revision: 0 },
    400,
  );
  await saveCfg("weight_5", "20");
  let binding = await req("/scale/products/" + kg.id, "PUT", {
    plu: 123,
    revision: 0,
  });
  await req(
    "/scale/products/" + normal.id,
    "PUT",
    { plu: 124, revision: 0 },
    400,
  );
  await req(
    "/scale/products/" + kg.id,
    "PUT",
    { plu: 0, revision: binding.revision },
    400,
  );
  await req("/scale/products/" + kg.id, "PUT", { plu: 123, revision: 0 }, 409);
  const code = label("20", 123, 5, 625);
  let scan = await req("/scale/scan", "POST", { barcode: code });
  assert.equal(scan.quantity, 0.625);
  assert.equal(scan.total, 12.5);
  await req(
    "/scale/scan",
    "POST",
    { barcode: code.slice(0, 12) + ((Number(code[12]) + 1) % 10) },
    400,
  );
  await req("/scale/scan", "POST", { barcode: label("20", 123, 5, 0) }, 400);
  await req("/scale/scan", "POST", { barcode: label("20", 999, 5, 625) }, 400);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 100 },
    201,
  );
  const saleBody = () => ({
    cash_register_id: cash.id,
    payment_method: "pix",
    items: [
      {
        product_id: kg.id,
        quantity: scan.quantity,
        scale: scan,
        unit_price: scan.unitPrice,
      },
    ],
  });
  await req(
    "/sales",
    "POST",
    { ...saleBody(), items: [{ product_id: kg.id, quantity: 1, scale: scan }] },
    400,
  );
  const weighted = await req("/sales", "POST", saleBody(), 201);
  assert.equal(Number(weighted.total_amount), 12.5);
  assert.equal(weighted.items[0].scale.barcode, code);
  assert.equal(Number((await req("/products/" + kg.id)).currentStock), 9.375);
  await req("/sales/" + weighted.id + "/cancel", "PUT", {});
  assert.equal(Number((await req("/products/" + kg.id)).currentStock), 10);
  assert.equal(
    (await req("/products")).find((p) => p.id === kg.id).availableStock,
    9.375,
  );
  // A settings revision change must invalidate an old cart.
  await saveCfg("weight_5", "20");
  await req("/sales", "POST", saleBody(), 409);
  scan = await req("/scale/scan", "POST", { barcode: code });
  // Same product with two labels remains two sale items and rounds each line once.
  const two = await req(
    "/sales",
    "POST",
    { ...saleBody(), items: [...saleBody().items, ...saleBody().items] },
    201,
  );
  assert.equal(two.items.length, 2);
  assert.equal(Number(two.total_amount), 25);
  await req(
    "/scale/settings",
    "PUT",
    {
      preset: "price_5",
      prefix: "20",
      enabled: true,
      revision: cfg.revision,
      priceConfirmed: false,
    },
    400,
  );
  await saveCfg("price_5", "20");
  const priceCode = label("20", 123, 5, 1250);
  scan = await req("/scale/scan", "POST", { barcode: priceCode });
  assert.equal(scan.quantity, 0.625);
  assert.equal(scan.quantityConfirmed, false);
  await req("/sales", "POST", saleBody(), 400);
  scan = await req("/scale/scan", "POST", {
    barcode: priceCode,
    quantity: 0.625,
  });
  assert.equal(scan.quantityConfirmed, true);
  await req("/sales", "POST", saleBody(), 201);
  await req("/scale/scan", "POST", { barcode: priceCode, quantity: 1 }, 400);
  await req("/products/" + kg.id, "PUT", { salePrice: 3 });
  await req("/scale/scan", "POST", { barcode: priceCode }, 409);
  binding = await req("/scale/products/" + kg.id, "PUT", {
    plu: 123,
    revision: binding.revision,
  });
  // A price code alone cannot distinguish 0.333 from 0.334 kg at R$3/kg; operator confirms the real weight.
  const ambiguousWeight = label("20", 123, 5, 100);
  scan = await req("/scale/scan", "POST", {
    barcode: ambiguousWeight,
    quantity: 0.334,
  });
  assert.equal(scan.quantity, 0.334);
  assert.equal(scan.total, 1);
  const corrected = await req("/sales", "POST", saleBody(), 201);
  assert.equal(Number(corrected.items[0].quantity), 0.334);
  assert.equal(Number(corrected.total_amount), 1);
  await saveCfg("weight_6", "2");
  binding = await req("/scale/products/" + kg.id, "PUT", {
    plu: 123456,
    revision: binding.revision,
  });
  const six = label("2", 123456, 6, 125);
  scan = await req("/scale/scan", "POST", { barcode: six });
  assert.equal(scan.quantity, 0.125);
  await req(
    "/scale/settings",
    "PUT",
    { preset: "weight_5", prefix: "20", enabled: true, revision: cfg.revision },
    400,
  );
  await saveCfg("price_6", "2");
  scan = await req("/scale/scan", "POST", {
    barcode: label("2", 123456, 6, 100),
    quantity: 0.334,
  });
  assert.equal(scan.total, 1);
  binding = await req("/scale/products/" + kg.id, "PUT", {
    plu: 123,
    revision: binding.revision,
  });
  await saveCfg("weight_5", "20");
  const beforeConflictScan = await req("/scale/scan", "POST", {
    barcode: code,
  });
  const conflict = await make(
    "Conflito de código de etiqueta",
    "unidade",
    code,
  );
  await req("/scale/scan", "POST", { barcode: code }, 409);
  await req(
    "/sales",
    "POST",
    {
      ...saleBody(),
      items: [
        {
          product_id: kg.id,
          quantity: 0.625,
          scale: beforeConflictScan,
        },
      ],
    },
    409,
  );
  await req("/products/" + conflict.id, "PUT", { barcode: "" });
  const employeeUser = await req(
    "/users",
    "POST",
    { username: "etiquetas.atendente", password, role: "garcom" },
    201,
  );
  const employee = await req("/auth/login", "POST", {
    company: slug,
    username: employeeUser.user.username,
    password,
  });
  await req("/scale/scan", "POST", { barcode: code }, 200, employee.token);
  await req(
    "/scale/settings",
    "PUT",
    { ...cfg, enabled: false },
    403,
    employee.token,
  );
  await req(
    "/scale/labels",
    "POST",
    { items: [{ productId: normal.id, copies: 1, expectedPrice: 3 }] },
    403,
    employee.token,
  );
  await req(
    "/scale/labels",
    "POST",
    { items: [{ productId: normal.id, copies: 1, expectedPrice: 1 }] },
    409,
  );
  await req(
    "/scale/labels",
    "POST",
    { items: [{ productId: normal.id, copies: 201, expectedPrice: 3 }] },
    400,
  );
  await req("/scale/labels", "POST", { items: [null] }, 400);
  const pdf = await req("/scale/labels", "POST", {
    items: [
      { productId: normal.id, copies: 9, expectedPrice: 3 },
      { productId: kg.id, copies: 1, expectedPrice: 3 },
    ],
  });
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  fs.mkdirSync("work/scale", { recursive: true });
  fs.writeFileSync("work/scale/labels.pdf", pdf);
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req(
    "/settings",
    "PUT",
    { businessProfile: "mercado" },
    200,
    second.token,
  );
  assert.equal(
    (await req("/scale/products", "GET", undefined, 200, second.token)).length,
    0,
  );
  await req(
    "/scale/products/" + kg.id,
    "PUT",
    { plu: 123, revision: 0 },
    400,
    second.token,
  );
  await req("/settings", "PUT", { modules: { market: false } }, 400);
  fs.writeFileSync(
    "work/scale/session.json",
    JSON.stringify({
      login,
      employee,
      slug,
      kg,
      normal,
      code,
      binding,
      cfg,
      priceCode,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${count()} verificações de balanças/etiquetas aprovadas: quatro formatos, checksum, peso fracionado, preço confirmado, revisões, lotes, arredondamento, PDF, permissões e isolamento.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
