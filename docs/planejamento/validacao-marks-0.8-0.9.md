# Validação conjunta — Marks 0.8.0 e 0.9.0

## Atualizar o Docker local

Na pasta `C:\Users\Lauro\Documents\pdv-local`, execute cada comando separadamente:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080 e pressione **Ctrl+Shift+R**. Em **Sobre o sistema**, confira se interface e servidor exibem **0.9.0**. O script mantém os volumes e as credenciais; não use `down -v`. Para consultar as credenciais locais, sem colá-las no terminal como comandos:

```powershell
docker compose run --rm --no-deps provision node /app/docker/local.cjs credentials
```

O acesso Master é pela opção **Acesso do suporte**, com as credenciais Master. A conta `admin.local` pertence à empresa de demonstração e não equivale ao Master.

## Mark 0.8.0 — Balanças e etiquetas

- Em **Configurações**, habilite **Mercado — lotes, balanças e etiquetas** na empresa de demonstração, se necessário.
- Confira o menu **Balanças e etiquetas**: quatro formatos genéricos, leitura inicialmente desativada, vínculo de PLUs por produto em kg e teste de leitura.
- Sem equipamento real, mantenha a leitura desativada. Os formatos não representam homologação de marcas/modelos específicos.
- Gere etiquetas de gôndola dos produtos de demonstração e confira nome, preço, unidade e código. O PDF usa A4, etiquetas de 90 × 60 mm, oito por página; imprima a 100%.
- Códigos de barras são desenhados apenas para EAN-13 válidos já cadastrados. Não é criado um código comercial fictício.

## Mark 0.9.0 — Fichas técnicas

- Habilite **Alimentação — fichas técnicas e ingredientes** em Configurações. Os perfis de alimentação sugerem o módulo, mas nenhum produto existente é convertido automaticamente.
- Cadastre um ingrediente em kg com saldo de teste e outro em unidade, com saldo de teste.
- Cadastre um preparado com preço de venda e estoque físico zero.
- Em **Fichas técnicas**, selecione o preparado, informe rendimento e ingredientes, marque a ativação e salve.
- Venda uma unidade pelo balcão. Confira a baixa proporcional dos insumos e a disponibilidade recalculada do preparado.
- Em **Cozinha**, confira o número da venda e avance preparo → pronto → retirada.
- Faça uma comanda de teste: adicionar e aumentar baixa os insumos; fechar/receber não baixa novamente.
- Altere a ficha e confira que o item antigo da comanda preserva a receita original; um novo lançamento usa a revisão nova.
- Cancele uma venda de teste. Por padrão, os insumos permanecem consumidos. Confirme reposição apenas quando eles não tiverem sido usados; lotes devolvidos ficam pendentes de conferência.
- Repita a edição de uma ficha em uma janela estreita/celular e confira a rolagem da tabela.

Use dados de demonstração; não faça vendas ou entradas fictícias na empresa de um cliente real. Guias completos: [balanças e etiquetas](../balancas-etiquetas/README.md) e [fichas técnicas](../fichas-tecnicas/README.md).

## Continuidade

Adicionais/combos/delivery, ampliações de oficina, importação de catálogos, fidelidade e acessos temporários permanecem no [roteiro autorizado](continuidade.md). A revisão de permissões por usuário vem após as melhorias funcionais, conforme solicitado.
