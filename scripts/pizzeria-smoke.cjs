// Use only the disposable commercial test project. No customer installation is touched.
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs");
const { client, credentials } = require("./testing/commercial-context.cjs");
const { request: r, count } = client(),
  secret = credentials(),
  stamp = Date.now();
(async () => {
  const admin = (
    await r("/auth/login", {
      method: "POST",
      body: {
        company: "demo",
        username: "admin.local",
        password: secret.admin,
      },
    })
  ).token;
  const req = (path, method = "GET", body, status = 200, token = admin) =>
    r(path, { method, body, status, token });
  await req("/settings", "PUT", {
    businessProfile: "pizzaria",
    modules: { pizza: true, kitchen: true, tables: true },
  });
  // Complete previous synthetic POS fixtures before testing module switches.
  for (const item of await req("/pizza/kitchen")) {
    let status = item.preparationStatus;
    while (status !== "entregue") {
      status = {
        pendente: "preparando",
        preparando: "pronto",
        pronto: "entregue",
      }[status];
      await req("/pizza/kitchen/" + item.id, "PUT", { status });
    }
  }
  const currentCash = await req("/cash-register/status");
  if (currentCash.is_open)
    await req("/cash-register/close", "POST", { closing_amount: 0 });
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 100 },
    201,
  );
  const { product } = await req(
    "/products",
    "POST",
    {
      name: "Base de pizza teste " + stamp,
      category: "pizzas",
      unitOfMeasure: "unidade",
      costPrice: 5,
      salePrice: 1,
    },
    201,
  );
  await req("/stock/add", "POST", { productId: product.id, quantity: 20 }, 201);
  const id = () => crypto.randomUUID(),
    large = id(),
    small = id(),
    calabresa = id(),
    mussarela = id(),
    borda = id(),
    extra = id();
  let menu = {
    ...(await req("/pizza/catalog")),
    pricingRule: "highest",
    sizes: [
      {
        id: large,
        name: "Grande",
        active: true,
        productId: product.id,
        maxFlavors: 2,
        slices: 8,
      },
      {
        id: small,
        name: "Broto",
        active: true,
        productId: product.id,
        maxFlavors: 1,
        slices: 4,
      },
    ],
    flavors: [
      {
        id: calabresa,
        name: "Calabresa",
        active: true,
        prices: { [large]: 50, [small]: 25 },
      },
      {
        id: mussarela,
        name: "Mussarela",
        active: true,
        prices: { [large]: 60, [small]: 30 },
      },
    ],
    crusts: [
      {
        id: borda,
        name: "Catupiry",
        active: true,
        prices: { [large]: 8, [small]: 4 },
      },
    ],
    extras: [
      {
        id: extra,
        name: "Queijo extra",
        active: true,
        prices: { [large]: 5, [small]: 2 },
      },
    ],
  };
  const before = menu.revision;
  menu = await req("/pizza/catalog", "PUT", menu);
  assert.equal(menu.revision, before + 1);
  await req("/pizza/catalog", "PUT", { ...menu, revision: before }, 409);
  await req(
    "/pizza/catalog",
    "PUT",
    { ...menu, sizes: [{ ...menu.sizes[0], maxFlavors: 9 }] },
    400,
  );
  await req(
    "/pizza/catalog",
    "PUT",
    { ...menu, flavors: [{ ...menu.flavors[0], prices: { [large]: -1 } }] },
    400,
  );
  const selection = {
    sizeId: large,
    flavorIds: [calabresa, mussarela],
    crustId: borda,
    extras: [{ id: extra, quantity: 2 }],
  };
  await req("/pizza/catalog", "PUT", { ...menu, sizes: [null] }, 400);
  await req("/pizza/price", "POST", { ...selection, extras: [null] }, 400);
  await req(
    "/pizza/price",
    "POST",
    { ...selection, catalogRevision: menu.revision - 1 },
    409,
  );
  assert.equal((await req("/pizza/price", "POST", selection)).unitPrice, 78);
  assert.equal(
    (await req("/pizza/price", "POST", { ...selection, unitPrice: 0.01 }))
      .unitPrice,
    78,
  );
  await req(
    "/pizza/price",
    "POST",
    { ...selection, flavorIds: [calabresa, calabresa] },
    400,
  );
  await req("/pizza/price", "POST", { ...selection, sizeId: small }, 400);
  await req(
    "/pizza/price",
    "POST",
    { ...selection, extras: [{ id: extra, quantity: 0 }] },
    400,
  );
  await req(
    "/pizza/price",
    "POST",
    {
      ...selection,
      extras: [
        { id: extra, quantity: 1 },
        { id: extra, quantity: 1 },
      ],
    },
    400,
  );
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    pricingRule: "average",
  });
  assert.equal((await req("/pizza/price", "POST", selection)).unitPrice, 73);
  // An odd cent is rounded once on the complete pizza, not separately per flavor.
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f, i) =>
      i ? { ...f, prices: { ...f.prices, [large]: 60.01 } } : f,
    ),
  });
  assert.equal(
    (
      await req("/pizza/price", "POST", {
        ...selection,
        crustId: null,
        extras: [],
      })
    ).unitPrice,
    55.01,
  );
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    pricingRule: "highest",
    flavors: menu.flavors.map((f, i) =>
      i ? { ...f, prices: { ...f.prices, [large]: 60 } } : f,
    ),
  });
  const staffPassword = crypto.randomBytes(20).toString("hex");
  const staff = await req(
    "/users",
    "POST",
    { username: "pizza." + stamp, password: staffPassword, role: "garcom" },
    201,
  );
  const employee = (
    await req("/auth/login", "POST", {
      company: "demo",
      username: staff.user.username,
      password: staffPassword,
    })
  ).token;
  await req("/pizza/catalog", "PUT", menu, 403, employee);
  await req("/pizza/price", "POST", selection, 200, employee);
  const body = {
    cash_register_id: cash.id,
    payment_method: "pix",
    items: [
      {
        product_id: product.id,
        pizza: selection,
        quantity: 1,
        unit_price: 78,
        notes: "Sem cebola",
      },
    ],
  };
  await req("/sales", "POST", { ...body, discount_amount: 5 }, 403, employee);
  await req(
    "/sales",
    "POST",
    { ...body, items: [{ ...body.items[0], unit_price: 1 }] },
    409,
  );
  await req(
    "/sales",
    "POST",
    { ...body, items: [{ ...body.items[0], quantity: 0.5 }] },
    400,
  );
  await req(
    "/sales",
    "POST",
    {
      ...body,
      items: [
        { ...body.items[0], quantity: 11 },
        { ...body.items[0], quantity: 11 },
      ],
    },
    400,
  );
  await req(
    "/sales",
    "POST",
    { ...body, items: [{ product_id: product.id, quantity: 1 }] },
    400,
  );
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 20);
  const sale = await req(
    "/sales",
    "POST",
    {
      ...body,
      items: [
        ...body.items,
        {
          product_id: product.id,
          pizza: { sizeId: large, flavorIds: [calabresa] },
          quantity: 1,
        },
      ],
      discount_amount: 5,
    },
    201,
  );
  assert.equal(Number(sale.total_amount), 123);
  assert.equal(sale.items.length, 2);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 18);
  assert.ok(sale.items[0].pizza.description.includes("1/2"));
  assert.equal(sale.items[0].notes, "Sem cebola");
  const kitchen = (await req("/pizza/kitchen")).filter(
    (i) => i.sale_id === sale.id,
  );
  assert.equal(kitchen.length, 2);
  await req(
    "/pizza/kitchen/" + kitchen[0].id,
    "PUT",
    { status: "pronto" },
    409,
  );
  await req("/pizza/kitchen/" + kitchen[0].id, "PUT", { status: "preparando" });
  await req("/pizza/kitchen/" + kitchen[0].id, "PUT", { status: "pronto" });
  await req("/sales/" + sale.id + "/cancel", "PUT", {});
  assert.ok(!(await req("/pizza/kitchen")).some((i) => i.sale_id === sale.id));
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 20);
  const historical = await req("/sales", "POST", body, 201);
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) =>
      f.id === calabresa
        ? {
            ...f,
            name: "Calabresa artesanal",
            prices: { ...f.prices, [large]: 70 },
          }
        : f,
    ),
  });
  const old = await req("/sales/" + historical.id);
  assert.equal(Number(old.items[0].unit_price), 78);
  assert.equal(
    old.items[0].pizza.flavors.find((f) => f.id === calabresa).name,
    "Calabresa",
  );
  assert.equal((await req("/pizza/price", "POST", selection)).unitPrice, 88);
  await req("/sales", "POST", body, 409);
  await req("/settings", "PUT", { modules: { kitchen: false } }, 400);
  const { table } = await req(
    "/tables",
    "POST",
    { tableNumber: 1000 + (stamp % 800000), capacity: 4 },
    201,
  );
  const { comanda } = await req(
    "/comandas",
    "POST",
    { tableId: table.id, type: "mesa", customerName: "Cliente pizza " + stamp },
    201,
  );
  const line = await req(
    "/comandas/" + comanda.id + "/items",
    "POST",
    {
      productId: product.id,
      pizza: selection,
      expectedUnitPrice: 88,
      quantity: 1,
      notes: "Bem assada",
    },
    201,
  );
  assert.equal(Number(line.item.priceAtSale), 88);
  await req("/settings", "PUT", { modules: { pizza: false } }, 400);
  menu = await req("/pizza/catalog", "PUT", {
    ...menu,
    flavors: menu.flavors.map((f) =>
      f.id === calabresa ? { ...f, prices: { ...f.prices, [large]: 80 } } : f,
    ),
  });
  const changed = await req(
    "/comandas/" + comanda.id + "/items/" + line.item.id,
    "PUT",
    { quantity: 2 },
  );
  assert.equal(Number(changed.item.priceAtSale), 88);
  assert.equal(Number(changed.item.totalItemValue), 176);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 17);
  const pending = (await req("/queue")).items.find(
    (i) => i.id === line.item.id,
  );
  assert.ok(pending.pizza.description.includes("Calabresa artesanal"));
  assert.equal(pending.comanda.table.id, table.id);
  await req("/queue/items/" + line.item.id + "/status", "PUT", {
    status: "preparando",
  });
  await req("/queue/items/" + line.item.id + "/status", "PUT", {
    status: "pronto",
  });
  const detail = await req("/comandas/" + comanda.id);
  assert.equal(
    detail.items.find((i) => i.id === line.item.id).preparationStatus,
    "pronto",
  );
  const pdf = await req("/print/comanda/" + comanda.id + "?format=pdf");
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  await req("/tables/" + table.id + "/close-comanda", "POST", {
    paymentMethod: "pix",
    paymentStatus: "pago",
    payments: [
      { method: "pix", amount: 100 },
      { method: "dinheiro", amount: 76 },
    ],
  });
  for (const item of (await req("/pizza/kitchen")).filter(
    (i) => i.sale_id === historical.id,
  ))
    for (const status of ["preparando", "pronto", "entregue"])
      await req("/pizza/kitchen/" + item.id, "PUT", { status });
  const racePrice = await req("/pizza/price", "POST", selection);
  const parallelBody = {
    ...body,
    items: [
      {
        ...body.items[0],
        pizza: racePrice.pizza.selection,
        unit_price: racePrice.unitPrice,
      },
    ],
  };
  const parallel = await Promise.all(
    Array.from({ length: 12 }, () => req("/sales", "POST", parallelBody, 201)),
  );
  assert.equal(new Set(parallel.map((s) => s.id)).size, 12);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 5);
  await Promise.all(
    parallel.map((s) => req("/sales/" + s.id + "/cancel", "PUT", {})),
  );
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 17);

  const [switchResult, orderResult] = await Promise.all([
    req("/settings", "PUT", { modules: { pizza: false } }, [200, 400]),
    req(
      "/sales",
      "POST",
      {
        ...body,
        items: [
          {
            ...body.items[0],
            pizza: racePrice.pizza.selection,
            unit_price: racePrice.unitPrice,
          },
        ],
      },
      [201, 403],
    ),
  ]);
  assert.ok(
    !(
      switchResult.responseStatus === 200 && orderResult.responseStatus === 201
    ),
    "Desativacao nao pode ignorar uma venda em andamento",
  );
  if (switchResult.responseStatus === 200) {
    assert.equal(orderResult.responseStatus, 403);
    await req("/settings", "PUT", { modules: { pizza: true } });
  } else {
    assert.equal(orderResult.responseStatus, 201);
    for (const item of (await req("/pizza/kitchen")).filter(
      (i) => i.sale_id === orderResult.id,
    ))
      for (const status of ["preparando", "pronto", "entregue"])
        await req("/pizza/kitchen/" + item.id, "PUT", { status });
  }
  await req("/settings", "PUT", { modules: { pizza: false } });
  await req("/pizza/catalog", "GET", undefined, 403);
  await req("/pizza/price", "POST", selection, 403);
  await req("/settings", "PUT", { modules: { pizza: true } });
  const master = (
    await req("/support/login", "POST", {
      username: "master.local",
      password: secret.master,
    })
  ).token;
  const companies = await req(
    "/support/companies",
    "GET",
    undefined,
    200,
    master,
  );
  const other = companies.find((c) => c.slug !== "demo");
  assert.ok(other);
  const session = await req(
    "/support/sessions",
    "POST",
    { company: other.slug },
    200,
    master,
  );
  await req(
    "/settings",
    "PUT",
    { businessProfile: "pizzaria" },
    200,
    session.token,
  );
  const foreignMenu = await req(
    "/pizza/catalog",
    "GET",
    undefined,
    200,
    session.token,
  );
  assert.ok(!foreignMenu.sizes.some((s) => s.id === large));
  await req("/pizza/price", "POST", selection, 400, session.token);
  await req(
    "/pizza/kitchen/" + historical.items[0].id,
    "PUT",
    { status: "entregue" },
    404,
    session.token,
  );
  fs.mkdirSync("work/pizza", { recursive: true });
  fs.writeFileSync(
    "work/pizza/session.json",
    JSON.stringify({
      admin,
      employee,
      user: staff.user,
      product,
      menu,
      selection,
      sale: historical,
      comanda,
      table,
    }),
  );
  console.log(
    `${count()} verificações de pizzaria aprovadas: preços, frações, permissões, estoque agregado, snapshots, cancelamento, mesas/cozinha, PDF, pagamento dividido e isolamento.`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
