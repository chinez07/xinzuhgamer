// JavaScript / store-max.js / navegadores atuais / vitrine pública Clube MAX.
(async function () {
  var uid = new URLSearchParams(location.search).get('uid');
  var head = document.getElementById('storeHead');
  function basicLink() {var link = document.createElement('a'); link.className = 'action'; link.href = 'perfil.html?uid=' + encodeURIComponent(uid || ''); link.textContent = 'Ver perfil público'; head.appendChild(link);}
  if (!uid) {head.textContent = 'Abra uma loja pelo perfil do vendedor.'; return;}
  try {
    var member = await BloxzuhMax.publicMember(uid, false, true);
    if (!member.active) {head.textContent = 'A vitrine MAX desta conta não está disponível no momento. '; basicLink(); return;}
    var profile = await fsGetProfile(uid);
    var name = member.shopName || (profile && (profile.displayName || profile.name)) || 'Loja Bloxzuh';
    document.title = name + ' · Loja MAX Bloxzuh'; head.textContent = '';
    if (member.cover) {var cover = document.createElement('img'); cover.src = member.cover; cover.alt = 'Capa da loja ' + name; cover.className = 'max-profile-cover'; head.appendChild(cover);}
    var heading = document.createElement('h1'); heading.textContent = name; heading.appendChild(BloxzuhMax.badge()); head.appendChild(heading);
    if (profile && profile.bio) {var bio = document.createElement('p'); bio.className = 'fine'; bio.textContent = profile.bio; head.appendChild(bio);}
    basicLink(); document.getElementById('storeHours').appendChild(BloxzuhMax.hoursCard(member));
    var all = [], last = null;
    while (true) {
      var query = firebase.firestore().collection('ads').where('sellerUid', '==', uid).orderBy(firebase.firestore.FieldPath.documentId()).limit(100);
      if (last) query = query.startAfter(last);
      var snap = await query.get();
      snap.forEach(function (doc) {var data = doc.data(); if (!data.status || data.status === 'ativo') all.push(normalizeAd(doc.id, data));});
      if (snap.size < 100) break;
      last = snap.docs[snap.docs.length - 1];
    }
    all = bloxzuhSortByVisibility(all);
    document.getElementById('storeProducts').hidden = false;
    document.getElementById('storeCount').textContent = all.length ? all.length + ' anúncio(s) ativo(s).' : 'Esta loja ainda não tem anúncios ativos.';
    var grid = document.getElementById('storeGrid');
    all.forEach(function (ad) {
      var card = document.createElement('a'); card.className = 'max-product'; card.href = 'anuncio.html?id=' + encodeURIComponent(ad.id);
      if (ad.cover) {var image = document.createElement('img'); image.src = ad.cover; image.alt = ''; image.loading = 'lazy'; card.appendChild(image);}
      var info = document.createElement('div'); info.className = 'max-product-info';
      var title = document.createElement('h3'); title.textContent = ad.title;
      var price = document.createElement('b'); price.textContent = Number(ad.price).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
      info.appendChild(title); info.appendChild(price); card.appendChild(info); grid.appendChild(card);
    });
  } catch (e) {console.warn('store MAX', e); head.textContent = 'Não foi possível carregar esta loja agora. '; basicLink();}
})();
