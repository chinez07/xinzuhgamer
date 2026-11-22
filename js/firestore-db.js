// Firestore helpers - Bloxzuh
// Requires: firebase-app, firebase-auth, firebase-firestore already loaded

var db = null;
try {
  db = firebase.firestore();
} catch (e) {
  console.error('Firestore init failed', e);
}
function getDb() {
  if (!db) db = firebase.firestore();
  return db;
}


/** IDs legíveis: AD… anúncios | BZ… pedidos | NT… notificações */
function bloxzuhDocId(prefix) {
  var s = Math.random().toString(36).slice(2, 6).toUpperCase();
  var t = Date.now().toString(36).toUpperCase().slice(-4);
  return String(prefix || 'ID') + s + t;
}
window.bloxzuhDocId = bloxzuhDocId;

function requireUser() {
  const u = firebase.auth().currentUser;
  if (!u) throw new Error('Faça login primeiro.');
  return u;
}

/** Anúncios do vendedor logado */
async function fsGetMyAds() {
  const u = requireUser();
  const snap = await getDb().collection('ads')
    .where('sellerUid', '==', u.uid)
    .get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) {
    const ta = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : (a.createdAtMs || 0);
    const tb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : (b.createdAtMs || 0);
    return tb - ta;
  });
  return list;
}

async function requestSavedAdReview(adId) {
  try {await BloxzuhAdModeration.review(adId);} catch(e) {
    // O anúncio já está salvo e bloqueado para compra, inclusive se o serviço falhar.
    console.warn('[Bloxzuh] Anúncio salvo em revisão; análise automática indisponível.');
  }
}
async function fsCreateAd(data) {
  const u = requireUser();
  const payload = {
    sellerUid: u.uid,
    sellerName: u.displayName || (u.email ? u.email.split('@')[0] : 'Vendedor'),
    sellerPhoto: data.sellerPhoto || '',
    title: data.title,
    category: data.category || '',
    subcategory: data.subcategory || '',
    gameName: data.gameName || '',
    experienceName: data.experienceName || '',
    section: data.section || '',
    productType: data.productType || 'Conta',
    origin: data.origin || '',
    accountInfo: data.accountInfo || '',
    model: data.model || 'normal',
    items: Array.isArray(data.items) ? data.items : [],
    price: Number(data.price),
    stock: Number(data.stock) || 1,
    desc: data.desc || '',
    faq: data.faq || [],
    visibility: data.visibility || 'prata',
    plan: data.plan || 'none',
    cover: data.cover || '',
    gallery: data.gallery || [],
    imageFrame: (window.BloxzuhAdFrame ? BloxzuhAdFrame.normalize(data.imageFrame) : {style:'none'}),
    status: 'pendente',
    sales: 0,
    sold: 0,
    feePercent: data.feePercent || 9.99,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  };
  // ID legível do anúncio, ex: AD7K2M9A3B (nunca usar .add)
  var adId = (typeof bloxzuhDocId === 'function' ? bloxzuhDocId('AD') : ('AD' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).toUpperCase().slice(-4)));
  payload.code = adId;
  payload.moderationRevision=bloxzuhDocId('REV')+'_'+Date.now();
  payload.moderationReviewId='';payload.moderationReason='';
  await getDb().collection('ads').doc(adId).set(payload);
  await requestSavedAdReview(adId);
  console.log('[Bloxzuh] anúncio criado com ID=', adId, 'model=', payload.model, 'items=', (payload.items||[]).length);
  return adId;
}

async function fsUpdateAd(adId, patch) {
  const u = requireUser();
  const ref = getDb().collection('ads').doc(adId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Anúncio não encontrado.');
  if (doc.data().sellerUid !== u.uid) throw new Error('Sem permissão.');
  var old=doc.data(),next=Object.assign({},old,patch);
  var changed=['title','desc','cover','gallery','category','subcategory','section','gameName','experienceName','productType','imageFrame'].some(function(key){return JSON.stringify(old[key]||'')!==JSON.stringify(next[key]||'');});
  if(old.status==='pendente'&&!changed&&patch.status&&patch.status!=='pendente')throw new Error('Aguarde a revisão antes de ativar o anúncio.');
  if (changed || (!old.moderationReviewId && patch.status!=='pausado') || old.status==='reprovado') {
    patch=Object.assign({},patch,{moderationRevision:bloxzuhDocId('REV')+'_'+Date.now(),moderationReviewId:'',moderationReason:'',status:'pendente'});
  } else if(old.status==='pendente' && patch.status && patch.status!=='pendente') {
    throw new Error('Aguarde a revisão das imagens antes de ativar o anúncio.');
  }
  await ref.update(patch);
  if(patch.status==='pendente')await requestSavedAdReview(adId);
}

async function fsDeleteAd(adId) {
  const u = requireUser();
  const ref = getDb().collection('ads').doc(adId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Anúncio não encontrado.');
  if (doc.data().sellerUid !== u.uid) throw new Error('Sem permissão.');
  await ref.delete();
}

/** Tempo até liberar saldo: 10 dias */
window.BLOXZUH_RELEASE_MS = 10 * 24 * 60 * 60 * 1000; // 10 dias
window.BLOXZUH_SAQUE_TURBO_FEE = 2.00;
window.BLOXZUH_SAQUE_NORMAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 dias
window.BLOXZUH_SAQUE_TURBO_MS = 30 * 60 * 1000; // 30 minutos

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function fsGetWalletRaw(uid) {
  if (requireUser().uid !== uid) throw new Error('Sem permissão.');
  return fsGetWallet();
}

/** Move itens vencidos de "a liberar" → "disponível" */
async function fsProcessWalletReleases() {
  return fsGetWallet();
}

async function fsGetWallet() {
  return bloxzuhMarketApi('/market/wallet');
}

async function fsSetWallet() {
  throw new Error('Saldos só podem ser alterados pelo serviço financeiro.');
}

/**
 * Sincroniza vendas pagas → saldo a liberar do vendedor logado.
 * Chamado no painel (tempo real ao abrir / a cada X segundos).
 */

/** Aplica estoque/vendas dos pedidos pagos ainda não processados + sincroniza carteira */
async function fsSyncSellerSalesAndWallet() {
  return fsGetWallet();
}

async function fsSyncSellerWallet() {
  return fsGetWallet();
}


async function fsGetLegacySales() {
  const u = requireUser();
  const snap = await getDb().collection('sales')
    .where('sellerUid', '==', u.uid)
    .get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) {
    return (b.createdAtMs || 0) - (a.createdAtMs || 0);
  });
  return list;
}





/** Planos de visibilidade
 *  prata    = só categorias (sem destaque home/busca)
 *  ouro     = destaque na página principal + prioridade nas categorias (sem destaque na busca)
 *  diamante = home + busca + máxima prioridade
 */
function bloxzuhVisRank(v) {
  v = String(v || 'prata').toLowerCase();
  if (v === 'diamante') return 3;
  if (v === 'ouro') return 2;
  return 1;
}
function bloxzuhIsHomeFeatured(ad) {
  var v = String((ad && (ad.visibility || (ad.raw && ad.raw.visibility))) || 'prata').toLowerCase();
  return v === 'diamante' || v === 'ouro';
}
function bloxzuhIsSearchFeatured(ad) {
  var v = String((ad && (ad.visibility || (ad.raw && ad.raw.visibility))) || 'prata').toLowerCase();
  return v === 'diamante';
}
function bloxzuhSortByVisibility(list, secondary) {
  secondary = secondary || function (a, b) {
    return ((b.raw && b.raw.createdAtMs) || b.createdAtMs || 0) - ((a.raw && a.raw.createdAtMs) || a.createdAtMs || 0);
  };
  return (list || []).slice().sort(function (a, b) {
    var d = bloxzuhVisRank(b.visibility || (b.raw && b.raw.visibility)) - bloxzuhVisRank(a.visibility || (a.raw && a.raw.visibility));
    if (d) return d;
    return secondary(a, b);
  });
}
window.bloxzuhVisRank = bloxzuhVisRank;
window.bloxzuhIsHomeFeatured = bloxzuhIsHomeFeatured;
window.bloxzuhIsSearchFeatured = bloxzuhIsSearchFeatured;
window.bloxzuhSortByVisibility = bloxzuhSortByVisibility;

function normalizeAd(id, data) {
  const cat = (data.subcategory || data.category || 'outros').toLowerCase().replace(/\s+/g, '');
  const map = {
    roblox: 'roblox', valorant: 'valorant', freefire: 'freefire', 'freefire': 'freefire',
    'leagueoflegends': 'lol', lol: 'lol', fortnite: 'fortnite', cs2: 'cs2',
    genshinimpact: 'genshin', genshin: 'genshin', premium: 'premium', assinaturas: 'premium'
  };
  let category = map[cat] || map[(data.category || '').toLowerCase()] || 'outros';
  if ((data.category || '').toLowerCase().indexOf('assinat') >= 0 || (data.subcategory || '').toLowerCase().indexOf('assinat') >= 0) category = 'premium';
  return {
    id: id,
    title: data.title || 'Anúncio',
    category: category,
    categoryLabel: data.gameName || data.subcategory || data.category || 'Jogos',
    gameName:data.gameName||'',experienceName:data.experienceName||'',
    price: Number(data.price) || 0,
    seller: data.sellerName || 'Vendedor',
    sellerUid: data.sellerUid || '',
    sellerPhoto: data.sellerPhoto || '',
    rating: (function(){ var r = Number(data.rating); return isNaN(r) ? 5.0 : r; })(),
    ratingCount: (function(){ var n = Number(data.ratingCount); return isNaN(n) ? 0 : n; })(),
    sales: data.sales || 0,
    sold: (function(){ var s = Number(data.sold); if (!isNaN(s)) return s; var v = Number(data.sales); return isNaN(v) ? 0 : v; })(),
    icon: 'fa-gamepad',
    imgClass: 'prod-default',
    cover: data.cover || '',
    description: data.desc || '',
    stock: data.stock || 1,
    visibility: data.visibility || 'prata',
    productType: data.productType || '',
    items: data.items || [],
    raw: data
  };
}

async function fsGetPublicAds(limit) {
  var list = [];
  try {
    var snap = await getDb().collection('ads').where('status', '==', 'ativo').limit(limit || 80).get();
    snap.forEach(function (doc) {
      list.push(normalizeAd(doc.id, doc.data()));
    });
  } catch (e1) {
    console.warn('fsGetPublicAds where status', e1);
    try {
      var snap2 = await getDb().collection('ads').limit(limit || 80).get();
      snap2.forEach(function (doc) {
        var d = doc.data() || {};
        var st = d.status || 'ativo';
        if (st === 'ativo' || st === 'active') list.push(normalizeAd(doc.id, d));
      });
    } catch (e2) {
      console.warn('fsGetPublicAds fallback', e2);
    }
  }
  if (typeof bloxzuhSortByVisibility === 'function') list = bloxzuhSortByVisibility(list);
  else list.sort(function (a, b) {
    return ((b.raw && b.raw.createdAtMs) || 0) - ((a.raw && a.raw.createdAtMs) || 0);
  });
  return list;
}

async function fsGetAdById(id) {
  if (!id) return null;
  id = String(id).trim();
  const doc = await getDb().collection('ads').doc(id).get();
  if (!doc.exists) {
    console.warn('Ad not found:', id);
    return null;
  }
  return normalizeAd(doc.id, doc.data());
}


/** Comprime imagem (File) -> dataURL jpeg pequena */
function compressImageFile(file, maxSide, quality) {
  maxSide = maxSide || 320;
  quality = quality || 0.45;
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        let w = img.width, h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
          else { w = Math.round(w * maxSide / h); h = maxSide; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { reject(new Error('Imagem inválida')); };
      img.src = reader.result;
    };
    reader.onerror = function () { reject(new Error('Falha ao ler arquivo')); };
    reader.readAsDataURL(file);
  });
}

/** Envio de imagens centralizado; a chave do provedor permanece no Worker. */
async function prepareAdCover(file) {
  if (!window.BloxzuhAdImages) throw new Error('Aguarde o carregamento do envio de imagens e tente novamente.');
  return window.BloxzuhAdImages.prepare(file);
}


async function fsGetAdsBySeller(uid, limit) {
  if (!uid) return [];
  // only sellerUid filter (no composite index needed); filter status client-side
  const snap = await getDb().collection('ads')
    .where('sellerUid', '==', uid)
    .where('status', '==', 'ativo')
    .limit(limit || 40)
    .get();
  const list = [];
  snap.forEach(function (doc) {
    const d = doc.data();
    if (d.status && d.status !== 'ativo') return;
    list.push(normalizeAd(doc.id, d));
  });
  list.sort(function (a, b) {
    return ((b.raw && b.raw.createdAtMs) || 0) - ((a.raw && a.raw.createdAtMs) || 0);
  });
  return list;
}

async function fsGetSellerPublic(uid) {
  let profile = { uid: uid, name: 'Vendedor', photo: '', bio: '' };
  try {
    const p = await fsGetProfile(uid);
    if (p) {
      profile.name = p.displayName || p.name || profile.name;
      profile.photo = p.photo || p.photoURL || p.avatar || '';
      profile.bio = p.bio || '';
      profile.memberSinceMs = p.memberSinceMs || p.createdAtMs || null;
      profile.lastSeenMs = p.lastSeenMs || null;
      profile.online = p.online;
      profile.createdAtMs = p.createdAtMs || null;
    }
  } catch (e) {}
  return profile;
}


async function fsSaveProfile(data) {
  const u = requireUser();
  data = data || {};
  const payload = {
    displayName: data.displayName || u.displayName || '',

    email: u.email || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAtMs: Date.now(),
    lastSeenMs: Date.now(),
    online: true
  };
  // Atualizações parciais não apagam foto/biografia já salvas.
  ['photo', 'bio'].forEach(function (field) {
    if (!Object.prototype.hasOwnProperty.call(data, field)) return;
    if (typeof data[field] !== 'string') throw new Error('Valor inválido para ' + field + '.');
    payload[field] = data[field];
  });
  if (Object.prototype.hasOwnProperty.call(data, 'photo')) {
    payload.photoSource = data.photoSource === 'google' ? 'google' : 'custom';
  }
  // memberSinceMs só na primeira vez
  try {
    var prev = await getDb().collection('profiles').doc(u.uid).get();
    if (!prev.exists || !prev.data().memberSinceMs) {
      var created = Date.now();
      try {
        if (u.metadata && u.metadata.creationTime) {
          created = new Date(u.metadata.creationTime).getTime() || created;
        }
      } catch (e) {}
      payload.memberSinceMs = created;
    }
  } catch (e) {}
  // Firestore doc limit ~1MB — keep photo small
  if (payload.photo && payload.photo.length > 900000) {
    throw new Error('Foto muito grande. Use uma imagem menor que 1 MB.');
  }
  await getDb().collection('profiles').doc(u.uid).set(payload, { merge: true });
  // Propaga foto para anúncios ativos (listas leem sellerPhoto)
  if (payload.photo) {
    try {
      var snap = await getDb().collection('ads').where('sellerUid', '==', u.uid).limit(40).get();
      var batch = getDb().batch();
      var n = 0;
      snap.forEach(function (d) {
        if (n < 20) { batch.update(d.ref, { sellerPhoto: payload.photo }); n++; }
      });
      if (n) await batch.commit();
    } catch (e) { console.warn('sellerPhoto on ads', e); }
  }
  return payload;
}

async function fsGetProfile(uid) {
  if (!uid) return null;
  const doc = await getDb().collection('profiles').doc(uid).get();
  if (!doc.exists) return null;
  return Object.assign({ uid: uid }, doc.data());
}


/** Pedidos (estrutura sem gateway) */
function orderCode() {
  var s = Math.random().toString(36).slice(2, 6).toUpperCase();
  var t = Date.now().toString(36).toUpperCase().slice(-4);
  return 'BZ' + s + t;
}

async function fsCreateOrder(ad, extra) {
  requireUser(); extra = extra || {};
  return bloxzuhMarketApi('/market/orders', {adId:ad.id,quantity:extra.quantity || 1,itemIndex:extra.itemIndex == null ? window.__selectedItemIndex : extra.itemIndex});
}

async function fsGetMyPurchases() {
  const u = requireUser();
  const snap = await getDb().collection('orders').where('buyerUid', '==', u.uid).limit(50).get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}

async function fsGetMySales() {
  const u = requireUser();
  const snap = await getDb().collection('orders').where('sellerUid', '==', u.uid).limit(50).get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}

async function fsGetOrder(id) {
  if (!id) return null;
  var doc = await getDb().collection('orders').doc(id).get();
  if (doc.exists) return Object.assign({ id: doc.id }, doc.data());
  // fallback: busca pelo campo code (pedidos antigos com id aleatório)
  try {
    var snap = await getDb().collection('orders').where('code', '==', id).limit(1).get();
    if (!snap.empty) {
      var d = snap.docs[0];
      return Object.assign({ id: d.id }, d.data());
    }
  } catch (e) { console.warn(e); }
  return null;
}

async function fsUpdateOrderStatus(id, status) {
  return bloxzuhMarketApi('/market/status', {orderId:id,status:status});
}


async function fsAddOrderMessage(orderId, text) {
  return bloxzuhMarketApi('/market/message',{orderId:orderId,text:text});
}

async function fsSetOrderPayment(orderId, data) {
  return bloxzuhMarketApi('/market/payment-data', {orderId:orderId,payerName:data.payerName,payerCpf:data.payerCpf,vipPlan:data.vipPlan || 'none'});
}



// Exports globais (garante disponibilidade no checkout)
window.requireUser = requireUser;

/** Baixa estoque + Vendidos assim que o pedido fica pago (qualquer um autenticado com regras) */
async function fsApplyOrderStock() {
  // Estoque é atualizado atomicamente com a confirmação real do Pix no servidor.
}

/** Vendas (entregas concluídas) — só quando status = concluido */
async function fsApplyDeliverySale() {
  // Contadores financeiros não são gravados pelo navegador.
}

window.fsApplyOrderStock = fsApplyOrderStock;
window.fsApplyDeliverySale = fsApplyDeliverySale;
window.fsAddReview = fsAddReview;
window.attachReviewerPhotos = attachReviewerPhotos;
window.fsAddBuyerReview = fsAddBuyerReview;
window.fsGetSellerReviews = fsGetSellerReviews;
window.fsGetAdReviews = fsGetAdReviews;

async function fsAddReview(order, stars, comment) {
  return (await bloxzuhMarketApi('/market/review',{orderId:order.id,stars:stars,comment:comment})).id;
}

async function fsGetAdReviews(adId, limit) {
  if (!adId) return [];
  try {
    var snap = await getDb().collection('reviews').where('adId', '==', adId).limit(limit || 50).get();
    var list = [];
    snap.forEach(function (d) {
      var r = Object.assign({ id: d.id }, d.data());
      // só avaliações do comprador sobre o anúncio/vendedor
      if (r.type && r.type !== 'ad' && r.type !== 'seller') return;
      list.push(r);
    });
    list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
    return list;
  } catch (e) { return []; }
}

/** Avaliações recebidas pelo vendedor (compradores avaliando) */
async function fsGetSellerReviews(sellerUid, limit) {
  if (!sellerUid) return [];
  try {
    var snap = await getDb().collection('reviews').where('sellerUid', '==', sellerUid).limit(limit || 50).get();
    var list = [];
    snap.forEach(function (d) {
      var r = Object.assign({ id: d.id }, d.data());
      if (r.type === 'buyer') return; // skip seller->buyer
      list.push(r);
    });
    list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
    return list;
  } catch (e) { return []; }
}

/** Vendedor avalia o comprador */
async function fsAddBuyerReview(order, stars, comment) {
  return (await bloxzuhMarketApi('/market/review',{orderId:order.id,stars:stars,comment:comment})).id;
}

async function attachReviewerPhotos(list) {
  if (!list || !list.length) return list;
  var cache = {};
  for (var i = 0; i < list.length; i++) {
    var r = list[i];
    var uid = r.buyerUid || r.fromUid || '';
    if (r.buyerPhoto || r.fromPhoto) continue;
    if (!uid) continue;
    if (cache[uid] === undefined) {
      try {
        var p = typeof fsGetProfile === 'function' ? await fsGetProfile(uid) : null;
        cache[uid] = (p && (p.photo || p.photoURL || p.avatar)) || '';
      } catch (e) { cache[uid] = ''; }
    }
    if (cache[uid]) {
      r.buyerPhoto = r.buyerPhoto || cache[uid];
      r.fromPhoto = r.fromPhoto || cache[uid];
    }
  }
  return list;
}


async function fsRequestWithdraw(amount, pixKey, opts) {
  return bloxzuhMarketApi('/market/withdraw', Object.assign({},opts || {},{amount:amount,pixKey:pixKey}));
}

/** Libera saques cujo tempo ja passou (processando -> aprovado) */
async function fsProcessMyWithdrawals() {
  const user = requireUser();
  const snapshots = await Promise.all(['secureWithdrawals','withdrawals'].map(function(collection) {return getDb().collection(collection).where('userId','==',user.uid).limit(50).get();}));
  const list = []; snapshots.forEach(function(snap,index) {snap.forEach(function(doc) {list.push(Object.assign({},doc.data(),{id:doc.id,legacyRecord:index===1}));});});
  return list.sort(function(a,b) {return (b.createdAtMs || 0)-(a.createdAtMs || 0);});
}

async function fsGetMyWithdrawals() {
  return fsProcessMyWithdrawals();
}

window.fsRequestWithdraw = fsRequestWithdraw;
window.fsProcessMyWithdrawals = fsProcessMyWithdrawals;
window.fsGetMyWithdrawals = fsGetMyWithdrawals;


window.fsCreateOrder = fsCreateOrder;
window.fsGetMyPurchases = fsGetMyPurchases;
window.fsGetMySales = fsGetMySales;
window.fsGetOrder = fsGetOrder;
window.fsUpdateOrderStatus = fsUpdateOrderStatus;
window.fsAddOrderMessage = fsAddOrderMessage;
window.fsSetOrderPayment = fsSetOrderPayment;
window.fsGetAdById = fsGetAdById;
window.fsGetPublicAds = fsGetPublicAds;
window.fsGetMyAds = fsGetMyAds;
window.fsCreateAd = fsCreateAd;
window.fsGetAdsBySeller = fsGetAdsBySeller;
window.fsGetSellerPublic = fsGetSellerPublic;
window.fsSaveProfile = fsSaveProfile;
window.fsGetProfile = fsGetProfile;



/** Perguntas do anúncio (Firestore — sincroniza entre celulares) */
async function fsGetAdQuestions(adId) {
  if (!adId) return [];
  var list = [];
  try {
    var snap = await getDb().collection('adQuestions').where('adId', '==', String(adId)).limit(100).get();
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      list.push({
        id: doc.id,
        user: d.user || 'Usuário',
        userUid: d.userUid || d.userId || '',
        userId: d.userId || d.userUid || '',
        userPhoto: d.userPhoto || '',
        text: d.text || '',
        reply: d.reply || '',
        replyName: d.replyName || '',
        replyUid: d.replyUid || '',
        replyPhoto: d.replyPhoto || '',
        createdAtMs: d.createdAtMs || 0,
        repliedAtMs: d.repliedAtMs || 0
      });
    });
  } catch (e) { console.warn('fsGetAdQuestions', e); }
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}
window.fsGetAdQuestions = fsGetAdQuestions;

async function fsAddAdQuestion(adId, data) {
  var u = requireUser();
  adId = String(adId);
  var qid = (typeof bloxzuhDocId === 'function') ? bloxzuhDocId('AQ') : ('AQ' + Date.now().toString(36).toUpperCase());
  var row = {
    adId: adId,
    sellerUid: data.sellerUid || '',
    user: data.user || (u.displayName || 'Usuário'),
    userUid: u.uid,
    userId: u.uid,
    userPhoto: data.userPhoto || '',
    text: BloxzuhContentPolicy.mask(String(data.text || '').slice(0, 1000)),
    reply: '',
    createdAtMs: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await getDb().collection('adQuestions').doc(qid).set(row);
  return Object.assign({ id: qid }, row);
}
window.fsAddAdQuestion = fsAddAdQuestion;

async function fsReplyAdQuestion(qid, data) {
  var u = requireUser();
  if (!qid) throw new Error('Pergunta inválida');
  await getDb().collection('adQuestions').doc(String(qid)).set({
    reply: BloxzuhContentPolicy.mask(String(data.reply || '').slice(0, 2000)),
    replyName: data.replyName || u.displayName || 'Vendedor',
    replyUid: u.uid,
    replyPhoto: data.replyPhoto || '',
    repliedAtMs: Date.now()
  }, { merge: true });
}
window.fsReplyAdQuestion = fsReplyAdQuestion;

function fsListenAdQuestions(adId, onChange) {
  if (!adId || typeof onChange !== 'function') return function () {};
  try {
    return getDb().collection('adQuestions').where('adId', '==', String(adId))
      .onSnapshot(function (snap) {
        var list = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          list.push({
            id: doc.id,
            user: d.user || 'Usuário',
            userUid: d.userUid || d.userId || '',
            userId: d.userId || d.userUid || '',
            userPhoto: d.userPhoto || '',
            text: d.text || '',
            reply: d.reply || '',
            replyName: d.replyName || '',
            replyUid: d.replyUid || '',
            replyPhoto: d.replyPhoto || '',
            createdAtMs: d.createdAtMs || 0,
            repliedAtMs: d.repliedAtMs || 0
          });
        });
        list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
        onChange(list);
      }, function (err) { console.warn('listen questions', err); });
  } catch (e) {
    console.warn(e);
    return function () {};
  }
}
window.fsListenAdQuestions = fsListenAdQuestions;

/** Presença online: ativo se lastSeenMs nos últimos 4 minutos */
function isUserOnline(profileOrMs) {
  var ms = 0;
  if (profileOrMs && typeof profileOrMs === 'object') {
    ms = Number(profileOrMs.lastSeenMs) || 0;
    if (!ms && profileOrMs.lastSeenMs && typeof profileOrMs.lastSeenMs.toMillis === 'function') {
      try { ms = profileOrMs.lastSeenMs.toMillis(); } catch (e) {}
    }
  } else {
    ms = Number(profileOrMs) || 0;
  }
  if (!ms) return false;
  return (Date.now() - ms) < 240000;
}
window.isUserOnline = isUserOnline;

async function fsTouchPresence() {
  try {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return null;
    var u = firebase.auth().currentUser;
    if (!u) return null;
    var ref = firebase.firestore().collection('profiles').doc(u.uid);
    var snap = await ref.get();
    var data = snap.exists ? (snap.data() || {}) : {};
    var created = Date.now();
    try {
      if (u.metadata && u.metadata.creationTime) {
        created = new Date(u.metadata.creationTime).getTime() || created;
      }
    } catch (e) {}
    var patch = {
      lastSeenMs: Date.now(),
      online: true,
      updatedAtMs: Date.now(),
      email: u.email || data.email || '',
      displayName: u.displayName || data.displayName || data.name || (u.email ? u.email.split('@')[0] : '') || 'Usuário'
    };
    // Contas antigas: grava memberSinceMs na primeira visita após o update
    if (!data.memberSinceMs) {
      patch.memberSinceMs = created;
    }
    await ref.set(patch, { merge: true });
    return patch;
  } catch (e) {
    console.warn('[Bloxzuh] presence', e);
    return null;
  }
}
window.fsTouchPresence = fsTouchPresence;

async function fsSetOffline() {
  try {
    if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
    var u = firebase.auth().currentUser;
    if (!u) return;
    await firebase.firestore().collection('profiles').doc(u.uid).set({
      online: false,
      lastSeenMs: Date.now() - 200000,
      updatedAtMs: Date.now()
    }, { merge: true });
  } catch (e) {}
}
window.fsSetOffline = fsSetOffline;

(function startPresenceLoop() {
  var started = false;
  var hideTimer = null;
  function tick() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return;
      if (!firebase.auth().currentUser) return;
      // só atualiza se a aba estiver visível
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      fsTouchPresence();
    } catch (e) {}
  }
  function bind() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(bind, 500);
      return;
    }
    if (started) return;
    started = true;
    firebase.auth().onAuthStateChanged(function (u) {
      if (u) {
        tick();
        if (!window.__bzPresenceTimer) {
          // a cada 20s enquanto o site estiver aberto
          window.__bzPresenceTimer = setInterval(tick, 20000);
        }
      } else if (window.__bzPresenceTimer) {
        clearInterval(window.__bzPresenceTimer);
        window.__bzPresenceTimer = null;
      }
    });
  }
  bind();
  setTimeout(tick, 600);
  setTimeout(tick, 2000);
  setTimeout(tick, 5000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      tick();
    }
    // NÃO marca offline ao minimizar/trocar app no celular.
    // Offline = lastSeenMs parou de atualizar por ~3 min (isUserOnline).
  });
  // pagehide no mobile dispara ao trocar de app — não forçar offline
  // (o timeout de 3 min do isUserOnline já resolve)
})();


window.fsGetWallet = fsGetWallet;
console.log('[Bloxzuh] firestore-db carregado, fsCreateOrder=', typeof fsCreateOrder);

window.fsSyncSellerWallet = fsSyncSellerWallet;
window.fsProcessWalletReleases = fsProcessWalletReleases;
window.fsSyncSellerSalesAndWallet = fsSyncSellerSalesAndWallet;

console.log('[Bloxzuh] firestore-db v-readable-ids-3');


async function trySaquePayout() {
  throw new Error('Transferências são conferidas e processadas pelo administrador.');
}
window.trySaquePayout = trySaquePayout;

async function bloxzuhMarketApi(route, body) {
  const user = requireUser();
  const response = await fetch('https://bloxzuh-pix.hskkaj48.workers.dev' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {'Content-Type':'application/json', Authorization:'Bearer ' + await user.getIdToken()},
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Serviço temporariamente indisponível.');
  return result;
}
window.bloxzuhMarketApi = bloxzuhMarketApi;
