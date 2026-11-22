# Teste local de categorias e moderação

Estas alterações estão somente no computador. Não foram enviadas ao GitHub, Cloudflare ou Firebase.

## Abrir

Com Node.js 22 ou superior, execute na pasta do repositório:

```powershell
node scripts/preview-moderation.mjs
```

Abra <http://127.0.0.1:8789/>. Se a prévia já estiver aberta, basta acessar o endereço.

O servidor aceita somente conexões de 127.0.0.1. Os registros ficam em `.local-preview/ads.json`, ignorado pelo Git. A página de criação real é servida com um adaptador local: não acessa Firebase, Mercado Pago ou ImgBB. A política de rede da prévia também bloqueia esses destinos. O MAX é uma concessão fictícia apenas neste ambiente, para permitir testar os controles de imagem.

## O que testar

1. Digite um telefone no campo do painel: a prévia mostra asteriscos. O filtro compartilhado foi integrado a perguntas, respostas e exibição do FAQ público; o chat privado do pedido permanece separado.
2. Crie um anúncio de teste. Em Categoria, selecione Jogos e Roblox: o produto pode ser Conta, Robux, Item, Serviço ou Outros. Escolha a experiência, ou Outros jogos e informe o nome.
3. Selecione Free Fire: aparecem Conta, Diamantes, Item, Serviço e Outros. Os demais jogos oferecem seus respectivos tipos. Outros jogos exige o nome do jogo.
4. Adicione fotos locais, revise e envie. Sem serviço de visão conectado, elas ficam pendentes. No painel local, informe um motivo e aprove ou reprove. Nada é publicado no marketplace real.
5. Use Editar anúncio local para verificar a preservação de jogo, experiência, tipo e imagens. Reenvios de imagens voltam à revisão.

## Limite atual da análise visual

O código do Worker analisa capa, galeria, moldura e fundo. Contatos identificados e incompatibilidade clara de jogo reprovam o conjunto. Resposta inválida, baixa confiança e falha do serviço encaminham à revisão humana. A confiança informada pelo modelo não é uma garantia estatística: fotos reais precisam ser avaliadas com um conjunto representativo antes de habilitar a aprovação automática em produção.

**O serviço foi conectado na prévia local em 22/11/2026.** O Gemma 4 é o modelo padrão para texto e fotos. O Qwen 3.8 foi testado como comparação, sem chamada duplicada automática. O relatório dos exemplos reais fica em `.local-preview/live-moderation-report.json`. Os testes unitários continuam usando respostas controladas; poucos exemplos reais não medem a acurácia para todo o marketplace.

Para iniciar com IA real, abra `Iniciar-Teste-IA.cmd` ou execute `node scripts/start-preview-ai.mjs`. O acesso foi autorizado pelo operador: token Workers AI Read/Edit, restrito à conta Cloudflare e válido até 29/11/2026. Ele fica criptografado com DPAPI em `.local-preview/cloudflare-ai.dpapi`; somente o mesmo usuário do Windows consegue abri-lo. Não existe token no front, no Git ou no log. A cópia temporária de texto foi removida.

A prévia tem um limite local adicional de 20 chamadas de IA por dia (UTC), persistido em `.local-preview/ai-usage.json`. Cada texto ou imagem pode consumir uma chamada. Isso é um limite de chamadas, não uma estimativa exata de Neurons. Não houve contratação ou alteração de plano. A franquia e os limites da conta Cloudflare continuam aplicáveis. Quando o acesso expira ou a IA falha, o conteúdo vai para revisão.

Modelos escolhidos: [Gemma 4 26B A4B](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/) como padrão e [Qwen 3.8 27B](https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/) como candidato de comparação. A antiga dependência do Llama 3.2 foi substituída; não é preciso executar seu comando de aceitação de licença para estes testes.

## Integração de produção — 22/11/2026

O serviço foi incorporado ao Worker existente bloxzuh-pix em /moderation/review, usando o binding AI, o D1 MAX_DB e o secret privado FIREBASE_SERVICE_ACCOUNT já existente. O front usa https://bloxzuh-pix.hskkaj48.workers.dev/moderation. O token temporário da prévia não é usado em produção.

O D1 limita cada usuário a 6 solicitações por hora e o conjunto a 20 chamadas de IA por dia UTC. Cada texto ou imagem consome uma chamada; ao esgotar o orçamento, o conteúdo segue para revisão humana. A variável MAX_MODERATION_AI_CALLS_PER_DAY permite definir de 1 a 1000, com padrão 20. Não houve mudança de plano pago.

As regras foram validadas com sete testes no emulador antes da publicação. Elas vinculam título, descrição, categoria e imagens ao recibo emitido pelo servidor; pendentes e reprovados não ficam públicos. A revisão administrativa é transacional. Anúncios antigos permanecem visíveis enquanto ativos; reativação ou alteração de conteúdo exige análise.

A fila fica em revisao-anuncios.html, acessível pelo painel administrativo. Busca até 100 pendentes por vez; recarregue após revisar para obter os seguintes. O índice composto de ads usa sellerUid crescente e status crescente, com __name__ crescente implícito.

## Correções da validação de texto e categoria

- Robux exige Roblox geral; Blox Fruits e outras experiências não aceitam o produto Robux. O formulário seleciona e trava Roblox geral ao escolher esse produto. Contas e itens de uma experiência continuam permitidos.
- Título e descrição agora fazem parte da análise e do recibo de aprovação. Alterá-los exige nova análise; não basta reaproveitar uma aprovação antiga das fotos.
- Texto vazio ou contradição clara com a categoria é rejeitado. Texto vago vai para revisão. A análise detalhada por modelo usa a conexão privada com Workers AI; verificações locais não são uma compreensão completa do conteúdo.
- A revisão manual também verifica as incompatibilidades determinísticas antes de aprovar. A fila mostra a descrição para conferência.
- O exemplo local de Robux em Blox Fruits foi reclassificado como reprovado, com o motivo visível. O arquivo anterior foi preservado em `.local-preview/ads.before-text-review.json`.
- Telefones com espaços entre todos os dígitos também são mascarados; preços e datas comuns são cobertos pelos testes de regressão.
