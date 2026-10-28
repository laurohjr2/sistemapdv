# Mark 0.11.0 — Combos e adicionais

## Onde encontrar

**Comercial → Combos e adicionais**, para gerente/administrador e Master; suporte permanece em consulta. O lançamento fica disponível em **Vendas**, **Mesas** e **Comandas**, pelo botão **Selecionar combo**.

Habilite **Configurações → Perfil do negócio e módulos → Combos e adicionais** se necessário. Os perfis de alimentação sugerem o módulo. Outros perfis também podem habilitá-lo, por exemplo para conjuntos de mercadorias ou produtos e serviços.

## Montar o catálogo

1. Cadastre os produtos normalmente, com unidade, preço e estoque. Para um lanche preparado ou uma porção de adicional, use produto em **unidade** com ficha técnica; os insumos podem estar em kg, litro, gramas etc.
2. Cadastre o combo, seu preço fixo e os componentes incluídos. Exemplo: um lanche e um refrigerante, com preço conjunto de R$ 19,90.
3. Opcionalmente, liste adicionais e o máximo de unidades de cada opção. Cada adicional utiliza o preço de venda cadastrado do próprio produto. Exemplo: porção de queijo extra, R$ 2,00, máximo de duas por combo.
4. Um conjunto de apenas um lanche com adicionais opcionais também funciona como lanche personalizado. A taxa de entrega pode ser um serviço vendido junto, conforme o fluxo já existente.
5. Salve. Alterações incrementam a revisão e ficam na auditoria; inativar preserva vendas e atendimentos anteriores.

São aceitas quantidades inteiras, de 1 a 10 unidades por componente/opção, até 50 unidades na base e até 30 nos adicionais. O lançamento aceita de 1 a 99 combos por grupo; os pedidos continuam sujeitos aos limites financeiros e de número de itens do sistema. Itens vendidos por peso devem ser cadastrados como porções em unidade com ficha técnica quando fizerem parte de um combo.

## Vender e atender mesas

- Em **Selecionar combo**, escolha o conjunto, quantidades dos adicionais, número de combos e observações. Confira o total.
- Em Vendas, o carrinho exibe o conjunto. Ao finalizar, o servidor confere a definição, adicionais, preços e estoque e registra os componentes reais. O operador não pode enviar um preço promocional livre pelo navegador.
- Em Mesas/Comandas, o grupo é incluído de uma vez. Falha em qualquer componente desfaz todos os itens, valores e movimentos daquela inclusão.
- Produtos físicos baixam seu próprio saldo. Preparados e adicionais com ficha técnica baixam seus ingredientes, seguindo os lotes e a validade quando configurados.
- O grupo aparece identificado nos itens e observações da cozinha/cupom. Preparados seguem as etapas já existentes da cozinha; as entregas vinculadas à venda usam esses mesmos componentes, sem nova cobrança ou baixa.
- Nas comandas, não é permitido excluir ou alterar isoladamente um componente do conjunto. Use **Remover combo** para retirar o grupo completo e depois lance a nova composição. Assim não fica uma parte com preço promocional incorreto.
- Fechar uma comanda não baixa novamente o estoque.

## Preço, relatórios e cancelamentos

O preço fixo da base é distribuído em centavos entre suas unidades, proporcionalmente aos preços cadastrais dos componentes no momento do lançamento. O restante de centavos é distribuído de forma determinística; se todos os preços forem zero, o rateio é uniforme. A soma é exatamente o preço do conjunto. Adicionais entram por seu preço cadastral integral.

Cupons e relatórios continuam usando os **componentes reais e os valores rateados**, evitando contar um produto virtual e os seus componentes duas vezes. O relatório de consumo conta unidades dos produtos, não uma quantidade adicional de “combos”. Esta versão não inclui um ranking específico por combo.

A composição, revisão, grupo e valores do lançamento ficam preservados. Ao remover um grupo, a auditoria interna guarda os itens, valores, ingredientes e responsável pela remoção. Alterar depois o catálogo não muda um atendimento anterior. Se o preço de um adicional ou a composição do combo mudar enquanto estiver no carrinho, selecione novamente quando o sistema pedir.

Cancelar a venda ou a comanda segue as regras financeiras existentes. Produtos físicos podem retornar ao estoque; ingredientes de preparados permanecem consumidos por padrão. Gerente/administrador pode confirmar reposição de ingredientes **não utilizados**. Ingredientes com lote devolvidos ficam em conferência, como nas fichas técnicas. Depois da saída para entrega, permanece o bloqueio do estorno automático simples.

Não se pode ocultar Combos e adicionais enquanto houver grupos em comandas abertas.

## Pizzaria e limites

As pizzas com escolha de sabores, tamanhos, bordas e adicionais continuam por **Montar pizza**. Esta entrega não coloca uma pizza personalizada dentro de um combo: não é permitido contornar a escolha de sabores incluindo seu produto-base no catálogo de combos. O delivery da pizzaria e os adicionais do montador de pizza continuam funcionando.

Não há importação automática de combos, alteração automática de preço dos componentes, produção antecipada, combos em orçamentos/OS nem emissão fiscal nesta entrega.

## Testes sintéticos

```bash
PDV_BUNDLE_BROWSER_FIXTURE=work/bundles/fixture.json node scripts/bundles-smoke.cjs
node scripts/bundles-browser.cjs
node scripts/bundles-persistence.cjs
node scripts/bundles-audit.cjs
```

Somente em projeto descartável `pdv-*-test`. Fixtures em `work/` contêm credenciais sintéticas e não devem ser compartilhadas. Cobrir rateio, adicionais, lotes, falta de insumos, rollback de grupos, concorrência, snapshots, recebimento único, cozinha/entrega, isolamento, perfis e atualização Docker.

## Atualizar e validar no Windows

Na pasta `C:\Users\Lauro\Documents\pdv-local`, execute separadamente:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.11.0** na interface e no servidor, em Sobre o sistema.

Para validar na empresa de demonstração:

- Cadastre um combo de dois produtos em unidade e um adicional opcional. Confira a máscara de preço.
- Venda um combo com adicional e confira total, cupom e baixa dos componentes/ingredientes.
- Lance outro grupo em uma mesa/comanda e remova pelo botão **Remover combo**: o grupo inteiro deve desaparecer, mantendo o preço correto dos demais itens.
- Altere o catálogo e confirme que uma comanda anterior mantém o valor e a composição usados no lançamento.
- Se houver entrega, vincule a venda paga e acompanhe o preparo/saída pelos fluxos existentes.
- Em outro perfil de demonstração, habilite os módulos desejados em Configurações. Pedidos de entrega e combos não dependem exclusivamente de um segmento.

Resultados desta entrega: 121 verificações HTTP de combos, sete verificações HTTP com auditoria PostgreSQL, nove verificações de navegador e 25 de persistência aprovadas. Regressões aprovadas: 104 fichas técnicas, 119 comerciais, 109 pizzaria, 94 oficina, 50 lotes, 70 etiquetas e 94 entregas; navegadores: 20 pizzaria, seis fichas técnicas e cinco entregas. Versão/cache e build aprovados. Lint: zero erros e 12 avisos preexistentes.
