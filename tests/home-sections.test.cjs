// JavaScript / home-sections.test.cjs / Node.js / recomendações reais e visibilidade.
const {test}=require('node:test'),assert=require('node:assert/strict');
const home=require('../js/home-sections.js');
const ad=(id,visibility,sales,status='ativo')=>({id,visibility,sales,status});
test('atalhos mostram top 3 sem repetir e completam com padrões; ignoram categorias desconhecidas',()=>{
  assert.deepEqual(home.shortcutSelection(['fortnite','fortnite','__proto__','roblox']).map(x=>x.id),['fortnite','roblox','freefire']);
  assert.deepEqual(home.shortcutSelection([]).map(x=>x.id),['roblox','freefire','valorant']);
  assert.deepEqual(home.shortcutSelection(null).map(x=>x.id),['roblox','freefire','valorant']);
});
test('populares incluem somente Ouro/Diamante ativos com vendas reais',()=>{
  const ads=[ad('prata','prata',100),ad('sem-vendas','diamante',0),ad('pausado','ouro',90,'pausado'),ad('ouro','ouro',3),ad('diamante','diamante',10)];
  assert.deepEqual(home.popular(ads).map(x=>x.id),['diamante','ouro']);
  assert.equal(ads[0].id,'prata');
});
test('favoritos dependem da escolha da pessoa e ocultam anúncios indisponíveis',()=>{
  const ads=[ad('salvo','prata',0),ad('nao-salvo','diamante',2),ad('reprovado','diamante',2,'reprovado')];
  assert.deepEqual(home.favorites(ads,['salvo','reprovado']).map(x=>x.id),['salvo']);
  assert.deepEqual(home.favorites(ads,[]),[]);
});
test('avaliações recentes não misturam avaliações do vendedor sobre compradores',()=>{
  const rows=[{type:'buyer',stars:5,createdAtMs:100},{type:'ad',stars:5,createdAtMs:2},{type:'seller',stars:3,createdAtMs:3},{type:'ad',stars:9,createdAtMs:4}];
  assert.deepEqual(home.publicReviews(rows).map(x=>x.createdAtMs),[3,2]);
});
