# sistemapdv
Mark1


Sistema PDV em desenvolvimento para bares e lanchonetes, com interface React, API Node.js/Express e PostgreSQL.

## Recursos da base

- Vendas, mesas e comandas.
- Entrada, saída e acerto de estoque.
- Fila de clientes integrada à ocupação de mesas e abertura de comandas.
- Usuários, relatórios e geração de comprovantes em PDF.
- Configurações do estabelecimento: nome, logo, CNPJ, contato, endereço e mensagem dos comprovantes.
- Painel separado de pedidos da cozinha, herdado do projeto original.

## Imagens do sistema

Capturas reais com dados fictícios de demonstração:

![Fila de espera no computador](docs/images/fila-desktop.png)

[Ver a fila de espera no celular](docs/images/fila-celular.png)

[Ver a tela de Configurações](docs/images/configuracoes.png)

## Desenvolvimento e validação

Consulte [DEVELOPMENT.md](DEVELOPMENT.md) para instalar, iniciar e testar no ambiente cloud. Os scripts atuais usam `/workspace/sistemapdv`.

Foram executadas 28 verificações HTTP do fluxo geral, 36 da integração fila–mesa–comanda e um teste de navegador incluindo pagamento e liberação da mesa. Os scripts de teste estão em `scripts/`.

Esta é uma base de desenvolvimento. Impressão física, isolamento entre empresas, assinaturas e acesso master de suporte ainda precisam ser concluídos. A validação não cobre todos os fluxos herdados da aplicação. Os Dockerfiles e o seed antigo são legados e não fazem parte da instalação validada; não execute o seed em um banco com dados que precisa preservar.

Credenciais, banco local e dependências são excluídos do Git.

## Auditoria funcional

A revisão ampliada encontrou falhas que impedem uso real. Consulte o [relatório por menu, testes e capturas](docs/auditoria/README.md) antes de iniciar um piloto.
