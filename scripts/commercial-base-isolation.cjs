const { execFileSync } = require("node:child_process"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const {
  project,
  client,
  credentials,
} = require("./testing/commercial-context.cjs");
const { request: r, count } = client(),
  secret = credentials(),
  state = JSON.parse(fs.readFileSync("work/commerce/session.json"));
const slug = "comercial-" + Date.now(),
  password = crypto.randomBytes(24).toString("hex");
const image = execFileSync(
  "docker",
  ["inspect", project + "-backend-1", "--format", "{{.Image}}"],
  { encoding: "utf8" },
).trim();
const fixture = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug:${JSON.stringify(slug)},name:'Empresa comercial isolada',adminUsername:'other.admin',adminPassword:${JSON.stringify(password)}});})().catch(()=>process.exit(1));`;
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
      body: { company: slug, username: "other.admin", password },
    }),
    token = login.token;
  assert.equal((await r("/commerce/suppliers", { token })).length, 0);
  assert.equal((await r("/commerce/quotes", { token })).length, 0);
  assert.equal((await r("/commerce/finance", { token })).entries.length, 0);
  await r("/commerce/quotes/" + state.quote.id, { token, status: 404 });
  await r("/commerce/finance/" + state.account.id, { token, status: 404 });
  await r("/commerce/purchases/" + state.order.id, { token, status: 404 });
  await r("/commerce/purchases", {
    method: "POST",
    token,
    body: {
      supplierId: state.supplier.id,
      lines: [{ productId: state.product.id, quantity: 1, unitCost: 1 }],
    },
    status: 400,
  });
  await r("/support/company-info", { token, status: 403 });
  const master = await r("/support/login", {
    method: "POST",
    body: { username: "master.local", password: secret.master },
  });
  const session = await r("/support/sessions", {
    method: "POST",
    body: { company: slug },
    token: master.token,
  });
  // The first provider access issues several requests concurrently, as the UI does.
  await Promise.all(
    [
      "/settings",
      "/settings/profiles",
      "/auth/validate",
      "/commerce/finance",
      "/users",
      "/settings",
    ].map((path) => r(path, { token: session.token })),
  );
  const account = await r("/commerce/finance", {
    method: "POST",
    body: {
      direction: "receivable",
      description: "Conta da outra empresa",
      partyName: "Cliente avulso",
      amount: 7,
      dueDate: "2099-01-01",
    },
    token: session.token,
    status: 201,
  });
  await r("/commerce/finance/" + account.id, {
    token: state.admin,
    status: 404,
  });
  assert.ok(!(await r("/users", { token })).some((u) => u.platformUserId));
  const support = await r("/support/login", {
    method: "POST",
    body: { username: "support.local", password: secret.support },
  });
  const readonly = await r("/support/sessions", {
    method: "POST",
    body: { company: slug },
    token: support.token,
  });
  await r("/commerce/finance", { token: readonly.token });
  await r("/commerce/finance", {
    method: "POST",
    token: readonly.token,
    body: {
      direction: "receivable",
      description: "Não permitir",
      partyName: "Cliente",
      amount: 1,
      dueDate: "2099-01-01",
    },
    status: 403,
  });
  await r("/support/session/end", {
    method: "POST",
    body: {},
    token: session.token,
    status: 204,
  });
  await r("/commerce/finance", { token: session.token, status: 401 });
  console.log(
    `${count()} verificações de isolamento comercial aprovadas, incluindo a primeira entrada simultânea do Master e o suporte somente para consulta.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
