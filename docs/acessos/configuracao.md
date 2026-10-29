# Mark 0.19.0 — Perfis e permissões por usuário

## Configurar

Entre como administrador da empresa ou Master. No menu **Acessos e permissões**, escolha o usuário. Administradores mantêm controle integral da própria empresa; Master/suporte são separados e não aparecem como funcionários cadastrados.

1. Confira nome, papel e situação do usuário.
2. Escolha um perfil sugerido, ou altere **Modelo de acesso** para **Perfil e exceções por usuário**.
3. Ajuste as ações. Consultas necessárias são incluídas ao liberar uma operação; retirar uma consulta também retira ações dependentes.
4. Confira a **Prévia da alteração**, informe o motivo e marque a confirmação do usuário e das liberações/retiradas.
5. Clique **Salvar acessos**. O histórico registra administrador, data, motivo e configurações anterior/nova.

É possível preparar o perfil com o usuário inativo e reativá-lo depois no cadastro. Permissões não reativam usuários. Duas edições simultâneas são protegidas pela revisão: a segunda precisa recarregar a configuração atual.

## Papel e perfil

O papel existente define o limite máximo; o perfil configura as ações dentro dele. Não existe promoção implícita por checkbox. Descontos e outras ações de gerência continuam restritos a gerente/administrador; administração de usuários é exclusiva de administrador/Master.

- **Caixa:** venda direta, consulta/abertura/fechamento do caixa, consultas necessárias e impressão de comandas. Receber/fechar comanda continua sujeito ao papel de gerência e à ação específica, que pode ser liberada como exceção nesse papel.
- **Atendimento:** clientes, mesas/comandas, orçamentos e acompanhamento de entregas, sem desconto livre ou cancelamento financeiro.
- **Cozinha:** produção e etapas de preparo/entrega.
- **Mecânico responsável:** consulta da oficina, execução e fotos da OS atribuída. A permissão não o torna responsável por OS de outros funcionários.
- **Estoque:** cadastro e movimentos de estoque, lotes, aplicações/importação de peças e vínculos de balança. Exige papel Gerente, com os demais menus restringidos pelo perfil.
- **Gerência:** limite operacional do gerente, sem administrar usuários nem emitir acesso técnico.
- **Consulta gerencial:** consultas, sem gravação de operações; exportações/impressões são ações separadas.
- **Sem acesso operacional:** mantém login, Meus acessos e saída, sem liberar operações.

Os perfis são sugestões configuráveis. Não são aplicados aos funcionários automaticamente.

## Modelo anterior e restauração

**Modelo atual do papel** mantém as autorizações da versão anterior. O controle detalhado de ações, menus e ocultação de custos é ativado ao aplicar **Perfil e exceções por usuário**. Para desfazer a configuração, selecione o modelo atual, confira a prévia, informe motivo e confirme. O histórico é preservado.

Nenhum funcionário cadastrado foi remapeado automaticamente pela atualização. Revise e aplique os perfis desejados antes de considerar um funcionário sujeito às restrições específicas.

## Efeito das mudanças

O servidor consulta o perfil nas próximas requisições, inclusive com um token de login antigo. Uma operação já em andamento não é interrompida retroativamente. O navegador atualiza os acessos ao receber foco, a cada 30 segundos enquanto visível ou após uma operação negada.

Menus e URLs diretas respeitam o perfil. Os botões principais de caixa, vendas e edição de produtos/estoque também consultam as permissões. O servidor verifica as ações independentemente do que o navegador mostra; mudar o armazenamento local, esconder/desabilitar botões ou enviar uma requisição manual não concede acesso.

**Custos:** em perfis restritos sem Visualizar custos, valores de custo são removidos das respostas operacionais. Alterar custo em uma entrada exige essa autorização. Exportações que incluem custos exigem permissão correspondente. Desconto livre, reposição de ingredientes, ranking e financeiro têm verificações próprias.

As regras existentes de módulo habilitado, saldo, caixa aberto, aprovação, responsável pela OS e isolamento entre empresas continuam em vigor. Suporte permanece somente consulta; emissão de código técnico continua exclusiva do Master.

## Administração e histórico

Usuários são inativados, preservando histórico. A empresa precisa manter pelo menos um administrador ativo. Mudanças administrativas concorrentes são serializadas; uma conta que perdeu a administração não pode concluir nova alteração de usuários com a autoridade anterior. Contas técnicas do fornecedor ficam fora de consultas e alterações de funcionários, inclusive por ID.

As últimas 100 alterações de acesso de um funcionário aparecem no editor. Eventos são preservados no banco; não há rota de exclusão de auditoria. A configuração pertence ao banco da própria empresa e integra seus backups.
