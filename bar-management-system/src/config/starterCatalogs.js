// Stable names are also the import identity. Never rename existing catalog entries;
// add a new entry for a genuinely different package or specification.
const crypto = require("node:crypto");
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
function identity(name, type = "product") {
  const hex = crypto
    .createHash("sha256")
    .update(`sistemapdv:starter:v1:${type}:${normalize(name)}`)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const entries = new Map();
function group(
  category,
  names,
  unitOfMeasure = "unidade",
  itemType = "product",
  description = "",
) {
  return names.map((name) => {
    const id = identity(name, itemType);
    if (!entries.has(id))
      entries.set(id, {
        id,
        name,
        category,
        unitOfMeasure,
        itemType,
        description,
      });
    return id;
  });
}
const beers = group(
  "bebidas_alcoolicas",
  [
    "Brahma Chopp",
    "Skol Pilsen",
    "Antarctica Pilsen",
    "Original",
    "Bohemia Pilsen",
    "Heineken",
    "Amstel",
    "Budweiser",
    "Stella Artois",
    "Spaten",
  ]
    .flatMap((brand) =>
      ["lata 350 ml", "lata 473 ml", "garrafa 600 ml"].map(
        (size) => `Cerveja ${brand} ${size}`,
      ),
    )
    .concat([
      "Cerveja Heineken long neck 330 ml",
      "Cerveja Budweiser long neck 330 ml",
      "Cerveja Stella Artois long neck 330 ml",
      "Cerveja Corona long neck 330 ml",
      "Cerveja Heineken 0.0 long neck 330 ml",
      "Cerveja sem álcool lata 350 ml",
      "Cerveja artesanal IPA lata 473 ml",
      "Cerveja artesanal Weiss garrafa 500 ml",
      "Cerveja artesanal Lager garrafa 500 ml",
      "Chopp Pilsen copo 300 ml",
      "Chopp Pilsen copo 500 ml",
      "Chopp IPA copo 500 ml",
    ]),
);
const drinks = group(
  "bebidas_nao_alcoolicas",
  [
    "Coca-Cola",
    "Coca-Cola Zero",
    "Guaraná Antarctica",
    "Guaraná Antarctica Zero",
    "Fanta Laranja",
    "Fanta Uva",
    "Sprite",
    "Pepsi",
  ]
    .flatMap((brand) =>
      ["lata 350 ml", "garrafa 600 ml", "garrafa 2 L"].map(
        (size) => `Refrigerante ${brand} ${size}`,
      ),
    )
    .concat([
      "Água mineral sem gás 500 ml",
      "Água mineral com gás 500 ml",
      "Água mineral sem gás 1,5 L",
      "Água tônica lata 350 ml",
      "Água de coco caixa 200 ml",
      "Suco de uva integral 1 L",
      "Suco de laranja copo 300 ml",
      "Suco de limão copo 300 ml",
      "Suco de maracujá copo 300 ml",
      "Energético Red Bull lata 250 ml",
      "Energético Monster lata 473 ml",
      "Café expresso 50 ml",
    ]),
);
const barFood = group("porcoes", [
  "Batata frita porção pequena",
  "Batata frita porção grande",
  "Batata frita com cheddar e bacon",
  "Frango com fritas",
  "Calabresa acebolada",
  "Mandioca frita",
  "Polenta frita",
  "Isca de peixe",
  "Isca de frango",
  "Bolinho de bacalhau 6 unidades",
  "Bolinho de queijo 6 unidades",
  "Anéis de cebola porção",
  "Tábua de frios pequena",
  "Tábua de frios grande",
  "Amendoim porção",
  "Pastel de carne unidade",
  "Pastel de queijo unidade",
]);
const alcohol = group("bebidas_alcoolicas", [
  "Caipirinha de limão copo 300 ml",
  "Caipiroska de limão copo 300 ml",
  "Gin tônica copo 500 ml",
  "Vodka dose 50 ml",
  "Whisky dose 50 ml",
  "Cachaça dose 50 ml",
  "Vinho tinto seco garrafa 750 ml",
  "Vinho tinto suave garrafa 750 ml",
  "Vinho branco seco garrafa 750 ml",
  "Espumante brut garrafa 750 ml",
]);
const sweets = group("sobremesas", [
  "Pudim fatia",
  "Mousse de chocolate unidade",
  "Mousse de maracujá unidade",
  "Brownie unidade",
  "Sorvete pote 120 ml",
  "Açaí copo 300 ml",
  "Açaí copo 500 ml",
]);
const burgers = group("comidas", [
  "Hambúrguer tradicional",
  "X-búrguer",
  "X-salada",
  "X-bacon",
  "X-egg",
  "X-tudo",
  "Cheeseburger duplo",
  "Hambúrguer de frango",
  "Hambúrguer vegetariano",
  "Hambúrguer vegano",
  "Smash burger simples",
  "Smash burger duplo",
  "Sanduíche de frango",
  "Cachorro-quente tradicional",
  "Combo hambúrguer tradicional + batata + refrigerante",
  "Combo x-bacon + batata + refrigerante",
]);
const pizza = group(
  "pizzas",
  [
    "Pizza base broto 20 cm",
    "Pizza base pequena 25 cm",
    "Pizza base média 30 cm",
    "Pizza base grande 35 cm",
    "Pizza base família 40 cm",
  ],
  "unidade",
  "product",
  "Base de estoque para montagem. Vincule ao tamanho no menu Pizzaria e configure os sabores e preços.",
);
const pizzaReady = group(
  "pizzas",
  [
    "Mussarela",
    "Calabresa",
    "Portuguesa",
    "Frango com requeijão",
    "Quatro queijos",
    "Marguerita",
    "Napolitana",
    "Vegetariana",
    "Bacon",
    "Pepperoni",
    "Chocolate",
    "Banana com canela",
  ].map((flavor) => `Pizza ${flavor.toLowerCase()} congelada 460 g`),
);
const groceries = group("alimentos", [
  "Arroz branco pacote 1 kg",
  "Arroz branco pacote 5 kg",
  "Arroz integral pacote 1 kg",
  "Feijão carioca pacote 1 kg",
  "Feijão preto pacote 1 kg",
  "Açúcar cristal pacote 1 kg",
  "Açúcar refinado pacote 1 kg",
  "Sal refinado pacote 1 kg",
  "Farinha de trigo pacote 1 kg",
  "Farinha de mandioca pacote 500 g",
  "Fubá pacote 500 g",
  "Macarrão espaguete pacote 500 g",
  "Macarrão parafuso pacote 500 g",
  "Óleo de soja garrafa 900 ml",
  "Azeite de oliva garrafa 500 ml",
  "Café torrado e moído pacote 500 g",
  "Leite integral caixa 1 L",
  "Leite desnatado caixa 1 L",
  "Leite em pó pacote 400 g",
  "Achocolatado pote 400 g",
  "Biscoito cream cracker pacote 200 g",
  "Biscoito recheado pacote 120 g",
  "Molho de tomate sachê 300 g",
  "Extrato de tomate lata 340 g",
  "Milho verde lata 170 g",
  "Ervilha lata 170 g",
  "Sardinha lata 125 g",
  "Atum lata 170 g",
  "Maionese pote 500 g",
  "Ketchup frasco 400 g",
  "Mostarda frasco 200 g",
  "Margarina pote 500 g",
  "Manteiga pote 200 g",
  "Iogurte garrafa 170 g",
  "Pão de forma pacote 450 g",
  "Pão de queijo congelado pacote 1 kg",
  "Batata pré-frita congelada pacote 1 kg",
  "Ovos brancos cartela 12 unidades",
  "Ovos brancos cartela 30 unidades",
  "Gelo pacote 5 kg",
]);
const weighed = group(
  "alimentos",
  [
    "Banana prata a granel",
    "Banana nanica a granel",
    "Maçã a granel",
    "Laranja pera a granel",
    "Limão a granel",
    "Mamão a granel",
    "Tomate a granel",
    "Batata a granel",
    "Cebola a granel",
    "Cenoura a granel",
    "Mussarela fatiada a granel",
    "Presunto fatiado a granel",
    "Carne bovina acém a granel",
    "Carne bovina patinho a granel",
    "Peito de frango a granel",
    "Linguiça toscana a granel",
  ],
  "kg",
);
const hygiene = group("higiene", [
  "Sabonete barra 85 g",
  "Shampoo frasco 350 ml",
  "Condicionador frasco 350 ml",
  "Creme dental tubo 90 g",
  "Escova dental unidade",
  "Papel higiênico pacote 4 rolos",
  "Desodorante aerosol 150 ml",
  "Absorvente pacote 8 unidades",
  "Fralda infantil tamanho M pacote 24 unidades",
]);
const cleaning = group("limpeza", [
  "Água sanitária frasco 1 L",
  "Detergente frasco 500 ml",
  "Desinfetante frasco 2 L",
  "Sabão em pó pacote 800 g",
  "Sabão líquido frasco 1 L",
  "Amaciante frasco 2 L",
  "Álcool líquido 70% frasco 1 L",
  "Esponja multiuso unidade",
  "Saco de lixo 30 L pacote 10 unidades",
  "Saco de lixo 50 L pacote 10 unidades",
  "Pano de chão unidade",
]);
const oils = group(
  "lubrificantes",
  [
    "Óleo motor mineral 20W-50 frasco 1 L",
    "Óleo motor semissintético 10W-40 frasco 1 L",
    "Óleo motor sintético 5W-30 frasco 1 L",
    "Óleo motor sintético 5W-40 frasco 1 L",
    "Óleo motor sintético 0W-20 frasco 1 L",
    "Fluido de freio DOT 3 frasco 500 ml",
    "Fluido de freio DOT 4 frasco 500 ml",
    "Aditivo para radiador concentrado frasco 1 L",
    "Aditivo para radiador pronto uso frasco 1 L",
    "Água desmineralizada frasco 1 L",
    "Óleo para câmbio 75W-90 frasco 1 L",
    "Graxa multiuso pote 500 g",
  ],
  "unidade",
  "product",
  "Confira norma, especificação e aplicação do fabricante antes do uso.",
);
const parts = group(
  "pecas",
  [
    "Filtro de óleo motor",
    "Filtro de ar motor",
    "Filtro de combustível",
    "Filtro de cabine",
    "Pastilha de freio dianteira jogo",
    "Pastilha de freio traseira jogo",
    "Disco de freio dianteiro unidade",
    "Lona de freio traseira jogo",
    "Vela de ignição unidade",
    "Cabo de vela jogo",
    "Correia dentada unidade",
    "Kit correia dentada com tensor",
    "Correia de acessórios unidade",
    "Rolamento de roda dianteira",
    "Rolamento de roda traseira",
    "Amortecedor dianteiro unidade",
    "Amortecedor traseiro unidade",
    "Bieleta da suspensão unidade",
    "Bucha de bandeja unidade",
    "Pivô de suspensão unidade",
    "Terminal de direção unidade",
    "Kit embreagem",
    "Bomba de combustível",
    "Bomba d’água",
    "Válvula termostática",
    "Sensor de temperatura",
    "Sensor de rotação",
    "Bobina de ignição",
    "Palheta limpador par",
    "Lâmpada H4 12 V 60/55 W",
    "Lâmpada H7 12 V 55 W",
    "Fusível lâmina 10 A",
    "Fusível lâmina 15 A",
    "Fusível lâmina 20 A",
    "Bateria automotiva 12 V 60 Ah",
    "Pneu 175/65 R14",
    "Pneu 185/65 R15",
    "Pneu 205/55 R16",
  ],
  "unidade",
  "product",
  "Modelo genérico: informe marca, código e veículos compatíveis antes de ativar.",
);
const accessories = group("acessorios", [
  "Aromatizante automotivo unidade",
  "Shampoo automotivo frasco 500 ml",
  "Cera automotiva pote 200 g",
  "Silicone automotivo frasco 300 ml",
  "Pano microfibra unidade",
  "Cabo auxiliar de partida par",
  "Triângulo de segurança unidade",
  "Carregador veicular USB unidade",
]);
const tools = group("ferramentas", [
  "Chave de roda cruz",
  "Chave combinada 10 mm",
  "Chave combinada 13 mm",
  "Jogo de chaves Allen",
  "Alicate universal",
  "Chave de fenda",
  "Chave Phillips",
  "Macaco hidráulico 2 toneladas",
  "Fita isolante rolo 10 m",
  "Abraçadeira plástica pacote 100 unidades",
]);
const services = group(
  "mao_de_obra",
  [
    "Troca de óleo e filtro — mão de obra",
    "Troca de filtro de ar — mão de obra",
    "Troca de filtro de cabine — mão de obra",
    "Troca de pastilhas — mão de obra",
    "Troca de discos de freio — mão de obra",
    "Troca de correia dentada — mão de obra",
    "Troca de embreagem — mão de obra",
    "Troca de amortecedores — mão de obra",
    "Troca de velas — mão de obra",
    "Revisão preventiva — mão de obra",
    "Diagnóstico com scanner",
    "Alinhamento de direção",
    "Balanceamento por roda",
    "Rodízio de pneus",
    "Limpeza de bicos injetores",
    "Limpeza do sistema de arrefecimento",
    "Higienização do ar-condicionado",
    "Inspeção da suspensão",
    "Teste de bateria e alternador",
  ],
  "servico",
  "service",
  "Materiais e peças cobrados separadamente. Revise o escopo e preço do serviço.",
);
const general = group("mercadorias", [
  "Pilha alcalina AA pacote 2 unidades",
  "Pilha alcalina AAA pacote 2 unidades",
  "Lâmpada LED 9 W unidade",
  "Extensão elétrica 3 m",
  "Cabo USB-C 1 m",
  "Caderno universitário 96 folhas",
  "Caneta esferográfica azul unidade",
  "Lápis grafite unidade",
  "Borracha escolar unidade",
  "Fita adesiva rolo",
  "Cola branca frasco 90 g",
  "Envelope pardo unidade",
  "Sacola papel pequena unidade",
  "Sacola papel grande unidade",
]);
const catalogs = {
  bar_restaurante: [...beers, ...drinks, ...barFood, ...alcohol, ...sweets],
  pizzaria: [...pizza, ...drinks, ...beers, ...sweets],
  hamburgueria: [...burgers, ...barFood, ...drinks, ...beers, ...sweets],
  mercado: [
    ...groceries,
    ...weighed,
    ...hygiene,
    ...cleaning,
    ...drinks,
    ...beers,
    ...pizzaReady,
  ],
  autopecas: [...parts, ...oils, ...accessories, ...tools],
  oficina: [...services, ...parts, ...oils, ...tools],
  comercio: [...general, ...cleaning, ...hygiene],
};
module.exports = { entries, catalogs, normalize };
