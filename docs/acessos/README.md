# Perfis e permissões — Marks 0.18.0 e 0.19.0

Continuidade autorizada pelo proprietário em 29/10/2026, para validação no dia 30/10 às 09:00 (horário de São Paulo). A autorização atual permite implementar a matriz e as configurações; substitui a espera registrada no planejamento anterior. Não remapear funcionários automaticamente.

## Matriz e consulta

**Acessos e permissões** é exclusivo de administrador da empresa e Master. Lista limites por papel, perfis operacionais disponíveis e acesso de cada usuário. **Meus acessos** permite ao próprio funcionário consultar seu modelo de acesso.

Contas existentes continuam no modelo atual de papel. Operador/atendimento corresponde ao papel existente `garcom`; gerente e administrador mantêm seus limites. Perfis são restrições adicionais dentro do papel, não promoção de função. Estoque e consulta gerencial exigem papel Gerente; descontos continuam exclusivos de Gerente/Administrador. Administradores da empresa têm controle da própria empresa; Master é separado e tem acesso total à empresa selecionada. Suporte continua somente consulta, com sessão válida e revogável.

A matriz inclui caixa, vendas, descontos, mesas/comandas, cozinha, clientes, produtos/custos, estoque, relatórios/ranking, compras/financeiro, oficina/evidências, agenda/garantia, alimentação, entregas, fidelidade e configurações. Uma permissão não ativa módulo, cria saldo, dispensa aprovação, torna um usuário responsável de outra OS ou muda pagamentos automaticamente.

Os perfis sugeridos são opções para configuração pelo administrador: Caixa, Atendimento, Cozinha, Mecânico responsável, Estoque, Gerência, Consulta gerencial e Sem acesso operacional.

Fonte da matriz: `bar-management-system/src/config/accessCatalog.js`. Teste puro: `node scripts/access-catalog-test.cjs`.

Configuração, efeito e restauração: [guia da Mark 0.19.0](configuracao.md).
