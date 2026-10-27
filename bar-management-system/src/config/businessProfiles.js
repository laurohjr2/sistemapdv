const common = { quotes: true, purchasing: true, finance: true };
const profiles = [
  {
    id: "bar_restaurante",
    name: "Bar / restaurante",
    description: "Mesas, comandas e produção na cozinha.",
    modules: { ...common, tables: true, kitchen: true },
  },
  {
    id: "pizzaria",
    name: "Pizzaria",
    description:
      "Balcão, mesas, cozinha e gestão comercial para pizzarias.",
    modules: { ...common, tables: true, kitchen: true },
  },
  {
    id: "oficina",
    name: "Oficina mecânica",
    description:
      "Produtos, serviços, orçamentos, compras e gestão comercial.",
    modules: { ...common, tables: false, kitchen: false },
  },
  {
    id: "autopecas",
    name: "Autopeças",
    description: "Balcão, peças, orçamentos, compras e financeiro.",
    modules: { ...common, tables: false, kitchen: false },
  },
  {
    id: "mercado",
    name: "Mercado",
    description:
      "Vendas, produtos, compras e financeiro. Pesagem e validade avançada terão implantação específica.",
    modules: { ...common, tables: false, kitchen: false },
  },
  {
    id: "comercio",
    name: "Comércio geral",
    description: "Produtos, serviços e gestão comercial.",
    modules: { ...common, tables: false, kitchen: false },
  },
];
const moduleNames = {
  tables: "Mesas e comandas",
  kitchen: "Cozinha",
  quotes: "Orçamentos",
  purchasing: "Fornecedores e compras",
  finance: "Contas a pagar e receber",
};
function effectiveModules(settings = {}) {
  return {
    ...(profiles.find((p) => p.id === settings.businessProfile) || profiles[0])
      .modules,
    ...settings.modules,
  };
}
module.exports = { profiles, moduleNames, effectiveModules };
