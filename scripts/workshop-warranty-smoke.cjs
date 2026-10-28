const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, credentials } = require("./testing/commercial-context.cjs");
const f = JSON.parse(fs.readFileSync("work/workshop-evidence/fixture.json")),
  s = JSON.parse(fs.readFileSync("work/workshop/session.json")),
  { request, count } = client();
const r = (path, method = "GET", body, status = 200, token = f.login.token) =>
  request(path, { method, body, status, token });
(async () => {
  const pass = credentials(),
    supplier = await r("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    }),
    support = await r(
      "/support/sessions",
      "POST",
      { company: f.login.user.company },
      200,
      supplier.token,
    );
  let o = await r("/workshop/orders", "POST", f.body, 201);
  for (const status of ["waiting", "approved", "in_progress", "ready"])
    o = await r("/workshop/orders/" + o.id + "/status", "POST", {
      revision: o.revision,
      status,
      note: "Preparação sintética de garantia",
    });
  const cash = await r("/cash-register/status");
  await r(
    "/workshop/orders/" + o.id + "/checkout",
    "POST",
    { revision: o.revision, cash_register_id: cash.id, payment_method: "pix" },
    201,
  );
  o = await r("/workshop/orders/" + o.id);
  o = await r("/workshop/orders/" + o.id + "/status", "POST", {
    revision: o.revision,
    status: "delivered",
    note: "Entrega para teste",
  });
  const expiresOn = new Date(Date.now() + 90 * 86400000)
      .toISOString()
      .slice(0, 10),
    body = {
      orderId: o.id,
      expiresOn,
      mileageLimit: o.mileage + 1000,
      terms: "Cobertura sintética de peça e mão de obra; avaliação técnica.",
    };
  const products = await r("/products"),
    sales = await r("/sales");
  await r("/workshop-warranty", "POST", body, 403, f.mechanic);
  await r("/workshop-warranty", "POST", body, 403, support.token);
  await r(
    "/workshop-warranty",
    "POST",
    { ...body, expiresOn: "2026-02-30" },
    400,
  );
  await r(
    "/workshop-warranty",
    "POST",
    { ...body, mileageLimit: o.mileage - 1 },
    400,
  );
  const draft = await r("/workshop/orders", "POST", f.body, 201);
  await r("/workshop-warranty", "POST", { ...body, orderId: draft.id }, 400);
  let w = await r("/workshop-warranty", "POST", body, 201);
  await r("/workshop-warranty", "POST", body, 409);
  assert.equal(w.snapshot.customerId, o.customerId);
  await r(
    "/workshop-warranty/" + w.id + "/returns",
    "POST",
    { revision: 0, reason: "Ruído", mileage: o.mileage },
    409,
  );
  await r(
    "/workshop-warranty/" + w.id + "/returns",
    "POST",
    { revision: w.revision, reason: "Ruído", mileage: o.mileage - 1 },
    400,
  );
  let ret = await r(
    "/workshop-warranty/" + w.id + "/returns",
    "POST",
    {
      revision: w.revision,
      reason: "Peça com ruído no retorno",
      mileage: o.mileage + 2000,
    },
    201,
  );
  assert.equal(ret.eligibility.withinMileage, false);
  w = (await r("/workshop-warranty")).warranties.find((x) => x.id === w.id);
  await r(
    "/workshop-warranty/" + w.id + "/returns",
    "POST",
    { revision: w.revision, reason: "Duplicado", mileage: o.mileage },
    409,
  );
  await r(
    "/workshop-warranty/returns/" + ret.id + "/status",
    "POST",
    { revision: ret.revision, status: "completed", note: "Pular análise" },
    400,
  );
  ret = await r("/workshop-warranty/returns/" + ret.id + "/status", "POST", {
    revision: ret.revision,
    status: "accepted",
    note: "Cobertura aceita após avaliação técnica",
  });
  await r(
    "/workshop-warranty/returns/" + ret.id + "/order",
    "POST",
    { revision: ret.revision, orderId: o.id },
    400,
  );
  ret = await r("/workshop-warranty/returns/" + ret.id + "/order", "POST", {
    revision: ret.revision,
    orderId: draft.id,
  });
  assert.equal(ret.orderId, draft.id);
  ret = await r("/workshop-warranty/returns/" + ret.id + "/status", "POST", {
    revision: ret.revision,
    status: "completed",
    note: "Retorno concluído; cliente orientado",
  });
  assert.equal(ret.events.length, 4);
  assert.deepEqual(await r("/products"), products);
  assert.deepEqual(await r("/sales"), sales);
  const pdf = await r("/workshop-warranty/" + w.id + "/pdf");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  fs.writeFileSync("work/marks/garantia.pdf", pdf);
  await r(
    "/workshop-warranty/" + w.id + "/void",
    "POST",
    { revision: w.revision, reason: "" },
    400,
  );
  w = await r("/workshop-warranty/" + w.id + "/void", "POST", {
    revision: w.revision,
    reason: "Cadastro de demonstração encerrado",
  });
  assert.equal(w.terms, body.terms);
  await r(
    "/workshop-warranty/" + w.id + "/returns",
    "POST",
    { revision: w.revision, reason: "Novo", mileage: o.mileage },
    400,
  );
  await r(
    "/workshop-warranty/" + w.id + "/pdf",
    "GET",
    undefined,
    404,
    s.second.token,
  );
  assert.ok(
    !(
      await r("/workshop-warranty", "GET", undefined, 200, s.second.token)
    ).warranties.some((x) => x.id === w.id),
  );
  assert.ok(
    (
      await r("/workshop-warranty", "GET", undefined, 200, support.token)
    ).warranties.some((x) => x.id === w.id),
  );
  fs.writeFileSync("work/marks/warranty.json", JSON.stringify({ w, ret }), {
    mode: 0o600,
  });
  console.log(
    count() +
      " verificações de garantia aprovadas: entrega paga, prazo/km, parecer, nova OS, revisão, histórico, PDF, estoque inalterado e isolamento.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
