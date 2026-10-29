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
const slug = "fidel-mesa-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Oficina teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
  const req = (p, method = "GET", body, status = 200, token = admin) =>
    r(p, { method, body, status, token });
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req("/settings", "PUT", { businessProfile: "bar_restaurante" });
  const c = await req(
      "/customers",
      "POST",
      { name: "Cliente fidelidade mesa" },
      201,
    ),
    other = await req("/customers", "POST", { name: "Outro cliente" }, 201);
  const profileBody = {
    label: "Programa mesa",
    percent: 10,
    active: true,
    validUntil: "",
    reason: "Adesão para teste",
    revision: 0,
  };
  let profile = await req("/loyalty/profiles/" + c.id, "PUT", profileBody);
  let p = await req(
    "/products",
    "POST",
    {
      name: "Produto da mesa",
      category: "outros",
      unitOfMeasure: "unidade",
      costPrice: 5,
      salePrice: 20,
      currentStock: 0,
      minStockAlert: 0,
    },
    201,
  );
  p = p.product || p;
  await req("/stock/add", "POST", { productId: p.id, quantity: 100 }, 201);
  await req("/cash-register/open", "POST", { opening_amount: 0 }, 201);
  const staff = async (name, role) => {
    await req("/users", "POST", { username: name, password, role }, 201);
    return req("/auth/login", "POST", {
      company: slug,
      username: name,
      password,
    });
  };
  const employee = await staff("operador.mesa", "garcom"),
    receiver = await staff("recebedor.mesa", "gerente");
  const open = async (customerId = c.id) => {
    const { comanda } = await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Cliente mesa", customerId },
      201,
    );
    await req(
      "/comandas/" + comanda.id + "/items",
      "POST",
      { productId: p.id, quantity: 2 },
      201,
    );
    return req("/comandas/" + comanda.id);
  };
  const preview = (
    account,
    revision = profile.revision,
    token = admin,
    status = 200,
  ) =>
    req(
      "/loyalty/comandas/" + account.id + "/quote",
      "POST",
      { revision },
      status,
      token,
    );
  const body = (quote, overrides = {}) => ({
    paymentMethod: "pix",
    paymentStatus: "pago",
    discountValue: quote.discount / 100,
    discountPercentage: 0,
    loyalty: {
      customerId: quote.customerId,
      comandaId: quote.comandaId,
      revision: quote.revision,
      scopeDigest: quote.scopeDigest,
    },
    ...overrides,
  });
  const close = (account, quote, overrides = {}, status = 200, token = admin) =>
    req(
      "/comandas/" + account.id + "/close",
      "PUT",
      body(quote, overrides),
      status,
      token,
    );
  let a = await open();
  assert.equal(a.customerId, c.id);
  const q = await preview(a);
  assert.equal(q.discount, 400);
  assert.equal(q.subtotal, 4000);
  assert.ok(q.scopeDigest);
  assert.ok(q.comandaUpdatedAt);
  await preview(a, profile.revision, employee.token, 403);
  await close(a, q, {}, 403, employee.token);
  const stockBefore = await req("/products/" + p.id),
    salesBefore = await req("/sales");
  await close(a, q, { discountValue: 5 }, 409);
  await close(a, q, { discountPercentage: 1 }, 409);
  await close(a, q, { payments: [{ method: "pix", amount: 40 }] }, 400);
  assert.equal((await req("/loyalty/history?customerId=" + c.id)).length, 0);
  let paid = await close(a, q, {
    payments: [
      { method: "dinheiro", amount: 16 },
      { method: "pix", amount: 20 },
    ],
  });
  paid = paid.comanda;
  assert.equal(Number(paid.finalValue), 36);
  assert.equal(paid.payments.length, 2);
  assert.equal(paid.loyaltyBenefit.profile.label, "Programa mesa");
  await close(a, q, {}, 400);
  assert.deepEqual(await req("/products/" + p.id), stockBefore);
  assert.deepEqual(await req("/sales"), salesBefore);
  const printed = await req("/print/comanda/" + a.id);
  assert.equal(printed.subarray(0, 4).toString(), "%PDF");
  fs.mkdirSync("work/mark20", { recursive: true });
  fs.writeFileSync("work/mark20/comanda.pdf", printed);
  const detail = await req("/comandas/" + a.id);
  assert.equal(detail.loyaltyBenefit.customerId, c.id);
  let history = await req("/loyalty/history?customerId=" + c.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].source, "comanda");
  assert.equal(history[0].status, "completed");
  assert.equal(Number(history[0].discount), 4);
  profile = await req("/loyalty/profiles/" + c.id, "PUT", {
    ...profileBody,
    percent: 15,
    label: "Programa atualizado",
    revision: profile.revision,
    reason: "Condição nova",
  });
  history = await req("/loyalty/history?customerId=" + c.id);
  assert.equal(history[0].profile.basisPoints, 1000);
  assert.equal(history[0].profile.label, "Programa mesa");
  a = await open();
  let stale = await preview(a);
  await req("/comandas/" + a.id + "/items/" + a.items[0].id, "PUT", {
    quantity: 3,
  });
  await close(a, stale, {}, 409);
  a = await req("/comandas/" + a.id);
  let fresh = await preview(a);
  const otherAccount = await open();
  await close(otherAccount, fresh, {}, 409);
  await req("/comandas/" + a.id + "/customer", "PUT", {
    customerId: other.id,
    customerName: other.name,
  });
  await close(a, fresh, {}, 409);
  await preview(a, profile.revision, admin, 400);
  await req("/comandas/" + a.id + "/customer", "PUT", {
    customerId: c.id,
    customerName: c.name,
  });
  a = await req("/comandas/" + a.id);
  stale = await preview(a);
  profile = await req("/loyalty/profiles/" + c.id, "PUT", {
    ...profileBody,
    revision: profile.revision,
    reason: "Regra alterada entre terminais",
  });
  await close(a, stale, {}, 409);
  fresh = await preview(a);
  let pending = (await close(a, fresh, { paymentStatus: "pendente" })).comanda;
  history = await req("/loyalty/history?customerId=" + c.id);
  assert.equal(history.find((b) => b.comandaId === a.id).status, "pending");
  await req("/comandas/" + a.id + "/payment-status", "PUT", {
    paymentStatus: "pago",
  });
  history = await req("/loyalty/history?customerId=" + c.id);
  assert.equal(history.find((b) => b.comandaId === a.id).status, "completed");
  const catalog = await req("/access/catalog"),
    wanted = catalog.dependencies;
  const expand = (ids) => {
    const result = new Set(ids);
    let n;
    do {
      n = result.size;
      for (const id of result) for (const d of wanted[id] || []) result.add(d);
    } while (n !== result.size);
    return [...result];
  };
  await req("/access/users/" + receiver.user.id, "PUT", {
    mode: "restricted",
    permissions: expand([
      "tables.receive",
      "tables.view",
      "discounts.apply",
      "loyalty.view",
      "products.read",
    ]),
    revision: 0,
    reason: "Recebe, mas não concede fidelidade",
  });
  a = await open();
  await preview(a, profile.revision, receiver.token, 403);
  fresh = await preview(a);
  await close(a, fresh, {}, 403, receiver.token);
  await req("/access/users/" + receiver.user.id, "PUT", {
    mode: "restricted",
    permissions: expand(["loyalty.tables", "products.read"]),
    revision: 1,
    reason: "Fidelidade de comandas autorizada",
  });
  const authorized = await preview(a, profile.revision, receiver.token);
  await close(a, authorized, {}, 200, receiver.token);
  await req("/sales", "POST", {}, 403, receiver.token);
  const table = await req(
    "/tables",
    "POST",
    { tableNumber: 20, capacity: 4 },
    201,
  );
  const tid = table.table?.id || table.id;
  const opened = await req(
    "/comandas",
    "POST",
    {
      type: "mesa",
      tableId: tid,
      customerId: c.id,
      customerName: c.name,
    },
    201,
  );
  const tableAccount = opened.comanda;
  assert.ok(tableAccount?.id);
  await req(
    "/comandas/" + tableAccount.id + "/items",
    "POST",
    { productId: p.id, quantity: 1 },
    201,
  );
  fresh = await preview(tableAccount);
  const parallel = await Promise.all([
    // A outra requisição pode já ter liberado a mesa; nesse caso não há comanda aberta (404).
    req("/tables/" + tid + "/close-comanda", "POST", body(fresh), [200, 400, 404]),
    close(tableAccount, fresh, {}, [200, 400]),
  ]);
  assert.equal(parallel.filter((v) => v.responseStatus === 200).length, 1);
  history = await req("/loyalty/history?customerId=" + c.id);
  assert.equal(
    history.filter((b) => b.comandaId === tableAccount.id).length,
    1,
  );
  await req(
    "/loyalty/comandas/" + tableAccount.id + "/quote",
    "POST",
    { revision: profile.revision },
    404,
    second.token,
  );
  assert.equal(
    (
      await req(
        "/loyalty/history?customerId=" + c.id,
        "GET",
        undefined,
        200,
        second.token,
      )
    ).length,
    0,
  );
  const noCustomer = await open(null);
  await preview(noCustomer, profile.revision, admin, 400);
  const inactive = await open();
  await req("/customers/" + c.id, "PUT", { name: c.name, active: false });
  await preview(inactive, profile.revision, admin, 400);
  await req("/customers/" + c.id, "PUT", { name: c.name, active: true });
  profile = await req("/loyalty/profiles/" + c.id, "PUT", {
    ...profileBody,
    revision: profile.revision,
    validUntil: "2000-01-01",
    reason: "Condição expirada",
  });
  await preview(inactive, profile.revision, admin, 400);
  profile = await req("/loyalty/profiles/" + c.id, "PUT", {
    ...profileBody,
    revision: profile.revision,
    reason: "Condição reativada",
  });
  const report = await req("/loyalty/history.pdf?customerId=" + c.id);
  fs.writeFileSync("work/mark20/fidelidade.pdf", report);
  const pass = credentials(),
    supplier = await req("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    }),
    support = await req(
      "/support/sessions",
      "POST",
      { company: slug },
      200,
      supplier.token,
    );
  await preview(inactive, profile.revision, support.token, 403);
  const cash = await req("/cash-register/status"),
    cashReport = await req("/cash-register/report/" + cash.id);
  assert.equal(Number(cashReport.totalRevenue), 144); // Recebimentos: 36 + 54 + 36 + 18.
  fs.writeFileSync(
    "work/mark20/session.json",
    JSON.stringify({
      login,
      second,
      employee,
      receiver,
      support,
      slug,
      password,
      customer: c,
      profile,
      product: p,
      tableId: tid,
      paidId: paid.id,
      pendingId: pending.id,
      openId: inactive.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações de fidelidade em comandas aprovadas: valores, desconto único, saldo, cliente, revisão, pagamentos, pendência, histórico, PDF, permissões, concorrência e isolamento.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
