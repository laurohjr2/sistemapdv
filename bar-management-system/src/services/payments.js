const methods = [
  "dinheiro",
  "pix",
  "cartao_credito",
  "cartao_debito",
  "vale_refeicao",
];
const fail = (message) => Object.assign(new Error(message), { status: 400 });
function settlement(payments, method, total) {
  const cents = Math.round(Number(total) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw fail("Total inválido");
  if (payments === undefined || payments === null) {
    if (!methods.includes(method)) throw fail("Forma de pagamento inválida");
    return [{ method, amount: cents / 100 }];
  }
  if (!Array.isArray(payments) || !payments.length || payments.length > 100)
    throw fail("Informe os pagamentos");
  let sum = 0;
  const normalized = payments.map((p) => {
    const amount = Number(p.amount),
      n = Math.round(amount * 100);
    if (
      !methods.includes(p.method) ||
      !Number.isFinite(amount) ||
      n <= 0 ||
      Math.abs(amount * 100 - n) > 1e-6 ||
      !Number.isSafeInteger(n)
    )
      throw fail("Pagamento inválido");
    sum += n;
    return { method: p.method, amount: n / 100 };
  });
  if (sum !== cents)
    throw fail("A soma dos pagamentos deve ser igual ao total da conta");
  return normalized;
}
module.exports = { settlement };
