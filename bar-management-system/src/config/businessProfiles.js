const common = { delivery:false, recipes:false, market:false, autoparts:false, workshop:false, pizza:false, quotes: true, purchasing: true, finance: true };
const profiles = [
  {
    id: "bar_restaurante",
    name: "Bar / restaurante",
    description: "Mesas, comandas e produção na cozinha.",
    modules: { ...common, delivery:true, recipes:true, tables: true, kitchen: true },
  },
  {
    id: "pizzaria",
    name: "Pizzaria",
    description:
      "Balcão, mesas, cozinha e gestão comercial para pizzarias.",
    modules: { ...common, delivery:true, recipes:true, pizza:true, tables: true, kitchen: true },
  },
  {
    id: "hamburgueria",
    name: "Hamburgueria",
    description: "Balcão, mesas, comandas e preparo de lanches na cozinha.",
    modules: { ...common, delivery:true, recipes:true, tables: true, kitchen: true },
  },
  {
    id: "oficina",
    name: "Oficina mecânica",
    description:
      "Veículos, ordens de serviço, checklist, aprovação e recebimento integrado.",
    modules: { ...common, autoparts:true, workshop:true, tables: false, kitchen: false },
  },
  {
    id: "autopecas",
    name: "Autopeças",
    description: "Aplicações por veículo, referências, equivalências, vendas e compras.",
    modules: { ...common, autoparts:true, tables: false, kitchen: false },
  },
  {
    id: "mercado",
    name: "Mercado",
    description:
      "Vendas, lotes, validade, compras e financeiro.",
    modules: { ...common, market:true, tables: false, kitchen: false },
  },
  {
    id: "comercio",
    name: "Comércio geral",
    description: "Produtos, serviços e gestão comercial.",
    modules: { ...common, tables: false, kitchen: false },
  },
];
const moduleNames = {
  delivery:"Pedidos de entrega",
  recipes:"Alimentação — fichas técnicas e ingredientes",
  market:"Mercado — lotes, balanças e etiquetas",
  autoparts:"Autopeças — aplicações e equivalências",
  workshop:"Oficina — veículos e ordens de serviço",
  pizza:"Pizzaria — montagem e cardápio",
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
