const { chromium } = require("../work/browser/node_modules/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/workshop/session.json"));
(async () => {
  const { request } = client(),
    token = s.login.token;
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    timezoneId: "America/Sao_Paulo",
  });
  const init = (session) => {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("company", session.user.company);
  };
  await context.addInitScript(init, s.login);
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  const confirm = async (note) => {
    const d = p.getByRole("dialog");
    if (note) await d.getByRole("textbox").fill(note);
    await d
      .getByRole("button", { name: "Confirmar ação", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Recarregar OS", exact: true })
      .waitFor();
    checks++;
  };
  try {
    await p.goto(rootUrl + "/workshop");
    await p
      .getByRole("heading", { name: "Oficina mecânica", level: 1 })
      .waitFor();
    checks++;
    await p.getByRole("button", { name: "Novo veículo", exact: true }).click();
    let d = p.getByRole("dialog");
    await d.getByLabel("Cliente cadastrado").selectOption(s.customerId);
    const plate = "XYZ" + String(Date.now()).slice(-4);
    await d.getByLabel("Placa", { exact: true }).fill(plate);
    await d.getByLabel("Marca", { exact: true }).fill("Volkswagen");
    await d.getByLabel("Modelo", { exact: true }).fill("Gol");
    await d.getByLabel("Ano", { exact: true }).fill("2015");
    await d.getByLabel("Quilometragem", { exact: true }).fill("1000");
    await d
      .getByRole("button", { name: "Salvar veículo", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
    await p
      .getByRole("button", { name: "Nova ordem de serviço", exact: true })
      .click();
    d = p.getByRole("dialog");
    const vehicles = await request("/workshop/vehicles", { token });
    const vehicle = vehicles.find((v) => v.plate === plate);
    await d.getByLabel("Veículo do cliente").selectOption(vehicle.id);
    await d.getByLabel("Quilometragem na entrada").fill("1100");
    await d
      .getByLabel("Responsável", { exact: true })
      .selectOption(s.employee.user.id);
    await d
      .getByLabel("Problema relatado", { exact: true })
      .fill("Ruído informado pelo cliente no navegador");
    await d
      .getByLabel("Diagnóstico", { exact: true })
      .fill("Revisão e troca do filtro");
    await d.getByLabel("Carroceria", { exact: true }).selectOption("attention");
    await d.getByLabel("Combustível", { exact: true }).selectOption("half");
    await d.getByLabel("Observações de entrada").fill("Risco na porta direita");
    for (const id of [s.part.id, s.service.id]) {
      await d
        .getByLabel("Produto ou serviço", { exact: true })
        .selectOption(id);
      await d
        .getByRole("button", { name: "Adicionar item", exact: true })
        .click();
    }
    await d
      .getByLabel("Valor unitário de Filtro renomeado após aprovação", {
        exact: true,
      })
      .fill("2000");
    await d.getByLabel("Desconto (R$)", { exact: true }).fill("500");
    await p.screenshot({ path: "work/workshop/checklist.png", fullPage: true });
    await d
      .getByRole("button", { name: "Salvar rascunho", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Enviar para aprovação", exact: true })
      .waitFor();
    checks++;
    const heading = await p
      .getByRole("dialog")
      .getByRole("heading", { name: /Ordem de serviço #/ })
      .innerText();
    const num = Number(heading.split("#")[1]);
    await p
      .getByRole("button", { name: "Enviar para aprovação", exact: true })
      .click();
    await confirm();
    await p
      .getByRole("button", { name: "Registrar aprovação", exact: true })
      .click();
    await confirm("Cliente autorizou presencialmente — teste navegador");
    await p
      .getByRole("button", { name: "Iniciar execução", exact: true })
      .click();
    await confirm("Iniciado");
    await p
      .getByRole("button", { name: "Marcar como pronta", exact: true })
      .click();
    await confirm("Pronto");
    await p.getByRole("button", { name: "Receber OS", exact: true }).click();
    d = p.getByRole("dialog");
    await d.getByLabel("Valor 1", { exact: true }).fill("2000");
    await d
      .getByRole("button", { name: "Adicionar pagamento", exact: true })
      .click();
    await d.getByLabel("Valor 2", { exact: true }).fill("2500");
    await p.screenshot({ path: "work/workshop/pagamento.png", fullPage: true });
    await d.getByLabel("Valor 2", { exact: true }).fill("2400");
    await d
      .getByRole("button", { name: "Confirmar recebimento", exact: true })
      .click();
    await d
      .getByRole("alert")
      .filter({
        hasText: "A soma dos pagamentos deve ser igual ao total da OS.",
      })
      .waitFor();
    await d.getByLabel("Valor 2", { exact: true }).fill("2500");
    checks++;
    await d
      .getByRole("button", { name: "Confirmar recebimento", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Registrar entrega", exact: true })
      .waitFor();
    checks++;
    d = p.getByRole("dialog");
    const download = p.waitForEvent("download");
    await d
      .getByRole("button", { name: "Imprimir / PDF", exact: true })
      .click();
    const file = await download;
    await file.saveAs("work/workshop/ordem-navegador.pdf");
    checks++;
    await p
      .getByRole("button", { name: "Registrar entrega", exact: true })
      .click();
    await confirm("Retirado pelo cliente");
    await p.getByText("Histórico da OS", { exact: true }).click();
    await p
      .getByRole("dialog")
      .getByText("Escopo aprovado · R$ 45,00", { exact: true })
      .waitFor();
    checks++;
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await p
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached" });
    await p.getByLabel("Buscar ordens").fill(plate);
    await p.screenshot({ path: "work/workshop/painel.png", fullPage: true });
    checks++;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole("button", { name: "Ver OS", exact: true }).click();
    d = p.getByRole("dialog");
    await d
      .getByRole("button", { name: "Imprimir / PDF", exact: true })
      .scrollIntoViewIfNeeded();
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await p.screenshot({ path: "work/workshop/celular.png" });
    checks++;
    const orders = await request("/workshop/orders", { token });
    assert.equal(orders.find((o) => o.number === num).status, "delivered");
    await context.close();
    for (const [session, canCreate] of [
      [s.employee, false],
      [s.master, true],
      [s.support, false],
    ]) {
      const ctx = await browser.newContext();
      await ctx.addInitScript(init, session);
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(rootUrl + "/workshop");
      await page
        .getByRole("heading", { name: "Oficina mecânica", level: 1 })
        .waitFor();
      const button = page.getByRole("button", {
        name: "Nova ordem de serviço",
        exact: true,
      });
      if (canCreate) await button.waitFor();
      else assert.equal(await button.count(), 0);
      checks++;
      await ctx.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador da oficina aprovadas: veículo, checklist, peças, aprovação, execução, pagamentos divididos, entrega, PDF, celular e permissões; sem erros JavaScript.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
