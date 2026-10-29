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
const slug = "pizza-combo-" + Date.now();
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
  });
  const req = (p, method = "GET", body, status = 200, auth = login.token) =>
    r(p, { method, body, status, token: auth });
  await req("/settings", "PUT", {
    businessProfile: "pizzaria",
    modules: {
      pizza: true,
      bundles: true,
      tables: true,
      kitchen: true,
      recipes: true,
      delivery: true,
    },
  });
  const make = async (name, salePrice = 1, unitOfMeasure = "unidade") =>
    (
      await req(
        "/products",
        "POST",
        { name, category: "outros", salePrice, costPrice: 1, unitOfMeasure },
        201,
      )
    ).product;
  const base = await make("Pizza base grande"),
    smallBase = await make("Pizza base broto"),
    drink = await make("Refrigerante", 5),
    portion = await make("Porção extra", 3),
    flour = await make("Farinha kg", 10, "kg");
  for (const p of [base, smallBase, drink])
    await req("/stock/add", "POST", { productId: p.id, quantity: 100 }, 201);
  await req("/stock/add", "POST", { productId: flour.id, quantity: 10 }, 201);
  await req("/recipes/" + portion.id, "PUT", {
    enabled: true,
    revision: 0,
    yieldQuantity: 1,
    ingredients: [{ productId: flour.id, quantity: 0.1 }],
  });
  const uid = () => crypto.randomUUID(),
    large = uid(),
    small = uid(),
    calabresa = uid(),
    queijo = uid(),
    crust = uid(),
    extra = uid();
  let menu = await req("/pizza/catalog");
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    pricingRule: "highest",
    sizes: [
      {
        id: large,
        name: "Grande",
        active: true,
        productId: base.id,
        maxFlavors: 2,
        slices: 8,
      },
      {
        id: small,
        name: "Broto",
        active: true,
        productId: smallBase.id,
        maxFlavors: 1,
        slices: 4,
      },
    ],
    flavors: [
      {
        id: calabresa,
        name: "Calabresa",
        active: true,
        prices: { [large]: 30, [small]: 20 },
      },
      {
        id: queijo,
        name: "Queijo",
        active: true,
        prices: { [large]: 40, [small]: 25 },
      },
    ],
    crusts: [
      {
        id: crust,
        name: "Requeijão",
        active: true,
        prices: { [large]: 6, [small]: 3 },
      },
    ],
    extras: [
      {
        id: extra,
        name: "Bacon",
        active: true,
        prices: { [large]: 2.5, [small]: 1 },
      },
    ],
  });
  const def = {
    name: "Pizza grande com refrigerante",
    price: 55,
    active: true,
    revision: 0,
    components: [
      { productId: base.id, quantity: 1, pizzaSizeId: large },
      { productId: drink.id, quantity: 1 },
    ],
    extras: [{ productId: portion.id, maxQuantity: 2 }],
  };
  const b = await req("/bundles", "POST", def, 201);
  const pizza = () => ({
    catalogRevision: menu.revision,
    sizeId: large,
    flavorIds: [calabresa, queijo],
    crustId: crust,
    extras: [{ id: extra, quantity: 2 }],
  });
  const choice = () => ({
    id: b.id,
    revision: b.revision,
    pizzas: [{ slot: 0, pizza: pizza() }],
    extras: [{ productId: portion.id, quantity: 1 }],
  });
  let quoted = await req("/bundles/price", "POST", choice());
  assert.equal(quoted.unitPrice, 69);
  assert.equal(quoted.lines[0].pizzaSurcharge, 11);
  assert.equal(quoted.lines[0].pizza.flavorPrice, 40);
  assert.equal(
    quoted.lines.reduce((n, l) => n + Math.round(l.unitPrice * 100), 0),
    6900,
  );
  await req("/bundles/price", "POST", { ...choice(), pizzas: [] }, 400);
  await req(
    "/bundles/price",
    "POST",
    { ...choice(), pizzas: [{ slot: 1, pizza: pizza() }] },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    {
      ...choice(),
      pizzas: [
        { slot: 0, pizza: pizza() },
        { slot: 0, pizza: pizza() },
      ],
    },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    { ...choice(), pizzas: [{ slot: -1, pizza: pizza() }] },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    {
      ...choice(),
      pizzas: [{ slot: 0, pizza: { ...pizza(), sizeId: small } }],
    },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    {
      ...choice(),
      pizzas: [{ slot: 0, pizza: { ...pizza(), catalogRevision: undefined } }],
    },
    400,
  );
  await req(
    "/bundles/price",
    "POST",
    {
      ...choice(),
      pizzas: [
        { slot: 0, pizza: { ...pizza(), flavorIds: [calabresa, calabresa] } },
      ],
    },
    400,
  );
  await req(
    "/bundles",
    "POST",
    {
      ...def,
      components: [{ productId: base.id, quantity: 1, pizzaSizeId: small }],
    },
    400,
  );
  await req(
    "/bundles",
    "POST",
    { ...def, components: [{ productId: base.id, quantity: 1 }] },
    400,
  );
  await req(
    "/bundles",
    "POST",
    { ...def, extras: [{ productId: base.id, maxQuantity: 1 }] },
    400,
  );
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req("/bundles/price", "POST", choice(), 400, second.token);
  const stock = async (p) =>
    Number((await req("/products/" + p.id)).currentStock);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
  );
  const sell = (
    selection = choice(),
    quantity = 2,
    unit_price = 69,
    status = 201,
  ) =>
    req(
      "/sales",
      "POST",
      {
        cash_register_id: cash.id,
        payment_method: "pix",
        items: [
          { bundle: selection, quantity, unit_price, notes: "Cortar em oito" },
        ],
      },
      status,
    );
  await sell(choice(), 2, 55, 409);
  await sell(choice(), 0.5, 69, 400);
  let sale = await sell();
  assert.equal(Number(sale.total_amount), 138);
  assert.equal(sale.items.filter((i) => i.pizza).length, 1);
  assert.equal(
    sale.items[0].bundle.component.pizza.description,
    sale.items[0].pizza.description,
  );
  assert.match(sale.items[0].pizza.description, /1\/2 Calabresa/);
  assert.equal(
    sale.items.reduce((n, l) => n + Math.round(Number(l.total_price) * 100), 0),
    13800,
  );
  assert.equal(await stock(base), 98);
  assert.equal(await stock(drink), 98);
  assert.equal(await stock(flour), 9.8);
  let kitchen = await req("/pizza/kitchen");
  assert.ok(
    kitchen.some(
      (i) => i.sale_id === sale.id && i.pizza.crust.name === "Requeijão",
    ),
  );
  const delivery = await req(
    "/deliveries",
    "POST",
    {
      saleId: sale.id,
      customerName: "Cliente sintético",
      phone: "11999999999",
      address: {
        street: "Rua de teste",
        number: "10",
        district: "Centro",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001-000",
      },
    },
    201,
  );
  assert.match(delivery.items[0].name, /Borda: Requeijão/);
  fs.mkdirSync("work/mark22", { recursive: true });
  fs.writeFileSync(
    "work/mark22/entrega.pdf",
    await req("/deliveries/" + delivery.id + "/pdf"),
  );
  await req("/sales/" + sale.id + "/cancel", "PUT", {
    restoreIngredients: true,
  });
  assert.equal(await stock(base), 100);
  assert.equal(await stock(flour), 10);
  const table = (
    await req("/tables", "POST", { tableNumber: 1, capacity: 4 }, 201)
  ).table;
  const c = (
    await req(
      "/comandas",
      "POST",
      { type: "mesa", tableId: table.id, customerName: "Cliente combo" },
      201,
    )
  ).comanda;
  let group = await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: choice(), quantity: 2, expectedUnitPrice: 69 },
    201,
  );
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 138);
  assert.equal(group.items.filter((i) => i.pizza).length, 1);
  assert.equal(Number(group.items[0].quantity), 2);
  await req(
    "/comandas/" + c.id + "/items/" + group.items[0].id,
    "PUT",
    { quantity: 1 },
    400,
  );
  await req(
    "/comandas/" + c.id + "/items/" + group.items[0].id,
    "DELETE",
    {},
    400,
  );
  const queued = (await req("/queue")).items;
  assert.ok(queued.some((i) => i.id === group.items[0].id && i.pizza));
  await req("/bundles/comandas/" + c.id + "/" + group.groupId, "DELETE", {
    restoreIngredients: true,
  });
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 0);
  assert.equal(await stock(base), 100);
  assert.equal(await stock(flour), 10);
  await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: choice(), quantity: 101, expectedUnitPrice: 69 },
    400,
  );
  await req(
    "/bundles/comandas/" + c.id,
    "POST",
    {
      selection: {
        ...choice(),
        extras: [{ productId: portion.id, quantity: 2 }],
      },
      quantity: 99,
      expectedUnitPrice: 72,
    },
    400,
  ); // portion needs more flour; atomic rollback
  assert.equal(Number((await req("/comandas/" + c.id)).totalValue), 0);
  assert.equal(await stock(base), 100);
  const oldChoice = choice();
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) => ({ ...f, name: f.name + " atual" })),
  });
  await req("/bundles/price", "POST", oldChoice, 409);
  await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: oldChoice, quantity: 1, expectedUnitPrice: 69 },
    409,
  );
  quoted = await req("/bundles/price", "POST", choice());
  assert.match(quoted.lines[0].name, /Calabresa atual/);
  group = await req(
    "/bundles/comandas/" + c.id,
    "POST",
    { selection: choice(), quantity: 1, expectedUnitPrice: 69 },
    201,
  );
  const closed = (
    await req("/tables/" + table.id + "/close-comanda", "POST", {
      paymentMethod: "pix",
      paymentStatus: "pago",
      payments: [{ method: "pix", amount: 69 }],
    })
  ).comanda;
  assert.equal(Number(closed.finalValue), 69);
  fs.writeFileSync(
    "work/mark22/comanda.pdf",
    await req("/print/comanda/" + c.id),
  );
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) => ({ ...f, name: "Renomeado " + f.name })),
  });
  const stored = await req("/comandas/" + c.id);
  assert.match(
    stored.items.find((i) => i.pizza).pizza.description,
    /Calabresa atual/,
  );
  assert.ok(
    !stored.items.find((i) => i.pizza).pizza.description.includes("Renomeado"),
  );
  const stale = choice();
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    pricingRule: "average",
  });
  await req("/bundles/price", "POST", stale, 409);
  const averaged = await req("/bundles/price", "POST", choice());
  assert.equal(averaged.unitPrice, 69);
  assert.equal(averaged.lines[0].pizza.flavorPrice, 35);
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) => ({ ...f, active: f.id !== queijo })),
  });
  await req("/bundles/price", "POST", choice(), 400);
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) => ({ ...f, active: true })),
  });
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    crusts: menu.crusts.map((c) => ({
      ...c,
      prices: { ...c.prices, [large]: 7 },
    })),
  });
  assert.equal((await req("/bundles/price", "POST", choice())).unitPrice, 70);
  await sell(choice(), 1, 69, 409);
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    crusts: menu.crusts.map((c) => ({
      ...c,
      prices: { ...c.prices, [large]: 6 },
    })),
  });
  // Each physical slot may have a different assembly; repeat the entire choice per combo.
  const twins = await req(
    "/bundles",
    "POST",
    {
      ...def,
      name: "Duas pizzas e refrigerante",
      price: 90,
      components: [
        { productId: base.id, quantity: 2, pizzaSizeId: large },
        { productId: drink.id, quantity: 1 },
      ],
    },
    201,
  );
  const twinChoice = {
    id: twins.id,
    revision: twins.revision,
    pizzas: [
      { slot: 0, pizza: pizza() },
      {
        slot: 1,
        pizza: {
          ...pizza(),
          flavorIds: [calabresa],
          crustId: null,
          extras: [],
        },
      },
    ],
    extras: [],
  };
  const twinPrice = await req("/bundles/price", "POST", twinChoice);
  assert.equal(twinPrice.unitPrice, 101);
  assert.equal(twinPrice.lines.filter((l) => l.pizza).length, 2);
  assert.notEqual(twinPrice.lines[0].name, twinPrice.lines[1].name);
  await req(
    "/users",
    "POST",
    { username: "pizza.attendant", password, role: "garcom" },
    201,
  );
  const employee = await req("/auth/login", "POST", {
    company: slug,
    username: "pizza.attendant",
    password,
  });
  await req("/access/users/" + employee.user.id, "PUT", {
    mode: "restricted",
    template: "none",
    permissions: ["bundles.view", "products.read"],
    revision: 0,
    reason: "Verificar montagem restrita",
  });
  await req("/bundles/price", "POST", choice(), 403, employee.token);
  const a = await req("/access/users/" + employee.user.id);
  await req("/access/users/" + employee.user.id, "PUT", {
    mode: "restricted",
    template: "none",
    permissions: ["bundles.view", "pizza.view", "products.read"],
    revision: a.access.revision,
    reason: "Permitir montagem de pizzas",
  });
  await req("/bundles/price", "POST", choice(), 200, employee.token);
  fs.writeFileSync(
    "work/mark22/session.json",
    JSON.stringify({
      login,
      second,
      employee,
      password,
      slug,
      base,
      smallBase,
      drink,
      portion,
      flour,
      menu,
      b,
      twins,
      table,
      comandaId: c.id,
      large,
      small,
      calabresa,
      queijo,
      crust,
      extra,
      choice: choice(),
      twinChoice,
    }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações de pizzas nos combos aprovadas: preço fixo, complementos, versões, estoque, cozinha, entrega, fechamento, snapshots, isolamento e permissões.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
