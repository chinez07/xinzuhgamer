# Atalhos de jogos em alta

Os três atalhos da busca seguem a quantidade de pedidos pagos e concluídos nos últimos 7 dias. Cada pedido conta uma vez, independentemente do valor, quantidade ou visibilidade do anúncio. Empates usam o identificador da categoria em ordem alfabética.

O Worker consulta os pedidos pelo campo `completedAtMs`, pagina todos os resultados e devolve somente os identificadores das três categorias. Exclui pedidos sem pagamento verificado, legados sem `secureVersion: 1`, cancelados, estornados e datas futuras. Novos pedidos guardam a categoria do jogo; pedidos anteriores usam a categoria atual do anúncio, quando ele ainda existe.

A resposta fica em cache no Worker por 5 minutos e a home consulta novamente a cada 5 minutos enquanto estiver visível. Se faltarem jogos ou a consulta falhar, completa com Roblox, Free Fire e Valorant, sem repetir. “Todos os jogos” permanece fixo. Os ícones e URLs vêm de uma lista local permitida.

Não é necessário liberar pedidos nas regras públicas do Firestore. A consulta é feita com o acesso privado já configurado no Worker. Para publicar alterações no backend, gerar `workers/mp-pix.js` com `node scripts/build-max-worker.cjs` e publicar no mesmo Worker, mantendo secrets e bindings.
