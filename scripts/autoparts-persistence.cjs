// Recreate only the disposable test project; never point this at a customer install.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { project, client } = require("./testing/commercial-context.cjs");
const state = JSON.parse(fs.readFileSync("work/autoparts/session.json"));
const { request, count } = client();
(async () => {
  const read = (path) => request(path, { token: state.login.token });
  const before = await read("/autoparts/catalog");
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
  assert.deepEqual(await read("/autoparts/catalog"), before);
  assert.equal(
    (await read("/autoparts/parts/" + state.a.id)).partDetails.partNumber,
    "ALF-100",
  );
  assert.ok(
    (await read("/autoparts/parts/" + state.b.id)).equivalents.some(
      (e) => e.productId === state.a.id,
    ),
  );
  console.log(
    `${count()} verificações de persistência aprovadas após recriar containers e reexecutar migrações; referências, aplicações, equivalências, preços e estoque preservados.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
