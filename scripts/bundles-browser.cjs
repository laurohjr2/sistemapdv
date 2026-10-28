const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/bundles/fixture.json")),
    { request } = client();
  const login = await request("/auth/login", {
    method: "POST",
    body: { company: f.company, username: f.username, password: f.password },
  });
  const api = (p, method = "GET", body, status = 200) =>
    request(p, { method, body, status, token: login.token });
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  const label = "Combo navegador " + Date.now();
  try {
    const c = await b.newContext({ viewport: { width: 1440, height: 1080 } });
    await c.addInitScript((s) => {
      localStorage.setItem("token", s.token);
      localStorage.setItem("user", JSON.stringify(s.user));
      localStorage.setItem("company", s.user.company);
    }, login);
    await c.addInitScript(() => {
      window.print = () => {};
    });
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", (d) => d.accept());
    await p.goto(rootUrl + "/bundles");
    await p.getByLabel("Nome do combo", { exact: true }).fill(label);
    await p.getByLabel("Preço do conjunto", { exact: true }).fill("1000");
    await p
      .getByLabel("Componente do combo", { exact: true })
      .selectOption(f.burgerId);
    await p
      .getByRole("button", { name: "Adicionar componente", exact: true })
      .click();
    await p
      .getByLabel("Componente do combo", { exact: true })
      .selectOption(f.drinkId);
    await p
      .getByRole("button", { name: "Adicionar componente", exact: true })
      .click();
    await p
      .getByLabel("Adicional opcional", { exact: true })
      .selectOption(f.extraId);
    await p
      .getByRole("button", { name: "Adicionar opção", exact: true })
      .click();
    await p.getByRole("button", { name: "Salvar combo", exact: true }).click();
    await p.getByRole("status").filter({ hasText: "Combo salvo." }).waitFor();
    const menu = (await api("/bundles")).find((b) => b.name === label);
    assert.equal(Number(menu.price), 10);
    checks++;
    await p.screenshot({ path: "work/bundles/catalogo.png", fullPage: true });
    await p.goto(rootUrl + "/sales");
    await p.getByText("Caixa Aberto", { exact: true }).waitFor();
    await p
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    let d = p.getByRole("dialog").filter({
      has: p.getByRole("heading", {
        name: "Selecionar combo e adicionais",
        exact: true,
      }),
    });
    await d.getByLabel("Combo", { exact: true }).selectOption(menu.id);
    await d
      .getByLabel("Adicional Queijo extra porção", { exact: true })
      .fill("1");
    await d
      .getByLabel("Observações do combo", { exact: true })
      .fill("Sem molho, combo navegador");
    await d.getByRole("status").filter({ hasText: "R$ 12,00" }).waitFor();
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
    const before = Number(
      (await api("/products/" + f.ingredientId)).currentStock,
    );
    await p.getByRole("button", { name: /^Carrinho \(/ }).click();
    d = p.getByRole("dialog");
    await d
      .getByRole("button", { name: "Finalizar Venda", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    const sales = await api("/sales"),
      sale = sales[0];
    assert.equal(Number(sale.total_amount), 12);
    assert.equal(sale.items.filter((i) => i.bundle).length, 3);
    assert.equal(
      Number((await api("/products/" + f.ingredientId)).currentStock),
      Number((before - 0.02).toFixed(3)),
    );
    checks++;
    const receiptPromise = p.waitForEvent("popup");
    await p.getByRole("button", { name: "Imprimir Nota", exact: true }).click();
    const receipt = await receiptPromise;
    await receipt.waitForLoadState("domcontentloaded");
    assert.ok(
      (await receipt.locator("body").innerText()).includes("Combo: " + label),
    );
    assert.ok(
      (await receipt.locator("body").innerText()).includes(
        "Queijo extra porção",
      ),
    );
    await receipt.close();
    checks++;
    const account = (
      await api(
        "/comandas",
        "POST",
        { type: "balcao", customerName: "Mesa Combo Navegador" },
        201,
      )
    ).comanda;
    await p.goto(rootUrl + "/comandas?comanda=" + account.id);
    await p
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    d = p.getByRole("dialog").filter({
      has: p.getByRole("heading", {
        name: "Selecionar combo e adicionais",
        exact: true,
      }),
    });
    await d.getByLabel("Combo", { exact: true }).selectOption(menu.id);
    await d.getByRole("status").filter({ hasText: "R$ 10,00" }).waitFor();
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    assert.equal(Number((await api("/comandas/" + account.id)).totalValue), 10);
    checks++;
    const removal = p.waitForResponse(
      (r) =>
        r.url().includes("/api/bundles/comandas/" + account.id + "/") &&
        r.request().method() === "DELETE",
    );
    await p
      .getByRole("button", { name: "Remover combo", exact: true })
      .first()
      .click();
    assert.equal((await removal).status(), 200);
    await p
      .getByRole("button", { name: "Remover combo", exact: true })
      .first()
      .waitFor({ state: "hidden" });
    assert.equal((await api("/comandas/" + account.id)).items.length, 0);
    checks++;
    const { table } = await api(
      "/tables",
      "POST",
      { tableNumber: 1000 + (Date.now() % 800000), capacity: 4 },
      201,
    );
    await p.goto(rootUrl + "/tables");
    await p
      .getByRole("row")
      .filter({ hasText: "Mesa " + table.tableNumber })
      .getByRole("button", { name: "Abrir Comanda", exact: true })
      .click();
    let accountDialog = p.getByRole("dialog");
    await accountDialog
      .getByLabel("Nome do cliente", { exact: true })
      .fill("Cliente Combo Mesa");
    await accountDialog
      .getByRole("button", { name: "Abrir comanda", exact: true })
      .click();
    await accountDialog
      .getByRole("button", { name: "Selecionar combo", exact: true })
      .click();
    d = p.getByRole("dialog").filter({
      has: p.getByRole("heading", {
        name: "Selecionar combo e adicionais",
        exact: true,
      }),
    });
    await d.getByLabel("Combo", { exact: true }).selectOption(menu.id);
    await d.getByRole("status").filter({ hasText: "R$ 10,00" }).waitFor();
    await d
      .getByRole("button", { name: "Adicionar combo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    const tableData = await api("/tables/" + table.id),
      tableAccount = tableData.comandas[0];
    assert.equal(
      Number((await api("/comandas/" + tableAccount.id)).totalValue),
      10,
    );
    checks++;
    const conferencePromise = p.waitForEvent("popup");
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Imprimir conferência", exact: true })
      .click();
    const conference = await conferencePromise;
    await conference.waitForLoadState("domcontentloaded");
    assert.ok(
      (await conference.locator("body").innerText()).includes(
        "Combo: " + label,
      ),
    );
    await conference.close();
    checks++;
    await api("/comandas/" + tableAccount.id + "/cancel", "PUT", {});
    await p.goto(rootUrl + "/bundles");
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByLabel("Nome do combo", { exact: true }).waitFor();
    assert.ok(
      await p
        .locator("main")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    );
    await p.screenshot({ path: "work/bundles/celular.png", fullPage: true });
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: catálogo, máscara monetária, adicionais, venda/ingredientes, comanda, remoção do grupo, mesa, cupons e celular.",
    );
  } catch (e) {
    console.error("Browser URL:", e.message);
    throw e;
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
