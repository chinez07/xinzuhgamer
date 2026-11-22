// JavaScript / ad-catalog.js / navegador e Node.js / jogos, experiências e produtos.
(function (root) {
  'use strict';
  var games = {
    'Roblox': {id:'roblox', sections:['Roblox geral','Blox Fruits','Grow a Garden','Brookhaven','Adopt Me','Pet Simulator','Murder Mystery 2','Blade Ball','Outros jogos'], products:['Conta','Robux','Item','Serviço','Outros']},
    'Free Fire': {id:'freefire', sections:[], products:['Conta','Diamantes','Item','Serviço','Outros']},
    'Valorant': {id:'valorant', sections:[], products:['Conta','Valorant Points','Item','Serviço','Outros']},
    'League of Legends': {id:'lol', sections:[], products:['Conta','Riot Points','Item','Serviço','Outros']},
    'Fortnite': {id:'fortnite', sections:[], products:['Conta','V-Bucks','Item','Serviço','Outros']},
    'CS2': {id:'cs2', sections:[], products:['Conta','Skin','Item','Serviço','Outros']},
    'Genshin Impact': {id:'genshin', sections:[], products:['Conta','Cristais Gênesis','Item','Serviço','Outros']},
    'Outros jogos': {id:'outros', sections:[], products:['Conta','Moedas','Item','Serviço','Outros']},
    'Assinatura': {id:'premium', sections:[], products:['Assinatura','Gift card','Outros']}
  };
  function get(game) {return games[game] || games['Outros jogos'];}
  function validate(data) {
    if(data.category && !['Jogos','Assinaturas'].includes(data.category)) return 'Selecione Jogos ou Assinaturas.';
    if(data.category && (data.category==='Assinaturas') !== (data.subcategory==='Assinatura')) return 'O tipo de categoria não corresponde ao produto selecionado.';
    if (!games[data.subcategory]) return 'Selecione um jogo da lista ou Outros jogos.';
    if (data.subcategory === 'Outros jogos' && !String(data.gameName || '').trim()) return 'Informe o nome do jogo.';
    if (!get(data.subcategory).products.includes(data.productType)) return 'Escolha um tipo de produto válido para o jogo.';
    if (data.subcategory === 'Roblox' && data.productType === 'Robux' && data.section !== 'Roblox geral') return 'Robux pertence a Roblox geral. Não selecione Blox Fruits ou outra experiência para vender Robux.';
    if (data.subcategory === 'Roblox' && !String(data.section || '').trim()) return 'Escolha a experiência do Roblox ou Outros jogos.';
    if (data.subcategory === 'Roblox' && data.section === 'Outros jogos' && !String(data.experienceName || '').trim()) return 'Informe o nome da experiência do Roblox.';
    return '';
  }
  function reviewText(data) {
    var invalid=validate(data);
    if(invalid)return {decision:'rejected',reason:invalid};
    var title=String(data.title||'').trim(),desc=String(data.desc||'').trim();
    if(title.length>80||desc.length>8000)return {decision:'rejected',reason:'Use até 80 caracteres no título e 8.000 na descrição.'};
    if(title.length<5||desc.length<10)return {decision:'rejected',reason:'Informe um título e uma descrição que expliquem o produto anunciado.'};
    if(root.BloxzuhContentPolicy && (root.BloxzuhContentPolicy.hasContact(title)||root.BloxzuhContentPolicy.hasContact(desc)))return {decision:'rejected',reason:'Remova telefones e contatos externos do título e da descrição.'};
    var currencyOffer=/^(?:vendo?\s+|venda\s+de\s+|comprar\s+)?(?:\d+[.,\d]*\s*)?robux\b/i.test(title);
    if(data.subcategory==='Roblox' && currencyOffer && (data.productType!=='Robux'||data.section!=='Roblox geral'))return {decision:'rejected',reason:'O título oferece Robux. Selecione produto Robux e Roblox geral.'};
    var aliases={'Free Fire':/\bfree\s*fire\b/i,'Valorant':/\bvalorant\b/i,'League of Legends':/\bleague of legends\b/i,'Fortnite':/\bfortnite\b/i,'CS2':/\bcs2\b/i,'Genshin Impact':/\bgenshin(?: impact)?\b/i,'Roblox':/\broblox\b/i};
    var game=data.subcategory;
    if(aliases[game])for(var other in aliases){if(other!==game && aliases[other].test(title) && !aliases[game].test(title) && !/^\s*(?:não|nao)\b/i.test(title))return {decision:'rejected',reason:'O título indica '+other+', mas a categoria selecionada é '+game+'. Corrija a categoria ou o anúncio.'};}
    if(desc.length<25 || /^(?:produto (?:bom|top)|teste|vendo conta|chama|mais informa[çc][õo]es|descri[çc][ãa]o)[.!\s]*$/i.test(desc))return {decision:'review',reason:'A descrição está vaga. Explique o que está incluído e como será entregue.'};
    return {decision:'approved',reason:'Verificações básicas do texto concluídas; a compatibilidade detalhada ainda depende da análise e revisão.'};
  }
  root.BloxzuhAdCatalog = {games:games, get:get, validate:validate,reviewText:reviewText};
  if (typeof module === 'object' && module.exports) module.exports = root.BloxzuhAdCatalog;
})(typeof window !== 'undefined' ? window : globalThis);
