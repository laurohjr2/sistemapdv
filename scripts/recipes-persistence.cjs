// Synthetic companies only; verify migrations and recreation preserve definitions and stock.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/recipes/fixture.json")),
    { request, count } = client();
  const login = await request("/auth/login", {
    method: "POST",
    body: { company: f.company, username: f.username, password: f.password },
  });
  const read = (path) => request(path, { token: login.token });
  const definitions = await read("/recipes"),
    products = await read("/products"),
    sales = await read("/sales");
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
  assert.deepEqual(await read("/recipes"), definitions);
  assert.deepEqual(await read("/products"), products);
  assert.deepEqual(await read("/sales"), sales);
  console.log(
    count() +
      " verificações de persistência aprovadas: fichas, saldos e históricos preservados após recriação e migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
