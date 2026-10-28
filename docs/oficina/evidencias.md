# Mark 0.12.0 — Fotos e assinaturas na oficina

## Atualizar e localizar

```powershell
git pull --ff-only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\docker\atualizar.ps1
```

Na pasta da instalação local, execute um comando por vez. Abra http://127.0.0.1:8080, pressione **Ctrl+Shift+R** e confira **0.12.0** na interface e no servidor.

Em **Oficina → Ver OS → Fotos e assinaturas**, ficam os registros do atendimento. O módulo Oficina pode ser habilitado em qualquer perfil. A atualização cria tabelas de anexos nos bancos cadastrados e preserva veículos, ordens, recebimentos e credenciais existentes. Nenhuma OS antiga recebe uma assinatura ou foto automaticamente.

## Fotos do checklist

1. Salve a OS, com um responsável ativo definido se ele for anexar fotos.
2. Nos detalhes da OS, escolha o item fotografado, descreva a foto e selecione uma imagem PNG/JPEG. Em navegadores compatíveis, o seletor também permite usar a câmera do dispositivo.
3. Clique **Anexar foto**. A foto é ligada à OS e ao item do checklist, com data, operador e hash do arquivo guardado.
4. Use **Ver foto** para abrir a imagem e **Baixar arquivo guardado** para obter uma cópia.

O navegador ajusta a imagem para JPEG, com até 1600 pixels no lado maior e 2 MB. A imagem ajustada é a versão guardada; não é preservação forense do arquivo original da câmera. A seleção original aceita até 10 MB. O servidor aceita imagens validadas de até 2 MB e 2048 × 2048 pixels; PNG direto pela API precisa ser padrão de 8 bits, sem entrelaçamento. O armazenamento fica no PostgreSQL da própria empresa e integra os backups do banco, sem um serviço externo de arquivos.

Até **dez fotos ativas** e **20 registros no total** por OS. O responsável atribuído à OS e a gerência podem anexar durante o atendimento; anexos novos são bloqueados após entrega/cancelamento. Usuários não atribuídos não podem anexar. Gerente/administrador e Master podem arquivar uma foto, com motivo. O original continua no histórico, inclusive para consulta/download; não é exclusão permanente.

## Assinatura de aceite

1. Registre a aprovação da OS pelo fluxo existente, informando a autorização recebida.
2. Enquanto a OS estiver **Aprovada**, clique **Registrar assinatura de aceite**.
3. Apresente o conteúdo ao cliente: veículo, diagnóstico, observações, checklist, peças/serviços, valores e fotos referenciadas.
4. Confira o nome e o vínculo de quem assina. O cliente pode desenhar com dedo, caneta ou mouse.
5. Confirme **Cliente conferiu o conteúdo e assinou neste dispositivo** e salve.

A assinatura é opcional no fluxo atual: o registro de aprovação por anotação continua disponível. O registro desenhado guarda sua finalidade, signatário informado, vínculo, conteúdo apresentado, fotos referenciadas, data do servidor e operador. Não há certificado digital, validação automática de identidade, link público ou envio de WhatsApp/e-mail nesta entrega.

Uma revisão do orçamento preserva os aceites anteriores, identificados como **escopo anterior**. Não reutiliza o desenho antigo para aceitar os valores novos. Se a OS mudar enquanto a janela de assinatura estiver aberta, é necessário atualizar e conferir novamente; o desenho e a confirmação são limpos quando a revisão muda.

Fotos anexadas depois não passam a integrar uma assinatura anterior. As referências do momento do aceite permanecem preservadas, mesmo se a foto for arquivada depois.

## Assinatura de recebimento

Após receber o pagamento e registrar a OS como **Entregue**, use **Registrar assinatura de recebimento**. O registro inclui o vínculo com a venda e a entrega. A assinatura não recebe dinheiro nem movimenta estoque novamente.

A captura é feita por gerente/administrador ou Master. O suporte mantém consulta e PDF, sem escrita. Os usuários técnicos da plataforma continuam fora da lista de mecânicos.

## Correções e impressão

**Cancelar registro de assinatura** exige gerência, motivo e revisão atual da OS. Marca o registro como cancelado e mantém seu desenho e conteúdo. Essa ação não cancela a OS, seu pagamento ou a aprovação anotada. Para mudar a autorização/orçamento, use o fluxo de revisão da própria OS.

Em **Imprimir / PDF**, o documento inclui fotos ativas, assinaturas, conteúdo apresentado em cada ato e identificação dos registros cancelados/anteriores. Fotos arquivadas constam no histórico de anexos; seus arquivos continuam disponíveis no sistema. Os hashes são dados de conferência de integridade do registro armazenado, não uma certificação externa de identidade ou de data.

A impressão física depende do leitor de PDF e da impressora local. Câmera e caneta do dispositivo devem ser conferidas no equipamento do estabelecimento; os testes automatizados usam Chromium, mouse e tela estreita.

## Próximas etapas

Agenda e garantia/retorno de oficina permanecem na continuidade. A revisão de permissões por usuário continua após as melhorias funcionais, conforme solicitado pelo proprietário.

## Validação sintética

```bash
PDV_EVIDENCE_BROWSER_FIXTURE=work/workshop-evidence/fixture.json node scripts/workshop-evidence-smoke.cjs
node scripts/workshop-evidence-browser.cjs
node scripts/workshop-evidence-persistence.cjs
```

Somente no projeto Docker descartável `pdv-*-test`. Arquivos de sessão/fixture em `work/` têm credenciais sintéticas, são ignorados pelo Git e não devem ser compartilhados. Validar imagens falsas/limites, revisão entre terminais, escopo de assinatura, arquivo preservado, PDF, suporte sem escrita, isolamento e recebimento/estoque únicos.

Resultado desta entrega no projeto descartável: **337 verificações aprovadas** — 119 de evidências pela API, 9 no navegador (incluindo tela de 390 pixels e correção de desenho curto), 76 de persistência após recriação/migração, 94 do fluxo de oficina, 19 de concorrência/revisão, 17 do navegador da oficina e 3 de versão/cache. PDF gerado e inspecionado, com foto, assinatura e escopos antigos. Lint sem erros; permanecem 12 avisos já existentes. Build da interface concluído. Nenhum banco de cliente foi usado nas demonstrações.
