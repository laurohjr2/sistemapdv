# Pizzaria — versão 0.4.0

Montagem de pizzas integrada a Vendas, Mesas, Comandas, Cozinha, estoque e cupom. Esta entrega acrescenta tamanhos, até quatro sabores por pizza, bordas, adicionais e duas regras de preço.

## Atualização

Na pasta do projeto, com o Docker Desktop aberto e fora do horário de atendimento:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

O atualizador faz backup, reconstrói e recria os containers. Confira **Sobre → Interface e Servidor 0.4.0**, pressione `Ctrl+Shift+R` e faça login novamente se necessário. A migração adiciona tabelas/colunas e preserva os dados anteriores. Não apague volumes.

Os scripts de backup continuam disponíveis. Um backup feito na versão 0.3.0 exige o código daquela versão para a recuperação; use um checkout separado e o procedimento do [guia de recuperação](../backup-recuperacao/README.md), preservando a instalação em uso.

## Configuração inicial

1. Como administrador, selecione **Configurações → Perfil do negócio → Pizzaria** e salve. Os módulos também podem ser ajustados individualmente. Para usar pedidos na cozinha, mantenha **Cozinha** e **Mesas e comandas** ativos.
2. Em **Produtos e serviços**, cadastre os produtos-base como **Produto**, usando unidade **Unidade**. Exemplos: “Base de pizza grande” e “Base de pizza broto”. Em Estoque, registre a quantidade disponível para produção. O preço normal do produto-base não determina o preço da pizza montada.
3. Em **Pizzaria → Tamanhos**, informe nome, fatias, máximo de sabores (de um a quatro) e produto-base do estoque. Vários tamanhos podem usar o mesmo produto-base se o estabelecimento controla uma unidade comum de produção.
4. Em **Sabores**, informe o preço da pizza inteira de cada sabor por tamanho. Em **Bordas** e **Adicionais**, informe os acréscimos por tamanho. Deixe vazio para tornar uma opção indisponível naquele tamanho; zero permite borda/adicional gratuito. Um sabor precisa ter preço positivo.
5. Escolha a regra para vários sabores e clique em **Salvar cardápio**. O salvamento considera todas as abas. A edição simultânea é conferida por revisão; se outra sessão já salvou, recarregue antes de tentar novamente.

Gerentes e administradores podem configurar o cardápio. Atendentes podem montar e vender pizzas, mas não editar o cardápio nem conceder descontos. O suporte continua somente para consulta; Master mantém acesso total à empresa selecionada.

Cada pizza baixa **uma unidade do produto-base**, independentemente da quantidade de sabores. Duas montagens diferentes usando o mesmo produto têm o estoque somado na validação da venda. Bordas e adicionais desta entrega alteram o preço e as instruções de preparo; **não baixam ingredientes individualmente**. Não altere a unidade de medida do produto-base após utilizá-lo sem revisar o controle de estoque.

## Cálculo do preço

Os sabores ocupam partes iguais: dois sabores representam metade de cada; três, um terço de cada. Não há porções desiguais nesta etapa.

| Regra | Exemplo: Calabresa R$ 50 e Mussarela R$ 60 |
| --- | --- |
| Sabor mais caro | Pizza custa R$ 60. |
| Média dos sabores | Pizza custa R$ 55. |

Borda de R$ 8 e dois adicionais de R$ 5 acrescentam R$ 18 à pizza inteira. Assim, o exemplo custa R$ 78 pelo maior sabor ou R$ 73 pela média. A média é arredondada uma vez, ao centavo, antes de somar os complementos. A quantidade de adicionais é por pizza; ao pedir duas pizzas iguais, os complementos são repetidos em cada uma.

O servidor calcula o valor e valida os IDs, opções ativas, limite de sabores, quantidades e estoque. O navegador não escolhe livremente o preço da pizza. Se o cardápio mudar durante a montagem ou enquanto a pizza estiver no carrinho, será necessário conferir e montar novamente. Pizzas já registradas guardam os nomes, frações, complementos e preços usados no pedido. Alterar ou remover opções do cardápio não muda esse histórico. Alterar apenas a quantidade de um item da comanda conserva o preço original.

## Operação

- **Vendas:** abra o caixa e clique em **Montar pizza**. Escolha tamanho, sabores, borda, adicionais, quantidade inteira (até 99 por item) e observações. Montagens diferentes ficam em linhas separadas. Confira o carrinho e finalize o pagamento. O cupom mostra a composição e as observações.
- **Cozinha — balcão:** pizzas de vendas diretas pagas aparecem em **Pizzas do balcão — vendas pagas**, identificadas pelo número da venda que consta no cupom. O fluxo é pendente → preparando → pronta → entregue/retirada. Não há uma segunda cobrança nessa etapa. A tela atualiza essa área a cada 20 segundos e oferece atualização manual.
- **Mesas:** abra a comanda e use **Montar pizza** dentro da conta. A cozinha recebe a mesma montagem, observações e identificação da mesa. A mesa mostra quando fica pronta, permite registrar a entrega e conserva a divisão da conta e os pagamentos em diferentes formas.
- **Comandas:** o botão de montagem também aparece nos detalhes de uma comanda aberta, inclusive para atendimento de balcão.
- **Cancelamento e remoção:** a reversão do estoque segue o fluxo existente, com transação e histórico. Cancelar uma venda retira suas pizzas da fila do balcão. Remover um item de uma comanda aberta devolve a quantidade do produto-base.
- **Impressão:** conferência da mesa, cupom da venda, impressão da comanda e PDF incluem a montagem. Os relatórios financeiros e ranking continuam usando os valores efetivamente registrados; os relatórios por produto agrupam pelo produto-base, sem criar um ranking separado por sabor.

Produtos-base vinculados a tamanhos ativos são montados pelo botão próprio; a venda comum e o Ticket Rápido não substituem essa montagem. Orçamentos de pizzas personalizadas ainda não foram implementados: novos orçamentos orientam a usar Vendas, Mesas ou Comandas. Orçamentos e histórico anteriores permanecem preservados.

Em comandas, conclua o preparo e a entrega antes de fechar a conta: a fila de comandas considera contas abertas. Para receber antes do preparo, utilize **Vendas**, cuja fila do balcão continua após o pagamento.

O sistema bloqueia a desativação da Pizzaria enquanto houver comandas abertas com pizzas ou pizzas de vendas diretas aguardando preparo/retirada. Finalize ou cancele essas operações antes de trocar o perfil ou ocultar módulos.

## Limites e próximas etapas

Ainda ficam para entregas específicas: ficha técnica e consumo de ingredientes, alergênicos, porções desiguais, adicionais por metade, combos, delivery com endereços/taxas/entregadores, pedidos pela internet e integração fiscal. Os cupons são documentos não fiscais. A confirmação de Pix continua sendo feita pelo operador.

## Validação

Os testes foram executados com dados sintéticos em projetos Docker separados da instalação local do cliente.

| Verificação | Resultado |
| --- | --- |
| API de pizzaria (`scripts/pizzeria-smoke.cjs`) | 109 verificações aprovadas: maior sabor/média, centavos, limites, entradas inválidas, revisão do cardápio, permissões, estoque compartilhado, 12 vendas simultâneas e seus cancelamentos, pedido concorrente com desativação do módulo, snapshots, mesas/cozinha, PDF, pagamentos divididos e isolamento entre empresas. A contagem pode variar conforme o resultado válido da disputa de transações. |
| Navegador (`scripts/pizzeria-browser.cjs`) | 20 verificações aprovadas: edição do cardápio, conflito entre sessões e recarga, montagem, carrinho, Pix, cupom, cozinha do balcão, pizza na mesa, entrega, recebimento, atendente e celular. Sem erros JavaScript. |
| Gestão comercial anterior | 119 verificações HTTP, 24 de navegador e 26 de isolamento aprovadas: orçamentos, compras parciais, financeiro, caixa, Master e suporte. |
| Operação anterior | 75 verificações HTTP e 16 de navegador aprovadas: clientes, descontos, pagamentos divididos, mesas/cozinha, relatórios/PDF, inativação de usuários, recuperação de senha, logo, Master e suporte. |
| Migração/persistência | 10 verificações aprovadas ao atualizar o ambiente antigo: produtos, usuários, ID, configurações e parcelas preservados. |
| Publicação | 3 verificações aprovadas: API, arquivo público de versão e cache do login. Interface/servidor em 0.4.0. |
| Build e qualidade | Build de produção Docker aprovado. ESLint sem erros, com os 12 avisos preexistentes. Mantido o aviso de tamanho do pacote JavaScript no build. |

Impressão física no Windows e equipamento da cozinha não são homologados por esses testes. A rotina do Agendador de Tarefas do Windows continua exigindo conferência local, como explicado na entrega de backup.
