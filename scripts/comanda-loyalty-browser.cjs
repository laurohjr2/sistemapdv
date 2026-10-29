const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark20/session.json")),
    { request } = client(),
    api = (p, method = "GET", body, status = 200) =>
      request(p, { method, body, status, token: s.login.token });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "America/Sao_Paulo",
      acceptDownloads: true,
    });
    await context.addInitScript((u) => {
      localStorage.setItem("token", u.token);
      localStorage.setItem("user", JSON.stringify(u.user));
      localStorage.setItem("company", u.user.company);
      window.print = () => {};
    }, s.login);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const response = (suffix, method) =>
      page.waitForResponse(
        (r) => r.url().endsWith(suffix) && r.request().method() === method,
      );
    let { comanda } = await api(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Cliente navegador" },
      201,
    );
    await api(
      "/comandas/" + comanda.id + "/items",
      "POST",
      { productId: s.product.id, quantity: 2 },
      201,
    );
    await page.goto(rootUrl + "/comandas?comanda=" + comanda.id);
    await page
      .getByRole("button", { name: "Fechar Comanda", exact: true })
      .click();
    let d = page
      .getByRole("dialog")
      .filter({
        has: page.getByRole("heading", { name: "Fechar Comanda", exact: true }),
      });
    await d
      .getByLabel("Cliente cadastrado", { exact: true })
      .selectOption(s.customer.id);
    let pending = response("/comandas/" + comanda.id + "/customer", "PUT");
    await d
      .getByRole("button", { name: "Salvar cliente vinculado", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    checks++;
    await d
      .getByRole("button", {
        name: "Aplicar fidelidade na comanda",
        exact: true,
      })
      .click();
    await d
      .getByText("Fidelidade: Programa mesa · 10% aplicado.", { exact: true })
      .waitFor();
    await d.getByText("Total: R$ 36,00", { exact: true }).waitFor();
    checks++;
    await d.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Dinheiro", exact: true }).click();
    let fresh = await api("/comandas/" + comanda.id);
    await api(
      "/comandas/" + comanda.id + "/items/" + fresh.items[0].id,
      "PUT",
      { quantity: 3 },
    );
    pending = response("/comandas/" + comanda.id + "/close", "PUT");
    await d
      .getByRole("button", { name: "Fechar Comanda", exact: true })
      .click();
    assert.equal((await pending).status(), 409);
    checks++;
    await d
      .getByRole("button", { name: "Atualizar comanda", exact: true })
      .click();
    await d.getByText("Total: R$ 60,00", { exact: true }).waitFor();
    await d
      .getByRole("button", {
        name: "Aplicar fidelidade na comanda",
        exact: true,
      })
      .click();
    await d.getByText("Total: R$ 54,00", { exact: true }).waitFor();
    pending = response("/comandas/" + comanda.id + "/close", "PUT");
    await d
      .getByRole("button", { name: "Fechar Comanda", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    await d.waitFor({ state: "hidden" });
    checks++;
    const { table } = await api(
      "/tables",
      "POST",
      { tableNumber: 1000 + (Date.now() % 700000), capacity: 4 },
      201,
    );
    await page.goto(rootUrl + "/tables");
    await page
      .getByRole("row")
      .filter({
        has: page.getByText("Mesa " + table.tableNumber, { exact: true }),
      })
      .getByRole("button", { name: "Abrir Comanda", exact: true })
      .click();
    d = page.getByRole("dialog");
    await d
      .getByLabel("Cliente cadastrado", { exact: true })
      .selectOption(s.customer.id);
    await d.getByRole("button", { name: "Abrir comanda", exact: true }).click();
    await d
      .getByLabel("Adicionar produto", { exact: true })
      .selectOption(s.product.id);
    await d.getByLabel("Quantidade", { exact: true }).fill("2");
    await d
      .getByRole("button", { name: "Adicionar à comanda", exact: true })
      .click();
    await d.getByText(s.product.name, { exact: true }).first().waitFor();
    await d
      .getByRole("button", {
        name: "Aplicar fidelidade na comanda",
        exact: true,
      })
      .click();
    await d
      .getByText(
        "Fidelidade: Programa mesa · 10% aplicado. Confira os valores dos pagamentos.",
        { exact: true },
      )
      .waitFor();
    checks++;
    await d
      .getByRole("button", { name: "Dividir igualmente", exact: true })
      .click();
    assert.equal(
      await d.getByLabel("Valor do pagamento 1", { exact: true }).inputValue(),
      "18,00",
    );
    assert.equal(
      await d.getByLabel("Valor do pagamento 2", { exact: true }).inputValue(),
      "18,00",
    );
    await d
      .getByLabel("Forma do pagamento 2", { exact: true })
      .selectOption("cartao_credito");
    checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({
      path: "work/mark20/mesa-mobile.png",
      fullPage: true,
    });
    checks++;
    const popupEvent = context.waitForEvent("page");
    pending = response("/tables/" + table.id + "/close-comanda", "POST");
    await d
      .getByRole("button", { name: "Receber, fechar e imprimir", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    const popup = await popupEvent;
    await popup.waitForLoadState("domcontentloaded");
    assert.ok(
      (await popup.locator("body").innerText()).includes(
        "Fidelidade: Programa mesa",
      ),
    );
    await popup.close();
    await d.waitFor({ state: "hidden" });
    checks++;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(rootUrl + "/loyalty");
    await page
      .getByLabel("Cliente", { exact: true })
      .selectOption(s.customer.id);
    await page
      .getByRole("cell", {
        name: "Comanda #" + comanda.id.slice(0, 8),
        exact: true,
      })
      .waitFor();
    const downloadEvent = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Imprimir histórico de fidelidade",
        exact: true,
      })
      .click();
    await (await downloadEvent).saveAs("work/mark20/browser-fidelidade.pdf");
    checks++;
    await page.goto(rootUrl + "/user-access?user=" + s.employee.user.id);
    await page
      .getByLabel("Motivo da alteração de acessos", { exact: true })
      .fill("Conferência da mensagem de dois segundos");
    await page
      .getByRole("checkbox", {
        name: "Conferi o usuário, o perfil e as liberações/retiradas antes de salvar.",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Salvar acessos", exact: true })
      .click();
    const toast = page.getByText("Acessos salvos com sucesso.", {
      exact: true,
    });
    await toast.waitFor();
    const at = Date.now();
    await toast.waitFor({ state: "hidden", timeout: 5000 });
    assert.ok(Date.now() - at < 4500);
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: vínculo de cliente, fidelidade, conflito entre terminais, comandas, mesas, pagamento dividido, cupom, histórico/PDF, celular/escuro e aviso de dois segundos.",
    );
  } catch (e) {
    for (const p of browser.contexts().flatMap((c) => c.pages()))
      await p.screenshot({
        path: "work/mark20/browser-failure.png",
        fullPage: true,
      });
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
