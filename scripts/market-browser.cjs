const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/market/session.json"));
(async () => {
  const { request } = client(),
    token = s.login.token;
  let checks = 0;
  const errors = [];
  const { product } = await request("/products", {
    method: "POST",
    token,
    status: 201,
    body: {
      name: "Iogurte navegador " + Date.now(),
      category: "alimentos",
      unitOfMeasure: "unidade",
      costPrice: 1,
      salePrice: 3,
    },
  });
  await request("/stock/add", {
    method: "POST",
    token,
    status: 201,
    body: { productId: product.id, quantity: 6 },
  });
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 1440, height: 1080 } });
  const init = (session) => {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("company", session.user.company);
  };
  await c.addInitScript(init, s.login);
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto(rootUrl + "/market");
    await p
      .getByRole("heading", { name: "Lotes e validade", level: 1 })
      .waitFor();
    await p.getByLabel("Produto para controle").selectOption(product.id);
    await p
      .getByRole("button", { name: "Ativar controle", exact: true })
      .click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    checks++;
    await p.getByLabel("Buscar produto ou lote").fill(product.name);
    let row = p.getByRole("row").filter({ hasText: product.name });
    await row
      .getByRole("button", { name: "Identificar saldo", exact: true })
      .click();
    let d = p.getByRole("dialog");
    await d.getByLabel("Quantidade", { exact: true }).fill("3");
    await d.getByLabel("Número do lote").fill("IOG-01");
    await d.getByLabel("Data de validade").fill("2099-01-01");
    await d
      .getByLabel("Justificativa")
      .fill("Conferido na embalagem pelo gerente");
    await d.getByRole("button", { name: "Confirmar", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    checks++;
    row = p.getByRole("row").filter({ hasText: "IOG-01" });
    await row.getByText("Válido", { exact: true }).waitFor();
    const download = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Imprimir / PDF", exact: true })
      .click();
    await (await download).saveAs("work/market/lotes.pdf");
    checks++;
    await row
      .getByRole("button", { name: "Registrar baixa", exact: true })
      .click();
    d = p.getByRole("dialog");
    await d.getByLabel("Quantidade", { exact: true }).fill("1");
    await d
      .getByLabel("Justificativa")
      .fill("Embalagem danificada, descarte confirmado");
    await d.getByRole("button", { name: "Confirmar", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    checks++;
    assert.ok(
      (
        await p
          .getByLabel("Produto para controle")
          .locator("option:checked")
          .innerText()
      )
        .replace(/\s+/g, " ")
        .includes("Saldo: 5"),
    );
    await p
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached" });
    await p.screenshot({ path: "work/market/painel.png", fullPage: true });
    await p.setViewportSize({ width: 390, height: 844 });
    await p
      .getByRole("row")
      .filter({ hasText: product.name })
      .filter({ hasText: "Sem lote informado" })
      .getByRole("button", { name: "Identificar saldo", exact: true })
      .click();
    d = p.getByRole("dialog");
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await p.screenshot({ path: "work/market/celular.png" });
    checks++;
    const lots = await request("/market/lots", { token });
    assert.equal(
      lots
        .filter((l) => l.productId === product.id)
        .reduce((n, l) => n + Number(l.quantity), 0),
      5,
    );
    await p.goto(rootUrl + "/sales?search=" + encodeURIComponent(product.name));
    await p
      .getByText("Disponível por lotes: 2 · Físico: 5", { exact: true })
      .waitFor();
    checks++;
    const readonly = await b.newContext();
    await readonly.addInitScript(init, s.employee);
    const page = await readonly.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(rootUrl + "/market");
    await page
      .getByRole("heading", { name: "Lotes e validade", level: 1 })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Ativar controle", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Registrar baixa", exact: true })
        .count(),
      0,
    );
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador aprovadas: ativação, identificação parcial, descarte, PDF, celular e consulta sem permissão de alteração.`,
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
