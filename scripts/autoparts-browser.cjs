const { chromium } = require("../work/browser/node_modules/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const {
  client,
  rootUrl,
  credentials,
} = require("./testing/commercial-context.cjs");
const s = JSON.parse(fs.readFileSync("work/autoparts/session.json"));
(async () => {
  const { request } = client();
  const secret = credentials();
  for (const [key, password] of [
    ["master", secret.master],
    ["support", secret.support],
  ]) {
    const auth = await request("/support/login", {
      method: "POST",
      body: { username: key + ".local", password },
    });
    s[key] = await request("/support/sessions", {
      method: "POST",
      token: auth.token,
      body: { company: s.slug },
    });
  }
  const old = await request("/autoparts/parts/" + s.c.id, {
    token: s.login.token,
  });
  await request("/autoparts/parts/" + s.c.id, {
    method: "PUT",
    token: s.login.token,
    body: {
      manufacturer: "",
      partNumber: "",
      originalCodes: [],
      applications: [],
      notes: "",
      revision: old.partDetails?.revision || 0,
    },
  });
  if (old.equivalents.some((eq) => eq.productId === s.a.id))
    await request(`/autoparts/equivalences/${s.c.id}/${s.a.id}`, {
      method: "DELETE",
      status: 204,
      token: s.login.token,
    });
  let checks = 0;
  const errors = [];
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const init = (session) => {
    localStorage.setItem("token", session.token);
    localStorage.setItem("user", JSON.stringify(session.user));
    localStorage.setItem("company", session.user.company);
  };
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
  });
  await ctx.addInitScript(init, s.login);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.goto(rootUrl + "/autoparts");
    await p.getByRole("heading", { name: "Autopeças", level: 1 }).waitFor();
    await p.getByLabel("Buscar referência").fill("ALF-100");
    await p.getByRole("button", { name: "Buscar peças", exact: true }).click();
    await p
      .getByRole("status")
      .filter({ hasText: "1 produtos encontrados" })
      .waitFor();
    checks++;
    await p
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await p.getByLabel("Marca do veículo", { exact: true }).fill("Fiat");
    await p.getByLabel("Modelo", { exact: true }).fill("Gol");
    await p.getByRole("button", { name: "Buscar peças", exact: true }).click();
    await p
      .getByText("Nenhum produto encontrado com os filtros informados.", {
        exact: false,
      })
      .waitFor();
    checks++;
    await p
      .getByRole("button", { name: "Limpar filtros", exact: true })
      .click();
    await p.getByLabel("Produto para cadastro técnico").selectOption(s.c.id);
    await p
      .getByRole("button", { name: "Editar cadastro técnico", exact: true })
      .click();
    let d = p.getByRole("dialog");
    await d
      .getByLabel("Fabricante da peça", { exact: true })
      .fill("Fabricante Gama");
    await d
      .getByLabel("Referência do fabricante", { exact: true })
      .fill("GAM-303");
    await d
      .getByLabel("Códigos originais (um por linha)", { exact: true })
      .fill("ORIGINAL-303\nORIGINAL-304");
    await d
      .getByRole("button", { name: "Adicionar aplicação", exact: true })
      .click();
    for (const [name, value] of [
      ["Marca do veículo", "Chevrolet"],
      ["Modelo", "Onix"],
      ["Ano inicial", "2016"],
      ["Ano final", "2019"],
      ["Motorização", "1.4"],
      ["Versão", "LT"],
    ])
      await d.getByLabel(name + " da aplicação 1", { exact: true }).fill(value);
    await d
      .getByLabel("Observações da aplicação 1", { exact: true })
      .fill("Conferir medidas e conector");
    await d
      .getByRole("button", { name: "Salvar cadastro técnico", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Aplicações e equivalências", exact: true })
      .waitFor();
    checks++;
    d = p.getByRole("dialog");
    await d
      .getByText("Chevrolet Onix · 2016 a 2019", { exact: true })
      .waitFor();
    await d
      .getByLabel("Produto equivalente", { exact: true })
      .selectOption(s.a.id);
    await d
      .getByLabel("Justificativa da equivalência", { exact: true })
      .fill("Referências cruzadas conferidas no teste de navegador");
    await d
      .getByRole("button", { name: "Relacionar equivalente", exact: true })
      .click();
    await d
      .getByText("Referências cruzadas conferidas no teste de navegador", {
        exact: true,
      })
      .waitFor();
    checks++;
    // A <-> C is direct and does not alter either application list.
    const alfa = await request("/autoparts/parts/" + s.a.id, {
      token: s.login.token,
    });
    assert.ok(alfa.equivalents.some((eq) => eq.productId === s.c.id));
    await p.screenshot({
      path: "work/autoparts/aplicacoes.png",
      fullPage: true,
    });
    await d
      .getByRole("button", { name: "Editar cadastro técnico", exact: true })
      .click();
    d = p.getByRole("dialog");
    const current = await request("/autoparts/parts/" + s.c.id, {
      token: s.login.token,
    });
    await request("/autoparts/parts/" + s.c.id, {
      method: "PUT",
      token: s.login.token,
      body: { ...current.partDetails, notes: "Salvo em outro terminal" },
    });
    await d
      .getByLabel("Observações técnicas", { exact: true })
      .fill("Tentativa com revisão anterior");
    await d
      .getByRole("button", { name: "Salvar cadastro técnico", exact: true })
      .click();
    await d
      .getByRole("alert")
      .filter({ hasText: "alterado em outro terminal" })
      .waitFor();
    checks++;
    await d.getByRole("button", { name: "Close", exact: true }).click();
    await p
      .locator('[data-slot="dialog-overlay"]')
      .waitFor({ state: "detached" });
    await p.getByLabel("Produto para cadastro técnico").selectOption(s.c.id);
    await p
      .getByRole("button", { name: "Editar cadastro técnico", exact: true })
      .click();
    d = p.getByRole("dialog");
    assert.equal(
      await d.getByLabel("Observações técnicas", { exact: true }).inputValue(),
      "Salvo em outro terminal",
    );
    await d
      .getByRole("button", { name: "Salvar cadastro técnico", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Aplicações e equivalências", exact: true })
      .waitFor();
    checks++;
    await p.setViewportSize({ width: 390, height: 844 });
    d = p.getByRole("dialog");
    await d
      .getByText("Aplicações cadastradas", { exact: true })
      .scrollIntoViewIfNeeded();
    assert.ok(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await p.screenshot({ path: "work/autoparts/celular.png" });
    checks++;
    await p.setViewportSize({ width: 1440, height: 1080 });
    await d
      .getByText("Filtro Alfa sintético", { exact: true })
      .locator("..")
      .getByRole("button", { name: "Remover equivalência", exact: true })
      .click();
    d = p.getByRole("dialog");
    await d
      .getByRole("button", { name: "Confirmar remoção", exact: true })
      .click();
    await p
      .getByRole("heading", { name: "Aplicações e equivalências", exact: true })
      .waitFor();
    checks++;
    const restored = await request("/autoparts/parts/" + s.c.id, {
      token: s.login.token,
    });
    assert.ok(!restored.equivalents.some((eq) => eq.productId === s.a.id));
    await p
      .getByRole("dialog")
      .getByRole("link", { name: "Localizar em Vendas", exact: true })
      .click();
    await p.waitForURL(/\/sales\?search=/);
    await p
      .getByRole("heading", { name: "Filtro Gama sintético", exact: true })
      .waitFor();
    checks++;
    // Search references from the normal POS, with no automatic cart insertion.
    await p.goto(rootUrl + "/sales?search=ALF-100");
    await p
      .getByRole("heading", { name: "Filtro Alfa sintético", exact: true })
      .waitFor();
    assert.equal(
      await p
        .getByRole("heading", { name: "Filtro Beta sintético", exact: true })
        .count(),
      0,
    );
    checks++;
    await ctx.close();
    for (const [session, canWrite] of [
      [s.employee, false],
      [s.manager, true],
      [s.master, true],
      [s.support, false],
    ]) {
      const c = await browser.newContext();
      await c.addInitScript(init, session);
      const page = await c.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(rootUrl + "/autoparts");
      await page
        .getByRole("heading", { name: "Autopeças", level: 1 })
        .waitFor();
      const edit = page.getByRole("button", {
        name: "Editar cadastro técnico",
        exact: true,
      });
      if (canWrite) await edit.waitFor();
      else assert.equal(await edit.count(), 0);
      checks++;
      await c.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      `${checks} verificações de navegador de autopeças aprovadas: referências, aplicação, equivalência, conflito entre terminais, celular, busca em Vendas e permissões; sem erros JavaScript.`,
    );
  } catch (e) {
    if (!p.isClosed()) {
      await p.screenshot({
        path: "work/autoparts/browser-error.png",
        fullPage: true,
      });
      console.error((await p.locator("body").innerText()).slice(-2200));
    }
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
