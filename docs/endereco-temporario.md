# Endereço temporário Bloxzuh

Endereço principal: https://xinzuhgamer.pages.dev

O projeto Cloudflare Pages continua sendo `xinzuhgamer`, conectado ao mesmo repositório e ao mesmo Firebase. Contas, anúncios, pedidos e assinaturas permanecem no banco existente.

Na migração de 21/11/2026:

- O Firebase já autorizava `xinzuhgamer.pages.dev`; as autorizações de `bloxzuh.store` e `www.bloxzuh.store` foram removidas.
- O Worker Pix passou a aceitar a origem exata `https://xinzuhgamer.pages.dev`. Outros projetos Pages e o domínio abandonado não são aceitos.
- O endpoint legado de saque continua bloqueando transferências automáticas e usa a nova origem na configuração CORS.
- O upload ImgBB já aceita requisições do novo endereço; sua chave continua no Worker.
- O link de retorno da recuperação de senha aponta para o endereço temporário.
- Os dois domínios antigos foram desvinculados do projeto Pages, mantendo o projeto e seu endereço `pages.dev`.

Conferência em produção: site e script de autenticação responderam HTTP 200, o link de recuperação usa o novo endereço, o login Google retornou à mesma conta e a carteira autenticada carregou no painel. O Pix aceitou o preflight do novo endereço (204) e rejeitou o domínio antigo e outro projeto Pages (403). Carteira sem login continua retornando 401, upload aceita preflight (204) e o endpoint legado de transferência continua bloqueado (403). Nenhum pagamento ou saque foi executado para esses testes. Worker Pix publicado: `2ad6fddd`; saque bloqueado: `0594ea09`.

É necessário fazer login novamente no novo endereço: a sessão e as preferências locais do navegador pertencem ao domínio. Os dados salvos no Firebase permanecem os mesmos.

Ao escolher o domínio definitivo, atualizar a lista autorizada no Firebase, a origem exata em `workers/market-core.mjs` e `workers/saque-locked.mjs`, o retorno da recuperação de senha em `js/firebase-auth.js`, gerar `workers/mp-pix.js` e publicar os Workers e o site. Não autorizar `*.pages.dev` inteiro.
