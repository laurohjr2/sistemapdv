# Alterações do PDV local

Base: `c5a34ac`, branch `feat/pdv-base-fila-mesas`. A instalação continua usando Docker Compose, PostgreSQL e volumes persistentes. As migrações são aditivas e executadas pelo provisionador, sem reset do banco.

## Lista de solicitações atendidas

| Solicitação | Comportamento entregue |
| --- | --- |
| Mostrar senha no login | Botão de olho alterna mostrar/ocultar, com identificação acessível. |
| Esqueci minha senha | Solicitação por código da empresa, usuário e e-mail cadastrado; link por SMTP com TLS, validade de 15 minutos e uso único. Trocar a senha invalida sessões anteriores. |
| Venda sem caixa | Mensagem “Você precisa abrir um caixa para vender” na tentativa de adicionar produto ou finalizar sem caixa. A API também recusa a operação. |
| Operador cadastrado | O responsável pelo caixa é o usuário autenticado. O nome não pode ser digitado ou substituído pelo navegador. |
| Desconto em Vendas | Administrador e gerente informam desconto em reais diretamente no carrinho. O servidor verifica permissão e limite. |
| Valores monetários | Campos monetários inserem centavos, vírgula decimal e separador de milhar durante a digitação. Valores enviados à API continuam numéricos. |
| Pix nas vendas | Ao selecionar Pix, a tela mostra o QR Code e/ou chave cadastrados pelo estabelecimento em Configurações. Também disponível ao receber mesas e comandas. |
| Logo de 2 MB | PNG/JPEG de até 2 MB e 2048 × 2048 pixels, com validação no navegador e servidor. O proxy aceita o envio simultâneo da logo e QR Code. |
| Comanda dentro de Mesas | Abrir mesa, informar ou vincular cliente, consultar itens e preparo, adicionar produtos e observações, imprimir conferência e receber a conta sem sair do menu. |
| Divisão da conta | Divisão igual entre pessoas, distribuindo os centavos restantes na última parcela, ou parcelas manuais. Cada parcela pode usar uma forma de pagamento. A soma precisa conferir antes de fechar. |
| Cupom e relatórios de pagamentos | Parcelas ficam registradas na comanda e aparecem no cupom/PDF, relatório financeiro e conferência do caixa por forma de pagamento. |
| Cadastro de clientes | Menu Clientes com nome, telefone, e-mail, observações e status. Clientes podem ser vinculados a mesas e vendas, formando a base para futuras regras de fidelidade. Não foi criada uma regra automática de fidelidade. |
| Fila dentro de Mesas | O menu separado saiu da navegação. A fila continua operacional, acessível por botão dentro de Mesas, com acomodação e histórico existentes. |
| Menu Impressão | Removido da navegação. Impressão de contas ocorre na mesa/comanda e os relatórios oferecem PDF. Rotas antigas continuam compatíveis. |
| Ícone da aba | A logo cadastrada passa a ser o favicon; removê-la restaura o ícone padrão. |
| Ranking de vendedores | Ranking em Relatórios, com operações e receita por funcionário no período escolhido e PDF para impressão. Apenas gerente, administrador e Master podem acessá-lo. Comandas são atribuídas a quem abriu a conta; recebê-las não transfere a venda para o caixa. |
| Inativação de usuários | Lixeira inativa o usuário e preserva o histórico. Login e sessões são bloqueados; a edição permite reativar. Usuários ocultados pela exclusão lógica antiga também aparecem para recuperação. |
| Master/Admin total | Conta central exclusiva pode selecionar e operar qualquer empresa cadastrada. A operação usa um usuário da plataforma para manter as referências de histórico e uma trilha central de auditoria. |
| ID do cliente restrito | Exibido em Configurações exclusivamente na sessão de suporte ou Master/Admin. Administradores comuns das empresas não ganham acesso global nem ao ID interno. |
| Cozinha e mesas | Itens da comanda usam os mesmos registros da cozinha. Mesas consulta o estado a cada 10 segundos e avisa qual produto ficou pronto e para qual mesa. A comanda permite marcar a entrega. |
| Relatório no Estoque | Botão para gerar PDF com a posição de estoque. |
| Relatório nos Produtos | Botão para gerar PDF com cadastro, preços e estoque, incluindo produtos sem vendas. |

## Atualizar no Windows preservando os dados

Não precisa parar o Docker Desktop. Para atualizar, reserve um momento sem operação no caixa e faça backup dos três conjuntos de dados: bancos, configuração da plataforma e segredos. Não copie apenas o banco da empresa.

Na pasta do projeto, PowerShell:

```powershell
$backup = ".pdv-local\backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force $backup

docker compose stop frontend backend
docker compose exec -T database pg_dumpall -U postgres -f /tmp/pdv-backup.sql
docker compose cp database:/tmp/pdv-backup.sql "$backup\bancos.sql"
docker compose cp provision:/state "$backup\state"
docker compose cp provision:/secrets "$backup\secrets"
docker compose exec -T database rm /tmp/pdv-backup.sql

git switch feat/pdv-base-fila-mesas
git pull --ff-only
docker compose up -d --build --wait --wait-timeout 240
```

Confira se todos os comandos de backup terminaram sem erro antes de prosseguir. Guarde a pasta de backup em local protegido: contém dados e credenciais. Se o Git apontar alterações locais ou conflito, preserve seus arquivos e resolva isso antes de continuar. Use Docker Desktop atual (Compose 2.24 ou superior para o arquivo de ambiente opcional).

**Nunca execute `docker compose down -v` nem apague os volumes.** A atualização usa os mesmos volumes e preserva produtos, usuários, empresas, histórico e credenciais. Após a atualização, faça login novamente: as sessões passam a conferir a versão da senha.

## Acesso Master/Admin e suporte

A instalação gera sua conta central de fornecedor `master.local`, única para selecionar e operar várias empresas. Ela não aparece na lista de usuários cadastrados pelo cliente e não promove o administrador da empresa nem a conta de suporte. Os registros técnicos de autoria são mantidos para preservar o histórico.

Consulte as credenciais locais com o comando já usado na instalação:

```powershell
docker compose run --rm --no-deps provision node /app/docker/local.cjs credentials
```

A saída contém senhas. Não compartilhe nem inclua em capturas de tela ou no Git. A seção **Master** informa a senha inicial de `master.local`. Entre em `http://localhost:8080/support`, escolha a empresa e acesse os menus. O ID do cliente aparece em Configurações. A conta `support.local` permanece somente para consulta. O acesso global abrange as empresas cadastradas nesta mesma plataforma; instalações Docker independentes têm bancos e credenciais próprios. Sessões de acesso a empresas duram 15 minutos e podem ser encerradas pelo botão “Sair do suporte”.

As contas da plataforma não podem ser alteradas ou inativadas por administradores de clientes. O comando mostra apenas as senhas iniciais.

## Configurar recuperação de senha

Cadastre um e-mail válido para cada usuário no menu Usuários. Crie `.pdv-local/mail.env` no computador da instalação:

```dotenv
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-do-smtp
SMTP_PASSWORD=senha-do-smtp
MAIL_FROM=PDV <pdv@seu-dominio.com>
APP_PUBLIC_URL=http://localhost:8080
```

Na porta 587, a conexão exige STARTTLS; para TLS direto na porta 465, use `SMTP_SECURE=true`. A verificação de certificados permanece habilitada. `APP_PUBLIC_URL` precisa ser o endereço correto pelo qual o usuário acessa a instalação. `localhost` só funciona no mesmo computador.

Depois, execute `docker compose up -d --force-recreate backend` e teste “Esqueci minha senha”. O arquivo é privado, opcional e ignorado pelo Git. O envio depende de SMTP configurado e acessível. Para não revelar quais contas existem, a resposta pública é sempre genérica; falhas de envio geram apenas diagnóstico sem senha ou link nos logs.

## Pix e limites

O QR Code é fornecido pelo estabelecimento. O sistema exibe a imagem/chave e não consulta o banco para confirmar recebimento nem altera o valor embutido em um QR Code estático. Confira o recebimento antes de concluir. A divisão registra o recebimento integral da conta em várias parcelas no mesmo fechamento; não é um fluxo de pagamentos parciais pendentes ao longo do atendimento.

Impressão pelo navegador e PDF foram exercitados; impressora física Windows e um provedor SMTP externo do cliente precisam ser configurados na instalação real. A versão continua sendo uma instalação local para testes, sem implantação pública nesta entrega.

## Validação

As evidências e os comandos para os testes estão em [VALIDACAO.md](VALIDACAO.md).
