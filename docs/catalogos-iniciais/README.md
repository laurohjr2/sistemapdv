# Catálogos iniciais — Mark 0.4.1

São **322 itens únicos**, compartilhados entre catálogos quando aplicável. Esta versão adiciona o perfil Hamburgueria e catálogos opcionais para Bar/restaurante, Pizzaria, Hamburgueria, Mercado, Autopeças, Oficina e Comércio geral. A importação funciona em qualquer perfil e pode combinar segmentos sem mudar as configurações da empresa.

## Como usar

1. Atualize fora do horário de atendimento com `git pull --ff-only` e `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1`.
2. Recarregue com Ctrl+Shift+R e confira Interface e Servidor **0.4.1** em Sobre o sistema.
3. Como administrador, gerente ou Master, acesse **Produtos e serviços → Importar catálogo inicial**.
4. Escolha o catálogo, pesquise e marque os itens desejados. “Selecionar resultados” adiciona os itens visíveis à seleção; mudar de catálogo limpa a seleção.
5. Importe. Os novos produtos e serviços aparecerão na aba **Inativos**, com **custo R$ 0,00, venda R$ 0,00, estoque 0 e mínimo 0**. Isso evita disponibilizar serviços com preço ainda não revisado.
6. Edite cada item, defina preços, especificações e código de barras real, ative e registre a entrada real em Estoque ou Compras. Ativar não cria estoque. Itens inativos não entram nos alertas de estoque baixo.

Nada é importado durante uma atualização ou troca de perfil. Cadastros do cliente nunca são substituídos. Nova importação ignora itens já presentes, mesmo quando importados por outro catálogo, renomeados ou inativados. Nomes equivalentes são comparados sem distinguir acentos, espaços extras ou maiúsculas. Uma exclusão na interface apenas inativa o cadastro e não o recria na próxima importação.

## Conteúdo e limites

- Bebidas: cervejas de diferentes marcas, estilos, latas e garrafas, com ml/L no nome; refrigerantes, água, sucos e energéticos.
- Bar/restaurante e hamburgueria: porções, sanduíches, combos, bebidas e sobremesas.
- Pizzaria: bases por tamanho, bebidas e sobremesas. Vincule as bases aos tamanhos no menu **Pizzaria**. O catálogo não altera sabores, regras ou preços de um cardápio existente.
- Mercado: alimentos embalados, itens por kg, higiene e limpeza. A unidade de venda é o pacote/unidade para embalados e kg para produtos a granel.
- Autopeças: peças, lubrificantes, ferramentas e acessórios. As peças são modelos genéricos: o cliente deve cadastrar marca, referência e compatibilidade real com veículos. Não se presume aplicação nem especificação aprovada pela montadora.
- Oficina: peças e serviços de mão de obra separados. Serviços não têm controle físico de estoque; materiais e peças são cobrados separadamente.
- Comércio: mercadorias de uso geral, higiene e limpeza.

Os exemplos não substituem o catálogo do fornecedor. Disponibilidade e embalagens variam conforme região/fabricante; revise antes de ativar. Não são inventados EAN/GTIN, informações fiscais, alérgenos, aplicações veiculares ou dados nutricionais. A importação não cria compras, movimentações, vendas ou valores financeiros.

Cada empresa recebe seus próprios cadastros. Importações concorrentes são serializadas por transação no banco da empresa e registradas na auditoria. Atendentes não importam. O suporte de consulta continua sem permissão de alteração, e a conta Master pode importar na empresa selecionada.

## Continuidade dos segmentos

O catálogo facilita o cadastro; os recursos específicos continuam com entregas próprias:

- Oficina: veículos, ordem de serviço, checklist, autorização do cliente e acompanhamento da execução.
- Autopeças: aplicações por veículo, códigos de fabricante e equivalências.
- Mercado: integração de balança, lotes/validade e etiquetas específicas.
- Alimentação: ficha técnica com consumo de ingredientes, adicionais por fração, combos com composição e entrega.
- Recursos gerais: fidelidade, integrações fiscais, confirmação Pix pelo provedor e geração de credenciais temporárias de suporte.

O SMTP de recuperação e o destino externo do backup continuam dependendo da configuração do responsável. O backup local criptografado já foi validado; esta atualização não muda sua senha nem ativa um destino externo.

## Validação da entrega

Validado no Docker com PostgreSQL e Chromium em 27/10/2026:

- 67 verificações HTTP específicas: catálogo completo, seleção inválida sem importação parcial, seis importações simultâneas, preservação de nome/preços/estoque, itens compartilhados, alertas de inativos, ativação/venda de produto e serviço, permissões e duas empresas isoladas.
- 10 verificações no navegador: importar, buscar, selecionar resultados, impedir repetição, tela de celular e acesso de atendente/gerente/Master/suporte; sem erros JavaScript.
- Regressão: 119 verificações comerciais e 109 da pizzaria aprovadas.
- 3 verificações da versão publicada/cache; compilação Docker concluída; lint sem erros e com os 12 avisos anteriores do projeto.

Reprodução apenas no projeto descartável `pdv-commerce-test`: execute `node scripts/starter-catalog-smoke.cjs` e depois `node scripts/starter-catalog-browser.cjs`. Os testes criam empresas sintéticas, sem usar cadastros reais. O teste de navegador utiliza o Playwright de `work/browser/node_modules/playwright` e Chromium em `/usr/bin/chromium`. A atualização física no computador Windows do cliente ainda deve ser aplicada pelos comandos acima.

O controle opcional de lotes e validade foi entregue na **Mark 0.7.0**. Veja o [guia de Mercado](../mercado/README.md).
