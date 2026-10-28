// Only the disposable test project, no customer installation.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { project, client } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/market/session.json")),
  { request, count } = client();
(async () => {
  const read = (path) => request(path, { token: s.login.token });
  const before = await read("/market/lots"),
    stock = await read("/products");
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
  assert.deepEqual(await read("/market/lots"), before);
  assert.deepEqual(await read("/products"), stock);
  const pdf = await read("/market/report");
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from("%PDF-")));
  console.log(
    `${count()} verificações de persistência aprovadas após recriar containers e reexecutar migrações; lotes, saldos pendentes, preços e disponibilidade preservados.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
