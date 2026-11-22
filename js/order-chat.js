// JavaScript / order-chat.js / Firebase compat 10 / conversa privada com histórico paginado.
(function(){
 'use strict';
 const $=id=>document.getElementById(id),state={id:new URLSearchParams(location.search).get('id')||'',user:null,order:null,messages:new Map(),pending:new Map(),photos:new Map(),oldest:null,loading:false,readBusy:false,readThrough:0,image:'',unsubOrder:null,unsubMessages:null};
 const labels={aguardando_pagamento:'Aguardando pagamento',pago:'Pago',em_entrega:'Em entrega',concluido:'Concluído',cancelado:'Cancelado',expirado:'Pix expirado',reembolsado:'Reembolsado'};
 function toast(text){$('orderToast').textContent=text;$('orderToast').hidden=false;clearTimeout(state.toast);state.toast=setTimeout(()=>$('orderToast').hidden=true,5000);}
 function api(route,body){return window.bloxzuhMarketApi(route,body);}
 function paid(o){return o?.secureVersion===1&&o.paymentVerified===true&&['pago','em_entrega','concluido'].includes(o.status);}
 function bottom(){let el=$('chatScroll');return el.scrollHeight-el.scrollTop-el.clientHeight<90;}
 function scrollBottom(){$('chatScroll').scrollTop=$('chatScroll').scrollHeight;$('newMessages').hidden=true;acknowledge();}
 function safeImage(value){return typeof value==='string'&&(/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(value))?value:'';}
 function element(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
 function facts(label,value){const row=element('div');row.append(element('dt',label),element('dd',value));return row;}
 async function changeStatus(next){try{await api('/market/status',{orderId:state.id,status:next});}catch(e){toast(e.message);}}
 function action(text,fn){const button=element('button',text);button.type='button';button.onclick=fn;$('orderActions').append(button);}
 function updateOrder(o){
  state.order=o;const buyer=o.buyerUid===state.user.uid,canChat=paid(o);
  $('orderApp').hidden=false;$('orderLoading').hidden=true;$('orderCode').textContent='#'+(o.code||state.id);$('orderTitle').textContent=o.adTitle||'Produto';$('orderStatus').textContent=labels[o.status]||'Em conferência';
  $('orderFacts').replaceChildren(facts('Total',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(o.total||o.price||0)),facts('Vendedor',o.sellerName||'Vendedor'),facts('Comprador',o.buyerName||'Comprador'));
  if(o.itemName)$('orderFacts').append(facts('Item',o.itemName));
  const image=safeImage(o.adCover);$('orderCover').hidden=!image;if(image)$('orderCover').src=image;
  $('adLink').href='anuncio.html?id='+encodeURIComponent(o.adId||'');$('orderActions').replaceChildren();
  if(buyer&&o.status==='aguardando_pagamento'){
   const expired=o.paymentExpiresAtMs&&Date.now()>=Number(o.paymentExpiresAtMs);
   if(!expired){const pay=element('a','Abrir pagamento Pix');pay.href='pagamento.html?id='+encodeURIComponent(state.id);$('orderActions').append(pay);}
   if(!o.mpPaymentId)action('Cancelar pedido',()=>{if(confirm('Cancelar este pedido ainda sem Pix?'))changeStatus('cancelado');});
  }
  if(!buyer&&o.status==='pago'&&canChat)action('Marcar em entrega',()=>changeStatus('em_entrega'));
  if(buyer&&canChat&&['pago','em_entrega'].includes(o.status)&&!o.supportOpenId)action('Confirmar recebimento',()=>{if(confirm('Você já recebeu e conferiu o produto? A confirmação permite liberar o saldo após o prazo de proteção.'))changeStatus('concluido');});
  $('orderNotice').textContent=o.supportOpenId?'Há uma solicitação de ajuda aberta. O saque fica bloqueado durante a análise.':'O saldo só fica disponível após a confirmação de recebimento e dez dias do pagamento.';
  $('supportState').replaceChildren();if(o.supportOpenId){const link=element('a','Acompanhar solicitação '+o.supportOpenId);link.href='suporte.html?ticket='+encodeURIComponent(o.supportOpenId);$('supportState').append(link);}
  $('chatHeading').textContent='Chat com '+(buyer?'vendedor':'comprador');$('chatPartner').textContent=buyer?(o.sellerName||'Vendedor'):(o.buyerName||'Comprador');$('chatPartner').setAttribute('data-max-uid',buyer?o.sellerUid:o.buyerUid);$('chatPartner').setAttribute('data-max-name','');
  $('chatLocked').hidden=canChat;$('chatLocked').textContent=o.secureVersion!==1?'Este pedido antigo precisa de conferência administrativa. Use o botão de ajuda.':'O chat será liberado quando o pagamento for confirmado.';
  $('composer').hidden=!canChat;$('chatScroll').hidden=!canChat;
  const reviewed=buyer?o.reviewed:o.buyerReviewed;$('reviewBox').hidden=o.status!=='concluido';$('reviewForm').hidden=!!reviewed;$('reviewTitle').textContent=buyer?'Avaliar vendedor':'Avaliar comprador';if(reviewed)$('reviewResult').textContent='Sua avaliação foi registrada.';
  if(canChat&&!state.unsubMessages)listenMessages();
  if(!canChat&&state.unsubMessages){state.unsubMessages();state.unsubMessages=null;}
  renderMessages(false);acknowledge();
 }
 function mergedMessages(){const legacy=(state.order?.messages||[]).map((m,i)=>({...m,id:'legacy-'+(m.id||i)}));return legacy.concat(Array.from(state.messages.values())).sort((a,b)=>a.createdAtMs-b.createdAtMs||a.id.localeCompare(b.id));}
 function renderMessages(forceBottom){
  if(!state.order)return;const scroll=$('chatScroll'),atBottom=bottom(),oldHeight=scroll.scrollHeight,oldTop=scroll.scrollTop,fragment=document.createDocumentFragment();let day='';
  const otherRead=Number(state.order.buyerUid===state.user.uid?state.order.sellerReadAtMs:state.order.buyerReadAtMs)||0;
  const rows=mergedMessages().concat(Array.from(state.pending.values()).filter(m=>!state.messages.has('M'+m.requestId)));
  if(!rows.length)fragment.append(element('p','Nenhuma mensagem ainda. Combine a entrega por aqui.','muted'));
  rows.forEach(m=>{
   const date=new Date(Number(m.createdAtMs)||0),nextDay=date.toLocaleDateString('pt-BR');if(day!==nextDay){day=nextDay;fragment.append(element('div',nextDay,'day-separator'));}
   const me=m.senderUid===state.user.uid,row=element('div',undefined,'message-row'+(me?' me':'')),bubble=element('div',undefined,'bubble');
   if(m.text)bubble.append(element('p',m.text));
   if(m.image&&safeImage(m.image)){const photo=element('img');photo.className='message-photo';photo.src=m.image;photo.alt='Imagem enviada por '+(m.senderName||'participante');photo.loading='lazy';photo.onclick=()=>{$('fullImage').src=m.image;$('imageDialog').showModal();};bubble.append(photo);}
   let status=m.local?(m.failed?'Falha no envio':'Enviando…'):me?((m.read||Number(m.createdAtMs)<=otherRead)?'Lida':'Enviada'):'';
   const footer=element('footer'),name=element('span',m.senderName||'Participante');name.setAttribute('data-max-uid',m.senderUid||'');name.setAttribute('data-max-name','');footer.append(name,document.createTextNode(' · '+date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+(status?' · '+status:'')));bubble.append(footer);
   if(m.failed){const retry=element('button','Tentar novamente','outline');retry.type='button';retry.onclick=()=>deliver(m);bubble.append(retry);}
   const avatar=safeImage(state.photos.get(m.senderUid));if(avatar){const image=element('img');image.src=avatar;image.alt='';image.className='chat-avatar';row.append(image);}row.append(bubble);fragment.append(row);
  });
  $('messageList').replaceChildren(fragment);
  if(forceBottom||atBottom){scroll.scrollTop=scroll.scrollHeight;$('newMessages').hidden=true;}else{scroll.scrollTop=oldTop;$('newMessages').hidden=scroll.scrollHeight>oldHeight?false:$('newMessages').hidden;}
 }
 function listenMessages(){
  const ref=firebase.firestore().collection('orders').doc(state.id).collection('messages');
  state.unsubMessages=ref.orderBy('createdAtMs','desc').limit(40).onSnapshot(snapshot=>{
   snapshot.docs.forEach(doc=>{state.messages.set(doc.id,{id:doc.id,...doc.data()});if(!state.oldest||doc.data().createdAtMs<state.oldest.data().createdAtMs)state.oldest=doc;});
   if(snapshot.docs.length<40)$('loadOlder').hidden=true;renderMessages(false);acknowledge();
  },e=>toast('Não foi possível atualizar o histórico: '+e.message));
 }
 async function older(){
  if(state.loading||!state.oldest)return;state.loading=true;$('loadOlder').disabled=true;
  try{const scroll=$('chatScroll'),height=scroll.scrollHeight,top=scroll.scrollTop,snapshot=await firebase.firestore().collection('orders').doc(state.id).collection('messages').orderBy('createdAtMs','desc').startAfter(state.oldest).limit(40).get();
   snapshot.docs.forEach(doc=>state.messages.set(doc.id,{id:doc.id,...doc.data()}));if(snapshot.docs.length)state.oldest=snapshot.docs.at(-1);$('loadOlder').hidden=snapshot.docs.length<40;renderMessages(false);scroll.scrollTop=top+(scroll.scrollHeight-height);$('newMessages').hidden=true;
  }catch(e){toast(e.message);}finally{state.loading=false;$('loadOlder').disabled=false;}
 }
 async function acknowledge(){
  if(!paid(state.order)||document.visibilityState!=='visible'||!document.hasFocus()||!bottom()||state.readBusy)return;
  const unread=mergedMessages().filter(m=>m.senderUid!==state.user.uid&&!m.read),through=Math.max(0,...unread.map(m=>Number(m.createdAtMs)||0));if(through<=state.readThrough)return;
  state.readBusy=true;try{await api('/market/read',{orderId:state.id,upToMs:through});state.readThrough=through;}catch(e){}finally{state.readBusy=false;}
 }
 async function deliver(m){
  if(m.sending)return;m.sending=true;m.failed=false;renderMessages(true);
  try{await api('/market/message',{orderId:state.id,text:m.text,image:m.image||'',requestId:m.requestId});state.pending.delete(m.requestId);}catch(e){m.failed=true;toast(e.message);}finally{m.sending=false;renderMessages(true);}
 }
 async function submit(event){
  event.preventDefault();if(!paid(state.order))return;const text=$('messageInput').value.trim();if(!text&&!state.image)return;
  const requestId=crypto.randomUUID(),m={id:requestId,requestId,senderUid:state.user.uid,senderName:state.user.displayName||'Você',text,image:state.image,createdAtMs:Date.now(),local:true};state.pending.set(requestId,m);$('messageInput').value='';removeImage();await deliver(m);
 }
 function removeImage(){state.image='';$('imageInput').value='';$('attachmentPreview').hidden=true;$('attachmentImage').removeAttribute('src');}
 async function chooseImage(){
  const file=$('imageInput').files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Use JPG, PNG ou WebP de até 5 MB.');return;}
  try{const uri=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const photo=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=uri;});
   const canvas=document.createElement('canvas'),ratio=Math.min(1,1280/photo.width,1280/photo.height);canvas.width=Math.round(photo.width*ratio);canvas.height=Math.round(photo.height*ratio);canvas.getContext('2d').drawImage(photo,0,0,canvas.width,canvas.height);let data=canvas.toDataURL('image/webp',.8);if(data.length>280000)data=canvas.toDataURL('image/webp',.55);if(data.length>280000)throw Error('Escolha uma imagem menor.');state.image=data;$('attachmentImage').src=data;$('attachmentPreview').hidden=false;
  }catch(e){toast(e.message||'Não foi possível abrir a imagem.');}
 }
 $('composer').onsubmit=submit;$('messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}};
 $('loadOlder').onclick=older;$('newMessages').onclick=scrollBottom;$('chatScroll').onscroll=()=>{if(bottom()){$('newMessages').hidden=true;acknowledge();}};document.addEventListener('visibilitychange',acknowledge);window.addEventListener('focus',acknowledge);
 $('imageInput').onchange=chooseImage;$('removeAttachment').onclick=removeImage;$('closeImage').onclick=()=>$('imageDialog').close();
 $('helpButton').onclick=()=>{$('helpResult').textContent='';$('helpDialog').showModal();};$('closeHelp').onclick=()=>$('helpDialog').close();
 $('helpForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const result=await api('/market/help',{orderId:state.id,reason:$('helpReason').value});$('helpResult').textContent='Solicitação '+result.id+' registrada. ';const link=element('a','Acompanhar resposta');link.href='suporte.html?ticket='+encodeURIComponent(result.id);$('helpResult').append(link);}catch(error){$('helpResult').textContent=error.message;}finally{button.disabled=false;}};
 $('reviewForm').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{await api('/market/review',{orderId:state.id,stars:Number($('reviewStars').value),comment:$('reviewComment').value});$('reviewResult').textContent='Avaliação registrada.';}catch(error){toast(error.message);}finally{e.submitter.disabled=false;}};
 firebase.auth().onAuthStateChanged(async user=>{
  if(!user){location.href='login.html?redirect='+encodeURIComponent('pedido.html?id='+state.id);return;}state.user=user;try{const profile=await fsGetProfile(user.uid);state.photos.set(user.uid,profile?.photo||profile?.photoURL||user.photoURL||'');}catch(e){}
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(state.id)){$('orderLoading').textContent='Pedido não encontrado.';return;}
  try{const ref=firebase.firestore().collection('orders').doc(state.id),snapshot=await ref.get();if(!snapshot.exists)throw Error('Pedido não encontrado.');const o=snapshot.data();if(![o.buyerUid,o.sellerUid].includes(user.uid))throw Error('Você não tem acesso a este pedido.');
   if(matchMedia('(max-width:760px)').matches)$('summaryDetails').open=false;
   state.unsubOrder?.();state.unsubOrder=ref.onSnapshot(doc=>{if(doc.exists)updateOrder({id:doc.id,...doc.data()});},e=>toast(e.message));
   async function presence(){if(document.visibilityState!=='visible')return;try{const p=await fsGetProfile(user.uid===o.buyerUid?o.sellerUid:o.buyerUid);$('partnerPresence').textContent=p&&isUserOnline(p)?'Online':'Offline';const photo=safeImage(p?.photo||p?.photoURL);if(photo){state.photos.set(user.uid===o.buyerUid?o.sellerUid:o.buyerUid,photo);$('partnerAvatar').src=photo;$('partnerAvatar').hidden=false;renderMessages(false);}}catch(e){$('partnerPresence').textContent='';}}
   presence();state.presence=setInterval(presence,30000);
  }catch(e){$('orderLoading').textContent=e.message;}
 });
 window.addEventListener('pagehide',()=>{state.unsubOrder?.();state.unsubMessages?.();clearInterval(state.presence);});
})();
