// Public checks, including the file actually served by Nginx after an update.
const assert = require("node:assert/strict");
const release = require("../bar-frontend/src/release.json");
const root = (process.env.PDV_TEST_URL || "http://127.0.0.1:8092")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");
(async () => {
  for (const path of ["/api/version", "/release.json"]) {
    const response = await fetch(root + path, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get("cache-control"), "no-store", path);
    assert.deepEqual(await response.json(), release);
  }
  const login = await fetch(root + "/login");
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("cache-control"), "no-store");
  console.log(
    "3 verificações públicas de versão e cache aprovadas: API, arquivo publicado e login.",
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
