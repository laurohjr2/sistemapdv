// Requires Playwright outside the application and the isolated smoke-test project.
const { chromium } = require(
  process.env.PDV_PLAYWRIGHT || "../work/browser/node_modules/playwright",
);
const fs = require("node:fs"),
  assert = require("node:assert/strict"),
  { execFileSync } = require("node:child_process");
const base = process.env.PDV_TEST_URL || "http://127.0.0.1:8090",
  project = process.env.PDV_TEST_PROJECT || "pdv-changes-test";
const state = JSON.parse(fs.readFileSync("work/test-session.json", "utf8"));
const output = "work/browser-images";
fs.mkdirSync(output, { recursive: true });
assert.match(
  project,
  /^pdv-.*-test$/,
  "Use somente um projeto Docker descartável de teste",
);
const credentials = execFileSync(
  "docker",
  [
    "compose",
    "-p",
    project,
    "-f",
    "compose.yaml",
    "-f",
    "docker/customer-experience-test.yaml",
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
const password = /^Senha: (.+)$/m.exec(credentials)[1];
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFUlEQVR4nGNgCNAgDY1qGNUwfDUAAKXJeAHRLEfzAAAAAElFTkSuQmCC";
async function api(
  path,
  body,
  method = body ? "POST" : "GET",
  token = state.adminToken,
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(r.ok, path + " " + r.status);
  return r.json();
}
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  let checks = 0;
  try {
    const existing = await api("/cash-register/status");
    if (existing.is_open)
      await api("/cash-register/close", { closing_amount: 0 });
    await page.goto(base + "/login");
    await page.getByLabel("Código da empresa").fill("demo");
    await page.getByLabel("Usuário", { exact: true }).fill("admin.local");
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Mostrar senha", exact: true })
      .click();
    assert.equal(await page.locator("#password").getAttribute("type"), "text");
    await page
      .getByRole("button", { name: "Ocultar senha", exact: true })
      .click();
    checks++;
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(base + "/");
    await page.goto(base + "/sales");
    await page
      .getByRole("button", { name: "Abrir Caixa", exact: true })
      .click();
    const opening = page.getByRole("dialog");
    assert.equal(
      await opening.locator("#opened_by").inputValue(),
      "admin.local",
    );
    assert.ok(
      (await opening.locator("#opened_by").getAttribute("readonly")) !== null,
    );
    await opening.locator("#opening_amount").fill("123456");
    assert.equal(
      await opening.locator("#opening_amount").inputValue(),
      "1.234,56",
    );
    await opening
      .getByRole("button", { name: "Abrir Caixa", exact: true })
      .click();
    await opening.waitFor({ state: "hidden" });
    checks += 2;
    await api(
      "/settings",
      { pixKey: "pix-teste@example.com", pixQrCode: png, logo: png },
      "PUT",
    );
    const { table } = await api("/tables", {
      tableNumber: Math.floor(Date.now() / 1000),
      capacity: 4,
    });
    await page.goto(base + "/tables");
    const row = page.getByRole("row").filter({
      has: page.getByText("Mesa " + table.tableNumber, { exact: true }),
    });
    await row.getByRole("button", { name: "Abrir Comanda" }).click();
    const account = page.getByRole("dialog");
    await account
      .getByLabel("Cliente cadastrado")
      .selectOption(state.customer.id);
    await account
      .getByRole("button", { name: "Abrir comanda", exact: true })
      .click();
    await account
      .getByRole("button", { name: "Salvar cliente na comanda" })
      .waitFor();
    assert.equal(
      await account.getByLabel("Nome do cliente").inputValue(),
      state.customer.name,
    );
    checks++;
    await account
      .getByLabel("Adicionar produto")
      .selectOption(state.product.id);
    await account.getByLabel("Quantidade", { exact: true }).fill("2");
    await account
      .getByRole("button", { name: "Adicionar à comanda", exact: true })
      .click();
    await account
      .getByText(state.product.name, { exact: true })
      .first()
      .waitFor();
    await account.getByLabel("Desconto (R$)").fill("100");
    await account.getByRole("button", { name: "Dividir igualmente" }).click();
    assert.equal(
      await account
        .getByLabel("Valor do pagamento 1", { exact: true })
        .inputValue(),
      "9,50",
    );
    assert.equal(
      await account
        .getByLabel("Valor do pagamento 2", { exact: true })
        .inputValue(),
      "9,50",
    );
    await account.getByLabel("Forma do pagamento 2").selectOption("pix");
    await account.getByAltText("QR Code Pix do estabelecimento").waitFor();
    await page.screenshot({
      path: output + "/mesa-pagamento-dividido.png",
      fullPage: true,
    });
    checks += 3;
    const url = await page.locator('link[rel="icon"]').getAttribute("href");
    assert.equal(url, png);
    checks++;
    await account
      .getByRole("button", { name: "Receber, fechar e imprimir" })
      .click();
    await account.waitFor({ state: "hidden" });
    const tableAfter = await api("/tables/" + table.id);
    assert.equal(tableAfter.status, "disponivel");
    checks++;
    await page
      .getByRole("button", { name: "Fila de espera", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Fila de espera", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("link", { name: "Fila de espera", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await page.getByRole("link", { name: "Impressão", exact: true }).count(),
      0,
    );
    checks++;
    await page.goto(base + "/reports");
    await page
      .getByRole("heading", { name: "Ranking de vendedores" })
      .waitFor();
    await page.screenshot({
      path: output + "/ranking-vendedores.png",
      fullPage: true,
    });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Imprimir / baixar ranking" })
      .click();
    await (await download).saveAs(output + "/ranking.pdf");
    checks++;
    for (const [route, label] of [
      ["stock", "Relatório de estoque"],
      ["products", "Relatório de produtos"],
    ]) {
      await page.goto(base + "/" + route);
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: label, exact: true }).click();
      assert.ok((await download).suggestedFilename().endsWith(".pdf"));
      checks++;
    }
    await page.goto(base + "/customers");
    await page
      .getByRole("heading", { name: "Clientes", exact: true, level: 1 })
      .waitFor();
    await page.getByLabel("Buscar clientes").fill(state.customer.name);
    await page.getByText(state.customer.name, { exact: true }).waitFor();
    checks++;
    // Waiter can operate tables and sell, cannot access discounts, users or ranking.
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ ...user, company: "demo" }),
        );
      },
      { token: state.user.garcom.token, user: state.user.garcom },
    );
    await page.goto(base + "/sales");
    await page.getByRole("button", { name: /Carrinho \(/ }).click();
    assert.equal(await page.getByLabel("Desconto (R$)").count(), 0);
    await page.keyboard.press("Escape");
    assert.equal(
      await page.getByRole("link", { name: "Relatórios", exact: true }).count(),
      0,
    );
    checks++;
    // Mobile login and recovery routes.
    await page.evaluate(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/login");
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await page.getByRole("heading", { name: "Esqueci minha senha" }).waitFor();
    assert.ok(await page.getByLabel("E-mail cadastrado").isVisible());
    await page.screenshot({
      path: output + "/recuperacao-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador aprovadas; sem erros JavaScript. Capturas em ${output}.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
