// Compare a disposable source project with a fresh project restored by restaurar-backup.ps1.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  project: source,
  rootUrl,
  credentials,
} = require("./testing/commercial-context.cjs");
const target = process.env.PDV_RESTORE_PROJECT || "pdv-recovery-test-20261027";
const targetUrl = process.env.PDV_RESTORE_URL || "http://127.0.0.1:8094";
assert.match(source, /^pdv-.*-test$/);
assert.match(target, /^pdv-recovery-test-[a-z0-9-]+$/);
assert.notEqual(source, target);
let checks = 0;
function sql(project, database, query) {
  return execFileSync(
    "docker",
    [
      "exec",
      project + "-database-1",
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      database,
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    },
  ).trim();
}
function fingerprint(project, database) {
  const query = sql(
    project,
    database,
    `SELECT string_agg(format('SELECT %L AS name, count(*) AS n, md5(coalesce(string_agg(to_jsonb(t)::text, CHR(10) ORDER BY to_jsonb(t)::text), '''')) AS digest FROM %I.%I t',tablename,schemaname,tablename),' UNION ALL ' ORDER BY tablename) FROM pg_tables WHERE schemaname='public'`,
  );
  return sql(
    project,
    database,
    "SELECT * FROM (" + query + ") hashes ORDER BY name",
  );
}
async function request(root, path, token, body, status = 200) {
  const response = await fetch(root + "/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  assert.equal(response.status, status, path + " " + (data.error || ""));
  checks++;
  return data;
}
function normalize(value) {
  if (Array.isArray(value)) {
    const rows = value.map(normalize);
    return rows.every((r) => r && typeof r === "object" && r.id)
      ? rows.sort((a, b) => String(a.id).localeCompare(String(b.id)))
      : rows;
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, normalize(value[k])]),
    );
  return value;
}
(async () => {
  const query =
    "SELECT datname FROM pg_database WHERE datname NOT IN ('postgres','template0','template1') ORDER BY datname";
  const databases = sql(source, "postgres", query).split("\n");
  assert.deepEqual(sql(target, "postgres", query).split("\n"), databases);
  checks++;
  // Run before login/session audit inserts. This compares every public table and every row.
  for (const database of databases) {
    assert.equal(
      fingerprint(target, database),
      fingerprint(source, database),
      "Conteudo divergente no banco " + database,
    );
    checks++;
  }
  const secret = credentials();
  const tokens = [];
  for (const root of [rootUrl, targetUrl])
    tokens.push(
      (
        await request(root, "/auth/login", null, {
          company: "demo",
          username: "admin.local",
          password: secret.admin,
        })
      ).token,
    );
  for (const path of [
    "/settings",
    "/products",
    "/customers",
    "/commerce/quotes",
    "/commerce/purchases",
    "/commerce/finance",
  ]) {
    const a = await request(rootUrl, path, tokens[0]),
      b = await request(targetUrl, path, tokens[1]);
    assert.deepEqual(normalize(b), normalize(a), path);
  }
  const masters = [];
  for (const root of [rootUrl, targetUrl])
    masters.push(
      (
        await request(root, "/support/login", null, {
          username: "master.local",
          password: secret.master,
        })
      ).token,
    );
  const original = await request(rootUrl, "/support/companies", masters[0]);
  const companies = await request(targetUrl, "/support/companies", masters[1]);
  assert.deepEqual(normalize(companies), normalize(original));
  const master = await request(targetUrl, "/support/sessions", masters[1], {
    company: "demo",
  });
  const info = await request(targetUrl, "/support/company-info", master.token);
  assert.ok(info.clientId);
  assert.equal(info.clientId, companies.find((c) => c.slug === "demo").id);
  const other = companies.find((c) => c.slug !== "demo");
  assert.ok(other);
  const session = await request(targetUrl, "/support/sessions", masters[1], {
    company: other.slug,
  });
  const products = await request(targetUrl, "/products", tokens[1]);
  assert.ok(products.length);
  await request(
    targetUrl,
    "/products/" + products[0].id,
    session.token,
    undefined,
    404,
  );
  const support = await request(targetUrl, "/support/login", null, {
    username: "support.local",
    password: secret.support,
  });
  const readOnly = await request(
    targetUrl,
    "/support/sessions",
    support.token,
    { company: "demo" },
  );
  await request(targetUrl, "/settings", readOnly.token);
  await request(
    targetUrl,
    "/commerce/finance",
    readOnly.token,
    {
      direction: "receivable",
      description: "Recusar alteracao",
      partyName: "Teste",
      amount: 1,
      dueDate: "2099-01-01",
    },
    403,
  );
  console.log(
    `${checks} verificacoes de recuperacao aprovadas: ${databases.length} bancos com todas as tabelas e linhas identicas, usuarios, Master/ID, suporte e isolamento entre empresas.`,
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
