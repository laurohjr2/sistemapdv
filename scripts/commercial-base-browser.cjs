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
const { request } = client(),
  secret = credentials();
const state = JSON.parse(fs.readFileSync("work/commerce/session.json", "utf8")),
  stamp = Date.now();
const output = "work/commerce/screens";
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
    timezoneId: "America/Sao_Paulo",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  let checks = 0;
  async function login(username, password) {
    await page.goto(rootUrl + "/login");
    await page.getByLabel("Código da empresa").fill("demo");
    await page.getByLabel("Usuário", { exact: true }).fill(username);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }
  async function pdf(button) {
    const p = page.waitForEvent("download");
    await button.click();
    assert.ok((await p).suggestedFilename().endsWith(".pdf"));
    checks++;
  }
  try {
    await login("master.local", "nao-e-uma-senha-real");
    await page
      .getByRole("alert")
      .filter({ hasText: "conta do fornecedor" })
      .waitFor();
    await page
      .getByRole("link", { name: "Acesso do fornecedor — Master / suporte" })
      .click();
    await page
      .getByRole("heading", { name: "Acesso do fornecedor", level: 1 })
      .waitFor();
    checks++;
    await page.goto(rootUrl + "/login");
    await login("admin.local", secret.admin);
    await page.waitForURL(rootUrl + "/");
    await page.getByText("Administrador da empresa", { exact: true }).waitFor();
    checks++;
    await page.goto(rootUrl + "/settings");
    await page.getByLabel("Perfil do negócio").selectOption("oficina");
    await page.locator("#pixKey").fill("pix-teste@example.com");
    await page
      .getByRole("button", { name: "Salvar configurações", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "Configurações salvas" })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Mesas", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: "Cozinha", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.locator('[data-testid="support-client-id"]').count(),
      0,
    );
    checks += 3;
    await page.goto(rootUrl + "/products");
    await page
      .getByRole("button", { name: "Novo Produto", exact: true })
      .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tipo do item").selectOption("service");
    await dialog.locator("#name").fill("Serviço de navegador " + stamp);
    await dialog.getByLabel("Nova categoria").fill("Serviços personalizados");
    await dialog
      .getByRole("button", { name: "Adicionar", exact: true })
      .click();
    await dialog.getByRole("tab", { name: "Preços", exact: true }).click();
    await dialog.locator("#salePrice").fill("4500");
    assert.equal(await dialog.locator("#salePrice").inputValue(), "45,00");
    assert.equal(
      await dialog.getByLabel("Estoque Inicial", { exact: false }).count(),
      0,
    );
    const serviceResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/products") && r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Criar Produto", exact: true })
      .click();
    const serviceResult = await serviceResponse;
    const serviceData = await serviceResult.json();
    assert.equal(
      serviceResult.status(),
      201,
      serviceData.error || "Cadastro de serviço",
    );
    const service = serviceData.product;
    await dialog.waitFor({ state: "hidden" });
    assert.equal(service.itemType, "service");
    checks += 3;
    const current = await request("/cash-register/status", {
      token: state.admin,
    });
    if (current.is_open)
      await request("/cash-register/close", {
        method: "POST",
        token: state.admin,
        body: { closing_amount: 0 },
      });
    await request("/cash-register/open", {
      method: "POST",
      token: state.admin,
      body: { opening_amount: 50 },
      status: 201,
    });
    await page.goto(rootUrl + "/quotes");
    await page
      .getByRole("button", { name: "Novo orçamento", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Cliente de navegador " + stamp);
    await dialog.getByLabel("Produto ou serviço").selectOption(service.id);
    await dialog
      .getByRole("button", { name: "Adicionar item", exact: true })
      .click();
    await dialog
      .getByLabel("Produto ou serviço")
      .selectOption(state.product.id);
    await dialog
      .getByRole("button", { name: "Adicionar item", exact: true })
      .click();
    await dialog.getByLabel("Desconto (R$)").fill("500");
    const quoteResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/commerce/quotes") &&
        r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Salvar orçamento", exact: true })
      .click();
    const quote = await (await quoteResponse).json();
    assert.equal(Number(quote.total), 70);
    await dialog.waitFor({ state: "hidden" });
    checks++;
    let row = page
      .getByRole("row")
      .filter({ hasText: "Cliente de navegador " + stamp });
    await row
      .getByRole("button", { name: "Marcar como enviado", exact: true })
      .click();
    await row.getByText("Enviado", { exact: true }).waitFor();
    await row
      .getByRole("button", { name: "Registrar aceite", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Como o cliente aprovou?")
      .fill("Aceite presencial registrado no teste");
    await dialog.getByRole("button", { name: "Confirmar aprovação" }).click();
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Aprovado", { exact: true }).waitFor();
    await pdf(row.getByRole("button", { name: "PDF", exact: true }));
    checks++;
    await row
      .getByRole("button", { name: "Converter em venda", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Pagamento", { exact: true }).selectOption("pix");
    await dialog.getByText("pix-teste@example.com", { exact: false }).waitFor();
    await page.screenshot({
      path: output + "/orcamento-conversao.png",
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Receber e converter", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Convertido em venda", { exact: true }).waitFor();
    checks++;
    await page.goto(rootUrl + "/purchases");
    await page.getByRole("button", { name: "Novo pedido de compra" }).click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Fornecedor", { exact: true })
      .selectOption(state.supplier.id);
    await dialog
      .getByLabel("Produto para comprar")
      .selectOption(state.product.id);
    await dialog
      .getByRole("button", { name: "Adicionar item", exact: true })
      .click();
    await dialog
      .getByLabel("Quantidade de " + state.product.name, { exact: true })
      .fill("3");
    assert.equal(
      await dialog.locator(`option[value="${service.id}"]`).count(),
      0,
    );
    const purchaseResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/commerce/purchases") &&
        r.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Salvar pedido", exact: true })
      .click();
    const order = await (await purchaseResponse).json();
    await dialog.waitFor({ state: "hidden" });
    row = page
      .getByRole("row")
      .filter({ has: page.getByText("#" + order.number, { exact: true }) });
    await row
      .getByRole("button", { name: "Registrar recebimento", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Receber " + state.product.name, { exact: true })
      .fill("1");
    await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Parcial", { exact: true }).waitFor();
    checks += 2;
    await page.goto(rootUrl + "/finance");
    row = page
      .getByRole("row")
      .filter({ hasText: "Compra #" + order.number + " — recebimento" });
    await row.getByRole("button", { name: "Pagar", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor a registrar").fill("200");
    await dialog.getByRole("button", { name: "Confirmar registro" }).click();
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Parcial", { exact: true }).waitFor();
    await row.getByText("R$ 3,00", { exact: true }).waitFor();
    await page.screenshot({ path: output + "/financeiro.png", fullPage: true });
    await pdf(
      page.getByRole("button", { name: "Exportar financeiro", exact: true }),
    );
    checks++;
    await page.getByRole("button", { name: "Nova conta", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tipo de conta").selectOption("receivable");
    await dialog
      .getByLabel("Descrição", { exact: true })
      .fill("Recebimento de navegador " + stamp);
    await dialog
      .getByLabel("Nome do cliente / fornecedor", { exact: true })
      .fill("Cliente avulso");
    await dialog.getByLabel("Valor (R$)", { exact: true }).fill("525");
    await dialog
      .getByRole("button", { name: "Salvar conta", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    row = page
      .getByRole("row")
      .filter({ hasText: "Recebimento de navegador " + stamp });
    await row.getByRole("button", { name: "Receber", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Forma de pagamento").selectOption("dinheiro");
    await dialog.getByRole("button", { name: "Confirmar registro" }).click();
    await dialog.waitFor({ state: "hidden" });
    await row.getByText("Quitado", { exact: true }).waitFor();
    checks++;
    await page.goto(rootUrl + "/sales");
    await page
      .getByRole("button", { name: "Fechar Caixa", exact: true })
      .click();
    dialog = page.getByRole("dialog");
    await dialog
      .getByText("Saldo esperado em dinheiro: R$ 55,25", { exact: true })
      .waitFor();
    await dialog.locator("#closing_amount").fill("5525");
    await dialog
      .getByRole("button", { name: "Fechar Caixa", exact: true })
      .click();
    await dialog.waitFor({ state: "hidden" });
    checks++;
    await page.goto(rootUrl + "/about");
    await page.getByText(require("../bar-frontend/src/release.json").version, { exact: true }).nth(1).waitFor();
    assert.equal(await page.getByRole("alert").count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(rootUrl + "/settings");
    await page
      .getByRole("heading", { name: "Configurações", level: 1 })
      .waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await page.screenshot({
      path: output + "/perfil-mobile.png",
      fullPage: true,
    });
    checks += 2;
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
    await page.goto(rootUrl + "/");
    await page.waitForURL(rootUrl + "/sales");
    await page.getByText("Atendente", { exact: true }).waitFor();
    await page.goto(rootUrl + "/finance");
    await page.getByRole("heading", { name: "Acesso Negado" }).waitFor();
    checks += 2;
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(rootUrl + "/support");
    await page.getByLabel("Usuário do fornecedor").fill("master.local");
    await page.getByLabel("Senha do suporte").fill(secret.master);
    await page
      .getByRole("button", {
        name: "Entrar como Master / suporte",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Acessar empresa", exact: true })
      .first()
      .click();
    await page.waitForURL(rootUrl + "/settings");
    await page.locator('[data-testid="support-client-id"]').waitFor();
    await page.getByText("Master — fornecedor", { exact: true }).waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Salvar configurações", exact: true })
        .isEnabled(),
      true,
    );
    await page.screenshot({ path: output + "/master.png", fullPage: true });
    checks += 2;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador comercial aprovadas: perfis, serviços, orçamentos, compra parcial, financeiro, caixa, versão, acesso Master e layout móvel.`,
    );
  } catch (error) {
    await page.screenshot({ path: output + "/erro.png", fullPage: true });
    fs.writeFileSync(
      output + "/erro.txt",
      await page.locator("body").innerText(),
    );
    console.error("URL do teste: " + page.url());
    throw error;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
