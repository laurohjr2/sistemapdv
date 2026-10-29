# Mark 0.21.0 — Pizzas personalizadas nos combos

## Configurar

Ative **Pizzaria** e **Combos e adicionais** em Configurações. Cadastre o produto-base e configure tamanho, limite de sabores, sabores, bordas e adicionais no cardápio de Pizzaria.

Em **Combos e adicionais**, inclua o produto-base como componente e escolha o **Tamanho da pizza**. A quantidade determina quantas pizzas desse tamanho há em cada combo. Inclua os outros componentes, como refrigerante, e salve o preço fixo do conjunto. Produtos-base de pizza não são aceitos na lista de adicionais opcionais do combo: devem ter tamanho e montagem próprios na composição.

**Regra de preço:** o preço fixo do combo inclui todos os sabores disponíveis no tamanho escolhido. A regra maior sabor/média continua registrada na montagem e serve de referência para o rateio, mas não aumenta o preço fixo por escolher um sabor mais caro. Bordas recheadas e adicionais do cardápio da pizza são cobrados à parte, por pizza inteira. Adicionais opcionais do próprio combo continuam usando o preço de venda do respectivo produto.

Exemplo: pizza e refrigerante por R$ 55,00; borda de R$ 6,00; dois adicionais de R$ 2,50 e porção opcional de R$ 3,00. Total: **R$ 69,00 por combo**. Duas unidades custam R$ 138,00. Sem complementos, os sabores escolhidos ficam dentro dos R$ 55,00.

## Lançar

Em **Vendas**, **Mesas → Ver conta** ou **Comandas**, use **Selecionar combo**. Monte cada pizza apresentada pelo botão correspondente. O tamanho é fixado pelo cadastro; sabores respeitam seu limite, e borda/adicionais são opcionais. Todas as pizzas precisam estar montadas antes de adicionar o combo.

Confira a descrição de cada pizza e o total da prévia. Ao aumentar a quantidade de combos, cada montagem será repetida em todos eles. Para vender combos com escolhas diferentes entre si, lance grupos separados.

As observações do combo acompanham seus componentes. Componentes de pizza têm montagem própria e entram na cozinha com tamanho, sabores, borda e adicionais. A via de entrega vinculada à venda preserva essas descrições. A entrega continua vinculada a uma venda paga; não cria outra cobrança nem outra baixa de estoque.

## Estoque, histórico e segurança

- O preço é calculado no servidor, com rateio em centavos cuja soma confere com a oferta e os acréscimos. Os relatórios usam os componentes físicos, sem duplicar o faturamento com um produto virtual de combo.
- Produtos-base baixam seu estoque direto ou os ingredientes de sua ficha técnica. Esta entrega não cria automaticamente fichas técnicas específicas de cada sabor, borda ou adicional do cardápio; a regra de consumo segue a ficha técnica do produto-base, como nas pizzas avulsas.
- Falta de estoque/ingrediente em qualquer componente desfaz o grupo inteiro. O fechamento da comanda não baixa novamente o estoque.
- Em Comandas, use **Remover combo** para retirar o grupo inteiro e lançá-lo novamente. Não altere isoladamente quantidade ou produto de um componente. Ingredientes já consumidos não retornam automaticamente; a reposição exige a permissão e a confirmação existentes.
- O pedido preserva a montagem, a revisão do cardápio, a regra de preço e os valores usados no lançamento. Alterar depois sabores ou preço do combo não reescreve pedidos anteriores.
- Se cardápio, complemento ou composição mudarem antes de confirmar o pedido, o sistema pede nova conferência. A versão do cardápio é exigida para pizzas dentro de combos, mesmo quando o valor final permanece igual.
- Perfis restritos precisam de **Consultar combos** e **Consultar e montar pizzas**, além de vender ou editar a comanda. Cadastrar/alterar o combo exige a permissão de edição e o papel permitido. Suporte permanece somente leitura; clientes continuam isolados por empresa.

## Validação técnica

`scripts/pizza-bundles-smoke.cjs` cria empresas sintéticas e cobre preço, rateio, maior sabor/média, complementos, seleção obrigatória por posição, versões, sabor indisponível, preço alterado, estoque, ingredientes, rollback, cozinha, entrega/PDF, fechamento, histórico, isolamento e permissões. `scripts/pizza-bundles-browser.cjs` cobre cadastro, duas pizzas diferentes por combo, quantidade de combos, carrinho, cupom, cozinha, mesa/comanda e celular/modo escuro.

Fixtures privadas ficam em `work/mark22/`, ignoradas pelo Git. Esses scripts só podem ser usados no projeto descartável de testes, nunca em uma instalação de cliente.
