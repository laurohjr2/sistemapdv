# Validação da instalação local — 26/10/2026

Executada com Docker Engine/Compose em Linux, usando volumes novos e separados do ambiente de desenvolvimento existente. O procedimento para Windows está em [LEIA-ME.md](LEIA-ME.md). Não houve teste em uma máquina Windows física.

- Build das imagens Node.js 24 e Nginx concluído. O ambiente cloud exige proxy, resolução do proxy e certificado próprios; esses ajustes foram fornecidos por um override temporário fora do Git, com certificado montado como secret de build. O Compose entregue usa a rede padrão e não contém esses dados.
- Inicialização automática: geração de senhas, banco central, banco da empresa, administrador e suporte. `prepare` e `provision` terminam com código 0; banco, API e frontend ficam saudáveis.
- API pelo Nginx: saúde, login, consulta de produtos e gravação das configurações.
- Cliente recebe 403 ao tentar consultar o ID interno. Suporte autenticado consegue consultá-lo, recebe 403 ao tentar editar e perde o acesso após encerrar sua sessão.
- Chromium real: login, abertura de produtos, estoque, mesas, comandas, fila, relatórios e configurações; navegação direta nas rotas da SPA; ID oculto do cliente e visível no suporte com campos desabilitados. Nenhum erro JavaScript observado nesses cenários.
- Parada com `docker compose down` e recriação dos containers preservam credenciais, mensagem do comprovante, nome da empresa e ID do cliente nos volumes.

O teste reproduzível de API/persistência está em `scripts/docker-local-smoke.cjs`. Esta validação cobre o empacotamento local e os cenários acima; os fluxos operacionais mais amplos têm evidências nas pastas anteriores de validação. Impressoras físicas e implantação pública continuam fora deste teste.
