# Validação das alterações do PDV local

Executada em Docker Engine/Compose Linux e Chromium real. Foram usados projetos e volumes fictícios separados (`pdv-changes-test` e `pdv-upgrade-test`). A instalação original `sistemapdv-local` foi mantida. Não houve teste em uma máquina Windows física.

| Verificação | Resultado |
| --- | --- |
| Frontend em produção | Compilação Vite aprovada. Há aviso de tamanho do bundle, sem falha de build. |
| Imagens Docker | Frontend Nginx e backend Node.js 24 compilados; preparação e provisionamento terminam com código 0; serviços saudáveis. |
| Lint | Zero erros; 12 avisos nas regras já presentes de hooks/fast refresh. |
| Novos fluxos HTTP | 75 verificações aprovadas: caixa autenticado, clientes, vínculos, desconto por perfil, conta dividida, soma inválida sem fechar a mesa, cozinha, PDFs, ranking restrito, usuários inativados/reativados, Master oculto do cadastro, suporte somente leitura, logo exatamente 2 MB e rejeição acima do limite. |
| Recuperação de senha | E-mail enviado de fato ao SMTP de teste com TLS e certificado validado. O teste lê o link recebido, redefine a senha, confirma revogação das sessões antigas e rejeita reutilização e expiração. Não envia e-mails externos. |
| Arredondamento | Caso de R$ 0,25 com desconto de 54% resulta em R$ 0,12 tanto no banco quanto nas parcelas, sem diferença de centavos. |
| Navegador | 16 verificações aprovadas, sem erros JavaScript: olho da senha, operador fixo, máscara `1.234,56`, cliente na mesa, inclusão de produto, divisão em parcelas, exibição do Pix, fechamento, favicon, fila integrada, ranking/PDF, relatórios de estoque/produtos, permissão de funcionário e recuperação em viewport móvel. |
| Isolamento | 12 verificações aprovadas entre empresas distintas: cliente/mesa/venda não atravessam o limite da empresa; Master opera a empresa selecionada, vê o ID e perde o acesso ao encerrar a sessão. |
| Regressão existente | 135 verificações: fluxo geral (30), fila/acomodação e concorrência (36), integridade de estoque/caixa/tickets/pagamentos (42), configurações (27). Os scripts existentes foram executados com usuário/URL adaptados à instalação Docker fictícia. |
| Atualização de versão | Uma instalação separada foi iniciada com as imagens anteriores do commit `c5a34ac`. Foram preparados usuários, produto, estoque, caixa, comanda aberta e mensagem de comprovante. Após substituir as imagens, as senhas, IDs e dados permaneceram e a comanda antiga aceitou pagamento dividido. |
| Persistência | Parada com `down` e recriação com `up` preservam os volumes, o ID da empresa, credenciais, caixa, estoque, histórico e parcelas da conta. Preparação, migração e persistência tiveram 12, 10 e 10 verificações HTTP, respectivamente. |
| Backup | Dump de todos os bancos e cópia de `/state` e `/secrets` do provisionador conferidos na instalação fictícia; nenhum conteúdo privado entrou nas evidências ou no Git. |

## Reproduzir os testes novos

Somente em uma instalação descartável. Requer Node.js 24, Docker Compose, OpenSSL, `pdftotext` e, para o navegador, Chromium e Playwright. Execute na raiz do repositório, em shell Linux:

```bash
mkdir -p work/smtp
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout work/smtp/key.pem -out work/smtp/cert.pem -days 2 \
  -subj '/CN=smtp-test' -addext 'subjectAltName=DNS:smtp-test'

PDV_LOCAL_PORT=8090 docker compose -p pdv-changes-test \
  -f compose.yaml -f docker/customer-experience-test.yaml \
  up -d --build --wait --wait-timeout 240

node scripts/customer-experience-smoke.cjs
npm install --prefix work/browser --no-save --no-audit --no-fund playwright
node scripts/customer-experience-browser.cjs
node scripts/customer-experience-isolation.cjs
```

O SMTP incluído é um coletor local de teste, escrito com TLS nativo do Node; não entrega mensagens a terceiros. `work/` é ignorado pelo Git e contém certificado temporário, mensagens de teste, sessões e capturas. Os scripts geram dados fictícios e alteram as configurações dessa instalação. Não aponte os testes para empresas reais.

No ambiente cloud, as compilações receberam proxy e CA por um override temporário e secret de build. Esses valores não foram incorporados aos Dockerfiles do produto nem às imagens. Em rede comum, use os Dockerfiles entregues diretamente.

Os testes de migração são divididos em `scripts/customer-experience-upgrade.cjs prepare`, `verify` e `persist`, com o projeto fixo `pdv-upgrade-test` na porta 8091. `prepare` pressupõe as imagens anteriores e o override temporário `work/compose.upgrade-old.yaml`, que atribui `image: sistemapdv-local-frontend:latest` ao frontend; o backend usa a imagem anterior `sistemapdv-backend:local`. Depois, `verify` e `persist` usam as imagens atuais do overlay de teste. Não recrie nem substitua essas imagens anteriores em uma instalação real para repetir o teste.

## Limites da validação

A recuperação foi exercitada com o SMTP local de teste; o cliente ainda precisa escolher e configurar seu provedor. Upload/exibição do Pix foram verificados com imagem sintética, sem transação bancária. PDFs e impressão pelo navegador foram exercitados; não houve teste de impressora física. O acesso Master entre empresas foi validado dentro da mesma plataforma, sem conexão remota entre instalações Docker independentes.

## Evidências de execução

- [Fluxos HTTP novos](api.txt)
- [Navegador](browser.txt)
- [Isolamento](isolation.txt)
- [Regressão](regression.txt)
- [Persistência após recriação](persistencia.txt)
- [Compilação do frontend](build.txt)
- [Lint](lint.txt)
