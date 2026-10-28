const { chromium } = require("../work/browser/node_modules/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
const ean = require("../bar-management-system/src/services/ean13");
const s = JSON.parse(fs.readFileSync("work/scale/session.json"));
const label = (payload) => {
  const text = "20" + "00321" + String(payload).padStart(5, "0");
  return text + ean.checkDigit(text);
};
(async () => {
  const { request } = client();
  let checks = 0;
  const errors = [];
  const b = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const c = await b.newContext({ viewport: { width: 1440, height: 1080 } });
  const init = (session) => {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("company", session.user.company);
  };
  await c.addInitScript(init, s.login);
  await c.addInitScript(() => {
    window.print = () => {};
  });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  async function waitSettings() {
    await p
      .getByRole("button", { name: "Salvar formato", exact: true })
      .waitFor();
  }
  async function scan(code) {
    await p.getByPlaceholder("Código de barras...", { exact: true }).fill(code);
    await p
      .getByPlaceholder("Código de barras...", { exact: true })
      .press("Enter");
    await p
      .getByRole("heading", {
        name: "Conferir etiqueta da balança",
        exact: true,
      })
      .waitFor();
  }
  async function pay() {
    await p.getByRole("button", { name: /^Carrinho \(/ }).click();
    const d = p
      .getByRole("dialog")
      .filter({
        has: p.getByRole("heading", { name: "Finalizar Venda", exact: true }),
      });
    await d.getByLabel("Forma de Pagamento", { exact: true }).click();
    await p.getByRole("option", { name: "PIX", exact: true }).click();
    await d
      .getByRole("button", { name: "Finalizar Venda", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
  }
  try {
    await p.goto(rootUrl + "/scale-labels");
    await waitSettings();
    await p
      .getByLabel("Pré-configuração", { exact: true })
      .selectOption("weight_5");
    await p
      .getByRole("button", { name: "Salvar formato", exact: true })
      .click();
    await p.getByLabel("Produto por kg", { exact: true }).selectOption(s.kg.id);
    await p.getByLabel("PLU", { exact: true }).fill("321");
    await p
      .getByRole("button", {
        name: "Salvar vínculo / preço conferido",
        exact: true,
      })
      .click();
    await p.getByRole("cell", { name: "00321", exact: true }).waitFor();
    checks++;
    await p.getByLabel("Código da etiqueta", { exact: true }).fill(label(145));
    await p
      .getByRole("button", { name: "Conferir leitura", exact: true })
      .click();
    await p.getByRole("status").filter({ hasText: "0,145 kg" }).waitFor();
    checks++;
    await p.getByLabel("Buscar produtos para etiquetas").fill(s.normal.name);
    await p
      .getByLabel("Etiquetas de " + s.normal.name, { exact: true })
      .fill("2");
    const download = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Gerar PDF de etiquetas", exact: true })
      .click();
    await (await download).saveAs("work/scale/labels-browser.pdf");
    checks++;
    await p.screenshot({ path: "work/scale/configuracao.png", fullPage: true });
    await p.goto(rootUrl + "/sales");
    await scan(label(145));
    let d = p.getByRole("dialog");
    await d.getByText("Total: R$ 0,44", { exact: true }).waitFor();
    await d
      .getByRole("button", { name: "Adicionar peso ao carrinho", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
    await scan(label(145));
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Adicionar peso ao carrinho", exact: true })
      .click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    await p.getByText("R$ 0,88", { exact: true }).waitFor();
    checks++;
    await pay();
    const sales = await request("/sales", { token: s.login.token });
    assert.equal(Number(sales[0].total_amount), 0.88);
    assert.equal(sales[0].items.filter((i) => i.scale).length, 2);
    await p.goto(rootUrl + "/scale-labels");
    await waitSettings();
    await p
      .getByLabel("Pré-configuração", { exact: true })
      .selectOption("price_5");
    await p.getByLabel(/Confirmo que o preço\/kg dos produtos/).check();
    await p
      .getByRole("button", { name: "Salvar formato", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Salvar formato", exact: true })
      .waitFor();
    checks++;
    // Let the saved setting finish before navigating away.
    await p.waitForFunction(
      () => !document.querySelector("fieldset[disabled]"),
    );
    await p.goto(rootUrl + "/sales");
    await scan(label(100));
    d = p.getByRole("dialog");
    assert.ok(
      await d
        .getByRole("button", {
          name: "Adicionar peso ao carrinho",
          exact: true,
        })
        .isDisabled(),
    );
    await d.getByLabel("Peso da embalagem (kg)", { exact: true }).fill(".334");
    await d
      .getByLabel("Conferi o peso e o preço/kg na embalagem e na balança.", {
        exact: true,
      })
      .check();
    await p.setViewportSize({ width: 390, height: 844 });
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await p.screenshot({ path: "work/scale/leitura-celular.png" });
    await d
      .getByRole("button", { name: "Adicionar peso ao carrinho", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    checks++;
    await p.setViewportSize({ width: 1440, height: 1080 });
    await pay();
    const last = (await request("/sales", { token: s.login.token }))[0];
    assert.equal(Number(last.total_amount), 1);
    assert.equal(Number(last.items[0].quantity), 0.334);
    assert.equal(last.items[0].scale.quantityConfirmed, true);
    checks++;
    const readonly = await b.newContext();
    await readonly.addInitScript(init, s.employee);
    const rp = await readonly.newPage();
    rp.on("pageerror", (e) => errors.push(e.message));
    await rp.goto(rootUrl + "/scale-labels");
    await rp
      .getByRole("heading", { name: "Balanças e etiquetas", level: 1 })
      .waitFor();
    assert.equal(
      await rp
        .getByRole("button", { name: "Salvar formato", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await rp
        .getByRole("button", { name: "Gerar PDF de etiquetas", exact: true })
        .count(),
      0,
    );
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador aprovadas: formatos, vínculo PLU, conferência, etiquetas PDF, arredondamento por linha, peso real, venda, celular e acesso de atendente; sem erros JavaScript.`,
    );
  } catch (e) {
    if (!p.isClosed())
      await p.screenshot({
        path: "work/scale/browser-error.png",
        fullPage: true,
      });
    throw e;
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
