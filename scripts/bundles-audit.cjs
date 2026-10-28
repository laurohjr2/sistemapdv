// Read only the internal audit of the synthetic fixture company.
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const { client, project } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/bundles/fixture.json")),
    { request, count } = client();
  const login = await request("/auth/login", {
      method: "POST",
      body: { company: f.company, username: f.username, password: f.password },
    }),
    req = (p, method = "GET", body, status = 200) =>
      request(p, { method, body, status, token: login.token });
  const menu = (await req("/bundles")).find((b) => b.id === f.bundleId),
    selection = {
      id: menu.id,
      revision: menu.revision,
      extras: [{ productId: f.extraId, quantity: 1 }],
    },
    preview = await req("/bundles/price", "POST", selection),
    account = (
      await req(
        "/comandas",
        "POST",
        { type: "balcao", customerName: "Auditoria de combo removido" },
        201,
      )
    ).comanda;
  const group = await req(
    "/bundles/comandas/" + account.id,
    "POST",
    { selection, quantity: 1, expectedUnitPrice: preview.unitPrice },
    201,
  );
  await req(
    "/bundles/comandas/" + account.id + "/" + group.groupId,
    "DELETE",
    {},
  );
  const program = `(async()=>{const central=require('/app/bar-management-system/src/tenancy/platform').platform(),Manager=require('/app/bar-management-system/src/tenancy/manager'),manager=new Manager(central.config);try{const tenant=await central.Tenant.findOne({where:{slug:${JSON.stringify(f.company)}}});if(!tenant)throw Error('Synthetic tenant missing');const lease=await manager.acquire(tenant);try{const rows=await lease.models.AuditLog.findAll({where:{action:'bundle_removed'},raw:true});const record=rows.find(r=>JSON.parse(r.details).groupId===${JSON.stringify(group.groupId)});if(!record)throw Error('Audit missing');process.stdout.write(JSON.stringify(record));}finally{lease.release()}}finally{await manager.close();await central.sequelize.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});`;
  const record = JSON.parse(
      execFileSync("docker", ["exec", "-i", project + "-backend-1", "node"], {
        input: program,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }),
    ),
    details = JSON.parse(record.details);
  assert.equal(record.userId, login.user.id);
  assert.equal(details.items.length, group.items.length);
  assert.equal(
    details.items.reduce(
      (n, i) => n + Math.round(Number(i.totalItemValue) * 100),
      0,
    ),
    Math.round(preview.unitPrice * 100),
  );
  assert.ok(
    details.items.every(
      (i) => i.bundle.groupId === group.groupId && i.bundle.component.name,
    ),
  );
  assert.ok(details.items.some((i) => i.recipe?.consumed.length));
  assert.equal((await req("/comandas/" + account.id)).items.length, 0);
  console.log(
    count() +
      " verificações HTTP e auditoria PostgreSQL aprovadas: composição, preços, ingredientes e responsável preservados após remover o grupo.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
