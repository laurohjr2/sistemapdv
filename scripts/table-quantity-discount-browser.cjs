// Somente empresas sintéticas criadas pelo comanda-loyalty-smoke.cjs.
const { chromium } = require("../work/browser/node_modules/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark20/session.json"));
  const { request, count } = client();
  const api = (path, method = "GET", body, status = 200) =>
    request(path, { method, body, status, token: s.login.token });
  assert.match(s.slug, /^fidel-mesa-/);
  fs.mkdirSync("work/mark21", { recursive: true });
  const p = await api(
    "/products",
    "POST",
    {
      name: "Quantidade navegador " + Date.now(),
      category: "outros",
      unitOfMeasure: "unidade",
      salePrice: 9,
      costPrice: 1,
    },
    201,
  );
  const product = p.product || p;
  await api(
    "/stock/add",
    "POST",
    { productId: product.id, quantity: 100 },
    201,
  );
  const measured = await api(
    "/products",
    "POST",
    {
      name: "Produto por kg " + Date.now(),
      category: "outros",
      unitOfMeasure: "kg",
      salePrice: 9,
      costPrice: 1,
    },
    201,
  );
  const kg = measured.product || measured;
  const { table } = await api(
    "/tables",
    "POST",
    { tableNumber: 1000 + (Date.now() % 700000), capacity: 4 },
    201,
  );
  const { comanda } = await api(
    "/comandas",
    "POST",
    { tableId: table.id, type: "mesa", customerName: "Quantidade sintética" },
    201,
  );
  // Reproduz o registro fracionado da imagem sem alterar contas anteriores.
  await api(
    "/comandas/" + comanda.id + "/items",
    "POST",
    { productId: product.id, quantity: 1.004 },
    201,
  );
  assert.equal(Number((await api("/comandas/" + comanda.id)).totalValue), 9.04);
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "America/Sao_Paulo",
    });
    await context.addInitScript((u) => {
      localStorage.setItem("token", u.token);
      localStorage.setItem("user", JSON.stringify(u.user));
      localStorage.setItem("company", u.user.company);
      window.print = () => {};
    }, s.login);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(rootUrl + "/tables");
    await page
      .getByRole("row")
      .filter({
        has: page.getByText("Mesa " + table.tableNumber, { exact: true }),
      })
      .getByRole("button", { name: "Ver Conta", exact: true })
      .click();
    const d = page.getByRole("dialog");
    await d.getByText("Total: R$ 9,04", { exact: true }).waitFor();
    const existing = d.getByLabel("Quantidade lançada de " + product.name, {
      exact: true,
    });
    assert.equal(await existing.getAttribute("step"), "1");
    await existing.fill("10");
    await d
      .getByRole("button", { name: "Atualizar quantidade", exact: true })
      .click();
    await d.getByText("Total: R$ 90,00", { exact: true }).waitFor();
    assert.equal(
      Number((await api("/comandas/" + comanda.id)).items[0].quantity),
      10,
    );
    checks++;
    await existing.fill("4");
    await d
      .getByRole("button", { name: "Atualizar quantidade", exact: true })
      .click();
    await d.getByText("Total: R$ 36,00", { exact: true }).waitFor();
    checks++;
    await d
      .getByLabel("Adicionar produto", { exact: true })
      .selectOption(kg.id);
    await d.getByLabel("Quantidade a adicionar", { exact: true }).fill("1.25");
    await d
      .getByText("Próximo lançamento: 1,25 × R$ 9,00 = R$ 11,25", {
        exact: true,
      })
      .waitFor();
    assert.ok(
      await d
        .getByRole("button", { name: "Adicionar à comanda", exact: true })
        .isEnabled(),
    );
    checks++;
    await d
      .getByLabel("Adicionar produto", { exact: true })
      .selectOption(product.id);
    const q = d.getByLabel("Quantidade a adicionar", { exact: true });
    await q.fill("1.004");
    assert.ok(
      await d
        .getByRole("button", { name: "Adicionar à comanda", exact: true })
        .isDisabled(),
    );
    checks++;
    await q.fill("10");
    await d
      .getByText("Próximo lançamento: 10 × R$ 9,00 = R$ 90,00", { exact: true })
      .waitFor();
    await d.getByText("Total: R$ 36,00", { exact: true }).waitFor();
    checks++;
    await d
      .getByRole("button", { name: "Adicionar à comanda", exact: true })
      .click();
    await d.getByText("Total: R$ 126,00", { exact: true }).waitFor();
    assert.equal(await q.inputValue(), "1");
    assert.equal(
      Number((await api("/products/" + product.id)).currentStock),
      86,
    );
    checks++;
    await d
      .getByLabel("Tipo de desconto", { exact: true })
      .selectOption("percentage");
    await d.getByLabel("Desconto (%)", { exact: true }).fill("101");
    assert.ok(
      await d
        .getByRole("button", {
          name: "Receber, fechar e imprimir",
          exact: true,
        })
        .isDisabled(),
    );
    await d
      .getByRole("alert")
      .getByText("Informe um desconto entre zero e 100%.", { exact: true })
      .waitFor();
    checks++;
    await d.getByLabel("Desconto (%)", { exact: true }).fill("10");
    await d.getByText("Total: R$ 113,40", { exact: true }).waitFor();
    await d
      .getByRole("button", { name: "Dividir igualmente", exact: true })
      .click();
    assert.equal(
      await d.getByLabel("Valor do pagamento 1", { exact: true }).inputValue(),
      "56,70",
    );
    checks++;
    await d.getByLabel("Desconto (%)", { exact: true }).fill("12.5");
    await d.getByText("Total: R$ 110,25", { exact: true }).waitFor();
    assert.equal(
      await d.getByLabel("Valor do pagamento 1", { exact: true }).inputValue(),
      "",
    );
    checks++;
    await d
      .getByLabel("Tipo de desconto", { exact: true })
      .selectOption("value");
    await d.getByLabel("Desconto (R$)", { exact: true }).fill("500");
    await d.getByText("Total: R$ 121,00", { exact: true }).waitFor();
    checks++;
    await d
      .getByLabel("Tipo de desconto", { exact: true })
      .selectOption("percentage");
    await d.getByLabel("Desconto (%)", { exact: true }).fill("10");
    await d
      .getByRole("button", { name: "Dividir igualmente", exact: true })
      .click();
    await d
      .getByLabel("Forma do pagamento 2", { exact: true })
      .selectOption("pix");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({
      path: "work/mark21/mesa-mobile.png",
      fullPage: true,
    });
    checks++;
    const popupEvent = context.waitForEvent("page");
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/tables/" + table.id + "/close-comanda") &&
        r.request().method() === "POST",
    );
    await d
      .getByRole("button", { name: "Receber, fechar e imprimir", exact: true })
      .click();
    assert.equal((await response).status(), 200);
    const popup = await popupEvent;
    await popup.waitForLoadState("domcontentloaded");
    const text = (await popup.locator("body").innerText()).replace(
      /\u00a0/g,
      " ",
    );
    assert.match(text, /Desconto \(10%\): R\$ 12,60/);
    assert.match(text, /Total: R\$ 113,40/);
    fs.writeFileSync("work/mark21/cupom.txt", text);
    checks++;
    const closed = await api("/comandas/" + comanda.id);
    assert.equal(Number(closed.discountPercentage), 10);
    assert.equal(Number(closed.discountValue), 0);
    assert.equal(Number(closed.finalValue), 113.4);
    assert.equal(closed.payments.length, 2);
    assert.equal(
      Number((await api("/products/" + product.id)).currentStock),
      86,
    );
    checks++;
    await popup.close();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(rootUrl + "/comandas?comanda=" + comanda.id);
    const reprintEvent = context.waitForEvent("page");
    await page.getByRole("button", { name: "Reimprimir", exact: true }).click();
    const reprint = await reprintEvent;
    await reprint.waitForLoadState("domcontentloaded");
    assert.match(
      (await reprint.locator("body").innerText()).replace(/\u00a0/g, " "),
      /Desconto \(10%\): R\$ 12,60/,
    );
    checks++;
    const pdf = await api("/print/comanda/" + comanda.id);
    fs.writeFileSync("work/mark21/comanda.pdf", pdf);
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `${checks} verificações de navegador e ${count()} requisições aprovadas.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
