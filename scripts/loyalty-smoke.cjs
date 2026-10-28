const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, credentials } = require("./testing/commercial-context.cjs"),
  s = JSON.parse(fs.readFileSync("work/workshop/session.json")),
  { request, count } = client();
const r = (path, method = "GET", body, status = 200, token = s.login.token) =>
  request(path, { method, body, status, token });
(async () => {
  const c = await r(
      "/customers",
      "POST",
      { name: "Fidelidade sintética " + Date.now() },
      201,
    ),
    body = {
      label: "Cliente prata",
      percent: 10,
      validUntil: "",
      active: true,
      reason: "Adesão solicitada pelo cliente",
      revision: 0,
    };
  const pass = credentials(),
    supplier = await r("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    }),
    support = await r(
      "/support/sessions",
      "POST",
      { company: s.slug },
      200,
      supplier.token,
    );
  await r("/loyalty/profiles/" + c.id, "PUT", body, 403, s.employee.token);
  await r("/loyalty/profiles/" + c.id, "PUT", body, 403, support.token);
  await r("/loyalty/profiles/" + c.id, "PUT", { ...body, percent: 51 }, 400);
  let p = await r("/loyalty/profiles/" + c.id, "PUT", body);
  await r("/loyalty/profiles/" + c.id, "PUT", body, 409);
  const quote = await r("/loyalty/quote", "POST", {
    customerId: c.id,
    subtotal: 123.45,
    revision: p.revision,
  });
  assert.equal(quote.discount, 1235);
  let product = await r(
    "/products",
    "POST",
    {
      name: "Serviço fidelidade " + Date.now(),
      itemType: "service",
      category: "servicos",
      unitOfMeasure: "servico",
      costPrice: 0,
      salePrice: 100,
      currentStock: 0,
      minStockAlert: 0,
      active: true,
    },
    201,
  );
  product = product.product || product;
  const cash = await r("/cash-register/status"),
    saleBody = {
      items: [{ product_id: product.id, quantity: 1 }],
      customerId: c.id,
      discount_amount: 10,
      payment_method: "pix",
      cash_register_id: cash.id,
      loyalty: { customerId: c.id, revision: p.revision },
    };
  await r("/sales", "POST", saleBody, 403, s.employee.token);
  await r("/sales", "POST", { ...saleBody, discount_amount: 11 }, 409);
  await r(
    "/sales",
    "POST",
    { ...saleBody, loyalty: { customerId: c.id, revision: 0 } },
    409,
  );
  const sale = await r("/sales", "POST", saleBody, 201);
  assert.equal(Number(sale.total_amount), 90);
  assert.ok(sale.notes.includes("Cliente prata"));
  assert.equal(Number(sale.discount_amount), 10);
  p = await r("/loyalty/profiles/" + c.id, "PUT", {
    ...body,
    revision: p.revision,
    percent: 15,
    label: "Cliente ouro",
    reason: "Nova condição aprovada",
  });
  let history = await r("/loyalty/history?customerId=" + c.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].profile.basisPoints, 1000);
  assert.equal(history[0].profile.label, "Cliente prata");
  await r("/sales", "POST", saleBody, 409);
  await r("/sales/" + sale.id + "/cancel", "PUT", {});
  history = await r("/loyalty/history?customerId=" + c.id);
  assert.equal(history[0].sale.status, "cancelled");
  assert.equal(Number(history[0].discount), 10);
  p = await r("/loyalty/profiles/" + c.id, "PUT", {
    ...body,
    revision: p.revision,
    active: false,
    reason: "Pausa solicitada",
  });
  await r(
    "/loyalty/quote",
    "POST",
    { customerId: c.id, subtotal: 100, revision: p.revision },
    400,
  );
  p = await r("/loyalty/profiles/" + c.id, "PUT", {
    ...body,
    revision: p.revision,
    validUntil: "2000-01-01",
    reason: "Condição histórica",
  });
  await r(
    "/loyalty/quote",
    "POST",
    { customerId: c.id, subtotal: 100, revision: p.revision },
    400,
  );
  await r("/loyalty/profiles/" + c.id, "PUT", body, 404, s.second.token);
  assert.ok(
    !(await r("/loyalty/history", "GET", undefined, 200, s.second.token)).some(
      (b) => b.customerId === c.id,
    ),
  );
  const pdf = await r("/loyalty/history.pdf?customerId=" + c.id);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  fs.writeFileSync("work/marks/fidelidade.pdf", pdf);
  assert.ok(
    (await r("/loyalty/profiles", "GET", undefined, 200, support.token)).some(
      (x) => x.customerId === c.id,
    ),
  );
  fs.writeFileSync(
    "work/marks/loyalty.json",
    JSON.stringify({
      customerId: c.id,
      productId: product.id,
      saleId: sale.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações de fidelidade aprovadas: percentual, validade, revisão, venda recalculada, cupom, snapshot, cancelamento e isolamento.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
