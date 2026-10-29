# Mark 0.18.0 e Mark 0.19.0 — Acessos por usuário

Lote autorizado em 29/10/2026, preparado para validação pelo proprietário em **30/10/2026 às 09:00, horário de São Paulo**. Versão final: **0.19.0**.

| Mark | Entrega | Onde |
| --- | --- | --- |
| 0.18.0 | Matriz de ações, limites de papel e consulta dos próprios acessos | Acessos e permissões / Meus acessos |
| 0.19.0 | Perfil e exceções por usuário, prévia, motivo, histórico, servidor e navegação, custos protegidos e preservação de administrador ativo | Acessos e permissões |

## Atualizar

Com Docker Desktop iniciado, na pasta da instalação, um comando por vez:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.19.0** na interface e no servidor. As tabelas de configuração/auditoria são criadas nos bancos cadastrados; não substituem usuários, vendas, produtos ou saldos. Usuários existentes mantêm o modelo atual de papel até configuração explícita. Não apague volumes.

## Roteiro para validar

1. Entre como Master ou administrador da empresa; abra **Acessos e permissões** e confira a matriz.
2. Escolha um funcionário de teste. Aplique **Cozinha**, com motivo e confirmação; entre com ele em outra janela e confira menus e acesso à produção.
3. Aplique **Caixa** e retire **Fechar caixa** como exceção. Confira a prévia; valide venda permitida e fechamento bloqueado.
4. Confira que o funcionário não pode administrar usuários, conceder alçada maior que seu papel ou acessar outra empresa.
5. Teste **Sem acesso operacional**: mantém Meus acessos e saída. Depois restaure **Modelo atual do papel**, com motivo.
6. Confira o histórico no editor e a indicação de custos indisponíveis em um perfil de consulta de produtos sem acesso a custos.
7. Confira Master separado, suporte somente consulta e usuários inativos sem login.

Guia: [configuração de perfis e exceções](../acessos/configuracao.md). A matriz e os perfis são opções para adaptar à operação; não mudam funções dos funcionários automaticamente. Para usar Estoque ou ações de gerência, confira primeiro o papel do usuário.

## Validação técnica

Testes apenas em empresas sintéticas no projeto Docker descartável. Catálogo e dependências conferidos, 205 rotas classificadas, mapa de navegação sincronizado. Testes de API cobrem negação, exceções, custos, descontos, sessão antiga, concorrência, auditoria, Master/suporte, isolamento e último administrador. Navegador cobre editor, confirmação, menus, URL direta, ausência de operações, restauração, custos ocultos e tela estreita/modo escuro. Persistência é conferida após recriação/migração.

Build e lint sem erros; permanecem os 12 avisos anteriores. Scripts: `access-catalog-test.cjs`, `access-smoke.cjs`, `access-stock-cost.cjs`, `access-browser.cjs` e `access-persistence.cjs`. Fixtures privadas em `work/access/` são ignoradas pelo Git e não devem ser compartilhadas. Nunca executar os testes sintéticos em instalação de cliente.

Resultado: **827 verificações aprovadas**, além da classificação das **205 rotas** e da conferência do catálogo/dependências. API de acessos: 107; proteção de custo na entrada: 6; navegador: 8; persistência: 44; versão/cache: 3. Regressões: oficina 94, concorrência 19, comercial 118, pizzaria 109, combos 121, entregas 94 e fichas técnicas 104. Nenhum banco de cliente foi usado nos testes.
