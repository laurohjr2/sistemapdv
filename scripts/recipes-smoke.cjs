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
const slug = "receitas-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Receitas teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
  const token = (
    await r("/auth/login", {
      method: "POST",
      body: { company: slug, username: "catalog.admin", password },
    })
  ).token;
  const req = (path, method = "GET", body, status = 200, auth = token) =>
    r(path, { method, body, status, token: auth });
  const make = async (name, unit = "unidade", salePrice = 10) =>
    (
      await req(
        "/products",
        "POST",
        {
          name,
          category: "comidas",
          unitOfMeasure: unit,
          costPrice: 2,
          salePrice,
        },
        201,
      )
    ).product;
  const beef = await make("Carne kg", "kg"),
    bread = await make("Pão unidade"),
    burger = await make("Hambúrguer preparado"),
    other = await make("Outro preparado");
  const stock = async (p) =>
    (await req("/products")).find((x) => x.id === p.id);
  await req("/stock/add", "POST", { productId: beef.id, quantity: 10 }, 201);
  await req("/stock/add", "POST", { productId: bread.id, quantity: 30 }, 201);
  let definition = {
    enabled: true,
    yieldQuantity: 10,
    revision: 0,
    ingredients: [
      { productId: beef.id, quantity: 1 },
      { productId: bread.id, quantity: 10 },
    ],
    notes: "Receita teste",
  };
  let recipe = await req("/recipes/" + burger.id, "PUT", definition);
  assert.equal(recipe.revision, 1);
  assert.equal((await stock(burger)).recipeEnabled, true);
  assert.equal(Number((await stock(burger)).currentStock), 0);
  assert.equal((await stock(burger)).availableStock, 30);
  await req("/recipes/" + burger.id, "PUT", definition, 409);
  await req(
    "/recipes/" + other.id,
    "PUT",
    { ...definition, ingredients: [{ productId: burger.id, quantity: 1 }] },
    400,
  );
  await req(
    "/recipes/" + burger.id,
    "PUT",
    {
      ...definition,
      revision: 1,
      ingredients: [{ productId: burger.id, quantity: 1 }],
    },
    400,
  );
  await req(
    "/recipes/" + other.id,
    "PUT",
    { ...definition, ingredients: [{ productId: bread.id, quantity: 0 }] },
    400,
  );
  await req("/stock/add", "POST", { productId: burger.id, quantity: 1 }, 400);
  await req("/products/" + beef.id, "PUT", { unitOfMeasure: "litro" }, 400);
  await req("/settings", "PUT", { modules: { recipes: false } }, 400);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
  );
  const sell = async (items, status = 201) =>
    await req(
      "/sales",
      "POST",
      { cash_register_id: cash.id, payment_method: "dinheiro", items },
      status,
    );
  const s = await sell([{ product_id: burger.id, quantity: 2 }]);
  const detail = await req("/sales/" + s.id);
  assert.equal(
    detail.items[0].recipe.consumed.find((i) => i.productId === beef.id)
      .quantity,
    0.2,
  );
  assert.equal(detail.items[0].stockTracked, false);
  assert.equal(Number((await stock(beef)).currentStock), 9.8);
  assert.equal(Number((await stock(bread)).currentStock), 28);
  await req("/settings", "PUT", { modules: { kitchen: false } }, 400);
  let kitchen = await req("/recipes/kitchen");
  assert.ok(kitchen.some((i) => i.sale_id === s.id));
  for (const status of ["preparando", "pronto", "entregue"])
    await req("/recipes/kitchen/" + detail.items[0].id, "PUT", { status });
  await req("/sales/" + s.id + "/cancel", "PUT", {});
  assert.equal(Number((await stock(beef)).currentStock), 9.8);
  await req(
    "/sales/" + s.id + "/cancel",
    "PUT",
    { restoreIngredients: true },
    400,
  );
  const returned = await sell([{ product_id: burger.id, quantity: 1 }]);
  await req("/sales/" + returned.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(beef)).currentStock), 9.8);
  // Ordinary ingredient + recipe share the same locked row, no lost update.
  const mixed = await sell([
    { product_id: beef.id, quantity: 0.5 },
    { product_id: burger.id, quantity: 1 },
  ]);
  assert.equal(Number((await stock(beef)).currentStock), 9.2);
  await req("/sales/" + mixed.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  // Insufficient ingredient rolls back every line and payment.
  await sell(
    [
      { product_id: bread.id, quantity: 1 },
      { product_id: burger.id, quantity: 100 },
    ],
    400,
  );
  assert.equal(Number((await stock(bread)).currentStock), 28);
  const c = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Receita cliente" },
      201,
    )
  ).comanda;
  const item = (
    await req(
      "/comandas/" + c.id + "/items",
      "POST",
      { productId: burger.id, quantity: 2 },
      201,
    )
  ).item;
  assert.equal(item.preparationStatus, "pendente");
  assert.ok(item.recipe);
  recipe = await req("/recipes/" + burger.id, "PUT", {
    ...definition,
    revision: recipe.revision,
    ingredients: [
      { productId: beef.id, quantity: 2 },
      { productId: bread.id, quantity: 10 },
    ],
  });
  await req("/comandas/" + c.id + "/items/" + item.id, "PUT", { quantity: 3 });
  let cdetail = await req("/comandas/" + c.id);
  assert.equal(
    cdetail.items[0].recipe.consumed.find((i) => i.productId === beef.id)
      .quantity,
    0.3,
  );
  assert.equal(cdetail.items[0].recipe.plan.revision, 1);
  await req("/comandas/" + c.id + "/items/" + item.id, "PUT", {
    quantity: 2,
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(beef)).currentStock), 9.6);
  await req("/comandas/" + c.id + "/items/" + item.id, "DELETE", {});
  assert.equal(Number((await stock(beef)).currentStock), 9.6);
  const ci = (
    await req(
      "/comandas/" + c.id + "/items",
      "POST",
      { productId: burger.id, quantity: 1 },
      201,
    )
  ).item;
  assert.equal(ci.recipe.plan.revision, 2);
  await req("/comandas/" + c.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(beef)).currentStock), 9.6);
  const t = await req(
    "/tickets",
    "POST",
    { productId: burger.id, quantity: 1 },
    201,
  );
  assert.equal(Number((await stock(beef)).currentStock), 9.4);
  await req("/tickets/" + t.ticket_number + "/cancel", "POST", {
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(beef)).currentStock), 9.6);
  // Fractional portions round up to the next 0.001 of physical input.
  recipe = await req("/recipes/" + burger.id, "PUT", {
    ...definition,
    revision: recipe.revision,
    yieldQuantity: 3,
    ingredients: [{ productId: beef.id, quantity: 1 }],
  });
  const frac = await sell([{ product_id: burger.id, quantity: 1 }]);
  assert.equal(
    (await req("/sales/" + frac.id)).items[0].recipe.consumed[0].quantity,
    0.334,
  );
  await req("/sales/" + frac.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  // Lot-controlled ingredients: expired lots cannot be consumed; returns are quarantined.
  const lot = await make("Queijo lote", "kg");
  let cfg = (await req("/settings")).modules;
  await req("/settings", "PUT", { modules: { ...cfg, market: true } });
  await req("/market/products/" + lot.id + "/control", "POST", {
    enabled: true,
  });
  await req(
    "/stock/add",
    "POST",
    {
      productId: lot.id,
      quantity: 1,
      batchNumber: "VALID",
      expirationDate: "2099-01-01",
    },
    201,
  );
  recipe = await req("/recipes/" + burger.id, "PUT", {
    ...definition,
    revision: recipe.revision,
    yieldQuantity: 1,
    ingredients: [{ productId: lot.id, quantity: 0.1 }],
  });
  const lotsale = await sell([{ product_id: burger.id, quantity: 1 }]);
  await req("/sales/" + lotsale.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(lot)).currentStock), 1);
  assert.equal((await stock(lot)).availableStock, 0.9);
  await req(
    "/market/products/" + burger.id + "/control",
    "POST",
    { enabled: true },
    404,
  );
  // Concurrent carts share ingredient locks and cannot oversell.
  const rare = await make("Insumo limitado"),
    last = await make("Última porção");
  await req("/stock/add", "POST", { productId: rare.id, quantity: 1 }, 201);
  await req("/recipes/" + last.id, "PUT", {
    ...definition,
    yieldQuantity: 1,
    ingredients: [{ productId: rare.id, quantity: 1 }],
  });
  const attempts = await Promise.all([
    sell([{ product_id: last.id, quantity: 1 }], [201, 400]),
    sell([{ product_id: last.id, quantity: 1 }], [201, 400]),
  ]);
  assert.equal(attempts.filter((x) => x.responseStatus === 201).length, 1);
  assert.equal(Number((await stock(rare)).currentStock), 0);
  // Roles, tenant boundary and inactive ingredient availability.
  await req(
    "/users",
    "POST",
    { username: "recipe.attendant", password, role: "garcom" },
    201,
  );
  const attendant = (
    await req("/auth/login", "POST", {
      company: slug,
      username: "recipe.attendant",
      password,
    })
  ).token;
  await req(
    "/recipes/" + burger.id,
    "PUT",
    { ...definition, revision: recipe.revision },
    403,
    attendant,
  );
  const ca = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Permissão teste" },
      201,
    )
  ).comanda;
  const ia = (
    await req(
      "/comandas/" + ca.id + "/items",
      "POST",
      { productId: burger.id, quantity: 1 },
      201,
    )
  ).item;
  await req(
    "/comandas/" + ca.id + "/items/" + ia.id,
    "DELETE",
    { restoreIngredients: true },
    403,
    attendant,
  );
  await req("/comandas/" + ca.id + "/cancel", "PUT", {});
  const tokenB = (
    await req("/auth/login", "POST", {
      company: slug + "-b",
      username: "catalog.admin",
      password,
    })
  ).token;
  assert.equal(
    (await req("/recipes", "GET", undefined, 200, tokenB)).length,
    0,
  );
  await req("/recipes/" + burger.id, "PUT", definition, 400, tokenB);
  await req("/products/" + lot.id, "PUT", { active: false });
  assert.equal((await stock(burger)).availableStock, 0);
  recipe = await req("/recipes/" + burger.id, "PUT", {
    enabled: false,
    yieldQuantity: 1,
    revision: recipe.revision,
    ingredients: [{ productId: lot.id, quantity: 0.1 }],
  });
  assert.equal((await stock(burger)).recipeEnabled, false);
  await req(
    "/recipes/" + burger.id,
    "PUT",
    {
      enabled: true,
      yieldQuantity: 1,
      revision: recipe.revision,
      ingredients: [{ productId: lot.id, quantity: 0.1 }],
    },
    400,
  );
  // Disabling with an inactive ingredient must remain possible.
  // Closing an account must not consume again, and cancelling an older sale
  // must restore its original composition after recipe changes.
  const breadBefore = Number((await stock(bread)).currentStock);
  recipe = await req("/recipes/" + burger.id, "PUT", {
    ...definition,
    revision: recipe.revision,
    yieldQuantity: 1,
    ingredients: [{ productId: bread.id, quantity: 1 }],
  });
  const supplier = await req(
    "/commerce/suppliers",
    "POST",
    { name: "Fornecedor de ingredientes" },
    201,
  );
  await req(
    "/commerce/purchases",
    "POST",
    {
      supplierId: supplier.id,
      lines: [{ productId: burger.id, quantity: 1, unitCost: 2 }],
    },
    400,
  );
  const original = await sell([{ product_id: burger.id, quantity: 1 }]);
  recipe = await req("/recipes/" + burger.id, "PUT", {
    ...definition,
    revision: recipe.revision,
    yieldQuantity: 1,
    ingredients: [{ productId: bread.id, quantity: 2 }],
  });
  await req("/sales/" + original.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(Number((await stock(bread)).currentStock), breadBefore);
  const closing = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Sem baixa dupla" },
      201,
    )
  ).comanda;
  await req(
    "/comandas/" + closing.id + "/items",
    "POST",
    { productId: burger.id, quantity: 1 },
    201,
  );
  await req("/comandas/" + closing.id + "/close", "PUT", {
    paymentMethod: "dinheiro",
    paymentStatus: "pago",
  });
  assert.equal(Number((await stock(bread)).currentStock), breadBefore - 2);
  if (process.env.PDV_RECIPE_BROWSER_FIXTURE) {
    fs.writeFileSync(
      process.env.PDV_RECIPE_BROWSER_FIXTURE,
      JSON.stringify({
        company: slug,
        username: "catalog.admin",
        password,
        burgerId: burger.id,
        breadId: bread.id,
      }),
      { mode: 0o600 },
    );
  }
  console.log(
    "Recipe smoke passed: " +
      count() +
      " HTTP checks; stock, immutable snapshots, cancellation, lots, concurrency, permissions and isolation.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
