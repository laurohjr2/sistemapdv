// Run after workshop-smoke.cjs, using the same disposable test project.
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/workshop/session.json"));
const { request, count } = client();
const r = (path, method = "GET", body, status = 200) =>
  request(path, { method, body, status, token: s.login.token });
(async () => {
  let o = await r("/workshop/orders", "POST", s.body, 201);
  const step = async (status, note = "Registro sintético") =>
    (o = await r(`/workshop/orders/${o.id}/status`, "POST", {
      status,
      note,
      revision: o.revision,
    }));
  for (const status of ["waiting", "approved", "draft"]) await step(status);
  assert.equal(o.approvedAt, null);
  assert.equal(o.approvalNote, null);
  assert.equal(o.events.filter((e) => e.action === "approved").length, 1);
  o = await r("/workshop/orders/" + o.id, "PUT", {
    ...s.body,
    discount: 10,
    revision: o.revision,
  });
  for (const status of ["waiting", "approved", "in_progress", "ready"])
    await step(status, "Novo aceite após alterar desconto");
  const scopes = o.events
    .filter((e) => e.action === "approved")
    .map((e) => e.budget);
  assert.equal(scopes.length, 2);
  assert.equal(Number(scopes[0].total), 65);
  assert.equal(Number(scopes[1].total), 60);
  const cash = await r("/cash-register/status");
  const checkout = () =>
    r(
      `/workshop/orders/${o.id}/checkout`,
      "POST",
      {
        revision: o.revision,
        cash_register_id: cash.id,
        payment_method: "pix",
      },
      201,
    );
  let sale = await checkout();
  o = await r("/workshop/orders/" + o.id);
  const results = await Promise.all([
    r("/sales/" + sale.id + "/cancel", "PUT", {}, [200, 400]),
    r(
      `/workshop/orders/${o.id}/status`,
      "POST",
      {
        revision: o.revision,
        status: "delivered",
        note: "Entrega concorrente",
      },
      [200, 400, 409],
    ),
  ]);
  o = await r("/workshop/orders/" + o.id);
  assert.ok(
    (o.status === "delivered" && o.sale.status === "completed") ||
      (o.status === "ready" && o.sale.status === "cancelled"),
  );
  assert.equal(results.filter((v) => v.responseStatus === 200).length, 1);
  if (o.sale.status === "cancelled") {
    sale = await checkout();
    o = await r("/workshop/orders/" + o.id);
    await step("delivered", "Entregue após novo recebimento");
  }
  const again = await r("/workshop/orders/" + o.id);
  assert.equal(again.status, "delivered");
  assert.equal(again.sale.status, "completed");
  console.log(
    `${count()} verificações adicionais aprovadas: novo aceite com preservação do escopo anterior e corrida entre cancelamento e entrega sem estado inconsistente.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
