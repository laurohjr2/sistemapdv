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
const slug = "evidencias-" + Date.now();
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();for(const slug of ${JSON.stringify([slug, slug + "-b"])})await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug,name:'Evidências teste',adminUsername:'catalog.admin',adminPassword:${JSON.stringify(password)}})})().catch(e=>{console.error(e.name+": "+e.message);process.exit(1)});`;
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
const { png, strokes } = require("./testing/workshop-evidence-fixture.cjs");
const photo = png(),
  uri = "data:image/png;base64," + photo.toString("base64");
(async () => {
  const login = await r("/auth/login", {
      method: "POST",
      body: { company: slug, username: "catalog.admin", password },
    }),
    token = login.token;
  const req = (p, method = "GET", body, status = 200, auth = token) =>
    r(p, { method, body, status, token: auth });
  await req("/settings", "PUT", { businessProfile: "oficina" });
  const customer = await req(
    "/customers",
    "POST",
    { name: "Cliente fictício de evidências", phone: "11999990000" },
    201,
  );
  const staff = await req(
      "/users",
      "POST",
      { username: "evidence.mechanic", password, role: "garcom" },
      201,
    ),
    outsider = await req(
      "/users",
      "POST",
      { username: "evidence.other", password, role: "garcom" },
      201,
    );
  const mechanic = (
      await req("/auth/login", "POST", {
        company: slug,
        username: "evidence.mechanic",
        password,
      })
    ).token,
    other = (
      await req("/auth/login", "POST", {
        company: slug,
        username: "evidence.other",
        password,
      })
    ).token;
  const vehicle = await req(
    "/workshop/vehicles",
    "POST",
    {
      customerId: customer.id,
      plate: "EVD1A23",
      brand: "Teste",
      model: "Veículo sintético",
      mileage: 10000,
      year: 2020,
    },
    201,
  );
  const product = (
    await req(
      "/products",
      "POST",
      {
        name: "Peça para evidências",
        category: "pecas",
        unitOfMeasure: "unidade",
        costPrice: 5,
        salePrice: 30,
      },
      201,
    )
  ).product;
  await req("/stock/add", "POST", { productId: product.id, quantity: 10 }, 201);
  const body = {
    vehicleId: vehicle.id,
    mileage: 10000,
    assignedUserId: staff.user?.id || staff.id,
    complaint: "Ruído informado pelo cliente fictício",
    diagnosis: "Peça necessita substituição",
    notes: "Conferir o acabamento com o cliente",
    checklist: {
      body: "attention",
      tires: "ok",
      lights: "ok",
      accessories: "not_checked",
      fuelLevel: "half",
      notes: "Risco registrado na carroceria",
    },
    lines: [{ productId: product.id, quantity: 1, unitPrice: 30 }],
    discount: 0,
  };
  let o = await req("/workshop/orders", "POST", body, 201);
  const refresh = async () => (o = await req("/workshop/orders/" + o.id)),
    evidence = () => req("/workshop/orders/" + o.id + "/evidence");
  const add = async (
    caption = "Foto sintética da carroceria",
    image = uri,
    auth = token,
    status = 201,
    revision = o.revision,
  ) => {
    const result = await req(
      "/workshop/orders/" + o.id + "/photos",
      "POST",
      { revision, caption, checkKey: "body", image },
      status,
      auth,
    );
    if (status === 201) await refresh();
    return result;
  };
  const step = async (status, note = "Registro sintético de autorização") =>
    (o = await req("/workshop/orders/" + o.id + "/status", "POST", {
      status,
      note,
      revision: o.revision,
    }));
  const sign = async (
    purpose = "approval",
    status = 201,
    auth = token,
    extra = {},
  ) => {
    const s = await req(
      "/workshop/orders/" + o.id + "/signatures",
      "POST",
      {
        revision: o.revision,
        purpose,
        confirmed: true,
        signerName: "Cliente fictício",
        relationship: "Titular",
        strokes,
        ...extra,
      },
      status,
      auth,
    );
    if (status === 201) await refresh();
    return s;
  };
  await add("Sem permissão", uri, other, 403);
  const p1 = await add();
  assert.equal(p1.data, undefined);
  assert.equal(p1.mime, "image/png");
  assert.equal(p1.width, 64);
  assert.equal(
    p1.digest,
    crypto.createHash("sha256").update(photo).digest("hex"),
  );
  await add("Revisão antiga", uri, token, 409, 1);
  const p2 = await add("Foto do responsável", uri, mechanic);
  assert.equal((await evidence()).photos.length, 2);
  const file = await req(
    "/workshop/orders/" + o.id + "/photos/" + p1.id + "/file",
  );
  assert.ok(file.equals(photo));
  await req(
    "/workshop/orders/" + o.id + "/photos/" + p1.id + "/file",
    "GET",
    undefined,
    401,
    null,
  );
  await add(
    "Imagem falsa",
    "data:image/jpeg;base64," + photo.toString("base64"),
    token,
    400,
  );
  await add("SVG proibido", "data:image/svg+xml;base64,PHN2Zy8+", token, 400);
  await add(
    "Dimensão inválida",
    "data:image/png;base64," + png(2049, 1).toString("base64"),
    token,
    400,
  );
  await add(
    "Filtro inválido",
    "data:image/png;base64," + png(2, 2, 1, 5).toString("base64"),
    token,
    400,
  );
  await add(
    "Grande demais",
    "data:image/png;base64," +
      Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
    token,
    400,
  );
  await sign("approval", 400);
  await step("waiting");
  await step("approved");
  await sign("approval", 403, mechanic);
  await sign("toString", 400);
  await sign("__proto__", 400);
  await sign("approval", 400, token, { strokes: [] });
  await sign("approval", 400, token, {
    strokes: [
      [
        { x: -1, y: 0 },
        { x: 1, y: 1 },
      ],
    ],
  });
  await sign("approval", 400, token, { confirmed: false });
  const signature1 = await sign();
  let data = await evidence();
  assert.equal(data.signatures[0].current, true);
  assert.equal(data.signatures[0].integrity, true);
  assert.equal(signature1.payload.photos.length, 2);
  assert.equal(signature1.payload.scope.notes, body.notes);
  assert.equal(signature1.payload.operator.id, login.user.id);
  await sign("approval", 409);
  await req(
    "/workshop/orders/" + o.id + "/photos/" + p2.id + "/archive",
    "POST",
    { revision: o.revision, reason: "Registro duplicado fictício" },
    403,
    mechanic,
  );
  await req(
    "/workshop/orders/" + o.id + "/photos/" + p2.id + "/archive",
    "POST",
    { revision: o.revision, reason: "Registro duplicado fictício" },
  );
  await refresh();
  assert.ok(
    (
      await req("/workshop/orders/" + o.id + "/photos/" + p2.id + "/file")
    ).equals(photo),
  );
  data = await evidence();
  assert.equal(data.signatures[0].current, true);
  assert.equal(data.signatures[0].payload.photos.length, 2);
  await req(
    "/workshop/orders/" + o.id + "/signatures/" + signature1.id + "/void",
    "POST",
    { revision: o.revision, reason: "Correção de identificação do signatário" },
  );
  await refresh();
  data = await evidence();
  assert.equal(data.signatures[0].current, false);
  assert.ok(data.signatures[0].voidedAt);
  assert.deepEqual(data.signatures[0].payload.strokes, strokes);
  const signature2 = await sign();
  assert.equal(signature2.payload.photos.length, 1);
  assert.notEqual(signature1.digest, signature2.digest);
  await step("in_progress");
  await add("Foto durante execução", uri, mechanic);
  await sign("approval", 400);
  assert.equal(
    (await evidence()).signatures.find((s) => s.id === signature2.id).current,
    true,
  );
  await step("draft", "Revisão do orçamento pelo cliente");
  o = await req("/workshop/orders/" + o.id, "PUT", {
    ...body,
    revision: o.revision,
    notes: "Condição revisada pelo cliente fictício",
    lines: [{ productId: product.id, quantity: 1, unitPrice: 35 }],
  });
  assert.equal(
    (await evidence()).signatures.find((s) => s.id === signature2.id).current,
    false,
  );
  await step("waiting");
  await step("approved");
  const signature3 = await sign();
  assert.equal(Number(signature3.payload.scope.total), 35);
  assert.equal(signature2.payload.scope.total, 30);
  assert.notEqual(signature3.scopeDigest, signature2.scopeDigest);
  await step("in_progress");
  await step("ready");
  await sign("delivery", 400);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 10);
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 0 },
    201,
  );
  await req(
    "/workshop/orders/" + o.id + "/checkout",
    "POST",
    { revision: o.revision, cash_register_id: cash.id, payment_method: "pix" },
    201,
  );
  await refresh();
  await step("delivered");
  const deliverySignature = await sign("delivery");
  assert.equal(deliverySignature.payload.scope.saleId, o.saleId);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 9);
  await add("Depois da entrega", uri, token, 400);
  data = await evidence();
  assert.equal(data.signatures.filter((s) => s.current).length, 2);
  assert.ok(data.signatures.every((s) => s.integrity));
  const pdf = await req("/workshop/orders/" + o.id + "/pdf");
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  fs.writeFileSync("work/workshop-evidence/order.pdf", pdf);
  fs.writeFileSync("work/workshop-evidence/photo.png", photo);
  const otherLogin = await req("/auth/login", "POST", {
    company: slug + "-b",
    username: "catalog.admin",
    password,
  });
  await req(
    "/settings",
    "PUT",
    { businessProfile: "oficina" },
    200,
    otherLogin.token,
  );
  await req(
    "/workshop/orders/" + o.id + "/evidence",
    "GET",
    undefined,
    404,
    otherLogin.token,
  );
  await req(
    "/workshop/orders/" + o.id + "/photos/" + p1.id + "/file",
    "GET",
    undefined,
    404,
    otherLogin.token,
  );
  const foreignOrder = await req("/workshop/orders", "POST", body, 201);
  await req(
    "/workshop/orders/" + foreignOrder.id + "/photos/" + p1.id + "/file",
    "GET",
    undefined,
    404,
  );
  const secret = credentials(),
    platform = await req("/support/login", "POST", {
      username: "support.local",
      password: secret.support,
    }),
    session = await req(
      "/support/sessions",
      "POST",
      { company: slug },
      200,
      platform.token,
    );
  await req(
    "/workshop/orders/" + o.id + "/evidence",
    "GET",
    undefined,
    200,
    session.token,
  );
  await req(
    "/workshop/orders/" + o.id + "/photos/" + p1.id + "/file",
    "GET",
    undefined,
    200,
    session.token,
  );
  await req(
    "/workshop/orders/" + foreignOrder.id + "/photos",
    "POST",
    { revision: foreignOrder.revision, caption: "Bloqueada", image: uri },
    403,
    session.token,
  );
  // Attachment caps count archived originals too, preserving history without unbounded growth.
  const limit = foreignOrder;
  let limited = [];
  for (let n = 0; n < 10; n++) {
    const p = await req(
      "/workshop/orders/" + limit.id + "/photos",
      "POST",
      { revision: limit.revision, caption: "Limite " + n, image: uri },
      201,
    );
    limited.push(p);
    limit.revision++;
  }
  await req(
    "/workshop/orders/" + limit.id + "/photos",
    "POST",
    { revision: limit.revision, caption: "Excesso", image: uri },
    400,
  );
  for (let n = 0; n < 10; n++) {
    await req(
      "/workshop/orders/" + limit.id + "/photos/" + limited[n].id + "/archive",
      "POST",
      { revision: limit.revision, reason: "Teste do limite de histórico" },
    );
    limit.revision++;
    await req(
      "/workshop/orders/" + limit.id + "/photos",
      "POST",
      { revision: limit.revision, caption: "Substituta " + n, image: uri },
      201,
    );
    limit.revision++;
  }
  const all = (await req("/workshop/orders/" + limit.id + "/evidence")).photos;
  assert.equal(all.length, 20);
  const active = all.find((p) => !p.archivedAt);
  await req(
    "/workshop/orders/" + limit.id + "/photos/" + active.id + "/archive",
    "POST",
    { revision: limit.revision, reason: "Teste de retenção" },
  );
  limit.revision++;
  await req(
    "/workshop/orders/" + limit.id + "/photos",
    "POST",
    { revision: limit.revision, caption: "Além do histórico", image: uri },
    400,
  );
  if (process.env.PDV_EVIDENCE_BROWSER_FIXTURE)
    fs.writeFileSync(
      process.env.PDV_EVIDENCE_BROWSER_FIXTURE,
      JSON.stringify({
        login,
        mechanic,
        other,
        body,
        product,
        vehicle,
        customer,
        completedOrderId: o.id,
      }),
      { mode: 0o600 },
    );
  console.log(
    count() +
      " verificações de evidências aprovadas: fotos, limites, conteúdo, assinatura, escopo revisado, histórico, PDF, perfis, suporte e isolamento.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
