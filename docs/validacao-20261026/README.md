# Correções e validação — 26/10/2026

As falhas reproduzidas na [auditoria anterior](../auditoria/README.md) foram corrigidas e os cenários executados passaram. Isso aprova os fluxos descritos abaixo no ambiente de desenvolvimento; não é uma certificação de todos os equipamentos, configurações e combinações de uso.

## Resultados executados

| Verificação | Resultado |
| --- | --- |
| Auditoria ampliada da API | 51 aprovadas, nenhuma falha |
| Integridade e concorrência | 42 verificações HTTP aprovadas |
| Fluxo geral | 29 verificações HTTP aprovadas |
| Fila → mesa → comanda | 37 verificações HTTP aprovadas |
| Configurações, validações, permissões e PDF | 27 verificações HTTP aprovadas |
| Navegação nas 12 páginas | Sem exceções JavaScript ou chamadas de API com erro; criação de usuário pelo formulário retornou 201 |
| Navegador: fila/comanda | Login, cadastro, acomodação, inclusão de produto, pagamento manual, mesa livre e viewport móvel aprovados |
| Navegador: operações | Cadastro pelo Estoque, entrada, saldo em Produtos, cozinha até entrega, downloads PDF/CSV e PDF de teste aprovados |
| Navegador: configurações | Cadastro, upload, persistência após reload, logo, remoção e viewport móvel aprovados |
| Compilação do frontend | Aprovada; aviso de tamanho do bundle permanece |
| ESLint | Sem erros; 11 avisos de organização de exports/hooks permanecem |

Os testes foram executados contra bancos PostgreSQL exclusivos com dados fictícios, incluindo `pdv_releasecheck_20261026`. Não foram realizados pagamentos bancários: as formas de pagamento são registros operacionais do PDV.

[Evidência da API](api-resultados.json) · [Evidência do navegador](browser-resultados.json) · [Integridade](integridade-console.txt) · [Fluxos](fluxos-console.txt) · [Operações no navegador](operacoes-browser-console.txt) · [Build](build.txt) · [Lint](lint.txt)

## O que foi corrigido

- **Vendas e caixa:** conversão de valores DECIMAL na interface; conciliação de balcão, comandas e tickets; separação do dinheiro contado em gaveta de PIX/cartões; prevenção de abertura duplicada e de estorno retroativo em caixa fechado.
- **Mesas e comandas:** mesmo fechamento para as duas telas; marcação de pagamento; associação ao caixa do recebimento; comprovante devolvido à tela de Mesas; alteração de quantidade com estoque/total na mesma transação; cancelamento único, inclusive concorrente; recebimento posterior de conta pendente no novo caixa.
- **Estoque e produtos:** resumo e valorização corrigidos; preço/custo e unidades do formulário alinhados à API; custo zero aceito; saldo correto no cadastro; operações transacionais para entrada/saída/acerto; validação de quantidades e unidades; código de barras vazio armazenado como ausente.
- **Usuários:** renderização, criação e troca de senha; e-mail/status persistidos; usuário desativado não faz novo login nem continua usando token antigo; exclusão lógica preserva vínculos históricos; atualização de senha não grava a senha/hash no registro de auditoria.
- **Cozinha:** associação do usuário de entrega, consultas, resumo, filtros e acompanhamento de preparo; comandas encerradas deixam a fila ativa.
- **Relatórios:** rotas/formatos alinhados ao frontend; receitas de balcão/comandas/tickets consolidadas por uma mesma fonte; agrupamento diário/semanal/mensal; categorias, produtos, pagamentos, horários e estoque; exportações reais em CSV/PDF. Percentuais de crescimento sem cálculo não são apresentados como se fossem resultados reais.
- **Impressão:** página renderiza, filtro funciona e há um PDF de teste. Comprovantes continuam usando os dados cadastrados da empresa. Gerar um PDF não significa confirmar impressão física.
- **Navegação:** Produtos e Impressão agora têm acesso no menu. Configurações e fila permanecem funcionais.

## Exemplos financeiros verificados

1. Na auditoria, comanda alterada para R$ 30 + venda de balcão de R$ 10 + ticket em dinheiro de R$ 10 totalizaram **R$ 50**. Com fundo de R$ 100, somente os R$ 10 em dinheiro foram somados à gaveta: **R$ 110 esperados**, diferença zero.
2. No teste de integridade, venda PIX de R$ 10 + comanda em dinheiro de R$ 20 com desconto de R$ 5 + ticket no débito de R$ 10 totalizaram **R$ 35**. Com fundo zero, o dinheiro esperado foi **R$ 15**, sem incluir os R$ 20 recebidos eletronicamente.
3. Uma comanda fechada pendente foi recebida no caixa seguinte, no valor de **R$ 10**, sem entrar no caixa anterior.
4. Duas saídas simultâneas disputando uma unidade aceitaram somente uma operação. Dois cancelamentos da mesma comanda devolveram o estoque uma única vez.

A auditoria passou de 50 a 51 casos porque foi acrescentada a proteção contra estorno em caixa fechado. Foram atualizados os contratos testados para as correções reais: o frontend usa `currentStock`, `costPrice`/`salePrice` e unidades válidas; tickets emitidos com pagamento entram nos totais; alterações de quantidade mudam o valor da comanda. Esses casos também foram exercitados no navegador, sem substituir operações por respostas simuladas.

## Imagens reais atualizadas

Todas as capturas abaixo usam dados fictícios.

- [Dashboard](telas/Dashboard.png)
- [Vendas e caixa](telas/Vendas.png)
- [Mesas](telas/Mesas.png)
- [Estoque](telas/Estoque.png)
- [Comandas](telas/Comandas.png)
- [Cozinha](telas/Cozinha.png)
- [Fila](telas/Fila.png)
- [Relatórios](telas/Relatorios.png)
- [Relatórios após o fluxo completo](relatorios-fluxo.png)
- [Configurações](telas/Configuracoes.png)
- [Usuários](telas/Usuarios.png)
- [Produtos](telas/Produtos.png)
- [Impressão](telas/Impressao.png)

## Como repetir

Leia [DEVELOPMENT.md](../../DEVELOPMENT.md). `scripts/init-dev.cjs` e a inicialização do servidor aplicam a migração aditiva `auditFixes.js`: novas colunas de usuários e vínculo financeiro de tickets. Não há reset/force do banco. O cadastro local anterior foi preservado; existe backup local anterior às migrações em `.pdv-local/before-audit-fixes.sql` (fora do Git).

Para repetir a auditoria de totais, use banco novo e isolado, caixa inicialmente fechado. Os outros testes mantêm dados fictícios. Exemplo de comandos com a API e o frontend já ligados ao banco isolado:

```bash
PDV_API_URL=http://127.0.0.1:5184/api node --env-file=.pdv-local/development.env scripts/audit-api.mjs
PDV_API_URL=http://127.0.0.1:5184/api node --env-file=.pdv-local/development.env scripts/integrity-smoke.mjs
PDV_API_URL=http://127.0.0.1:5184/api node --env-file=.pdv-local/development.env scripts/smoke.mjs
PDV_API_URL=http://127.0.0.1:5184/api node --env-file=.pdv-local/development.env scripts/seating-smoke.mjs
PDV_API_URL=http://127.0.0.1:5184/api node --env-file=.pdv-local/development.env scripts/settings-smoke.mjs
NODE_PATH=/tmp/pdv-browser/node_modules PDV_WEB_URL=http://127.0.0.1:5184 node scripts/audit-browser.cjs
NODE_PATH=/tmp/pdv-browser/node_modules PDV_WEB_URL=http://127.0.0.1:5184 node scripts/operations-browser.cjs
```

## Limites que permanecem

- Selecionar e imprimir diretamente em uma impressora instalada no Windows depende do conector, ainda não implementado. O teste atual gera PDF para abrir e selecionar a impressora pelo diálogo do sistema.
- Não foram testadas impressoras físicas, emissão fiscal ou integração bancária.
- Assinaturas, bloqueio de inadimplentes, usuário master de suporte e isolamento entre empresas continuam sendo funcionalidades futuras. O cadastro de Configurações é por instalação.
- Registros legados sem associação a caixa não são vinculados retroativamente de forma automática. Devem passar por conferência antes de migrar dados reais.
- O código está em branch de desenvolvimento. Publicação em produção, teste em Windows e piloto operacional ainda precisam ocorrer.
