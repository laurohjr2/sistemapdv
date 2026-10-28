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
const slug = "combos-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Combos teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
    token = login.token;
  const req = (p, method = "GET", body, status = 200, auth = token) =>
    r(p, { method, body, status, token: auth });
  const make = async (name, price = 10, unitOfMeasure = "unidade") =>
    (
      await req(
        "/products",
        "POST",
        {
          name,
          category: "comidas",
          unitOfMeasure,
          costPrice: 1,
          salePrice: price,
        },
        201,
      )
    ).product;
  const burger = await make("Lanche do combo", 10),
    drink = await make("Refrigerante do combo", 3),
    extra = await make("Queijo extra porção", 2),
    ingredient = await make("Queijo kg", 20, "kg");
  for (const p of [burger, drink])
    await req("/stock/add", "POST", { productId: p.id, quantity: 50 }, 201);
  await req(
    "/stock/add",
    "POST",
    { productId: ingredient.id, quantity: 10 },
    201,
  );
  await req("/recipes/" + extra.id, "PUT", {
    enabled: true,
    revision: 0,
    yieldQuantity: 1,
    ingredients: [{ productId: ingredient.id, quantity: 0.02 }],
  });
  const def = {
    name: "Combo Lanche e Refri",
    price: 9.99,
    active: true,
    revision: 0,
    components: [
      { productId: burger.id, quantity: 1 },
      { productId: drink.id, quantity: 1 },
    ],
    extras: [{ productId: extra.id, maxQuantity: 2 }],
  };
  let b = await req("/bundles", "POST", def, 201);
  assert.equal(b.revision, 1);
  const choice = () => ({
    id: b.id,
    revision: b.revision,
    extras: [{ productId: extra.id, quantity: 2 }],
  });
  const price = await req("/bundles/price", "POST", choice());
  assert.equal(price.unitPrice, 13.99);
  assert.equal(
    price.lines.reduce((n, l) => n + Math.round(l.unitPrice * 100), 0),
    1399,
  );
  assert.equal(price.lines.length, 4);
  await req(
    "/bundles/price",
    "POST",
    { ...choice(), extras: [{ productId: extra.id, quantity: 3 }] },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    { ...choice(), extras: [{ productId: burger.id, quantity: 1 }] },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    {
      ...choice(),
      extras: [
        { productId: extra.id, quantity: 1 },
        { productId: extra.id, quantity: 1 },
      ],
    },
    400,
  );
  await req("/bundles/" + b.id, "PUT", def, 409);
  await req(
    "/bundles",
    "POST",
    { ...def, components: [{ productId: ingredient.id, quantity: 1 }] },
    400,
  );
  await req(
    "/bundles",
    "POST",
    {
      ...def,
      components: [
        { productId: burger.id, quantity: 1 },
        { productId: burger.id, quantity: 1 },
      ],
    },
    400,
  );
  const cash = await req(
      "/cash-register/open",
      "POST",
      { opening_amount: 0 },
      201,
    ),
    stock = async (p) => Number((await req("/products/" + p.id)).currentStock);
  const sell = async (
    selection = choice(),
    quantity = 2,
    unit_price = 13.99,
    status = 201,
  ) =>
    req(
      "/sales",
      "POST",
      {
        cash_register_id: cash.id,
        payment_method: "pix",
        items: [
          { bundle: selection, quantity, unit_price, notes: "Sem mostarda" },
        ],
      },
      status,
    );
  await sell(choice(), 2, 1, 409);
  await sell(choice(), 0.5, 13.99, 400);
  const sale = await sell();
  assert.equal(Number(sale.total_amount), 27.98);
  assert.equal(sale.items.length, 4);
  assert.equal(new Set(sale.items.map((i) => i.bundle.groupId)).size, 1);
  assert.equal(
    sale.items.reduce((n, i) => n + Math.round(Number(i.total_price) * 100), 0),
    2798,
  );
  assert.equal(await stock(burger), 48);
  assert.equal(await stock(drink), 48);
  assert.equal(await stock(ingredient), 9.92);
  assert.ok(sale.items.every((i) => i.notes.includes("Sem mostarda")));
  await req("/sales/" + sale.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(await stock(burger), 50);
  assert.equal(await stock(ingredient), 10);
  const c = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Cliente Combo" },
      201,
    )
  ).comanda;
  const group = await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: choice(), quantity: 2, expectedUnitPrice: 13.99 },
    201,
  );
  assert.equal(group.items.length, 4);
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 27.98);
  await req(
    "/comandas/" + c.id + "/items/" + group.items[0].id,
    "DELETE",
    {},
    400,
  );
  await req(
    "/comandas/" + c.id + "/items/" + group.items[0].id,
    "PUT",
    { quantity: 3 },
    400,
  );
  await req("/settings", "PUT", { modules: { bundles: false } }, 400);
  await req(
    "/users",
    "POST",
    { username: "combo.attendant", password, role: "garcom" },
    201,
  );
  const attendant = (
    await req("/auth/login", "POST", {
      company: slug,
      username: "combo.attendant",
      password,
    })
  ).token;
  await req("/bundles", "POST", def, 403, attendant);
  await req(
    "/bundles/comandas/" + c.id + "/" + group.groupId,
    "DELETE",
    { restoreIngredients: true },
    403,
    attendant,
  );
  assert.equal((await req("/comandas/" + c.id)).items.length, 4);
  await req(
    "/bundles/comandas/" + c.id + "/" + group.groupId,
    "DELETE",
    {},
    200,
    attendant,
  );
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 0);
  assert.equal(await stock(burger), 50);
  assert.equal(await stock(ingredient), 9.92);
  await req(
    "/bundles/comandas/" + c.id + "/" + group.groupId,
    "DELETE",
    {},
    404,
  );
  // Old groups keep their original component allocation and ingredient snapshots.
  const old = await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: choice(), quantity: 1, expectedUnitPrice: 13.99 },
    201,
  );
  const oldChoice = choice();
  b = await req("/bundles/" + b.id, "PUT", {
    ...def,
    revision: b.revision,
    price: 19.99,
    components: [{ productId: drink.id, quantity: 2 }],
  });
  await sell(oldChoice, 1, 13.99, 409);
  await req("/bundles/comandas/" + c.id + "/" + old.groupId, "DELETE", {
    restoreIngredients: true,
  });
  assert.equal(await stock(burger), 50);
  assert.equal(await stock(ingredient), 9.92);
  const currentPrice = await req("/bundles/price", "POST", choice());
  assert.equal(currentPrice.unitPrice, 23.99);
  const closing = await req(
      "/bundles/comandas/" + c.id,
      "POST",
      { selection: choice(), quantity: 1, expectedUnitPrice: 23.99 },
      201,
    ),
    before = await stock(ingredient);
  await req("/comandas/" + c.id + "/close", "PUT", {
    paymentMethod: "dinheiro",
    paymentStatus: "pago",
  });
  assert.equal(await stock(ingredient), before);
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 23.99);
  // Exact cent allocation when units cannot share the price evenly.
  const tiny = await req(
    "/bundles",
    "POST",
    {
      ...def,
      name: "Combo centavo",
      price: 0.01,
      components: [{ productId: burger.id, quantity: 3 }],
      extras: [],
    },
    201,
  );
  const ts = await sell({ id: tiny.id, revision: tiny.revision }, 3, 0.01);
  assert.equal(Number(ts.total_amount), 0.03);
  assert.equal(
    ts.items.reduce((n, i) => n + Math.round(Number(i.total_price) * 100), 0),
    3,
  );
  assert.equal(await stock(burger), 41);
  await req("/sales/" + ts.id + "/cancel", "PUT", {});
  assert.equal(await stock(burger), 50);
  // Failed ingredient consumption rolls back ordinary components too.
  const beforeDrink = await stock(drink);
  await req("/products/" + ingredient.id, "PUT", { active: false });
  await sell(choice(), 1, 23.99, 400);
  assert.equal(await stock(drink), beforeDrink);
  await req("/products/" + ingredient.id, "PUT", { active: true });
  // Delivery sees the real components and waits for prepared extras.
  const ds = await sell(choice(), 1, 23.99);
  const delivery = await req(
    "/deliveries",
    "POST",
    {
      saleId: ds.id,
      customerName: "Cliente Combo Entrega",
      phone: "11999999999",
      address: {
        street: "Rua Combo",
        number: "10",
        district: "Centro",
        city: "São Paulo",
        state: "SP",
      },
    },
    201,
  );
  assert.equal(delivery.items.length, 4);
  assert.equal(Number(delivery.paidTotal), 23.99);
  let d = await req("/deliveries/" + delivery.id + "/status", "POST", {
    status: "preparing",
    revision: delivery.revision,
  });
  await req(
    "/deliveries/" + d.id + "/status",
    "POST",
    { status: "ready", revision: d.revision },
    409,
  );
  for (const item of ds.items.filter((i) => i.recipe))
    for (const status of ["preparando", "pronto"])
      await req("/recipes/kitchen/" + item.id, "PUT", { status });
  for (const status of ["ready", "dispatched", "delivered"])
    d = await req("/deliveries/" + d.id + "/status", "POST", {
      status,
      revision: d.revision,
      courierName: "Entregador Combo",
    });
  const otherToken = (
    await req("/auth/login", "POST", {
      company: slug + "-b",
      username: "catalog.admin",
      password,
    })
  ).token;
  assert.equal(
    (await req("/bundles", "GET", undefined, 200, otherToken)).length,
    0,
  );
  await req("/bundles/price", "POST", choice(), 400, otherToken);
  await req("/settings", "PUT", { modules: { bundles: false } });
  await req("/bundles/price", "POST", choice(), 403);
  await req("/settings", "PUT", { modules: { bundles: true } });
  // The modules are configurable outside food profiles too.
  await req(
    "/settings",
    "PUT",
    { businessProfile: "mercado" },
    200,
    otherToken,
  );
  await req("/bundles", "GET", undefined, 403, otherToken);
  await req(
    "/settings",
    "PUT",
    { modules: { bundles: true, delivery: true } },
    200,
    otherToken,
  );
  assert.equal(
    (await req("/bundles", "GET", undefined, 200, otherToken)).length,
    0,
  );
  assert.equal(
    (await req("/deliveries", "GET", undefined, 200, otherToken)).length,
    0,
  );
  // Price changes to an optional extra invalidate a cart even if the menu revision stays unchanged.
  const savedIngredient = await stock(ingredient),
    savedDrink = await stock(drink);
  await req("/products/" + extra.id, "PUT", { salePrice: 3 });
  await sell(choice(), 1, 23.99, 409);
  assert.equal(await stock(ingredient), savedIngredient);
  await req("/products/" + extra.id, "PUT", { salePrice: 2 });
  // A failed second component must roll back the first item, account total and stock.
  const atomic = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Combo atômico" },
      201,
    )
  ).comanda;
  await req("/stock/adjust", "POST", { productId: drink.id, newQuantity: 1 });
  await req(
    "/bundles/comandas/" + atomic.id,
    "POST",
    { selection: choice(), quantity: 1, expectedUnitPrice: 23.99 },
    400,
  );
  assert.equal((await req("/comandas/" + atomic.id)).items.length, 0);
  assert.equal(Number((await req("/comandas/" + atomic.id)).totalValue), 0);
  assert.equal(await stock(drink), 1);
  await req("/stock/adjust", "POST", {
    productId: drink.id,
    newQuantity: savedDrink,
  });
  const mixed = await req(
    "/sales",
    "POST",
    {
      cash_register_id: cash.id,
      payment_method: "pix",
      items: [
        { bundle: choice(), quantity: 1, unit_price: 23.99 },
        { product_id: extra.id, quantity: 1 },
      ],
    },
    201,
  );
  assert.equal(Number(mixed.total_amount), 25.99);
  assert.equal(
    await stock(ingredient),
    Number((savedIngredient - 0.06).toFixed(3)),
  );
  await req("/sales/" + mixed.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  // Concurrent combo orders cannot oversell a shared physical component.
  const rare = await make("Única unidade para combo");
  await req("/stock/add", "POST", { productId: rare.id, quantity: 1 }, 201);
  const limited = await req(
    "/bundles",
    "POST",
    {
      ...def,
      name: "Combo limitado",
      price: 1,
      components: [{ productId: rare.id, quantity: 1 }],
      extras: [],
    },
    201,
  );
  const results = await Promise.all([
    sell({ id: limited.id, revision: limited.revision }, 1, 1, [201, 400]),
    sell({ id: limited.id, revision: limited.revision }, 1, 1, [201, 400]),
  ]);
  assert.equal(results.filter((x) => x.responseStatus === 201).length, 1);
  assert.equal(await stock(rare), 0);
  await req(
    "/sales/" + results.find((x) => x.responseStatus === 201).id + "/cancel",
    "PUT",
    {},
  );
  // Lot-controlled ingredients consumed by extras follow FEFO and return to quarantine.
  await req("/settings", "PUT", { modules: { market: true } });
  const tracked = await make("Ingrediente de adicional com lote", 20, "kg"),
    portion = await make("Porção com lote", 4);
  await req("/market/products/" + tracked.id + "/control", "POST", {
    enabled: true,
  });
  await req(
    "/stock/add",
    "POST",
    {
      productId: tracked.id,
      quantity: 5,
      batchNumber: "COMBO-01",
      expirationDate: "2099-01-01",
    },
    201,
  );
  await req("/recipes/" + portion.id, "PUT", {
    enabled: true,
    revision: 0,
    yieldQuantity: 1,
    ingredients: [{ productId: tracked.id, quantity: 0.1 }],
  });
  const lotBundle = await req(
    "/bundles",
    "POST",
    {
      ...def,
      name: "Combo com adicional de lote",
      price: 5,
      components: [{ productId: drink.id, quantity: 1 }],
      extras: [{ productId: portion.id, maxQuantity: 1 }],
    },
    201,
  );
  const lotSale = await sell(
    {
      id: lotBundle.id,
      revision: lotBundle.revision,
      extras: [{ productId: portion.id, quantity: 1 }],
    },
    1,
    9,
  );
  await req("/sales/" + lotSale.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(await stock(tracked), 5);
  assert.equal(
    (await req("/products")).find((p) => p.id === tracked.id).availableStock,
    4.9,
  );
  if (process.env.PDV_BUNDLE_BROWSER_FIXTURE)
    fs.writeFileSync(
      process.env.PDV_BUNDLE_BROWSER_FIXTURE,
      JSON.stringify({
        company: slug,
        username: "catalog.admin",
        password,
        bundleId: b.id,
        burgerId: burger.id,
        drinkId: drink.id,
        extraId: extra.id,
        ingredientId: ingredient.id,
      }),
      { mode: 0o600 },
    );
  console.log(
    count() +
      " verificações de combos aprovadas: centavos, adicionais, venda, comanda, snapshots, cancelamento, ingredientes, cozinha, entrega, permissões e isolamento.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
