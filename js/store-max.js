// JavaScript / store-max.js / navegadores atuais / vitrine MAX para computador e celular.
(async function () {
  'use strict';
  var uid = new URLSearchParams(location.search).get('uid');
  function el(id) {return document.getElementById(id);}
  function node(tag, className, text) {var item = document.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item;}
  var head = el('storeHead'), all = [], category = '';
  function basicLink() {var link = node('a', 'store-secondary', 'Ver perfil público'); link.href = 'perfil.html?uid=' + encodeURIComponent(uid || ''); head.appendChild(link);}
  function fold(value) {return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');}
  function categoryName(value) {var names = {cs2:'CS2', freefire:'Free Fire', genshin:'Genshin Impact', lol:'League of Legends', premium:'Assinaturas', roblox:'Roblox', valorant:'Valorant', fortnite:'Fortnite'}; return names[value] || String(value || 'Outros').replace(/[-_]/g, ' ').replace(/^./, function (letter) {return letter.toUpperCase();});}
  function renderProducts() {
    var term = fold(el('storeSearch').value.trim());
    var list = all.filter(function (ad) {return (!category || ad.category === category) && (!term || fold(ad.title + ' ' + ad.category).includes(term));});
    if (el('storeSort').value === 'price-low') list.sort(function (a,b) {return a.price - b.price;});
    else if (el('storeSort').value === 'price-high') list.sort(function (a,b) {return b.price - a.price;});
    var grid = el('storeGrid'); grid.textContent = '';
    el('storeCount').textContent = list.length + (list.length === 1 ? ' anúncio' : ' anúncios');
    el('storeEmpty').hidden = list.length > 0;
    el('storeEmptyTitle').textContent = all.length ? 'Nenhum anúncio encontrado' : 'A vitrine está sendo preparada';
    el('storeEmptyText').textContent = all.length ? 'Experimente outro nome ou escolha uma categoria diferente.' : 'Esta loja ainda não tem anúncios ativos. Você pode conhecer o perfil do vendedor enquanto isso.';
    el('storeClearFilters').hidden = !all.length;
    list.forEach(function (ad) {
      var card = node('a','max-product'); card.href = 'anuncio.html?id=' + encodeURIComponent(ad.id);
      var media = node('div','store-product-media'); var fallback = node('i','fas fa-gamepad'); fallback.setAttribute('aria-hidden','true'); media.appendChild(fallback);
      if (ad.cover) {var image = node('img'); image.src = ad.cover; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; fallback.hidden = true; image.onerror = function () {image.remove(); fallback.hidden = false;}; media.appendChild(image);}
      var info = node('div','max-product-info'); info.appendChild(node('span','store-product-category',categoryName(ad.category)));
      info.appendChild(node('h3','',ad.title)); var bottom = node('div','store-product-bottom');
      bottom.appendChild(node('b','',Number(ad.price || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})));
      var arrow = node('i','fas fa-arrow-right'); arrow.setAttribute('aria-hidden','true'); bottom.appendChild(arrow); info.appendChild(bottom);
      card.appendChild(media); card.appendChild(info); grid.appendChild(card);
    });
  }
  function renderCategories() {
    var categories = [...new Set(all.map(function (ad) {return ad.category;}).filter(Boolean))].sort();
    var box = el('storeCategories'); box.textContent = '';
    [''].concat(categories).forEach(function (value) {
      var button = node('button','store-category',value ? categoryName(value) : 'Todos os anúncios'); button.type = 'button'; button.setAttribute('aria-pressed',String(category === value));
      button.addEventListener('click',function () {category = value; renderCategories(); renderProducts();}); box.appendChild(button);
    });
  }
  if (!uid) {head.textContent = 'Abra uma loja pelo perfil do vendedor.'; return;}
  try {
    var member = await BloxzuhMax.publicMember(uid, false, true);
    if (!member.active) {head.textContent = 'A vitrine MAX desta conta não está disponível no momento. '; basicLink(); return;}
    BloxzuhStoreTheme.apply(document.body, member.theme);
    var profile = await fsGetProfile(uid) || {};
    var name = member.shopName || profile.displayName || profile.name || 'Loja Bloxzuh';
    document.title = name + ' · Loja MAX Bloxzuh'; head.textContent = '';
    var banner = node('div','store-cover');
    if (member.cover) {var cover = node('img'); cover.src = member.cover; cover.alt = 'Capa da loja ' + name; cover.onerror = function () {cover.remove();}; banner.appendChild(cover);}
    else {var mark = node('i','fas fa-crown store-cover-mark'); mark.setAttribute('aria-hidden','true'); banner.appendChild(mark);}
    head.appendChild(banner);
    var identity = node('div','store-identity'), avatar = node('div','store-avatar');
    var letter = node('span','',name.charAt(0).toUpperCase()); letter.setAttribute('aria-hidden','true'); avatar.appendChild(letter); avatar.setAttribute('role','img'); avatar.setAttribute('aria-label','Foto da loja ' + name);
    var photo = profile.photo || profile.photoURL || profile.avatar || '';
    if (photo) {var portrait = node('img'); portrait.src = photo; portrait.alt = ''; letter.hidden = true; portrait.onerror = function () {portrait.remove(); letter.hidden = false;}; avatar.appendChild(portrait);}
    var copy = node('div','store-name'); copy.appendChild(node('span','store-eyebrow','Sua loja na Bloxzuh'));
    var heading = node('h1','',name); heading.appendChild(BloxzuhMax.badge()); copy.appendChild(heading);
    var sub = node('div','store-subline'), opening = BloxzuhMax.opening(member.schedule);
    sub.appendChild(node('span','store-online' + (opening.open ? ' is-open' : ''),opening.text)); copy.appendChild(sub);
    identity.appendChild(avatar); identity.appendChild(copy);
    var actions = node('div','store-actions'), products = node('a','store-primary','Ver anúncios'); products.href = '#storeProducts';
    var profileLink = node('a','store-secondary','Perfil e avaliações'); profileLink.href = 'perfil.html?uid=' + encodeURIComponent(uid);
    actions.appendChild(products); actions.appendChild(profileLink); identity.appendChild(actions); head.appendChild(identity);
    el('storeBio').textContent = profile.bio || 'Conheça os produtos desta loja e confira o histórico de avaliações no perfil do vendedor.';
    el('storeProfileLink').href = profileLink.href;
    el('storeHours').appendChild(BloxzuhMax.hoursCard(member)); el('storeLayout').hidden = false;
    el('storeSearch').addEventListener('input',renderProducts); el('storeSort').addEventListener('change',renderProducts);
    el('storeClearFilters').addEventListener('click',function () {category = ''; el('storeSearch').value = ''; el('storeSort').value = 'relevance'; renderCategories(); renderProducts();});
    try {
      var last = null;
      while (true) {
        var query = firebase.firestore().collection('ads').where('sellerUid','==',uid).orderBy(firebase.firestore.FieldPath.documentId()).limit(100);
        if (last) query = query.startAfter(last);
        var snap = await query.get();
        snap.forEach(function (doc) {var data = doc.data(); if (!data.status || data.status === 'ativo') all.push(normalizeAd(doc.id,data));});
        if (snap.size < 100) break;
        last = snap.docs[snap.docs.length - 1];
      }
      all = bloxzuhSortByVisibility(all); renderCategories(); renderProducts();
    } catch (error) {console.warn('store ads',error); el('storeCount').textContent = 'Indisponível agora'; el('storeEmpty').hidden = false; el('storeEmptyTitle').textContent = 'Não foi possível carregar os anúncios'; el('storeEmptyText').textContent = 'Atualize a página para tentar novamente. O perfil e os horários da loja continuam disponíveis.';}
  } catch (e) {console.warn('store MAX',e); head.textContent = 'Não foi possível carregar esta loja agora. '; basicLink();}
})();
