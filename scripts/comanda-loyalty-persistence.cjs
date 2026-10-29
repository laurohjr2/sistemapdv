const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process"),
  { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark20/session.json")),
    { request, count } = client(),
    read = (p) => request(p, { token: s.login.token });
  async function snapshot() {
    const list = await read("/comandas?limit=1000"),
      details = [];
    for (const c of list.comandas)
      details.push(await read("/comandas/" + c.id));
    const history = await read("/loyalty/history?customerId=" + s.customer.id);
    assert.ok(history.some((b) => b.source === "comanda"));
    return {
      list,
      details,
      history,
      profiles: await read("/loyalty/profiles"),
      products: await read("/products"),
      sales: await read("/sales"),
      tables: await read("/tables"),
    };
  }
  const before = await snapshot();
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
      " verificações de persistência aprovadas: fidelidade, snapshots, pagamentos, comandas, mesas, vendas e estoque após recriação/migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
