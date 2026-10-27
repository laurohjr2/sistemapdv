const assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const project = process.env.PDV_TEST_PROJECT || "pdv-commerce-test";
assert.match(
  project,
  /^pdv-.*-test$/,
  "Use apenas um projeto descartável de teste",
);
const rootUrl = (process.env.PDV_TEST_URL || "http://127.0.0.1:8092")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");
function credentials() {
  const output = execFileSync(
    "docker",
    [
      "compose",
      "-p",
      project,
      "-f",
      "compose.yaml",
      "-f",
      "docker/customer-experience-test.yaml",
      "run",
      "--rm",
      "--no-deps",
      "provision",
      "node",
      "/app/docker/local.cjs",
      "credentials",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  return {
    admin: [...output.matchAll(/^Senha: (.+)$/gm)][0][1],
    support: [...output.matchAll(/^Senha: (.+)$/gm)][1][1],
    master: /^Senha Master: (.+)$/m.exec(output)[1],
  };
}
function client() {
  let checks = 0;
  async function request(
    path,
    { method = "GET", body, token, status = 200 } = {},
  ) {
    const r = await fetch(rootUrl + "/api" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : Buffer.from(await r.arrayBuffer());
    if (Array.isArray(status))
      assert.ok(
        status.includes(r.status),
        method + " " + path + " " + r.status + " " + (data.error || ""),
      );
    else
      assert.equal(
        r.status,
        status,
        method + " " + path + " " + (data.error || ""),
      );
    if (data && typeof data === "object")
      Object.defineProperty(data, "responseStatus", { value: r.status });
    checks++;
    return data;
  }
  return { request, count: () => checks };
}
module.exports = { project, rootUrl, credentials, client };
