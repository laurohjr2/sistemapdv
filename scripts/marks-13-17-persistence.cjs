// Run after marks smoke/browser checks, only in a disposable pdv-*-test project.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/marks/session.json")),
    f = JSON.parse(fs.readFileSync("work/workshop-evidence/fixture.json")),
    g = JSON.parse(fs.readFileSync("work/marks/support.json")),
    { request, count } = client();
  async function snapshot() {
    const result = {};
    for (const [key, token, paths] of [
      [
        "main",
        s.login.token,
        [
          "/workshop-agenda",
          "/workshop-warranty",
          "/part-imports",
          "/loyalty/profiles",
          "/loyalty/history",
          "/products",
          "/sales",
        ],
      ],
      ["evidence", f.login.token, ["/workshop-warranty", "/workshop/orders"]],
      ["central", g.masterToken, ["/support/access-codes?company=" + s.slug]],
    ]) {
      result[key] = {};
      for (const path of paths)
        result[key][path] = await request(path, { token });
    }
    const imports = result.main["/part-imports"];
    result.previews = [];
    for (const batch of imports)
      result.previews.push(
        await request("/part-imports/" + batch.id, { token: s.login.token }),
      );
    assert.ok(result.main["/workshop-agenda"].length);
    assert.ok(result.main["/loyalty/history"].length);
    assert.ok(result.previews.some((b) => b.status === "committed"));
    assert.ok(
      result.central["/support/access-codes?company=" + s.slug].some(
        (g) => g.revokedAt,
      ),
    );
    return result;
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
      " verificações de persistência aprovadas: agenda, garantia, retornos, prévias/importações, fidelidade, benefícios, vendas, estoque e códigos de suporte após recriação/migração.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
