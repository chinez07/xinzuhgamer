# Clube MAX Bloxzuh

## Oferta e benefícios

R$ 45 por 30 dias, renovação manual. Inclui nome da loja e coroa de assinante, capa, vitrine em `loja.html?uid=...`, horários de atendimento e mensagem de ausência. Não altera as taxas de visibilidade dos anúncios, a liberação de saldo ou os níveis. Foto e biografia básicas continuam gratuitas.

O GIF fornecido está preservado em `assets/clube-max.gif`. A identidade MAX usa roxo/preto/branco. A coroa mostra “Assinante Clube Max” por hover, foco ou clique. Ela é exibida somente após consultar uma assinatura ativa no servidor.

## Backend

- Worker: `bloxzuh-pix.hskkaj48.workers.dev`.
- Fonte editável MAX: `workers/max-core.mjs`.
- Rotas Pix anteriores preservadas: `workers/mp-pix.legacy.js`.
- Arquivo único para o editor Cloudflare: `workers/mp-pix.js`, gerado por `node scripts/build-max-worker.cjs`.
- D1: `bloxzuh-max`, binding `MAX_DB`, ID `691d2aa3-32f9-417a-ad72-e3bbe4fe4995`.
- Secret existente `MP_ACCESS_TOKEN` permanece no Cloudflare e não é versionado.
- Variável de abertura: `MAX_SALES_ENABLED=true`. Sem ela, o checkout responde indisponível.

### Rotas MAX

| Rota | Uso |
| --- | --- |
| GET /max/config | Preço, período e abertura de vendas |
| GET /max/public?uid=... | Estado público da assinatura e configuração ativa; `compact=1` omite capa/horários |
| GET /max/me | Dados da própria conta, configuração preservada e últimos pagamentos |
| POST /max/checkout | Pix autenticado, valor fixo no servidor, CPF e consentimento das condições |
| GET /max/payment?id=... | Consulta somente do próprio pagamento; confirma diretamente no Mercado Pago |
| POST /max/webhook | Reconsulta o pagamento conhecido no Mercado Pago; não confia em status recebido no corpo |
| PUT /max/profile | Salva nome, capa, horários e mensagem; exige assinatura ativa |

A autenticação valida a origem do ID token e consulta `accounts:lookup` do Firebase. Nenhuma informação de assinatura em `localStorage`, no perfil Firestore ou no corpo do checkout concede acesso.

### Pagamentos e períodos

- Preço, moeda BRL, método Pix, UID e referência são conferidos contra a resposta do Mercado Pago.
- A mesma tentativa usa a mesma chave de idempotência e a mesma expiração no processador.
- Cada pagamento é registrado uma vez por ID; consultas e webhooks repetidos não concedem novos períodos.
- Renovação antes do vencimento soma 30 dias ao fim do período atual. Após vencer, o novo período começa na nova aprovação.
- Estorno total/parcial ou chargeback remove o período correspondente. Uma resposta antiga de aprovação não reativa pagamento estornado.
- CPF não é armazenado no D1. O serviço o encaminha ao Mercado Pago para criar o Pix.
- Pagamentos de teste não ativam benefícios em produção. `MAX_ALLOW_TEST_PAYMENTS` não deve ser habilitada em produção.
- As configurações ficam guardadas após vencer, mas o endpoint público deixa de retorná-las e a escrita premium é negada.

### Publicação

Depois de editar o núcleo, execute o build e os testes. Publique o arquivo único gerado no editor do mesmo Worker, preservando secret e binding. O arquivo `workers/wrangler.jsonc` documenta a configuração para futuras implantações por CLI. O front continua publicado por GitHub main → Cloudflare Pages.

## Validação

`node --test tests/max-subscription.test.mjs tests/max-client.test.cjs tests/levels.test.cjs tests/profile-photo.test.cjs tests/visibility.test.cjs`

Foram testados localmente: valor fixo, idempotência, conta errada, sessão inválida, pending/aprovação/renovação/estorno, resposta atrasada, bloqueio após vencimento e validação da configuração. O fluxo visual usa uma prévia isolada com dados e pagamentos fictícios, fora da versão publicada. Nenhum Pix real é pago pelo agente.

O primeiro pagamento real deve ser concluído pelo titular no aplicativo bancário; não confundir os testes com uma liquidação real do Mercado Pago.

## Níveis

Os níveis continuam gratuitos. Cada pedido com avaliação recebida de 5 estrelas concede 100 XP, contado uma vez por destinatário. Negociação consigo mesmo, autoria incompatível e dados sem pedido são ignorados. Nível N: `100 * (N - 1)^2` XP, máximo 20. Quartzo 1–4, Ametista 5–8, Safira 9–12, Esmeralda 13–16, Rubi 17–20. A contagem percorre todo o histórico por paginação e não grava níveis editáveis em `profiles`.

Não estão incluídos nesta versão: cupons, seguidores, vídeos, respostas rápidas, métricas avançadas ou aceleração de saques.
