const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { client, credentials } = require("./testing/commercial-context.cjs"),
  csv = require("../bar-management-system/src/services/partCsv");
const s = JSON.parse(fs.readFileSync("work/workshop/session.json")),
  { request, count } = client(),
  r = (path, method = "GET", body, status = 200, token = s.login.token) =>
    request(path, { method, body, status, token });
(async () => {
  assert.deepEqual(
    csv.parse('Nome;Ref\r\n"Peça; com aspas ""duplas""";001\r\n', ";").rows,
    [['Peça; com aspas "duplas"', "001"]],
  );
  for (const value of [
    'Nome;Ref\n"aberto;001',
    "Nome;Ref\n1;2;3",
    "Nome;Nome\n1;2",
    "Nome\n" + Array(201).fill("Produto").join("\n"),
  ])
    assert.throws(() => csv.parse(value, ";"));
  await r("/settings", "PUT", { modules: { autoparts: true } });
  const pass = credentials(),
    supplier = await r("/support/login", "POST", {
      username: "support.local",
      password: pass.support,
    }),
    support = await r(
      "/support/sessions",
      "POST",
      { company: s.slug },
      200,
      supplier.token,
    );
  const key = String(Date.now()),
    body = {
      filename: "catalogo.csv",
      source: "Fornecedor sintético " + key,
      separator: ";",
      mapping: {
        name: 0,
        manufacturer: 1,
        partNumber: 2,
        barcode: 3,
        price: 4,
        brand: 5,
        model: 6,
        yearFrom: 7,
        yearTo: 8,
      },
      csv:
        "Nome;Fabricante;Referência;Código;Preço;Marca;Modelo;De;Até\nFiltro " +
        key +
        ";Teste;REF-" +
        key +
        ";000" +
        key +
        ";1.234,56;Ford;Ka;2010;2018\nJunta " +
        key +
        ";Teste;JUN-" +
        key +
        ";;0;;;;",
    };
  const header = await r("/part-imports/headers", "POST", {
    csv: body.csv,
    separator: ";",
  });
  assert.equal(header.count, 2);
  await r("/part-imports/preview", "POST", body, 403, s.employee.token);
  await r("/part-imports/preview", "POST", body, 403, support.token);
  await r(
    "/part-imports/preview",
    "POST",
    { ...body, mapping: { manufacturer: 0 } },
    400,
  );
  const before = await r("/products");
  let b = await r("/part-imports/preview", "POST", body, 201);
  assert.ok(b.payload.rows.every((row) => !row.errors.length));
  assert.equal(b.payload.rows[0].values.product.salePrice, 1234.56);
  assert.deepEqual(await r("/products"), before);
  await r(
    "/part-imports/" + b.id + "/confirm",
    "POST",
    { digest: b.digest, confirmed: false },
    409,
  );
  await r(
    "/part-imports/" + b.id + "/confirm",
    "POST",
    { digest: "alterado", confirmed: true },
    409,
  );
  await r(
    "/part-imports/" + b.id + "/confirm",
    "POST",
    { digest: b.digest, confirmed: true },
    403,
    s.manager.token,
  );
  b = await r("/part-imports/" + b.id + "/confirm", "POST", {
    digest: b.digest,
    confirmed: true,
  });
  assert.equal(b.result.count, 2);
  const again = await r("/part-imports/" + b.id + "/confirm", "POST", {
    digest: b.digest,
    confirmed: true,
  });
  assert.deepEqual(again.result.productIds, b.result.productIds);
  const products = await r("/products"),
    p = products.find((x) => x.id === b.result.productIds[0]);
  assert.equal(p.active, false);
  assert.equal(Number(p.currentStock), 0);
  assert.equal(p.barcode, "000" + key);
  const part = await r("/autoparts/parts/" + p.id);
  assert.equal(part.partDetails.applications[0].yearFrom, 2010);
  assert.ok(part.partDetails.notes.includes(body.source));
  assert.equal(part.equivalents.length, 0);
  const duplicate = await r("/part-imports/preview", "POST", body, 201);
  assert.ok(duplicate.payload.rows.some((row) => row.errors.length));
  await r(
    "/part-imports/" + duplicate.id + "/confirm",
    "POST",
    { digest: duplicate.digest, confirmed: true },
    409,
  );
  await r(
    "/settings",
    "PUT",
    { modules: { autoparts: true } },
    200,
    s.second.token,
  );
  await r("/part-imports/" + b.id, "GET", undefined, 404, s.second.token);
  const invalid = await r(
    "/part-imports/preview",
    "POST",
    {
      ...body,
      csv: "Nome;Fabricante;Referência;Código;Preço;Marca;Modelo;De;Até\nPeça nova;Teste;REF-NOVA;;9,99;Ford;Ka;2020;2010",
    },
    201,
  );
  assert.ok(invalid.payload.rows[0].errors.length);
  await r(
    "/part-imports/" + invalid.id + "/confirm",
    "POST",
    { digest: invalid.digest, confirmed: true },
    409,
  );
  fs.writeFileSync(
    "work/marks/import.json",
    JSON.stringify({ batchId: b.id, productIds: b.result.productIds }),
    { mode: 0o600 },
  );
  console.log(
    count() +
      " verificações HTTP e 5 de parser aprovadas: CSV, prévia, mapeamento, valores, duplicidade, idempotência, estoque zero e isolamento.",
  );
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
