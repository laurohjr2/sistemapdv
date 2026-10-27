// Run only against the isolated Docker test project; never against customer data.
const assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process"),
  crypto = require("node:crypto");
const project = process.env.PDV_TEST_PROJECT || "pdv-changes-test",
  base = process.env.PDV_TEST_URL || "http://127.0.0.1:8090/api";
const compose = [
  "compose",
  "-p",
  project,
  "-f",
  "compose.yaml",
  "-f",
  "docker/customer-experience-test.yaml",
];
assert.match(
  project,
  /^pdv-.*-test$/,
  "Use somente um projeto Docker descartável de teste",
);
let checks = 0;
const stamp = Date.now(),
  password = crypto.randomBytes(18).toString("hex");
function dockerJS(script, service = "backend") {
  return execFileSync(
    "docker",
    ["exec", "-i", project + "-" + service + "-1", "node"],
    { input: script, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
const credentials = execFileSync(
  "docker",
  [
    ...compose,
    "run",
    "--rm",
    "--no-deps",
    "provision",
    "node",
    "/app/docker/local.cjs",
    "credentials",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const adminPassword = /^Senha: (.+)$/m.exec(credentials)[1],
  supportPassword = [...credentials.matchAll(/^Senha: (.+)$/gm)][1][1],
  masterPassword = /^Senha Master: (.+)$/m.exec(credentials)[1];
async function request(path, method = "GET", body, token, status = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = r.headers.get("content-type")?.includes("application/json")
    ? await r.json()
    : Buffer.from(await r.arrayBuffer());
  assert.equal(
    r.status,
    status,
    method + " " + path + " " + (data.error || ""),
  );
  checks++;
  return data;
}
const login = (username, password) =>
  request("/auth/login", "POST", { company: "demo", username, password });
async function main() {
  await request("/health");
  const admin = (await login("admin.local", adminPassword)).token;
  const currentCash = await request(
    "/cash-register/status",
    "GET",
    undefined,
    admin,
  );
  if (currentCash.is_open)
    await request("/cash-register/close", "POST", { closing_amount: 0 }, admin);
  const { product } = await request(
    "/products",
    "POST",
    {
      name: "Pedido teste " + stamp,
      category: "porcoes",
      unitOfMeasure: "unidade",
      salePrice: 10,
      costPrice: 2,
    },
    admin,
    201,
  );
  await request(
    "/stock/add",
    "POST",
    { productId: product.id, quantity: 100 },
    admin,
    201,
  );
  const user = {};
  for (const role of ["gerente", "garcom"]) {
    const username = role + "." + stamp;
    const r = await request(
      "/users",
      "POST",
      { username, password, role, email: role + "." + stamp + "@example.com" },
      admin,
      201,
    );
    user[role] = { ...r.user, token: (await login(username, password)).token };
  }
  const saleBody = {
    items: [{ product_id: product.id, quantity: 2 }],
    payment_method: "pix",
  };
  const noCash = await request(
    "/sales",
    "POST",
    saleBody,
    user.garcom.token,
    400,
  );
  assert.equal(noCash.error, "Você precisa abrir um caixa para vender");
  const cash = await request(
    "/cash-register/open",
    "POST",
    { opening_amount: 20, opened_by: "Nome inventado" },
    user.garcom.token,
    201,
  );
  assert.equal(cash.opened_by, user.garcom.username);
  const customer = await request(
    "/customers",
    "POST",
    { name: "Cliente teste " + stamp, phone: "11999999999" },
    admin,
    201,
  );
  await request(
    "/sales",
    "POST",
    { ...saleBody, cash_register_id: cash.id, discount_amount: 1 },
    user.garcom.token,
    403,
  );
  const sale = await request(
    "/sales",
    "POST",
    {
      ...saleBody,
      cash_register_id: cash.id,
      discount_amount: 2,
      customerId: customer.id,
    },
    user.gerente.token,
    201,
  );
  assert.equal(Number(sale.total_amount), 18);
  assert.equal(sale.customerId, customer.id);
  const { table } = await request(
    "/tables",
    "POST",
    { tableNumber: Math.floor(stamp / 1000), capacity: 4 },
    admin,
    201,
  );
  const { comanda } = await request(
    "/comandas",
    "POST",
    { tableId: table.id, type: "mesa", customerId: customer.id },
    user.garcom.token,
    201,
  );
  assert.equal(comanda.customerName, customer.name);
  await request(
    "/comandas/" + comanda.id + "/customer",
    "PUT",
    { customerName: "Cliente atualizado", customerId: null },
    user.garcom.token,
  );
  const { item } = await request(
    "/comandas/" + comanda.id + "/items",
    "POST",
    { productId: product.id, quantity: 3, notes: "Sem cebola" },
    user.garcom.token,
    201,
  );
  await request(
    "/queue/items/" + item.id + "/status",
    "PUT",
    { status: "preparando" },
    user.garcom.token,
  );
  await request(
    "/queue/items/" + item.id + "/status",
    "PUT",
    { status: "pronto" },
    user.garcom.token,
  );
  const tables = await request("/tables", "GET", undefined, user.garcom.token);
  assert.equal(
    tables.find((t) => t.id === table.id).comandas[0].items[0]
      .preparationStatus,
    "pronto",
  );
  const closePath = "/comandas/" + comanda.id + "/close";
  await request(
    closePath,
    "PUT",
    { paymentMethod: "pix", discountValue: 1 },
    user.garcom.token,
    403,
  );
  const bad = {
    payments: [
      { method: "pix", amount: 10 },
      { method: "dinheiro", amount: 19 },
    ],
    paymentMethod: "pix",
  };
  await request(closePath, "PUT", bad, user.gerente.token, 400);
  assert.equal(
    (await request("/comandas/" + comanda.id, "GET", undefined, admin)).status,
    "aberta",
  );
  await request(
    closePath,
    "PUT",
    {
      ...bad,
      payments: [
        { method: "pix", amount: -1 },
        { method: "dinheiro", amount: 31 },
      ],
    },
    admin,
    400,
  );
  const closed = await request(
    closePath,
    "PUT",
    {
      payments: [
        { method: "pix", amount: 12 },
        { method: "dinheiro", amount: 15 },
      ],
      discountValue: 3,
    },
    user.gerente.token,
  );
  assert.equal(Number(closed.comanda.finalValue), 27);
  assert.equal(closed.comanda.payments.length, 2);
  await request(closePath, "PUT", { paymentMethod: "pix" }, admin, 400);
  assert.equal(
    (await request("/tables/" + table.id, "GET", undefined, admin)).status,
    "disponivel",
  );
  const totals = await request(
    "/cash-register/report/" + cash.id,
    "GET",
    undefined,
    admin,
  );
  assert.equal(totals.totalRevenue, 45);
  assert.equal(totals.byPayment.pix, 30);
  assert.equal(totals.byPayment.dinheiro, 15);
  const payments = await request("/reports/payments", "GET", undefined, admin);
  assert.ok(payments.some((p) => p.method === "pix" && p.total >= 30));
  const ranking = await request("/reports/waiters", "GET", undefined, admin);
  assert.ok(
    ranking.find((r) => r.name === user.garcom.username && r.revenue === 27),
  );
  assert.ok(
    ranking.find((r) => r.name === user.gerente.username && r.revenue === 18),
  );
  await request("/reports/waiters", "GET", undefined, user.garcom.token, 403);
  await request(
    "/reports/export/pdf?type=waiters",
    "GET",
    undefined,
    user.garcom.token,
    403,
  );
  for (const type of ["waiters", "stock", "catalog"]) {
    const pdf = await request(
      "/reports/export/pdf?type=" + type,
      "GET",
      undefined,
      admin,
    );
    assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  }
  const pdf = await request(
    "/print/comanda/" + comanda.id,
    "GET",
    undefined,
    admin,
  );
  const text = execFileSync("pdftotext", ["-", "-"], { input: pdf }).toString();
  assert.ok(text.includes("12,00") && text.includes("15,00"));
  await request("/users/" + user.garcom.id, "DELETE", undefined, admin);
  assert.ok(
    (await request("/users", "GET", undefined, admin)).some(
      (u) => u.id === user.garcom.id && !u.active,
    ),
  );
  await request(
    "/auth/login",
    "POST",
    { company: "demo", username: user.garcom.username, password },
    undefined,
    401,
  );
  await request("/products", "GET", undefined, user.garcom.token, 401);
  await request("/users/" + user.garcom.id, "PUT", { active: true }, admin);
  user.garcom.token = (await login(user.garcom.username, password)).token;
  // The generic recovery response does not reveal a registered account.
  const unknown = await request("/auth/forgot-password", "POST", {
    company: "demo",
    username: "unknown",
    email: "missing@example.com",
  });
  const known = await request("/auth/forgot-password", "POST", {
    company: "demo",
    username: user.garcom.username,
    email: "garcom." + stamp + "@example.com",
  });
  assert.equal(known.message, unknown.message);
  const mail = dockerJS(
    "process.stdout.write(require('node:fs').readFileSync('/smtp/message.eml','utf8'))",
    "smtp-test",
  )
    .replace(/=\r?\n/g, "")
    .replace(/=3D/g, "=");
  const token = /token=([a-f0-9]{64})/.exec(mail)?.[1];
  assert.ok(token, "E-mail de recuperação deve conter um link com token");
  checks++;
  await request("/auth/reset-password", "POST", {
    company: "demo",
    token,
    password: "Nova senha segura 123!",
  });
  await request("/products", "GET", undefined, user.garcom.token, 401);
  await request(
    "/auth/reset-password",
    "POST",
    { company: "demo", token, password: "Outra senha segura 123!" },
    undefined,
    400,
  );
  user.garcom.token = (
    await login(user.garcom.username, "Nova senha segura 123!")
  ).token;
  const expiredToken = crypto.randomBytes(32).toString("hex");
  const expiredHash = crypto
    .createHash("sha256")
    .update(expiredToken)
    .digest("hex");
  dockerJS(
    `(async()=>{const {readConfig,connection}=require('/app/bar-management-system/src/tenancy/platform');const db=connection(Object.values(readConfig().connections)[0]);try{const {PasswordReset}=require('/app/bar-management-system/src/models/build')(db);await PasswordReset.create({userId:${JSON.stringify(user.garcom.id)},tokenHash:${JSON.stringify(expiredHash)},expiresAt:new Date(Date.now()-1000)});}finally{await db.close()}})().catch(()=>process.exit(1));`,
  );
  await request(
    "/auth/reset-password",
    "POST",
    {
      company: "demo",
      token: expiredToken,
      password: "Senha para token expirado 123!",
    },
    undefined,
    400,
  );
  const support = await request("/support/login", "POST", {
    username: "support.local",
    password: supportPassword,
  });
  const supportSession = await request(
    "/support/sessions",
    "POST",
    { company: "demo" },
    support.token,
  );
  await request(
    "/support/company-info",
    "GET",
    undefined,
    supportSession.token,
  );
  await request(
    "/settings",
    "PUT",
    { companyName: "Proibido" },
    supportSession.token,
    403,
  );
  const master = await request("/support/login", "POST", {
    username: "master.local",
    password: masterPassword,
  });
  const masterSession = await request(
    "/support/sessions",
    "POST",
    { company: "demo" },
    master.token,
  );
  assert.equal(masterSession.user.master, true);
  const masterUser = await request(
    "/auth/validate",
    "GET",
    undefined,
    masterSession.token,
  );
  assert.equal(masterUser.user.role, "admin");
  assert.equal(masterUser.user.master, true);
  assert.ok(
    !(await request("/users", "GET", undefined, admin)).some(
      (u) => u.platformUserId,
    ),
    "Conta do fornecedor não deve aparecer como usuário cadastrado do cliente",
  );
  await request(
    "/settings",
    "PUT",
    { receiptMessage: "Teste de acesso Master" },
    masterSession.token,
  );
  await request("/support/company-info", "GET", undefined, masterSession.token);
  await request("/support/company-info", "GET", undefined, admin, 403);
  await request(
    "/users/" + masterSession.user.id,
    "DELETE",
    undefined,
    admin,
    403,
  );
  // Logo: valid PNG larger than former 256 KB, exact 2 MB boundary, above-limit rejection.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR4nGNgCNAgDY1qGNUwfDUAAKXJeAHRLEfzAAAAAElFTkSuQmCC",
    "base64",
  );
  const image = Buffer.alloc(2 * 1024 * 1024);
  png.copy(image);
  const logo = "data:image/png;base64," + image.toString("base64");
  await request(
    "/settings",
    "PUT",
    { logo, pixQrCode: logo, pixKey: "pix@example.com" },
    admin,
  );
  assert.equal((await request("/settings/branding?company=demo")).logo, logo);
  const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
  png.copy(oversized);
  await request(
    "/settings",
    "PUT",
    { logo: "data:image/png;base64," + oversized.toString("base64") },
    admin,
    400,
  );
  await request("/settings", "PUT", { logo: null, pixQrCode: null }, admin);
  // Rounding must agree between persisted finalValue and payment allocations.
  const tinyProduct = (
    await request(
      "/products",
      "POST",
      {
        name: "Arredondamento " + stamp,
        category: "porcoes",
        unitOfMeasure: "unidade",
        salePrice: 0.25,
        costPrice: 0,
      },
      admin,
      201,
    )
  ).product;
  await request(
    "/stock/add",
    "POST",
    { productId: tinyProduct.id, quantity: 1 },
    admin,
    201,
  );
  const tiny = (
    await request(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Teste de centavos" },
      admin,
      201,
    )
  ).comanda;
  await request(
    "/comandas/" + tiny.id + "/items",
    "POST",
    { productId: tinyProduct.id, quantity: 1 },
    admin,
    201,
  );
  const rounded = await request(
    "/comandas/" + tiny.id + "/close",
    "PUT",
    { discountPercentage: 54, payments: [{ method: "pix", amount: 0.12 }] },
    admin,
  );
  assert.equal(Number(rounded.comanda.finalValue), 0.12);
  assert.equal(
    Number(
      (await request("/comandas/" + tiny.id, "GET", undefined, admin))
        .payments[0].amount,
    ),
    0.12,
  );
  await request("/cash-register/close", "POST", { closing_amount: 35 }, admin);
  console.log(
    `${checks} verificações HTTP aprovadas: clientes, caixa, descontos, pagamentos divididos, cozinha/mesas, relatórios/PDF, inativação/reativação, recuperação, Master/suporte e logo de 2 MB.`,
  );
  require("node:fs").mkdirSync("work", { recursive: true });
  require("node:fs").writeFileSync(
    "work/test-session.json",
    JSON.stringify({
      adminToken: admin,
      user,
      table,
      customer,
      product,
      comanda,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
