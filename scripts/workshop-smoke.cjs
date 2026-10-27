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
const slug = "oficina-" + Date.now();
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
  await req("/workshop/vehicles", "GET", undefined, 403);
  await req("/settings", "PUT", { businessProfile: "oficina" });
  assert.equal((await req("/settings")).modules.workshop, true);
  const customer = await req(
    "/customers",
    "POST",
    { name: "Cliente oficina teste", phone: "11999990000" },
    201,
  );
  const customerId = customer.customer?.id || customer.id;
  const staff = async (username, role) => {
    await req("/users", "POST", { username, password, role }, 201);
    return req("/auth/login", "POST", { company: slug, username, password });
  };
  const employee = await staff("mecanico.teste", "garcom"),
    other = await staff("outro.teste", "garcom"),
    manager = await staff("gerente.teste", "gerente");
  const vehicleBody = {
    customerId,
    plate: "ABC-1D23",
    brand: "Fiat",
    model: "Uno",
    year: 2010,
    mileage: 10000,
    color: "Branco",
    notes: "Veículo sintético",
    active: true,
  };
  await req(
    "/workshop/vehicles",
    "POST",
    { ...vehicleBody, plate: "errada" },
    400,
  );
  await req("/workshop/vehicles", "POST", vehicleBody, 403, employee.token);
  let vehicle = await req("/workshop/vehicles", "POST", vehicleBody, 201);
  assert.equal(vehicle.plate, "ABC1D23");
  await req("/workshop/vehicles", "POST", vehicleBody, 409);
  await req(
    "/workshop/vehicles/" + vehicle.id,
    "PUT",
    { ...vehicleBody, revision: 0 },
    409,
  );
  await req(
    "/workshop/vehicles/" + vehicle.id,
    "PUT",
    { ...vehicleBody, mileage: 9000, revision: vehicle.revision },
    400,
  );
  await req(
    "/workshop/vehicles/" + vehicle.id,
    "PUT",
    { ...vehicleBody, year: 1800, revision: vehicle.revision },
    400,
  );
  const part = (
    await req(
      "/products",
      "POST",
      {
        name: "Filtro teste OS",
        category: "pecas",
        unitOfMeasure: "unidade",
        costPrice: 5,
        salePrice: 20,
      },
      201,
    )
  ).product;
  const service = (
    await req(
      "/products",
      "POST",
      {
        name: "Serviço teste OS",
        itemType: "service",
        category: "mao_de_obra",
        unitOfMeasure: "servico",
        costPrice: 0,
        salePrice: 30,
      },
      201,
    )
  ).product;
  await req("/stock/add", "POST", { productId: part.id, quantity: 10 }, 201);
  const body = {
    vehicleId: vehicle.id,
    mileage: 10100,
    assignedUserId: employee.user.id,
    complaint: "Cliente relata ruído na revisão",
    diagnosis: "Trocar filtro e executar revisão",
    notes: "Avisar ao terminar",
    checklist: {
      body: "attention",
      tires: "ok",
      lights: "ok",
      accessories: "not_checked",
      fuelLevel: "half",
      notes: "Risco no para-choque",
    },
    lines: [
      { productId: part.id, quantity: 2, unitPrice: 20 },
      { productId: service.id, quantity: 1, unitPrice: 30 },
    ],
    discount: 5,
  };
  await req(
    "/workshop/orders",
    "POST",
    { ...body, checklist: { body: "anything" } },
    400,
  );
  await req("/workshop/orders", "POST", body, 403, employee.token);
  await req("/workshop/orders", "POST", { ...body, lines: [null] }, 400);
  await req("/workshop/orders", "POST", [], 400);
  await req("/workshop/vehicles", "POST", [], 400);
  let order = await req("/workshop/orders", "POST", body, 201);
  assert.equal(Number(order.total), 65);
  assert.equal(order.vehicleSnapshot.plate, "ABC1D23");
  assert.equal(order.customerSnapshot.name, "Cliente oficina teste");
  const get = () => req("/workshop/orders/" + order.id);
  const step = async (status, note = "Registro sintético", token = admin) => {
    const v = await req(
      `/workshop/orders/${order.id}/status`,
      "POST",
      { revision: order.revision, status, note },
      200,
      token,
    );
    order = v;
    return v;
  };
  await req(
    "/workshop/orders/" + order.id,
    "PUT",
    { ...body, revision: 0 },
    409,
  );
  await req(
    "/workshop/orders/" + order.id,
    "PUT",
    {
      ...body,
      revision: order.revision,
      lines: [...body.lines, body.lines[0]],
    },
    400,
  );
  assert.equal(Number((await req("/products/" + part.id)).currentStock), 10);
  await req("/settings", "PUT", { modules: { workshop: false } }, 400);
  vehicle = (await req("/workshop/vehicles"))[0];
  await req(
    "/workshop/vehicles/" + vehicle.id,
    "PUT",
    {
      ...vehicleBody,
      mileage: 10100,
      active: false,
      revision: vehicle.revision,
    },
    400,
  );
  await step("waiting");
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    { revision: order.revision, status: "approved", note: "" },
    400,
  );
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    { revision: order.revision, status: "approved", note: "Não permitido" },
    403,
    employee.token,
  );
  await step(
    "approved",
    "Autorizado pelo cliente presencialmente",
    manager.token,
  );
  assert.ok(order.events.at(-1).budget.lines.length === 2);
  await req(
    "/workshop/orders/" + order.id,
    "PUT",
    { ...body, revision: order.revision },
    400,
  );
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    { revision: order.revision, status: "in_progress" },
    403,
    other.token,
  );
  await req("/users/" + employee.user.id, "PUT", { active: false });
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    { revision: order.revision, status: "in_progress" },
    400,
  );
  await req("/users/" + employee.user.id, "PUT", { active: true });
  await step("in_progress", "Iniciado pelo mecânico", employee.token);
  await step("ready", "Serviço concluído", employee.token);
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    { revision: order.revision, status: "delivered" },
    400,
  );
  await req("/products/" + part.id, "PUT", {
    salePrice: 99,
    name: "Filtro renomeado após aprovação",
  });
  const checkout = {
    cash_register_id: 99999,
    payment_method: "pix",
    revision: order.revision,
  };
  await req(`/workshop/orders/${order.id}/checkout`, "POST", checkout, 400);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 100 },
    201,
  );
  checkout.cash_register_id = cash.id;
  checkout.payments = [
    { method: "dinheiro", amount: 30 },
    { method: "pix", amount: 35 },
  ];
  await req(
    `/workshop/orders/${order.id}/checkout`,
    "POST",
    { ...checkout, payments: [{ method: "pix", amount: 1 }] },
    400,
  );
  assert.equal(Number((await req("/products/" + part.id)).currentStock), 10);
  await req(
    `/workshop/orders/${order.id}/checkout`,
    "POST",
    checkout,
    403,
    employee.token,
  );
  await req(
    `/workshop/orders/${order.id}/checkout`,
    "POST",
    { ...checkout, sourceQuoteId: crypto.randomUUID() },
    400,
  );
  const result = await Promise.all(
    Array.from({ length: 4 }, () =>
      req(
        `/workshop/orders/${order.id}/checkout`,
        "POST",
        checkout,
        [201, 409],
      ),
    ),
  );
  assert.equal(result.filter((v) => v.responseStatus === 201).length, 1);
  let sale = result.find((v) => v.responseStatus === 201);
  assert.equal(sale.sourceWorkOrderId, order.id);
  assert.equal(Number(sale.total_amount), 65);
  assert.equal(Number((await req("/products/" + part.id)).currentStock), 8);
  assert.equal(Number((await req("/products/" + service.id)).currentStock), 0);
  order = await get();
  assert.equal(order.sale.id, sale.id);
  assert.equal(order.lines[0].name, "Filtro teste OS");
  assert.equal(order.sale.payments.length, 2);
  await req(
    "/sales",
    "POST",
    { ...checkout, sourceWorkOrderId: order.id },
    400,
  );
  await req(
    `/workshop/orders/${order.id}/status`,
    "POST",
    {
      revision: order.revision,
      status: "draft",
      note: "Não pode revisar paga",
    },
    400,
  );
  await req("/sales/" + sale.id + "/cancel", "PUT", {});
  assert.equal(Number((await req("/products/" + part.id)).currentStock), 10);
  order = await get();
  assert.equal(order.sale.status, "cancelled");
  sale = await req(
    `/workshop/orders/${order.id}/checkout`,
    "POST",
    { ...checkout, revision: order.revision },
    201,
  );
  assert.equal(Number((await req("/products/" + part.id)).currentStock), 8);
  order = await get();
  await step("delivered", "Veículo entregue ao cliente");
  await req("/sales/" + sale.id + "/cancel", "PUT", {}, 400);
  order = await get();
  assert.equal(order.sale.status, "completed");
  const pdf = await req("/workshop/orders/" + order.id + "/pdf");
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  let draft = await req("/workshop/orders", "POST", body, 201);
  await req(`/workshop/orders/${draft.id}/status`, "POST", {
    revision: draft.revision,
    status: "waiting",
  });
  draft = await req("/workshop/orders/" + draft.id);
  draft = await req(`/workshop/orders/${draft.id}/status`, "POST", {
    revision: draft.revision,
    status: "rejected",
    note: "Cliente não autorizou",
  });
  draft = await req("/workshop/orders/" + draft.id, "PUT", {
    ...body,
    revision: draft.revision,
  });
  assert.equal(draft.status, "draft");
  assert.equal(draft.approvalNote, null);
  draft = await req(`/workshop/orders/${draft.id}/status`, "POST", {
    revision: draft.revision,
    status: "cancelled",
    note: "Desistência registrada",
  });
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req(
    "/settings",
    "PUT",
    { businessProfile: "oficina" },
    200,
    second.token,
  );
  assert.equal(
    (await req("/workshop/vehicles", "GET", undefined, 200, second.token))
      .length,
    0,
  );
  assert.equal(
    (await req("/workshop/orders", "GET", undefined, 200, second.token)).length,
    0,
  );
  await req(
    "/workshop/orders/" + order.id,
    "GET",
    undefined,
    404,
    second.token,
  );
  await req("/workshop/orders", "POST", body, 400, second.token);
  const secret = credentials();
  const session = async (username, password) => {
    const l = await req("/support/login", "POST", { username, password });
    return req("/support/sessions", "POST", { company: slug }, 200, l.token);
  };
  const master = await session("master.local", secret.master),
    support = await session("support.local", secret.support);
  await req("/workshop/orders", "GET", undefined, 200, master.token);
  await req(
    "/workshop/orders/" + order.id + "/pdf",
    "GET",
    undefined,
    200,
    support.token,
  );
  await req("/workshop/vehicles", "POST", vehicleBody, 403, support.token);
  await req("/settings", "PUT", { modules: { workshop: false } });
  await req("/workshop/orders", "GET", undefined, 403);
  await req("/settings", "PUT", { modules: { workshop: true } });
  // Browser starts with fresh draft; this is a synthetic fixture, not production data.
  const browserOrder = await req("/workshop/orders", "POST", body, 201);
  fs.mkdirSync("work/workshop", { recursive: true });
  fs.writeFileSync(
    "work/workshop/session.json",
    JSON.stringify({
      login,
      employee,
      manager,
      other,
      master,
      support,
      second,
      slug,
      customerId,
      vehicle,
      part,
      service,
      body,
      order,
      browserOrder,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${count()} verificações HTTP de oficina aprovadas: veículos, checklist, aprovações, execução, recebimento concorrente, estoque único, cancelamento, PDF, módulos e isolamento.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
