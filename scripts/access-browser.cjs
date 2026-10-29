const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/access/session.json")),
    { request } = client(),
    api = (p, method = "GET", body, status = 200) =>
      request(p, { method, body, status, token: s.login.token });
  const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    }),
    errors = [];
  let checks = 0;
  try {
    const make = async (user) => {
      const c = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        timezoneId: "America/Sao_Paulo",
      });
      await c.addInitScript((u) => {
        localStorage.setItem("token", u.token);
        localStorage.setItem("user", JSON.stringify(u.user));
        localStorage.setItem("company", u.user.company);
      }, user);
      const p = await c.newPage();
      p.on("pageerror", (e) => {
        errors.push(e.message);
        console.error(e.message);
      });
      p.on("response", (r) => {
        if (r.status() >= 400)
          console.error("HTTP", r.status(), new URL(r.url()).pathname);
      });
      p.on("dialog", (d) => d.accept());
      return p;
    };
    const admin = await make(s.login);
    await admin.goto(rootUrl + "/user-access?user=" + s.kitchen.user.id);
    await admin
      .getByLabel("Perfil operacional sugerido", { exact: true })
      .waitFor();
    async function save(reason) {
      await admin
        .getByLabel("Motivo da alteração de acessos", { exact: true })
        .fill(reason);
      assert.ok(
        await admin
          .getByRole("button", { name: "Salvar acessos", exact: true })
          .isDisabled(),
      );
      await admin
        .getByRole("checkbox", {
          name: "Conferi o usuário, o perfil e as liberações/retiradas antes de salvar.",
          exact: true,
        })
        .check();
      const pending = admin.waitForResponse(
        (r) =>
          r.url().endsWith("/access/users/" + s.kitchen.user.id) &&
          r.request().method() === "PUT",
      );
      await admin
        .getByRole("button", { name: "Salvar acessos", exact: true })
        .click();
      assert.equal((await pending).status(), 200);
      await admin
        .getByRole("heading", {
          name: "Configurar acessos de " + s.kitchen.user.username,
          exact: true,
        })
        .waitFor();
    }
    await admin
      .getByLabel("Perfil operacional sugerido", { exact: true })
      .selectOption("cashier");
    await admin.getByLabel("Fechar caixa", { exact: true }).uncheck();
    await save("Caixa sem fechamento — teste navegador");
    checks++;
    const employee = await make(s.kitchen);
    await employee.goto(rootUrl + "/");
    await employee.waitForURL("**/sales");
    await employee
      .getByRole("heading", { name: "Painel de Vendas", exact: true })
      .waitFor();
    assert.equal(
      await employee
        .getByRole("link", { name: "Cozinha", exact: true })
        .count(),
      0,
    );
    assert.equal(
      await employee
        .getByRole("button", { name: "Fechar Caixa", exact: true })
        .count(),
      0,
    );
    checks++;
    await employee.goto(rootUrl + "/kitchen");
    await employee
      .getByRole("heading", { name: "Acesso não permitido", exact: true })
      .waitFor();
    checks++;
    await admin
      .getByLabel("Perfil operacional sugerido", { exact: true })
      .selectOption("none");
    await save("Sem operação — teste navegador");
    await employee.goto(rootUrl + "/");
    await employee.waitForURL("**/my-access");
    await employee
      .getByText("Nenhum acesso operacional foi liberado.", { exact: false })
      .waitFor();
    checks++;
    await admin
      .getByLabel("Modelo de acesso", { exact: true })
      .selectOption("legacy");
    await save("Restauração do acesso anterior — teste navegador");
    await employee.goto(rootUrl + "/");
    await employee.waitForURL("**/sales");
    checks++;
    const name = "consulta." + Date.now();
    await api(
      "/users",
      "POST",
      { username: name, password: s.password, role: "gerente" },
      201,
    );
    const viewer = await api("/auth/login", "POST", {
      company: s.slug,
      username: name,
      password: s.password,
    });
    await api("/access/users/" + viewer.user.id, "PUT", {
      mode: "restricted",
      permissions: ["products.menu", "products.read"],
      revision: 0,
      reason: "Consulta de produtos sem custos",
    });
    const vp = await make(viewer);
    await vp.goto(rootUrl + "/products");
    await vp
      .getByRole("heading", {
        name: "Produtos e serviços",
        exact: true,
        level: 1,
      })
      .waitFor();
    assert.equal(
      await vp
        .getByRole("button", { name: "Novo Produto", exact: true })
        .count(),
      0,
    );
    await vp
      .locator("tr")
      .filter({ has: vp.getByText(s.product.name, { exact: true }) })
      .getByRole("button")
      .first()
      .click();
    await vp.getByText("R$ Sem acesso", { exact: true }).waitFor();
    checks++;
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.evaluate(() => document.documentElement.classList.add("dark"));
    await admin.screenshot({
      path: "work/access/editor-mobile.png",
      fullPage: true,
    });
    assert.ok(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    checks++;
    const cp = await make(s.cashier);
    await cp.goto(rootUrl + "/my-access");
    await cp
      .getByRole("heading", { name: "Meus acessos", level: 1, exact: true })
      .waitFor();
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: editor, confirmação, exceção, menus, URL direta, sem operação, restauração, custos ocultos e celular/escuro, sem erros JavaScript.",
    );
  } catch (e) {
    for (const page of browser.contexts().flatMap((c) => c.pages())) {
      await page.screenshot({
        path: "work/access/failure.png",
        fullPage: true,
      });
      console.error((await page.locator("body").innerText()).slice(0, 1400));
    }
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
