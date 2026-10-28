# Revisão de permissões — etapa posterior às melhorias funcionais

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
