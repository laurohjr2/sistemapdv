# Mark 0.21.0 — Pizzas personalizadas nos combos

Conclui a montagem de pizzas em combos e inicia a estabilização da primeira versão, conforme [critérios da Mark 1.0.0](../planejamento/mark-1.0.md). Não publica ainda a versão 1.0.0.

## Atualização

Com Docker Desktop iniciado, execute um comando por vez na pasta da instalação:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.21.0** na interface e no servidor. A estrutura JSON existente preserva os combos e pedidos anteriores; não é preciso cadastrar tudo novamente nem apagar volumes.

## Conferir

1. Configure tamanho e sabores em Pizzaria.
2. Em Combos e adicionais, inclua o produto-base da pizza e escolha seu tamanho. Acrescente uma bebida e defina o preço do conjunto.
3. Em Vendas, selecione esse combo e monte cada pizza. O tamanho permanece fixo; todos os sabores disponíveis nesse tamanho estão incluídos no preço fixo. Borda e adicionais são cobrados à parte.
4. Confira o total e a quantidade de combos, finalize e verifique cupom e cozinha.
5. Repita por mesa ou comanda e confira o fechamento. Para retirar, remova o grupo inteiro em Comandas.
6. Vincule uma venda paga à entrega e confira as descrições na via de entrega.
7. Confira os perfis operacionais: montagem exige consultar combos e consultar/montar pizzas, além da ação de venda ou edição da comanda.

[Guia de preços, estoque e limites](../pizzaria/combos.md).

## Estabilização

O escopo da Mark 1.0.0 está registrado. A revisão reúne testes por perfil, valores/estoque, acessos, impressão, atualização e recuperação, seguida de validação final pelo proprietário. SMTP, destino externo de backup, confirmação automática de Pix, emissão fiscal e equipamentos físicos dependem das definições e homologações indicadas no planejamento.

## Verificações executadas nesta versão

**1.220 verificações aprovadas**, em empresas sintéticas: pizzas nos combos 84; navegador do novo fluxo 11; persistência após recriação/migração 20; comercial 119; pizzaria 109 e navegador 20; combos comuns 121 e navegador 9; fichas técnicas 104; entregas 94; oficina 94; autopeças 80; lotes/validade 50; balanças/etiquetas 70; acessos 107; fidelidade em comandas 99 e navegador 10; quantidades/descontos em mesas 16; versão/cache 3. O teste de quantidades também concluiu suas 12 requisições auxiliares. Catálogo de permissões/dependências e 206 rotas conferidos. Build concluído e lint sem erros, mantendo 12 avisos anteriores.

PDF da comanda e via de entrega inspecionados; navegador conferido no modo escuro e celular. Isso não substitui a impressão física nem a validação final do proprietário. Evidências privadas de teste em `work/mark22/` são ignoradas pelo Git.
