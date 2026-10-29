// Only confirmed persistence endpoints. Calculations, previews, login and reads stay silent.
const collection = (path, message) => [
  ["post", new RegExp("^/" + path + "$"), message],
  ["put", new RegExp("^/" + path + "/[^/]+$"), message],
];
const rules = [
  ["put", /^\/settings$/, "Configurações salvas com sucesso."],
  ...collection("products", "Produto salvo com sucesso."),
  ...collection("customers", "Cliente salvo com sucesso."),
  ...collection("users", "Usuário salvo com sucesso."),
  ["put", /^\/users\/[^/]+\/password$/, "Senha salva com sucesso."],
  ["post", /^\/auth\/reset-password$/, "Nova senha salva com sucesso."],
  ...collection("tables", "Mesa salva com sucesso."),
  ["put", /^\/comandas\/[^/]+\/customer$/, "Cliente salvo na comanda."],
  ["put", /^\/access\/users\/[^/]+$/, "Acessos salvos com sucesso."],
  ...collection("commerce/quotes", "Orçamento salvo com sucesso."),
  ...collection("commerce/suppliers", "Fornecedor salvo com sucesso."),
  ["post", /^\/commerce\/purchases$/, "Pedido de compra salvo com sucesso."],
  ["post", /^\/commerce\/finance$/, "Conta salva com sucesso."],
  [
    "post",
    /^\/commerce\/finance\/[^/]+\/payments$/,
    "Movimentação financeira salva com sucesso.",
  ],
  ...collection("workshop/vehicles", "Veículo salvo com sucesso."),
  ...collection("workshop/orders", "Ordem de serviço salva com sucesso."),
  ["post", /^\/workshop\/orders\/[^/]+\/photos$/, "Foto salva com sucesso."],
  [
    "post",
    /^\/workshop\/orders\/[^/]+\/signatures$/,
    "Assinatura salva com sucesso.",
  ],
  ...collection("workshop-agenda", "Agendamento salvo com sucesso."),
  ["post", /^\/workshop-warranty$/, "Garantia salva com sucesso."],
  ["put", /^\/autoparts\/parts\/[^/]+$/, "Cadastro técnico salvo com sucesso."],
  ["post", /^\/autoparts\/equivalences$/, "Equivalência salva com sucesso."],
  ...collection("deliveries", "Pedido de entrega salvo com sucesso."),
  ["put", /^\/recipes\/[^/]+$/, "Ficha técnica salva com sucesso."],
  ["put", /^\/pizza\/catalog$/, "Cardápio salvo com sucesso."],
  ...collection("bundles", "Combo salvo com sucesso."),
  ["put", /^\/scale\/settings$/, "Formato salvo com sucesso."],
  ["put", /^\/scale\/products\/[^/]+$/, "Vínculo e preço salvos com sucesso."],
  ["put", /^\/loyalty\/profiles\/[^/]+$/, "Benefício salvo com sucesso."],
];
export function saveSuccessMessage(config = {}) {
  if (config.saveSuccess === false) return null;
  const method = String(config.method || "get").toLowerCase();
  if (!["post", "put", "patch"].includes(method)) return null;
  if (typeof config.saveSuccess === "string" && config.saveSuccess.trim())
    return config.saveSuccess;
  let path;
  try {
    path = new URL(config.url, "https://pdv.invalid").pathname
      .replace(/^\/api(?=\/)/, "")
      .replace(/\/+$/, "");
  } catch {
    return null;
  }
  return (
    rules.find(
      ([methods, pattern]) =>
        methods.split("|").includes(method) && pattern.test(path),
    )?.[2] || null
  );
}
