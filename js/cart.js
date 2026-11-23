// JavaScript / cart.js / navegador e Node.js / cesta local por conta e checkout validado no servidor.
(function(root){
  'use strict';
  var prefix='zuhstore-cart-v1-',limit=30;
  function key(row){return row.adId+':'+(row.itemIndex==null?'normal':row.itemIndex);}
  function normalize(value){
    var result=[];if(!Array.isArray(value))return result;
    value.slice(0,100).forEach(function(row){
      if(!row||!/^[A-Za-z0-9_-]{1,128}$/.test(row.adId||''))return;
      var idx=row.itemIndex==null?null:Number(row.itemIndex),qty=Number(row.quantity);
      if((idx!==null&&(!Number.isInteger(idx)||idx<0||idx>9999))||!Number.isInteger(qty)||qty<1||qty>100)return;
      var item={adId:row.adId,itemIndex:idx,quantity:qty},old=result.find(function(r){return key(r)===key(item);});
      if(old)old.quantity=Math.min(100,old.quantity+qty);else if(result.length<limit)result.push(item);
    });return result;
  }
  function quote(ad,row,uid){
    if(!ad)throw Error('Anúncio indisponível.');var data=ad.raw||ad;
    if(data.status!=='ativo')throw Error('Anúncio indisponível.');
    if(uid&&data.sellerUid===uid)throw Error('Você não pode comprar seu próprio anúncio.');
    var dynamic=String(data.model).toLowerCase()==='dinamico',item=null;
    if(dynamic){if(row.itemIndex==null||!data.items?.[row.itemIndex])throw Error('Escolha um item do anúncio.');item=data.items[row.itemIndex];}
    else if(row.itemIndex!=null)throw Error('O anúncio foi alterado. Adicione-o novamente.');
    var stock=Number(item?item.stock:data.stock),price=Number(item?item.price:data.price),cents=Math.round(price*100);
    if(!Number.isInteger(stock)||stock<1)throw Error('Produto sem estoque.');
    if(!Number.isFinite(price)||cents<1||cents>10000000)throw Error('Preço indisponível.');
    if(!Number.isInteger(row.quantity)||row.quantity<1||row.quantity>Math.min(100,stock))throw Error('Quantidade acima do estoque disponível ('+Math.min(100,stock)+').');
    if(cents*row.quantity>10000000)throw Error('Pedido acima do limite permitido.');
    return {title:String(ad.title||data.title||'Produto'),itemName:item?String(item.name||item.title||'Item'):'',seller:String(ad.seller||data.sellerName||'Vendedor'),cover:String(ad.cover||data.cover||''),stock:Math.min(100,stock),cents:cents,totalCents:cents*row.quantity};
  }
  function checkoutURL(row){return '/checkout?'+new URLSearchParams({adId:row.adId,quantity:String(row.quantity),fromCart:'1',...(row.itemIndex==null?{}:{item:String(row.itemIndex)})});}
  var pure={normalize:normalize,key:key,quote:quote,checkoutURL:checkoutURL};
  if(typeof module==='object'&&module.exports)module.exports=pure;
  if(!root.document)return;
  var document=root.document,scope='guest',uid='',rows=[],listeners=[],panel=null,version=0,details=new Map(),loading=false;
  function read(name){try{var raw=root.localStorage.getItem(prefix+name)||'[]';return raw.length>20000?[]:normalize(JSON.parse(raw));}catch(error){return [];}}
  function notify(){version++;listeners.forEach(function(fn){fn();});root.dispatchEvent(new CustomEvent('zuhstore:cart-changed'));}
  function save(next){root.localStorage.setItem(prefix+scope,JSON.stringify(next));rows=next;notify();}
  function remove(row){save(rows.filter(function(r){return key(r)!==key(row);}));}
  function add(ad,itemIndex,quantity){
    var row={adId:String(ad.id||''),itemIndex:itemIndex==null?null:Number(itemIndex),quantity:quantity||1};
    if(!normalize([row]).length)throw Error('Produto inválido.');
    var old=rows.find(function(r){return key(r)===key(row);});if(old)row.quantity+=old.quantity;
    quote(ad,row,uid);if(!old&&rows.length>=limit)throw Error('O carrinho pode ter até 30 produtos diferentes.');
    details.set(key(row),{ad:ad});save(old?rows.map(function(r){return key(r)===key(row)?row:r;}):rows.concat([row]));
  }
  function quantity(row,value){
    var n=Number(value),entry=details.get(key(row));if(!entry?.ad)throw Error('Atualize o carrinho antes de alterar.');
    var updated={...row,quantity:n};quote(entry.ad,updated,uid);save(rows.map(function(r){return key(r)===key(row)?updated:r;}));
  }
  function consume(adId,itemIndex,count){
    var target=key({adId:adId,itemIndex:itemIndex});save(rows.flatMap(function(r){return key(r)!==target?[r]:r.quantity>count?[{...r,quantity:r.quantity-count}]:[];}));
  }
  function safeImage(value){if(!value)return '';try{var url=new URL(value,location.href);return url.origin===location.origin||url.protocol==='https:'&&url.hostname==='i.ibb.co'?url.href:'';}catch(error){return '';}}
  function node(tag,text,cls){var el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
  function money(cents){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
  function info(row){var entry=details.get(key(row));if(!entry)return {error:loading?'Conferindo disponibilidade…':'Não foi possível conferir. Tente atualizar.'};if(entry.error)return entry;try{return {ad:entry.ad,...quote(entry.ad,row,uid)};}catch(error){var recovery={};try{recovery=quote(entry.ad,{...row,quantity:1},uid);}catch(ignore){}return {ad:entry.ad,...recovery,error:error.message};}}
  function summary(){var total=0,available=[];rows.forEach(function(row){var data=info(row);if(!data.error){total+=data.totalCents;available.push(row);}});return {total:total,available:available};}
  async function refresh(){
    var request=version;loading=true;render();
    var ads=new Map();
    await Promise.all([...new Set(rows.map(function(r){return r.adId;}))].map(async function(id){try{if(!root.fsGetAdById)throw Error();ads.set(id,{ad:await root.fsGetAdById(id)});}catch(error){ads.set(id,{error:'Anúncio indisponível ou não foi possível carregar.'});}}));
    if(request!==version){loading=false;if(rows.length)return refresh();render();return;}
    details=new Map(rows.map(function(row){return [key(row),ads.get(row.adId)];}));loading=false;render();
  }
  function product(row,full){
    var data=info(row),card=node('article',undefined,'cart-item'),cover=node('div',undefined,'cart-cover'),image=safeImage(data.cover||data.ad?.cover||'');
    if(image){var img=node('img');img.src=image;img.alt='';img.loading='lazy';cover.append(img);}else cover.textContent='◇';
    var copy=node('div',undefined,'cart-item-copy'),name=node('a',data.itemName||data.title||data.ad?.title||'Produto');name.href='/anuncio?id='+encodeURIComponent(row.adId)+(row.itemIndex==null?'':'&item='+row.itemIndex);copy.append(name);
    if(data.itemName)copy.append(node('p',data.title,'cart-muted'));
    if(data.error)copy.append(node('p',data.error,'cart-error'));else{copy.append(node('p',row.quantity+' × '+money(data.cents),'cart-muted'));if(full)copy.append(node('p','Vendido por '+data.seller,'cart-muted'));}
    var del=node('button','×','cart-remove');del.type='button';del.title='Remover produto';del.setAttribute('aria-label','Remover '+(data.itemName||data.title||'produto'));del.onclick=function(){try{remove(row);}catch(error){message(error.message);}};
    card.append(cover,copy,del);
    if(full&&data.stock){var controls=node('div',undefined,'cart-item-controls'),label=node('label','Quantidade '),input=node('input');input.type='number';input.min='1';input.max=String(data.stock);input.step='1';input.value=String(row.quantity);label.append(input);input.onchange=function(){try{quantity(row,input.value);message('');}catch(error){input.value=String(row.quantity);message(error.message);}};controls.append(label);if(!data.error){var buy=node('a','Comprar este produto','cart-primary');buy.href=checkoutURL(row);controls.append(node('strong',money(data.totalCents)),buy);}card.append(controls);}
    return card;
  }
  function message(text){var target=document.getElementById('cartMessage')||panel?.querySelector('[role=status]');if(target)target.textContent=text;}
  function contents(container,full){
    container.replaceChildren();if(!rows.length){var empty=node('div',undefined,'cart-empty');empty.append(node('strong','Seu carrinho está vazio'),node('p','Escolha um produto e toque em “Adicionar ao carrinho”.','cart-muted'));var browse=node('a','Explorar anúncios','cart-primary');browse.href='/anuncios';empty.append(browse);container.append(empty);return;}
    rows.forEach(function(row){container.append(product(row,full));});
  }
  function position(){var trigger=document.getElementById('headerCart');if(!panel||!trigger)return;var viewport=document.documentElement.clientWidth,rect=trigger.getBoundingClientRect(),width=Math.min(380,viewport-24);panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(rect.right-width,viewport-width-12))+'px';panel.style.top=Math.max(12,rect.bottom+12)+'px';panel.style.maxHeight=Math.max(160,root.innerHeight-rect.bottom-28)+'px';}
  function close(focus){if(!panel)return;panel.hidden=true;var trigger=document.getElementById('headerCart');trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus();}
  function open(){
    var trigger=document.getElementById('headerCart');if(!trigger)return;
    if(!panel){panel=node('section',undefined,'cart-panel');panel.id='cartPopover';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Carrinho');panel.innerHTML='<header><h2>Carrinho</h2><button type="button" class="cart-close" aria-label="Fechar carrinho">×</button></header><p class="cart-subtotal"></p><div class="cart-popover-items"></div><p role="status" class="cart-error"></p><footer><a href="/carrinho">Ver carrinho</a><a class="cart-primary" data-cart-buy href="/carrinho">Comprar</a></footer>';document.body.append(panel);panel.querySelector('.cart-close').onclick=function(){close(true);};}
    panel.hidden=false;trigger.setAttribute('aria-expanded','true');position();render();refresh();panel.querySelector('.cart-close').focus();
  }
  function render(){
    var count=rows.reduce(function(n,row){return n+row.quantity;},0),badge=document.getElementById('cartBadge'),trigger=document.getElementById('headerCart'),sum=summary();
    if(badge){badge.hidden=count===0;badge.textContent=count>99?'99+':String(count);}
    if(trigger){trigger.setAttribute('aria-label','Carrinho — '+count+' ite'+(count===1?'m':'ns'));trigger.title='Carrinho';}
    if(panel&&!panel.hidden){contents(panel.querySelector('.cart-popover-items'),false);panel.querySelector('.cart-subtotal').textContent=loading?'Conferindo preços…':'Subtotal: '+money(sum.total);var buy=panel.querySelector('[data-cart-buy]');buy.hidden=!sum.available.length;buy.href=sum.available.length===1?checkoutURL(sum.available[0]):'/carrinho';position();}
    var page=document.getElementById('cartItems');if(page){contents(page,true);document.getElementById('cartSubtotal').textContent=loading?'Conferindo…':money(sum.total);document.getElementById('cartQuantity').textContent=count+' ite'+(count===1?'m':'ns');document.getElementById('cartSeparate').hidden=sum.available.length<2;}
  }
  rows=read(scope);
  root.BloxzuhCart={...pure,add:add,remove:remove,setQuantity:quantity,consume:consume,refresh:refresh,open:open,entries:function(){return rows.map(function(r){return {...r};});}};
  listeners.push(render);
  var trigger=document.getElementById('headerCart');if(trigger){trigger.href='/carrinho';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','cartPopover');trigger.setAttribute('aria-expanded','false');trigger.addEventListener('click',function(event){event.preventDefault();if(panel&&!panel.hidden)close(true);else open();});}
  document.addEventListener('pointerdown',function(event){if(panel&&!panel.hidden&&!panel.contains(event.target)&&!trigger?.contains(event.target))close(false);});
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&panel&&!panel.hidden){event.preventDefault();close(true);}});
  root.addEventListener('resize',position);root.addEventListener('scroll',position,{passive:true});
  root.addEventListener('storage',function(event){if(event.key===prefix+scope){rows=read(scope);details.clear();notify();if(panel&&!panel.hidden||document.getElementById('cartItems'))refresh();}});
  document.getElementById('cartRefresh')?.addEventListener('click',refresh);
  if(root.firebase?.auth)root.firebase.auth().onAuthStateChanged(function(user){
    var next=user?user.uid:'guest';if(next===scope){render();if(document.getElementById('cartItems'))refresh();return;}
    var guest=scope==='guest'?rows:[];scope=next;uid=user?.uid||'';rows=read(scope);details.clear();
    if(user&&guest.length){try{root.localStorage.setItem(prefix+scope,JSON.stringify(normalize(rows.concat(guest))));root.localStorage.removeItem(prefix+'guest');rows=read(scope);}catch(error){message('Não foi possível transferir os produtos. Seu carrinho de visitante foi preservado.');}}
    notify();if(panel&&!panel.hidden||document.getElementById('cartItems'))refresh();
  });
  render();if(document.getElementById('cartItems'))refresh();
})(typeof window==='undefined'?globalThis:window);
