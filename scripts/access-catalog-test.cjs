const assert = require("node:assert/strict"),
  c = require("../bar-management-system/src/config/accessCatalog"),
  p = require("../bar-management-system/src/services/accessPolicy");
assert.equal(
  new Set(c.permissions.map((p) => p.id)).size,
  c.permissions.length,
);
for (const t of c.templates)
  for (const role of t.roles)
    for (const id of t.permissions)
      assert.ok(c.ceiling(role).includes(id), t.id + " " + role + " " + id);
for (const id of Object.values(c.navigation))
  assert.ok(c.permissions.some((p) => p.id === id));
const req = (url, method = "GET", body = {}, query = {}) =>
  p.required({ originalUrl: "/api" + url, method, body, query });
assert.deepEqual(req("/sales", "POST", { discount_amount: 5 }), [
  "sales.create",
  "discounts.apply",
]);
assert.deepEqual(req("/reports/export/pdf", "GET", {}, { type: "waiters" }), [
  "reports.view",
  "reports.export",
  "reports.ranking",
]);
assert.deepEqual(req("/unknown"), ["unmapped"]);
assert.deepEqual(req("/bundles/price", "POST", { pizzas: [{ slot: 0 }] }), [
  "bundles.view",
  "pizza.view",
]);
assert.deepEqual(
  req("/bundles/comandas/id", "POST", { selection: { pizzas: [{ slot: 0 }] } }),
  ["bundles.view", "tables.edit", "pizza.view"],
);
assert.deepEqual(
  req("/sales", "POST", { items: [{ bundle: { pizzas: [{ slot: 0 }] } }] }),
  ["sales.create", "pizza.view"],
);
assert.deepEqual(
  req("/workshop/orders/abc/status", "POST", { status: "ready" }),
  ["workshop.execute"],
);
assert.deepEqual(
  req("/workshop/orders/abc/status", "POST", { status: "approved" }),
  ["workshop.approve"],
);
assert.deepEqual(req("/sales/1/cancel", "PUT", { restoreIngredients: true }), [
  "sales.cancel",
  "recipes.restore",
]);
assert.deepEqual(
  p.redact({
    product: { name: "Produto", costPrice: 12, salePrice: 20 },
    items: [{ unitCost: 3, quantity: 1 }],
  }),
  { product: { name: "Produto", salePrice: 20 }, items: [{ quantity: 1 }] },
);
console.log(
  "Catálogo, perfis, limites de papel e política de ações sensíveis conferidos.",
);
// Every existing router endpoint must map to a known permission, including aliases.
const fs = require("node:fs");
const prefixes = {
  workshopEvidence: "workshop/orders",
  comandaCustomer: "comandas",
  workshopAgenda: "workshop-agenda",
  workshopWarranty: "workshop-warranty",
  partImport: "part-imports",
  cashRegister: "cash-register",
  waitingQueue: "waiting-queue",
};
let routes = 0;
for (const file of fs
  .readdirSync("bar-management-system/src/routes")
  .filter((f) => f.endsWith(".js") && f !== "passwordRecovery.js")) {
  const name = file.slice(0, -3),
    source = fs.readFileSync(
      "bar-management-system/src/routes/" + file,
      "utf8",
    );
  for (const match of source.matchAll(
    /router\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)/g,
  )) {
    const request = {
      originalUrl:
        "/api/" + (prefixes[name] || name) + (match[2] === "/" ? "" : match[2]),
      method: match[1].toUpperCase(),
      body: { status: "ready" },
      query: {},
    };
    for (const id of p
      .required(request)
      .flatMap((r) => (typeof r === "string" ? [r] : r.any)))
      assert.ok(
        c.permissions.some((permission) => permission.id === id),
        file + " " + match[2] + " " + id,
      );
    routes++;
  }
}
assert.deepEqual(
  JSON.parse(fs.readFileSync("bar-frontend/src/lib/accessNavigation.json")),
  c.navigation,
);
console.log(routes + " rotas classificadas e mapa de navegação sincronizado.");
