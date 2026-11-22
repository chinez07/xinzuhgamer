// JavaScript / market-security.test.mjs / Node.js / invariantes financeiras sem pagamentos reais.
import test from 'node:test';
import assert from 'node:assert/strict';
import {marketQuote,marketWalletState,marketCheckPayment,marketSettle,marketWithdraw,marketChangeStatus,marketReview,marketMessage,marketHandle} from '../workers/market-core.mjs';
import {firestoreValue,firestoreDecode} from '../workers/firestore-service.mjs';
const buyer={uid:'buyer',name:'Comprador',email:'buyer@example.test'},seller={uid:'seller',name:'Vendedor',email:'seller@example.test'};
const ad={sellerUid:'seller',sellerName:'Vendedor',status:'ativo',price:20,stock:5,visibility:'prata',title:'Item'};
const order={secureVersion:1,code:'BZTEST',adId:'ADTEST',buyerUid:'buyer',sellerUid:'seller',total:20,price:20,quantity:1,feePercent:9.99,itemIndex:null,status:'aguardando_pagamento',mpPaymentId:'123'};
const payment={id:123,external_reference:'BZTEST',metadata:{bloxzuh_order:'BZTEST',buyer_uid:'buyer'},transaction_amount:20,currency_id:'BRL',payment_method_id:'pix',status:'approved',live_mode:true,date_approved:new Date().toISOString()};
function memory(initial={}) {
  const rows=new Map(Object.entries(initial).map(([key,value])=>[key,{data:structuredClone(value),version:1}]));
  return {rows,async get(path){const entry=rows.get(path);return {path,data:entry?structuredClone(entry.data):null,version:entry?.version||null};},async commit(changes){
    for(const {doc} of changes) if((rows.get(doc.path)?.version||null)!==doc.version) {const error=Error('conflict');error.conflict=true;throw error;}
    for(const {doc,patch} of changes) {const previous=rows.get(doc.path);rows.set(doc.path,{data:{...previous?.data,...structuredClone(patch)},version:(previous?.version||0)+1});}
  }};
}
function dbWithOrder(){return memory({'ads/ADTEST':ad,'orders/BZTEST':order,'marketOrderProofs/BZTEST':Object.fromEntries(['code','adId','buyerUid','sellerUid','total','price','quantity','feePercent','itemIndex'].map(key=>[key,order[key]]))});}
test('Preço, taxa, vendedor e estoque vêm do anúncio; entrada manipulada é ignorada',()=>{
  const quote=marketQuote(ad,{price:.01,total:.01,feePercent:0,sellerUid:'buyer',quantity:2},buyer);
  assert.equal(quote.total,40);assert.equal(quote.feePercent,9.99);
  assert.throws(()=>marketQuote(ad,{quantity:-1},buyer));assert.throws(()=>marketQuote(ad,{quantity:6},buyer));assert.throws(()=>marketQuote(ad,{},seller));
});
test('Anúncio dinâmico exige item e usa preço e estoque próprios',()=>{
  const dynamic={...ad,model:'dinamico',items:[{name:'A',price:9,stock:1},{name:'B',price:25,stock:0}]};
  assert.throws(()=>marketQuote(dynamic,{},buyer));assert.throws(()=>marketQuote(dynamic,{itemIndex:1},buyer));
  assert.equal(marketQuote(dynamic,{itemIndex:0,price:.01},buyer).price,9);
});
test('Pagamento falso, de teste, de outro comprador ou de valor menor não libera pedido',()=>{
  for(const patch of [{transaction_amount:.01},{currency_id:'USD'},{live_mode:false},{external_reference:'OTHER'},{metadata:{bloxzuh_order:'BZTEST',buyer_uid:'intruder'}},{id:999}]) assert.throws(()=>marketCheckPayment({...payment,...patch},order,'123'));
});
test('Pedidos forjados antes da migração não possuem comprovante privado e não geram reputação',async()=>{
  const db=memory({'orders/BZTEST':{...order,status:'concluido',paymentVerified:true},'ads/ADTEST':ad});
  await assert.rejects(marketReview(db,buyer,{orderId:'BZTEST',stars:5}),/registro financeiro/);
  await assert.rejects(marketSettle(db,payment,'BZTEST'),/registro financeiro/);
  assert.equal((await db.get('financialWallets/seller')).data,null);
});
test('Confirmações repetidas e concorrentes creditam e baixam estoque uma única vez',async()=>{
  const db=dbWithOrder();
  await Promise.all([marketSettle(db,payment,'BZTEST'),marketSettle(db,payment,'BZTEST')]);
  await marketSettle(db,payment,'BZTEST');
  const wallet=(await db.get('financialWallets/seller')).data;
  assert.equal(wallet.securePendingItems.length,1);assert.equal(wallet.securePendingItems[0].cents,1800);
  assert.equal((await db.get('ads/ADTEST')).data.stock,4);
  assert.equal((await db.get('orders/BZTEST')).data.paymentVerified,true);
});
test('Status pendente não cria saldo nem libera chat',async()=>{
  const db=dbWithOrder();assert.equal((await marketSettle(db,{...payment,status:'pending'},'BZTEST')).approved,false);
  assert.equal((await db.get('financialWallets/seller')).data,null);
  await assert.rejects(marketMessage(db,buyer,{orderId:'BZTEST',text:'mensagem'}));
});
test('Saldo antigo gravável pelo cliente não vira saldo comprovado',()=>{
  const state=marketWalletState({saldo:999999,pending:999999,pendingItems:[{amount:50000,releaseAtMs:1}]});
  assert.equal(state.available,0);assert.equal(state.pending,0);
});
test('Liberação usa dez dias do servidor e não duplica ao consultar novamente',()=>{
  const now=Date.now(),data={secureVersion:1,secureSaldoCents:100,securePendingItems:[{cents:1800,releaseAtMs:now+10000,released:false,deliveryConfirmed:true}]};
  assert.equal(marketWalletState(data,now).available,100);
  const state=marketWalletState(data,now+10001);assert.equal(state.available,1900);
  assert.equal(marketWalletState({...data,secureSaldoCents:state.available,securePendingItems:state.items},now+20000).available,1900);
});
test('Saques concorrentes não gastam o mesmo saldo; valor e taxa são imutáveis no cliente',async()=>{
  const db=memory({'financialWallets/seller':{secureVersion:1,secureSaldoCents:1000,securePendingItems:[]}});
  const input={amount:8,pixKey:'teste@example.test',cpf:'52998224725',mode:'turbo',fee:0};
  const results=await Promise.allSettled([marketWithdraw(db,seller,input),marketWithdraw(db,seller,input)]);
  assert.equal(results.filter(item=>item.status==='fulfilled').length,1);
  assert.equal((await db.get('financialWallets/seller')).data.secureSaldoCents,0);
  const withdrawal=[...db.rows].find(([key])=>key.startsWith('secureWithdrawals/'))[1].data;
  assert.equal(withdrawal.fee,2);assert.equal(withdrawal.status,'processando');
});
test('Saldo em análise ou não comprovado não permite saque',async()=>{
  for(const wallet of [{saldo:500},{secureVersion:1,secureSaldoCents:50000,securityHold:true}]) {
    const db=memory({'financialWallets/seller':wallet});await assert.rejects(marketWithdraw(db,seller,{amount:1,pixKey:'pix',cpf:'52998224725'}));
    assert.equal([...db.rows.keys()].filter(key=>key.startsWith('secureWithdrawals/')).length,0);
  }
});
test('Comprador e vendedor não conseguem aprovar Pix ou concluir pedido não pago',async()=>{
  const db=dbWithOrder();
  for(const user of [buyer,seller,{uid:'intruder'}]) for(const status of ['pago','concluido','aprovado']) await assert.rejects(marketChangeStatus(db,user,'BZTEST',status));
  assert.equal((await db.get('orders/BZTEST')).data.status,'aguardando_pagamento');
});
test('Só vendedor inicia entrega e só comprador confirma conclusão após Pix real',async()=>{
  const db=dbWithOrder();await marketSettle(db,payment,'BZTEST');
  await assert.rejects(marketChangeStatus(db,buyer,'BZTEST','em_entrega'));
  await marketChangeStatus(db,seller,'BZTEST','em_entrega');
  await assert.rejects(marketChangeStatus(db,seller,'BZTEST','concluido'));
  await marketChangeStatus(db,buyer,'BZTEST','concluido');
  assert.equal((await db.get('orders/BZTEST')).data.status,'concluido');
});
test('Avaliação exige conclusão verificada e só pode ser criada uma vez por participante',async()=>{
  const db=dbWithOrder();await assert.rejects(marketReview(db,buyer,{orderId:'BZTEST',stars:5}));
  await marketSettle(db,payment,'BZTEST');await marketChangeStatus(db,buyer,'BZTEST','concluido');
  const input={orderId:'BZTEST',stars:5,comment:'Ótimo'};
  const result=await Promise.allSettled([marketReview(db,buyer,input),marketReview(db,buyer,input)]);
  assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
  assert.equal((await db.get('ads/ADTEST')).data.ratingCount,1);
});
test('Chat ignora remetente fornecido pelo cliente e bloqueia terceiros',async()=>{
  const db=dbWithOrder();await marketSettle(db,payment,'BZTEST');
  await assert.rejects(marketMessage(db,{uid:'intruder'},{orderId:'BZTEST',text:'x'}));
  await marketMessage(db,buyer,{orderId:'BZTEST',text:'Olá',senderUid:'seller'});
  const messages=[...db.rows].filter(([key])=>key.startsWith('orders/BZTEST/messages/'));assert.equal(messages.length,1);assert.equal(messages[0][1].data.senderUid,'buyer');
});
test('Estorno bloqueia saque mesmo que a carteira tenha saldo',async()=>{
  const db=dbWithOrder();await marketSettle(db,payment,'BZTEST');
  await marketSettle(db,{...payment,status:'refunded',transaction_amount_refunded:20},'BZTEST');
  assert.equal((await db.get('financialWallets/seller')).data.securityHold,true);
  assert.equal((await db.get('orders/BZTEST')).data.status,'reembolsado');
});
test('Rotas antigas não oferecem alternativa sem autenticação; origem externa é recusada',async()=>{
  let calls=0;
  const auth=async()=>{calls++;const error=Error('Sessão inválida');error.status=401;throw error;};
  for(const path of ['/create-pix','/status?paymentId=123','/old/create-pix','/payout']) {
    const response=await marketHandle(new Request('https://worker.test'+path),{},{auth});assert.equal(response.status,401);
  }
  assert.equal(calls,4);
  const response=await marketHandle(new Request('https://worker.test/create-pix',{headers:{Origin:'https://evil.test'}}),{},{auth});
  assert.equal(response.status,403);assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);
});
test('Codificação Firestore preserva campos financeiros, arrays, booleanos e nulos',()=>{
  const data={saldo:123.45,cents:12345,items:[{cents:800,released:false}],name:'Bloxzuh',value:null};
  assert.deepEqual(firestoreDecode(firestoreValue(data)),data);
  assert.throws(()=>firestoreValue({value:NaN}));
});
test('O endereço temporário exato é autorizado, sem permitir o domínio abandonado ou outros projetos Pages',async()=>{
  for (const origin of ['https://xinzuhgamer.pages.dev','https://bloxzuh.store','https://www.bloxzuh.store','https://other.pages.dev','https://xinzuhgamer.pages.dev.evil.test']) {
    const response=await marketHandle(new Request('https://worker.test/market/wallet',{method:'OPTIONS',headers:{Origin:origin}}),{});
    assert.equal(response.status,origin==='https://xinzuhgamer.pages.dev'?204:403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin==='https://xinzuhgamer.pages.dev'?origin:null);
  }
});
