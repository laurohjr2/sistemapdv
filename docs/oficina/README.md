# Oficina mecânica — Mark 0.5.0

A oficina integra clientes, veículos, peças, mão de obra e recebimento. Cada empresa mantém seus próprios veículos e ordens de serviço, e o perfil pode ser combinado com os demais módulos.

## Atualizar e habilitar

Fora do atendimento, na pasta da instalação Windows:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Recarregue com **Ctrl+Shift+R**. Em **Sobre o sistema**, confira Interface e Servidor **0.5.0**. Em **Configurações**, selecione **Oficina mecânica** e salve. Também é possível ativar apenas **Oficina — veículos e ordens de serviço** em outro perfil. Empresas que já usam o perfil Oficina recebem o módulo por padrão quando ainda não existe uma escolha explícita para ele.

A atualização cria as novas tabelas e a referência da OS na venda em todos os bancos de empresas registrados. Preserva clientes, produtos, vendas anteriores e os catálogos da Mark 0.4.1. Não importa produtos automaticamente e não altera a configuração de backup.

## Primeiro atendimento

1. Cadastre o cliente em **Clientes**.
2. Confira os itens em **Produtos e serviços**. O catálogo inicial de Oficina ajuda a cadastrar peças e mão de obra; revise os itens inativos, seus preços e especificações. Entre com o estoque real das peças.
3. No menu **Oficina**, use **Novo veículo**. Informe cliente, placa brasileira antiga ou Mercosul, marca/modelo, ano e quilometragem. Placas são normalizadas e não podem se repetir na mesma empresa.
4. Abra **Nova ordem de serviço**. Selecione o veículo, registre a quilometragem de entrada, problema relatado e diagnóstico. Defina um responsável entre os usuários ativos do sistema.
5. Preencha o checklist de carroceria, pneus, luzes, acessórios/ferramentas, combustível e observações. “Não conferido” é um estado explícito; não presume que o item esteja OK.
6. Adicione peças e serviços, quantidades, valores e eventual desconto. Salve o rascunho. Preços são definidos por administrador/gerente e calculados no servidor, em centavos.

A quilometragem do veículo é atualizada com a entrada e não pode retroceder. O veículo pode ser inativado/reativado; transferência para outro cliente e inativação exigem concluir ou cancelar suas ordens abertas. Dados históricos de cliente, veículo, responsável, nomes e preços ficam registrados na OS, mesmo depois de mudanças nos cadastros.

## Aprovação e execução

Fluxo principal:

**Rascunho → Aguardando aprovação → Aprovada → Em execução → Pronta → Entregue**

- **Enviar para aprovação** exige diagnóstico e pelo menos um item.
- **Registrar aprovação** exige uma anotação de como e por quem o cliente autorizou. O sistema guarda data, usuário, anotação e uma cópia do escopo e dos valores aprovados no histórico.
- Uma recusa deve ser registrada com justificativa. A OS recusada pode ser revisada e enviada novamente.
- **Revisar orçamento** retorna uma OS ainda sem recebimento para rascunho e exige motivo. O aceite da revisão atual é removido; mudanças exigem nova aprovação. O aceite anterior continua no histórico.
- Para iniciar, o responsável precisa estar definido e ativo. O próprio responsável pode iniciar a execução e marcar como pronta. Administradores e gerentes também podem fazê-lo.
- A entrega é registrada após a OS estar pronta e com recebimento concluído.
- Cancelamento exige motivo; uma OS com venda recebida exige primeiro cancelar o pagamento em Vendas. Ordens entregues não são canceladas por esse fluxo.

Não é assinatura eletrônica, envio automático de orçamento nem confirmação direta pelo cliente. É o registro feito pelo operador da autorização que recebeu.

## Recebimento, estoque e impressão

Em uma OS **Pronta**, clique em **Receber OS** como administrador, gerente ou Master, com caixa aberto. Aceita dinheiro, Pix e cartões, inclusive mais de uma forma no mesmo recebimento. A soma deve ser exatamente o total. O QR/chave Pix segue a configuração da empresa; a confirmação é manual e não consulta um banco/provedor de pagamentos.

**A OS não reserva nem baixa peças durante orçamento ou execução. A baixa ocorre somente no recebimento.** Confirme a disponibilidade antes de utilizar as peças. Serviços não movimentam estoque. O recebimento grava venda, pagamentos e saída das peças na mesma transação; falta de estoque ou pagamento inválido desfaz toda a operação. Tentativas simultâneas não criam duas vendas para a mesma revisão da OS.

O valor recebido usa os preços e desconto aprovados, mesmo que o cadastro do produto mude depois. A venda integra os relatórios e o caixa já existentes. O responsável da OS registra quem executou; o usuário da venda registra quem recebeu e participa do ranking de vendedores.

Se precisar cancelar o recebimento **antes da entrega**, use o cancelamento em **Vendas**, com caixa ainda aberto. Ele repõe o estoque das peças e fica registrado no histórico da OS. É possível receber novamente a mesma OS pronta, preservando o vínculo anterior no histórico. Uma OS que já teve recebimento não pode ter seu escopo reescrito; para um novo escopo, cancele a OS após cancelar o pagamento e abra outra. O sistema bloqueia cancelamento de venda ligada a uma OS entregue; devoluções posteriores exigirão um fluxo próprio.

Use **Imprimir / PDF** na OS ou **PDF** na lista. O documento não fiscal inclui cliente, veículo, quilometragem, checklist, diagnóstico, responsável, peças/serviços, desconto, total, aceite, histórico, número da venda e formas de pagamento quando existentes. Pode ser impresso pelo leitor de PDF. A impressão física depende da impressora local.

## Acessos e atualização entre terminais

- Administrador/gerente: veículos, abertura/revisão, aprovação/recusa, recebimento, entrega e cancelamento.
- Atendente: consulta e PDF; pode iniciar/concluir execução apenas se for o responsável indicado na OS.
- Suporte: consulta/PDF, sem alterações.
- Master: acesso completo à empresa selecionada. Usuários técnicos da plataforma não aparecem como mecânicos para atribuição.

A OS e o veículo usam revisão para impedir que um terminal sobrescreva alterações do outro. Use **Atualizar** na página ou **Recarregar OS** nos detalhes após uma mensagem de conflito. Reabra um formulário antigo para carregar a revisão atual. Não há sincronização automática em tempo real nesta versão. Não é possível desativar o módulo enquanto houver ordens em atendimento.

## Limites desta etapa

Não inclui fotos/anexos, assinatura digital, envio de WhatsApp, agenda de oficina, integração de scanner, identificação automática por placa, consulta de aplicações de peças, reserva/consumo durante execução, garantia/devolução após entrega nem emissão fiscal. Orçamentos comerciais existentes continuam convertendo diretamente em venda; não são transformados automaticamente em OS. Para um atendimento mecânico, monte o orçamento dentro da própria OS.

## Validação da entrega

Validação em 27/10/2026, com Docker/PostgreSQL e Chromium:

- 94 verificações HTTP do módulo: veículos, placa/quilometragem, checklist, permissões, funcionário inativo, revisão, aprovação, execução, pagamentos, falta de caixa, múltiplas tentativas de recebimento, estoque único, cancelamento, PDF, módulos e duas empresas isoladas.
- 19 verificações adicionais: preservação do escopo aprovado após revisão e concorrência entre cancelamento do recebimento e entrega.
- 17 verificações no navegador: cadastro real de veículo, checklist, peças e serviço, aprovação, execução, pagamento dividido, conferência de soma, PDF, entrega, consulta em celular e acessos de atendente/Master/suporte; sem erros JavaScript.
- Regressão aprovada: 119 verificações comerciais e 109 da pizzaria.
- Instalação antiga sintética atualizada: 10 verificações de preservação de ID, credenciais, caixa, estoque, comandas e pagamentos após recriar containers.
- 3 verificações públicas de versão/cache; compilação Docker; lint sem erros e com os 12 avisos anteriores do projeto.

Reprodução somente no projeto descartável `pdv-commerce-test`: `node scripts/workshop-smoke.cjs`, depois `node scripts/workshop-concurrency.cjs` e `node scripts/workshop-browser.cjs`. Os dois primeiros usam empresas sintéticas criadas no teste; o último usa Playwright em `work/browser/node_modules/playwright` e Chromium em `/usr/bin/chromium`. O PDF foi aberto como texto para conferir os dados e pagamentos; a impressora física Windows não foi testada neste ambiente.
