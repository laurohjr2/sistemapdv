const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { project, client } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/scale/session.json")),
  { request, count } = client();
(async () => {
  const read = (p) => request(p, { token: s.login.token }),
    settings = await read("/scale/settings"),
    bindings = await read("/scale/products"),
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
  assert.deepEqual(await read("/scale/settings"), settings);
  assert.deepEqual(await read("/scale/products"), bindings);
  assert.deepEqual(await read("/sales"), sales);
  console.log(
    `${count()} verificações de persistência aprovadas: configuração, PLUs, preços conferidos e vendas com etiquetas preservados após recriar containers e migrar.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
