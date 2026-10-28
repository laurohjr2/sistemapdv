const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const {
    client,
    credentials,
    project,
  } = require("./testing/commercial-context.cjs"),
  s = JSON.parse(fs.readFileSync("work/workshop/session.json")),
  { request, count } = client();
const r = (path, method = "GET", body, status = 200, token) =>
  request(path, { method, body, status, token });
(async () => {
  const pass = credentials(),
    master = await r("/support/login", "POST", {
      username: "master.local",
      password: pass.master,
    }),
    support = await r("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    });
  const operators = await r(
      "/support/access-codes/operators",
      "GET",
      undefined,
      200,
      master.token,
    ),
    operator = operators.find((u) => u.username === "support.local");
  assert.ok(operator);
  assert.ok(operators.every((u) => !u.passwordHash));
  await r(
    "/support/access-codes/operators",
    "GET",
    undefined,
    403,
    support.token,
  );
  await r(
    "/support/access-codes/operators",
    "GET",
    undefined,
    401,
    s.login.token,
  );
  const body = {
    company: s.slug,
    supportUserId: operator.id,
    minutes: 15,
    reason: "Diagnóstico sintético autorizado pelo Master",
  };
  await r(
    "/support/access-codes",
    "POST",
    { ...body, minutes: 999 },
    400,
    master.token,
  );
  await r("/support/access-codes", "POST", body, 403, support.token);
  const issue = () =>
    r("/support/access-codes", "POST", body, 201, master.token);
  let g = await issue();
  assert.equal(g.code.length, 43);
  assert.equal(g.codeHash, undefined);
  await r(
    "/support/access-code",
    "POST",
    { username: "master.local", code: g.code },
    401,
  );
  await r(
    "/support/access-code",
    "POST",
    { username: "support.local", code: "x".repeat(43) },
    401,
  );
  const login = await r("/support/access-code", "POST", {
    username: "support.local",
    code: g.code,
    company: s.slug + "-b",
  });
  assert.equal(login.user.company, s.slug);
  assert.equal(login.user.master, false);
  assert.equal(login.user.support, true);
  await r(
    "/support/access-code",
    "POST",
    { username: "support.local", code: g.code },
    401,
  );
  await r("/products", "GET", undefined, 200, login.token);
  await r("/products", "POST", { name: "Bloqueado" }, 403, login.token);
  await r("/support/companies", "GET", undefined, 401, login.token);
  await r("/support/access-codes", "POST", body, 401, login.token);
  const info = await r(
    "/support/company-info",
    "GET",
    undefined,
    200,
    login.token,
  );
  assert.equal(info.company, s.slug);
  const list = await r(
    "/support/access-codes?company=" + s.slug,
    "GET",
    undefined,
    200,
    master.token,
  );
  assert.ok(list.some((x) => x.id === g.id && x.usedAt));
  assert.ok(
    list.every((x) => x.code === undefined && x.codeHash === undefined),
  );
  await r(
    "/support/access-codes/" + g.id + "/revoke",
    "POST",
    { reason: "Atendimento encerrado" },
    200,
    master.token,
  );
  await r("/products", "GET", undefined, 401, login.token);
  g = await issue();
  await r(
    "/support/access-codes/" + g.id + "/revoke",
    "POST",
    { reason: "Não será usado" },
    200,
    master.token,
  );
  await r(
    "/support/access-code",
    "POST",
    { username: "support.local", code: g.code },
    401,
  );
  g = await issue();
  const results = await Promise.all([
    r(
      "/support/access-code",
      "POST",
      { username: "support.local", code: g.code },
      [200, 401],
    ),
    r(
      "/support/access-code",
      "POST",
      { username: "support.local", code: g.code },
      [200, 401],
    ),
  ]);
  assert.equal(results.filter((x) => x.responseStatus === 200).length, 1);
  await r(
    "/support/access-codes/" + g.id + "/revoke",
    "POST",
    { reason: "Teste de concorrência encerrado" },
    200,
    master.token,
  );
  const short = await r(
    "/support/access-codes",
    "POST",
    { ...body, minutes: 5 },
    201,
    master.token,
  );
  const shortLogin = await r("/support/access-code", "POST", {
    username: "support.local",
    code: short.code,
  });
  assert.ok(+new Date(shortLogin.expiresAt) <= +new Date(short.expiresAt));
  const claims = JSON.parse(
    Buffer.from(shortLogin.token.split(".")[1], "base64url").toString(),
  );
  assert.equal(claims.scope, "support-session");
  assert.ok(claims.exp - claims.iat <= 300);
  const expireSession = `(async()=>{const p=require('/app/bar-management-system/src/tenancy/platform').platform();try{const g=await p.SupportGrant.findByPk(${JSON.stringify(short.id)});const tenant=await p.Tenant.findByPk(g.tenantId);if(tenant.slug!==${JSON.stringify(s.slug)}||!tenant.slug.startsWith('oficina-'))throw Error('Fixture inválida');await p.SupportSession.update({expiresAt:new Date(Date.now()-60000)},{where:{id:g.sessionId}});}finally{await p.sequelize.close()}})().catch(e=>{console.error(e.name);process.exitCode=1});`;
  execFileSync("docker", ["exec", "-i", project + "-backend-1", "node"], {
    input: expireSession,
    stdio: ["pipe", "pipe", "pipe"],
  });
  await r("/products", "GET", undefined, 401, shortLogin.token);
  const expired = await issue();
  const script = `(async()=>{const p=require('/app/bar-management-system/src/tenancy/platform').platform();try{const g=await p.SupportGrant.findByPk(${JSON.stringify(expired.id)});const tenant=await p.Tenant.findByPk(g.tenantId);if(tenant.slug!==${JSON.stringify(s.slug)}||!tenant.slug.startsWith('oficina-'))throw Error('Fixture inválida');await g.update({expiresAt:new Date(Date.now()-60000)});}finally{await p.sequelize.close()}})().catch(e=>{console.error(e.name);process.exitCode=1});`;
  execFileSync("docker", ["exec", "-i", project + "-backend-1", "node"], {
    input: script,
    stdio: ["pipe", "pipe", "pipe"],
  });
  await r(
    "/support/access-code",
    "POST",
    { username: "support.local", code: expired.code },
    401,
  );
  fs.writeFileSync(
    "work/marks/support.json",
    JSON.stringify({
      masterToken: master.token,
      operatorId: operator.id,
      grantId: expired.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações de acesso temporário aprovadas: exclusividade Master, código forte/único, empresa, leitura, concorrência, revogação e expiração. Nenhum código foi exibido nos logs.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
