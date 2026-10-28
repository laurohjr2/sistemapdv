// Integration across all stock movement entry points, only on the disposable test tenant.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { client } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/market/session.json")),
  { request, count } = client();
const r = (path, method = "GET", body, status = 200) =>
  request(path, { method, body, status, token: s.login.token });
(async () => {
  const { product } = await r(
    "/products",
    "POST",
    {
      name: "Arroz integração lotes " + Date.now(),
      category: "alimentos",
      unitOfMeasure: "kg",
      costPrice: 1,
      salePrice: 10,
    },
    201,
  );
  await r("/market/products/" + product.id + "/control", "POST", {
    enabled: true,
  });
  await r(
    "/stock/add",
    "POST",
    {
      productId: product.id,
      quantity: 10,
      batchNumber: "INTEGRACAO",
      expirationDate: "2099-01-01",
    },
    201,
  );
  async function consistent(expected) {
    const p = await r("/products/" + product.id),
      lots = (await r("/market/lots")).filter(
        (l) => l.productId === product.id,
      );
    assert.equal(
      Math.round(Number(p.currentStock) * 1000),
      Math.round(expected * 1000),
    );
    assert.equal(
      lots.reduce((sum, l) => sum + Math.round(Number(l.quantity) * 1000), 0),
      Math.round(expected * 1000),
    );
    return lots;
  }
  const ticket = await r(
    "/tickets",
    "POST",
    { productId: product.id, quantity: 1, paymentMethod: "pix" },
    201,
  );
  await consistent(9);
  await r("/tickets/" + ticket.ticket_number + "/cancel", "POST", {});
  let lots = await consistent(10);
  assert.equal(Number(lots.find((l) => l.kind === "return").quantity), 1);
  await r("/settings", "PUT", { modules: { tables: true, kitchen: false } });
  const { comanda } = await r(
    "/comandas",
    "POST",
    { type: "balcao", customerName: "Integração por lote" },
    201,
  );
  const { item } = await r(
    "/comandas/" + comanda.id + "/items",
    "POST",
    { productId: product.id, quantity: 1.25 },
    201,
  );
  await consistent(8.75);
  await r(`/comandas/${comanda.id}/items/${item.id}`, "PUT", { quantity: 1.5 });
  await consistent(8.5);
  await r(`/comandas/${comanda.id}/items/${item.id}`, "DELETE");
  await consistent(10);
  await r(
    "/comandas/" + comanda.id + "/items",
    "POST",
    { productId: product.id, quantity: 2 },
    201,
  );
  await consistent(8);
  await r("/comandas/" + comanda.id + "/cancel", "PUT", {
    reason: "Conferência de integração",
  });
  await consistent(10);
  await r("/stock/adjust", "POST", {
    productId: product.id,
    newQuantity: 12,
    notes: "Inventário conferido",
  });
  await consistent(12);
  await r("/stock/adjust", "POST", {
    productId: product.id,
    newQuantity: 11,
    notes: "Correção de inventário",
  });
  await consistent(11);
  const supplier = await r(
    "/commerce/suppliers",
    "POST",
    { name: "Fornecedor de lotes teste" },
    201,
  );
  const order = await r(
    "/commerce/purchases",
    "POST",
    {
      supplierId: supplier.id,
      lines: [{ productId: product.id, quantity: 3, unitCost: 1 }],
    },
    201,
  );
  const receipt = {
    requestKey: crypto.randomUUID(),
    dueDate: "2099-01-01",
    lines: [{ lineId: order.lines[0].lineId, quantity: 3 }],
  };
  await r(`/commerce/purchases/${order.id}/receive`, "POST", receipt, 201);
  await consistent(14);
  await r(`/commerce/purchases/${order.id}/receive`, "POST", receipt, 201);
  lots = await consistent(14);
  assert.ok(Number(lots.find((l) => l.kind === "unidentified").quantity) >= 3);
  console.log(
    `${count()} verificações de integração aprovadas: tickets, comandas com quantidades fracionadas, remoção/cancelamento, ajustes e recebimento de compra idempotente; soma dos lotes igual ao estoque total em cada etapa.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
