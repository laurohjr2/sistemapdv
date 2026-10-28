# Mark 0.9.0 — Fichas técnicas e ingredientes

## Onde encontrar

**Cadastros e estoque → Fichas técnicas**, para gerente/administrador e Master. O módulo é sugerido nos perfis Bar/restaurante, Pizzaria e Hamburgueria. Em instalações existentes, confira **Configurações → Perfil do negócio e módulos → Alimentação — fichas técnicas e ingredientes**. Nenhum cadastro é convertido automaticamente.

1. Cadastre os insumos em **Produtos e serviços**, com a unidade física de consumo, custo e estoque real. Exemplo: carne em **kg**, pão em **unidade**. O sistema não converte kg em gramas ou litro em ml; 150 g devem ser informados como **0,150 kg**.
2. Cadastre o produto pronto com preço de venda e estoque físico **zero**.
3. Em **Fichas técnicas**, selecione o produto, informe rendimento, ingredientes e quantidades para esse rendimento. Ative e salve.
4. Exemplo: rendimento **10 unidades**, carne **1 kg** e pão **10 unidades**. A venda de dois lanches baixa **0,200 kg** de carne e **2 pães**.
5. Venda pelo balcão ou adicione à mesa/comanda. A cozinha recebe os preparados; no balcão, o número da venda identifica o pedido.

## Estoque e histórico

- A disponibilidade do preparado é calculada pelos ingredientes. O produto pronto mantém estoque físico zero e não integra os alertas/relatórios de estoque físico; acompanhe os insumos.
- Quantidades aceitam três casas decimais. Consumo proporcional é arredondado **para cima** até 0,001 da unidade física, para não liberar porções sem baixa. Exemplo: 1 kg para três porções consome 0,334 kg ao vender uma porção.
- Vendas, comandas e tickets baixam ingredientes na emissão/inclusão. Fechar a comanda ou retirar o ticket não baixa novamente.
- Toda operação guarda a revisão, composição e consumo usados. Alterar uma ficha não muda itens já lançados. Aumentos na quantidade de um item existente da comanda usam sua composição original; um novo item usa a ficha vigente.
- Insumos com lote usam FEFO e somente saldo identificado dentro da validade. O módulo de lotes precisa ser habilitado para cadastrar/conferir esses lotes.
- Receita aninhada não é permitida: um insumo precisa ser produto físico, ativo, sem sua própria ficha ativa. Serviços não são insumos.
- Não se pode receber/comprar estoque do item pronto enquanto a ficha estiver ativa. Movimente os ingredientes. Finalize atendimentos pendentes antes de mudar o tipo de controle.
- A unidade de um produto referenciado em ficha deve ser preservada. Para outra unidade, cadastre outro insumo e revise a receita.

## Cancelamento e perdas

Cancelar uma cobrança, remover um preparado ou reduzir sua quantidade **mantém o consumo dos ingredientes**, com registro na auditoria. A comida pode já ter sido preparada; estornar dinheiro não comprova que a matéria-prima está disponível.

Nas vendas e reduções/remoções da comanda, gerente/administrador pode confirmar que os ingredientes **não foram usados** e solicitar reposição. O servidor utiliza o consumo original, nunca uma ficha nova ou quantidades fornecidas pelo navegador. Reposição de ingredientes com lote entra como **devolução pendente**, exigindo conferência em Lotes e validade. O endpoint de cancelamento de comanda/ticket também aceita `restoreIngredients: true` apenas nos fluxos já restritos a gerente/administrador. O padrão é sempre manter o consumo.

## Limites desta entrega

Ficha por produto preparado. Na pizzaria, pode ser configurada no produto-base de cada tamanho; variações automáticas por sabor, borda e adicional são uma etapa posterior. Não distribui automaticamente queijo/cobertura entre sabores. Ainda não controla produção antecipada de semielaborados, embalagens ou rendimento real de um lote de produção.

O custo mostrado é uma estimativa pelos custos cadastrais dos insumos. Não representa margem líquida nem inclui mão de obra, despesas, perdas ou tributos. O preço de venda permanece definido pelo estabelecimento.

## Validação

Executar somente em empresas sintéticas do projeto Docker descartável `pdv-*-test`:

```bash
PDV_RECIPE_BROWSER_FIXTURE=work/recipes/fixture.json node scripts/recipes-smoke.cjs
node scripts/recipes-browser.cjs
```

O arquivo temporário de fixture contém credenciais sintéticas; é ignorado pelo Git e não deve ser compartilhado. Os testes verificam transações, disponibilidade, snapshots, FEFO, reposição explícita, permissões, isolamento e concorrência. As suítes comerciais, pizzaria, oficina, lotes e etiquetas também devem passar.

Resultado desta entrega: 104 verificações HTTP de fichas técnicas, seis verificações de navegador e sete de persistência aprovadas. Regressões aprovadas: 119 comerciais, 109 pizzaria, 94 oficina, 50 lotes, 70 etiquetas e 20 de navegador da pizzaria. Build e verificação de versão aprovados; lint sem erros, com 12 avisos preexistentes.
