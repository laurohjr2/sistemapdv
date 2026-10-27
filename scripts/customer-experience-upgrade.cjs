// Migration and persistence check on a disposable project populated by the c5a34ac images.
const { execFileSync } = require("node:child_process"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const mode = process.argv[2],
  project = "pdv-upgrade-test",
  base = "http://127.0.0.1:8091/api";
assert.ok(["prepare", "verify", "persist"].includes(mode));
const overlay =
  mode === "prepare"
    ? "work/compose.upgrade-old.yaml"
    : "docker/customer-experience-test.yaml";
const creds = execFileSync(
  "docker",
  [
    "compose",
    "-p",
    project,
    "-f",
    "compose.yaml",
    "-f",
    overlay,
    "run",
    "--rm",
    "--no-deps",
    "provision",
    "node",
    "/app/docker/local.cjs",
    "credentials",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const passwords = [...creds.matchAll(/^Senha: (.+)$/gm)].map((m) => m[1]);
let checks = 0;
async function req(path, method = "GET", body, token, status = 200) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.headers.get("content-type")?.includes("json")
    ? await r.json()
    : null;
  assert.equal(r.status, status, path + " " + data?.error);
  checks++;
  return data;
}
(async () => {
  const token = (
    await req("/auth/login", "POST", {
      company: "demo",
      username: "admin.local",
      password: passwords[0],
    })
  ).token;
  const support = await req("/support/login", "POST", {
    username: "support.local",
    password: passwords[1],
  });
  const session = await req(
    "/support/sessions",
    "POST",
    { company: "demo" },
    support.token,
  );
  const info = await req(
    "/support/company-info",
    "GET",
    undefined,
    session.token,
  );
  if (mode === "prepare") {
    const marker = "Registro anterior à atualização " + Date.now();
    await req("/settings", "PUT", { receiptMessage: marker }, token);
    const { user } = await req(
      "/users",
      "POST",
      {
        username: "usuario.historico",
        password: "Senha de teste anterior 123!",
        role: "garcom",
      },
      token,
      201,
    );
    const { product } = await req(
      "/products",
      "POST",
      {
        name: "Produto anterior à atualização",
        category: "porcoes",
        unitOfMeasure: "unidade",
        costPrice: 2,
        salePrice: 9,
      },
      token,
      201,
    );
    await req(
      "/stock/add",
      "POST",
      { productId: product.id, quantity: 5 },
      token,
      201,
    );
    const cash = await req(
      "/cash-register/open",
      "POST",
      { opening_amount: 10 },
      token,
      201,
    );
    const { table } = await req(
      "/tables",
      "POST",
      { tableNumber: 1, capacity: 4 },
      token,
      201,
    );
    const { comanda } = await req(
      "/comandas",
      "POST",
      { tableId: table.id },
      token,
      201,
    );
    await req(
      "/comandas/" + comanda.id + "/items",
      "POST",
      { productId: product.id, quantity: 1 },
      token,
      201,
    );
    fs.writeFileSync(
      "work/upgrade-snapshot.json",
      JSON.stringify({
        marker,
        clientId: info.clientId,
        productId: product.id,
        tableId: table.id,
        comandaId: comanda.id,
        userId: user.id,
        cashId: cash.id,
      }),
    );
  } else {
    const snap = JSON.parse(fs.readFileSync("work/upgrade-snapshot.json"));
    assert.equal(info.clientId, snap.clientId);
    assert.equal(
      (await req("/settings", "GET", undefined, token)).receiptMessage,
      snap.marker,
    );
    assert.equal(
      Number(
        (await req("/products/" + snap.productId, "GET", undefined, token))
          .currentStock,
      ),
      4,
    );
    assert.ok(
      (await req("/users", "GET", undefined, token)).some(
        (u) => u.id === snap.userId,
      ),
    );
    assert.equal(
      (await req("/cash-register/status", "GET", undefined, token)).id,
      snap.cashId,
    );
    const comanda = await req(
      "/comandas/" + snap.comandaId,
      "GET",
      undefined,
      token,
    );
    assert.equal(comanda.items.length, 1);
    if (mode === "verify") {
      assert.equal(comanda.status, "aberta");
      const r = await req(
        "/tables/" + snap.tableId + "/close-comanda",
        "POST",
        {
          payments: [
            { method: "pix", amount: 4 },
            { method: "dinheiro", amount: 5 },
          ],
        },
        token,
      );
      assert.equal(r.comanda.payments.length, 2);
    } else {
      assert.equal(comanda.status, "fechada");
      assert.deepEqual(comanda.payments, [
        { method: "pix", amount: 4 },
        { method: "dinheiro", amount: 5 },
      ]);
      assert.equal(
        (await req("/tables/" + snap.tableId, "GET", undefined, token)).status,
        "disponivel",
      );
    }
  }
  console.log(
    `Upgrade ${mode}: ${checks} verificações aprovadas; ${mode === "prepare" ? "dados anteriores preparados" : mode === "verify" ? "credenciais, ID, caixa, estoque e histórico preservados; pagamento dividido funciona" : "dados e parcelas preservados após recriar containers"}.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
