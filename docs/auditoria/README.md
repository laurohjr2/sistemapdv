# Auditoria funcional do PDV — 25/10/2026

**Resultado: o sistema ainda não está pronto para operação real.** Existem fluxos funcionais, mas a auditoria ampliada encontrou falhas de interface, integração e consolidação financeira que impedem aprovar todos os menus.

Código avaliado: `a2025f4`. Nenhum código da aplicação foi alterado nesta auditoria. Os resultados abaixo são evidências da versão avaliada, não de correções posteriores.

## Ambiente e cobertura

- Banco PostgreSQL separado: `pdv_audit_20261025`, com dados fictícios. As vendas e cadastros existentes no banco de desenvolvimento não foram usados na auditoria.
- Interface React/Vite e API Node.js executadas no Linux; Chromium em viewport de computador e verificações móveis nos fluxos específicos.
- Compilação de produção: **aprovada**, com aviso de tamanho do bundle.
- Análise estática (`npm run lint`): **reprovada**, com 11 erros e 15 avisos. [Saída do lint](lint.txt).
- Auditoria ampliada da API: **50 verificações, 30 aprovadas e 20 reprovadas**. Casos relacionados à mesma causa podem produzir mais de uma reprovação. [Resultados completos](api-resultados.json).
- Testes específicos repetidos: fluxo geral **29 verificações HTTP aprovadas**; fila/mesa/comanda **36 aprovadas**; configurações/PDF/permissões **27 aprovadas**.
- Navegador: visita às 12 páginas existentes, capturando erros JavaScript, respostas de API e imagens. [Resultados completos](browser-resultados.json).
- Dois fluxos de navegador aprovados: fila → mesa → comanda → produto → pagamento manual → liberação da mesa; configurações → upload de logo → gravação → recarregamento → remoção, com verificação de layout móvel.

Os resultados não significam cobertura de todas as combinações de entrada, hardware, navegadores ou concorrência de todos os módulos. Acesso a uma tela, porta aberta ou HTTP 200 isolados não foram considerados prova de funcionamento integral.

## Resultado por menu

| Menu/página | Situação | Evidência principal |
| --- | --- | --- |
| Dashboard | Parcial | Abre sem erro. Consolidação de receitas de balcão e comandas não está unificada; o painel consulta comandas. |
| Vendas / caixa | Reprovado | API registra venda e estorno, mas a tela fica em branco com caixa aberto: `cashRegister.opening_amount?.toFixed is not a function`. Fechamento omite comandas. |
| Mesas | Parcial | Abrir, ocupar e liberar mesa funcionam. Fechar pelo endpoint específico de mesas deixa `paymentStatus` como `pendente`, mesmo informando PIX. |
| Comandas | Parcial | Abrir, lançar produto e fechar pela rota da comanda funcionam. A alteração de quantidade na tela chama PUT de item inexistente e recebe 404. |
| Estoque | Reprovado na interface | Entrada, saída e acerto passam pela API. `/stock/summary` devolve 500, bloqueando o carregamento integrado. Cadastro de produto nessa tela envia `price`, mas a API exige `costPrice`/`salePrice`. |
| Cozinha | Reprovado | Listagem e resumo retornam 500. Foi possível iniciar preparo pela API, mas o painel não permite acompanhar corretamente a fila. |
| Fila de espera | Aprovado nos cenários executados | Cadastro, capacidade, acomodação, vínculos, histórico e disputas simultâneas passam. Não inclui chamada por WhatsApp/SMS. |
| Relatórios | Reprovado na interface | A tela chama `/reports/categories`, `/payments` e `/hourly`, inexistentes. Exportações `/reports/export/pdf` e `/csv` também retornam 404. Algumas rotas individuais funcionam; `/sales-by-category` retorna 500. |
| Configurações | Aprovado nos cenários executados | Cadastro, validações, logo, persistência, cabeçalho, PDF e restrições de edição passam. É por instalação; não há isolamento SaaS entre empresas. |
| Usuários | Reprovado | A tela quebra com `React is not defined`. Cadastro e troca de senha usam rotas inexistentes. Desativação não impede login. |
| Produtos (rota `/products`) | Parcial | Consulta e edição pela API funcionam. Tela usa `stock_quantity`, inexistente, e mostra saldo zero. Cadastro rejeita custo zero, embora o formulário/modelo o aceitem. Não há link próprio no menu lateral. |
| Impressão (rota `/print`) | Reprovado na interface | A tela quebra porque um SelectItem usa valor vazio. PDF de comanda foi aprovado no teste específico. A rota `/printer/test` não está registrada. Não há link próprio no menu lateral. |

## Defeitos que impedem a liberação

1. **Fechamento de caixa não consolida comandas.** Em banco isolado, uma venda de balcão de R$ 10 e uma comanda paga de R$ 20 produziram `total_sales = 10`, em vez de R$ 30. A rotina soma somente `Sale`, enquanto as comandas ficam em outra tabela e não recebem associação consistente ao caixa.
2. **Saldo físico e meios de pagamento precisam de conciliação.** A fórmula atual soma todas as vendas ao fundo de caixa, sem separar PIX/cartão de dinheiro. Isto foi identificado no código; a auditoria não executou uma conciliação completa de todos os meios.
3. **Vendas quebra ao exibir o caixa aberto.** Valores DECIMAL chegam como texto; a tela chama `.toFixed()` diretamente. Venda pela API aprovada não prova que o balcão funciona pela interface.
4. **Usuários não funciona como painel administrativo.** Falta importação de React para `React.Fragment`; POST `/users` e PUT `/users/:id/password` não existem. A API de autenticação cria usuários, mas não é a rota chamada pelo formulário. O modelo/controlador não implementa a propriedade `active`, e o teste confirmou login após enviar `active:false`.
5. **Estoque não carrega o resumo.** A consulta de valor usa `currentStock`/`costPrice` como nomes SQL, enquanto as colunas físicas são `current_stock`/`cost_price`. A tela depende desse resumo em um Promise.all.
6. **Cozinha apresenta erros de consulta/associação.** A listagem inclui `deliveredByUser`, sem associação correspondente no índice dos modelos. Listagem e resumo falham com 500.
7. **Relatórios e exportações estão desalinhados entre frontend e backend.** Alguns nomes de rota e formatos não coincidem. O simples retorno de um relatório individual não valida a tela nem a soma de todas as origens de venda.
8. **Tickets não aceitam a sessão normal.** A rota usa outro middleware, com `ACCESS_TOKEN_SECRET`, enquanto o login emite JWT com `JWT_SECRET`. A emissão com token válido de administrador retorna 403. Outros problemas de campos no controller foram observados no código, mas os passos posteriores à autenticação ficaram bloqueados e não foram executados.
9. **Pagamento pelo menu Mesas fica pendente.** A rotina alternativa de fechamento não grava o estado de pagamento como a rotina de Comandas.
10. **Alterar quantidade de item não possui endpoint.** A interface usa PUT, mas a API só oferece inclusão e remoção de item.
11. **Página de impressão não renderiza.** O seletor possui uma opção com `value=""`, não aceita pelo componente usado.

## Imagens reais da versão avaliada

As capturas usam apenas dados fictícios. Telas em branco são evidência de falha de renderização, não arquivos faltando.

- [Dashboard](telas/Dashboard.png)
- [Vendas — erro de renderização](telas/Vendas.png)
- [Mesas](telas/Mesas.png)
- [Estoque — falha no carregamento](telas/Estoque.png)
- [Comandas](telas/Comandas.png)
- [Cozinha — falha na listagem](telas/Cozinha.png)
- [Fila de espera](telas/Fila.png)
- [Relatórios — falha nas consultas](telas/Relatorios.png)
- [Configurações](telas/Configuracoes.png)
- [Usuários — erro de renderização](telas/Usuarios.png)
- [Produtos](telas/Produtos.png)
- [Impressão — erro de renderização](telas/Impressao.png)
- [Configurações preenchidas com dados de demonstração](../images/configuracoes.png)

## Repetição dos testes

Os scripts `scripts/audit-api.mjs` e `scripts/audit-browser.cjs` registram reprovações e terminam com status diferente de zero quando encontram falhas. O teste de API foi executado com caixa inicialmente fechado, em banco exclusivo; precisa de um banco novo para repetir a mesma expectativa de totais. Não execute esses testes contra dados reais.

Exemplo de execução após criar um banco exclusivo e inicializar modelos/admin com `scripts/init-dev.cjs`, fornecendo `DB_NAME` no processo:

```bash
# API desse banco executada com DB_NAME=<banco-exclusivo> e PORT=3600.
# Vite executado com PDV_API_TARGET=http://127.0.0.1:3600 na porta 5179.
PDV_API_URL=http://127.0.0.1:5179/api node --env-file=.pdv-local/development.env scripts/audit-api.mjs
NODE_PATH=/tmp/pdv-browser/node_modules PDV_WEB_URL=http://127.0.0.1:5179 node scripts/audit-browser.cjs
```

A auditoria inicial foi complementada com três verificações (formulário de estoque, desativação de usuário e campo de saldo usado em Produtos) e corrigiu um caso de relatório comparativo para fornecer os períodos obrigatórios. O comparativo respondeu corretamente com esses parâmetros; a falta deles não foi classificada como defeito.

## Fora da validação e pendências de produto

- Impressoras físicas e seleção de impressoras instaladas no Windows: o conector ainda não foi implementado. O ambiente atual é Linux.
- Emissão fiscal e integração real com adquirente, PIX ou serviço de cobrança: pagamento foi apenas registrado no sistema.
- Assinaturas, bloqueio de inadimplentes, acesso master de suporte e isolamento entre empresas: ainda não implementados.
- Dockerfiles e seed legados não foram usados como caminho de instalação e não foram certificados.

A próxima etapa recomendada é corrigir caixa/vendas, usuários, estoque, cozinha e relatórios, e só então repetir a auditoria antes de um piloto no estabelecimento.
