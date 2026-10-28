// Synthetic fixture only: deliveries may finish after the original register closes.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/delivery/fixture.json")),
    { request, count } = client();
  const login = await request("/auth/login", {
    method: "POST",
    body: { company: f.company, username: f.username, password: f.password },
  });
  const req = (p, method = "GET", body, status = 200) =>
    request(p, { method, body, status, token: login.token });
  let cash = await req("/cash-register/status");
  if (!cash.is_open)
    cash = await req("/cash-register/open", "POST", { opening_amount: 0 }, 201);
  const t = await req(
    "/tickets",
    "POST",
    { productId: f.productId, quantity: 1 },
    201,
  );
  const contact = {
    customerName: "Cliente com caixa fechado",
    phone: "11999990000",
    address: {
      street: "Rua de Teste",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
    },
  };
  await req("/deliveries", "POST", { ...contact, saleId: t.sale_id }, 400);
  await req("/tickets/" + t.ticket_number + "/cancel", "POST", {});
  const before = Number((await req("/products/" + f.productId)).currentStock),
    sale = await req(
      "/sales",
      "POST",
      {
        cash_register_id: cash.id,
        payment_method: "pix",
        items: [{ product_id: f.productId, quantity: 1 }],
      },
      201,
    );
  let d = await req(
    "/deliveries",
    "POST",
    { ...contact, saleId: sale.id },
    201,
  );
  for (const status of ["preparing", "ready"])
    d = await req("/deliveries/" + d.id + "/status", "POST", {
      status,
      revision: d.revision,
    });
  await req("/cash-register/close", "POST", { closing_amount: 0 });
  d = await req("/deliveries/" + d.id + "/status", "POST", {
    status: "dispatched",
    revision: d.revision,
    courierName: "Entregador após fechamento",
  });
  d = await req("/deliveries/" + d.id + "/status", "POST", {
    status: "delivered",
    revision: d.revision,
  });
  assert.equal(d.status, "delivered");
  assert.equal((await req("/sales/" + sale.id)).status, "completed");
  assert.equal(
    Number((await req("/products/" + f.productId)).currentStock),
    before - 1,
  );
  await req("/sales/" + sale.id + "/cancel", "PUT", {}, 400);
  await req("/cash-register/open", "POST", { opening_amount: 0 }, 201);
  console.log(
    count() +
      " verificações adicionais aprovadas: ticket não vira entrega, entrega concluída após fechar caixa, estoque/recebimento únicos e estorno bloqueado.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
