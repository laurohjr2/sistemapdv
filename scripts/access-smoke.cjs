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
const slug = "acessos-" + Date.now();
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
  const req = (path, method = "GET", body, status = 200, token = admin) =>
    r(path, { method, body, status, token });
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req("/settings", "PUT", {
    businessProfile: "bar_restaurante",
    modules: { workshop: true, autoparts: true, market: true, pizza: true },
  });
  const catalog = await req("/access/catalog");
  assert.ok(catalog.permissions.length > 60);
  assert.equal((await req("/access/me")).kind, "administrator");
  const staff = async (name, role) => {
    await req("/users", "POST", { username: name, password, role }, 201);
    return req("/auth/login", "POST", {
      company: slug,
      username: name,
      password,
    });
  };
  const kitchen = await staff("cozinha.teste", "garcom"),
    cashier = await staff("caixa.teste", "garcom"),
    stock = await staff("estoque.teste", "gerente"),
    mechanic = await staff("mecanico.teste", "garcom"),
    manager = await staff("gestor.teste", "gerente");
  let product = await req(
    "/products",
    "POST",
    {
      name: "Peça acesso",
      category: "outros",
      itemType: "product",
      unitOfMeasure: "unidade",
      costPrice: 12,
      salePrice: 20,
      currentStock: 10,
      minStockAlert: 0,
    },
    201,
  );
  product = product.product || product;
  await req(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 10,
      unitCost: 12,
      notes: "Entrada inicial sintética",
    },
    [200, 201],
  );
  assert.ok(
    (await req("/products", "GET", undefined, 200, kitchen.token))[0]
      .costPrice !== undefined,
  );
  const apply = async (user, id, revision = 0, permissions) => {
    const template = catalog.templates.find((t) => t.id === id);
    return req("/access/users/" + user.user.id, "PUT", {
      mode: "restricted",
      template: id,
      permissions: permissions || template.permissions,
      revision,
      reason: "Configuração sintética de " + id,
    });
  };
  let k = await apply(kitchen, "kitchen");
  assert.equal(k.access.mode, "restricted");
  assert.equal(k.access.home, "/kitchen");
  assert.equal(
    (await req("/auth/validate", "GET", undefined, 200, kitchen.token)).user
      .access.mode,
    "restricted",
  );
  await req("/queue", "GET", undefined, 200, kitchen.token);
  for (const path of [
    "/sales",
    "/customers",
    "/users",
    "/commerce/finance",
    "/reports/waiters",
    "/workshop/orders",
    "/stock/summary",
    "/access/catalog",
  ])
    await req(path, "GET", undefined, 403, kitchen.token);
  await req("/sales", "POST", {}, 403, kitchen.token);
  await req(
    "/users/" + kitchen.user.id,
    "PUT",
    { role: "admin" },
    403,
    kitchen.token,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { mode: "legacy", revision: 1, reason: "Autoelevação" },
    403,
    kitchen.token,
  );
  const list = await req("/products", "GET", undefined, 200, kitchen.token);
  assert.equal(list[0].costPrice, undefined);
  assert.equal(Number(list[0].salePrice), 20);
  const single = await req(
    "/products/" + product.id,
    "GET",
    undefined,
    200,
    kitchen.token,
  );
  assert.equal((single.product || single).costPrice, undefined);
  const base = {
    mode: "restricted",
    template: null,
    permissions: [],
    revision: k.access.revision,
    reason: "Teste inválido",
  };
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, permissions: ["users.manage"] },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, permissions: ["discounts.apply"] },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, permissions: ["inexistente"] },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, permissions: ["kitchen.view", "kitchen.view"] },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, permissions: ["sales.create"] },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, template: "inventory" },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, reason: "" },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, revision: 0 },
    409,
  );
  await req(
    "/access/users/" + login.user.id,
    "PUT",
    { ...base, revision: 0 },
    400,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "GET",
    undefined,
    404,
    second.token,
  );
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    { ...base, revision: 0 },
    404,
    second.token,
  );
  let c = await apply(cashier, "cashier");
  await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
    cashier.token,
  );
  const cash = await req(
    "/cash-register/status",
    "GET",
    undefined,
    200,
    cashier.token,
  );
  const saleBody = {
    cash_register_id: cash.id,
    payment_method: "dinheiro",
    items: [{ product_id: product.id, quantity: 1 }],
  };
  await req(
    "/sales",
    "POST",
    { ...saleBody, discount_amount: 1 },
    403,
    cashier.token,
  );
  const sale = await req("/sales", "POST", saleBody, 201, cashier.token);
  assert.equal(sale.user_id, cashier.user.id);
  assert.equal(Number(sale.total_amount), 20);
  c = await apply(cashier, "none", c.access.revision);
  await req("/sales", "GET", undefined, 403, cashier.token);
  assert.equal(
    (await req("/auth/validate", "GET", undefined, 200, cashier.token)).user
      .access.home,
    "/my-access",
  );
  c = await req("/access/users/" + cashier.user.id, "PUT", {
    mode: "legacy",
    permissions: [],
    revision: c.access.revision,
    reason: "Restaurar modelo anterior",
  });
  assert.equal(c.access.mode, "legacy");
  await req("/sales", "GET", undefined, 200, cashier.token);
  const history = await req("/access/users/" + cashier.user.id + "/history");
  assert.equal(history.length, 3);
  assert.ok(history.every((e) => e.actorId === login.user.id));
  assert.equal(history[0].after.mode, "legacy");
  let inventory = await apply(stock, "inventory");
  await req("/stock/movements", "GET", undefined, 200, stock.token);
  await req(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 1,
      unitCost: 12,
      notes: "Entrada autorizada",
    },
    [200, 201],
    stock.token,
  );
  for (const path of [
    "/sales",
    "/commerce/finance",
    "/reports/waiters",
    "/reports/dashboard",
    "/users",
  ])
    await req(path, "GET", undefined, 403, stock.token);
  const stockProduct = await req(
    "/products/" + product.id,
    "GET",
    undefined,
    200,
    stock.token,
  );
  assert.equal(Number((stockProduct.product || stockProduct).costPrice), 12);
  inventory = await req("/access/users/" + stock.user.id, "PUT", {
    mode: "restricted",
    template: null,
    permissions: ["products.read", "products.menu"],
    revision: inventory.access.revision,
    reason: "Somente catálogo, sem custos",
  });
  assert.equal(
    (await req("/products/" + product.id, "GET", undefined, 200, stock.token))
      .costPrice,
    undefined,
  );
  await req("/products", "POST", {}, 403, stock.token);
  const reportPerms = ["reports.view", "reports.export"];
  let m = await req("/access/users/" + manager.user.id, "PUT", {
    mode: "restricted",
    template: null,
    permissions: reportPerms,
    revision: 0,
    reason: "Relatórios sem ranking e financeiro",
  });
  await req("/reports/sales", "GET", undefined, 200, manager.token);
  for (const path of [
    "/reports/waiters",
    "/reports/financial",
    "/reports/export/pdf?type=waiters",
    "/reports/export/pdf?type=financial",
    "/reports/export/csv?type=catalog",
  ])
    await req(path, "GET", undefined, 403, manager.token);
  const customer = await req(
      "/customers",
      "POST",
      { name: "Cliente acesso" },
      201,
    ),
    vehicle = await req(
      "/workshop/vehicles",
      "POST",
      {
        customerId: customer.id,
        plate: "ACL1A23",
        brand: "Teste",
        model: "Carro",
        year: 2020,
        mileage: 100,
        notes: "",
        color: "Teste",
      },
      201,
    );
  const order = await req(
    "/workshop/orders",
    "POST",
    {
      vehicleId: vehicle.id,
      assignedUserId: mechanic.user.id,
      mileage: 100,
      complaint: "Inspeção",
      diagnosis: "Avaliar",
      notes: "",
      checklist: {},
      lines: [],
      discount: 0,
    },
    201,
  );
  await apply(mechanic, "mechanic");
  await req("/workshop/orders", "GET", undefined, 200, mechanic.token);
  await req(
    "/workshop/orders/" + order.id + "/status",
    "POST",
    { status: "approved", revision: order.revision, note: "Sem alçada" },
    403,
    mechanic.token,
  );
  await req(
    "/workshop/orders/" + order.id + "/checkout",
    "POST",
    {},
    403,
    mechanic.token,
  );
  await req("/users/" + stock.user.id, "PUT", { role: "garcom" });
  await req("/stock/movements", "GET", undefined, 403, stock.token);
  await req("/users/" + cashier.user.id, "PUT", { active: false });
  await req("/auth/validate", "GET", undefined, 401, cashier.token);
  await req("/users/" + cashier.user.id, "PUT", { active: true });
  await req("/auth/validate", "GET", undefined, 200, cashier.token);
  const pass = credentials(),
    masterRoot = await req("/support/login", "POST", {
      username: "master.local",
      password: pass.master,
    }),
    supportRoot = await req("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    });
  const master = await req(
      "/support/sessions",
      "POST",
      { company: slug },
      200,
      masterRoot.token,
    ),
    support = await req(
      "/support/sessions",
      "POST",
      { company: slug },
      200,
      supportRoot.token,
    );
  assert.equal(
    (await req("/access/me", "GET", undefined, 200, master.token)).kind,
    "master",
  );
  assert.equal(
    (await req("/access/me", "GET", undefined, 200, support.token)).kind,
    "support",
  );
  await req("/access/catalog", "GET", undefined, 403, support.token);
  await req(
    "/access/users/" + kitchen.user.id,
    "PUT",
    base,
    403,
    support.token,
  );
  await req("/users/" + master.user.id, "GET", undefined, 404);
  await req("/access/users/" + master.user.id, "GET", undefined, 404);
  await req(
    "/users/" + master.user.id + "/password",
    "PUT",
    { currentPassword: "x", newPassword: "123456" },
    404,
  );
  const secondAdmin = await staff("admin.segundo", "admin");
  const results = await Promise.all([
    req(
      "/users/" + secondAdmin.user.id,
      "DELETE",
      undefined,
      [200, 400, 403],
      admin,
    ),
    req(
      "/users/" + login.user.id,
      "DELETE",
      undefined,
      [200, 400, 403],
      secondAdmin.token,
    ),
  ]);
  assert.equal(results.filter((x) => x.responseStatus === 200).length, 1);
  const activeAdmins = (
    await req("/users", "GET", undefined, 200, master.token)
  ).filter((u) => u.role === "admin" && u.active);
  assert.equal(activeAdmins.length, 1);
  await req(
    "/users/" + activeAdmins[0].id,
    "DELETE",
    undefined,
    400,
    master.token,
  );
  // Restore both local administrators for browser validation and persistence checks.
  await req(
    "/users/" + login.user.id,
    "PUT",
    { active: true },
    200,
    master.token,
  );
  await req(
    "/users/" + secondAdmin.user.id,
    "PUT",
    { active: true },
    200,
    master.token,
  );
  fs.mkdirSync("work/access", { recursive: true });
  fs.writeFileSync(
    "work/access/session.json",
    JSON.stringify({
      login,
      kitchen,
      cashier,
      stock,
      mechanic,
      manager,
      second,
      master,
      support,
      catalog,
      password,
      slug,
      product,
      vehicle,
      order,
    }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações HTTP de acessos aprovadas: perfis, negação, descontos, custos, revisão, sessão antiga, histórico, Master/suporte, isolamento e último administrador.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
