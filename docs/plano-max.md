# Plano MAX e níveis Bloxzuh

## Oferta definida

- R$ 45 por 30 dias.
- Renovação manual, sem cobrança automática.
- Assinatura de ferramentas, separada das taxas de visibilidade dos anúncios.
- A compra continua desativada. A página identifica todos os benefícios como planejados.

## Entregue nesta versão

- `plano-max.html`: apresentação, benefícios propostos, preço e perguntas frequentes.
- `niveis.html`: regras públicas, faixas de reputação e progresso da conta autenticada.
- Perfil público: nível, faixa, XP e progresso.
- Menu inicial e painel: acesso às duas páginas.
- `workers/mp-pix.js`: cópia do Worker atualmente implantado, obtida pelo editor do Cloudflare. Nenhuma alteração de produção foi feita no Worker.

## Níveis

Os níveis são calculados a partir das avaliações públicas recebidas como comprador ou vendedor. Cada pedido com avaliação recebida de 5 estrelas vale 100 XP, contado uma vez por destinatário. Autonegociação, autoria incompatível, avaliações sem pedido e notas menores que 5 são ignoradas. A criação de avaliações no fluxo existente exige entrega concluída.

O nível N exige `100 * (N - 1)^2` XP; o máximo é 20. Faixas: Quartzo (1–4), Ametista (5–8), Safira (9–12), Esmeralda (13–16), Rubi (17–20). As regras são próprias do Bloxzuh; não reproduzem um algoritmo privado de terceiros.

As consultas percorrem todo o histórico com paginação por ID. Não há escrita de XP no perfil, campo de nível editável ou benefício financeiro concedido por esse cálculo. Antes de associar dinheiro, limites de saque ou acesso pago aos níveis, migrar a contagem para um registro imutável no servidor e revisar as regras de escrita de `reviews`.

## Antes de abrir a contratação

O Worker atual apenas cria Pix, consulta status e responde ao webhook. Não registra assinaturas nem ativa períodos. Sua cópia está versionada para que as próximas alterações possam ser revisadas e testadas.

É necessário implementar e testar:

1. Autenticação da conta no checkout e valor de R$ 45 definido no servidor.
2. Registro privado de assinatura e pagamentos no backend, com acesso somente do servidor para escrita.
3. Confirmação do pagamento diretamente no Mercado Pago; validação de valor, moeda, conta e referência.
4. Idempotência: repetir consulta ou webhook não concede outro período para o mesmo pagamento.
5. Vencimento após 30 dias, renovação manual e tratamento de estorno/cancelamento.
6. Entitlement obtido do servidor. Não confiar em `profiles.plan`, `localStorage` ou no parâmetro de retorno do checkout.
7. Implementação real dos benefícios escolhidos e regras públicas de contratação antes de habilitar a cobrança.

## Benefícios propostos e dependências

| Benefício | Implementação necessária |
| --- | --- |
| Nome da loja e selo MAX | Assinatura validada no servidor + exibição no perfil, anúncios e chat |
| Capa e apresentação da loja | Campos e upload de imagem; preservar foto e bio básicas gratuitas |
| Vitrine da loja | Página pública dos anúncios do vendedor + personalização |
| Horário e mensagem de ausência | Configuração por dia/fuso e exibição no perfil/chat |
| Respostas rápidas | Modelos privados do vendedor e seleção no chat |
| Métricas | Agregações de pedidos; não exibir dados financeiros privados publicamente |
| Cupons | Validação e limite de uso atômicos no checkout do servidor |
| Vídeo nos anúncios | Armazenamento/entrega de vídeo e limites de formato/duração |
| Seguidores | Coleção própria, regras de leitura/escrita e notificações |

Não foram prometidos saque acelerado, mudanças de limites financeiros ou prioridade adicional nos anúncios pelo MAX. Essas regras continuam separadas.

## Validação

`node --test tests/levels.test.cjs tests/profile-photo.test.cjs tests/visibility.test.cjs`
