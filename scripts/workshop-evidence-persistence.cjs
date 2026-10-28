// Synthetic companies only; verify attachments, immutable signatures and stock survive recreation.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/workshop-evidence/fixture.json")),
    { request, count } = client();
  const read = (path) => request(path, { token: f.login.token });
  async function snapshot() {
    const orders = await read("/workshop/orders");
    const records = [];
    for (const order of orders) {
      const evidence = await read(`/workshop/orders/${order.id}/evidence`);
      const files = [];
      for (const photo of evidence.photos) {
        const data = await read(
          `/workshop/orders/${order.id}/photos/${photo.id}/file`,
        );
        const hash = require("node:crypto")
          .createHash("sha256")
          .update(data)
          .digest("hex");
        assert.equal(hash, photo.digest);
        files.push({ id: photo.id, hash, bytes: data.length });
      }
      records.push({ order, evidence, files });
    }
    assert.ok(records.some((r) => r.evidence.signatures.length > 0));
    assert.ok(records.some((r) => r.evidence.photos.some((p) => p.archivedAt)));
    return {
      records,
      products: await read("/products"),
      sales: await read("/sales"),
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
      " verificações de persistência aprovadas: fotos ativas e arquivadas, arquivos, assinaturas, escopos, OS, vendas e estoque preservados após recriação e migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
