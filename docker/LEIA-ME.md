# Instalação local com Docker (Windows)

Esta instalação cria uma empresa de teste vazia (`demo`) e uma conta de suporte. Não importa os dados nem as senhas do ambiente na nuvem. Todos os componentes rodam em containers; não precisa instalar Node.js ou PostgreSQL no Windows.

## 1. Preparar o computador

Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e o [Git para Windows](https://git-scm.com/downloads/win). No Docker Desktop, use o mecanismo WSL 2 e containers Linux. Reinicie o computador se solicitado e deixe o Docker Desktop aberto até indicar que está funcionando.

## 2. Baixar a versão correta

Abra o PowerShell na pasta onde deseja guardar o projeto:

```powershell
git clone --branch feat/pdv-base-fila-mesas --single-branch https://github.com/laurohjr2/sistemapdv.git
cd sistemapdv
```

Se o repositório for privado, entre com sua conta do GitHub quando solicitado. A versão está nesta branch, ainda não na `main`.

Se já baixou esta branch e não alterou seus arquivos locais, basta entrar na pasta e executar `git pull --ff-only`.

## 3. Instalar e iniciar

Na pasta que contém `compose.yaml`, execute:

```powershell
docker compose up -d --build --wait --wait-timeout 240
```

A primeira execução precisa de internet para baixar as imagens e dependências e pode levar vários minutos. O instalador gera senhas próprias e cria os bancos automaticamente. É normal `prepare` e `provision` terminarem com código 0: eles só fazem a preparação.

Depois, mostre suas credenciais locais:

```powershell
docker compose run --rm --no-deps provision node /app/docker/local.cjs credentials
```

Este comando exibe senhas: guarde-as e não compartilhe a saída. As senhas não são impressas durante a instalação e não ficam no Git. Caso altere uma senha pelo sistema, a senha cadastrada passa a valer; o comando acima exibe apenas as credenciais iniciais.

## 4. Acessar pelo navegador

Abra **http://localhost:8080**.

- Código da empresa: `demo`
- Usuário: `admin.local`
- Senha: a exibida pelo comando anterior.

Para suporte, abra **http://localhost:8080/support**, usuário `support.local` e a senha de suporte exibida. O suporte consulta as configurações e vê o ID do cliente, sem editar os dados.

Cadastre as informações da empresa em Configurações, os produtos e seu estoque, mesas e usuários. Depois teste abertura do caixa, fila de espera, comandas, pagamentos e relatórios. A base começa vazia.

## Parar e voltar a usar

Parar preservando os dados:

```powershell
docker compose down
```

Iniciar novamente:

```powershell
docker compose up -d --wait --wait-timeout 240
```

Os bancos, configurações e senhas ficam nos volumes `postgres_data`, `platform_data` e `install_secrets` do projeto `sistemapdv-local`. Preserve os três juntos. **Não use `docker compose down -v` nem apague os volumes no Docker Desktop: isso remove os dados e credenciais desta instalação.** Volumes persistentes não substituem backup.

## Problemas comuns

Confira o estado e os logs:

```powershell
docker compose ps -a
docker compose logs --tail=80
```

Se o Docker não conectar, abra o Docker Desktop e aguarde a inicialização. Se exceder o tempo de espera, confira os logs e execute novamente o comando de início; ele preserva os dados já criados. Se a porta 8080 estiver ocupada, no mesmo PowerShell execute:

```powershell
$env:PDV_LOCAL_PORT="8081"
docker compose up -d --wait --wait-timeout 240
```

Acesse então http://localhost:8081. Use essa mesma variável nos próximos comandos ou retome a porta 8080 quando estiver livre.

## Limites desta instalação

O endereço fica restrito ao próprio computador. PostgreSQL e API não têm portas publicadas. Cada empresa tem seu próprio banco e login PostgreSQL; o backend recebe somente as credenciais restritas de execução, sem a senha administrativa de provisionamento.

Este pacote é para testes locais. A implantação online, cobrança automática, painel comercial e integração com impressoras Windows ainda são etapas separadas. A impressão em PDF pode ser testada; imprimir fisicamente depende da integração e do computador. O Docker local não adiciona um modo offline ao produto SaaS: a versão comercial continuará dependendo dos serviços online.

[Consultar os cenários validados desta instalação](VALIDACAO.md).

## Atualizar uma instalação existente

Veja o [procedimento com backup, novidades do PDV, acesso Master/Admin e SMTP](../docs/alteracoes-pdv-local/README.md). Preserve os volumes existentes e faça login novamente após atualizar.
