# Mark 0.15.0 — Importação de catálogo de autopeças

Menu **Importar autopeças**, com módulo Autopeças habilitado, para gerência e Master. O suporte mantém consulta sem confirmação.

1. Baixe o modelo, ou selecione CSV do fornecedor de até 256 KB e 200 linhas de produtos, com cabeçalhos únicos. UTF-8 ou Windows-1252; separadores: ponto e vírgula, vírgula ou tabulação. Arquivos Excel precisam ser salvos como CSV.
2. Clique **Ler arquivo**, informe a fonte/edição do catálogo e mapeie cada coluna. Nome é obrigatório. Não mapear uma coluna deixa seu campo vazio ou valor zero. Preço/custo aceitam 1234.56, 1234,56 ou 1.234,56; códigos de barras continuam texto, preservando zeros iniciais.
3. **Preparar prévia** não cadastra produtos. Confira valores, erros, marca/modelo/anos informados e a fonte. Uma aplicação por linha; cada produto deve ocupar uma única linha. Outras aplicações podem ser inseridas no cadastro técnico depois.
4. Confirme a conferência e clique **Confirmar importação**, usando a mesma conta que preparou a prévia. A prévia vale 24 horas. Havendo erro ou duplicidade, corrija o CSV e prepare outra prévia.

Novos produtos ficam **inativos, estoque zero**, sem movimentos de caixa/estoque. Preços e custos não informados ficam zero. Ative e precifique em Produtos e serviços; faça a entrada real de estoque pelo fluxo de compras/estoque. Não sobrescreve produtos existentes, não relaciona equivalências, não inventa aplicação e não valida a exatidão do catálogo do fabricante.

Nome, código de barras e fabricante+referência repetidos são bloqueados na prévia e novamente na confirmação. Toda a confirmação é uma transação: nenhum produto é importado se houver conflito. Repetir a confirmação concluída retorna o mesmo resultado, sem duplicar produtos. Histórico mantém fonte, arquivo, prévia, identificação e produtos criados; não guarda o arquivo original do fornecedor.

Validação sintética: 23 verificações HTTP e cinco de parser aprovadas. `node scripts/part-import-smoke.cjs`. Build e lint sem erros; permanecem avisos anteriores.
