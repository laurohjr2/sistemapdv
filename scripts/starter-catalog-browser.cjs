const { chromium } = require("../work/browser/node_modules/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { rootUrl, client } = require("./testing/commercial-context.cjs");
const state = JSON.parse(fs.readFileSync("work/catalogs/session.json"));
(async () => {
  const { request } = client();
  const catalogs = await request("/products/starter-catalogs", {
    token: state.second.token,
  });
  const candidate = catalogs
    .find((c) => c.id === "hamburgueria")
    .items.find((i) => !i.exists && i.name.startsWith("X-"));
  assert.ok(
    candidate,
    "Catálogo sintético precisa de um item ainda não importado",
  );
  const itemLabel = new RegExp(
    "^" + candidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " Produto",
  );
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript((session) => {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("company", session.user.company);
  }, state.second);
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(rootUrl + "/products");
    await page
      .getByRole("button", { name: "Importar catálogo inicial", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("combobox", { name: "Catálogo", exact: true })
      .selectOption("hamburgueria");
    await dialog.getByLabel("Buscar no catálogo").fill(candidate.name);
    await dialog.getByRole("checkbox", { name: itemLabel }).check();
    await dialog
      .getByRole("button", { name: "Importar 1 item inativo" })
      .click();
    await dialog.waitFor({ state: "hidden" });
    checks++;
    await page.getByRole("tab", { name: /Inativos/ }).click();
    const row = page
      .getByRole("row")
      .filter({ has: page.getByText(candidate.name, { exact: true }) });
    await row.getByText("Inativo", { exact: true }).waitFor();
    await page
      .getByRole("tab", { name: "Estoque Baixo (0)", exact: true })
      .waitFor();
    assert.ok((await row.innerText()).includes("0,00"));
    checks++;
    await page
      .getByRole("button", { name: "Importar catálogo inicial", exact: true })
      .click();
    await dialog
      .getByRole("combobox", { name: "Catálogo", exact: true })
      .selectOption("hamburgueria");
    await dialog.getByLabel("Buscar no catálogo").fill(candidate.name);
    assert.ok(
      await dialog.getByRole("checkbox", { name: itemLabel }).isDisabled(),
    );
    checks++;
    await dialog.getByLabel("Buscar no catálogo").fill("smash");
    await dialog
      .getByRole("button", { name: "Selecionar resultados", exact: true })
      .click();
    await dialog.getByLabel("Buscar no catálogo").fill("nãoexiste");
    await dialog.getByText("Nenhum item encontrado.").waitFor();
    assert.ok(
      await dialog
        .getByRole("button", { name: "Importar 2 itens inativos" })
        .isEnabled(),
    );
    checks++;
    await dialog
      .getByRole("button", { name: "Limpar seleção", exact: true })
      .click();
    await dialog
      .getByRole("combobox", { name: "Catálogo", exact: true })
      .selectOption("oficina");
    await dialog.getByLabel("Buscar no catálogo").fill("óleo");
    await dialog.getByText(/Peças genéricas/).waitFor();
    await page.screenshot({
      path: "work/catalogs/catalogo-desktop.png",
      fullPage: true,
    });
    checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "work/catalogs/catalogo-mobile.png",
      fullPage: false,
    });
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 845);
    await dialog
      .getByRole("button", { name: "Fechar", exact: true })
      .scrollIntoViewIfNeeded();
    checks++;
    await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await context.close();
    for (const [session, allowed] of [
      [state.employee, false],
      [state.manager, true],
      [state.master, true],
      [state.support, false],
    ]) {
      const ctx = await browser.newContext();
      await ctx.addInitScript((s) => {
        localStorage.setItem("token", s.token);
        localStorage.setItem("user", JSON.stringify(s.user));
        localStorage.setItem("company", s.user.company);
      }, session);
      const p = await ctx.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(rootUrl + "/products");
      await p
        .getByRole("heading", {
          name:
            session.user.role === "garcom"
              ? "Acesso Negado"
              : "Produtos e serviços",
          exact: true,
          level: session.user.role === "garcom" ? 2 : 1,
        })
        .waitFor();
      const button = p.getByRole("button", {
        name: "Importar catálogo inicial",
        exact: true,
      });
      if (allowed) await button.waitFor();
      else assert.equal(await button.count(), 0);
      checks++;
      await ctx.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador aprovadas, incluindo importação, repetição, busca, seleção, celular e permissões; sem erros JavaScript.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
