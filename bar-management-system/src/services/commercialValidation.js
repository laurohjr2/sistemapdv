const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const uuid = (value) => {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  )
    throw fail("Identificador inválido");
  return value;
};
const text = (value, label, max = 200, required = true) => {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw fail(`${label} inválido`);
  return value.trim();
};
function cents(value, label = "Valor", zero = false) {
  if (
    value === null ||
    value === "" ||
    typeof value === "boolean" ||
    !["string", "number"].includes(typeof value)
  )
    throw fail(`${label} inválido`);
  const n = Number(value),
    c = Math.round(n * 100);
  if (
    !Number.isSafeInteger(c) ||
    c < (zero ? 0 : 1) ||
    c > 9999999999 ||
    Math.abs(n * 100 - c) > 1e-5
  )
    throw fail(`${label} inválido: use até duas casas decimais`);
  return c;
}
function quantity(value) {
  const n = Number(value),
    m = Math.round(n * 1000);
  if (
    value === null ||
    value === "" ||
    !["string", "number"].includes(typeof value) ||
    !Number.isSafeInteger(m) ||
    m <= 0 ||
    m > 9999999999 ||
    Math.abs(n * 1000 - m) > 1e-5
  )
    throw fail("Quantidade inválida: use até três casas decimais");
  return m / 1000;
}
function lineCents(amount, unit) {
  const result = Number(
    (BigInt(Math.round(quantity(amount) * 1000)) * BigInt(unit) + 500n) / 1000n,
  );
  if (result > 9999999999) throw fail("Total excede o limite permitido");
  return result;
}
function date(value, label = "Data") {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value + "T12:00:00Z")) ||
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw fail(`${label} inválida`);
  return value;
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
const digest = (value) =>
  require("node:crypto")
    .createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
const handler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    if (e.name === "SequelizeUniqueConstraintError")
      return res.status(409).json({
        error: "Registro ou solicitação já existente. Recarregue os dados.",
      });
    next(e);
  }
};
module.exports = {
  fail,
  uuid,
  text,
  cents,
  quantity,
  lineCents,
  date,
  today,
  digest,
  handler,
};
