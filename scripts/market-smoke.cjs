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
const slug = "mercado-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Mercado teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
(async () => {
  const login = await r("/auth/login", {
      method: "POST",
      body: { company: slug, username: "catalog.admin", password },
    }),
    admin = login.token;
  const req = (path, method = "GET", body, status = 200, token = admin) =>
    r(path, { method, body, status, token });
  await req("/market/lots", "GET", undefined, 403);
  await req("/settings", "PUT", { businessProfile: "mercado" });
  const product = (
    await req(
      "/products",
      "POST",
      {
        name: "Leite teste de lotes",
        category: "alimentos",
        unitOfMeasure: "unidade",
        costPrice: 2,
        salePrice: 5,
      },
      201,
    )
  ).product;
  await req("/stock/add", "POST", { productId: product.id, quantity: 10 }, 201);
  await req("/market/products/" + product.id + "/control", "POST", {
    enabled: true,
  });
  let lots = await req("/market/lots"),
    pending = lots.find((l) => l.kind === "unidentified");
  assert.equal(Number(pending.quantity), 10);
  assert.equal(pending.status, "pending");
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 100 },
    201,
  );
  const sell = (q, status = 201) =>
    req(
      "/sales",
      "POST",
      {
        cash_register_id: cash.id,
        payment_method: "pix",
        items: [{ product_id: product.id, quantity: q }],
      },
      status,
    );
  await sell(1, 400);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 10);
  await req(
    "/market/lots/" + pending.id + "/identify",
    "POST",
    {
      revision: 0,
      quantity: 2,
      batchNumber: "A",
      expirationDate: "2099-01-01",
      note: "Stale",
    },
    409,
  );
  await req(
    "/market/lots/" + pending.id + "/identify",
    "POST",
    {
      revision: pending.revision,
      quantity: 11,
      batchNumber: "A",
      expirationDate: "2099-01-01",
      note: "Too much",
    },
    400,
  );
  await req("/market/lots/" + pending.id + "/identify", "POST", {
    revision: pending.revision,
    quantity: 4,
    batchNumber: "A",
    expirationDate: "2099-01-01",
    note: "Conferência física",
  });
  lots = await req("/market/lots");
  pending = lots.find((l) => l.kind === "unidentified");
  await req("/market/lots/" + pending.id + "/identify", "POST", {
    revision: pending.revision,
    quantity: 3,
    batchNumber: "B",
    expirationDate: "2098-01-01",
    note: "Conferência física",
  });
  lots = await req("/market/lots");
  pending = lots.find((l) => l.kind === "unidentified");
  await req("/market/lots/" + pending.id + "/identify", "POST", {
    revision: pending.revision,
    quantity: 3,
    batchNumber: "VENCIDO",
    expirationDate: "2020-01-01",
    note: "Validade conferida",
  });
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 10);
  const sale = await sell(5);
  lots = await req("/market/lots");
  assert.equal(Number(lots.find((l) => l.batchNumber === "B").quantity), 0);
  assert.equal(Number(lots.find((l) => l.batchNumber === "A").quantity), 2);
  assert.equal(
    Number(lots.find((l) => l.batchNumber === "VENCIDO").quantity),
    3,
  );
  const availability = (await req("/products")).find(
    (p) => p.id === product.id,
  );
  assert.equal(availability.availableStock, 2);
  assert.equal(availability.blockedStock, 3);
  await sell(3, 400);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 5);
  await req("/sales/" + sale.id + "/cancel", "PUT", {});
  lots = await req("/market/lots");
  assert.equal(Number(lots.find((l) => l.kind === "return").quantity), 5);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 10);
  await req(
    "/stock/add",
    "POST",
    { productId: product.id, quantity: 1, batchNumber: "INCOMPLETO" },
    400,
  );
  await req(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 1,
      batchNumber: "A",
      expirationDate: "2099-02-01",
    },
    400,
  );
  await req(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 1,
      batchNumber: "ERRO",
      expirationDate: "2030-02-30",
    },
    400,
  );
  await req(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 2,
      batchNumber: "A",
      expirationDate: "2099-01-01",
    },
    201,
  );
  const results = await Promise.all(
    Array.from({ length: 3 }, () => sell(2, [201, 400])),
  );
  assert.equal(results.filter((v) => v.responseStatus === 201).length, 2);
  lots = await req("/market/lots");
  const expired = lots.find((l) => l.batchNumber === "VENCIDO");
  await req("/market/lots/" + expired.id + "/discard", "POST", {
    revision: expired.revision,
    quantity: 1,
    note: "Retirada por vencimento",
  });
  await req(
    "/market/lots/" + expired.id + "/discard",
    "POST",
    { revision: expired.revision, quantity: 1, note: "Repetição antiga" },
    409,
  );
  lots = await req("/market/lots");
  let total = lots.reduce(
    (sum, l) => sum + Math.round(Number(l.quantity) * 1000),
    0,
  );
  assert.equal(
    total,
    Math.round(
      Number((await req("/products/" + product.id)).currentStock) * 1000,
    ),
  );
  await req("/settings", "PUT", { modules: { market: false } }, 400);
  await req(
    "/market/products/" + product.id + "/control",
    "POST",
    { enabled: false },
    400,
  );
  const employeeUser = await req(
    "/users",
    "POST",
    { username: "mercado.atendente", password, role: "garcom" },
    201,
  );
  const employee = await req("/auth/login", "POST", {
    company: slug,
    username: employeeUser.user.username,
    password,
  });
  await req("/market/lots", "GET", undefined, 200, employee.token);
  await req(
    "/market/products/" + product.id + "/control",
    "POST",
    { enabled: false },
    403,
    employee.token,
  );
  const report = await req("/market/report");
  assert.ok(report.subarray(0, 5).equals(Buffer.from("%PDF-")));
  const movements = await req("/stock/history/" + product.id);
  assert.ok(movements.movements.some((m) => m.lotAllocations?.length));
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
    (await req("/market/lots", "GET", undefined, 200, second.token)).length,
    0,
  );
  await req(
    "/market/lots/" + expired.id + "/discard",
    "POST",
    { quantity: 1, note: "Outro cliente" },
    404,
    second.token,
  );
  fs.mkdirSync("work/market", { recursive: true });
  fs.writeFileSync(
    "work/market/session.json",
    JSON.stringify({ login, employee, slug, product, lots }),
    { mode: 0o600 },
  );
  console.log(
    `${count()} verificações de lotes aprovadas: saldo legado, FEFO, vencidos bloqueados, devolução pendente, entradas, concorrência, descarte, PDF e isolamento.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
