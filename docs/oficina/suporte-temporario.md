# Mark 0.17.0 — Acessos temporários do suporte

Em **Acesso do fornecedor** (`/support`), entre com a conta Master e carregue as empresas. O painel **Acessos temporários — exclusivo Master** aparece abaixo das empresas. Administradores das empresas não podem emitir códigos; o suporte também não.

Selecione empresa ativa, operador de suporte registrado na plataforma (não Master), validade de 5, 15, 30 ou 60 minutos e motivo. **Gerar código temporário** produz um segredo aleatório forte, mostrado somente nessa emissão. O banco guarda apenas SHA-256, não o código recuperável. Não usa ID de cliente nem muda senhas existentes.

Entregue o código diretamente ao operador autorizado. Para validar sem sair da conta Master, use uma janela anônima para o operador de suporte. Em `/support`, ele escolhe **Entrar com código temporário**, informa o usuário do fornecedor e o código. Não precisa receber a senha permanente do suporte. O código vale para um único uso, uma empresa e aquele operador. Não abre a lista de outras empresas nem concede acesso Master.

A sessão é **somente consulta**, com no máximo 15 minutos, limitada também ao vencimento do código. Reutilização, expiração e revogação impedem entrada. **Revogar acesso temporário** exige motivo e encerra também a sessão já iniciada por esse código. Desativação/alteração de credencial do operador continua invalidando suas sessões.

O painel lista até 100 emissões recentes, motivo, validade, uso e revogação, sem revelar códigos antigos. Emissão, uso e revogação são auditados na plataforma. Não há envio automático por WhatsApp/e-mail, concessão de escrita por código ou criação automática de novos operadores. O login permanente Master/suporte permanece disponível pelo fluxo existente.

Validação: 32 verificações HTTP aprovadas. `node scripts/support-access-smoke.cjs`, somente no projeto Docker descartável. Não compartilhar fixtures de teste ou códigos em capturas/logs. Códigos expirados/revogados são preservados para auditoria.
