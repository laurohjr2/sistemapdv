const { chromium } = require("../work/browser/node_modules/playwright"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, rootUrl } = require("./testing/commercial-context.cjs");
(async () => {
  const f = JSON.parse(fs.readFileSync("work/workshop-evidence/fixture.json")),
    { request } = client(),
    api = (p, method = "GET", body, status = 200) =>
      request(p, { method, body, status, token: f.login.token });
  let order = await api("/workshop/orders", "POST", f.body, 201),
    checks = 0;
  const errors = [],
    browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      timezoneId: "America/Sao_Paulo",
    });
    await context.addInitScript((s) => {
      localStorage.setItem("token", s.token);
      localStorage.setItem("user", JSON.stringify(s.user));
      localStorage.setItem("company", s.user.company);
    }, f.login);
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(rootUrl + "/workshop");
    await p
      .getByRole("row")
      .filter({ has: p.getByText("#" + order.number, { exact: true }) })
      .getByRole("button", { name: "Ver OS", exact: true })
      .click();
    let d = p.getByRole("dialog");
    const caption = "Carroceria fotografada no navegador";
    await d.getByLabel("Descrição da foto", { exact: true }).fill(caption);
    await d
      .getByLabel("Item fotografado", { exact: true })
      .selectOption("body");
    await d
      .getByLabel("Foto do checklist", { exact: true })
      .setInputFiles("work/workshop-evidence/photo.png");
    const uploaded = p.waitForResponse(
      (r) => r.url().endsWith("/photos") && r.request().method() === "POST",
    );
    await d.getByRole("button", { name: "Anexar foto", exact: true }).click();
    assert.equal((await uploaded).status(), 201);
    await d.getByRole("article").getByText(caption, { exact: true }).waitFor();
    checks++;
    await d.getByRole("button", { name: "Ver foto", exact: true }).click();
    let preview = p
      .getByRole("dialog")
      .filter({ has: p.getByRole("heading", { name: caption, exact: true }) });
    const image = preview.getByRole("img", { name: caption, exact: true });
    await image.evaluate((el) => el.decode());
    assert.equal(await image.evaluate((el) => el.naturalWidth), 64);
    await preview.getByRole("button", { name: "Close", exact: true }).click();
    checks++;
    async function status(target) {
      order = await api("/workshop/orders/" + order.id);
      order = await api("/workshop/orders/" + order.id + "/status", "POST", {
        status: target,
        revision: order.revision,
        note: "Autorização sintética para teste no navegador",
      });
      await p
        .getByRole("button", { name: "Recarregar OS", exact: true })
        .click();
      await p
        .getByRole("dialog")
        .getByText(
          {
            approved: "Aprovada",
            in_progress: "Em execução",
            ready: "Pronta",
            delivered: "Entregue",
          }[target] || target,
          { exact: true },
        )
        .first()
        .waitFor();
    }
    for (const target of ["waiting", "approved"]) {
      order = await api("/workshop/orders/" + order.id);
      order = await api("/workshop/orders/" + order.id + "/status", "POST", {
        status: target,
        revision: order.revision,
        note: "Cliente fictício autorizou o orçamento",
      });
    }
    await p.getByRole("button", { name: "Recarregar OS", exact: true }).click();
    await p
      .getByRole("button", {
        name: "Registrar assinatura de aceite",
        exact: true,
      })
      .click();
    await p.setViewportSize({ width: 390, height: 844 });
    async function drawAndSave(title, signer) {
      const dialog = p
        .getByRole("dialog")
        .filter({ has: p.getByRole("heading", { name: title, exact: true }) });
      await dialog
        .getByLabel("Nome de quem assina", { exact: true })
        .fill(signer);
      const canvas = dialog.getByRole("img", {
        name: "Área para desenhar a assinatura",
        exact: true,
      });
      await canvas.scrollIntoViewIfNeeded();
      let box = await canvas.boundingBox();
      if (title === "Assinatura de aceite") {
        await p.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2);
        await p.mouse.down();
        await p.mouse.move(
          box.x + box.width * 0.12,
          box.y + box.height * 0.22,
          { steps: 2 },
        );
        await p.mouse.up();
        await dialog
          .getByLabel(
            "Cliente conferiu o conteúdo e assinou neste dispositivo.",
            { exact: true },
          )
          .check();
        const rejected = p.waitForResponse(
          (r) =>
            r.url().endsWith("/signatures") && r.request().method() === "POST",
        );
        await dialog
          .getByRole("button", { name: "Salvar assinatura", exact: true })
          .click();
        assert.equal((await rejected).status(), 400);
        await dialog
          .getByRole("alert")
          .filter({ hasText: "muito curta" })
          .waitFor();
        assert.ok(
          await dialog
            .getByRole("button", { name: "Limpar assinatura", exact: true })
            .isEnabled(),
        );
        await dialog
          .getByRole("button", { name: "Limpar assinatura", exact: true })
          .click();
        await dialog
          .getByLabel(
            "Cliente conferiu o conteúdo e assinou neste dispositivo.",
            { exact: true },
          )
          .uncheck();
        checks++;
      }
      await canvas.scrollIntoViewIfNeeded();
      box = await canvas.boundingBox();
      const path = [
        [0.08, 0.7],
        [0.2, 0.2],
        [0.28, 0.75],
        [0.42, 0.4],
        [0.55, 0.65],
        [0.7, 0.35],
        [0.9, 0.55],
      ];
      await p.mouse.move(
        box.x + box.width * path[0][0],
        box.y + box.height * path[0][1],
      );
      await p.mouse.down();
      for (const [x, y] of path.slice(1))
        await p.mouse.move(box.x + box.width * x, box.y + box.height * y, {
          steps: 4,
        });
      await p.mouse.up();
      assert.ok(
        await dialog
          .getByRole("button", { name: "Salvar assinatura", exact: true })
          .isDisabled(),
      );
      await dialog
        .getByLabel(
          "Cliente conferiu o conteúdo e assinou neste dispositivo.",
          { exact: true },
        )
        .check();
      assert.ok(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      );
      await p.screenshot({
        path: "work/workshop-evidence/assinatura-celular.png",
        fullPage: true,
      });
      const saved = p.waitForResponse(
        (r) =>
          r.url().endsWith("/signatures") && r.request().method() === "POST",
      );
      await dialog
        .getByRole("button", { name: "Salvar assinatura", exact: true })
        .click();
      assert.equal((await saved).status(), 201);
      await dialog.waitFor({ state: "hidden" });
    }
    await drawAndSave("Assinatura de aceite", "Cliente fictício do navegador");
    let evidence = await api("/workshop/orders/" + order.id + "/evidence");
    assert.equal(evidence.signatures[0].current, true);
    assert.equal(evidence.signatures[0].payload.photos.length, 1);
    assert.ok(evidence.signatures[0].payload.strokes[0].length > 2);
    checks += 2;
    await p.setViewportSize({ width: 1440, height: 1080 });
    for (const target of ["in_progress", "ready"]) await status(target);
    const cash = await api("/cash-register/status");
    order = await api("/workshop/orders/" + order.id);
    await api(
      "/workshop/orders/" + order.id + "/checkout",
      "POST",
      {
        revision: order.revision,
        cash_register_id: cash.id,
        payment_method: "pix",
      },
      201,
    );
    await status("delivered");
    await p
      .getByRole("button", {
        name: "Registrar assinatura de recebimento",
        exact: true,
      })
      .click();
    await drawAndSave(
      "Assinatura de recebimento",
      "Recebedor fictício do navegador",
    );
    evidence = await api("/workshop/orders/" + order.id + "/evidence");
    assert.equal(evidence.signatures.filter((s) => s.current).length, 2);
    checks++;
    const download = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Imprimir / PDF", exact: true })
      .click();
    await (await download).saveAs("work/workshop-evidence/browser-order.pdf");
    checks++;
    const card = p.locator("article").filter({
      has: p.getByText("Recebimento · Recebedor fictício do navegador", {
        exact: true,
      }),
    });
    await card
      .getByRole("button", {
        name: "Cancelar registro de assinatura",
        exact: true,
      })
      .click();
    const correction = p.getByRole("dialog").filter({
      has: p.getByRole("heading", {
        name: "Cancelar registro de assinatura",
        exact: true,
      }),
    });
    await correction
      .getByLabel("Motivo da correção do anexo", { exact: true })
      .fill("Registro de teste cancelado sem apagar o original");
    await correction
      .getByRole("button", { name: "Confirmar correção", exact: true })
      .click();
    await correction.waitFor({ state: "hidden" });
    evidence = await api("/workshop/orders/" + order.id + "/evidence");
    assert.equal(evidence.signatures.length, 2);
    assert.ok(
      evidence.signatures.find((s) => s.purpose === "delivery").voidedAt,
    );
    checks++;
    await p.getByRole("button", { name: "Arquivar foto", exact: true }).click();
    const archive = p.getByRole("dialog").filter({
      has: p.getByRole("heading", { name: "Arquivar foto", exact: true }),
    });
    await archive
      .getByLabel("Motivo da correção do anexo", { exact: true })
      .fill("Foto de teste arquivada após a entrega");
    await archive
      .getByRole("button", { name: "Confirmar correção", exact: true })
      .click();
    await archive.waitFor({ state: "hidden" });
    assert.ok(
      (await api("/workshop/orders/" + order.id + "/evidence")).photos[0]
        .archivedAt,
    );
    checks++;
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " verificações de navegador aprovadas: foto, prévia autenticada, assinatura de aceite/recebimento, celular, PDF, cancelamento e arquivo preservado.",
    );
  } catch (e) {
    console.error(e.stack);
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
