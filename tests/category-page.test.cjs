// JavaScript / category-page.test.cjs / Node.js / rotas, filtros e conteúdo das categorias.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const page=require('../js/category-page.js');
const defaults={cat:'roblox',q:'',product:'',experience:'',min:'',max:'',sort:'rel'};
test('links preservam filtros e textos em português ao compartilhar e recarregar',()=>{
  const params=new URLSearchParams(page.filterParams('?release=test&q=antigo',{...defaults,q:'Conta com raça V4',product:'Conta',experience:'Blox Fruits',min:'20.5',max:'200',sort:'price_asc'}));
  assert.equal(params.get('release'),'test');assert.equal(params.get('q'),'Conta com raça V4');assert.equal(params.get('produto'),'Conta');assert.equal(params.get('experiencia'),'Blox Fruits');assert.equal(params.get('min'),'20.5');assert.equal(params.get('ordem'),'price_asc');
});
test('trocar de categoria remove experiência incompatível e limpar remove filtros antigos',()=>{
  const params=new URLSearchParams(page.filterParams('?produto=Conta&experiencia=Blox+Fruits&q=antigo&min=10&max=20&ordem=sales',{...defaults,cat:'freefire'}));
  assert.deepEqual([...params.entries()],[['cat','freefire']]);
  assert.equal(page.filterParams('',{...defaults,min:'-2',max:'NaN',sort:'injetado'}),'cat=roblox');
});
test('categorias usam as imagens existentes e valores desconhecidos têm estado geral',()=>{
  assert.equal(page.info('roblox').name,'Roblox');assert.equal(page.info('premium').image,'assinaturas-vertical.png');assert.equal(page.info('unknown').name,'Todos os anúncios');
});
test('aspas nos dados do anúncio são escapadas antes de entrar em atributos HTML',()=>{
  const source=fs.readFileSync('anuncios.html','utf8'),start=source.indexOf('    function esc('),end=source.indexOf('    function createProductCard(',start),context=vm.createContext({});
  vm.runInContext(source.slice(start,end),context);
  assert.equal(context.esc('" onerror="alert(1)'), '&quot; onerror=&quot;alert(1)');
});
test('Robux não mantém filtro de experiência de outro jogo Roblox',()=>{
  const params=new URLSearchParams(page.filterParams('',{...defaults,product:'Robux',experience:'Blox Fruits'}));
  assert.equal(params.get('produto'),'Robux');assert.equal(params.has('experiencia'),false);
});
