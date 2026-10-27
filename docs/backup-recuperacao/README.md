# Backup e recuperação da instalação Docker local

Esta entrega acrescenta backup criptografado, cópia para pasta externa, retenção e ferramentas de recuperação. O destino externo fica para configuração posterior, conforme solicitado. Nenhuma tarefa foi ativada no computador do cliente nem há envio automático para um provedor de nuvem nesta entrega.

Requisitos: Docker Desktop e Windows PowerShell 5.1 com .NET Framework 4.7.2 ou superior, ou PowerShell 7. O [exemplo de configuração](../../docker/backup-config.example.json) deixa o destino indefinido. Ele não ativa a rotina; utilize o assistente de agendamento quando escolher a pasta.

## O que é preservado

Cada arquivo `.pdvbkp` contém o banco central, todos os bancos de empresas cadastrados, os papéis/permissões do PostgreSQL, a configuração da plataforma, o segredo das sessões e as credenciais de instalação. Produtos, clientes, usuários, mesas, vendas, pagamentos, compras, financeiro, logos e Pix estão nos bancos. Se existir `.pdv-local/mail.env`, uma cópia da configuração SMTP também entra no arquivo.

Os arquivos são protegidos com AES-256-CBC, autenticação HMAC-SHA256 e chave derivada por PBKDF2-SHA256 (300 mil iterações), com salt e IV aleatórios por backup. A assinatura é conferida antes de descriptografar. Um manifesto com SHA-256 confere os arquivos internos. Não há senha padrão: crie uma senha de pelo menos 16 caracteres e **guarde-a fora do computador**. Perder essa senha impede recuperar os arquivos.

A cópia temporária sem criptografia fica em uma pasta privada e é removida ao terminar, inclusive em falhas tratadas. Uma interrupção forçada do computador pode deixar uma pasta temporária em `.pdv-local`; trate essa pasta como dado privado. A rotina não substitui criptografia de disco.

## Fazer o primeiro backup manual

Na pasta do projeto, com Docker Desktop iniciado:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\backup.ps1
```

Digite a senha solicitada. O arquivo final fica em `.pdv-local\backups`. O script publica o arquivo somente após testar a criptografia e a integridade. Este comando gera apenas uma cópia local; não é proteção contra perda do computador.

**A interface e a API ficam pausadas durante a cópia dos bancos.** O script reinicia os serviços que estavam ativos antes de criptografar/copiar o arquivo final. Agende fora do funcionamento, sem outros acessos diretos ao banco ou provisionamentos paralelos. Backup, restauração e atualização compartilham um lock para evitar sobreposição.

Quando escolher um destino externo, crie primeiro uma pasta fora do repositório e execute, por exemplo:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\backup.ps1 -ExternalPath "D:\BackupsPDV" -RetentionDays 30
```

O destino pode ser um HD externo, pasta de rede ou pasta sincronizada. A rotina confere o hash da cópia na pasta. Em pastas de nuvem, confira também se o aplicativo terminou o upload: escrever na pasta local não confirma o envio à nuvem. Uma pasta diferente no mesmo disco só protege contra alguns erros locais.

Se a pasta externa estiver indisponível, a cópia local é preservada e a execução informa falha na segunda cópia. Arquivos `.partial` não são backups concluídos. A retenção apaga somente arquivos criptografados desta instalação, mais antigos que o prazo configurado, preservando pelo menos os três mais recentes. Arquivos antigos do atualizador e cópias de outras instalações não são removidos.

## Ativar o agendamento quando definir o destino

No Windows, execute com o usuário que utiliza o Docker Desktop:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\agendar-backup.ps1 -ExternalPath "D:\BackupsPDV" -Time "03:00" -RetentionDays 30
```

O assistente pede e confirma a senha. Ele salva uma cópia protegida por DPAPI, vinculada ao usuário e computador, em `.pdv-local\backup-key.txt`. Esse arquivo não substitui guardar a senha de recuperação em outro local. A tarefa recebe um nome `SistemaPDV-Backup-...` exclusivo para a pasta desta instalação.

A tarefa executa diariamente no horário escolhido e no login do Windows, sem criar cópias repetidas no login quando houve cópia externa bem-sucedida nas últimas 18 horas. Há três novas tentativas, a cada dez minutos, quando ocorrer falha. **O usuário precisa estar conectado e o Docker Desktop iniciado.** Computador desligado não executa backups. Não foi criada uma tarefa de servidor que opere sem login.

Faça um backup manual com o mesmo destino após configurar. Depois confira no Agendador de Tarefas a execução real, o resultado `0` e a chegada do arquivo ao destino. Os logs ficam em `.pdv-local\backup-logs`; os resumos em `backup-status.json` e `backup-failure.json`. Compare as datas: um sucesso antigo não elimina uma falha mais recente.

Para desativar apenas a tarefa desta instalação:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\agendar-backup.ps1 -Disable
```

Se mudar a pasta do projeto, desative a tarefa antes da mudança e configure novamente no novo local. Se trocar a senha de criptografia, guarde também as senhas dos arquivos antigos. Não coloque senhas em comandos, capturas ou arquivos versionados.

## Testar uma recuperação sem substituir a instalação

Use o código na mesma versão indicada no backup e uma porta disponível. O script aceita somente um projeto novo com prefixo `pdv-recovery-`, sem containers ou volumes existentes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\restaurar-backup.ps1 -BackupFile "D:\BackupsPDV\SEU-ARQUIVO.pdvbkp" -TargetProject "pdv-recovery-conferencia" -Port 8093
```

Digite a senha original do arquivo. O script verifica assinatura, manifesto e versão antes de criar o destino. Em seguida reconstrói as imagens, recupera os volumes de configuração/segredos, restaura papéis e bancos, executa o provisionamento e confere a saúde dos serviços. Ele recusa destinos já existentes e não apaga volumes ou bancos para tentar novamente. Em caso de falha, mantém o destino incompleto e interrompe sua interface/API; escolha outro nome após investigar o erro.

Abra `http://127.0.0.1:8093/login`. Use os usuários e senhas válidos na data do backup; Master e suporte continuam em `/support`. Confira usuários, ID do cliente, produtos, estoque, mesas abertas, vendas, pagamentos e saldos. Não opere vendas reais em duas cópias da mesma instalação. O teste recupera apenas o que estava no backup; alterações posteriores não serão incorporadas.

A configuração SMTP incluída no arquivo não é aplicada sobre `.pdv-local/mail.env` do computador atual. Para uma recuperação definitiva em outro computador, extraia-a com o procedimento abaixo e revise a URL pública e credenciais antes de usar. O agendamento/DPAPI também deve ser configurado novamente.

### Recuperação definitiva em outra máquina

Instale Git/Docker Desktop, obtenha o repositório na versão do backup e copie o `.pdvbkp` para uma pasta protegida. Execute a restauração acima; ela não precisa de uma instalação anterior funcionando, mas exige acesso às imagens/dependências para o build. Depois da conferência, crie um `.env` privado na raiz do repositório:

```dotenv
COMPOSE_PROJECT_NAME=pdv-recovery-conferencia
PDV_LOCAL_PORT=8093
```

Use o nome/porta escolhidos. Isso direciona os próximos `docker compose` e o atualizador para a instalação recuperada. Não crie esse arquivo sobre a instalação original enquanto estiver apenas fazendo um teste. Só depois da conferência prossiga com atualizações e configure backups novamente.

Para recuperar a configuração SMTP opcional, sem imprimir seu conteúdo, use [extrair-configuracao.ps1](../../docker/extrair-configuracao.ps1), indicando uma pasta de saída nova:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\extrair-configuracao.ps1 -BackupFile "D:\BackupsPDV\SEU-ARQUIVO.pdvbkp" -OutputDirectory ".pdv-local\smtp-recuperado"
```

 A extração pede senha, verifica o arquivo e salva somente `mail.env` na pasta privada indicada; não restaura bancos nem aplica as credenciais automaticamente.

## Validação desta entrega

Os testes usam dados sintéticos em projetos Docker separados. A rotina foi executada com PowerShell 7 em Linux e PostgreSQL 16. A criação da tarefa/DPAPI e as permissões NTFS precisam da conferência no Windows real, pois o Agendador de Tarefas não existe no ambiente de testes.

| Verificação | Resultado |
| --- | --- |
| `scripts/recovery-safety-test.ps1` | 24 verificações aprovadas: criptografia, senha incorreta, adulteração, truncamento, extração SMTP, caminhos ZIP, manifesto, retenção, isolamento de volumes e sintaxe PowerShell. |
| `scripts/recovery-integration-test.cjs` | 32 verificações aprovadas. Banco central e três bancos de empresas recuperados com todas as tabelas e linhas idênticas à origem, antes dos novos registros de auditoria dos logins de teste. Login comum, Master/ID, suporte e isolamento conferidos. |
| `scripts/recovery-guards-test.cjs` | 4 proteções aprovadas: senha incorreta, destino já existente, nome de produção recusado e lock simultâneo. |
| `scripts/recovery-external-test.cjs` | Destino externo ausente: cópia local preservada, saída de erro e retomada da API confirmadas. |
| Execução real dos scripts | Backup criptografado, cópia verificada em uma segunda pasta de teste, restauração em projeto separado e conferência da configuração Compose aprovados. A pasta de teste não representa upload real à nuvem. |

Os testes não alteram a instalação do computador do cliente. A validação de negócio anterior não foi repetida integralmente, pois esta entrega não altera as telas nem as regras de vendas. A recuperação atual exige a mesma versão do sistema do arquivo; depois de recuperar, utilize a atualização normal. Mantenha também a versão/commit do código junto do seu inventário de backups.
