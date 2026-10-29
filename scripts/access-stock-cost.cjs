const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { client } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/access/session.json")),
    { request, count } = client(),
    r = (p, method = "GET", body, status = 200, token = s.login.token) =>
      request(p, { method, body, status, token });
  const name = "estoque.limite." + Date.now();
  await r(
    "/users",
    "POST",
    { username: name, password: s.password, role: "gerente" },
    201,
  );
  const user = await r("/auth/login", "POST", {
    company: s.slug,
    username: name,
    password: s.password,
  });
  await r("/access/users/" + user.user.id, "PUT", {
    mode: "restricted",
    permissions: ["stock.view", "stock.add", "products.read"],
    revision: 0,
    reason: "Somente quantidades, sem alteração de custos",
  });
  await r(
    "/stock/add",
    "POST",
    { productId: s.product.id, quantity: 1, unitCost: 99 },
    403,
    user.token,
  );
  await r(
    "/stock/add",
    "POST",
    { productId: s.product.id, quantity: 1 },
    201,
    user.token,
  );
  assert.equal(Number((await r("/products/" + s.product.id)).costPrice), 12);
  console.log(
    count() +
      " verificações adicionais aprovadas: entrada em quantidade permitida, custo protegido.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
