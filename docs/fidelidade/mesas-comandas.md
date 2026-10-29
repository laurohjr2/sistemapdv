# Mark 0.20.0 — Fidelidade em mesas e comandas

Amplia a condição percentual por cliente da Mark 0.16.0 para recebimento de mesas e comandas de balcão. A condição é cadastrada no menu **Fidelidade**; o desconto é conferido e aplicado por gerente/administrador ou Master. Não altera automaticamente contas antigas.

## Mesas

1. Em **Mesas**, abra ou consulte a comanda.
2. Selecione o cliente cadastrado. Salve o vínculo com **Salvar cliente na comanda**, se a conta já estiver aberta. Nome livre sem vínculo de cadastro não habilita fidelidade.
3. Lance os produtos e clique **Aplicar fidelidade na comanda**.
4. Confira o valor líquido e preencha os pagamentos novamente. **Dividir igualmente** usa o total após desconto; é possível receber em métodos diferentes.
5. Use **Receber, fechar e imprimir**. O cupom identifica a condição de fidelidade, o desconto e os pagamentos.

## Comandas

1. Abra uma comanda e clique **Fechar Comanda**.
2. Confira **Cliente cadastrado**. Se necessário, escolha o cliente e clique **Salvar cliente vinculado**.
3. Clique **Aplicar fidelidade na comanda**, escolha o pagamento e confira o total líquido.
4. Feche a comanda. O benefício é preservado no registro da conta e no PDF disponível para impressão/reimpressão.

Alterar manualmente desconto em valor ou percentual retira a seleção de fidelidade; os valores passam a seguir o desconto manual autorizado. Não soma fidelidade a outro desconto.

## Conferência entre terminais

A prévia usa o cliente e os itens gravados no servidor. Se itens, quantidades, vínculo do cliente ou condição percentual mudarem entre a conferência e o fechamento, atualize a conta e aplique novamente. **Atualizar benefício** recarrega a condição do cliente; **Atualizar comanda** recarrega a conta. Cliente inativo, regra inativa ou vencida não recebe benefício novo.

A condição usada no fechamento é congelada no histórico: mudar depois o nome/percentual/validade do programa não reescreve o benefício aplicado. O desconto é recalculado em centavos no servidor e deve corresponder à prévia e ao valor enviado para recebimento. Pagamentos precisam somar o total líquido. Fechamentos simultâneos não duplicam benefício, venda ou recebimento.

A baixa de estoque continua no lançamento dos itens, pelo fluxo já existente. Aplicar/receber fidelidade não baixa estoque novamente e não cria uma segunda venda.

## Histórico, pendência e impressão

**Fidelidade → Benefícios aplicados** reúne vendas diretas e comandas, com origem, cliente, condição aplicada, desconto e situação. O PDF reúne os mesmos registros, até os 500 mais recentes, com filtro por cliente.

Comanda fechada com pagamento pendente preserva a condição aprovada, mas aparece como **Pendente** e não entra no total efetivo de benefícios recebidos. Após registrar o pagamento pelo fluxo normal, passa a **Concluída**, sem recalcular a condição antiga. Os totais financeiros do sistema usam o valor líquido recebido. Os cartões de recebimento e ticket médio em Comandas também consideram valores líquidos pagos.

O cupom de comanda é identificado como **não fiscal** e mostra o benefício e os meios de pagamento. A geração de PDF/HTML não confirma impressão física.

## Permissões

Nova ação: **Aplicar fidelidade em mesas e comandas** (`loyalty.tables`). Requer consulta de fidelidade, desconto autorizado, recebimento de comandas e consultas operacionais de cliente/catálogo. Não exige permissão para realizar venda direta.

Master e administradores continuam dentro de seus acessos próprios; gerente no modelo anterior segue as regras de gerência existentes. Para um funcionário com perfil restrito, libere a nova ação explicitamente em **Acessos e permissões**. A atualização não acrescenta essa autorização aos perfis restritos já gravados. Vincular/alterar cliente na conta é uma ação separada de atendimento.

Suporte mantém consulta; não aplica benefício. As verificações de empresa, caixa aberto, papel, módulo habilitado e dados do cliente permanecem em vigor.

## Notificação de salvamento

A confirmação **Acessos salvos com sucesso** passou de seis para **dois segundos**, conforme solicitado. Continua aparecendo somente após o servidor confirmar a gravação, com identificação do usuário e contraste nos temas claro/escuro.
