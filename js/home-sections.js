// JavaScript / home-sections.js / navegador e Node.js / descoberta com dados reais do Bloxzuh.
(function(root){
  'use strict';
  function active(ad){return ((ad.raw&&ad.raw.status)||ad.status)==='ativo';}
  function promoted(ad){return active(ad)&&['ouro','diamante'].includes(String(ad.visibility||(ad.raw&&ad.raw.visibility)||'prata').toLowerCase());}
  function popular(ads){return ads.filter(function(ad){return promoted(ad)&&Number(ad.sales||(ad.raw&&ad.raw.sales)||0)>0;}).slice().sort(function(a,b){return Number(b.sales||(b.raw&&b.raw.sales)||0)-Number(a.sales||(a.raw&&a.raw.sales)||0)||Number(b.ratingCount||0)-Number(a.ratingCount||0);}).slice(0,12);}
  function favorites(ads,ids){var selected=new Set(ids.map(String));return ads.filter(function(ad){return active(ad)&&selected.has(String(ad.id));});}
  function publicReviews(rows){return rows.filter(function(row){return ['ad','seller'].includes(row.type)&&Number.isInteger(row.stars)&&row.stars>=1&&row.stars<=5;}).sort(function(a,b){return Number(b.createdAtMs||0)-Number(a.createdAtMs||0);}).slice(0,8);}
  function reviewAuthor(review) {
    return {uid:String(review.fromUid || review.buyerUid || ''),name:String(review.fromName || review.buyerName || 'Comprador'),photo:String(review.fromPhoto || review.buyerPhoto || '')};
  }
  function safeReviewPhoto(value) {
    if (typeof value !== 'string' || value.length > 900000) return '';
    if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try {var url = new URL(value);return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';} catch (_) {return '';}
  }
  var shortcutGames={roblox:{name:'Roblox',path:'roblox',icon:'/assets/icons/roblox.svg'},freefire:{name:'Free Fire',path:'free-fire',icon:'/assets/icons/free-fire.svg'},valorant:{name:'Valorant',path:'valorant',icon:'/assets/icons/valorant.svg'},fortnite:{name:'Fortnite',path:'fortnite',icon:'/assets/categorias/fortnite.jpg'},lol:{name:'League of Legends',path:'league-of-legends',icon:'/assets/categorias/lol.jpg'},genshin:{name:'Genshin Impact',path:'genshin-impact',icon:'/assets/categorias/genshin.jpg'},cs2:{name:'CS2',path:'cs2',icon:'/assets/categorias/cs2.jpg'}};
  function shortcutSelection(ranked){
    var ids=[];
    (Array.isArray(ranked)?ranked:[]).concat(['roblox','freefire','valorant']).forEach(function(id){if(Object.hasOwn(shortcutGames,id)&&!ids.includes(id)&&ids.length<3)ids.push(id);});
    return ids.map(function(id){return Object.assign({id:id},shortcutGames[id]);});
  }
  var api={popular:popular,favorites:favorites,publicReviews:publicReviews,reviewAuthor:reviewAuthor,safeReviewPhoto:safeReviewPhoto,shortcutSelection:shortcutSelection};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  var document=root.document,favoriteExtra=[],favoriteVersion=0;
  function renderShortcuts(ranked){
    var nav=document.querySelector('.home-shortcuts');if(!nav)return;
    nav.replaceChildren();nav.setAttribute('aria-label',ranked.length?'Jogos mais comprados nos últimos 7 dias':'Explorar jogos');
    shortcutSelection(ranked).concat([{name:'Todos os jogos',path:'',icon:'/assets/icons/all-games.svg'}]).forEach(function(game){
      var link=document.createElement('a');link.href=game.path?'/categoria/'+game.path:'/categorias';
      var image=document.createElement('img');image.className='shortcut-icon';image.src=game.icon;image.alt='';image.width=22;image.height=22;
      var arrow=document.createElement('span');arrow.textContent=game.path?'↗':'→';arrow.setAttribute('aria-hidden','true');
      if(ranked.includes(game.id))link.title='Entre os jogos mais comprados nos últimos 7 dias';
      link.append(image,document.createTextNode(game.name),arrow);nav.append(link);
    });
  }
  async function refreshShortcuts(){
    if(!document.querySelector('.home-shortcuts'))return;
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},8000);
    try{
      var response=await root.fetch('https://bloxzuh-pix.hskkaj48.workers.dev/market/home-trends',{signal:controller.signal});
      if(!response.ok)throw Error('unavailable');
      var result=await response.json();
      renderShortcuts(result.windowDays===7&&Array.isArray(result.categories)?result.categories:[]);
    }catch(error){renderShortcuts([]);}finally{clearTimeout(timer);}
  }
  function empty(container,title,description,href,label){
    container.replaceChildren();var card=document.createElement('div');card.className='home-empty';
    var heading=document.createElement('h3');heading.textContent=title;var text=document.createElement('p');text.textContent=description;card.append(heading,text);
    if(href){var link=document.createElement('a');link.href=href;link.textContent=label;card.append(link);}container.append(card);
  }
  function cards(container,ads){container.innerHTML=ads.map(root.createProductCard).join('');if(typeof root.syncFavButtonsIn==='function')root.syncFavButtonsIn(container);}
  async function renderFavorites(){
    var version=++favoriteVersion,container=document.getElementById('homeFavorites');if(!container)return;
    var ids=typeof root.getFavIds==='function'?root.getFavIds():[],ads=root.adsDataLive||[];
    if(!ids.length){empty(container,'Seus próximos upgrades, salvos aqui','Toque no coração de um anúncio para encontrá-lo de novo.','/anuncios','Explorar anúncios');return;}
    var seen=new Set(ads.concat(favoriteExtra).map(function(ad){return String(ad.id);})),missing=ids.filter(function(id){return !seen.has(String(id));}).slice(0,12);
    if(typeof root.fsGetAdById==='function'){
      var rows=await Promise.all(missing.map(function(id){return root.fsGetAdById(id).catch(function(){return null;});}));
      if(version!==favoriteVersion)return;favoriteExtra=favoriteExtra.concat(rows.filter(Boolean));
    }
    var selected=favorites(ads.concat(favoriteExtra.filter(function(ad){return !ads.some(function(a){return a.id===ad.id;});})),ids).slice(0,8);
    if(selected.length)cards(container,selected);
    else empty(container,'Seus favoritos estão na sua lista','Confira a disponibilidade dos anúncios que você salvou.','/favoritos','Ver favoritos');
  }
  function renderPopular(){
    var container=document.getElementById('homePopular');if(!container)return;
    if(root.bloxzuhHomeStatus==='error'){empty(container,'Não foi possível carregar','Tente atualizar a página para consultar as ofertas.','/anuncios','Ver anúncios');return;}
    var list=popular(root.adsDataLive||[]);
    if(list.length)cards(container,list);else empty(container,'As próximas conquistas começam aqui','Esta seleção aparece conforme os anúncios em destaque registram vendas.','/anuncios','Conhecer as ofertas');
  }
  async function renderReviews(){
    var container=document.getElementById('homeReviews');if(!container)return;
    try{
      if(!root.firebase?.firestore)throw Error('unavailable');
      var snapshot=await root.firebase.firestore().collection('reviews').orderBy('createdAtMs','desc').limit(24).get();
      var rows=[];snapshot.forEach(function(doc){rows.push(doc.data());});var reviews=publicReviews(rows);
      if(!reviews.length){empty(container,'Cada compra conta uma história','As avaliações das compras concluídas vão aparecer aqui.');return;}
      var profiles = new Map();
      container.replaceChildren();reviews.forEach(function(review){
        var card=document.createElement('article');card.className='home-review';
        var stars=document.createElement('span');stars.className='home-review-stars';stars.textContent='★'.repeat(review.stars)+'☆'.repeat(5-review.stars);stars.setAttribute('aria-label',review.stars+' de 5 estrelas');
        var quote=document.createElement('p');quote.textContent=review.comment||'Avaliação sem comentário.';
        var author=reviewAuthor(review),identity=document.createElement('div');identity.className='home-review-author';
        var avatar=document.createElement('span');avatar.className='home-review-avatar';avatar.setAttribute('aria-hidden','true');
        var details=document.createElement('div');details.className='home-review-author-details';
        var name=document.createElement(author.uid?'a':'strong');name.className='home-review-name';name.textContent=author.name;
        if(author.uid){name.href='/perfil?uid='+encodeURIComponent(author.uid);name.setAttribute('aria-label','Ver perfil de '+author.name);}
        function showPhoto(photo,displayName){
          var label=displayName || author.name;name.textContent=label;
          if(author.uid)name.setAttribute('aria-label','Ver perfil de '+label);
          avatar.replaceChildren();avatar.textContent=Array.from(label.trim())[0]?.toUpperCase() || '?';
          var source=safeReviewPhoto(photo);if(!source)return;
          var image=document.createElement('img');image.src=source;image.alt='';image.width=40;image.height=40;image.loading='lazy';image.decoding='async';
          image.addEventListener('error',function(){image.remove();});avatar.append(image);
        }
        showPhoto(author.photo);
        details.append(name);
        if(review.adId){var link=document.createElement('a');link.href='/anuncio?id='+encodeURIComponent(review.adId);link.textContent=review.adTitle||'Ver anúncio';details.append(link);}
        identity.append(avatar,details);card.append(stars,quote,identity);container.append(card);
        if(author.uid && typeof root.bloxzuhPublicProfile==='function'){
          if(!profiles.has(author.uid))profiles.set(author.uid,root.bloxzuhPublicProfile(author.uid));
          profiles.get(author.uid).then(function(profile){if(profile && container.contains(card))showPhoto(profile.photo || profile.photoURL || '',profile.displayName || profile.name || author.name);}).catch(function(){/* Preserve the review and its existing author if the photo lookup fails. */});
        }
      });
    }catch(error){empty(container,'Avaliações dos compradores','Consulte as avaliações na página de cada vendedor.');}
  }
  function boot(){
    refreshShortcuts();setInterval(function(){if(!document.hidden)refreshShortcuts();},300000);
    document.querySelectorAll('[data-home-scroll]').forEach(function(button){button.addEventListener('click',function(){var track=document.getElementById(button.dataset.homeScroll);if(track)track.scrollBy({left:Number(button.dataset.direction)*(track.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});});
    root.addEventListener('bloxzuh:home-ready',function(){renderFavorites();renderPopular();});
    root.addEventListener('storage',function(event){if(event.key==='bloxzuh-favs')renderFavorites();});
    document.addEventListener('click',function(event){if(event.target.closest('.fav'))setTimeout(renderFavorites,0);},true);
    renderFavorites();if(root.bloxzuhHomeStatus&&root.bloxzuhHomeStatus!=='loading')renderPopular();renderReviews();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})(typeof window==='undefined'?globalThis:window);
