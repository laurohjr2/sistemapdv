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
const slug = "entregas-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Entregas teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
  const req = (path, method = "GET", body, status = 200, auth = token) =>
    r(path, { method, body, status, token: auth });
  const make = async (name) =>
    (
      await req(
        "/products",
        "POST",
        {
          name,
          category: "comidas",
          unitOfMeasure: "unidade",
          costPrice: 2,
          salePrice: 10,
        },
        201,
      )
    ).product;
  const p = await make("Produto para entrega");
  await req("/stock/add", "POST", { productId: p.id, quantity: 50 }, 201);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
  );
  const sell = async (id = p.id) =>
    await req(
      "/sales",
      "POST",
      {
        cash_register_id: cash.id,
        payment_method: "pix",
        items: [{ product_id: id, quantity: 1 }],
      },
      201,
    );
  const stock = async () =>
    Number((await req("/products/" + p.id)).currentStock);
  const body = {
    customerName: "Cliente Entrega",
    phone: "11999999999",
    address: {
      street: "Rua de Teste",
      number: "123",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      postalCode: "01001-000",
      complement: "Casa",
      reference: "Portão verde",
    },
    notes: "Não tocar campainha",
  };
  const first = await sell();
  let o = await req(
    "/deliveries",
    "POST",
    { ...body, saleId: first.id, paidTotal: 1, items: [] },
    201,
  );
  assert.equal(Number(o.paidTotal), 10);
  assert.equal(o.items[0].name, p.name);
  assert.equal(o.status, "received");
  assert.equal(o.history[0].userId, login.user.id);
  assert.equal(o.saleId, first.id);
  assert.equal(await stock(), 49);
  await req("/deliveries", "POST", { ...body, saleId: first.id }, 409);
  await req("/deliveries", "POST", { ...body, saleId: 9999999 }, 400);
  await req("/deliveries", "POST", { ...body, saleId: true }, 400);
  await req(
    "/deliveries",
    "POST",
    { ...body, saleId: first.id, address: { ...body.address, state: "XX" } },
    400,
  );
  await req(
    "/deliveries",
    "POST",
    { ...body, saleId: first.id, phone: "telefone" },
    400,
  );
  await req(
    "/deliveries",
    "POST",
    { ...body, saleId: first.id, address: { ...body.address, street: "" } },
    400,
  );
  await req("/settings", "PUT", { modules: { delivery: false } }, 400);
  await req(
    "/deliveries/" + o.id + "/status",
    "POST",
    {
      status: "dispatched",
      revision: o.revision,
      courierName: "Entregador Teste",
    },
    409,
  );
  let edit = await req("/deliveries/" + o.id, "PUT", {
    ...body,
    revision: o.revision,
    address: { ...body.address, number: "456" },
  });
  assert.equal(edit.address.number, "456");
  assert.equal(edit.history.at(-1).before.address.number, "123");
  o = edit;
  await req(
    "/deliveries/" + o.id + "/status",
    "POST",
    { status: "preparing", revision: 1 },
    409,
  );
  o = await req("/deliveries/" + o.id + "/status", "POST", {
    status: "preparing",
    revision: o.revision,
  });
  o = await req("/deliveries/" + o.id + "/status", "POST", {
    status: "ready",
    revision: o.revision,
  });
  await req(
    "/deliveries/" + o.id + "/status",
    "POST",
    { status: "dispatched", revision: o.revision },
    400,
  );
  o = await req("/deliveries/" + o.id + "/status", "POST", {
    status: "dispatched",
    revision: o.revision,
    courierName: "Entregador Teste",
  });
  assert.equal(o.courierName, "Entregador Teste");
  await req("/sales/" + first.id + "/cancel", "PUT", {}, 400);
  assert.equal((await req("/sales/" + first.id)).status, "completed");
  await req(
    "/deliveries/" + o.id,
    "PUT",
    { ...body, revision: o.revision },
    409,
  );
  await req(
    "/deliveries/" + o.id + "/status",
    "POST",
    {
      status: "cancelled",
      revision: o.revision,
      reason: "Não pode cancelar após saída",
    },
    409,
  );
  o = await req("/deliveries/" + o.id + "/status", "POST", {
    status: "delivered",
    revision: o.revision,
  });
  assert.equal(await stock(), 49);
  await req(
    "/deliveries/" + o.id + "/status",
    "POST",
    { status: "delivered", revision: o.revision },
    409,
  );
  // Paper copy, immutable item description, company name and address.
  await req("/products/" + p.id, "PUT", {
    name: "Produto renomeado após venda",
  });
  assert.equal(
    (await req("/deliveries")).find((x) => x.id === o.id).items[0].name,
    "Produto para entrega",
  );
  const pdf = await req("/deliveries/" + o.id + "/pdf");
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  fs.writeFileSync("work/delivery/order.pdf", pdf);
  // Financial cancellation before dispatch cancels the linked delivery exactly once.
  const s2 = await sell();
  const d2 = await req("/deliveries", "POST", { ...body, saleId: s2.id }, 201);
  await req("/sales/" + s2.id + "/cancel", "PUT", {});
  assert.equal(
    (await req("/deliveries")).find((x) => x.id === d2.id).status,
    "cancelled",
  );
  assert.equal(await stock(), 49);
  await req(
    "/deliveries/" + d2.id + "/status",
    "POST",
    { status: "preparing", revision: 2 },
    409,
  );
  await req("/deliveries", "POST", { ...body, saleId: s2.id }, 400);
  // Cancelling only delivery keeps a paid sale and its physical consumption.
  const s3 = await sell();
  let d3 = await req("/deliveries", "POST", { ...body, saleId: s3.id }, 201);
  d3 = await req("/deliveries/" + d3.id + "/status", "POST", {
    status: "cancelled",
    revision: d3.revision,
    reason: "Cliente escolheu retirar no balcão",
  });
  assert.equal((await req("/sales/" + s3.id)).status, "completed");
  assert.equal(await stock(), 48);
  // Two requests cannot create duplicate orders for one sale.
  const concurrent = await sell();
  const attempts = await Promise.all([
    req("/deliveries", "POST", { ...body, saleId: concurrent.id }, [201, 409]),
    req("/deliveries", "POST", { ...body, saleId: concurrent.id }, [201, 409]),
  ]);
  assert.equal(attempts.filter((x) => x.responseStatus === 201).length, 1);
  const dc = attempts.find((x) => x.responseStatus === 201);
  await req("/sales/" + concurrent.id + "/cancel", "PUT", {});
  // Kitchen readiness is authoritative, including ingredient recipes.
  const prepared = await make("Preparado para entrega"),
    input = await make("Insumo para entrega");
  await req("/stock/add", "POST", { productId: input.id, quantity: 10 }, 201);
  await req("/recipes/" + prepared.id, "PUT", {
    enabled: true,
    yieldQuantity: 1,
    revision: 0,
    ingredients: [{ productId: input.id, quantity: 1 }],
  });
  const ps = await sell(prepared.id),
    pi = ps.items[0];
  let pd = await req("/deliveries", "POST", { ...body, saleId: ps.id }, 201);
  pd = await req("/deliveries/" + pd.id + "/status", "POST", {
    status: "preparing",
    revision: pd.revision,
  });
  await req(
    "/deliveries/" + pd.id + "/status",
    "POST",
    { status: "ready", revision: pd.revision },
    409,
  );
  for (const status of ["preparando", "pronto"])
    await req("/recipes/kitchen/" + pi.id, "PUT", { status });
  pd = await req("/deliveries/" + pd.id + "/status", "POST", {
    status: "ready",
    revision: pd.revision,
  });
  pd = await req("/deliveries/" + pd.id + "/status", "POST", {
    status: "dispatched",
    revision: pd.revision,
    courierName: "Moto Teste",
  });
  assert.equal(
    (await req("/sales/" + ps.id)).items[0].preparationStatus,
    "entregue",
  );
  assert.equal(
    (await req("/recipes/kitchen")).some((i) => i.id === pi.id),
    false,
  );
  assert.equal(Number((await req("/products/" + input.id)).currentStock), 9);
  // Role checks and separate company boundaries.
  await req(
    "/users",
    "POST",
    { username: "delivery.attendant", password, role: "garcom" },
    201,
  );
  const attendant = (
    await req("/auth/login", "POST", {
      company: slug,
      username: "delivery.attendant",
      password,
    })
  ).token;
  const s4 = await sell();
  let d4 = await req(
    "/deliveries",
    "POST",
    { ...body, saleId: s4.id },
    201,
    attendant,
  );
  await req(
    "/deliveries/" + d4.id + "/status",
    "POST",
    { status: "cancelled", revision: d4.revision, reason: "Sem permissão" },
    403,
    attendant,
  );
  d4 = await req(
    "/deliveries/" + d4.id + "/status",
    "POST",
    { status: "preparing", revision: d4.revision },
    200,
    attendant,
  );
  const tokenB = (
    await req("/auth/login", "POST", {
      company: slug + "-b",
      username: "catalog.admin",
      password,
    })
  ).token;
  assert.equal(
    (await req("/deliveries", "GET", undefined, 200, tokenB)).length,
    0,
  );
  await req("/deliveries/" + d4.id + "/pdf", "GET", undefined, 404, tokenB);
  await req(
    "/deliveries/" + d4.id,
    "PUT",
    { ...body, revision: d4.revision },
    404,
    tokenB,
  );
  await req("/deliveries/" + d4.id + "/status", "POST", {
    status: "cancelled",
    revision: d4.revision,
    reason: "Teste concluído",
  });
  // Module can be hidden only after every pending delivery ends.
  pd = await req("/deliveries/" + pd.id + "/status", "POST", {
    status: "delivered",
    revision: pd.revision,
  });
  await req("/settings", "PUT", { modules: { delivery: false } });
  await req("/deliveries", "GET", undefined, 403);
  await req("/settings", "PUT", { modules: { delivery: true } });
  await req("/settings", "PUT", { modules: { kitchen: false } });
  const manualSale = await sell(prepared.id);
  let manual = await req(
    "/deliveries",
    "POST",
    { ...body, saleId: manualSale.id },
    201,
  );
  manual = await req("/deliveries/" + manual.id + "/status", "POST", {
    status: "preparing",
    revision: manual.revision,
  });
  manual = await req("/deliveries/" + manual.id + "/status", "POST", {
    status: "ready",
    revision: manual.revision,
  });
  assert.equal(
    (await req("/sales/" + manualSale.id)).items[0].preparationStatus,
    "pronto",
  );
  manual = await req("/deliveries/" + manual.id + "/status", "POST", {
    status: "dispatched",
    revision: manual.revision,
    courierName: "Transportador manual",
  });
  await req("/deliveries/" + manual.id + "/status", "POST", {
    status: "delivered",
    revision: manual.revision,
  });
  await req("/settings", "PUT", { modules: { kitchen: true } });
  const raceSale = await sell();
  let race = await req(
    "/deliveries",
    "POST",
    { ...body, saleId: raceSale.id },
    201,
  );
  for (const status of ["preparing", "ready"])
    race = await req("/deliveries/" + race.id + "/status", "POST", {
      status,
      revision: race.revision,
    });
  const raceResults = await Promise.all([
    req(
      "/deliveries/" + race.id + "/status",
      "POST",
      {
        status: "dispatched",
        revision: race.revision,
        courierName: "Entregador concorrente",
      },
      [200, 409],
    ),
    req("/sales/" + raceSale.id + "/cancel", "PUT", {}, [200, 400]),
  ]);
  assert.equal(raceResults.filter((x) => x.responseStatus === 200).length, 1);
  const raceAfter = (await req("/deliveries")).find((x) => x.id === race.id),
    saleAfter = await req("/sales/" + raceSale.id);
  if (raceAfter.status === "dispatched") {
    assert.equal(saleAfter.status, "completed");
    await req("/deliveries/" + race.id + "/status", "POST", {
      status: "delivered",
      revision: raceAfter.revision,
    });
  } else assert.equal(saleAfter.status, "cancelled");
  if (process.env.PDV_DELIVERY_BROWSER_FIXTURE)
    fs.writeFileSync(
      process.env.PDV_DELIVERY_BROWSER_FIXTURE,
      JSON.stringify({
        company: slug,
        username: "catalog.admin",
        password,
        productId: p.id,
        saleId: s4.id,
        preparedId: prepared.id,
      }),
      { mode: 0o600 },
    );
  console.log(
    count() +
      " verificações de entrega aprovadas: contato, etapas, histórico, pagamento/estoque únicos, cancelamentos, cozinha, PDF, concorrência, permissões e isolamento.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
