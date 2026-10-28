const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, credentials } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/workshop/session.json")),
  { request, count } = client();
const r = (path, method = "GET", body, status = 200, token = s.login.token) =>
  request(path, { method, body, status, token });
(async () => {
  const pass = credentials();
  const supplier = await r("/support/login", "POST", {
    username: "support.local",
    password: pass.support,
  });
  s.support = await r(
    "/support/sessions",
    "POST",
    { company: s.slug },
    200,
    supplier.token,
  );

  const stamp = Date.now() + 15 * 86400000;
  const body = {
    vehicleId: s.vehicle.id,
    assignedUserId: s.employee.user.id,
    startsAt: new Date(stamp).toISOString(),
    endsAt: new Date(stamp + 3600000).toISOString(),
    reason: "Revisão sintética de agenda",
  };
  let a = await r("/workshop-agenda", "POST", body, 201);
  await r("/workshop-agenda", "POST", body, 409);
  await r("/workshop-agenda", "POST", body, 403, s.employee.token);
  await r("/workshop-agenda", "POST", body, 403, s.support.token);
  await r("/workshop-agenda", "POST", { ...body, endsAt: body.startsAt }, 400);
  await r(
    "/workshop-agenda",
    "POST",
    { ...body, assignedUserId: "00000000-0000-0000-0000-000000000000" },
    400,
  );
  await r("/workshop-agenda/" + a.id, "PUT", { ...body, revision: 0 }, 409);
  a = await r("/workshop-agenda/" + a.id, "PUT", {
    ...body,
    revision: a.revision,
    reason: "Reagendamento confirmado",
  });
  assert.equal(a.events.length, 2);
  await r(
    "/workshop-agenda/" + a.id + "/status",
    "POST",
    { revision: a.revision, status: "completed", note: "Inválido" },
    400,
  );
  const o = await r("/workshop/orders", "POST", s.body, 201);
  a = await r("/workshop-agenda/" + a.id + "/order", "POST", {
    revision: a.revision,
    orderId: o.id,
  });
  assert.equal(a.orderId, o.id);
  await r(
    "/workshop-agenda/" + a.id + "/order",
    "POST",
    { revision: a.revision, orderId: o.id },
    409,
  );
  a = await r("/workshop-agenda/" + a.id + "/status", "POST", {
    revision: a.revision,
    status: "arrived",
    note: "Chegou",
  });
  await r(
    "/workshop-agenda/" + a.id,
    "PUT",
    { ...body, revision: a.revision },
    409,
  );
  a = await r("/workshop-agenda/" + a.id + "/status", "POST", {
    revision: a.revision,
    status: "completed",
    note: "Atendido",
  });
  assert.equal(a.status, "completed");
  const b = await r("/workshop-agenda", "POST", body, 201);
  await r("/workshop-agenda/" + b.id + "/status", "POST", {
    revision: b.revision,
    status: "cancelled",
    note: "Cliente cancelou",
  });
  await r("/workshop-agenda?from=errado&to=errado", "GET", undefined, 400);
  assert.ok(
    (await r("/workshop-agenda", "GET", undefined, 200, s.employee.token)).some(
      (x) => x.id === a.id,
    ),
  );
  assert.ok(
    !(await r("/workshop-agenda", "GET", undefined, 200, s.second.token)).some(
      (x) => x.id === a.id,
    ),
  );
  await r(
    "/workshop-agenda/" + a.id + "/status",
    "POST",
    { revision: a.revision, status: "cancelled", note: "Outro tenant" },
    404,
    s.second.token,
  );
  fs.writeFileSync("work/marks/agenda.json", JSON.stringify({ a, b }), {
    mode: 0o600,
  });
  fs.copyFileSync("work/workshop/session.json", "work/marks/session.json");
  fs.chmodSync("work/marks/session.json", 0o600);
  console.log(
    count() +
      " verificações da agenda aprovadas: conflitos, limites, revisão, OS, transições, isolamento e suporte somente leitura.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
