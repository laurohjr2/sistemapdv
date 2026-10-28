# Mark 0.14.0 — Garantias e retornos

Menu **Garantias e retornos**, com o módulo Oficina habilitado. Gerência/Master registra e dá parecer; equipe e suporte consultam.

Em **Registrar garantia**, selecione uma OS entregue e recebida, prazo final, limite de km opcional e descreva os itens, serviços e condições cobertos. O início é a data de entrega da OS no horário de São Paulo. Apenas um registro por OS; condições são preservadas. Para corrigir um registro incorreto, cancele com motivo; não apaga a OS, pagamentos ou direitos do consumidor. O sistema não define prazos legais ou contratuais automaticamente.

**Registrar retorno** guarda relato, data e km. Mesmo fora dos limites de prazo/km, é possível registrar para análise; não há recusa automática. Só um retorno em análise/atendimento por garantia. Gerência aceita ou recusa com parecer. Retorno aceito pode ser vinculado a outra OS ativa do mesmo veículo e cliente, criada no menu Oficina. Depois, marque o retorno como concluído com observação.

Não presume gratuidade, cobertura legal, devolução de dinheiro ou peças. Custos e execução usam o fluxo normal da nova OS. Nenhuma movimentação de caixa/estoque é gerada pelo registro/parecer do retorno. Retornos pendentes impedem desativar Oficina.

**Imprimir garantia e retornos** baixa PDF com condições e pareceres. Registros cancelados e históricos permanecem visíveis. Validação automatizada: `node scripts/workshop-warranty-smoke.cjs`, 40 verificações aprovadas em empresas sintéticas. Build e lint sem erros, com os avisos preexistentes.
