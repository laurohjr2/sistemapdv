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

Conferir caixa e relatórios com todas as formas de pagamento e comandas; fortalecer as transações de estoque/comandas; completar configurações e logo; integrar impressão por setor. A saída PDF tem dados fixos herdados do projeto antigo. O serviço de impressão física antigo simula sucesso e não deve ser tratado como impressão real.

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
