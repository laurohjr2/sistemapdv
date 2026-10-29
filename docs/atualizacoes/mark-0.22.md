# Mark 0.22.0 — Confirmação de salvamento e módulos financeiros

## Confirmação em todo o sistema

Os formulários de salvamento passam a usar uma notificação flutuante de sucesso por **dois segundos**, com cores para os modos claro e escuro. A confirmação acompanha a resposta bem-sucedida do servidor, mesmo quando o formulário fecha ou a tela recarrega seus registros.

Cobertura: configurações; produtos; clientes; usuários/senhas; mesas e cliente da comanda; acessos; orçamentos; fornecedores; pedidos de compra; contas e registros financeiros; veículos/OS; fotos/assinaturas; agenda/garantias; cadastro técnico/equivalências de autopeças; entregas; fichas técnicas; cardápio; combos; formatos/vínculos de balança; benefícios de fidelidade e recuperação com nova senha.

Consultas, login, leitura de etiqueta, cálculo de pizza/combo, prévias/importação e geração de documentos não são confundidos com salvamento. Operações com erro não mostram confirmação de sucesso. Os avisos próprios de cozinha, exportação, cancelamento e outras ações continuam com suas mensagens específicas.

O cadastro de produto com estoque inicial só confirma o conjunto após adicionar o estoque. Se o produto for criado, mas o estoque falhar, a mensagem informa essa situação, sem declarar que tudo foi salvo. Recarregue e confira o estoque antes de repetir uma entrada.

Algumas telas mantêm também o texto contextual de confirmação dentro do formulário; a notificação flutuante padronizada dura dois segundos.

## Contas a pagar e receber em Configurações

Quando **Fornecedores e compras** está ativo, o financeiro fica **marcado automaticamente** e seu controle fica bloqueado: as compras precisam gerar contas a pagar. A tela explica essa dependência ao lado da opção. Não é uma restrição ao Master.

Para configurar o financeiro independentemente:

1. Desmarque **Fornecedores e compras**, se a empresa não usa esse módulo.
2. **Contas a pagar e receber** passa a aceitar alteração. Pode continuar ativo sozinho.
3. Salve as configurações.

Ao marcar Compras novamente, a tela ativa o financeiro automaticamente. Cozinha/Mesas seguem a mesma lógica de dependência e agora também exibem o motivo no próprio controle.

As proteções de dados permanecem: pedidos de compra em andamento impedem desligar Compras; contas com saldo pendente impedem desligar o Financeiro. O servidor confere essas condições e mantém a configuração anterior quando recusa o salvamento. Não exclua registros para ocultar o módulo: conclua a operação correspondente.

## Atualizar e validar

Com Docker Desktop iniciado, execute separadamente:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Acesse http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.22.0** na interface e no servidor. A atualização inclui a Mark 0.21.0 de pizzas nos combos.

Valide um cadastro simples, Configurações e Acessos. Em Configurações, confira a explicação do financeiro e sua edição após desligar Compras. No menu Financeiro, cadastre uma conta a pagar e uma a receber, confira os saldos e registre a quitação. Use dados de demonstração e valores conferidos: o registro não constitui confirmação bancária automática.

## Manutenção

`src/lib/saveFeedbackPolicy.js` relaciona os pontos de salvamento. `src/lib/saveFeedback.js` exibe a confirmação pelo interceptor de respostas do cliente `api`. Novos formulários devem usar uma rota de salvamento catalogada ou informar `saveSuccess: 'Mensagem de sucesso.'` na configuração da requisição. Fluxos compostos podem usar `saveSuccess: false` nas etapas intermediárias e confirmar só a etapa final. Não inferir sucesso pelo clique em botão ou pelo fechamento do modal.

Testes dedicados: `scripts/save-feedback-policy-test.cjs`, `scripts/save-feedback-finance-browser.cjs` e `scripts/save-feedback-products-browser.cjs`. Somente empresas sintéticas; fixtures privadas em `work/mark23/` e `work/mark22/` são ignoradas pelo Git.

## Resultado técnico

**306 verificações aprovadas**: política de salvamento 139; navegador de financeiro/configurações/clientes 20; produto/estoque inicial/falha parcial 4; regressão de acessos e fidelidade no navegador 10; pizzas nos combos no navegador 11; regressão comercial/financeira 119; versão/cache 3. O teste financeiro também concluiu oito requisições auxiliares. Catálogo de permissões e 206 rotas conferidos. Build concluído e lint sem erros, mantendo 12 avisos anteriores. PDF financeiro conferido com contas pagas/recebidas e saldo zero.

A base imediatamente anterior Mark 0.21.0 concluiu 1.220 verificações de regressão/persistência, conforme seu roteiro. Nenhuma dessas rodadas utilizou banco de cliente. Equipamentos físicos, envio por SMTP, provedor fiscal/Pix e cópia externa de backup mantêm as condições registradas no planejamento da Mark 1.0.0.
