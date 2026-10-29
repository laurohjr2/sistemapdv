const assert = require("node:assert/strict");
(async () => {
  const { saveSuccessMessage: message } =
    await import("../bar-frontend/src/lib/saveFeedbackPolicy.js");
  let checks = 0;
  const saved = [
    ["put", "/settings"],
    ["post", "/products"],
    ["put", "/products/id"],
    ["post", "/customers"],
    ["put", "/customers/id"],
    ["post", "/users"],
    ["put", "/users/id"],
    ["put", "/users/id/password"],
    ["post", "/auth/reset-password"],
    ["post", "/tables"],
    ["put", "/tables/id"],
    ["put", "/comandas/id/customer"],
    ["put", "/access/users/id"],
    ["post", "/commerce/quotes"],
    ["put", "/commerce/quotes/id"],
    ["post", "/commerce/suppliers"],
    ["put", "/commerce/suppliers/id"],
    ["post", "/commerce/purchases"],
    ["post", "/commerce/finance"],
    ["post", "/commerce/finance/id/payments"],
    ["post", "/workshop/vehicles"],
    ["put", "/workshop/vehicles/id"],
    ["post", "/workshop/orders"],
    ["put", "/workshop/orders/id"],
    ["post", "/workshop/orders/id/photos"],
    ["post", "/workshop/orders/id/signatures"],
    ["post", "/workshop-agenda"],
    ["put", "/workshop-agenda/id"],
    ["post", "/workshop-warranty"],
    ["put", "/autoparts/parts/id"],
    ["post", "/autoparts/equivalences"],
    ["post", "/deliveries"],
    ["put", "/deliveries/id"],
    ["put", "/recipes/id"],
    ["put", "/pizza/catalog"],
    ["post", "/bundles"],
    ["put", "/bundles/id"],
    ["put", "/scale/settings"],
    ["put", "/scale/products/id"],
    ["put", "/loyalty/profiles/id"],
  ];
  for (const [method, url] of saved) {
    assert.ok(message({ method, url }), method + " " + url);
    assert.equal(message({ method, url, saveSuccess: false }), null);
    assert.equal(message({ method: "get", url }), null);
    checks += 3;
  }
  for (const url of [
    "/auth/login",
    "/auth/forgot-password",
    "/support/login",
    "/support/access-code",
    "/bundles/price",
    "/pizza/price",
    "/loyalty/quote",
    "/loyalty/comandas/id/quote",
    "/scale/scan",
    "/scale/labels",
    "/part-imports/headers",
    "/part-imports/preview",
    "/print/receipt/id",
    "/commerce/quotes/id/convert",
    "/sales",
    "/comandas/id/items",
  ]) {
    assert.equal(message({ method: "post", url }), null, url);
    checks++;
  }
  assert.equal(
    message({ method: "PUT", url: "https://pdv.invalid/api/settings?check=1" }),
    "Configurações salvas com sucesso.",
  );
  checks++;
  assert.equal(
    message({
      method: "patch",
      url: "/future",
      saveSuccess: "Cadastro salvo.",
    }),
    "Cadastro salvo.",
  );
  checks++;
  assert.equal(
    message({ method: "get", url: "/future", saveSuccess: "Cadastro salvo." }),
    null,
  );
  checks++;
  console.log(
    checks +
      " verificações de confirmação de salvamento aprovadas: cadastros, consultas silenciosas, prévias, login, opt-out e confirmação explícita.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
