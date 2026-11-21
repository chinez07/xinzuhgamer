# Proteção financeira — publicada

O backend, as regras do Firestore e o front deste pacote foram publicados em 21/11/2026. Os passos abaixo documentam a operação e as próximas implantações. Arquivos no GitHub, isoladamente, não publicam Workers nem regras.

## Verificações da publicação

- Carteira carregada pelo site com a conta administrativa: token Firebase, limite D1, troca OAuth e leitura/gravação do Firestore funcionaram em produção.
- Regras publicadas: criação direta de carteira e pedido negada no laboratório do Firebase com usuário autenticado. As simulações não gravaram documentos.
- Acesso anônimo a carteira, consulta de pagamento e criação de Pix retornou HTTP 401; origem externa retornou 403. Configuração pública do MAX continuou respondendo 200.
- Cabeçalhos `nosniff`, `DENY` e CSP conferidos na resposta do Pages.
- Worker legado de saques substituído por `workers/saque-locked.mjs`: informa processamento manual e recusa POST com HTTP 403, sem chamar o Mercado Pago.
- A chave gerada pelo Google cujo download não chegou foi revogada. Existe apenas o certificado público enviado para a conta dedicada. A chave privada correspondente permanece no secret Cloudflare; não foi salva no repositório.
- 86 testes automatizados aprovados e sintaxe de 78 scripts conferida. Nenhum Pix foi pago e nenhuma transferência foi executada pela automação; o primeiro fluxo financeiro completo ainda exige validação do operador.

## O que muda

- Pedidos, preço, quantidade, taxa, Pix e transições são validados no Worker.
- O Worker valida o token no Firebase, consulta o Mercado Pago com a credencial privada e confere valor, moeda, método, referência e comprador.
- `financialWallets` e `secureWithdrawals` são as fontes financeiras novas. Essas coleções não eram graváveis nas regras anteriores. `wallets` e `withdrawals` ficam preservadas para conferência; valores antigos não são importados automaticamente. `marketOrderProofs` guarda o registro privado dos pedidos criados pelo serviço, impedindo a importação de pedidos forjados antes da migração.
- Uma confirmação grava pedido, estoque e crédito atomicamente, com controle de versão e repetição em conflitos. Saques concorrentes não gastam duas vezes o mesmo saldo.
- Somente Pix real aprovado gera crédito. Estorno bloqueia saques para análise. A liberação mantém dez dias contados da aprovação do provedor.
- Saque é uma solicitação com débito atômico. Não há transferência Pix automática: o administrador faz a transferência e registra o pagamento manualmente após conferir o comprovante. Tempo decorrido não significa pagamento.
- Chat e avaliações passam pelo backend. Avaliação exige pedido concluído com pagamento comprovado e só pode ocorrer uma vez por participante.
- Usuários não gravam saldo, status de pagamento, avaliações ou notificações arbitrárias pelo SDK. Admin é identificado pelo UID fixo, não pelo e-mail informado no navegador.
- Há limite de requisições por conta e por rota no D1. CORS limita as origens do navegador, mas a autorização é sempre pelo token.
- Os códigos Pix usam 30 minutos de validade, mínimo da API Mercado Pago; a tela usa a validade retornada pelo provedor.

## Acesso privado necessário

A conta de serviço dedicada `bloxzuh-finance` foi criada no projeto `xinzuhgamer-87ff5`, com papel **Cloud Datastore User** (`roles/datastore.user`), com autorização explícita do titular. Esse papel permite acesso aos dados do Firestore pelo backend, fora das regras de cliente. Não concede administração do IAM.

O certificado público do par criado localmente foi enviado ao Google. O JSON da credencial privada está somente no secret **FIREBASE_SERVICE_ACCOUNT** do Worker **bloxzuh-pix**, na conta Cloudflare já utilizada. O certificado vence em **17/11/2027**: substituir o par e atualizar o secret antes disso. Nunca colocar a chave no GitHub, HTML, imagens, mensagens ou arquivo de configuração público. O Worker usa OAuth com escopo Datastore e cache curto. Os secrets existentes do Mercado Pago foram preservados.

Esse acesso é sensível e precisa de autorização explícita antes de criar a conta, conceder o papel e gerar/transferir a credencial. Preferir federação sem chave em uma evolução posterior.

## Ordem de ativação

1. Configurar o secret, preservar `MAX_DB`, `MP_ACCESS_TOKEN` e variáveis MAX.
2. Executar `node scripts/build-max-worker.cjs`, todos os testes e `node scripts/check-page-scripts.cjs`.
3. Publicar `workers/mp-pix.js` no Worker. Rotas antigas sem autenticação deixam de gerar/consultar Pix; `/max/*` continua funcionando.
4. Publicar `firestore.rules` no Firebase e o front correspondente no Pages em sequência. Durante a troca pode haver indisponibilidade curta do checkout em abas antigas; não deixar combinações de regras e front antigas.
5. Conferir login, catálogo, perfil/foto, MAX, carteira vazia, negativas de permissão, cabeçalhos e chamadas autenticadas. Primeiro Pix real precisa ser conferido pelo operador, sem simular aprovação no banco.
6. Manter o Worker **bloxzuh-saque** no bloqueio de `workers/saque-locked.mjs`. O front novo não chama `/payout`. Não restaurar o endpoint antigo, que aceitava pedidos de transferência sem autenticação.

## Regras e identidade futura

As regras podem exigir aprovação de vendedor quando `settings/security.requireSellerIdentity` for ativado por um operador no console. O documento `identityVerifications/UID` deve conter `status: approved` e só ser gravado por um serviço autorizado. A exigência fica desativada até existir um fluxo real de verificação.

Isso não implementa coleta/validação de documentos. Documentos não devem ser enviados para ImgBB nem para perfis públicos. O fluxo precisa de armazenamento privado, retenção definida e controle de acesso próprio.

## Conferências que ainda precisam de ambiente real

- Primeiro pagamento real, liberação após dez dias, conciliação com Mercado Pago e processamento manual de um saque completo; teste local não comprova liquidação real.
- Histórico financeiro antigo e pedidos simulados exigem conciliação; não migrar por confiança nos valores do navegador.
- A carteira retém até 400 lançamentos antes de exigir consolidação; chats limitam 250 mensagens. Não é uma implementação de alta escala.
- O estoque é baixado na confirmação do Pix, sem reserva durante o checkout. Concorrência acima do estoque gera `stockNeedsReview` para tratamento administrativo; não promete reserva automática.
- Reembolso deixa a carteira em análise, sem uma rotina automática de estorno/pagamento. É necessário reconciliar notificações perdidas e saques pendentes antes de transferir dinheiro.
- Revisão completa de XSS em todas as páginas, privacidade de perfis legados (a coleção pública contém e-mails), uploads, recuperação de conta e abuso continuam sendo trabalho adicional. O CSP atual bloqueia objetos, enquadramento e alteração da base, mas ainda não aplica bloqueio estrito de scripts inline.
- MFA de GitHub/Google/Cloudflare/Mercado Pago depende do titular; não foi configurado neste pacote.
- Backups automáticos, retenção, teste de restauração, WAF/Turnstile e Firebase App Check ainda precisam de configuração e monitoramento antes de ativação. Não ativar cobrança de serviços sem aprovação.

## Validação

`node --test tests/*.test.cjs tests/*.test.mjs` cobre crédito duplicado, preço adulterado, Pix de teste, comprador errado, ausência de pagamento, saques concorrentes, saldo legado, transições, avaliações e mensagens. O laboratório do Firebase permite compilar e simular as regras candidatas sem publicá-las ou alterar documentos.
