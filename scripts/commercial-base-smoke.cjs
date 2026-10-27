// Destructive fixture creation is confined to a disposable Docker test project.
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs");
const { credentials, client } = require("./testing/commercial-context.cjs");
const { request: r, count } = client(),
  secret = credentials(),
  stamp = Date.now(),
  password = crypto.randomBytes(18).toString("hex");
const date = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(d);
};
(async () => {
  await r("/commerce/quotes", { status: 401 });
  assert.equal((await r("/version")).version, "0.3.0");
  const admin = (
    await r("/auth/login", {
      method: "POST",
      body: {
        company: "demo",
        username: "admin.local",
        password: secret.admin,
      },
    })
  ).token;
  const req = (path, method = "GET", body, status = 200, token = admin) =>
    r(path, { method, body, status, token });
  const registered = await req(
    "/users",
    "POST",
    { username: "atendente." + stamp, password, role: "garcom" },
    201,
  );
  const employee = (
    await req("/auth/login", "POST", {
      company: "demo",
      username: registered.user.username,
      password,
    })
  ).token;
  const profiles = await req("/settings/profiles");
  assert.equal(profiles.profiles.length, 6);
  assert.ok(profiles.profiles.some((p) => p.id === "pizzaria"));
  await req("/settings", "PUT", { businessProfile: "pizzaria" });
  // Only dispose of incomplete proposals created by this browser fixture.
  for (const prior of await req("/commerce/quotes"))
    if (
      prior.customerName.startsWith("Cliente de navegador ") &&
      ["draft", "sent", "approved"].includes(prior.status)
    )
      await req(`/commerce/quotes/${prior.id}/status`, "POST", {
        status: "cancelled",
      });

  assert.equal((await req("/settings")).modules.kitchen, true);
  await req("/settings", "PUT", { businessProfile: "invalid" }, 400);
  await req("/settings", "PUT", { modules: { unknown: true } }, 400);
  await req(
    "/settings",
    "PUT",
    { modules: { purchasing: true, finance: false } },
    400,
  );
  const current = await req("/cash-register/status");
  if (current.is_open)
    await req("/cash-register/close", "POST", { closing_amount: 0 });
  const cash = await req(
    "/cash-register/open",
    "POST",
    { opening_amount: 100 },
    201,
  );
  const product = (
    await req(
      "/products",
      "POST",
      {
        name: "Peça comercial " + stamp,
        category: "pecas",
        unitOfMeasure: "unidade",
        salePrice: 20,
        costPrice: 5,
      },
      201,
    )
  ).product;
  const service = (
    await req(
      "/products",
      "POST",
      {
        name: "Mão de obra " + stamp,
        itemType: "service",
        category: "mao_de_obra",
        unitOfMeasure: "hora",
        salePrice: 50,
        costPrice: 0,
      },
      201,
    )
  ).product;
  assert.equal(service.itemType, "service");
  await req("/stock/add", "POST", { productId: product.id, quantity: 5 }, 201);
  await req("/stock/add", "POST", { productId: service.id, quantity: 1 }, 400);
  assert.ok(
    !(await req("/stock/report")).report.some((p) => p.id === service.id),
  );
  assert.ok(
    !(await req("/reports/stock")).some((p) => p.name === service.name),
  );
  await req("/products/" + product.id, "PUT", { itemType: "service" }, 400);
  const sale = await req(
    "/sales",
    "POST",
    {
      items: [{ product_id: service.id, quantity: 1.5 }],
      payment_method: "pix",
      cash_register_id: cash.id,
    },
    201,
  );
  assert.equal(Number(sale.total_amount), 75);
  assert.equal((await req("/sales/" + sale.id)).items[0].stockTracked, false);
  await req("/sales/" + sale.id + "/cancel", "PUT");
  assert.equal(Number((await req("/products/" + service.id)).currentStock), 0);
  const mixed = await req(
    "/sales",
    "POST",
    {
      items: [
        { product_id: product.id, quantity: 2 },
        { product_id: service.id, quantity: 1 },
      ],
      payment_method: "dinheiro",
      cash_register_id: cash.id,
    },
    201,
  );
  assert.equal(Number(mixed.total_amount), 90);
  await req("/sales/" + mixed.id + "/cancel", "PUT");
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 5);
  await req("/tickets", "POST", { productId: service.id, quantity: 1 }, 400);
  const comanda = (
    await req(
      "/comandas",
      "POST",
      { type: "balcao", customerName: "Teste de serviço" },
      201,
    )
  ).comanda;
  const item = (
    await req(
      `/comandas/${comanda.id}/items`,
      "POST",
      { productId: service.id, quantity: 2 },
      201,
    )
  ).item;
  assert.equal(item.stockTracked, false);
  assert.equal(item.preparationStatus, "entregue");
  await req("/settings", "PUT", { businessProfile: "oficina" }, 400);
  await req(`/comandas/${comanda.id}/items/${item.id}`, "PUT", { quantity: 3 });
  await req("/comandas/" + comanda.id + "/cancel", "PUT", { reason: "Teste" });
  assert.equal(Number((await req("/products/" + service.id)).currentStock), 0);
  const quoteBody = {
    customerName: "Cliente comercial " + stamp,
    validUntil: date(15),
    discount: 10,
    notes: "Proposta de teste",
    lines: [
      { productId: product.id, quantity: 3 },
      { productId: service.id, quantity: 1 },
    ],
  };
  await req(
    "/commerce/quotes",
    "POST",
    {
      ...quoteBody,
      discount: 0,
      lines: [{ productId: service.id, quantity: 1, unitPrice: 1 }],
    },
    403,
    employee,
  );
  await req("/commerce/quotes", "POST", quoteBody, 403, employee);
  await req(
    "/commerce/quotes",
    "POST",
    { ...quoteBody, validUntil: date(-1) },
    400,
  );
  await req(
    "/commerce/quotes",
    "POST",
    { ...quoteBody, lines: [{ productId: product.id, quantity: 0 }] },
    400,
  );
  const quote = await req("/commerce/quotes", "POST", quoteBody, 201);
  assert.equal(Number(quote.total), 100);
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 5);
  await req(
    `/commerce/quotes/${quote.id}/status`,
    "POST",
    { status: "approved", approvalNote: "Sem envio" },
    409,
  );
  await req(`/commerce/quotes/${quote.id}/status`, "POST", { status: "sent" });
  await req(
    `/commerce/quotes/${quote.id}/status`,
    "POST",
    { status: "approved", approvalNote: "Sem acesso" },
    403,
    employee,
  );
  await req(
    `/commerce/quotes/${quote.id}/status`,
    "POST",
    { status: "approved" },
    400,
  );
  await req(`/commerce/quotes/${quote.id}/status`, "POST", {
    status: "approved",
    approvalNote: "Cliente aprovou presencialmente",
  });
  await req("/commerce/quotes/" + quote.id, "PUT", quoteBody, 403);
  await req("/products/" + product.id, "PUT", { salePrice: 30 });
  const convertBody = { payment_method: "pix", cash_register_id: cash.id };
  const conversion = await Promise.all(
    [1, 2].map(() =>
      r(`/commerce/quotes/${quote.id}/convert`, {
        method: "POST",
        body: convertBody,
        token: employee,
        status: [201, 409],
      }),
    ),
  );
  assert.deepEqual(conversion.map((v) => v.responseStatus).sort(), [201, 409]);
  const converted = await req("/commerce/quotes/" + quote.id);
  assert.ok(converted.saleId);
  assert.equal(
    Number((await req("/sales/" + converted.saleId)).total_amount),
    100,
  );
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 2);
  await req(`/commerce/quotes/${quote.id}/convert`, "POST", convertBody, 409);
  assert.ok(
    (await req(`/commerce/quotes/${quote.id}/pdf`))
      .subarray(0, 4)
      .equals(Buffer.from("%PDF")),
  );
  const supplier = await req(
    "/commerce/suppliers",
    "POST",
    { name: "Fornecedor " + stamp, phone: "11999999999" },
    201,
  );
  await req("/commerce/suppliers", "GET", undefined, 403, employee);
  const order = await req(
    "/commerce/purchases",
    "POST",
    {
      supplierId: supplier.id,
      lines: [{ productId: product.id, quantity: 10, unitCost: 6 }],
      expectedDate: date(5),
    },
    201,
  );
  assert.equal(Number(order.total), 60);
  await req(
    "/commerce/purchases",
    "POST",
    {
      supplierId: supplier.id,
      lines: [{ productId: service.id, quantity: 1, unitCost: 1 }],
    },
    400,
  );
  const firstReceipt = {
    requestKey: crypto.randomUUID(),
    dueDate: date(30),
    lines: [{ lineId: order.lines[0].lineId, quantity: 4 }],
  };
  const first = await req(
    `/commerce/purchases/${order.id}/receive`,
    "POST",
    firstReceipt,
    201,
  );
  assert.equal(first.order.status, "partial");
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 6);
  const repeated = await req(
    `/commerce/purchases/${order.id}/receive`,
    "POST",
    firstReceipt,
    201,
  );
  assert.equal(repeated.receipt.id, first.receipt.id);
  assert.equal(repeated.replayed, true);
  await req(
    `/commerce/purchases/${order.id}/receive`,
    "POST",
    {
      ...firstReceipt,
      lines: [{ lineId: order.lines[0].lineId, quantity: 5 }],
    },
    409,
  );
  await req(
    `/commerce/purchases/${order.id}/receive`,
    "POST",
    {
      ...firstReceipt,
      requestKey: crypto.randomUUID(),
      lines: [{ lineId: order.lines[0].lineId, quantity: 7 }],
    },
    400,
  );
  await req(`/commerce/purchases/${order.id}/cancel`, "POST", {}, 409);
  const secondReceipt = {
    requestKey: crypto.randomUUID(),
    dueDate: date(30),
    lines: [{ lineId: order.lines[0].lineId, quantity: 6 }],
  };
  const results = await Promise.all([
    req(`/commerce/purchases/${order.id}/receive`, "POST", secondReceipt, 201),
    req(`/commerce/purchases/${order.id}/receive`, "POST", secondReceipt, 201),
  ]);
  assert.equal(results[0].receipt.id, results[1].receipt.id);
  assert.equal(results[0].order.status, "received");
  assert.equal(Number((await req("/products/" + product.id)).currentStock), 12);
  assert.equal(
    (await req("/commerce/purchases/" + order.id)).receipts.length,
    2,
  );
  assert.ok(
    (await req(`/commerce/purchases/${order.id}/pdf`))
      .subarray(0, 4)
      .equals(Buffer.from("%PDF")),
  );
  const fractional = await req(
    "/commerce/purchases",
    "POST",
    {
      supplierId: supplier.id,
      lines: [{ productId: product.id, quantity: 3, unitCost: 0.01 }],
    },
    201,
  );
  const fractionalTotals = [];
  for (let i = 0; i < 2; i++) {
    const result = await req(
      `/commerce/purchases/${fractional.id}/receive`,
      "POST",
      {
        requestKey: crypto.randomUUID(),
        dueDate: date(30),
        lines: [{ lineId: fractional.lines[0].lineId, quantity: 1.5 }],
      },
      201,
    );
    fractionalTotals.push(Number(result.receipt.total));
    const entry = (await req("/commerce/finance")).entries.find(
      (e) => e.sourceKey === "purchase:" + result.receipt.id,
    );
    await req(
      `/commerce/finance/${entry.id}/payments`,
      "POST",
      {
        requestKey: crypto.randomUUID(),
        amount: entry.amount,
        paidOn: date(),
        method: "pix",
      },
      201,
    );
  }
  assert.deepEqual(fractionalTotals, [0.02, 0.01]);
  assert.equal(
    fractionalTotals.reduce((a, b) => a + Math.round(b * 100), 0),
    3,
  );
  const entries = (await req("/commerce/finance")).entries;
  const account = entries.find(
    (e) => e.sourceKey === "purchase:" + first.receipt.id,
  );
  assert.ok(account);
  assert.equal(Number(account.amount), 24);
  await req(`/commerce/finance/${account.id}/cancel`, "POST", {}, 409);
  const payment = {
    requestKey: crypto.randomUUID(),
    amount: 10,
    paidOn: date(),
    method: "pix",
  };
  const paid = await req(
    `/commerce/finance/${account.id}/payments`,
    "POST",
    payment,
    201,
  );
  assert.equal(paid.balance, 14);
  assert.equal(paid.status, "partial");
  await req(`/commerce/finance/${account.id}/payments`, "POST", payment, 201);
  await req(
    `/commerce/finance/${account.id}/payments`,
    "POST",
    { ...payment, amount: 11 },
    409,
  );
  await req(
    `/commerce/finance/${account.id}/payments`,
    "POST",
    { ...payment, requestKey: crypto.randomUUID(), amount: 15 },
    409,
  );
  const cashPayment = {
    ...payment,
    requestKey: crypto.randomUUID(),
    amount: 14,
    method: "dinheiro",
  };
  await req(
    `/commerce/finance/${account.id}/payments`,
    "POST",
    cashPayment,
    201,
  );
  assert.equal(
    (await req("/cash-register/report/" + cash.id)).expected_amount,
    86,
  );
  const receivable = await req(
    "/commerce/finance",
    "POST",
    {
      direction: "receivable",
      description: "Recebimento avulso " + stamp,
      partyName: "Cliente avulso",
      amount: 40,
      dueDate: date(),
    },
    201,
  );
  await req(
    `/commerce/finance/${receivable.id}/payments`,
    "POST",
    {
      requestKey: crypto.randomUUID(),
      amount: 20,
      paidOn: date(),
      method: "dinheiro",
    },
    201,
  );
  await req(
    `/commerce/finance/${receivable.id}/payments`,
    "POST",
    {
      requestKey: crypto.randomUUID(),
      amount: 20,
      paidOn: date(),
      method: "transferencia",
    },
    201,
  );
  const big = await req(
    "/commerce/finance",
    "POST",
    {
      direction: "payable",
      description: "Saída maior que saldo",
      partyName: "Fornecedor avulso",
      amount: 500,
      dueDate: date(),
    },
    201,
  );
  await req(
    `/commerce/finance/${big.id}/payments`,
    "POST",
    {
      requestKey: crypto.randomUUID(),
      amount: 500,
      paidOn: date(),
      method: "dinheiro",
    },
    400,
  );
  await req(`/commerce/finance/${big.id}/cancel`, "POST", {});
  const late = await req(
    "/commerce/finance",
    "POST",
    {
      direction: "receivable",
      description: "Vencida " + stamp,
      partyName: "Cliente avulso",
      amount: 5,
      dueDate: date(-1),
    },
    201,
  );
  assert.ok(
    (await req("/commerce/finance?status=overdue")).entries.some(
      (e) => e.id === late.id,
    ),
  );
  await req(
    "/commerce/finance",
    "POST",
    {
      direction: "receivable",
      description: "Data inválida",
      partyName: "Cliente",
      amount: 5,
      dueDate: "2026-02-30",
    },
    400,
  );
  await req(`/commerce/finance/${account.id}/cancel`, "POST", {}, 409);
  await req("/commerce/finance", "GET", undefined, 403, employee);
  await req("/commerce/purchases", "GET", undefined, 403, employee);
  assert.ok(
    (await req("/commerce/finance/export.pdf"))
      .subarray(0, 4)
      .equals(Buffer.from("%PDF")),
  );
  const closed = await req("/cash-register/close", "POST", {
    closing_amount: 106,
  });
  assert.equal(closed.expected_amount, 106);
  assert.equal(closed.difference, 0);
  assert.equal(closed.financialCashOut, 14);
  assert.equal(closed.financialCashIn, 20);
  await req(
    `/commerce/finance/${account.id}/payments`,
    "POST",
    cashPayment,
    201,
  );
  await req(
    `/commerce/finance/${late.id}/payments`,
    "POST",
    {
      requestKey: crypto.randomUUID(),
      amount: 5,
      paidOn: date(),
      method: "dinheiro",
    },
    400,
  );
  await req("/products/" + product.id, "DELETE");
  const inactive = await req("/products/" + product.id);
  assert.equal(inactive.active, false);
  assert.equal(Number(inactive.currentStock), 15);
  await req("/products/" + product.id, "PUT", { active: true });
  await req("/settings", "PUT", { businessProfile: "oficina" });
  const office = await req("/settings");
  assert.equal(office.modules.tables, false);
  await req("/tables", "GET", undefined, 403);
  await req("/queue", "GET", undefined, 403);
  await req(
    "/comandas",
    "POST",
    { type: "balcao", customerName: "Não abrir" },
    403,
  );
  await req("/settings", "PUT", { modules: { quotes: false } });
  await req("/commerce/quotes", "GET", undefined, 403);
  await req("/sales", "POST", { ...convertBody, sourceQuoteId: quote.id }, 403);
  await req(
    "/settings",
    "PUT",
    { modules: { purchasing: false, finance: false } },
    400,
  );
  await req("/settings", "PUT", { businessProfile: "pizzaria" });
  const master = (
    await req("/support/login", "POST", {
      username: "master.local",
      password: secret.master,
    })
  ).token;
  const session = await req(
    "/support/sessions",
    "POST",
    { company: "demo" },
    200,
    master,
  );
  assert.equal(session.user.master, true);
  assert.ok(!(await req("/users")).some((u) => u.platformUserId));
  await req("/support/company-info", "GET", undefined, 200, session.token);
  fs.mkdirSync("work/commerce", { recursive: true });
  fs.writeFileSync(
    "work/commerce/session.json",
    JSON.stringify({
      admin,
      employee,
      user: registered.user,
      product,
      service,
      supplier,
      quote,
      order,
      account,
      master: session.token,
    }),
  );
  console.log(
    `${count()} verificações HTTP comerciais aprovadas: perfis, serviços sem estoque, orçamento convertido uma vez, compras parciais idempotentes, contas, caixa e permissões.`,
  );
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
