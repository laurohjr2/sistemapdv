# Mark 0.16.0 — Fidelidade de clientes

Menu **Fidelidade**, para gerente, administrador e Master, em todos os perfis de negócio. Suporte consulta sem alterar.

Selecione um cliente cadastrado, nomeie o benefício, informe percentual de 0 a 50% (duas casas), validade opcional e motivo. As alterações usam revisão entre terminais e mantêm histórico. Inativar a condição preserva benefícios anteriores. Cliente inativo não recebe benefício.

Em **Vendas → Carrinho**, selecione o cliente e clique **Aplicar desconto de fidelidade**, disponível à gerência. O botão substitui o desconto atual; não soma descontos. Ao mudar cliente ou itens/quantidades do carrinho, confira e aplique novamente. Alterar manualmente o desconto desfaz sua identificação como fidelidade.

O servidor calcula sobre os preços/quantidades reais da venda, arredonda para centavos e verifica a revisão/validade da condição. Se a condição ou valor mudar, a venda é recusada para nova conferência. Não confia no percentual enviado pelo navegador.

O cupom da última venda inclui desconto e nome/percentual do benefício. O histórico de fidelidade guarda a condição usada no ato, mesmo se ela mudar depois. Vendas canceladas permanecem identificadas e são excluídas do total efetivo; não são pontos ou créditos disponíveis para resgate. Há PDF do histórico, limitado aos 500 registros recentes, com filtro opcional por cliente.

Esta etapa aplica fidelidade nas **vendas diretas**. OS e orçamentos mantêm os valores aprovados; mesas/comandas continuam com o desconto autorizado já existente, sem aplicação automática desta condição. Não há cashback, pontos, comunicação externa ou autorização automática para operadores concederem desconto. A revisão geral de permissões permanece após as melhorias funcionais.

Validação sintética: 28 verificações aprovadas. `node scripts/loyalty-smoke.cjs`. Build e lint sem erros; avisos anteriores preservados.

A [Mark 0.20.0](../fidelidade/mesas-comandas.md) amplia o benefício para mesas e comandas; as limitações acima descrevem a entrega original da Mark 0.16.0.
