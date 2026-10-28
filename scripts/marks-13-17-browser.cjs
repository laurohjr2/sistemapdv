const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs"),
  s = JSON.parse(fs.readFileSync("work/marks/session.json")),
  { request } = client();
const api = (p, method = "GET", body, status = 200) =>
  request(p, { method, body, status, token: s.login.token });
(async () => {
  const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    }),
    errors = [];
  let checks = 0;
  try {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "America/Sao_Paulo",
      acceptDownloads: true,
    });
    await c.addInitScript((session) => {
      localStorage.setItem("token", session.token);
      localStorage.setItem("user", JSON.stringify(session.user));
      localStorage.setItem("company", session.user.company);
    }, s.login);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("dialog", (d) => d.accept());
    const response = (path, method = "POST") =>
      p.waitForResponse(
        (r) =>
          r.url().includes("/api/" + path) && r.request().method() === method,
      );
    const local = (v) => {
      const d = new Date(v);
      return new Date(+d - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    };
    await p.goto(rootUrl + "/workshop-agenda");
    await p
      .getByRole("button", { name: "Novo agendamento", exact: true })
      .click();
    let d = p.getByRole("dialog");
    await d.getByLabel("Veículo", { exact: true }).selectOption(s.vehicle.id);
    await d
      .getByLabel("Responsável", { exact: true })
      .selectOption(s.employee.user.id);
    const agenda = await api("/workshop-agenda");
    const starts = Math.max(
      Date.now() + 45 * 86400000,
      ...agenda.map((a) => +new Date(a.endsAt) + 3600000),
    );
    await d.getByLabel("Início", { exact: true }).fill(local(starts));
    await d.getByLabel("Fim", { exact: true }).fill(local(starts + 3600000));
    const reason = "Agenda navegador " + Date.now();
    await d.getByLabel("Motivo do atendimento", { exact: true }).fill(reason);
    let pending = response("workshop-agenda");
    await d
      .getByRole("button", { name: "Salvar agendamento", exact: true })
      .click();
    assert.equal((await pending).status(), 201);
    await d.waitFor({ state: "hidden" });
    let card = p.getByRole("article").filter({ hasText: reason });
    await card
      .getByRole("button", { name: "Cliente chegou", exact: true })
      .click();
    d = p.getByRole("dialog");
    await d
      .getByLabel("Observação", { exact: true })
      .fill("Chegada registrada no navegador");
    pending = response("workshop-agenda/");
    await d
      .getByRole("button", { name: "Confirmar agendamento", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    await d.waitFor({ state: "hidden" });
    await card.getByText("Cliente chegou", { exact: true }).first().waitFor();
    checks += 2;
    await p.goto(rootUrl + "/workshop-warranty");
    await p
      .getByRole("heading", {
        name: "Garantias e retornos",
        exact: true,
        level: 1,
      })
      .waitFor();
    const existing = (await api("/workshop-warranty")).warranties,
      orders = await api("/workshop/orders"),
      order = orders.find(
        (o) =>
          o.status === "delivered" &&
          o.sale?.status === "completed" &&
          !existing.some((w) => w.orderId === o.id),
      );
    assert.ok(order, "OS entregue sintética para a prévia");
    await p
      .getByRole("button", { name: "Registrar garantia", exact: true })
      .click();
    d = p.getByRole("dialog");
    await d.getByLabel("OS entregue", { exact: true }).selectOption(order.id);
    await d
      .getByLabel("Prazo final informado", { exact: true })
      .fill(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
    const terms = "Condições de demonstração " + Date.now();
    await d
      .getByLabel("Condições, itens e serviços cobertos", { exact: true })
      .fill(terms);
    pending = response("workshop-warranty");
    await d
      .getByRole("button", { name: "Salvar garantia", exact: true })
      .click();
    assert.equal((await pending).status(), 201);
    await d.waitFor({ state: "hidden" });
    card = p.getByRole("article").filter({ hasText: terms });
    await card
      .getByRole("button", { name: "Registrar retorno", exact: true })
      .click();
    d = p.getByRole("dialog");
    await d
      .getByLabel("Relato do retorno", { exact: true })
      .fill("Avaliar serviço de demonstração");
    await d
      .getByLabel("Quilometragem no retorno", { exact: true })
      .fill(String(order.mileage + 1));
    pending = response("workshop-warranty/");
    await d
      .getByRole("button", { name: "Confirmar registro", exact: true })
      .click();
    assert.equal((await pending).status(), 201);
    await d.waitFor({ state: "hidden" });
    await card.getByRole("button", { name: "Aceito", exact: true }).click();
    d = p.getByRole("dialog");
    await d
      .getByLabel("Parecer ou motivo", { exact: true })
      .fill("Análise confirmada no navegador");
    pending = response("workshop-warranty/returns/");
    await d
      .getByRole("button", { name: "Confirmar registro", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    await d.waitFor({ state: "hidden" });
    let download = p.waitForEvent("download");
    await card
      .getByRole("button", {
        name: "Imprimir garantia e retornos",
        exact: true,
      })
      .click();
    await (await download).saveAs("work/marks/garantia-browser.pdf");
    checks += 4;
    await p.goto(rootUrl + "/part-imports");
    await p
      .getByRole("heading", {
        name: "Importar catálogo de autopeças",
        level: 1,
        exact: true,
      })
      .waitFor();
    const suffix = Date.now();
    await p.getByLabel("Arquivo CSV", { exact: true }).setInputFiles({
      name: "browser.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Nome;Fabricante;Referência\nPeça navegador " +
          suffix +
          ";Fornecedor;REF-" +
          suffix +
          "\nOutra peça navegador " +
          suffix +
          ";Fornecedor;OUT-" +
          suffix +
          "\n",
      ),
    });
    await p.getByRole("button", { name: "Ler arquivo", exact: true }).click();
    await p
      .getByLabel("Fonte do catálogo / fornecedor", { exact: true })
      .fill("Arquivo sintético do navegador");
    pending = response("part-imports/preview");
    await p
      .getByRole("button", { name: "Preparar prévia", exact: true })
      .click();
    assert.equal((await pending).status(), 201);
    await p.getByRole("checkbox").check();
    pending = response("part-imports/");
    await p
      .getByRole("button", { name: "Confirmar importação", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    await p
      .getByRole("status")
      .filter({ hasText: "2 produtos importados" })
      .waitFor();
    checks += 2;
    const customer = await api(
      "/customers",
      "POST",
      { name: "Cliente navegador " + suffix },
      201,
    );
    let product = await api(
      "/products",
      "POST",
      {
        name: "Serviço navegador " + suffix,
        itemType: "service",
        category: "servicos",
        unitOfMeasure: "servico",
        costPrice: 0,
        salePrice: 80,
        currentStock: 0,
        minStockAlert: 0,
        active: true,
      },
      201,
    );
    product = product.product || product;
    await p.goto(rootUrl + "/loyalty");
    await p.getByLabel("Cliente", { exact: true }).selectOption(customer.id);
    await p
      .getByLabel("Nome do benefício", { exact: true })
      .fill("Programa navegador");
    await p
      .getByLabel("Desconto percentual (0 a 50%)", { exact: true })
      .fill("12.5");
    await p
      .getByLabel("Motivo da concessão ou alteração", { exact: true })
      .fill("Condição aprovada no navegador");
    pending = response("loyalty/profiles/", "PUT");
    await p
      .getByRole("button", { name: "Salvar benefício", exact: true })
      .click();
    assert.equal((await pending).status(), 200);
    checks++;
    await p.goto(rootUrl + "/sales");
    const productCard = p
      .locator('[data-slot="card"]')
      .filter({
        has: p.getByRole("heading", { name: product.name, exact: true }),
      })
      .last();
    await productCard.getByRole("button").click();
    await p.getByRole("button", { name: "Carrinho (1)", exact: true }).click();
    d = p.getByRole("dialog");
    await d
      .getByLabel("Cliente cadastrado", { exact: true })
      .selectOption(customer.id);
    await d
      .getByRole("button", {
        name: "Aplicar desconto de fidelidade",
        exact: true,
      })
      .click();
    await d
      .getByText("Fidelidade: Programa navegador · 12,5% aplicado.", {
        exact: true,
      })
      .waitFor();
    pending = response("sales");
    await d
      .getByRole("button", { name: "Finalizar Venda", exact: true })
      .click();
    const saleResponse = await pending;
    assert.equal(saleResponse.status(), 201);
    const sale = await saleResponse.json();
    assert.equal(Number(sale.total_amount), 70);
    assert.ok(sale.notes.includes("Programa navegador"));
    checks++;
    await p.goto(rootUrl + "/loyalty");
    await p.getByLabel("Cliente", { exact: true }).selectOption(customer.id);
    await p
      .getByRole("cell", { name: "Programa navegador · 12.5%", exact: true })
      .waitFor();
    download = p.waitForEvent("download");
    await p
      .getByRole("button", {
        name: "Imprimir histórico de fidelidade",
        exact: true,
      })
      .click();
    await (await download).saveAs("work/marks/fidelidade-browser.pdf");
    checks++;
    for (const path of [
      "/workshop-agenda",
      "/workshop-warranty",
      "/part-imports",
      "/loyalty",
    ]) {
      await p.setViewportSize({ width: 390, height: 844 });
      await p.goto(rootUrl + path);
      await p.getByRole("heading", { level: 1 }).waitFor();
      await p.evaluate(() => document.documentElement.classList.add("dark"));
      await p.waitForTimeout(100);
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Largura no celular: " + path,
      );
      await p.screenshot({
        path: "work/marks/mobile-" + path.slice(1) + ".png",
        fullPage: true,
      });
      checks++;
    }
    const supportFixture = JSON.parse(
      fs.readFileSync("work/marks/support.json"),
    );
    const mc = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    await mc.addInitScript(
      (t) => sessionStorage.setItem("supportToken", t),
      supportFixture.masterToken,
    );
    const mp = await mc.newPage();
    mp.on("pageerror", (e) => errors.push(e.message));
    await mp.goto(rootUrl + "/support");
    await mp
      .getByRole("button", { name: "Carregar empresas", exact: true })
      .click();
    await mp
      .getByLabel("Empresa autorizada", { exact: true })
      .selectOption(s.slug);
    await mp
      .getByLabel("Operador de suporte", { exact: true })
      .selectOption(supportFixture.operatorId);
    const accessReason = "Suporte navegador " + suffix;
    await mp.getByLabel("Motivo do acesso", { exact: true }).fill(accessReason);
    pending = mp.waitForResponse(
      (r) =>
        r.url().endsWith("/support/access-codes") &&
        r.request().method() === "POST",
    );
    await mp
      .getByRole("button", { name: "Gerar código temporário", exact: true })
      .click();
    const emitted = await pending;
    assert.equal(emitted.status(), 201);
    const grant = await emitted.json();
    await mp
      .getByRole("button", { name: "Ocultar código", exact: true })
      .click();
    const sc = await browser.newContext(),
      sp = await sc.newPage();
    sp.on("pageerror", (e) => errors.push(e.message));
    await sp.goto(rootUrl + "/support");
    await sp
      .getByRole("button", {
        name: "Entrar com código temporário",
        exact: true,
      })
      .click();
    await sp
      .getByLabel("Usuário do fornecedor", { exact: true })
      .fill("support.local");
    await sp
      .getByLabel("Código temporário de uso único", { exact: true })
      .fill(grant.code);
    await sp
      .getByRole("button", {
        name: "Acessar com código temporário",
        exact: true,
      })
      .click();
    await sp.getByText(/Modo de suporte — somente consulta/).waitFor();
    checks++;
    const grantCard = mp.getByRole("article").filter({ hasText: accessReason });
    await grantCard
      .getByRole("button", { name: "Revogar acesso temporário", exact: true })
      .click();
    await mp
      .getByLabel("Motivo da revogação", { exact: true })
      .fill("Validação do navegador concluída");
    await mp
      .getByRole("button", { name: "Confirmar revogação", exact: true })
      .click();
    await grantCard.getByText(/Revogado/).waitFor();
    await sp.reload();
    await sp.waitForURL("**/login");
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: agenda, garantia/retorno, CSV, fidelidade na venda, PDF, celular/escuro e código temporário/revogação; sem erros JavaScript.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
