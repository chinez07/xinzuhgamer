// JavaScript / cart-count.js / navegador e Node.js / contador privado de compras pendentes.
(function(root){
  'use strict';
  function pendingOrders(rows,now){
    return rows.filter(function(order){
      if(order.status!=='aguardando_pagamento'||order.paymentVerified===true)return false;
      var expires=Number(order.paymentExpiresAtMs);
      return !Number.isFinite(expires)||expires<=0||expires>now;
    });
  }
  if(typeof module==='object'&&module.exports)module.exports={pendingOrders:pendingOrders};
  if(!root.document)return;
  var document=root.document,link=document.getElementById('headerCart'),badge=document.getElementById('cartBadge');
  if(!link||!badge||!root.firebase?.auth||!root.firebase?.firestore)return;
  var rows=[],unsubscribe=null,timer=null,revision=0;
  function clear(){
    revision++;if(unsubscribe)unsubscribe();unsubscribe=null;
    if(timer)root.clearTimeout(timer);timer=null;rows=[];
    badge.hidden=true;badge.textContent='';link.setAttribute('aria-label','Carrinho — Minhas compras');link.title='Minhas compras';
  }
  function render(){
    if(timer)root.clearTimeout(timer);timer=null;
    var now=Date.now(),pending=pendingOrders(rows,now),count=pending.length;
    badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;
    var label=count+' pedido'+(count===1?'':'s')+' aguardando pagamento';
    link.setAttribute('aria-label','Carrinho — '+label);link.title='Minhas compras — '+label;
    var next=pending.reduce(function(time,order){var expires=Number(order.paymentExpiresAtMs);return expires>now?Math.min(time,expires):time;},Infinity);
    if(Number.isFinite(next))timer=root.setTimeout(render,Math.min(2147483647,next-now+100));
  }
  function listen(user){
    clear();if(!user)return;var version=revision;
    try{
      unsubscribe=root.firebase.firestore().collection('orders').where('buyerUid','==',user.uid).where('status','==','aguardando_pagamento').onSnapshot(function(snapshot){
        if(version!==revision)return;
        rows=[];snapshot.forEach(function(doc){rows.push(doc.data());});render();
      },function(){if(version===revision)clear();});
    }catch(error){clear();}
  }
  root.firebase.auth().onAuthStateChanged(listen);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)render();});
  root.addEventListener('pagehide',clear);
  root.addEventListener('pageshow',function(event){if(event.persisted)listen(root.firebase.auth().currentUser);});
})(typeof window==='undefined'?globalThis:window);
