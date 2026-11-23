// JavaScript / cart-count.test.cjs / Node.js / quantidade, expiração e isolamento por conta.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {pendingOrders}=require('../js/cart-count.js');
test('conta pedidos pendentes e remove pagos, cancelados, estornos e Pix vencidos',()=>{
  const now=1000,rows=[{id:1,status:'aguardando_pagamento',quantity:20},{id:2,status:'aguardando_pagamento',paymentExpiresAtMs:1100},{id:3,status:'aguardando_pagamento',paymentExpiresAtMs:1000},{id:4,status:'pago'},{id:5,status:'cancelado'},{id:6,status:'reembolsado'},{id:7,status:'aguardando_pagamento',paymentVerified:true}];
  assert.deepEqual(pendingOrders(rows,now).map(x=>x.id),[1,2]);
});
function fixture(){
  const badge={hidden:true,textContent:''},link={setAttribute(k,v){this[k]=v;}},subscriptions=[],events={},timers=[];let authChange;
  const auth={currentUser:null,onAuthStateChanged(fn){authChange=fn;}},document={hidden:false,getElementById:id=>id==='headerCart'?link:badge,addEventListener:(event,fn)=>events[event]=fn};
  const root={document,firebase:{auth:()=>auth,firestore:()=>({collection(name){assert.equal(name,'orders');const filters=[];return {where(...filter){filters.push(filter);return this;},onSnapshot(success,error){const item={filters,success,error,unsubscribed:false};subscriptions.push(item);return ()=>item.unsubscribed=true;}};}})},setTimeout(fn,delay){timers.push({fn,delay});return timers.length;},clearTimeout(){},addEventListener:(event,fn)=>events[event]=fn};
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/cart-count.js'),'utf8'),{window:root,Date});
  return {badge,link,subscriptions,events,timers,login(uid){auth.currentUser=uid?{uid}:null;authChange(auth.currentUser);}};
}
const snap=rows=>({forEach:fn=>rows.forEach(row=>fn({data:()=>row}))});
test('contador acompanha alterações e não reutiliza dados de outra conta após trocar login',()=>{
  const f=fixture();f.login('alice');const first=f.subscriptions[0];
  assert.deepEqual(first.filters.map(x=>Array.from(x)),[['buyerUid','==','alice'],['status','==','aguardando_pagamento']]);
  first.success(snap([{status:'aguardando_pagamento'},{status:'aguardando_pagamento'}]));assert.equal(f.badge.textContent,'2');assert.equal(f.badge.hidden,false);
  first.success(snap([]));assert.equal(f.badge.hidden,true);
  f.login('bob');assert.equal(first.unsubscribed,true);first.success(snap([{status:'aguardando_pagamento'}]));assert.equal(f.badge.hidden,true);
  f.subscriptions[1].success(snap(Array.from({length:101},()=>({status:'aguardando_pagamento'}))));assert.equal(f.badge.textContent,'99+');assert.match(f.link['aria-label'],/101 pedidos/);
  f.login(null);assert.equal(f.badge.hidden,true);assert.equal(f.subscriptions[1].unsubscribed,true);
});
test('programa remoção na expiração, limpa erro e refaz inscrição ao voltar do cache',()=>{
  const f=fixture();f.login('alice');f.subscriptions[0].success(snap([{status:'aguardando_pagamento',paymentExpiresAtMs:Date.now()+2000}]));
  assert.ok(f.timers[0].delay>0&&f.timers[0].delay<=2100);
  f.subscriptions[0].error(Error('offline'));assert.equal(f.badge.hidden,true);
  f.events.pagehide();f.events.pageshow({persisted:true});assert.equal(f.subscriptions.length,2);
});
