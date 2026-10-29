const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const s = JSON.parse(fs.readFileSync("work/mark22/session.json"));
  assert.match(s.slug, /^pizza-combo-/);
  const { request } = client(),
    read = (p) => request(p, { token: s.second.token });
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  try {
    const c = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
    });
    await c.addInitScript((u) => {
      localStorage.setItem("token", u.token);
      localStorage.setItem("user", JSON.stringify(u.user));
      localStorage.setItem("company", u.user.company);
    }, s.second);
    const page = await c.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(rootUrl + "/products");
    for (const [quantity, fail] of [
      [0, false],
      [2, false],
      [3, true],
    ]) {
      const name = "Produto banner " + Date.now();
      await page
        .getByRole("button", { name: "Novo Produto", exact: true })
        .click();
      const d = page.getByRole("dialog");
      await d.locator("#name").fill(name);
      await d.locator("#category").selectOption("outros");
      await d
        .getByRole("tab", { name: "Preços e estoque", exact: true })
        .click();
      await d.locator("#salePrice").fill("900");
      if (quantity) await d.locator("#initialStock").fill(String(quantity));
      if (fail)
        await page.route("**/api/stock/add", (route) =>
          route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ error: "Falha controlada no estoque" }),
          }),
        );
      await d
        .getByRole("button", { name: "Criar Produto", exact: true })
        .click();
      await d.waitFor({ state: "hidden" });
      const message = fail
        ? "Produto criado, mas o estoque inicial não foi adicionado. Confira o estoque."
        : quantity
          ? "Produto e estoque inicial salvos com sucesso."
          : "Produto salvo com sucesso.";
      const t = page.getByText(message, { exact: true });
      await t.waitFor();
      if (fail) {
        assert.equal(
          await page
            .locator('[data-sonner-toast][data-type="success"]')
            .count(),
          0,
        );
        await page.unroute("**/api/stock/add");
      } else {
        assert.equal(
          await page.locator("[data-sonner-toast].save-success-toast").count(),
          1,
        );
        await page.mouse.move(0, 0);
        await t.waitFor({ state: "hidden", timeout: 5000 });
      }
      const p = (await read("/products")).find((p) => p.name === name);
      assert.ok(p);
      assert.equal(Number(p.currentStock), fail ? 0 : quantity);
      checks++;
    }
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      checks +
        " verificações de produto aprovadas: salvamento simples, estoque inicial, confirmação única e falha parcial informada corretamente.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
