// Only the otherwise empty second tenant created by pizza-bundles-smoke.cjs.
const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark22/session.json"));
  assert.match(s.slug, /^pizza-combo-/);
  const { request, count } = client(),
    api = (path, method = "GET", body, status = 200) =>
      request(path, { method, body, status, token: s.second.token });
  await api("/settings", "PUT", {
    businessProfile: "comercio",
    modules: { purchasing: true, finance: true },
  });
  fs.mkdirSync("work/mark23", { recursive: true });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      timezoneId: "America/Sao_Paulo",
    });
    await context.addInitScript((u) => {
      localStorage.setItem("token", u.token);
      localStorage.setItem("user", JSON.stringify(u.user));
      localStorage.setItem("company", u.user.company);
    }, s.second);
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function ack(message) {
      const t = page.getByText(message, { exact: true });
      await t.waitFor();
      await page.mouse.move(0, 0);
      assert.equal(
        await page.locator("[data-sonner-toast].save-success-toast").count(),
        1,
      );
      const at = Date.now();
      await t.waitFor({ state: "hidden", timeout: 5000 });
      assert.ok(Date.now() - at < 4500);
      checks++;
    }
    const response = (path, method) =>
      page.waitForResponse(
        (r) =>
          r.url().endsWith("/api" + path) && r.request().method() === method,
      );
    async function settings() {
      await page.goto(rootUrl + "/settings");
      await page
        .getByRole("button", { name: "Salvar configurações", exact: true })
        .waitFor();
    }
    async function saveSettings(status = 200) {
      const pending = response("/settings", "PUT");
      await page
        .getByRole("button", { name: "Salvar configurações", exact: true })
        .click();
      assert.equal((await pending).status(), status);
      if (status === 200) await ack("Configurações salvas com sucesso.");
    }
    await settings();
    const finance = () =>
        page.getByRole("checkbox", {
          name: "Contas a pagar e receber",
          exact: true,
        }),
      purchases = () =>
        page.getByRole("checkbox", {
          name: "Fornecedores e compras",
          exact: true,
        });
    assert.ok(await finance().isChecked());
    assert.ok(await finance().isDisabled());
    await page
      .getByText(
        "Ativado automaticamente por Fornecedores e compras. Para desativar o financeiro, desmarque primeiro Fornecedores e compras.",
        { exact: true },
      )
      .waitFor();
    checks++;
    await purchases().uncheck();
    assert.ok(await finance().isEnabled());
    await finance().uncheck();
    await saveSettings();
    assert.equal((await api("/settings")).modules.finance, false);
    assert.equal(
      await page.getByRole("link", { name: "Financeiro", exact: true }).count(),
      0,
    );
    checks++;
    await purchases().check();
    assert.ok(await finance().isChecked());
    assert.ok(await finance().isDisabled());
    await saveSettings();
    const dependent = await api("/settings");
    assert.equal(dependent.modules.finance, true);
    assert.equal(dependent.modules.purchasing, true);
    checks++;
    await api("/settings", "PUT", { modules: { finance: false } }, 400);
    checks++;
    await purchases().uncheck();
    await saveSettings();
    assert.ok(await finance().isEnabled());
    // Independent finance creates both directions and blocks disabling with open balances.
    await page.goto(rootUrl + "/finance");
    const labels = [];
    for (const [direction, amount] of [
      ["payable", "1000"],
      ["receivable", "2000"],
    ]) {
      const label = "Conta " + direction + " " + Date.now();
      labels.push(label);
      await page
        .getByRole("button", { name: "Nova conta", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d
        .getByLabel("Tipo de conta", { exact: true })
        .selectOption(direction);
      await d.getByLabel("Descrição", { exact: true }).fill(label);
      await d
        .getByLabel("Nome do cliente / fornecedor", { exact: true })
        .fill("Pessoa sintética");
      await d.getByLabel("Valor (R$)", { exact: true }).fill(amount);
      await d
        .getByRole("button", { name: "Salvar conta", exact: true })
        .click();
      await ack("Conta salva com sucesso.");
    }
    let ledger = await api("/commerce/finance");
    assert.equal(ledger.summary.payable, 10);
    assert.equal(ledger.summary.receivable, 20);
    checks++;
    await settings();
    await finance().uncheck();
    await saveSettings(400);
    await page
      .getByRole("alert")
      .filter({ hasText: "Quite as contas pendentes" })
      .waitFor();
    assert.equal(
      await page.locator("[data-sonner-toast].save-success-toast").count(),
      0,
    );
    assert.equal((await api("/settings")).modules.finance, true);
    checks++;
    await page.goto(rootUrl + "/finance");
    for (let index = 0; index < labels.length; index++) {
      const row = page.getByRole("row").filter({ hasText: labels[index] });
      await row
        .getByRole("button", {
          name: index === 0 ? "Pagar" : "Receber",
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirmar registro", exact: true })
        .click();
      await ack("Movimentação financeira salva com sucesso.");
    }
    ledger = await api("/commerce/finance");
    assert.equal(ledger.summary.payable, 0);
    assert.equal(ledger.summary.receivable, 0);
    checks++;
    fs.writeFileSync(
      "work/mark23/financeiro.pdf",
      await api("/commerce/finance/export.pdf"),
    );
    checks++;
    // A normal form and a failed server save exercise the shared Axios notification.
    await page.goto(rootUrl + "/customers");
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Cliente banner " + Date.now());
    await page
      .getByRole("button", { name: "Cadastrar cliente", exact: true })
      .click();
    await ack("Cliente salvo com sucesso.");
    await page.route("**/api/customers", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Falha controlada de teste" }),
          })
        : route.continue(),
    );
    await page.getByLabel("Nome", { exact: true }).fill("Não deve salvar");
    await page
      .getByRole("button", { name: "Cadastrar cliente", exact: true })
      .click();
    await page
      .getByRole("alert")
      .getByText("Falha controlada de teste", { exact: true })
      .waitFor();
    assert.equal(
      await page.locator("[data-sonner-toast].save-success-toast").count(),
      0,
    );
    checks++;
    await page.unroute("**/api/customers");
    // Refresh/read does not claim a save; dark theme and mobile retain readable success.
    await settings();
    assert.equal(
      await page.locator("[data-sonner-toast].save-success-toast").count(),
      0,
    );
    checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const pending = response("/settings", "PUT");
    await page
      .getByRole("button", { name: "Salvar configurações", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    await page
      .getByText("Configurações salvas com sucesso.", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "work/mark23/configuracoes-mobile.png",
      fullPage: true,
    });
    await ack("Configurações salvas com sucesso.");
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      checks +
        " verificações de navegador e " +
        count() +
        " requisições aprovadas: dependências, financeiro independente, pagar/receber, bloqueios, confirmação de dois segundos, falhas e celular/escuro.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
