// JavaScript / market-core.mjs / Cloudflare Workers / pedidos e carteira com autoridade no servidor.
import {firestoreService} from './firestore-service.mjs';
import {maxUser, maxValidCPF} from './max-core.mjs';
import {homeTrends,trendCategory} from './home-trends.mjs';
const MARKET_RELEASE = 10*86400000;
let marketRateReady;
function marketError(text,status=400) {const error=Error(text); error.status=status; throw error;}
function marketId(value) {if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(value||''))) marketError('Identificador inválido.'); return String(value);}
export function marketCents(value) {const number=Number(value); if(!Number.isFinite(number)||number<0.01||number>100000) marketError('Valor inválido.'); return Math.round(number*100);}
function marketParty(order,user) {if (!order || ![order.buyerUid,order.sellerUid].includes(user.uid)) marketError('Sem permissão para este pedido.',403);}
async function marketSecure(db,order) {
  if(order?.secureVersion!==1) marketError('Este pedido antigo precisa de conferência administrativa.',409);
  const proof=await db.get('marketOrderProofs/'+marketId(order.code));
  if(!proof.data) marketError('Este pedido não tem registro financeiro comprovado.',409);
  for(const field of ['code','adId','buyerUid','sellerUid','total','price','quantity','feePercent','itemIndex']) if(proof.data[field]!==order[field]) marketError('Pedido divergente do registro financeiro.',409);
  if(!!order.paymentVerified!==!!proof.data.paymentVerified) marketError('Pagamento divergente do registro financeiro.',409);
  return proof;
}
export function marketQuote(ad, input, user) {
  if (!ad || ad.status!=='ativo' || !ad.sellerUid) marketError('Anúncio indisponível.',409);
  if(ad.sellerUid===user.uid) marketError('Você não pode comprar o próprio anúncio.');
  const quantity = input.quantity == null ? 1 : Number(input.quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>100) marketError('Quantidade inválida.');
  let item=null,index=null;
  if(String(ad.model).toLowerCase()==='dinamico') {
    index=Number(input.itemIndex);
    if(input.itemIndex==null||!Number.isInteger(index)||index<0||!ad.items?.[index]) marketError('Escolha um item válido.');
    item=ad.items[index];
  }
  const stock=Number(item ? item.stock : ad.stock);
  if(!Number.isInteger(stock)||stock<quantity) marketError('Estoque insuficiente.',409);
  const cents=marketCents(item ? item.price : ad.price);
  if(cents*quantity>10000000) marketError('Pedido acima do limite.');
  const fees={prata:9.99,ouro:11.99,diamante:12.99};
  const feePercent=fees[String(ad.visibility||'prata').toLowerCase()] || fees.prata;
  return {price:cents/100,quantity,total:cents*quantity/100,feePercent,itemIndex:index,itemName:item ? String(item.name||item.title||'Item').slice(0,120) : ''};
}
async function marketAtomic(db, work) {
  for(let attempt=0;attempt<5;attempt++) {try {return await work();} catch(error) {if(!error.conflict||attempt===4) throw error;}}
}
async function marketRate(env,key,limit) {
  if(!env.MAX_DB) marketError('Proteção contra abuso indisponível.',503);
  if(!marketRateReady) marketRateReady=env.MAX_DB.exec('CREATE TABLE IF NOT EXISTS market_rate (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL)').catch(error=>{marketRateReady=null;throw error;});
  await marketRateReady;
  const bucket=Math.floor(Date.now()/60000);
  const row=await env.MAX_DB.prepare('INSERT INTO market_rate(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count').bind(key,bucket).first();
  if(row.count>limit) marketError('Muitas tentativas. Aguarde um minuto.',429);
}
export function marketWalletState(data,now=Date.now()) {
  const wallet=data||{};
  let available=wallet.secureVersion===1 ? Number(wallet.secureSaldoCents)||0 : 0;
  let pending=0;
  const items=(wallet.securePendingItems||[]).map(item=>{
    if(!Number.isSafeInteger(item.cents)||item.cents<0) marketError('Carteira exige conferência.',409);
    if(!item.released&&item.deliveryConfirmed===true&&item.releaseAtMs<=now) {available+=item.cents; return {...item,released:true};}
    if(!item.released) pending+=item.cents;
    return item;
  });
  if(!Number.isSafeInteger(available)||available<0) marketError('Carteira exige conferência.',409);
  return {available,pending,items,withdrawn:Number(wallet.secureWithdrawnCents)||0,blocked:!!wallet.securityHold||!!wallet.supportHoldTickets?.length};
}
function marketWalletPatch(state) {return {secureVersion:1,secureSaldoCents:state.available,securePendingItems:state.items,secureWithdrawnCents:state.withdrawn,updatedAtMs:Date.now()};}
function marketNotification(uid,order,title,body) {
  return {doc:{path:'notifications/NT'+crypto.randomUUID().replace(/-/g,''),version:null},patch:{userId:uid,type:'venda',title,body:String(body||'').slice(0,120),link:'pedido.html?id='+encodeURIComponent(order.code),read:false,createdAtMs:Date.now()}};
}
async function marketWallet(db,uid) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('financialWallets/'+uid),state=await marketDeliveryWallet(db,doc.data);
    const legacy=await db.get('wallets/'+uid);
    await db.commit([{doc,patch:marketWalletPatch(state)}]);
    return {saldo:state.available/100,pending:state.pending/100,withdrawn:state.withdrawn/100,pendingItems:state.items.map(item=>({...item,amount:item.cents/100})),securityHold:state.blocked,legacyBalanceReview:!!(legacy.data?.saldo||legacy.data?.pending)};
  });
}
export function marketCheckPayment(payment,order,id) {
  if(String(payment.id)!==String(id)||String(order.mpPaymentId)!==String(id)||payment.external_reference!==order.code||payment.metadata?.bloxzuh_order!==order.code||payment.metadata?.buyer_uid!==order.buyerUid||marketCents(payment.transaction_amount)!==marketCents(order.total)||payment.currency_id!=='BRL'||payment.payment_method_id!=='pix') marketError('O pagamento não corresponde ao pedido.',409);
  if(payment.status==='approved'&&payment.live_mode!==true) marketError('Pagamento de teste não libera uma compra real.',409);
  if(Number(payment.transaction_amount_refunded)>0||['refunded','charged_back'].includes(payment.status)) return 'refunded';
  return payment.status;
}
async function marketMP(env,fetcher,id) {
  const response=await fetcher('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(marketId(id)),{headers:{Authorization:'Bearer '+env.MP_ACCESS_TOKEN}});
  if(!response.ok) marketError('Não foi possível consultar o Pix.',502);
  return response.json();
}
export async function marketSettle(db,payment,orderId) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(orderId)),order=doc.data;
    if(!order) marketError('Pedido não encontrado.',404);
    const proof=await marketSecure(db,order);
    const status=marketCheckPayment(payment,order,payment.id);
    if(status==='refunded') {
      const wallet=await db.get('financialWallets/'+marketId(order.sellerUid));
      await db.commit([{doc,patch:{status:'reembolsado',paymentVerified:false,updatedAtMs:Date.now()}},{doc:proof,patch:{paymentVerified:false}},{doc:wallet,patch:{securityHold:true,securityHoldReason:'Pagamento estornado: '+order.code}}]);
      return {status:'refunded',approved:false};
    }
    if(status!=='approved') return {status,approved:false};
    if(order.paymentVerified) return {status:'approved',approved:true};
    if(order.sellerWalletApplied) marketError('Pagamento em conferência administrativa.',409);
    const paidAt=Date.parse(payment.date_approved||'');
    if(!Number.isFinite(paidAt)||paidAt<=0||paidAt>Date.now()+300000) marketError('Data de pagamento inválida.',409);
    const wallet=await db.get('financialWallets/'+marketId(order.sellerUid));
    const state=marketWalletState(wallet.data);
    if(state.items.length>=400) marketError('Carteira exige consolidação administrativa.',409);
    const cents=Math.round(marketCents(order.total)*(1-order.feePercent/100));
    state.items.push({orderId:order.code,code:order.code,cents,releaseAtMs:paidAt+MARKET_RELEASE,released:false,deliveryConfirmed:false});
    const adDoc=await db.get('ads/'+marketId(order.adId)),ad=adDoc.data;
    const changes=[{doc:wallet,patch:marketWalletPatch(state)}];
    let stockIssue=false;
    if(ad) {
      const qty=order.quantity,patch={sold:(Number(ad.sold)||0)+qty,updatedAtMs:Date.now()};
      if(order.itemIndex!=null&&ad.items?.[order.itemIndex]) {
        const items=ad.items.map(item=>({...item}));
        stockIssue=Number(items[order.itemIndex].stock)<qty;
        items[order.itemIndex].stock=Math.max(0,(Number(items[order.itemIndex].stock)||0)-qty);
        patch.items=items; patch.stock=items.reduce((sum,item)=>sum+Math.max(0,Number(item.stock)||0),0);
      } else {stockIssue=Number(ad.stock)<qty; patch.stock=Math.max(0,(Number(ad.stock)||0)-qty);}
      if(!patch.stock) patch.status='pausado';
      changes.push({doc:adDoc,patch});
    } else stockIssue=true;
    if(stockIssue) changes[0].patch={...changes[0].patch,securityHold:true,securityHoldReason:'Estoque em conferência: '+order.code};
    changes.push({doc,patch:{status:'pago',paymentVerified:true,paidAtMs:paidAt,stockApplied:true,stockNeedsReview:stockIssue,sellerWalletApplied:true,sellerNet:cents/100,updatedAtMs:Date.now()}});
    changes.push({doc:proof,patch:{paymentVerified:true}});
    changes.push(marketNotification(order.sellerUid,order,'Pagamento confirmado',order.adTitle));
    await db.commit(changes);
    return {status:'approved',approved:true};
  });
}
export async function marketWithdraw(db,user,input) {
  const amount=marketCents(input.amount);
  if(amount<100) marketError('Valor mínimo de saque: R$ 1.');
  const mode=input.mode==='turbo'?'turbo':'normal',fee=mode==='turbo'?200:0;
  const pixKey=String(input.pixKey||'').trim(),cpf=String(input.cpf||'').replace(/\D/g,'');
  if(!pixKey||pixKey.length>200||!maxValidCPF(cpf)) marketError('Confira a chave Pix e o CPF.');
  const withdrawalId='WD'+crypto.randomUUID().replace(/-/g,'').toUpperCase();
  return marketAtomic(db,async()=>{
    const wallet=await db.get('financialWallets/'+user.uid),state=await marketDeliveryWallet(db,wallet.data);
    if(state.blocked) marketError('Saque em análise administrativa.',409);
    if(amount+fee>state.available) marketError('Saldo disponível insuficiente.',409);
    state.available-=amount+fee; state.withdrawn+=amount;
    const withdrawal=await db.get('secureWithdrawals/'+withdrawalId),now=Date.now();
    const availableAtMs=now+(mode==='turbo'?1800000:3*86400000);
    await db.commit([{doc:wallet,patch:marketWalletPatch(state)},{doc:withdrawal,patch:{secureVersion:1,userId:user.uid,userName:user.name,userEmail:user.email,holderName:String(input.holderName||user.name).slice(0,120),holderCpf:cpf,pixKey,pixType:String(input.pixType||'cpf').slice(0,30),amount:amount/100,fee:fee/100,mode,status:'processando',availableAtMs,createdAtMs:now}}]);
    return {id:withdrawalId,availableAtMs,mode,fee:fee/100};
  });
}
export async function marketChangeStatus(db,user,id,next) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(id)),order=doc.data;
    marketParty(order,user); await marketSecure(db,order);
    if(next===order.status) return {ok:true};
    const seller=order.sellerUid===user.uid,buyer=order.buyerUid===user.uid;
    const allowed=(next==='cancelado'&&buyer&&order.status==='aguardando_pagamento'&&!order.mpPaymentId)||(next==='em_entrega'&&seller&&order.status==='pago'&&order.paymentVerified)||(next==='concluido'&&buyer&&['pago','em_entrega'].includes(order.status)&&order.paymentVerified);
    if(!allowed) marketError('Esta alteração de pedido não é permitida.',409);
    const changes=[{doc,patch:{status:next,updatedAtMs:Date.now(),...(next==='concluido'?{completedAtMs:Date.now(),saleCounted:true}:{})}},marketNotification(buyer?order.sellerUid:order.buyerUid,order,'Pedido atualizado',next)];
    if(next==='concluido') {if(order.supportOpenId)marketError('Há uma solicitação de ajuda aberta. Aguarde a análise antes de confirmar.',409);const wallet=await db.get('financialWallets/'+order.sellerUid);if(wallet.data)changes.push({doc:wallet,patch:{securePendingItems:(wallet.data.securePendingItems||[]).map(item=>(item.orderId||item.code)===order.code?{...item,deliveryConfirmed:true}:item)}});const ad=await db.get('ads/'+marketId(order.adId)); if(ad.data) changes.push({doc:ad,patch:{sales:(Number(ad.data.sales)||0)+order.quantity,updatedAtMs:Date.now()}});}
    await db.commit(changes);
    return {ok:true};
  });
}
async function marketCreate(db,user,input) {
  const doc=await db.get('ads/'+marketId(input.adId));
  const quote=marketQuote(doc.data,input,user),code='BZ'+crypto.randomUUID().replace(/-/g,'').toUpperCase();
  const order=await db.get('orders/'+code),now=Date.now(),ad=doc.data;
  const payload={secureVersion:1,code,adId:input.adId,adTitle:String(ad.title||'').slice(0,200)+(quote.itemName?' — '+quote.itemName:''),adCover:String(ad.cover||''),sellerUid:ad.sellerUid,sellerName:String(ad.sellerName||'Vendedor'),buyerUid:user.uid,buyerName:user.name,buyerEmail:user.email,category:String(ad.category||''),...quote,status:'aguardando_pagamento',createdAtMs:now,updatedAtMs:now};
  payload.discoveryCategory=trendCategory(ad);
  const proof={path:'marketOrderProofs/'+code,version:null};
  const immutable=Object.fromEntries(['code','adId','buyerUid','sellerUid','total','price','quantity','feePercent','itemIndex'].map(field=>[field,payload[field]]));
  await db.commit([{doc:order,patch:payload},{doc:proof,patch:{...immutable,paymentVerified:false}},marketNotification(ad.sellerUid,payload,'Novo pedido',payload.adTitle)]); return {id:code,...payload};
}
export async function marketMessage(db,user,input,read=false) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(input.orderId)),order=doc.data;
    marketParty(order,user);await marketSecure(db,order);
    if(!order.paymentVerified||!['pago','em_entrega','concluido'].includes(order.status))marketError('O chat é liberado após a confirmação real do pagamento.',409);
    const buyer=user.uid===order.buyerUid,key=buyer?'buyerReadAtMs':'sellerReadAtMs',incoming=buyer?'buyerLastIncomingAtMs':'sellerLastIncomingAtMs';
    const legacy=Array.isArray(order.messages)?order.messages:[];
    if(read){
      const limit=Math.min(Date.now(),Number(input.upToMs)||Number(order[incoming])||Date.now());
      const unread=legacy.filter(item=>item.senderUid!==user.uid&&!item.read&&Number(item.createdAtMs||0)<=limit);
      const nextRead=Math.min(limit,Number(order[incoming])||0);
      if(!unread.length&&nextRead<=Number(order[key]||0))return {ok:true,unchanged:true};
      const patch={[key]:Math.max(nextRead,Number(order[key]||0))};
      if(unread.length)patch.messages=legacy.map(item=>unread.includes(item)?{...item,read:true,readAtMs:Date.now()}:item);
      await db.commit([{doc,patch}]);return {ok:true};
    }
    const text=String(input.text||'').trim(),image=marketChatImage(input.image);
    if((!text&&!image)||text.length>2000)marketError('Envie uma mensagem de até 2000 caracteres ou uma imagem.');
    const requestId=input.requestId||crypto.randomUUID();if(!/^[A-Za-z0-9_-]{12,80}$/.test(requestId))marketError('Identificador da mensagem inválido.');
    const message=await db.get('orders/'+order.code+'/messages/M'+requestId);
    if(message.data){if(message.data.senderUid!==user.uid||message.data.text!==text||message.data.image!==image)marketError('Reenvio divergente.',409);return {ok:true,id:message.path.split('/').at(-1)};}
    const now=Date.now(),recipient=buyer?'sellerLastIncomingAtMs':'buyerLastIncomingAtMs';
    await db.commit([{doc:message,patch:{senderUid:user.uid,senderName:user.name,text,image,createdAtMs:now}},
      {doc,patch:{[recipient]:now,lastMessageAtMs:now,lastMessageSenderUid:user.uid,messageCount:(Number(order.messageCount)||0)+1,updatedAtMs:now}},
      marketNotification(buyer?order.sellerUid:order.buyerUid,order,'Nova mensagem',image&&!text?'Imagem enviada no chat':text)]);
    return {ok:true,id:message.path.split('/').at(-1)};
  });
}
export async function marketReview(db,user,input) {
  const stars=Number(input.stars),comment=String(input.comment||'').trim();
  if(!Number.isInteger(stars)||stars<1||stars>5||comment.length>500) marketError('Avaliação inválida.');
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(input.orderId)),order=doc.data;
    marketParty(order,user); await marketSecure(db,order);
    if(!order.paymentVerified||order.status!=='concluido') marketError('Aguarde a conclusão da compra para avaliar.',409);
    const buyer=order.buyerUid===user.uid,flag=buyer?'reviewed':'buyerReviewed';
    if(order[flag]) marketError('Este pedido já foi avaliado.',409);
    const review=await db.get('reviews/'+(buyer?'RV':'RB')+order.code),now=Date.now();
    if(review.data) marketError('Este pedido já foi avaliado.',409);
    const payload={type:buyer?'ad':'buyer',orderId:order.code,adId:order.adId,adTitle:order.adTitle,itemName:order.itemName||'',sellerUid:order.sellerUid,buyerUid:order.buyerUid,buyerName:order.buyerName,fromUid:user.uid,fromName:user.name,toUid:buyer?order.sellerUid:order.buyerUid,stars,comment,createdAtMs:now};
    const patch=buyer?{reviewed:true,reviewStars:stars,reviewComment:comment}:{buyerReviewed:true,buyerReviewStars:stars,buyerReviewComment:comment};
    const changes=[{doc:review,patch:payload},{doc,patch:{...patch,updatedAtMs:now}},marketNotification(payload.toUid,order,'Nova avaliação',stars+' estrelas')];
    if(buyer) {
      const ad=await db.get('ads/'+marketId(order.adId));
      if(ad.data) {const count=(Number(ad.data.secureRatingCount)||0)+1,sum=(Number(ad.data.secureRatingSum)||0)+stars; changes.push({doc:ad,patch:{secureRatingCount:count,secureRatingSum:sum,rating:Math.round(sum/count*10)/10,ratingCount:count}});}
    }
    await db.commit(changes); return {id:review.path.split('/')[1]};
  });
}
async function marketCreatePix(db,env,user,input,request,fetcher) {
  const id=marketId(input.orderId),doc=await db.get('orders/'+id),order=doc.data;
  marketParty(order,user); await marketSecure(db,order);
  if(order.buyerUid!==user.uid) marketError('Só o comprador pode gerar o Pix.',403);
  if(order.mpPaymentId) {const payment=await marketMP(env,fetcher,order.mpPaymentId); marketCheckPayment(payment,order,payment.id); return marketPixResponse(payment);}
  if(order.status!=='aguardando_pagamento') marketError('Pedido não está aguardando pagamento.',409);
  const cpf=String(input.cpf||order.payerCpf||'').replace(/\D/g,'');
  if(!maxValidCPF(cpf)||!user.email) marketError('Confira o CPF e o e-mail da conta.');
  const response=await fetcher('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+env.MP_ACCESS_TOKEN,'Content-Type':'application/json','X-Idempotency-Key':'market-'+id},body:JSON.stringify({transaction_amount:order.total,description:'Pedido Bloxzuh '+id,payment_method_id:'pix',external_reference:id,metadata:{bloxzuh_order:id,buyer_uid:user.uid},payer:{email:user.email,identification:{type:'CPF',number:cpf}},date_of_expiration:new Date(Date.now()+30*60000).toISOString(),notification_url:new URL('/webhook',request.url).href})});
  const payment=await response.json();
  if(!response.ok||!payment.id) marketError('Não foi possível gerar o Pix. Confira os dados e tente novamente.',502);
  const patch={mpPaymentId:String(payment.id),pixCopyPaste:payment.point_of_interaction?.transaction_data?.qr_code||'',pixQrBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||'',paymentExpiresAtMs:Date.parse(payment.date_of_expiration),payerCpf:cpf,updatedAtMs:Date.now()};
  // Um Pix concorrente usa a mesma chave idempotente. Nunca substitui uma confirmação por dados antigos.
  await marketAtomic(db,async()=>{const current=await db.get('orders/'+id); if(current.data.mpPaymentId) {if(current.data.mpPaymentId!==patch.mpPaymentId) marketError('Pagamento divergente.',409); return;} if(current.data.status!=='aguardando_pagamento') marketError('Pedido não está aguardando pagamento.',409); await db.commit([{doc:current,patch}]);});
  return marketPixResponse(payment);
}
function marketPixResponse(payment) {return {paymentId:String(payment.id),id:String(payment.id),qr_code:payment.point_of_interaction?.transaction_data?.qr_code||'',qr_code_base64:payment.point_of_interaction?.transaction_data?.qr_code_base64||'',date_of_expiration:payment.date_of_expiration};}
export async function marketHandle(request,env,dependencies={}) {
  const fetcher=dependencies.fetcher||fetch,db=dependencies.db||firestoreService(env,fetcher),url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  const origin=request.headers.get('Origin');
  const allowed=['https://xinzuhgamer.pages.dev'];
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  function reply(data,status=200) {return new Response(JSON.stringify(data),{status,headers});}
  try {
    if(origin&&!allowed.includes(origin)) marketError('Origem não permitida.',403);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
  if(path==='/market/health') return reply({service:'bloxzuh-market',configured:!!env.FIREBASE_SERVICE_ACCOUNT});
    if(Number(request.headers.get('Content-Length')||0)>(path==='/market/message'?320000:16000)) marketError('Requisição muito grande.',413);
    if(path==='/webhook'&&request.method==='POST') {
      // A notificação é apenas um aviso. Estado, valor e destinatário sempre vêm da API autenticada do MP.
      const text=await request.text(); if(text.length>16000) marketError('Requisição muito grande.',413);
      const body=JSON.parse(text||'{}'),paymentId=body.data?.id||url.searchParams.get('data.id');
      if(!paymentId) return reply({ok:true});
      await (dependencies.rate||marketRate)(env,'webhook:'+(request.headers.get('CF-Connecting-IP')||'unknown'),300);
      const payment=await marketMP(env,fetcher,String(paymentId));
      if(!payment.metadata?.bloxzuh_order) return reply({ok:true});
      await marketSettle(db,payment,marketId(payment.metadata.bloxzuh_order));
      return reply({ok:true});
    }
    if(request.method==='GET'&&path==='/market/home-trends') {
      await (dependencies.rate||marketRate)(env,'home-trends:'+(request.headers.get('CF-Connecting-IP')||'anonymous'),60);
      return reply(await homeTrends(db,env));
    }
    if(request.method==='GET'&&['/market/public-profile','/market/public-profiles'].includes(path)) {
      await (dependencies.rate||marketRate)(env,'public-profile:'+(request.headers.get('CF-Connecting-IP')||'anonymous'),120);
      if(path==='/market/public-profile'){const uid=marketId(url.searchParams.get('uid')),doc=await db.get('profiles/'+uid);return reply({profile:doc.data?marketPublicProfile(uid,doc.data):null});}
      const page=await db.list('profiles',80);return reply({profiles:page.documents.map(doc=>marketPublicProfile(doc.path.split('/').at(-1),doc.data))});
    }
    const user=await (dependencies.auth||maxUser)(request,fetcher);
    await (dependencies.rate||marketRate)(env,user.uid+':'+path,path==='/market/help'?3:path==='/create-pix'||path==='/market/orders'?10:60);
    if(path==='/market/wallet'&&request.method==='GET') return reply(await marketWallet(db,user.uid));
    if(path==='/status'&&request.method==='GET') {
      const id=marketId(url.searchParams.get('orderId')),doc=await db.get('orders/'+id); marketParty(doc.data,user); await marketSecure(db,doc.data);
      if(!doc.data.mpPaymentId) return reply({status:doc.data.status,approved:false});
      return reply(await marketSettle(db,await marketMP(env,fetcher,doc.data.mpPaymentId),id));
    }
    if(request.method!=='POST') marketError('Rota não encontrada.',404);
    const raw=await request.text(); if(raw.length>(path==='/market/message'?320000:16000)) marketError('Requisição muito grande.',413);
    const body=JSON.parse(raw||'{}');
    if(path==='/market/orders') return reply(await marketCreate(db,user,body));
    if(path==='/market/status') return reply(await marketChangeStatus(db,user,body.orderId,body.status));
    if(path==='/market/message') return reply(await marketMessage(db,user,body));
    if(path==='/market/read') return reply(await marketMessage(db,user,body,true));
    if(path==='/market/help')return reply(await marketHelp(db,user,body));
    if(path==='/market/help-resolve')return reply(await marketResolveHelp(db,user,body));
    if(path==='/market/review') return reply(await marketReview(db,user,body));
    if(path==='/market/withdraw') return reply(await marketWithdraw(db,user,body));
    if(path==='/market/payment-data') {
      const doc=await db.get('orders/'+marketId(body.orderId)); marketParty(doc.data,user); await marketSecure(db,doc.data);
      if(doc.data.buyerUid!==user.uid||doc.data.status!=='aguardando_pagamento'||doc.data.mpPaymentId) marketError('Não é possível alterar os dados deste pagamento.',409);
      // Planos adicionais sem serviço configurado não são cobrados.
      if(body.vipPlan&&body.vipPlan!=='none') marketError('Planos adicionais ainda não estão disponíveis. Selecione sem plano.');
      const cpf=String(body.payerCpf||'').replace(/\D/g,''); if(!maxValidCPF(cpf)) marketError('CPF inválido.');
      await db.commit([{doc,patch:{paymentMethod:'pix',payerName:String(body.payerName||user.name).slice(0,120),payerCpf:cpf,vipPlan:'none',updatedAtMs:Date.now()}}]);
      return reply({ok:true});
    }
    if(path==='/create-pix') return reply(await marketCreatePix(db,env,user,body,request,fetcher));
    marketError('Rota não encontrada.',404);
  } catch(error) {return reply({error:error.status&&error.status<500?error.message:'O serviço financeiro está temporariamente indisponível.'},error.status||503);}
}

// Helpers de privacidade, entrega e suporte. Nunca confiam em status enviados pelo cliente.
export function marketPublicProfile(uid,data) {
  const fields=['displayName','name','photo','photoURL','avatar','photoSource','bio','memberSinceMs','createdAtMs','lastSeenMs','online'];
  return {uid,...Object.fromEntries(fields.filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]))};
}
export function marketChatImage(value) {
  if(!value)return '';
  if(typeof value!=='string'||value.length>290000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))marketError('Imagem inválida ou grande demais. Use JPG, PNG ou WebP.');
  let bytes;try{bytes=atob(value.split(',')[1]);}catch{marketError('Imagem inválida.');}
  const mime=value.slice(11,value.indexOf(';'));
  const valid=mime==='png'?bytes.startsWith('\x89PNG\r\n\x1a\n'):mime==='jpeg'?bytes.startsWith('\xff\xd8\xff'):bytes.startsWith('RIFF')&&bytes.slice(8,12)==='WEBP';
  if(!valid)marketError('O conteúdo não corresponde ao formato da imagem.');
  return value;
}
export async function marketDeliveryWallet(db,data,now=Date.now()) {
  const wallet=data||{},items=(wallet.securePendingItems||[]).map(item=>({...item}));
  const candidates=items.filter(item=>!item.released&&!item.deliveryConfirmed&&item.releaseAtMs<=now).sort((a,b)=>(a.deliveryCheckedAtMs||0)-(b.deliveryCheckedAtMs||0)).slice(0,10);
  for(const item of candidates){
    const doc=await db.get('orders/'+marketId(item.orderId||item.code));item.deliveryCheckedAtMs=now;
    if(doc.data?.status==='concluido'&&doc.data.paymentVerified&&!doc.data.supportOpenId){await marketSecure(db,doc.data);item.deliveryConfirmed=true;}
  }
  return marketWalletState({...wallet,securePendingItems:items},now);
}
export async function marketHelp(db,user,input) {
  const reason=String(input.reason||'').trim();if(reason.length<10||reason.length>2000)marketError('Descreva o problema com 10 a 2000 caracteres.');
  return marketAtomic(db,async()=>{
    let orderDoc=null,order=null,wallet=null;
    if(input.orderId){orderDoc=await db.get('orders/'+marketId(input.orderId));order=orderDoc.data;marketParty(order,user);
      if(order.supportOpenId)return {ok:true,id:order.supportOpenId,existing:true};
      if(order.secureVersion===1){await marketSecure(db,order);if(order.paymentVerified)wallet=await db.get('financialWallets/'+marketId(order.sellerUid));}
    }
    const id='TK'+crypto.randomUUID().replace(/-/g,''),ticket=await db.get('supportTickets/'+id),now=Date.now();
    const changes=[{doc:ticket,patch:{userId:user.uid,userName:user.name,orderId:order?.code||'',sellerUid:order?.sellerUid||'',buyerUid:order?.buyerUid||'',reason,status:'aberto',createdAtMs:now}}];
    if(orderDoc)changes.push({doc:orderDoc,patch:{supportOpenId:id,updatedAtMs:now}});
    if(wallet)changes.push({doc:wallet,patch:{supportHoldTickets:[...new Set([...(wallet.data?.supportHoldTickets||[]),id])]}});
    await db.commit(changes);return {ok:true,id};
  });
}
export async function marketResolveHelp(db,user,input) {
  if(user.uid!=='cQaqR7WBJVZGodL23p6Csi7vrEn2')marketError('Acesso administrativo necessário.',403);
  const resolution=String(input.resolution||'').trim();if(resolution.length<10||resolution.length>2000||input.releaseHold!==true)marketError('Registre a solução e confirme que a análise foi concluída.');
  return marketAtomic(db,async()=>{
    const ticket=await db.get('supportTickets/'+marketId(input.ticketId));if(!ticket.data)marketError('Solicitação não encontrada.',404);if(ticket.data.status==='resolvido')return {ok:true};
    const changes=[{doc:ticket,patch:{status:'resolvido',resolution,resolvedAtMs:Date.now(),resolvedBy:user.uid}}];
    if(ticket.data.orderId){const order=await db.get('orders/'+marketId(ticket.data.orderId));
      if(order.data?.supportOpenId===input.ticketId)changes.push({doc:order,patch:{supportOpenId:'',updatedAtMs:Date.now()}});
      if(order.data?.sellerUid){const wallet=await db.get('financialWallets/'+marketId(order.data.sellerUid));if(wallet.data)changes.push({doc:wallet,patch:{supportHoldTickets:(wallet.data.supportHoldTickets||[]).filter(id=>id!==input.ticketId)}});}
    }
    await db.commit(changes);return {ok:true};
  });
}
