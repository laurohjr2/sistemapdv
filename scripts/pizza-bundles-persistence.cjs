// Only the disposable synthetic tenant from pizza-bundles-smoke.cjs.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark22/session.json"));
  assert.match(s.slug, /^pizza-combo-/);
  const { request, count } = client(),
    read = (p) => request(p, { token: s.login.token });
  async function snapshot() {
    const rows = (await read("/comandas?limit=1000")).comandas,
      accounts = [];
    for (const c of rows) accounts.push(await read("/comandas/" + c.id));
    return {
      accounts,
      bundles: await read("/bundles"),
      menu: await read("/pizza/catalog"),
      products: await read("/products"),
      sales: await read("/sales"),
      tables: await read("/tables"),
      deliveries: await read("/deliveries"),
    };
  }
  const before = await snapshot();
  assert.ok(
    before.accounts.some((c) => c.items.some((i) => i.pizza && i.bundle)),
  );
  assert.ok(before.sales.some((s) => s.items.some((i) => i.pizza && i.bundle)));
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
      " verificações de persistência aprovadas: pizzas/combos, montagens, estoque, vendas, mesas, entregas e cardápio após recriação/migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
