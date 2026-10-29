# Continuidade autorizada — 28/10/2026

O proprietário autorizou concluir balanças/etiquetas e prosseguir às próximas melhorias, com validação conjunta por ele amanhã de manhã. Não esperar validações intermediárias para os trabalhos autorizados. Manter versões Mark, testes e instruções de atualização por entrega.

## Ordem de trabalho

1. Entregue e validada em ambiente sintético — Mark 0.8.0: padrões EAN-13 de balança e etiquetas de gôndola; leitura desativada até configurar equipamento real. O proprietário ainda não tem balança; deseja opções pré-configuradas para formatos comuns.
2. Entregue e validada em ambiente sintético — Mark 0.9.0: ficha técnica com baixa de ingredientes para alimentação, preservando estoque, cancelamentos e histórico.
3. Entregue e validada em ambiente sintético — Mark 0.10.0: pedidos de entrega vinculados a vendas pagas, contato/endereço, etapas, cozinha, histórico e impressão. Entregue e validada em ambiente sintético — Mark 0.11.0: combos e adicionais opcionais em vendas, mesas e comandas. Combos com pizzas personalizadas e evolução do delivery permanecem na continuidade de alimentação.
4. Oficina: Mark 0.12.0 entregue e validada em ambiente sintético — fotos do checklist e assinatura desenhada de aceite/recebimento, com histórico e PDF. Mark 0.13.0 entregue e validada em ambiente sintético — agenda, conflitos por veículo/responsável, chegada, ausência, cancelamento, vínculo com OS e histórico. Mark 0.14.0 entregue e validada em ambiente sintético — condições de garantia, análise de retorno, vínculo com outra OS, histórico e PDF.
5. Entregue e validada em ambiente sintético — Mark 0.15.0: importação CSV de catálogo de autopeças, mapeamento, prévia persistida, validação de duplicidades e cadastro inativo com estoque zero. Aplicações somente da fonte informada, sem inventar compatibilidades.
6. Entregue e validada em ambiente sintético — Mark 0.16.0: fidelidade por cliente, percentual/validade, aplicação conferida pela gerência nas vendas diretas, histórico de condições e benefícios, cancelamentos identificados e PDF. Mark 0.20.0 amplia a fidelidade para mesas e comandas; cashback/pontos permanecem evolução futura.
7. Entregue e validada em ambiente sintético — Mark 0.17.0: códigos temporários de uso único, emitidos pelo Master para suporte somente leitura, restritos à empresa/operador, com validade, revogação e auditoria.
8. Integrações externas: confirmação de Pix/emissão fiscal exigem provedor, credenciais e ambiente de homologação; SMTP e destino externo de backup permanecem aguardando definição do proprietário. Não simular integrações reais como concluídas.
9. Após as melhorias funcionais: revisão de perfis e permissões por usuário, conforme [escopo registrado](permissoes-por-usuario.md).

Não declarar compatibilidade física com balanças/impressoras nem homologação fiscal sem testes no equipamento/provedor correspondente. Não alterar cadastros de clientes em produção para demonstrar funções. Validar em empresas sintéticas e preservar volumes existentes.

## Ajuste visual para a próxima atualização

Em Vendas, o aviso de caixa fechado passa a ter fundo vermelho suave no modo claro, fundo vermelho escuro no modo escuro, borda lateral, ícone de cadeado e título em negrito: **Você precisa abrir um caixa para vender**. A condição de exibição e o bloqueio das vendas permanecem os mesmos.

Lote 0.13.0–0.17.0 concluído: [roteiro de validação e atualização](../atualizacoes/mark-0.13-a-0.17.md). A próxima revisão é a matriz de permissões com o proprietário; integrações externas dependentes de provedor continuam pendentes.

## Continuidade autorizada em 29/10/2026

Implementadas Marks 0.18.0 (matriz/consulta) e 0.19.0 (perfis e exceções, enforcement, auditoria e proteção administrativa), com validação em empresas sintéticas. Usuários atuais permanecem no modelo anterior até aplicação de perfil pelo administrador. [Roteiro para 30/10 às 09:00](../atualizacoes/mark-0.18-a-0.19.md). Integrações dependentes de SMTP/provedor fiscal/Pix/destino externo de backup permanecem aguardando definição; não foram simuladas como prontas.

## Ajuste aprovado após validação da Mark 0.19.0

Preparado para a próxima Mark: ao confirmar o salvamento dos acessos no servidor, exibir notificação **Acessos salvos com sucesso**, identificando o usuário, por dois segundos. A notificação permanece visível após recarregar o editor e usa cores próprias para temas claro/escuro. Falhas continuam exibindo o erro, sem notificação de sucesso.

## Mark 0.20.0

Implementadas fidelidade em mesas/comandas, desconto único conferido no servidor, snapshot do benefício no fechamento, histórico por origem/situação e cupom, preservando recebimento e estoque. Inclui redução do aviso de salvamento para dois segundos. [Roteiro de validação](../atualizacoes/mark-0.20.md). Próxima evolução funcional prevista: pizzas personalizadas em combos.

## Mark 0.20.1 — ajuste após validação

Prioridade solicitada: prévia de quantidade × preço, correção de quantidade lançada e escolha entre desconto em reais ou porcentagem no fechamento de mesas. Quantidades antigas são preservadas até conferência pelo operador. [Atualização e validação](../atualizacoes/mark-0.20.1.md). Pizzas personalizadas em combos continuam como próxima evolução funcional.

## Continuidade aprovada — estabilização

O proprietário aprovou concluir pizzas nos combos e concentrar a sequência na estabilização da Mark 1.0.0. Mark 0.21.0 implementa a montagem por pizza, complementos, validação de versões e snapshots nos fluxos de venda e mesa/comanda. [Guia e validação](../atualizacoes/mark-0.21.md). [Escopo e critérios para a Mark 1.0.0](mark-1.0.md). Novas expansões ficam para versões posteriores; integrações externas aguardam definição e homologação. A Mark 1.0.0 depende da revisão técnica e da validação final do proprietário.

## Mark 0.22.0 — revisão solicitada durante estabilização

Ampliação da confirmação de salvamento para os formulários do sistema, com duração de dois segundos e sem anunciar sucesso em falhas/cálculos/consultas. Dependência de Financeiro por Compras explicada no próprio controle; ativação de Compras liga Financeiro no formulário, e Cozinha liga Mesas. Conferidos financeiro independente, contas a pagar/receber, quitação e bloqueio de desativação com saldo pendente. [Atualização e detalhes](../atualizacoes/mark-0.22.md). O escopo da Mark 1.0.0 continua a estabilização e validação final, sem novas expansões de módulos.
