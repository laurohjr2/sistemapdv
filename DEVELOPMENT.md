# Desenvolvimento do PDV

A base enviada em `bar_system_final.rar` foi importada para este repositório. O arquivo original está preservado. Esta é uma versão de desenvolvimento de um único estabelecimento; assinaturas, isolamento entre empresas, master de suporte e impressão física ainda não estão implementados e validados.

## Preparação

Requer Node.js 24, npm, Docker e curl. O frontend usa pnpm 10.4.1 via npx. Execute na pasta `/workspace/sistemapdv`:

```bash
bash scripts/install.sh
bash scripts/start.sh
node --env-file=.pdv-local/development.env scripts/smoke.mjs
```

O banco PostgreSQL 16 roda no container `pdv-dev-db`. A porta 5432 está limitada ao loopback, com autenticação trust exclusivamente para desenvolvimento. Não use essa configuração em produção. `database.sh` preserva o container existente; se precisar recriá-lo, restaura `.pdv-local/development.sql` quando disponível.

A API usa a porta 3000 e o Vite usa 5173, encaminhando `/api` para o servidor. As instruções são para execução e verificação internas; este ambiente não oferece preview público.

`init-dev.cjs` cria uma chave JWT e uma senha aleatórias apenas se o arquivo local ainda não existir. O administrador de desenvolvimento é `admin.dev`; a senha fica em `.pdv-local/development.env`, ignorado pelo Git. Não publique esse arquivo nem utilize essa conta em produção. Nenhum segredo do arquivo enviado foi importado.

Os logs e PIDs dos serviços iniciados pelo script ficam em `.pdv-local/`. Antes de reiniciar um serviço, encerre somente o processo correspondente iniciado nesta tarefa, verificando seu PID e diretório. Não execute outra cópia sobre uma porta já ocupada.

## Validação atual

O smoke testa autenticação, restrição de acesso sem login, cadastro de produto, entrada e acerto de estoque, mesa, comanda, baixa de estoque, pagamento, liberação da mesa, PDF, venda no balcão, preço calculado no servidor, estoque insuficiente, estorno único, relatórios e fila de espera. Cria dados fictícios e os mantém no banco local. O teste não substitui testes visuais ou em impressoras físicas.

Para atualizar a cópia local do banco antes de publicar o ambiente:

```bash
docker exec pdv-dev-db pg_dump -U postgres bar_management > .pdv-local/development.sql
chmod 600 .pdv-local/development.sql
```

A cópia local é uma facilidade de desenvolvimento, não uma política de backup de produção. Processos e volumes Docker não devem ser considerados restaurados em novas tarefas: use as instruções de inicialização e valide a saúde e os fluxos novamente.

## Correções iniciais

- Referência de produto em tickets compatível com UUID.
- Associação do usuário que fecha a comanda, necessária ao PDF.
- API relativa com proxy de desenvolvimento e rota correta para abrir comanda.
- Campos de preço e estoque do PDV alinhados ao cadastro de produtos.
- Venda e estorno com transação, bloqueio de registros e cálculo de preços no servidor.
- Removida a segunda atualização de estoque feita pelo navegador após uma venda.
- Soma numérica dos valores no fechamento do caixa.

## Próximas etapas

Conferir caixa e relatórios com todas as formas de pagamento e comandas; fortalecer as transações de estoque/comandas; integrar impressão por setor. O serviço de impressão física antigo simula sucesso e não deve ser tratado como impressão real.

O sistema ainda não está pronto para comercialização. O código antigo possui fluxos adicionais que não foram abrangidos por esta validação inicial, como tickets e todos os filtros de relatórios.

## Fila de clientes integrada (segunda etapa)

`/queue` agora mostra clientes aguardando mesas; `/kitchen` preserva o painel antigo de preparo. Nome, telefone e quantidade de pessoas são levados à comanda ao acomodar. A escolha mostra apenas mesas livres que comportam o grupo. A confirmação ocupa a mesa, cria a comanda e vincula o registro da fila em uma única transação. O histórico mostra acomodados e cancelados, com acesso à comanda vinculada. O histórico preserva o vínculo mesmo depois de fechar a conta.

A migração `src/migrations/queueSeating.js` adiciona somente as colunas de vínculo à fila e é executada na inicialização. O backup anterior fica em `.pdv-local/before-seating.sql`. Registros antigos sem quantidade de pessoas não podem ser acomodados até que essa informação seja corrigida; a tela exige quantidade nos novos registros.

A abertura direta de mesa e a abertura pela fila usam o mesmo bloqueio no banco, impedindo duas comandas concorrentes na mesma mesa. A tela de comandas também foi alinhada ao formato paginado da API, UUID dos produtos, campos de estoque e método PUT de fechamento.

Na instância atual, portas anteriores estavam ocupadas. Foram validados estes comandos com portas alternativas:

```bash
PDV_API_PORT=3200 PDV_WEB_PORT=5175 bash scripts/start.sh
PDV_API_URL=http://127.0.0.1:5175/api node --env-file=.pdv-local/development.env scripts/smoke.mjs
PDV_API_URL=http://127.0.0.1:5175/api node --env-file=.pdv-local/development.env scripts/seating-smoke.mjs
```

O smoke geral passou com 28 verificações HTTP. O smoke da integração passou com 36 verificações HTTP, cobrindo capacidade, campos obrigatórios, indisponibilidade, repetição, histórico e concorrência entre atendentes e entre as diferentes rotas de abertura. Os testes mantêm dados fictícios no banco de desenvolvimento.

O fluxo de navegador passou com Chromium: login, cadastro do cliente, acomodação, acesso à comanda, inclusão de produto, pagamento, liberação da mesa e fila em viewport móvel de 390px. O teste opcional de navegador pode ser repetido sem alterar dependências da aplicação:

```bash
npm install --prefix /tmp/pdv-browser --no-save --no-audit --no-fund playwright
NODE_PATH=/tmp/pdv-browser/node_modules PDV_WEB_URL=http://127.0.0.1:5175 node scripts/browser-smoke.cjs
```

Esse teste requer `/usr/bin/chromium`. As capturas locais ficam em `.pdv-local/comanda-browser.png` e `.pdv-local/fila-mobile.png` e contêm apenas os dados fictícios usados na validação. Esta validação não abrange o funcionamento completo da cozinha, alteração de quantidades de itens existentes, impressão física ou todos os relatórios financeiros.

## Configurações do estabelecimento

O menu Configurações permite cadastrar nome da empresa, razão social, CNPJ numérico ou alfanumérico com verificação de dígitos, telefone, e-mail, endereço, cidade, UF, CEP, mensagem de agradecimento e logo PNG/JPEG de até 256 KB e 2048 × 2048 pixels. Apenas admin pode editar; gerente pode acessar a tela para consulta. A API autenticada fornece os dados para comprovantes dos funcionários; a rota pública `/api/settings/branding` retorna somente nome e logo para o login.

Os dados ficam na tabela `business_settings`, criada de forma aditiva pelo sync normal, sem force/reset. O cadastro pertence ao estabelecimento desta instalação. Ainda não existe isolamento SaaS entre diferentes empresas no mesmo banco; isso permanece necessário antes de hospedar vários clientes juntos.

O nome/logo são usados no login e na navegação. Dados de identificação são aplicados nos comprovantes HTML e PDFs, incluindo cabeçalhos de relatórios. O cadastro não configura emissão fiscal. A tela e a API não incluem credenciais, assinatura ou permissões de suporte.

Validação: compilação do frontend, 27 verificações HTTP específicas (cadastro, persistência, CNPJ, logo, edição parcial, remoção, permissões e conteúdo do PDF), 28 verificações HTTP gerais e teste no Chromium com gravação, reload, upload, remoção de logo e layout móvel. Os testes específicos restauram o cadastro anterior ao finalizar. A imagem `docs/images/configuracoes.png` usa dados fictícios.

```bash
PDV_API_PORT=3500 PDV_WEB_PORT=5178 bash scripts/start.sh
PDV_API_URL=http://127.0.0.1:5178/api node --env-file=.pdv-local/development.env scripts/settings-smoke.mjs
NODE_PATH=/tmp/pdv-browser/node_modules PDV_WEB_URL=http://127.0.0.1:5178 node scripts/settings-browser.cjs
```

O teste HTTP de PDF requer `pdftotext`, disponível nesta máquina. O teste de navegador requer a instalação temporária de Playwright descrita acima e utiliza `scripts/fixtures/logo.png`, uma imagem sintética de teste. Impressoras físicas continuam fora da validação.

## Correções após auditoria (26/10/2026)

A validação atual está em [docs/validacao-20261026/README.md](docs/validacao-20261026/README.md), com resultados, imagens e limites. Substitui as limitações de fluxos relatadas nas etapas anteriores deste documento. A migração `auditFixes.js` é aditiva; inicialização padrão preserva os dados. Usuários agora têm e-mail/status e exclusão lógica. Tickets novos registram a venda no caixa. Receber comanda exige caixa aberto; apenas contas pagas entram nas receitas. Estorno de venda em caixa fechado é recusado para preservar a conferência histórica. Não force reset do banco para preparar o ambiente.

Os scripts de teste foram ajustados para abrir caixa explicitamente quando necessário. O relatório antigo é histórico, não o estado atual. Impressão física, conector Windows e funcionalidades SaaS continuam pendentes.

## Plataforma multiempresa — estado atual

A configuração vigente está em [docs/multiempresa-20261026/README.md](docs/multiempresa-20261026/README.md). Substitui as notas anteriores de banco único por instalação. O código da empresa `demo` deve ser informado no login de desenvolvimento; o ID interno não é exposto aos usuários da empresa.

O runtime precisa de `.pdv-local/platform.json`, do arquivo de ambiente privado e dos bancos provisionados. Execute o bootstrap pelos scripts; não faça sync/reset de um banco arbitrário no servidor HTTP. Antes de publicar o ambiente, execute `node --env-file=.pdv-local/development.env scripts/platform-backup.cjs` para reter banco central e todos os bancos de empresas. Preservar somente o antigo development.sql não é suficiente. A restauração da plataforma é chamada pelo database.sh e foi exercitada em instância PostgreSQL separada. Clonar só o repositório inicia uma demonstração nova, sem recuperar empresas anteriores.

Credenciais privadas e snapshots não entram no Git. Os nomes dos arquivos não são segredos, mas seus conteúdos são. O seed antigo foi desativado para evitar apagar dados de empresas. O suporte usa conta central, sessão de consulta de 15 minutos e trilha de auditoria; a tela não oferece edição no modo suporte.
