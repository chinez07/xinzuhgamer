// JavaScript / cart.test.cjs / Node.js / estoque, persistência e isolamento da cesta.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const cart=require('../js/cart.js');
const ad={id:'AD1',title:'Produto',raw:{status:'ativo',sellerUid:'seller',price:9.9,stock:5,model:'normal'}};
test('dados locais não podem injetar preço, URL, quantidade inválida ou itens ilimitados',()=>{
  const rows=cart.normalize([{adId:'AD1',quantity:2,price:.01},{adId:'AD1',quantity:3},{adId:'../bad',quantity:1},{adId:'AD2',quantity:-1},{adId:'AD3',quantity:1,itemIndex:1.5}]);
  assert.deepEqual(rows,[{adId:'AD1',quantity:5,itemIndex:null}]);
  assert.equal(cart.normalize(Array.from({length:50},(_,i)=>({adId:'AD'+i,quantity:1}))).length,30);
  assert.equal(cart.quote(ad,rows[0]).totalCents,4950);
});
test('produtos normais e dinâmicos usam preço e estoque atuais e bloqueiam anúncio próprio ou pausado',()=>{
  assert.throws(()=>cart.quote(ad,{quantity:6,itemIndex:null}),/estoque/);
  assert.throws(()=>cart.quote(ad,{quantity:1,itemIndex:null},'seller'),/próprio/);
  assert.throws(()=>cart.quote({...ad,raw:{...ad.raw,status:'pendente'}},{quantity:1,itemIndex:null}),/indisponível/);
  const dynamic={...ad,raw:{...ad.raw,model:'dinamico',items:[{name:'Escolha A',price:2.5,stock:3}]}};
  assert.throws(()=>cart.quote(dynamic,{quantity:1,itemIndex:null}),/Escolha/);
  assert.equal(cart.quote(dynamic,{quantity:2,itemIndex:0}).totalCents,500);
  assert.throws(()=>cart.quote(dynamic,{quantity:4,itemIndex:0}),/estoque/);
  assert.equal(cart.checkoutURL({adId:'AD1',quantity:2,itemIndex:0}),'/checkout?adId=AD1&quantity=2&fromCart=1&item=0');
});
function fixture(){
  const values=new Map(),events={};let onAuth;
  const auth={onAuthStateChanged(fn){onAuth=fn;}},storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const root={document:{getElementById:()=>null,addEventListener(){}},localStorage:storage,firebase:{auth:()=>auth},addEventListener:(e,fn)=>events[e]=fn,dispatchEvent(){}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/cart.js'),'utf8'),{window:root,URLSearchParams,CustomEvent:class{},Intl});
  return {api:root.BloxzuhCart,values,storage,events,login:uid=>onAuth(uid?{uid}:null)};
}
test('adicionar, acumular, alterar e remover preservam estoque e persistem depois de recarregar',()=>{
  const f=fixture();f.api.add(ad,null,1);f.api.add(ad,null,2);assert.equal(f.api.entries()[0].quantity,3);
  assert.throws(()=>f.api.add(ad,null,3),/estoque/);assert.equal(f.api.entries()[0].quantity,3);
  f.api.setQuantity(f.api.entries()[0],2);assert.equal(f.api.entries()[0].quantity,2);
  f.api.consume('AD1',null,1);assert.equal(f.api.entries()[0].quantity,1);
  assert.equal(JSON.parse(f.values.get('zuhstore-cart-v1-guest'))[0].quantity,1);
  f.api.remove(f.api.entries()[0]);assert.equal(f.api.entries().length,0);
});
test('visitante transfere produtos no login; trocar de conta não mistura cestas',()=>{
  const f=fixture();f.api.add(ad,null,1);f.login('alice');assert.equal(f.api.entries().length,1);assert.equal(f.values.has('zuhstore-cart-v1-guest'),false);
  f.login('bob');assert.equal(f.api.entries().length,0);f.api.add({...ad,id:'AD2'},null,1);
  f.login('alice');assert.equal(f.api.entries()[0].adId,'AD1');f.login(null);assert.equal(f.api.entries().length,0);
});
test('falha no armazenamento não mostra produto como salvo e atualização em outra aba é aplicada',()=>{
  const f=fixture();f.storage.setItem=()=>{throw Error('storage unavailable');};assert.throws(()=>f.api.add(ad,null,1));assert.equal(f.api.entries().length,0);
  f.values.set('zuhstore-cart-v1-guest',JSON.stringify([{adId:'AD2',quantity:2}]));f.events.storage({key:'zuhstore-cart-v1-guest'});assert.equal(f.api.entries()[0].quantity,2);
});
