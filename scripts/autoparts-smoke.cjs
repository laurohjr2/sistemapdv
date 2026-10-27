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
const slug = "autopecas-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Autopeças teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
  await req("/autoparts/catalog", "GET", undefined, 403);
  await req("/settings", "PUT", { businessProfile: "autopecas" });
  assert.equal((await req("/settings")).modules.autoparts, true);
  const make = async (name, itemType = "product", active = true) =>
    (
      await req(
        "/products",
        "POST",
        {
          name,
          itemType,
          active,
          category: itemType === "product" ? "pecas" : "mao_de_obra",
          unitOfMeasure: itemType === "product" ? "unidade" : "servico",
          costPrice: 5,
          salePrice: 30,
        },
        201,
      )
    ).product;
  const a = await make("Filtro Alfa sintético"),
    b = await make("Filtro Beta sintético"),
    c = await make("Filtro Gama sintético"),
    inactive = await make("Filtro inativo sintético", "product", false),
    service = await make("Instalação sintética", "service");
  await req("/stock/add", "POST", { productId: a.id, quantity: 4 }, 201);
  await req("/stock/add", "POST", { productId: b.id, quantity: 1 }, 201);
  const before = await req("/products");
  const body = {
    manufacturer: "Fabricante Alfa teste",
    partNumber: "ALF-100",
    originalCodes: ["OEM-100", "oem-100"],
    applications: [
      {
        brand: "Fiat",
        model: "Uno",
        yearFrom: 2010,
        yearTo: 2015,
        engine: "1.0",
        version: "Vivace",
        notes: "Conferir conector e medidas",
      },
      {
        brand: "Volkswagen",
        model: "Gol",
        yearFrom: 2018,
        yearTo: 2022,
        engine: "1.6",
        version: "MSI",
        notes: "",
      },
    ],
    notes: "Dados fictícios exclusivos para teste",
    revision: 0,
  };
  await req("/autoparts/parts/" + service.id, "PUT", body, 400);
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, applications: [null] },
    400,
  );
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, applications: [{ ...body.applications[0], yearTo: 2000 }] },
    400,
  );
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, applications: [body.applications[0], body.applications[0]] },
    400,
  );
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, originalCodes: "bad" },
    400,
  );
  let detail = await req("/autoparts/parts/" + a.id, "PUT", body);
  assert.equal(detail.revision, 1);
  assert.equal(detail.originalCodes.length, 1);
  assert.equal(detail.originalCodes[0].toUpperCase(), "OEM-100");
  await req("/autoparts/parts/" + a.id, "PUT", body, 409);
  const queries = [
    ["search=ALF-100", 1],
    ["search=OEM-100", 1],
    ["search=fabricante%20alfa", 1],
    ["brand=fiat&model=UNO&year=2010&engine=1.0&version=vivace", 1],
    ["brand=Fiat&model=Uno&year=2015", 1],
    ["brand=Fiat&model=Uno&year=2016", 0],
    ["brand=Fiat&model=Gol", 0],
    ["brand=Fiat&engine=1.6", 0],
    ["brand=Fiat&model=Uno&engine=1.0%20turbo", 0],
  ];
  for (const [query, expected] of queries)
    assert.equal(
      (await req("/autoparts/catalog?" + query)).length,
      expected,
      query,
    );
  await req("/autoparts/catalog?year=1899", "GET", undefined, 400);
  await req("/autoparts/catalog?active=bad", "GET", undefined, 400);
  assert.equal((await req("/autoparts/catalog?active=true")).length, 3);
  assert.equal((await req("/autoparts/catalog?active=")).length, 4);
  assert.equal((await req("/autoparts/parts/" + a.id.toUpperCase())).id, a.id);
  const concurrent = await Promise.all(
    Array.from({ length: 4 }, () =>
      req(
        "/autoparts/parts/" + a.id,
        "PUT",
        { ...body, revision: 1 },
        [200, 409],
      ),
    ),
  );
  assert.equal(concurrent.filter((v) => v.responseStatus === 200).length, 1);
  await req(
    "/autoparts/equivalences",
    "POST",
    {
      productId: a.id,
      equivalentId: a.id.toUpperCase(),
      note: "Não deve permitir a mesma peça",
    },
    400,
  );
  await req(
    "/autoparts/equivalences",
    "POST",
    {
      productId: a.id,
      equivalentId: service.id,
      note: "Serviço não é equivalente",
    },
    400,
  );
  await req(
    "/autoparts/equivalences",
    "POST",
    {
      productId: a.id,
      equivalentId: inactive.id,
      note: "Inativo não é disponível",
    },
    400,
  );
  await req(
    "/autoparts/equivalences",
    "POST",
    { productId: a.id, equivalentId: b.id, note: "" },
    400,
  );
  const eq = {
    productId: a.id,
    equivalentId: b.id,
    note: "Referência cruzada sintética conferida no fabricante",
  };
  const pairs = await Promise.all(
    Array.from({ length: 3 }, (_, i) =>
      req(
        "/autoparts/equivalences",
        "POST",
        i % 2 ? { ...eq, productId: b.id, equivalentId: a.id } : eq,
        [201, 409],
      ),
    ),
  );
  assert.equal(pairs.filter((v) => v.responseStatus === 201).length, 1);
  const alpha = await req("/autoparts/parts/" + a.id),
    beta = await req("/autoparts/parts/" + b.id);
  assert.equal(alpha.equivalents[0].productId, b.id);
  assert.equal(beta.equivalents[0].productId, a.id);
  await req(
    "/autoparts/equivalences",
    "POST",
    {
      productId: b.id,
      equivalentId: c.id,
      note: "Segunda equivalência sintética",
    },
    201,
  );
  assert.equal((await req("/autoparts/parts/" + a.id)).equivalents.length, 1); // No transitive A -> C.
  await req("/products/" + b.id, "DELETE");
  assert.equal(
    (await req("/autoparts/parts/" + a.id)).equivalents[0].active,
    false,
  );
  await req("/products/" + b.id, "PUT", { active: true });
  await req(
    `/autoparts/equivalences/${b.id}/${a.id}`,
    "DELETE",
    undefined,
    204,
  );
  assert.equal((await req("/autoparts/parts/" + b.id)).equivalents.length, 1);
  assert.equal((await req("/autoparts/parts/" + a.id)).equivalents.length, 0);
  await req("/autoparts/equivalences", "POST", eq, 201);
  const employeeUser = await req(
      "/users",
      "POST",
      { username: "balcao.teste", password, role: "garcom" },
      201,
    ),
    managerUser = await req(
      "/users",
      "POST",
      { username: "gerente.teste", password, role: "gerente" },
      201,
    );
  const sign = (registered) =>
    req("/auth/login", "POST", {
      company: slug,
      username: registered.user.username,
      password,
    });
  const employee = await sign(employeeUser),
    manager = await sign(managerUser);
  await req("/autoparts/catalog", "GET", undefined, 200, employee.token);
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, revision: 2 },
    403,
    employee.token,
  );
  await req(
    `/autoparts/equivalences/${b.id}/${a.id}`,
    "DELETE",
    undefined,
    403,
    employee.token,
  );
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, revision: 2 },
    200,
    manager.token,
  );
  const after = await req("/products");
  for (const old of before) {
    const now = after.find((p) => p.id === old.id);
    for (const key of [
      "costPrice",
      "salePrice",
      "currentStock",
      "name",
      "itemType",
    ])
      assert.equal(now[key], old[key], key);
  }
  assert.equal(
    after.find((p) => p.id === a.id).partDetails.partNumber,
    "ALF-100",
  );
  const second = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req(
    "/settings",
    "PUT",
    { businessProfile: "autopecas" },
    200,
    second.token,
  );
  assert.equal(
    (await req("/autoparts/catalog", "GET", undefined, 200, second.token))
      .length,
    0,
  );
  await req("/autoparts/parts/" + a.id, "GET", undefined, 404, second.token);
  await req("/autoparts/parts/" + a.id, "PUT", body, 404, second.token);
  const secret = credentials();
  const session = async (username, password) => {
    const l = await req("/support/login", "POST", { username, password });
    return req("/support/sessions", "POST", { company: slug }, 200, l.token);
  };
  const master = await session("master.local", secret.master),
    support = await session("support.local", secret.support);
  await req("/autoparts/catalog", "GET", undefined, 200, support.token);
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, revision: 3 },
    403,
    support.token,
  );
  await req(
    "/autoparts/parts/" + a.id,
    "PUT",
    { ...body, revision: 3 },
    200,
    master.token,
  );
  await req("/settings", "PUT", { modules: { autoparts: false } });
  await req("/autoparts/catalog", "GET", undefined, 403);
  await req("/settings", "PUT", { modules: { autoparts: true } });
  assert.equal(
    (await req("/autoparts/parts/" + a.id)).partDetails.partNumber,
    "ALF-100",
  );
  fs.mkdirSync("work/autoparts", { recursive: true });
  fs.writeFileSync(
    "work/autoparts/session.json",
    JSON.stringify({
      login,
      employee,
      manager,
      master,
      support,
      slug,
      a,
      b,
      c,
      inactive,
      service,
      body,
    }),
    { mode: 0o600 },
  );
  console.log(
    `${count()} verificações de autopeças aprovadas: aplicações exatas, códigos, equivalências simétricas sem transitividade, concorrência, inativos, estoque preservado e isolamento.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
