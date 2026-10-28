const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/delivery/fixture.json")),
    { request } = client();
  const login = await request("/auth/login", {
      method: "POST",
      body: { company: f.company, username: f.username, password: f.password },
    }),
    api = (p, method = "GET", body) =>
      request(p, {
        method,
        body,
        status: method === "POST" && p === "/sales" ? 201 : 200,
        token: login.token,
      });
  const cash = await api("/cash-register/status");
  const s = await api("/sales", "POST", {
    cash_register_id: cash.id,
    payment_method: "pix",
    items: [{ product_id: f.productId, quantity: 1 }],
  });
  let checks = 0;
  const errors = [],
    b = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    const c = await b.newContext({ viewport: { width: 1440, height: 1080 } });
    await c.addInitScript((s) => {
      localStorage.setItem("token", s.token);
      localStorage.setItem("user", JSON.stringify(s.user));
      localStorage.setItem("company", s.user.company);
    }, login);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", (d) => d.accept());
    await p.goto(rootUrl + "/deliveries?sale=" + s.id);
    let d = p.getByRole("dialog");
    await d.getByLabel("Número da venda", { exact: true }).waitFor();
    await d
      .getByRole("button", { name: "Conferir venda", exact: true })
      .click();
    await d
      .getByRole("status")
      .filter({ hasText: "Venda #" + s.id })
      .waitFor();
    for (const [name, value] of [
      ["Nome do destinatário", "Cliente do navegador"],
      ["Telefone de contato", "11999998888"],
      ["Logradouro", "Rua Teste Navegador"],
      ["Número ou s/n", "20"],
      ["Bairro", "Centro"],
      ["Cidade", "São Paulo"],
      ["UF", "SP"],
      ["CEP", "01001-000"],
      ["Ponto de referência", "Ao lado da praça"],
    ])
      await d.getByLabel(name, { exact: true }).fill(value);
    await d
      .getByRole("button", { name: "Salvar pedido de entrega", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
    await p
      .getByRole("button", { name: "Ver pedido #" + s.id, exact: true })
      .click();
    d = p.getByRole("dialog");
    await d.getByText("Rua Teste Navegador, 20", { exact: true }).waitFor();
    await d
      .getByRole("button", { name: "Iniciar separação / preparo", exact: true })
      .click();
    await d.getByRole("button", { name: "Marcar pronto", exact: true }).click();
    await d
      .getByLabel("Entregador ou transportador responsável", { exact: true })
      .fill("Entregador Navegador");
    await d
      .getByRole("button", { name: "Registrar saída", exact: true })
      .click();
    await d
      .getByRole("button", { name: "Confirmar entrega", exact: true })
      .waitFor();
    checks++;
    const download = p.waitForEvent("download");
    await d
      .getByRole("button", { name: "Imprimir pedido de entrega", exact: true })
      .click();
    await (await download).saveAs("work/delivery/browser-order.pdf");
    checks++;
    await p.setViewportSize({ width: 390, height: 844 });
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await p.screenshot({ path: "work/delivery/celular.png", fullPage: true });
    checks++;
    await d
      .getByRole("button", { name: "Confirmar entrega", exact: true })
      .click();
    await d
      .getByText("Entregue · pagamento registrado na venda", { exact: true })
      .waitFor();
    const order = (await api("/deliveries")).find((x) => x.saleId === s.id);
    assert.equal(order.status, "delivered");
    assert.equal(order.courierName, "Entregador Navegador");
    assert.equal(order.history.at(-1).userId, login.user.id);
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: cadastro, endereço, etapas, responsável, impressão e celular; sem erros JavaScript.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
