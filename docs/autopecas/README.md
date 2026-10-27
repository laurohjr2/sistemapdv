# Autopeças — Mark 0.6.0

Esta entrega acrescenta informações técnicas aos produtos existentes, sem alterar seus preços ou estoque: fabricante da peça, referência, códigos originais, aplicações por veículo e equivalentes diretos.

## Atualizar e encontrar o módulo

Na pasta da instalação Windows, fora do atendimento:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Pressione **Ctrl+Shift+R** e confira Interface/Servidor **0.6.0** em **Sobre o sistema**. O menu **Autopeças** aparece em **Cadastros e estoque**. O módulo vem ativo nos perfis **Autopeças** e **Oficina mecânica** quando a empresa ainda não definiu uma preferência explícita para ele. Em outros perfis, ative **Autopeças — aplicações e equivalências** em Configurações e salve.

Para continuar usando a oficina, mantenha o perfil atual e ative a opção de Autopeças. Trocar o perfil para Autopeças desativa, por padrão, os recursos específicos da oficina; ordens abertas impedem essa desativação.

A atualização cria `part_details` e `part_equivalences` em todos os bancos de empresas registrados. Dados existentes e os catálogos iniciais são preservados. Nenhuma aplicação, marca, código ou equivalência é inventada para os produtos pré-cadastrados.

## Cadastro técnico

1. Cadastre cada referência comercial como um produto próprio em **Produtos e serviços**, incluindo nome claro, preço, unidade e estoque real. Produtos diferentes não devem compartilhar o mesmo cadastro de estoque.
2. Em **Autopeças**, escolha o produto em **Complementar um produto cadastrado** e clique em **Editar cadastro técnico**. Também é possível usar **Editar** na lista.
3. Informe o fabricante da peça e sua referência. **Códigos originais** aceita um código por linha; repetições são consolidadas sem distinguir maiúsculas ou acentos.
4. Use **Adicionar aplicação** para informar marca/modelo do veículo, intervalo de anos, motor, versão e observações. Marca, modelo e os dois anos são obrigatórios; ano inicial/final entre 1900 e 2100, sem intervalo invertido.
5. Salve. Um produto pode atender a várias aplicações. Os dados técnicos também podem ser preparados em produtos inativos; eles só entram na busca padrão após serem ativados.

Cada cadastro técnico suporta até 50 códigos originais e 200 aplicações. Números de fabricante ou códigos originais podem aparecer em mais de um produto: isso não cria equivalência automaticamente. Confira a fonte e as especificações técnicas antes de cadastrar ou instalar.

Alterações de dados técnicos não criam vendas, compras, movimentações de estoque ou valores financeiros. Os dados técnicos atuais não são uma cópia histórica dos códigos em cada venda antiga; nomes e valores das ordens de serviço mantêm suas próprias cópias conforme a Mark 0.5.0.

## Consultar aplicações e referências

Use **Produto, fabricante ou código** para buscar nome, fabricante, referência, código original ou código de barras. Use os demais campos para veículo: marca, modelo, ano, motor e versão. Os campos sugerem valores já cadastrados.

Filtros de veículo usam correspondência completa do valor informado, sem distinguir acentos, espaços extras ou maiúsculas. Não há tradução automática de abreviaturas: “VW” e “Volkswagen” devem ser padronizados pela empresa. Anos inicial e final são inclusivos.

**Todos os filtros do veículo precisam corresponder à mesma aplicação.** Por exemplo, uma peça com aplicação Fiat Uno 1.0 e outra Volkswagen Gol 1.6 não aparece como Fiat Gol 1.6. Campo de motor/versão em branco no cadastro não é confirmação para todos os motores/versões. Se nenhum veículo for informado, a busca mostra produtos por referência; ausência de aplicação não significa compatibilidade universal.

A busca inclui apenas produtos ativos por padrão. Marque **Incluir inativos** para consultar os demais. Os resultados mostram fabricante, referências, número de aplicações, equivalentes, preço e estoque atual. **Ver aplicações** mostra os detalhes e ressalvas.

## Equivalências

Abra **Ver aplicações**, selecione um **Produto equivalente** e registre a justificativa/fonte da relação, por exemplo a referência cruzada conferida no catálogo do fabricante. Ambos os produtos precisam estar ativos e não podem ser serviços ou o mesmo produto.

A relação aparece nos dois sentidos. Uma segunda inclusão da mesma relação, mesmo invertida, é bloqueada. Não existe dedução transitiva: A equivalente a B e B equivalente a C não torna A equivalente a C. Aplicações de uma peça não são copiadas para as equivalentes.

É possível ver preço/estoque do equivalente e abrir sua ficha. A inativação de um produto preserva a relação, indicando o status inativo. **Remover equivalência** pede confirmação e remove a relação dos dois produtos; a operação fica registrada na auditoria. As vendas, ordens e estoques existentes não são alterados.

## Atendimento no balcão

**Localizar em Vendas** abre Vendas com o nome do produto na busca, sem adicionar nada ao carrinho nem iniciar pagamento. A busca normal da tela de Vendas passa a aceitar também fabricante, referência, códigos originais e código de barras, além dos campos anteriores. A disponibilidade, abertura de caixa e recebimento seguem as regras existentes.

Para usar uma peça em uma OS, selecione o produto no editor de peças/serviços da própria ordem. Não há seleção automática de peças pela placa nem transferência automática de uma pesquisa para um orçamento/OS.

## Acessos, histórico e limites

- Administradores, gerentes e Master: alteram dados técnicos e equivalências.
- Atendentes: consultam referências, aplicações e equivalentes para atender no balcão.
- Suporte de consulta: lê os dados, sem alterações.
- Toda empresa tem dados próprios; uma peça de outra empresa não pode ser consultada ou relacionada.

Revisões impedem sobrescrever um cadastro técnico modificado por outro terminal. Após um conflito, feche e reabra o formulário para carregar a versão atual. Use **Atualizar** ou **Recarregar peça** para consultar dados recentes. Inclusão/remoção de equivalências é registrada separadamente na auditoria. Desativar o módulo preserva os dados cadastrados.

Esta etapa não consulta catálogos externos, placa/chassi, montadoras, fornecedores ou fabricantes, nem certifica substituição técnica. Não inclui importação de tabelas de fabricantes, integração fiscal, catálogo online, fotos ou identificação automática de medidas/conectores. Essas informações precisam ser conferidas pelo responsável da empresa.

## Validação da entrega

Validado em 27/10/2026 no Docker/PostgreSQL e Chromium:

- 80 verificações HTTP: intervalos de anos, filtros na mesma aplicação, códigos repetidos, edição simultânea, relações simétricas sem transitividade, produtos inativos, bloqueio de serviços, preços/estoque preservados, permissões e duas empresas isoladas.
- 14 verificações no navegador: cadastro técnico, aplicações, equivalências, conflito de edição e reabertura, celular, busca por referência em Vendas e acessos de atendente/gerente/Master/suporte, sem erros JavaScript.
- Regressões aprovadas: 119 verificações comerciais, 94 da oficina e 109 da pizzaria.
- 4 verificações de persistência após recriar containers e reexecutar migrações; dados técnicos, equivalências, preços e estoque idênticos aos anteriores.
- 3 verificações de versão/cache; builds Docker concluídos; lint sem erros e com os 12 avisos anteriores do projeto.

Reprodução somente no projeto descartável `pdv-commerce-test`: `node scripts/autoparts-smoke.cjs`, `node scripts/autoparts-browser.cjs` e `node scripts/autoparts-persistence.cjs`. Os scripts usam empresas sintéticas; o teste de navegador usa Playwright em `work/browser/node_modules/playwright` e Chromium em `/usr/bin/chromium`. O teste de persistência recria os containers do projeto descartável, preservando seus volumes. A instalação Windows do cliente deve ser atualizada com os comandos acima.
