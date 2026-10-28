const { fail, text, cents } = require("./commercialValidation");
const fields = {
  name: "Nome",
  manufacturer: "Fabricante",
  partNumber: "Referência",
  barcode: "Código de barras",
  category: "Categoria",
  unit: "Unidade",
  cost: "Custo",
  price: "Preço",
  originalCodes: "Códigos originais (|)",
  brand: "Marca do veículo",
  model: "Modelo",
  yearFrom: "Ano inicial",
  yearTo: "Ano final",
  engine: "Motor",
  version: "Versão",
  notes: "Observações",
};
function parse(csv, separator) {
  if (
    typeof csv !== "string" ||
    Buffer.byteLength(csv) > 256 * 1024 ||
    !csv.trim() ||
    ![",", ";", "\t"].includes(separator)
  )
    throw fail(
      "CSV inválido: até 256 KB, separado por vírgula, ponto e vírgula ou tabulação",
    );
  const rows = [],
    row = [];
  let cell = "",
    quoted = false,
    closed = false;
  const push = () => {
    row.push(cell.trim());
    cell = "";
    closed = false;
    if (row.length > 40) throw fail("Limite de 40 colunas");
  };
  const end = () => {
    push();
    if (row.some((c) => c !== "")) rows.push(row.splice(0));
    else row.splice(0);
    if (rows.length > 201) throw fail("Importe até 200 produtos por arquivo");
  };
  csv = csv.replace(/^\uFEFF/, "");
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
      continue;
    }
    if (c === '"') {
      if (cell || closed) throw fail("Aspas inválidas no CSV");
      quoted = true;
    } else if (c === separator) push();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      end();
    } else {
      if (closed && !/\s/.test(c))
        throw fail("Conteúdo após fechamento das aspas");
      if (!closed) cell += c;
    }
  }
  if (quoted) throw fail("Aspas não fechadas no CSV");
  if (cell || row.length || closed) end();
  if (rows.length < 2) throw fail("O CSV precisa de cabeçalho e produtos");
  const headers = rows.shift();
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw fail("Cabeçalhos vazios ou repetidos");
  if (rows.some((r) => r.length !== headers.length))
    throw fail(
      "Todas as linhas precisam ter o mesmo número de colunas do cabeçalho",
    );
  return { headers, rows };
}
function values(row, mapping, source) {
  const cell = (k) => (mapping[k] === undefined ? "" : row[mapping[k]]),
    optional = (k, max) => text(cell(k), fields[k], max, false),
    name = text(cell("name"), "Nome", 100),
    unit = cell("unit") || "unidade";
  if (
    ![
      "unidade",
      "litro",
      "kg",
      "gramas",
      "ml",
      "hora",
      "servico",
      "metro",
      "caixa",
      "par",
    ].includes(unit)
  )
    throw fail("Unidade desconhecida. Use a unidade cadastrada no sistema");
  const money = (k) => {
    let v = cell(k) || "0";
    if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(v))
      v = v.replace(/\./g, "").replace(",", ".");
    else if (/^\d+,\d{1,2}$/.test(v)) v = v.replace(",", ".");
    return cents(v, fields[k], true) / 100;
  };
  const manufacturer = optional("manufacturer", 100),
    partNumber = optional("partNumber", 100),
    barcode = optional("barcode", 50) || null,
    notes = optional("notes", 3000);
  const originalCodes = [
    ...new Set(
      cell("originalCodes")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (originalCodes.length > 50 || originalCodes.some((c) => c.length > 100))
    throw fail("Códigos originais inválidos");
  const brand = optional("brand", 60),
    model = optional("model", 100),
    applications = [];
  if (
    brand ||
    model ||
    cell("yearFrom") ||
    cell("yearTo") ||
    cell("engine") ||
    cell("version")
  ) {
    if (
      !brand ||
      !model ||
      !/^\d{4}$/.test(cell("yearFrom")) ||
      !/^\d{4}$/.test(cell("yearTo"))
    )
      throw fail("Aplicação requer marca, modelo, ano inicial e final");
    const from = Number(cell("yearFrom")),
      to = Number(cell("yearTo"));
    if (from < 1900 || to > 2100 || from > to)
      throw fail("Anos de aplicação inválidos");
    applications.push({
      brand,
      model,
      yearFrom: from,
      yearTo: to,
      engine: optional("engine", 100),
      version: optional("version", 100),
      notes: "Aplicação informada no arquivo; conferir com a fonte: " + source,
    });
  }
  return {
    product: {
      name,
      category: optional("category", 80) || "autopecas",
      unitOfMeasure: unit,
      costPrice: money("cost"),
      salePrice: money("price"),
      barcode,
      currentStock: 0,
      minStockAlert: 0,
      itemType: "product",
      active: false,
    },
    details: {
      manufacturer,
      partNumber,
      originalCodes,
      applications,
      notes: (notes ? notes + "\n" : "") + "Origem do catálogo: " + source,
    },
  };
}
function mapped(csv, separator, mapping, source) {
  const parsed = parse(csv, separator);
  if (
    !mapping ||
    typeof mapping !== "object" ||
    Array.isArray(mapping) ||
    mapping.name === undefined
  )
    throw fail("Mapeie a coluna Nome");
  const seen = new Set();
  for (const [key, index] of Object.entries(mapping)) {
    if (
      !Object.hasOwn(fields, key) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= parsed.headers.length ||
      seen.has(index)
    )
      throw fail("Mapeamento de colunas inválido ou repetido");
    seen.add(index);
  }
  return {
    headers: parsed.headers,
    rows: parsed.rows.map((row, index) => {
      try {
        return {
          line: index + 2,
          values: values(row, mapping, source),
          errors: [],
        };
      } catch (e) {
        if (!e.status) throw e;
        return { line: index + 2, values: null, errors: [e.message] };
      }
    }),
  };
}
module.exports = { fields, parse, mapped };
