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
