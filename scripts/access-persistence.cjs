const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process"),
  { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/access/session.json")),
    { request, count } = client(),
    read = (p) => request(p, { token: s.login.token });
  async function snapshot() {
    const users = await read("/users"),
      access = [],
      history = [];
    for (const u of users) {
      access.push(await read("/access/users/" + u.id));
      history.push(await read("/access/users/" + u.id + "/history"));
    }
    return {
      users,
      access,
      history,
      catalog: await read("/access/catalog"),
      products: await read("/products"),
      sales: await read("/sales"),
    };
  }
  const before = await snapshot();
  assert.ok(before.history.some((h) => h.length));
  assert.ok(before.access.some((u) => u.access.mode === "restricted"));
  execFileSync(
    "docker",
    [
      "compose",
      "-p",
      project,
      "-f",
      "compose.yaml",
      "-f",
      "docker/customer-experience-test.yaml",
      "-f",
      "work/commerce/compose.test.yaml",
      "up",
      "-d",
      "--no-build",
      "--force-recreate",
      "--wait",
      "--wait-timeout",
      "240",
    ],
    {
      env: { ...process.env, PDV_LOCAL_PORT: "8092" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 300000,
    },
  );
  assert.deepEqual(await snapshot(), before);
  console.log(
    count() +
      " verificações de persistência aprovadas: perfis, exceções, histórico, usuários, vendas e estoque após recriação/migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
