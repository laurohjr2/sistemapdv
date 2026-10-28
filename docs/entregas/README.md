# Mark 0.10.0 — Pedidos de entrega

## Local e configuração

**Atendimento → Pedidos de entrega**, disponível a atendente, gerente/administrador e Master. O suporte mantém acesso de consulta. Habilite **Configurações → Perfil do negócio e módulos → Pedidos de entrega** na empresa de demonstração se ainda não aparecer. O módulo é sugerido nos perfis Bar/restaurante, Pizzaria e Hamburgueria e pode ser habilitado em outros segmentos.

## Criar um pedido

1. Registre a venda e o pagamento normalmente em **Vendas**. Caso cobre entrega, inclua na venda um **serviço** cadastrado para a taxa, com seu preço, antes de receber. O pedido de entrega não calcula frete nem acrescenta cobranças.
2. No histórico de Vendas, clique **Entrega**, ou acesse **Pedidos de entrega → Novo pedido de entrega**.
3. Informe o número da venda e clique **Conferir venda**. A venda deve estar concluída, pertencer à mesma empresa e não ter outro pedido de entrega. Tickets de retirada não podem ser convertidos em entrega.
4. Confira destinatário, telefone e endereço completo. A venda mantém o cliente cadastrado originalmente vinculado, quando houver; o destinatário pode ser outra pessoa. O contato pode ser preenchido a partir do cadastro, mas o endereço exige conferência manual.
5. Salve. O pedido guarda cópia dos itens, descrições, quantidades, total registrado, contato e endereço. Alterar depois o cadastro do produto não muda essa cópia. Não há nova baixa de estoque ou lançamento financeiro.

## Etapas e cozinha

**Recebido → Em separação/preparo → Pronto → Saiu para entrega → Entregue.**

- A cozinha ativa deve marcar todos os itens preparados como prontos antes de liberar a saída. Pizzas e fichas técnicas usam os estados já existentes na Cozinha.
- Quando a cozinha estiver desativada, o operador confirma o preparo manualmente pela etapa **Marcar pronto**. Essa confirmação fica no histórico do pedido.
- Ao registrar a saída, informe o nome do entregador/transportador responsável. Pode ser um funcionário ou transportador externo; o usuário que registra a ação sempre é uma conta autenticada do sistema.
- A saída retira da fila da cozinha os itens que já estavam prontos. Não há baixa adicional de ingredientes/produtos.
- Confirme **Entregue** após o retorno da informação da entrega. É um controle interno manual; não equivale a rastreamento externo ou assinatura de recebimento.
- Contato/endereço podem ser corrigidos antes da saída. O histórico preserva os valores anteriores e o usuário/data da alteração. Alterações simultâneas de terminais são recusadas pela revisão do pedido.

## Cancelamentos

**Cancelar apenas a entrega**, disponível a gerente/administrador, exige motivo e mantém a venda paga e o estoque baixado — por exemplo, quando o cliente passa a retirar no balcão. A tela explica essa diferença antes da ação.

**Cancelar a venda**, no menu Vendas, estorna conforme as regras existentes do caixa e também cancela a entrega vinculada que ainda não saiu. Ingredientes seguem as regras de reposição explícita das fichas técnicas.

Depois da saída/entrega, esse estorno automático é bloqueado. É preciso conferir a devolução física e a situação financeira com a administração; esta versão não implementa um processo separado de devolução pós-entrega. O pedido não pode voltar de entregue para preparo para contornar a regra.

Não se pode ocultar o módulo com entregas em andamento. Pedidos concluídos/cancelados e seu histórico ficam preservados.

## Impressão e limites

Em **Ver pedido → Imprimir pedido de entrega**, gere um PDF com destinatário, telefone, endereço, itens, observações e valor da venda. Não cobre novamente. O documento é de separação/entrega, **sem valor fiscal**. Uma venda cancelada é identificada na tela e no PDF.

A tela apresenta os 200 pedidos mais recentes e filtros locais por situação, cliente, telefone, venda e entregador. Não há envio de WhatsApp, CEP automático, mapas, roteirização, aplicativo do motoboy, integração com marketplace, pagamento na entrega ou confirmação bancária automática nesta versão.

## Validação sintética

```bash
PDV_DELIVERY_BROWSER_FIXTURE=work/delivery/fixture.json node scripts/delivery-smoke.cjs
node scripts/delivery-browser.cjs
node scripts/delivery-persistence.cjs
node scripts/delivery-cash-close.cjs
```

Somente em projeto Docker descartável `pdv-*-test`. Fixtures em `work/` têm credenciais sintéticas e são ignoradas pelo Git. Os testes cobrem idempotência por venda, cancelamento financeiro versus logístico, cozinha ativa/inativa, disputas entre saída e estorno, estoque único, PDF, isolamento e perfis atuais.

Resultados desta entrega: 95 verificações HTTP de entregas, 17 adicionais de tickets/fechamento de caixa, cinco de navegador e sete de persistência aprovadas. Regressões aprovadas: 104 fichas técnicas, 119 comerciais, 112 pizzaria, 94 oficina, 50 lotes, 70 etiquetas; seis verificações de navegador das fichas e 20 da pizzaria. Versão/cache e build aprovados. Lint: zero erros, 12 avisos preexistentes. O teste de navegador da pizzaria agora aguarda o carregamento do caixa antes de abrir a montagem.
