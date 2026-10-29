# Caminho para a Mark 1.0.0

Escopo acordado com o proprietário em 29/10/2026: concluir pizzas personalizadas nos combos e concentrar as próximas entregas em estabilização. Novos módulos, pontos/cashback e novas expansões ficam para versões posteriores, salvo correção necessária ao funcionamento já previsto.

## Escopo da primeira versão

Instalação Docker local com os perfis de negócio existentes: alimentação (bar/restaurante, hamburgueria e pizzaria), comércio/mercado, autopeças e oficina. Os módulos são ativados conforme a operação; trocar o perfil preserva cadastros e histórico. Inclui os fluxos existentes de caixa/vendas, mesas/comandas/cozinha, entrega, estoque/fichas técnicas/lotes, clientes/fidelidade, gestão comercial/financeira, oficina, relatórios, usuários/permissões e suporte.

Mark 0.21.0 conclui a montagem de pizzas dentro de combos. A estabilização da Mark 1.0.0 começa a partir dessa base. O número 1.0.0 só será publicado após cumprir os critérios abaixo e receber a validação final do proprietário.

## Critérios para concluir

| Frente | Critério de aceitação | Evidência necessária |
|---|---|---|
| Valores e caixa | Quantidade, centavos, desconto, pagamentos divididos, cancelamento e fechamento coerentes; operador registrado | Testes de regressão e uma operação completa pelo proprietário |
| Alimentação | Montar pizza/combo, lançar em venda e mesa, acompanhar cozinha, fechar e imprimir; entrega vinculada preserva composição | API, navegador, cupons e via de entrega |
| Mercado/comércio | Venda comum e por medida, código de barras, estoque e lotes/validade sem divergências | Regressão com dados sintéticos; equipamento real quando utilizado |
| Oficina/autopeças | Cadastro de veículo, agenda, OS, peças/serviços, aceite, recebimento e garantia com histórico | Regressão por perfil e revisão de uma operação completa |
| Permissões | Funcionários acessam apenas ações liberadas; inativados não entram; cliente restrito à própria empresa; suporte somente leitura; Master separado | Testes de API de acesso/isolamento e conferência dos perfis pelo proprietário |
| Dados e recuperação | Atualizar preserva registros e credenciais; backup e restauração recuperam os dados | Teste de persistência e restauração em ambiente descartável, além do backup local já validado pelo proprietário |
| Interface e documentos | Confirmação de salvamento, mensagens de erro, modo escuro/celular e impressões utilizáveis nos fluxos principais | Testes de navegador e conferência visual |
| Entrega | Interface e servidor com mesma versão; instruções de instalar/atualizar/recuperar acessíveis | Teste da versão publicada e documentação |

Os testes anteriores permanecem evidência das respectivas Marks. A revisão final precisa registrar quais foram executados novamente na versão candidata. Não considerar a tabela inteira aprovada apenas porque uma funcionalidade isolada passou.

## Dependências externas e limites da primeira entrega

| Recurso | Situação | Condição para anunciar como disponível |
|---|---|---|
| Recuperação por e-mail | Fluxo preparado; SMTP não definido | Configurar remetente/serviço e testar envio, validade e uso único do link |
| Backup fora do computador | Configuração preparada; destino não escolhido | Definir destino, executar cópia e restaurar a partir dela |
| Confirmação automática de Pix | QR/chave informada pelo cliente; conciliação automática depende de provedor | Contratar/configurar provedor e homologar notificações e conciliação |
| Emissão fiscal | Não homologada | Definir provedor e homologar o documento aplicável |
| Balanças e impressoras | Formatos preparados; nenhum equipamento do proprietário homologado | Testar marca/modelo, etiquetas e impressão física |

A primeira entrega local deve descrever essas limitações. Não apresentar cupom não fiscal como nota fiscal, QR Pix como confirmação bancária, backup local como cópia externa ou formatos de balança como homologação de equipamento.

## Ordem das próximas etapas

1. Concluir e validar a Mark 0.21.0 — pizzas personalizadas nos combos.
2. Executar a revisão de regressão dos módulos e registrar resultados por versão candidata.
3. Corrigir falhas encontradas e revisar os fluxos principais com o proprietário.
4. Conferir atualização, recuperação e instruções de uso.
5. Fechar a lista de pendências impeditivas e publicar Mark 1.0.0 após validação final.

Não estabelecer prazo ou percentual de conclusão sem fechar as pendências dessa revisão. SMTP, destino externo e provedores continuam aguardando escolha; não é necessário inventar integrações para concluir a etapa atual.

## Evidência técnica reunida

- [Mark 0.21.0](../atualizacoes/mark-0.21.md): 1.220 verificações de pizzas/combos, regressão dos perfis e preservação de registros após recriação/migração.
- [Mark 0.22.0](../atualizacoes/mark-0.22.md): 306 verificações de salvamento, financeiro, falhas e regressão comercial/navegador. Dependências de módulos explicadas na interface.

A revisão final do proprietário e a conferência dos equipamentos/destinos/provedores efetivamente utilizados continuam pendentes. Essas evidências permitem iniciar a validação final; não publicam por si só a Mark 1.0.0.
