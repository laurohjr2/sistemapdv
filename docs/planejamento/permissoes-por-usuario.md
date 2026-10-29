# Perfis e permissões — implementação autorizada em 29/10/2026

Solicitada por Lauro em 28/10/2026. Avaliar após concluir as melhorias funcionais em andamento. Não aplicar mudanças de acesso nesta etapa de balanças/etiquetas.

## Objetivo

Definir acessos por usuário, perfil e ação, com indicação clara do que pode ser consultado ou alterado em cada empresa.

## Escopo a avaliar

- Menus e recursos de cada segmento.
- Consultar, cadastrar, alterar, inativar/reativar e imprimir/exportar.
- Abrir/fechar caixa, vender, receber, cancelar/estornar e registrar perdas.
- Dar descontos e modificar preços, com limites se aprovados.
- Aprovar orçamentos/OS, identificar lotes, alterar aplicações/equivalências.
- Ver custos, financeiro, ranking, dados de clientes e auditoria.
- Administrar usuários e delegar permissões, sem permitir elevação indevida de acesso.
- Ações por responsável, como o mecânico atribuído à OS.

## Regras já solicitadas a preservar

- Conta Master do fornecedor com acesso total às empresas selecionadas, separada dos usuários dos clientes.
- Suporte separado, com acesso e identificação explícitos; a modalidade de consulta atual não pode ganhar escrita implicitamente.
- Administradores de clientes restritos à própria empresa.
- Usuário inativo sem login nem operação; histórico preservado e reativação possível.
- Identificação do cliente e conteúdo restrito ao suporte/Master conforme os locais autorizados pelo usuário.

## Entrega futura esperada

Matriz de menus × ações × perfis, revisão com o proprietário, regras de combinação de permissões por usuário, implementação das mesmas regras no servidor e na interface, auditoria das alterações e testes de isolamento/negação. Antes de implementar a matriz, confirmar os papéis reais de operação e os limites pretendidos. Nomes de papéis e permissões específicas ainda não aprovados não devem ser presumidos.

Incluir fichas técnicas: consultar composição/custos, editar/ativar receita e autorizar reposição de ingredientes não utilizados. O padrão de cancelamento deve preservar o consumo; apenas uma permissão explícita pode autorizar reposição.

Incluir entregas: consultar/alterar contato e endereço, imprimir dados do destinatário, avançar etapas, identificar entregador, confirmar recebimento e cancelar apenas a entrega. Separar essas ações do estorno financeiro, preservando as regras de devolução física.

Incluir combos: editar/inativar catálogo promocional, lançar conjuntos/adicionais e remover o grupo completo. Distinguir a promoção cadastrada por gerente de um desconto livre dado pelo operador, mantendo a autorização para reposição de insumos.

Incluir evidências da oficina: consultar/baixar fotos, anexar como responsável atribuído, arquivar sem apagar, registrar/cancelar registro de assinatura e imprimir anexos. Preservar a separação entre registro desenhado, autorização da OS e recebimento financeiro.

Incluir as Marks 0.13 a 0.17 na revisão: agenda (consultar/agendar/reagendar/chegada/ausência/vínculo com OS), garantia/retorno (emitir/cancelar registro/analisar/aceitar/recusar/imprimir), catálogo CSV (preparar/conferir/confirmar), fidelidade (definir condição, ver histórico, aplicar desconto e exportar) e emissão/revogação de código técnico. Emissão de acesso temporário permanece exclusiva da conta Master, sem delegação implícita aos administradores dos clientes. A sessão por código continua somente consulta.

## Continuidade de 29/10/2026

O proprietário autorizou prosseguir e validar as Marks em conjunto em 30/10 às 09:00. A espera pela revisão anterior foi substituída pela implementação configurável, mantendo os usuários atuais no modelo anterior até escolha explícita do administrador. Marks 0.18.0 e 0.19.0: [matriz e configuração](../acessos/README.md), [roteiro de validação](../atualizacoes/mark-0.18-a-0.19.md). Perfis sugeridos não promovem papel nem ativam módulos automaticamente.
