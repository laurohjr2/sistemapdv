const { chromium } = require(
  process.env.PDV_PLAYWRIGHT || "../work/browser/node_modules/playwright",
);
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const {
  rootUrl,
  credentials,
  client,
} = require("./testing/commercial-context.cjs");
const state = JSON.parse(fs.readFileSync("work/pizza/session.json")),
  secret = credentials(),
  { request: r } = client();
const output = "work/pizza/screens";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    timezoneId: "America/Sao_Paulo",
  });
  await context.addInitScript(() => {
    window.print = () => {};
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  let checks = 0;
  const borderName = "Cheddar navegador " + Date.now();
  async function builder(size, flavors, notes, extras = false) {
    const dialog = page.getByRole("dialog").filter({
      has: page.getByRole("heading", { name: "Montar pizza", exact: true }),
    });
    await dialog.getByLabel("Tamanho da pizza").selectOption(size);
    for (const flavor of flavors)
      await dialog.getByLabel("Sabor " + flavor, { exact: true }).check();
    await dialog.getByLabel("Observações da pizza").fill(notes);
    if (extras) {
      await dialog
        .getByLabel("Borda da pizza")
        .selectOption(
          await dialog
            .getByRole("option", { name: new RegExp("^" + borderName) })
            .getAttribute("value"),
        );
      await dialog
        .getByLabel("Adicional Queijo extra", { exact: true })
        .check();
      await dialog
        .getByLabel("Quantidade de Queijo extra", { exact: true })
        .fill("2");
      await dialog
        .getByLabel("Quantidade de pizzas", { exact: true })
        .fill("2");
    }
    await dialog.getByText(/por pizza · Total/).waitFor();
    await page.screenshot({ path: output + "/montagem.png", fullPage: true });
    await dialog
      .getByRole("button", { name: "Adicionar pizza", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    checks++;
  }
  try {
    await page.goto(rootUrl + "/login");
    await page.getByLabel("Código da empresa").fill("demo");
    await page.getByLabel("Usuário", { exact: true }).fill("admin.local");
    await page.locator("#password").fill(secret.admin);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(rootUrl + "/");
    await page.getByRole("link", { name: "Pizzaria", exact: true }).click();
    await page
      .getByRole("heading", { name: "Cardápio de pizzas", exact: true })
      .waitFor();
    checks++;
    await page.getByRole("tab", { name: "Bordas", exact: true }).click();
    await page
      .getByRole("button", { name: "Adicionar borda", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: /^Nome / })
      .last()
      .fill(borderName);
    await page
      .getByLabel("Preço " + borderName + " Grande", { exact: true })
      .fill("600");
    await page
      .getByLabel("Preço " + borderName + " Broto", { exact: true })
      .fill("300");
    await page
      .getByRole("button", { name: "Salvar cardápio", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Cardápio de pizzas salvo" })
      .waitFor();
    checks++;
    // Simulate a second terminal saving while this browser still edits its revision.
    await page
      .getByRole("textbox", { name: /^Nome / })
      .last()
      .fill(borderName + " alterada");
    const concurrent = await r("/pizza/catalog", { token: state.admin });
    await r("/pizza/catalog", {
      method: "PUT",
      token: state.admin,
      body: concurrent,
    });
    await page
      .getByRole("button", { name: "Salvar cardápio", exact: true })
      .click();
    await page
      .getByRole("alert")
      .filter({ hasText: "cardápio mudou" })
      .waitFor();
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/pizza/catalog") &&
          res.request().method() === "GET",
      ),
      page.getByRole("button", { name: "Recarregar", exact: true }).click(),
    ]);
    assert.equal(
      await page
        .getByRole("textbox", { name: /^Nome / })
        .last()
        .inputValue(),
      borderName,
    );
    await page
      .getByRole("button", { name: "Salvar cardápio", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Cardápio de pizzas salvo" })
      .waitFor();
    checks++;
    await page.goto(rootUrl + "/sales");
    await page.getByText("Caixa Aberto", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Montar pizza", exact: true })
      .click();
    await builder(
      state.menu.sizes[0].id,
      ["Calabresa artesanal", "Mussarela"],
      "Sem cebola; bem assada",
      true,
    );
    await page.getByRole("button", { name: /^Carrinho \(/ }).click();
    let dialog = page.getByRole("dialog");
    await dialog
      .getByText(/192,00/)
      .first()
      .waitFor();
    await dialog.getByRole("combobox", { name: "Forma de Pagamento" }).click();
    await page.getByRole("option", { name: "PIX", exact: true }).click();
    await page.screenshot({ path: output + "/checkout.png", fullPage: true });
    const [saleResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().endsWith("/api/sales") && res.request().method() === "POST",
      ),
      dialog
        .getByRole("button", { name: "Finalizar Venda", exact: true })
        .click(),
    ]);
    const sale = await saleResponse.json();
    assert.equal(Number(sale.total_amount), 192);
    assert.equal(sale.items.length, 1);
    assert.equal(sale.items[0].notes, "Sem cebola; bem assada");
    checks += 3;
    await dialog.waitFor({ state: "hidden" });
    const popupPromise = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Imprimir Nota", exact: true })
      .click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    assert.match(await popup.locator("body").innerText(), /Cheddar/);
    assert.match(await popup.locator("body").innerText(), /Sem cebola/);
    await popup.close();
    checks++;
    await page.goto(rootUrl + "/kitchen");
    let card = page.locator("article").filter({ hasText: "Venda #" + sale.id });
    await card.getByText(/Sem cebola/).waitFor();
    await card.getByRole("button", { name: "Iniciar preparo" }).click();
    await card.getByRole("button", { name: "Marcar pronta" }).click();
    await card.getByRole("button", { name: "Registrar retirada" }).click();
    await card.waitFor({ state: "hidden" });
    checks += 3;
    await page.goto(rootUrl + "/tables");
    let row = page
      .getByRole("row")
      .filter({ hasText: String(state.table.tableNumber) });
    await row
      .getByRole("button", { name: "Abrir Comanda", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Cliente pizza navegador");
    await dialog
      .getByRole("button", { name: "Abrir comanda", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Montar pizza", exact: true })
      .click();
    await builder(
      state.menu.sizes[1].id,
      ["Calabresa artesanal"],
      "Sem pimenta",
    );
    dialog = page.getByRole("dialog");
    await dialog.getByText(/Pizza Broto/).waitFor();
    const conferencePromise = page.waitForEvent("popup");
    await dialog.getByRole("button", { name: "Imprimir conferência" }).click();
    const conference = await conferencePromise;
    await conference.waitForLoadState("domcontentloaded");
    assert.match(await conference.locator("body").innerText(), /Pizza Broto/);
    await conference.close();
    checks++;
    await page.keyboard.press("Escape");
    await page.goto(rootUrl + "/kitchen");
    const heading = page.getByRole("heading", { name: /Pizza Broto/ });
    await heading.waitFor();
    card = heading.locator('xpath=ancestor::div[@data-slot="card"][1]');
    await card.getByRole("button", { name: "Iniciar", exact: true }).click();
    await card.getByRole("button", { name: "Finalizar", exact: true }).click();
    checks += 2;
    await page.goto(rootUrl + "/tables");
    row = page
      .getByRole("row")
      .filter({ hasText: String(state.table.tableNumber) });
    await row.getByRole("button", { name: "Ver Conta", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByText("Pronto para entregar nesta mesa", { exact: true })
      .waitFor();
    await dialog.getByRole("button", { name: "Entregue", exact: true }).click();
    await dialog
      .getByRole("button", { name: "Preencher total", exact: true })
      .click();
    const receiptPromise = page.waitForEvent("popup");
    await dialog
      .getByRole("button", { name: "Receber, fechar e imprimir", exact: true })
      .click();
    const receipt = await receiptPromise;
    await receipt.waitForLoadState("domcontentloaded");
    assert.match(await receipt.locator("body").innerText(), /Pizza Broto/);
    await receipt.close();
    await dialog.waitFor({ state: "hidden" });
    checks += 3;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(rootUrl + "/sales");
    await page.getByText("Caixa Aberto", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Montar pizza", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Tamanho da pizza")
      .selectOption(state.menu.sizes[0].id);
    await dialog.getByLabel("Sabor Mussarela", { exact: true }).check();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({ path: output + "/mobile.png", fullPage: true });
    await page.keyboard.press("Escape");
    checks++;
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...user, company: "demo" }),
        );
      },
      { token: state.employee, user: state.user },
    );
    await page.goto(rootUrl + "/pizzeria");
    await page.getByRole("heading", { name: "Acesso Negado" }).waitFor();
    await page.goto(rootUrl + "/sales");
    await page.getByText("Caixa Aberto", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Montar pizza", exact: true })
      .waitFor();
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador aprovadas: cardápio, montagem, venda, cupom, cozinha, mesa, recebimento, perfil de atendente e celular.`,
    );
  } catch (error) {
    await page.screenshot({ path: output + "/erro.png", fullPage: true });
    fs.writeFileSync(
      output + "/erro.txt",
      await page.locator("body").innerText(),
    );
    console.error("URL: " + page.url());
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
