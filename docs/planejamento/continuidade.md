# Continuidade autorizada — 28/10/2026

O proprietário autorizou concluir balanças/etiquetas e prosseguir às próximas melhorias, com validação conjunta por ele amanhã de manhã. Não esperar validações intermediárias para os trabalhos autorizados. Manter versões Mark, testes e instruções de atualização por entrega.

## Ordem de trabalho

1. Entregue e validada em ambiente sintético — Mark 0.8.0: padrões EAN-13 de balança e etiquetas de gôndola; leitura desativada até configurar equipamento real. O proprietário ainda não tem balança; deseja opções pré-configuradas para formatos comuns.
2. Entregue e validada em ambiente sintético — Mark 0.9.0: ficha técnica com baixa de ingredientes para alimentação, preservando estoque, cancelamentos e histórico.
3. Entregue e validada em ambiente sintético — Mark 0.10.0: pedidos de entrega vinculados a vendas pagas, contato/endereço, etapas, cozinha, histórico e impressão. Entregue e validada em ambiente sintético — Mark 0.11.0: combos e adicionais opcionais em vendas, mesas e comandas. Combos com pizzas personalizadas e evolução do delivery permanecem na continuidade de alimentação.
4. Oficina: Mark 0.12.0 entregue e validada em ambiente sintético — fotos do checklist e assinatura desenhada de aceite/recebimento, com histórico e PDF. Mark 0.13.0 entregue e validada em ambiente sintético — agenda, conflitos por veículo/responsável, chegada, ausência, cancelamento, vínculo com OS e histórico. Mark 0.14.0 entregue e validada em ambiente sintético — condições de garantia, análise de retorno, vínculo com outra OS, histórico e PDF.
5. Entregue e validada em ambiente sintético — Mark 0.15.0: importação CSV de catálogo de autopeças, mapeamento, prévia persistida, validação de duplicidades e cadastro inativo com estoque zero. Aplicações somente da fonte informada, sem inventar compatibilidades.
6. Clientes: fidelidade, descontos por cliente e histórico de benefícios.
7. Suporte: geração de senhas e acessos temporários com validade/auditoria.
8. Integrações externas: confirmação de Pix/emissão fiscal exigem provedor, credenciais e ambiente de homologação; SMTP e destino externo de backup permanecem aguardando definição do proprietário. Não simular integrações reais como concluídas.
9. Após as melhorias funcionais: revisão de perfis e permissões por usuário, conforme [escopo registrado](permissoes-por-usuario.md).

Não declarar compatibilidade física com balanças/impressoras nem homologação fiscal sem testes no equipamento/provedor correspondente. Não alterar cadastros de clientes em produção para demonstrar funções. Validar em empresas sintéticas e preservar volumes existentes.

## Ajuste visual para a próxima atualização

Em Vendas, o aviso de caixa fechado passa a ter fundo vermelho suave no modo claro, fundo vermelho escuro no modo escuro, borda lateral, ícone de cadeado e título em negrito: **Você precisa abrir um caixa para vender**. A condição de exibição e o bloqueio das vendas permanecem os mesmos.
