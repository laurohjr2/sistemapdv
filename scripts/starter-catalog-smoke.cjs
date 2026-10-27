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
const slug = "catalogo-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Catálogo teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
  const admin = await r("/auth/login", {
    method: "POST",
    body: { company: slug, username: "catalog.admin", password },
  });
  const req = (path, method = "GET", body, status = 200, token = admin.token) =>
    r(path, { method, body, status, token });
  const initialSettings = await req("/settings");
  assert.equal((await req("/products")).length, 0);
  const catalogs = await req("/products/starter-catalogs");
  assert.equal(catalogs.length, 7);
  const all = new Map(catalogs.flatMap((c) => c.items.map((i) => [i.id, i])));
  assert.ok(all.size > 300);
  assert.ok([...all.values()].every((i) => !i.exists && i.name.length <= 100));
  const beer = catalogs
    .find((c) => c.id === "bar_restaurante")
    .items.find((i) => i.name === "Cerveja Heineken lata 350 ml");
  const weighed = catalogs
    .find((c) => c.id === "mercado")
    .items.find((i) => i.unitOfMeasure === "kg");
  const service = catalogs
    .find((c) => c.id === "oficina")
    .items.find((i) => i.itemType === "service");
  // Existing manually created equivalent must not be overwritten or reactivated.
  const manual = (
    await req(
      "/products",
      "POST",
      {
        name: "  cerveja heineken LATA 350 ML ",
        category: "minha_categoria",
        unitOfMeasure: "unidade",
        costPrice: 3,
        salePrice: 8,
        active: false,
      },
      201,
    )
  ).product;
  await req("/stock/add", "POST", { productId: manual.id, quantity: 7 }, 201);
  assert.ok(
    (await req("/products/starter-catalogs"))
      .find((c) => c.id === "bar_restaurante")
      .items.find((i) => i.id === beer.id).exists,
  );
  assert.deepEqual(
    await req("/products/starter-catalogs/import", "POST", {
      profile: "bar_restaurante",
      itemIds: [beer.id],
    }),
    { created: 0, skipped: 1 },
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "mercado", itemIds: [weighed.id, "fake"] },
    400,
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "__proto__", itemIds: [weighed.id] },
    400,
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "mercado", itemIds: [] },
    400,
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "mercado", itemIds: [service.id] },
    400,
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: {}, itemIds: [weighed.id] },
    400,
  );
  assert.equal((await req("/products")).length, 1);
  const responses = await Promise.all(
    Array.from({ length: 6 }, () =>
      req("/products/starter-catalogs/import", "POST", {
        profile: "mercado",
        itemIds: [weighed.id, weighed.id],
      }),
    ),
  );
  assert.equal(
    responses.reduce((sum, v) => sum + v.created, 0),
    1,
  );
  assert.equal(
    responses.reduce((sum, v) => sum + v.skipped, 0),
    5,
  );
  const renamed = "Item revisado " + Date.now();
  await req("/products/" + weighed.id, "PUT", {
    name: renamed,
    salePrice: 12,
    active: true,
  });
  await req("/stock/add", "POST", { productId: weighed.id, quantity: 5 }, 201);
  assert.deepEqual(
    await req("/products/starter-catalogs/import", "POST", {
      profile: "mercado",
      itemIds: [weighed.id],
    }),
    { created: 0, skipped: 1 },
  );
  const before = new Map((await req("/products")).map((p) => [p.id, p]));
  for (const catalog of catalogs)
    await req("/products/starter-catalogs/import", "POST", {
      profile: catalog.id,
      itemIds: catalog.items.map((i) => i.id),
    });
  const products = await req("/products");
  assert.equal(products.length, all.size);
  for (const p of products) {
    if (before.has(p.id)) {
      assert.deepEqual(p, before.get(p.id));
      continue;
    }
    assert.equal(Number(p.salePrice), 0);
    assert.equal(Number(p.costPrice), 0);
    assert.equal(Number(p.currentStock), 0);
    assert.equal(Number(p.minStockAlert), 0);
    assert.equal(p.active, false);
    assert.equal(p.barcode, null);
  }
  assert.ok(
    products.some(
      (p) =>
        p.id === service.id &&
        p.itemType === "service" &&
        p.unitOfMeasure === "servico",
    ),
  );
  assert.equal((await req("/products?lowStock=true")).length, 0);
  assert.equal((await req("/products/low-stock")).length, 0);
  assert.deepEqual(await req("/settings"), initialSettings);
  const user = async (role) => {
    const username = role + ".catalog";
    await req("/users", "POST", { username, password, role }, 201);
    return req("/auth/login", "POST", { company: slug, username, password });
  };
  const employee = await user("garcom");
  const manager = await user("gerente");
  await req(
    "/products/starter-catalogs",
    "GET",
    undefined,
    403,
    employee.token,
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "oficina", itemIds: [service.id] },
    403,
    employee.token,
  );
  await req("/products/starter-catalogs", "GET", undefined, 200, manager.token);
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "oficina", itemIds: [service.id] },
    200,
    manager.token,
  );
  await req("/settings", "PUT", {
    businessProfile: "hamburgueria",
    modules: { tables: true, kitchen: true, pizza: false },
  });
  const settings = await req("/settings");
  assert.equal(settings.businessProfileName, "Hamburgueria");
  assert.equal(settings.modules.kitchen, true);
  const after = (await req("/products")).map((p) => p.id);
  assert.deepEqual(
    after,
    products.map((p) => p.id),
  );
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
  );
  const sell = (id) => ({
    cash_register_id: cash.id,
    payment_method: "pix",
    items: [{ product_id: id, quantity: 1 }],
  });
  await req("/sales", "POST", sell(service.id), 400);
  await req("/products/" + service.id, "PUT", { active: true, salePrice: 30 });
  await req("/sales", "POST", sell(service.id), 201);
  assert.equal(Number((await req("/products/" + service.id)).currentStock), 0);
  await req("/sales", "POST", sell(weighed.id), 201);
  assert.equal(Number((await req("/products/" + weighed.id)).currentStock), 4);
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  assert.equal(
    (await req("/products", "GET", undefined, 200, second.token)).length,
    0,
  );
  await req("/products/" + weighed.id, "GET", undefined, 404, second.token);
  assert.ok(
    (
      await req(
        "/products/starter-catalogs",
        "GET",
        undefined,
        200,
        second.token,
      )
    ).every((c) => c.items.every((i) => !i.exists)),
  );
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "oficina", itemIds: [service.id] },
    200,
    second.token,
  );
  assert.equal(
    (await req("/products", "GET", undefined, 200, second.token)).length,
    1,
  );
  const secret = credentials();
  const session = async (username, password) => {
    const login = await req("/support/login", "POST", { username, password });
    return req(
      "/support/sessions",
      "POST",
      { company: slug },
      200,
      login.token,
    );
  };
  const master = await session("master.local", secret.master);
  const support = await session("support.local", secret.support);
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "oficina", itemIds: [service.id] },
    200,
    master.token,
  );
  await req("/products/starter-catalogs", "GET", undefined, 200, support.token);
  await req(
    "/products/starter-catalogs/import",
    "POST",
    { profile: "oficina", itemIds: [service.id] },
    403,
    support.token,
  );
  await req("/products/starter-catalogs", "GET", undefined, 401, "invalid");
  fs.mkdirSync("work/catalogs", { recursive: true });
  fs.writeFileSync(
    "work/catalogs/session.json",
    JSON.stringify({
      admin,
      employee,
      manager,
      master,
      support,
      second,
      slug,
      service,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${count()} verificações HTTP aprovadas: ${all.size} itens, sete perfis, importação concorrente, preservação de dados, permissões e isolamento.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
