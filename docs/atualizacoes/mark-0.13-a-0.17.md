# Lote Mark 0.13.0 a Mark 0.17.0

Cinco etapas autorizadas pelo proprietário em 28/10/2026, para validação conjunta após seu retorno. A última versão do lote é **Mark 0.17.0**; instalar essa versão inclui as cinco etapas e o aviso destacado de caixa fechado.

## Atualização local no Windows

Abra o Docker Desktop e espere o mecanismo iniciar. No PowerShell, dentro da pasta da instalação, execute **um comando por vez**:

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Abra http://127.0.0.1:8080 e pressione **Ctrl+Shift+R**. Interface e servidor devem mostrar **0.17.0** em Sobre o sistema/rodapé. As migrações criam tabelas nos bancos cadastrados; mantêm credenciais, produtos, vendas, estoque, OS e histórico existentes. A atualização não insere dados de demonstração no cadastro do cliente. Não apague volumes.

## O que validar

| Mark | Onde encontrar | Conferência sugerida |
| --- | --- | --- |
| **0.13.0 — Agenda da oficina** | Menu Agenda da oficina | Agende um veículo/responsável, tente sobrepor um horário, reagende, registre chegada e vincule uma OS ativa. Confira histórico. |
| **0.14.0 — Garantias e retornos** | Menu Garantias e retornos | Selecione uma OS entregue e paga, informe condições/prazo, registre retorno, dê parecer e imprima o documento. |
| **0.15.0 — Importação de autopeças** | Menu Importar autopeças | Baixe o modelo CSV, informe a fonte, mapeie colunas, revise e confirme. Confira produtos inativos, sem estoque, antes de ativá-los. |
| **0.16.0 — Fidelidade de clientes** | Menu Fidelidade; Vendas → Carrinho | Defina percentual/validade, selecione o cliente no carrinho e aplique o desconto como gerente/admin. Confira valor, cupom e histórico. |
| **0.17.0 — Acessos temporários de suporte** | Acesso do fornecedor (`/support`), conta Master | Carregue empresas, emita código para um operador de suporte, teste consulta restrita à empresa e revogue o acesso. |

Agenda/garantias precisam do módulo Oficina habilitado; importação precisa de Autopeças. Os módulos podem ser habilitados em Configurações sem mudar o perfil do estabelecimento. Fidelidade está disponível em todos os segmentos. O aviso de **Você precisa abrir um caixa para vender** tem fundo/borda vermelhos e título em negrito, com contraste no modo escuro.

## Limites desta entrega

- Agenda não envia lembretes externos nem reserva peças. Vincular/concluir um horário não altera a OS.
- Garantia registra condições informadas e pareceres, sem definir direitos legais, gratuidade, estorno ou movimentos de estoque automaticamente.
- CSV não sobrescreve produtos, não cria equivalências e não inventa compatibilidades. A fonte e as aplicações precisam ser conferidas pelo estabelecimento.
- Fidelidade usa percentual nas vendas diretas, aplicado por gerência, sem acumular desconto. Não implementa pontos, cashback ou aplicação automática em comandas/OS/orçamentos.
- Código temporário é forte, de uso único, restrito a operador e empresa e somente consulta. Não muda senhas permanentes nem envia o segredo por mensagem automaticamente.
- A matriz nova de permissões por usuário ainda não foi aplicada. É a próxima revisão prevista com o proprietário; administradores de clientes continuam restritos à própria empresa, Master continua separado e suporte não ganhou escrita.

## Guias

- [Agenda](../oficina/agenda.md)
- [Garantias e retornos](../oficina/garantias.md)
- [Importação de autopeças](../oficina/importacao-autopecas.md)
- [Fidelidade](../oficina/fidelidade.md)
- [Acesso temporário](../oficina/suporte-temporario.md)

## Validação técnica

Empresas sintéticas no projeto Docker descartável `pdv-commerce-test`, sem uso de banco de cliente. Testes de API para cada Mark, navegação integrada em Chromium, tela de 390 pixels/modo escuro, geração de PDF, regressão financeira/estoque e recriação dos contêineres para conferir persistência. Build e lint sem erros; 12 avisos antigos do lint permanecem.

Os scripts de cada etapa estão em `scripts/*-smoke.cjs`. A navegação do lote usa `scripts/marks-13-17-browser.cjs`; persistência usa `scripts/marks-13-17-persistence.cjs`. Dependem das fixtures privadas geradas pelas verificações da oficina/evidências e das novas etapas. Arquivos de sessão em `work/` são ignorados pelo Git e não devem ser compartilhados. Não executar testes sintéticos numa instalação de cliente.

Resultado do lote: **862 verificações aprovadas**. Agenda: 23; garantia/retorno: 40; CSV: 23 HTTP + 5 de parser; fidelidade: 28; acesso temporário: 32; navegador integrado: 17; persistência: 30; versão/cache: 3. Regressões: oficina 94, concorrência 19, pizzaria 110, combos 121, comercial 119, entregas 94 e fichas técnicas 104. PDFs conferidos em texto e a interface em tela estreita/modo escuro; impressoras físicas e equipamentos do estabelecimento continuam dependentes da validação local.
