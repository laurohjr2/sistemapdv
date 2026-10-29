# Mark 0.20.1 — Quantidades e desconto percentual nas mesas

## O que mudou

Em Mesas → Ver conta, o próximo lançamento apresenta quantidade × preço e o valor calculado. Ele entra no subtotal após **Adicionar à comanda**, com confirmação de sucesso. Produtos cadastrados como unidade, caixa ou par usam quantidade inteira; medidas como kg, litro, metro e hora continuam permitindo até três casas decimais.

Itens já lançados, exceto componentes de combos, permitem **Atualizar quantidade**, recalculando o total no servidor. O estoque direto acompanha a diferença; insumos de fichas técnicas seguem as regras existentes, sem reposição automática do que já foi consumido. Pizzas continuam sujeitas às regras de montagem; combos devem ser alterados como grupo pelo fluxo próprio. Quantidades anteriores não são corrigidas automaticamente: confira a quantidade física e atualize o item quando necessário. Para editar itens é necessária a permissão `tables.edit`.

Gerentes, administradores e Master com acesso de escrita podem escolher desconto em **R$** ou **%**, respeitando `discounts.apply`. A tela mostra subtotal, desconto convertido em reais e total líquido. Alterações no desconto limpam os valores dos pagamentos para nova conferência. A fidelidade aplica seu valor calculado e substitui o desconto manual; não há acúmulo automático. O cupom identifica o percentual e o abatimento em reais, inclusive na reimpressão por Comandas.

## Atualizar

Com Docker Desktop iniciado, execute um comando por vez na pasta da instalação:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.20.1** na interface e no servidor. Cadastros, quantidades anteriores e histórico são preservados.

## Conferir

1. Selecione um produto de R$ 9,00 e quantidade 10. A prévia deve mostrar R$ 90,00; confirme o lançamento e confira o subtotal.
2. Para corrigir um registro existente, edite **Quantidade lançada** e clique em **Atualizar quantidade**.
3. Escolha **Porcentagem (%)**, informe 10 e confira desconto e total líquido.
4. Distribua os pagamentos, feche a mesa e confira o cupom.
5. Reimprima pelo menu Comandas e confira o desconto.

Validação técnica em empresas sintéticas: `scripts/table-quantity-discount-browser.cjs`, mais regressão de fidelidade em mesas/comandas. O novo teste reproduz quantidade 1,004, corrige para 10, atualiza para 4, adiciona mais 10, confere o subtotal de R$ 126,00, aplica 10% e fecha em R$ 113,40 com dois pagamentos de R$ 56,70. Confere quantidade, estoque, bloqueio acima de 100%, percentual fracionado, desconto em reais, cupom HTML/PDF e tela móvel no modo escuro. Fixtures privadas em `work/` não devem ser compartilhadas nem usadas em instalação de cliente.

Resultado: build concluído, lint sem erros (12 avisos anteriores), 99 verificações de API de fidelidade, 10 de regressão em navegador, 16 de quantidades/descontos em navegador e 3 de versão/cache aprovadas. As 12 chamadas auxiliares do novo teste também passaram. PDF e cupom conferidos.
