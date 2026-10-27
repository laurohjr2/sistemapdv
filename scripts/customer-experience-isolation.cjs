const { execFileSync } = require("node:child_process"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
const project = "pdv-changes-test",
  args = [
    "compose",
    "-p",
    project,
    "-f",
    "compose.yaml",
    "-f",
    "docker/customer-experience-test.yaml",
  ];
const base = "http://127.0.0.1:8090/api",
  state = JSON.parse(fs.readFileSync("work/test-session.json"));
const password = crypto.randomBytes(24).toString("hex"),
  slug = "isolamento-" + Date.now();
const script = `(async()=>{process.env.DB_PASSWORD=require('node:fs').readFileSync('/secrets/postgres-password','utf8').trim();const result=await require('/app/bar-management-system/src/tenancy/provision').provisionTenant({slug:${JSON.stringify(slug)},name:'Empresa de teste de isolamento',adminUsername:'other.admin',adminPassword:${JSON.stringify(password)}});})().catch(()=>process.exit(1));`;
execFileSync(
  "docker",
  [...args, "run", "--rm", "--no-deps", "provision", "node", "-e", script],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const creds = execFileSync(
  "docker",
  [
    ...args,
    "run",
    "--rm",
    "--no-deps",
    "provision",
    "node",
    "/app/docker/local.cjs",
    "credentials",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const masterPassword = /^Senha Master: (.+)$/m.exec(creds)[1];
let checks = 0;
async function req(path, method = "GET", body, token, status = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : null;
  assert.equal(r.status, status, path + " " + data?.error);
  checks++;
  return data;
}
(async () => {
  const token = (
    await req("/auth/login", "POST", {
      company: slug,
      username: "other.admin",
      password,
    })
  ).token;
  assert.equal((await req("/customers", "GET", undefined, token)).length, 0);
  await req("/comandas", "POST", { tableId: state.table.id }, token, 404);
  assert.equal((await req("/sales", "GET", undefined, token)).length, 0);
  await req("/support/company-info", "GET", undefined, token, 403);
  const master = await req("/support/login", "POST", {
    username: "master.local",
    password: masterPassword,
  });
  const session = await req(
    "/support/sessions",
    "POST",
    { company: slug },
    master.token,
  );
  await req(
    "/settings",
    "PUT",
    { companyName: "Empresa isolada visitada pelo Master" },
    session.token,
  );
  const info = await req(
    "/support/company-info",
    "GET",
    undefined,
    session.token,
  );
  assert.ok(info.clientId);
  await req("/support/session/end", "POST", {}, session.token, 204);
  await req("/settings", "GET", undefined, session.token, 401);
  assert.notEqual(
    (await req("/settings", "GET", undefined, state.adminToken)).companyName,
    "Empresa isolada visitada pelo Master",
  );
  console.log(
    `${checks} verificações de isolamento e acesso Master entre empresas aprovadas.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
