# Balanças e etiquetas — Mark 0.8.0

Entrega leitura de etiquetas EAN-13 no PDV e geração de etiquetas de preços de gôndola. O proprietário ainda não possui balança; os formatos estão pré-configurados, mas a leitura inicia desativada. Não há reconhecimento automático por marca nem homologação física declarada.

## Atualizar e abrir

Na instalação Windows, fora do atendimento, execute um comando por vez:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Pressione **Ctrl+Shift+R**, confira Interface/Servidor **0.8.0** em Sobre o sistema e acesse **Balanças e etiquetas**. O menu usa o módulo **Mercado — lotes, balanças e etiquetas**; ative-o em Configurações e salve se necessário. Pode manter Oficina ou outro perfil atual.

## Pré-configurações preparadas

| Opção | Estrutura EAN-13 | Unidade do campo de 5 dígitos |
|---|---|---|
| Peso, PLU 5 | Prefixo 20–29 + PLU de 5 + valor de 5 + DV | Gramas; 00625 = 0,625 kg |
| Preço, PLU 5 | Prefixo 20–29 + PLU de 5 + valor de 5 + DV | Centavos; 01250 = R$ 12,50 |
| Peso, PLU 6 | Prefixo 2 + PLU de 6 + valor de 5 + DV | Gramas |
| Preço, PLU 6 | Prefixo 2 + PLU de 6 + valor de 5 + DV | Centavos |

DV é o dígito verificador EAN-13, calculado/verificado pelo módulo 10. Há um formato ativo por empresa; todas as balanças daquela empresa precisam emitir o formato escolhido. PLU é o código do produto programado na balança, separado do código de barras comum/GTIN do cadastro.

Toledo, Filizola, Urano, Balmak e outros fabricantes possuem modelos e configurações variados. Uma marca não garante que todo modelo use o mesmo arranjo. As pré-configurações são por estrutura de código, sem afirmar certificação por fabricante. Confirme o manual e uma etiqueta real antes de ativar. Não copiamos um protocolo de porta serial/rede nem declaramos esses equipamentos testados.

## Preparar o recebimento

1. Cadastre o produto ativo, com unidade **kg**, preço/kg positivo e estoque real. O preço deve corresponder ao programado na balança.
2. Escolha o formato e o prefixo, mantendo a leitura desativada enquanto prepara os vínculos.
3. Vincule cada **PLU** ao produto correspondente. PLUs não se repetem na mesma empresa e podem ter zeros à esquerda na etiqueta. O vínculo não altera o GTIN nem cria estoque.
4. Quando houver equipamento, imprima uma etiqueta real, ative o formato e use **Testar uma etiqueta**. Confira produto, kg e valor antes de usar no caixa.
5. O leitor do caixa precisa atuar como teclado e enviar Enter após o código. Não há driver específico no aplicativo para esse tipo de leitor. A configuração do próprio leitor/Windows pode ser necessária.

Esta etapa recebe a etiqueta impressa pela balança; não lê diretamente uma porta COM/USB/rede da balança e não envia carga automática de produtos/preços para ela. Formatos diferentes dos quatro descritos precisam de implementação/configuração adicional com amostra real.

## Vender por etiqueta

No campo **Código de barras** de Vendas, leia a etiqueta e pressione Enter. O sistema valida prefixo, tamanho, DV, PLU, produto ativo por kg e preço. Uma janela mostra produto, peso, preço/kg e total antes de adicionar ao carrinho. Dois pacotes são mantidos em duas linhas distintas, mesmo com o mesmo produto/peso. Para mudar a quantidade de uma etiqueta, remova o item e leia novamente.

O servidor refaz a leitura no fechamento. Quantidade, produto, configuração, vínculo e preço são verificados; mudanças exigem nova leitura. A venda usa arredondamento por linha em centavos, guarda a etiqueta no item e imprime o código/peso nas observações do cupom. O estoque e os lotes seguem as regras da Mark 0.7.0, sem baixa extra; a etiqueta comum de balança não identifica o lote físico.

Códigos comuns continuam funcionando. O prefixo escolhido fica reservado à etiqueta variável. Se o mesmo código completo também estiver cadastrado como código comum, a ambiguidade é bloqueada; revise o cadastro em vez de vender o produto errado.

## Cuidado específico com etiquetas por preço

Um código que contém apenas preço total não contém peso exato suficiente em todos os casos: a R$ 3/kg, tanto 0,333 kg quanto 0,334 kg podem arredondar para R$ 1,00. O sistema apresenta uma estimativa, mas exige conferir/informar o **peso real da embalagem** e confirmar peso/preço antes de adicionar. A quantidade informada precisa produzir o mesmo total codificado, com até três casas decimais.

O preço/kg precisa estar sincronizado entre balança e cadastro. Ao mudar o preço no sistema, a leitura por preço fica bloqueada até atualizar a balança e salvar novamente o vínculo do PLU com o preço conferido. A ativação desse formato exige confirmação explícita do gerente/administrador. Se não houver peso impresso/disponível para conferência, prefira o formato por peso; não trate a estimativa como pesagem física certificada.

Na etiqueta por peso, o total é calculado com o preço atual do cadastro. Confira os valores exibidos e o rótulo antes de confirmar. Nenhum formato prova autenticidade da etiqueta nem substitui conferência física da embalagem.

## Etiquetas de gôndola

Administradores/gerentes podem selecionar produtos ativos e quantidades em **Etiquetas de gôndola**. O PDF A4 contém etiquetas de **90 × 60 mm**, oito por página, com empresa, nome, preço/unidade e data de conferência. Imprima em **tamanho real/100%**, sem ajustar à folha, e confira no papel antes de produzir em volume. Não é um modelo para toda impressora térmica proprietária.

Barras são desenhadas somente quando o produto já possui **EAN-13 válido**. Os dígitos originais são preservados; não geramos um novo GTIN para um produto. Outros códigos são impressos como texto. O PDF não gera etiquetas de peso variável para substituir a impressora da balança.

Até 100 produtos e 200 cópias por arquivo. Preço diferente do que estava na seleção bloqueia a geração e exige recarregar os produtos. A geração fica registrada em auditoria; isso não comprova impressão física ou colocação na prateleira. A impressão não modifica preços, estoque ou vendas.

## Acessos e preservação

Gerente, administrador e Master configuram formatos, vínculos e geram etiquetas de gôndola. Atendentes consultam e leem etiquetas na venda. Suporte de consulta acessa as configurações por GET, sem alterações, vendas ou geração por POST. A futura revisão de permissões por usuário está registrada para depois das melhorias funcionais; não foi aplicada nesta etapa.

Novas tabelas: `scale_settings` e `scale_products`; novo campo JSONB `sale_items.scale`. Todos os bancos registrados são migrados. Sem configuração, a leitura permanece desativada; dados e vendas anteriores são preservados. Para ocultar Mercado, desative a leitura e observe também os controles por lote ativos.

## Validação da entrega

Validação em 28/10/2026 com Docker/PostgreSQL e Chromium:

- 70 verificações HTTP: quatro formatos, verificador EAN-13, PLU, revisões, pesos fracionados, confirmação do peso real em etiquetas por preço, sincronização do preço/kg, códigos ambíguos, lotes, duas linhas com o mesmo produto, arredondamento, PDF, permissões e empresas isoladas.
- 11 verificações no navegador: configuração, vínculo, teste, duas etiquetas com arredondamento por linha, venda, conferência do peso real, celular, PDF e acesso de atendente; sem erros JavaScript.
- PDF de duas páginas rasterizado em 300 dpi e lido por **ZXing-C++** independente do gerador. Os oito códigos da primeira página e os dois da segunda foram decodificados com os EAN-13 originais.
- Regressões aprovadas: 119 verificações comerciais, 109 da pizzaria, 94 da oficina, 50 de lotes e 20 verificações do navegador da pizzaria. Os testes que criam empresas são executados isoladamente para respeitar o lock de provisionamento.
- 6 verificações de persistência após recriar containers/migrar; configuração, PLUs, preços conferidos e vendas com etiquetas preservados. 3 verificações públicas de versão/cache, builds Docker e lint sem erros, mantendo os 12 avisos anteriores do projeto.

Reprodução apenas no projeto descartável `pdv-commerce-test`: `node scripts/scale-smoke.cjs`, `node scripts/scale-browser.cjs`, `node scripts/scale-persistence.cjs`. Para o leitor independente, instale Pillow/zxing-cpp em um venv de testes, rasterize `work/scale/labels.pdf` com `pdftoppm -f 1 -l 2 -r 300 -png work/scale/labels.pdf work/scale/labels-page` e execute `scripts/testing/validate-label-pdf.py` com esse Python. As dependências do leitor não entram no aplicativo de produção.

Não houve teste de balança física, leitor USB físico, impressora física ou homologação por fabricante. A conferência com etiqueta real continua necessária antes da ativação no cliente.
