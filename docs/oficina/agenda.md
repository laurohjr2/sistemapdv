# Mark 0.13.0 — Agenda da oficina

Menu **Agenda da oficina**, visível com o módulo Oficina habilitado. Gerência/Master agenda e atualiza; equipe consulta. O suporte permanece somente leitura.

Escolha um veículo cadastrado e ativo, responsável registrado e ativo, início/fim e motivo. Duração entre 15 minutos e oito horas. O sistema bloqueia horários sobrepostos para o mesmo veículo ou responsável, inclusive entre terminais. Horários consecutivos são permitidos. Datas são apresentadas no fuso do dispositivo; use o fuso correto no computador do estabelecimento.

Um horário agendado pode ser reagendado, marcado como chegada, ausência ou cancelamento. Depois da chegada, conclua ou cancele. As mudanças exigem observação e mantêm histórico. Não existe exclusão permanente. Pode-se vincular uma OS ativa do mesmo cliente e veículo; a OS é criada no fluxo normal de Oficina. Agendar não cobra, reserva peças ou envia lembretes externos. Concluir o horário não conclui a OS.

Agendamentos pendentes impedem desativar o módulo Oficina. Filtre a lista por dia; a consulta mostra até mil horários, e a API permite períodos de até 93 dias.

Validação: `node scripts/workshop-agenda-smoke.cjs`, 23 verificações em empresas sintéticas. Build concluído e lint sem erros (12 avisos preexistentes). Atualização pelo procedimento normal `git pull --ff-only` e `docker/atualizar.ps1`.
