# Pedidos, chat e privacidade — 22/11/2026

O saldo de vendas pendentes exige entrega confirmada pelo comprador e dez dias a partir do pagamento. Itens antigos ainda pendentes são conferidos gradualmente pelo servidor, sem alterar os pedidos. Valores já liberados anteriormente não são revertidos automaticamente.

O chat novo usa `orders/{id}/messages/{messageId}`, com páginas de 40 mensagens. O array antigo `orders.messages` é preservado e continua sendo exibido. Mensagens novas são gravadas somente pelo Worker; `requestId` evita duplicação ao reenviar uma falha. Recibos de leitura são cursores por participante e não gravam novamente quando nada mudou.

Imagens de chat são JPG/PNG/WebP comprimidas no navegador, de até 290 mil caracteres em base64 no servidor. Ficam dentro do documento privado da mensagem; não são enviadas ao ImgBB. SVG e URLs de imagens externas não são aceitos para mensagens.

`supportTickets` é privado. Abertura em uma compra paga acrescenta um bloqueio de suporte à carteira do vendedor. A administração acompanha em `suporte.html?admin=1`. A conclusão exige uma descrição da solução e confirmação explícita; remove apenas o bloqueio daquele ticket. Bloqueios por estorno ou outras conferências não são removidos. Não há reembolso automático nem transferência de dinheiro pelo suporte.

Perfis completos em `profiles` só são legíveis pelo dono e pela administração. As rotas públicas `/market/public-profile?uid=...` e `/market/public-profiles` retornam uma lista explícita de campos públicos, sem e-mail ou preferências experimentais. Não é necessário apagar nem migrar os documentos existentes para proteger seus campos privados.

Ajustes de contraste são opcionais e locais por conta/dispositivo; não mudam a transparência dos cartões. As páginas de condições, privacidade e reembolso descrevem o funcionamento implementado, sem inventar dados cadastrais, prazo de resposta ou endereço de contato da empresa.

Validação: testes unitários de autoridade, prazo, idempotência, privacidade e suporte; regras no emulador com projeto demo; interface de PC e celular com dados fictícios e conexões externas bloqueadas. A demonstração em `.local-preview` não deve ser publicada.

A leitura de documentos novos de mensagens pela administração não foi ativada. A revisão automática exigiu autorização específica; a solicitação apresentada limita esse acesso a pedidos com ajuda aberta, somente leitura e sem recibos de leitura. Até a decisão, apenas comprador e vendedor leem as novas mensagens.
