# Mercado — lotes e validade — Mark 0.7.0

Esta etapa acrescenta controle **opcional por produto** de lotes, vencimentos e saldos pendentes. Não muda automaticamente o estoque existente nem ativa o controle em produtos já cadastrados.

## Atualizar e habilitar

Na pasta da instalação Windows, fora do atendimento:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Pressione **Ctrl+Shift+R**. Confira Interface/Servidor **0.7.0** em Sobre o sistema. O perfil **Mercado** inclui **Mercado — lotes e validade**. Para usá-lo em restaurante, oficina ou outro perfil, ative essa opção em Configurações e salve, mantendo o perfil e os demais módulos atuais. Acesse **Lotes e validade**, em Cadastros e estoque.

A migração cria `stock_lots`, o indicador `products.lotTracked` e os campos `lotId`/`lotAllocations` em `stock_movements`, em todos os bancos de empresas registrados. O indicador inicia desativado para todos os produtos. Migrações repetidas preservam os dados. Produtos e serviços, aplicações de autopeças, ordens e movimentações anteriores continuam existentes.

## Começar com o saldo atual

1. Cadastre/ative o produto e confira seu estoque total em Produtos/Estoque.
2. Em **Lotes e validade → Controle por produto**, escolha o item e clique **Ativar controle**. Serviços não têm controle físico.
3. O saldo existente aparece como **Sem lote informado**, pendente de identificação. Nenhuma quantidade é adicionada ao estoque.
4. Clique **Identificar saldo**, informe a quantidade realmente conferida, número do lote, validade da embalagem e justificativa. É possível identificar parte do saldo por vez, em vários lotes.
5. A identificação transfere o saldo pendente para o lote identificado, mantendo o total. Lote e validade não são deduzidos das movimentações antigas, pois elas não comprovam o saldo físico remanescente de cada lote.

Para produtos perecíveis, informe a validade real da embalagem. Não ative o controle em produtos sem processo de conferência de lote/validade. Os produtos sem controle continuam com as regras anteriores.

## Novas entradas e compras

Em **Estoque → Adicionar estoque**, selecione o produto controlado e preencha **Lote** e **Data de validade** juntos. Uma entrada válida aumenta o estoque total e o saldo daquele lote na mesma transação.

- O mesmo número de lote de um produto pode receber novas quantidades somente com a mesma validade. Outra validade é bloqueada para evitar misturar identificações.
- Uma entrada sem os dois campos fica pendente. Preencher apenas um deles é inválido.
- Recebimentos em **Compras** continuam criando estoque e financeiro uma única vez. Como o recebimento atual não pede lote, o saldo entra pendente e deve ser identificado em **Lotes e validade** após conferir a entrega. Não registre uma segunda entrada de estoque para essa identificação.
- Ajustes positivos de inventário também ficam pendentes; identifique após a conferência.
- Uma validade já vencida pode ser cadastrada para registrar o saldo físico existente, mas esse lote não pode ser vendido.

## Baixa nas vendas e nos atendimentos

Nas saídas com motivo de venda, o sistema separa contabilmente primeiro os lotes identificados com vencimento mais próximo (**FEFO**). Em empate, usa a ordem de entrada. **O operador precisa separar fisicamente os mesmos lotes na prateleira.** Não há leitura automática do lote da embalagem.

Só são vendidos saldos identificados cuja validade seja igual ou posterior ao dia atual, no horário de Brasília. Saldos vencidos, sem identificação e devoluções pendentes ficam indisponíveis para venda. O lote válido até hoje continua disponível durante esse dia.

O estoque total mostrado em Produtos inclui esses saldos físicos bloqueados. Na tela de Vendas, o cartão do produto controlado informa separadamente o saldo disponível por lotes e o estoque físico; a inclusão no carrinho usa o saldo disponível. Por isso uma venda pode ser recusada apesar de haver estoque total positivo: é necessário conferir os lotes disponíveis. A mensagem identifica o produto afetado; a transação inteira é desfeita, sem pagamento ou baixa parcial.

A mesma regra participa de vendas comuns, conversões de orçamento, fechamento de OS, tickets e inclusão/aumento de quantidade em comandas. Serviços continuam sem movimentação de estoque. O momento da baixa de cada fluxo segue sua regra anterior: comanda na inclusão do item; OS no recebimento; venda/ticket na emissão. Não há segunda baixa no encerramento de uma comanda já movimentada.

## Cancelamentos e devoluções

Cancelamentos de venda/ticket/comanda e redução/remoção de item de comanda devolvem o saldo ao estoque total, mas deixam a quantidade em **Devolução para conferência**. O sistema não presume que a embalagem devolvida é a mesma, nem que continua adequada para venda.

Confira fisicamente. Para liberar, use **Identificar saldo** com lote/validade reais e justificativa. Para uma embalagem danificada ou imprópria, registre baixa. A conferência não apaga as alocações da saída original.

## Vencidos, perdas, ajustes e relatórios

A tela mostra lotes com saldo positivo, marcando **Vencido**, **Vence em até 30 dias**, **Identificação pendente** ou **Válido**. Os indicadores contam lotes, não unidades. É possível filtrar por produto/lote e situação. Produtos inativos com saldo continuam visíveis para conferência.

**Registrar baixa** exige quantidade e justificativa, retira o saldo do lote selecionado e do estoque total na mesma transação e gera movimentação de vencimento/perda. Uma tela antiga não pode repetir a baixa depois que o saldo mudou: atualize os dados antes de prosseguir.

Retiradas e ajustes negativos no menu Estoque também reduzem os lotes, começando pelos vencimentos mais próximos, incluindo vencidos. Para escolher o lote físico exato de um descarte, prefira **Registrar baixa** na tela de lotes. Ajustes genéricos de total não identificam sozinhos a embalagem retirada.

**Imprimir / PDF** gera relatório geral de todos os lotes com saldo positivo da empresa, com produto, lote, validade, saldo e situação. O relatório geral não aplica os filtros locais da tela. A impressora física depende do leitor de PDF e da configuração local.

É possível desativar o controle de um produto somente com estoque total zerado. O histórico permanece. Para ocultar o módulo em Configurações, primeiro desative o controle de todos os produtos, após zerar seus saldos de forma conferida.

## Permissões e rastreabilidade

Administradores, gerentes e Master ativam/desativam controles, identificam saldos e registram baixas. Atendentes e suporte de consulta apenas consultam/geram o relatório. Dados de uma empresa não são acessíveis em outra.

Movimentações novas de produtos controlados guardam `lotAllocations`, com IDs e quantidades dos lotes utilizados. Identificações, baixas e alterações do controle são registradas na auditoria. A identificação não gera uma entrada/saída financeira ou de estoque total. Quantidades usam precisão de até três casas decimais.

## Próximas etapas de Mercado

Esta entrega é de lotes e validade. Balanças, etiquetas com peso/preço embutido, impressão de etiquetas de gôndola, integração fiscal, rastreamento de recall e bloqueio por inspeção sanitária específica terão etapas próprias. Não inclui importação automática de lotes da nota do fornecedor, sensores, envio de avisos externos ou conferência física automática. O relatório e as marcações de vencimento são calculados ao consultar a tela; use **Atualizar** após alterações em outro terminal.

## Validação da entrega

Validado no Docker/PostgreSQL e Chromium, em 27/10/2026:

- 50 verificações HTTP: ativação com saldo legado, identificação parcial, prioridade por vencimento (FEFO), bloqueio de vencidos e pendentes, saldo vendável separado do físico, devoluções para conferência, entradas incompletas/inválidas, baixas concorrentes, revisões, descarte, PDF e duas empresas isoladas.
- 40 verificações de integração: tickets, inclusão/aumento/remoção de item e cancelamento de comanda, quantidades fracionadas, inventário e recebimento de compra idempotente. A soma dos lotes foi comparada ao estoque total em cada etapa.
- 7 verificações no navegador: ativação, identificação, baixa, PDF, celular, disponibilidade em Vendas e consulta sem permissão de alteração; sem erros JavaScript.
- Regressões: 119 verificações comerciais, 109 da pizzaria, 94 da oficina e 20 verificações do navegador da pizzaria aprovadas.
- 5 verificações de persistência após recriar containers e reexecutar migrações; lotes, pendências, preços e disponibilidade preservados.
- 3 verificações de versão/cache, builds Docker e lint sem erros, com os 12 avisos anteriores do projeto.

Reprodução apenas no projeto descartável `pdv-commerce-test`: `node scripts/market-smoke.cjs`, `node scripts/market-flows.cjs`, `node scripts/market-browser.cjs` e `node scripts/market-persistence.cjs`. Usam empresas sintéticas; o navegador requer Playwright em `work/browser/node_modules/playwright` e Chromium em `/usr/bin/chromium`. O último teste recria os containers descartáveis, preservando volumes. A impressão física no Windows não foi executada neste ambiente.
