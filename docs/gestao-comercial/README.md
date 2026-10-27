# Perfis e gestão comercial — versão 0.3.0

Entrega na branch `feat/pdv-base-fila-mesas`, sobre a base `3181b6f`. O sistema passa a ter uma base comercial compartilhada, com funcionalidades habilitadas por empresa em **Configurações → Perfil do negócio**.

## Perfis disponíveis

| Perfil | Configuração inicial |
| --- | --- |
| Bar / restaurante | Mesas, comandas, cozinha, orçamentos, compras e financeiro. |
| Pizzaria | Balcão, mesas, comandas, cozinha, orçamentos, compras e financeiro. |
| Oficina mecânica | Produtos e serviços, orçamentos, compras e financeiro. |
| Autopeças | Venda de peças, orçamentos, compras e financeiro. |
| Mercado | Produtos, vendas, compras e financeiro. |
| Comércio geral | Produtos e serviços, orçamentos, compras e financeiro. |

O perfil oferece uma configuração inicial; o administrador pode ajustar os módulos. Cozinha depende de mesas; compras depende de financeiro. O sistema bloqueia a desativação de módulos com operações pendentes. Ocultar um menu também bloqueia sua operação pela API. O histórico de comandas continua consultável.

## Funcionalidades entregues

- **Produtos e serviços:** tipo definido no cadastro, categorias próprias e novas unidades (hora, serviço, metro, caixa e par). Serviços não baixam estoque, não geram alertas de falta e não entram no relatório de posição física. O tipo é preservado após o cadastro. A remoção inativa o item para preservar o histórico.
- **Orçamentos:** cliente cadastrado ou avulso, produtos/serviços, preços, desconto, validade, observações e PDF. Fluxo de rascunho, enviado, aprovado/rejeitado, cancelado e convertido. Gerente ou administrador registra o aceite e concede descontos. A conversão gera uma venda paga no caixa aberto, uma única vez, conservando os preços e descontos aprovados. Não representa venda a prazo nem ordem de serviço.
- **Fornecedores e compras:** cadastro com inativação, pedido de compra, recebimento parcial e histórico. Cada recebimento lança estoque e uma conta a pagar na mesma transação. Repetir a confirmação com a mesma chave não duplica estoque nem dívida. O custo do pedido fica registrado; não foi criado cálculo de custo médio.
- **Financeiro:** contas a pagar e receber, vencimento, filtros, saldos, pagamentos parciais, histórico e PDF. Contas manuais sem pagamento podem ser canceladas. Contas originadas por compras e lançamentos pagos preservam sua origem e histórico. Baixas em dinheiro exigem caixa aberto, conferem saldo disponível e aparecem no fechamento; outros meios são registrados sem integração bancária. Contas avulsas não entram novamente no faturamento de vendas.
- **Navegação:** menus agrupados por operação e gestão, perfil da empresa, identificação do papel e versão da interface/servidor. O papel interno `garcom` aparece como **Atendente**. Tela Sobre alerta se as versões divergirem.
- **Acesso do fornecedor:** entrada identificada como **Master / suporte**. `master.local` e `support.local` entram por `/support`, escolhem a empresa e acessam Configurações. O ID do cliente e o aviso de visualização restrita aparecem apenas na sessão autorizada. Administrador de empresa continua limitado à própria empresa. Corrigida a concorrência no primeiro acesso Master.

Compras, fornecedores e financeiro exigem gerente ou administrador. Atendentes podem preparar orçamentos, mas não aprovar, alterar preço ou dar desconto. Suporte permanece somente para consulta. Master pode operar as empresas cadastradas na mesma plataforma e suas ações são auditadas.

## Atualização no Windows

Mantenha o Docker Desktop aberto e reserve um momento sem operações. Na pasta do projeto, execute:

```powershell
git switch feat/pdv-base-fila-mesas
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

O primeiro `git pull` obtém o script. Ele confere branch e arquivos versionados, interrompe interface/API, salva todos os bancos e a configuração/segredos em `.pdv-local\backups\DATA-HORA`, atualiza o código, reconstrói/recria os containers e compara as versões publicadas. Migrações são executadas para todas as empresas cadastradas. Se o script falhar, preserva o backup e tenta iniciar os containers existentes; não restaura bancos automaticamente.

O backup contém dados privados e credenciais: mantenha-o protegido. Não apague volumes nem execute `docker compose down -v`. Após concluir, abra `http://127.0.0.1:8080/login`, pressione `Ctrl+Shift+R` e confira **Sobre → 0.3.0** na interface e no servidor. Se personalizou a porta, use a URL indicada pelo script.

Para consultar suas credenciais iniciais, sem colar a saída no terminal como comandos:

```powershell
docker compose run --rm --no-deps provision node /app/docker/local.cjs credentials
```

As senhas são preenchidas no navegador. Master e suporte usam `/support`, sem o código da empresa na tela de login comum.

## Próximas etapas por segmento

| Segmento | Funcionalidades ainda a implementar |
| --- | --- |
| Pizzaria | Tamanhos, múltiplos sabores, regra de preço da pizza, bordas, adicionais, ficha técnica, delivery e entregadores. |
| Oficina | Veículos, placa, quilometragem, ordem de serviço, agenda, fotos/checklist e garantia. |
| Autopeças | Aplicação por veículo, equivalências, fabricantes, códigos alternativos e devoluções. |
| Mercado | Leitor de código de barras, balança, lotes/validade, etiquetas e inventário assistido. |
| Todos | Integração fiscal conforme UF/regime, Pix com confirmação bancária, conciliação, fidelidade, venda a prazo integrada e rotina de backup externo/restauração. |

Esses recursos específicos não estão incluídos apenas por selecionar um perfil. Os PDFs comerciais não substituem documentos fiscais. Pagamentos nesta entrega são confirmações registradas pelo operador.

## Validação

Os cenários automatizados usam empresas e dados sintéticos em projetos Docker separados da instalação local. Resultados desta entrega serão registrados após a conclusão dos testes. O script de atualização tem sintaxe compatível com PowerShell 5.1/7; o teste disponível usa PowerShell 7 em Linux, sem homologação em uma máquina Windows física.
