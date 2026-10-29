# Mark 0.20.0 — Fidelidade em mesas e comandas

Inclui a confirmação de salvamento com duração de dois segundos e a ampliação da fidelidade para as contas de Mesas/Comandas.

## Atualização local

Com Docker Desktop iniciado, execute um comando por vez na pasta da instalação:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.20.0** na interface e no servidor. A migração cria a tabela de benefícios de comandas. Credenciais, contas anteriores, perfis, saldos e histórico são preservados; não há criação de benefícios retroativos. Não apague volumes.

## Validar

1. Salve uma alteração de acessos e confira a notificação de dois segundos.
2. Cadastre uma condição no menu Fidelidade para um cliente ativo.
3. Abra uma mesa com esse cliente cadastrado, inclua itens e aplique fidelidade.
4. Confira o total líquido, divida os pagamentos e imprima o cupom com o benefício.
5. Repita pelo menu Comandas. Confira o cliente vinculado antes de fechar.
6. Confira os registros de ambas as origens e o PDF no histórico de fidelidade.
7. Para usuários com perfil restrito, libere a nova ação **Aplicar fidelidade em mesas e comandas** antes da operação. Ela não é acrescentada aos perfis existentes automaticamente.

Guia completo: [fidelidade em mesas e comandas](../fidelidade/mesas-comandas.md).

## Verificações técnicas

Empresas sintéticas no projeto Docker descartável `pdv-commerce-test`. API cobre centavos, desconto único, estoque, mudanças entre terminais, pagamentos divididos/pendentes, benefício congelado, concorrência, permissões, suporte e isolamento. Chromium cobre as duas telas, cliente cadastrado, conflito e atualização, cupom, histórico/PDF, celular/modo escuro e notificação de dois segundos. Persistência é conferida após recriação/migração.

Scripts: `comanda-loyalty-smoke.cjs`, `comanda-loyalty-browser.cjs`, `comanda-loyalty-persistence.cjs`. Fixtures privadas de teste em `work/mark20/` são ignoradas pelo Git e não devem ser compartilhadas. Não executar os testes em instalação de cliente.

Resultado: **826 verificações aprovadas** — fidelidade em comandas 99, navegador 10, persistência 36 e versão/cache 3; regressões de fidelidade em vendas 28, comercial 119, pizzaria 112, combos 121, fichas técnicas 104 e entregas 94. Catálogo/dependências e classificação de 206 rotas também conferidos. Build e lint sem erros; permanecem 12 avisos anteriores. PDFs e cupom HTML inspecionados. Nenhum banco de cliente foi usado nos testes.
