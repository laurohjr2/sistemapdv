// Usa somente a empresa sintética preparada por pizza-bundles-smoke.cjs.
const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark22/session.json"));
  assert.match(s.slug, /^pizza-combo-/);
  const { request } = client(),
    api = (p, method = "GET", body, status = 200) =>
      request(p, { method, body, status, token: s.login.token });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  try {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      timezoneId: "America/Sao_Paulo",
    });
    await c.addInitScript((u) => {
      localStorage.setItem("token", u.token);
      localStorage.setItem("user", JSON.stringify(u.user));
      localStorage.setItem("company", u.user.company);
      window.print = () => {};
    }, s.login);
    const page = await c.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    const label = "Combo duas pizzas navegador " + Date.now();
    await page.goto(rootUrl + "/bundles");
    await page.getByLabel("Nome do combo", { exact: true }).fill(label);
    await page.getByLabel("Preço do conjunto", { exact: true }).fill("9000");
    await page
      .getByLabel("Componente do combo", { exact: true })
      .selectOption(s.base.id);
    await page
      .getByRole("button", { name: "Adicionar componente", exact: true })
      .click();
    await page
      .getByLabel("Tamanho da pizza de " + s.base.name, { exact: true })
      .selectOption(s.large);
    await page
      .getByLabel("Unidades de " + s.base.name, { exact: true })
      .fill("2");
    await page
      .getByLabel("Componente do combo", { exact: true })
      .selectOption(s.drink.id);
    await page
      .getByRole("button", { name: "Adicionar componente", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Salvar combo", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Combo salvo." })
      .waitFor();
    const bundle = (await api("/bundles")).find((b) => b.name === label);
    assert.equal(bundle.components[0].pizzaSizeId, s.large);
    checks++;
    function picker() {
      return page.getByRole("dialog").filter({
        has: page.getByRole("heading", {
          name: "Selecionar combo e adicionais",
          exact: true,
        }),
      });
    }
    async function mount(slot, rich) {
      let d = picker();
      await d
        .getByRole("button", {
          name: "Montar pizza " + (slot + 1),
          exact: true,
        })
        .click();
      const pizza = page.getByRole("dialog").filter({
        has: page.getByRole("heading", {
          name: "Montar pizza do combo",
          exact: true,
        }),
      });
      assert.equal(
        await pizza
          .getByLabel("Tamanho da pizza", { exact: true })
          .inputValue(),
        s.large,
      );
      assert.ok(
        await pizza
          .getByLabel("Tamanho da pizza", { exact: true })
          .isDisabled(),
      );
      await pizza
        .getByLabel(
          "Sabor " + s.menu.flavors.find((f) => f.id === s.calabresa).name,
          { exact: true },
        )
        .check();
      if (rich) {
        await pizza
          .getByLabel(
            "Sabor " + s.menu.flavors.find((f) => f.id === s.queijo).name,
            { exact: true },
          )
          .check();
        await pizza
          .getByLabel("Borda da pizza", { exact: true })
          .selectOption(s.crust);
        await pizza.getByLabel("Adicional Bacon", { exact: true }).check();
        await pizza
          .getByLabel("Quantidade de Bacon", { exact: true })
          .fill("2");
      }
      await pizza
        .getByText(
          "Acréscimo por pizza no combo: " + (rich ? "R$ 11,00" : "R$ 0,00"),
          { exact: true },
        )
        .waitFor();
      await pizza
        .getByRole("button", { name: "Confirmar pizza no combo", exact: true })
        .click();
      await pizza.waitFor({ state: "hidden" });
    }
    async function choose(id, amount = 1) {
      const d = picker();
      await d.getByLabel("Combo", { exact: true }).selectOption(id);
      assert.ok(
        await d
          .getByRole("button", { name: "Adicionar combo", exact: true })
          .isDisabled(),
      );
      await mount(0, true);
      assert.ok(
        await d
          .getByRole("button", { name: "Adicionar combo", exact: true })
          .isDisabled(),
      );
      await mount(1, false);
      await d
        .getByLabel("Quantidade de combos", { exact: true })
        .fill(String(amount));
      await d.getByRole("status").filter({ hasText: "R$ 101,00" }).waitFor();
      return d;
    }
    await page.goto(rootUrl + "/sales");
    await page.getByText("Caixa Aberto", { exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    let d = await choose(bundle.id, 2);
    checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({
      path: "work/mark22/montagem-mobile.png",
      fullPage: true,
    });
    checks++;
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 1440, height: 1080 });
    const before = Number((await api("/products/" + s.base.id)).currentStock);
    await page.getByRole("button", { name: /^Carrinho \(/ }).click();
    d = page.getByRole("dialog");
    await d
      .getByRole("button", { name: "Finalizar Venda", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    const sale = (await api("/sales"))[0];
    assert.equal(Number(sale.total_amount), 202);
    assert.equal(sale.items.filter((i) => i.pizza).length, 2);
    assert.equal(
      Number((await api("/products/" + s.base.id)).currentStock),
      before - 4,
    );
    checks++;
    const popupEvent = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "Imprimir Nota", exact: true })
      .click();
    const popup = await popupEvent;
    await popup.waitForLoadState("domcontentloaded");
    assert.match(await popup.locator("body").innerText(), /Borda: Requeijão/);
    await popup.close();
    checks++;
    await page.goto(rootUrl + "/kitchen");
    const cards = page
      .locator("article")
      .filter({ hasText: "Venda #" + sale.id });
    await cards.first().waitFor();
    assert.equal(await cards.count(), 2);
    for (let n = 0; n < 2; n++) {
      const card = cards.first();
      await card
        .getByRole("button", { name: "Iniciar preparo", exact: true })
        .click();
      await card
        .getByRole("button", { name: "Marcar pronta", exact: true })
        .click();
      await card
        .getByRole("button", { name: "Registrar retirada", exact: true })
        .click();
    }
    await cards.waitFor({ state: "hidden" });
    checks++;
    const account = (
      await api(
        "/comandas",
        "POST",
        { type: "balcao", customerName: "Combo navegador" },
        201,
      )
    ).comanda;
    await page.goto(rootUrl + "/comandas?comanda=" + account.id);
    await page
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    d = await choose(bundle.id);
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    assert.equal(
      Number((await api("/comandas/" + account.id)).totalValue),
      101,
    );
    checks++;
    await page
      .getByRole("button", { name: "Remover combo", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Remover combo", exact: true })
      .first()
      .waitFor({ state: "hidden" });
    assert.equal(Number((await api("/comandas/" + account.id)).totalValue), 0);
    checks++;
    const { table } = await api(
      "/tables",
      "POST",
      { tableNumber: 1000 + (Date.now() % 800000), capacity: 4 },
      201,
    );
    await page.goto(rootUrl + "/tables");
    await page
      .getByRole("row")
      .filter({ hasText: "Mesa " + table.tableNumber })
      .getByRole("button", { name: "Abrir Comanda", exact: true })
      .click();
    let td = page.getByRole("dialog");
    await td
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Mesa pizza combo");
    await td
      .getByRole("button", { name: "Abrir comanda", exact: true })
      .click();
    await td
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    d = await choose(bundle.id);
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    td = page.getByRole("dialog");
    await td.getByText("Total: R$ 101,00", { exact: true }).waitFor();
    assert.equal(
      await td
        .getByRole("button", { name: "Atualizar quantidade", exact: true })
        .count(),
      0,
    );
    checks++;
    const receiptEvent = page.waitForEvent("popup");
    await td
      .getByRole("button", { name: "Imprimir conferência", exact: true })
      .click();
    const receipt = await receiptEvent;
    await receipt.waitForLoadState("domcontentloaded");
    assert.match(await receipt.locator("body").innerText(), /Borda: Requeijão/);
    await receipt.close();
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      checks +
        " verificações de navegador aprovadas: cadastro, montagem por pizza, dois combos, preço, estoque, cozinha, cupom, comanda, mesa e celular/escuro.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
