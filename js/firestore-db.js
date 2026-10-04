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

async function fsCreateAd(data) {
  const u = requireUser();
  const payload = {
    sellerUid: u.uid,
    sellerName: u.displayName || (u.email ? u.email.split('@')[0] : 'Vendedor'),
    sellerPhoto: data.sellerPhoto || '',
    title: data.title,
    category: data.category || '',
    subcategory: data.subcategory || '',
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
    status: 'ativo',
    sales: 0,
    sold: 0,
    feePercent: data.feePercent || 9.99,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  };
  // ID legível do anúncio, ex: AD7K2M9A3B (nunca usar .add)
  var adId = (typeof bloxzuhDocId === 'function' ? bloxzuhDocId('AD') : ('AD' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).toUpperCase().slice(-4)));
  payload.code = adId;
  await getDb().collection('ads').doc(adId).set(payload);
  console.log('[Bloxzuh] anúncio criado com ID=', adId, 'model=', payload.model, 'items=', (payload.items||[]).length);
  return adId;
}

async function fsUpdateAd(adId, patch) {
  const u = requireUser();
  const ref = getDb().collection('ads').doc(adId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Anúncio não encontrado.');
  if (doc.data().sellerUid !== u.uid) throw new Error('Sem permissão.');
  await ref.update(patch);
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
window.BLOXZUH_RELEASE_MS = 2 * 60 * 1000; // teste: 2 min (prod: 10 dias)
window.BLOXZUH_SAQUE_TURBO_FEE = 2.00;
window.BLOXZUH_SAQUE_NORMAL_MS = 2 * 60 * 1000;
window.BLOXZUH_SAQUE_TURBO_MS = 30 * 1000;

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function fsGetWalletRaw(uid) {
  const doc = await getDb().collection('wallets').doc(uid).get();
  if (!doc.exists) {
    return { saldo: 0, pending: 0, pendingItems: [], withdrawn: 0 };
  }
  const d = doc.data();
  return {
    saldo: Number(d.saldo) || 0,
    pending: Number(d.pending) || 0,
    pendingItems: Array.isArray(d.pendingItems) ? d.pendingItems : [],
    withdrawn: Number(d.withdrawn) || 0
  };
}

/** Move itens vencidos de "a liberar" → "disponível" */
async function fsProcessWalletReleases(uid) {
  const w = await fsGetWalletRaw(uid);
  const now = Date.now();
  let moved = 0;
  const items = (w.pendingItems || []).map(function (it) {
    if (!it.released && it.releaseAtMs && it.releaseAtMs <= now) {
      moved = round2(moved + (Number(it.amount) || 0));
      return Object.assign({}, it, { released: true, releasedAtMs: now });
    }
    return it;
  });
  if (moved > 0) {
    const saldo = round2(w.saldo + moved);
    const pending = round2(items.filter(function (it) { return !it.released; })
      .reduce(function (s, it) { return s + (Number(it.amount) || 0); }, 0));
    await getDb().collection('wallets').doc(uid).set({
      saldo: saldo,
      pending: pending,
      pendingItems: items,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return { saldo: saldo, pending: pending, pendingItems: items, withdrawn: w.withdrawn, moved: moved };
  }
  const pending = round2(items.filter(function (it) { return !it.released; })
    .reduce(function (s, it) { return s + (Number(it.amount) || 0); }, 0));
  // keep pending in sync
  if (pending !== w.pending) {
    await getDb().collection('wallets').doc(uid).set({ pending: pending, pendingItems: items }, { merge: true });
  }
  return { saldo: w.saldo, pending: pending, pendingItems: items, withdrawn: w.withdrawn, moved: 0 };
}

async function fsGetWallet() {
  const u = requireUser();
  // processa liberações vencidas
  return await fsProcessWalletReleases(u.uid);
}

async function fsSetWallet(saldo, pending) {
  const u = requireUser();
  await getDb().collection('wallets').doc(u.uid).set({
    saldo: Number(saldo) || 0,
    pending: Number(pending) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

/**
 * Sincroniza vendas pagas → saldo a liberar do vendedor logado.
 * Chamado no painel (tempo real ao abrir / a cada X segundos).
 */

/** Aplica estoque/vendas dos pedidos pagos ainda não processados + sincroniza carteira */
async function fsSyncSellerSalesAndWallet() {
  const u = requireUser();
  const releaseMs = window.BLOXZUH_RELEASE_MS || (2 * 60 * 1000);
  let snap;
  try {
    snap = await getDb().collection('orders').where('sellerUid', '==', u.uid).limit(80).get();
  } catch (e) {
    console.warn('orders query', e);
    // fallback: get all and filter (if rules allow)
    snap = await getDb().collection('orders').limit(80).get();
  }

  const orders = [];
  snap.forEach(function (doc) {
    const o = Object.assign({ id: doc.id }, doc.data());
    if (o.sellerUid === u.uid) orders.push(o);
  });

  // 1) Estoque + vendas por anúncio
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var st = o.status || '';
    if (st !== 'pago' && st !== 'em_entrega' && st !== 'concluido') continue;
    if (o.stockApplied) continue;
    if (!o.adId) {
      try { await getDb().collection('orders').doc(o.id).update({ stockApplied: true }); } catch (e) {}
      continue;
    }
    try {
      var aref = getDb().collection('ads').doc(o.adId);
      var adoc = await aref.get();
      if (adoc.exists && adoc.data().sellerUid === u.uid) {
        var ad = adoc.data();
        var qty = Number(o.quantity) || 1;
        var stock = Math.max(0, (Number(ad.stock) || 0) - qty);
        var prevSold = Number(ad.sold); if (isNaN(prevSold)) prevSold = Number(ad.sales) || 0; var sold = prevSold + qty; // Vendidos no pagamento
        var patch = { stock: stock, sold: sold, updatedAtMs: Date.now() };
        // NÃO incrementa sales (Vendas) aqui — só na entrega confirmada
        if (stock <= 0) patch.status = 'pausado';
        await aref.update(patch);
      }
      await getDb().collection('orders').doc(o.id).update({ stockApplied: true });
    } catch (e) {
      console.warn('stock apply', o.id, e);
    }
  }

  // 2) Carteira
  return await fsSyncSellerWallet();
}

async function fsSyncSellerWallet() {
  const u = requireUser();
  const releaseMs = window.BLOXZUH_RELEASE_MS || (2 * 60 * 1000);
  const snap = await getDb().collection('orders')
    .where('sellerUid', '==', u.uid)
    .limit(50)
    .get();

  let w = await fsGetWalletRaw(u.uid);
  let items = (w.pendingItems || []).slice();
  let changed = false;
  const existingIds = {};
  items.forEach(function (it) { if (it.orderId) existingIds[it.orderId] = true; });

  const batchMarks = [];
  snap.forEach(function (doc) {
    const o = doc.data();
    const st = o.status || '';
    if (st !== 'pago' && st !== 'em_entrega' && st !== 'concluido') return;
    if (o.sellerWalletApplied) return;
    if (existingIds[doc.id]) return;

    const gross = Number(o.total != null ? o.total : o.price) || 0;
    const feePct = Number(o.feePercent) || 9.99;
    const net = round2(gross * (1 - feePct / 100));
    if (net <= 0) return;

    const paidAt = Number(o.paidAtMs) || Number(o.updatedAtMs) || Date.now();
    items.push({
      orderId: doc.id,
      code: o.code || '',
      amount: net,
      gross: gross,
      feePercent: feePct,
      releaseAtMs: paidAt + releaseMs,
      released: false,
      createdAtMs: Date.now()
    });
    existingIds[doc.id] = true;
    batchMarks.push(doc.id);
    changed = true;
  });

  if (changed) {
    const pending = round2(items.filter(function (it) { return !it.released; })
      .reduce(function (s, it) { return s + (Number(it.amount) || 0); }, 0));
    await getDb().collection('wallets').doc(u.uid).set({
      saldo: w.saldo,
      pending: pending,
      pendingItems: items,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    // marca pedidos para não creditar 2x
    for (var i = 0; i < batchMarks.length; i++) {
      try {
        await getDb().collection('orders').doc(batchMarks[i]).update({
          sellerWalletApplied: true,
          sellerNet: items.filter(function (it) { return it.orderId === batchMarks[i]; })[0].amount
        });
      } catch (e) { console.warn('mark order wallet', e); }
    }
  }

  return await fsProcessWalletReleases(u.uid);
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
    categoryLabel: data.subcategory || data.category || 'Jogos',
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
  const snap = await getDb().collection('ads').where('status', '==', 'ativo').limit(limit || 40).get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(normalizeAd(doc.id, doc.data()));
  });
  list.sort(function (a, b) { return (b.raw && b.raw.createdAtMs || 0) - (a.raw && a.raw.createdAtMs || 0); });
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

/**
 * Prepara capa para gravar no anúncio.
 * 1) Comprime forte
 * 2) Se houver chave ImgBB (localStorage bloxzuh-imgbb-key), envia e retorna URL https
 * 3) Senão grava dataURL pequena no Firestore
 */
async function prepareAdCover(file) {
  if (!file) return '';
  let dataUrl = await compressImageFile(file, 320, 0.42);
  if (dataUrl.length > 220000) {
    dataUrl = await compressImageFile(file, 240, 0.32);
  }
  if (dataUrl.length > 220000) {
    dataUrl = await compressImageFile(file, 180, 0.28);
  }

  const imgbbKey = localStorage.getItem('bloxzuh-imgbb-key') || window.IMGBB_API_KEY || '';
  if (imgbbKey) {
    try {
      const b64 = dataUrl.split(',')[1] || '';
      const body = new FormData();
      body.append('image', b64);
      const res = await fetch('https://api.imgbb.com/1/upload?key=' + encodeURIComponent(imgbbKey), {
        method: 'POST',
        body: body
      });
      const json = await res.json();
      if (json && json.success && json.data && json.data.url) {
        return json.data.url;
      }
      console.warn('ImgBB', json);
    } catch (e) {
      console.warn('ImgBB falhou, usando dataURL', e);
    }
  }

  // Firestore: evita documento gigante
  if (dataUrl.length > 250000) {
    console.warn('Capa ainda grande:', dataUrl.length);
    return dataUrl.substring(0, 0);
  }
  return dataUrl;
}


async function fsGetAdsBySeller(uid, limit) {
  if (!uid) return [];
  // only sellerUid filter (no composite index needed); filter status client-side
  const snap = await getDb().collection('ads')
    .where('sellerUid', '==', uid)
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
  const payload = {
    displayName: data.displayName || u.displayName || '',
    photo: data.photo || '',
    bio: data.bio || '',
    email: u.email || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAtMs: Date.now(),
    lastSeenMs: Date.now(),
    online: true
  };
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
  const u = requireUser();
  if (!ad || !ad.id) throw new Error('Anúncio inválido.');
  const sellerUid = (ad.raw && ad.raw.sellerUid) || ad.sellerUid || '';
  if (!sellerUid) throw new Error('Vendedor não encontrado.');
  if (sellerUid === u.uid) throw new Error('Você não pode comprar o próprio anúncio.');

  const price = Number(ad.price) || 0;
  // ID do documento = código do pedido (ex: BZB8EQR6)
  // NÃO faz .get() antes: regra do Firestore bloqueia leitura de doc inexistente
  const code = orderCode();
  const ref = getDb().collection('orders').doc(code);
  const payload = {
    code: code,
    adId: ad.id,
    adTitle: (ad.title || '') + ((extra && extra.itemName) ? (' — ' + extra.itemName) : ((window.__selectedItemName) ? (' — ' + window.__selectedItemName) : '')),
    adCover: ad.cover || '',
    price: price,
    quantity: (extra && extra.quantity) || 1,
    total: price * ((extra && extra.quantity) || 1),
    status: 'aguardando_pagamento',
    buyerUid: u.uid,
    buyerName: u.displayName || localStorage.getItem('xinzuh-username') || 'Comprador',
    buyerEmail: u.email || '',
    sellerUid: sellerUid,
    sellerName: ad.seller || 'Vendedor',
    category: ad.category || '',
    note: (extra && extra.note) || '',
    itemIndex: (extra && extra.itemIndex != null) ? Number(extra.itemIndex) : (window.__selectedItemIndex != null ? Number(window.__selectedItemIndex) : null),
    itemName: (extra && extra.itemName) || (window.__selectedItemName) || '',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
    updatedAtMs: Date.now()
  };
  await ref.set(payload);
  console.log('[Bloxzuh] pedido criado com ID=', code);
  return Object.assign({ id: code }, payload);
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
  const u = requireUser();
  const order = await fsGetOrder(id);
  if (!order) throw new Error('Pedido não encontrado.');
  if (order.buyerUid !== u.uid && order.sellerUid !== u.uid) {
    throw new Error('Sem permissão.');
  }
  await getDb().collection('orders').doc(id).update({
    status: status,
    updatedAtMs: Date.now()
  });
  return true;
}


async function fsAddOrderMessage(orderId, text) {
  const u = requireUser();
  const order = await fsGetOrder(orderId);
  if (!order) throw new Error('Pedido não encontrado.');
  if (order.buyerUid !== u.uid && order.sellerUid !== u.uid) {
    throw new Error('Sem permissão.');
  }
  const msg = {
    id: 'm' + Date.now(),
    text: String(text || '').slice(0, 2000),
    senderUid: u.uid,
    senderName: u.displayName || localStorage.getItem('xinzuh-username') || 'Usuário',
    createdAtMs: Date.now()
  };
  const messages = Array.isArray(order.messages) ? order.messages.slice() : [];
  messages.push(msg);
  await getDb().collection('orders').doc(orderId).update({
    messages: messages,
    updatedAtMs: Date.now()
  });
  // notify the other party
  try {
    const other = u.uid === order.buyerUid ? order.sellerUid : order.buyerUid;
    if (other && typeof fsAddNotification === 'function') {
      fsAddNotification(other, {
        type: 'venda',
        title: 'Mensagem no pedido #' + (order.code || ''),
        body: msg.text.slice(0, 120),
        link: 'pedido.html?id=' + encodeURIComponent(orderId),
        createdAtMs: Date.now()
      });
    }
  } catch (e) {}
  return msg;
}

async function fsSetOrderPayment(orderId, data) {
  const u = requireUser();
  const order = await fsGetOrder(orderId);
  if (!order) throw new Error('Pedido não encontrado.');
  if (order.buyerUid !== u.uid) throw new Error('Só o comprador pode pagar.');
  const patch = {
    paymentMethod: data.method || 'pix',
    payerName: data.payerName || '',
    payerCpf: data.payerCpf || '',
    vipPlan: data.vipPlan || 'none',
    total: data.total != null ? Number(data.total) : order.total,
    status: 'aguardando_pagamento',
    paymentId: 'PAY' + Date.now().toString().slice(-8),
    paymentExpiresAtMs: Date.now() + 20 * 60 * 1000,
    // placeholder copia-cola (estrutura — gateway real depois)
    pixCopyPaste: data.pixCopyPaste || ('00020126BLOXZUH' + (order.code || '') + 'VAL' + String(order.total || 0).replace('.', '')),
    updatedAtMs: Date.now()
  };
  await getDb().collection('orders').doc(orderId).update(patch);
  return Object.assign(order, patch);
}



// Exports globais (garante disponibilidade no checkout)
window.requireUser = requireUser;

/** Baixa estoque + Vendidos assim que o pedido fica pago (qualquer um autenticado com regras) */
async function fsApplyOrderStock(order) {
  if (!order || !order.adId) return;
  if (order.stockApplied) return;
  try {
    var aref = getDb().collection('ads').doc(order.adId);
    var adoc = await aref.get();
    if (!adoc.exists) {
      await getDb().collection('orders').doc(order.id).update({ stockApplied: true });
      return;
    }
    var ad = adoc.data();
    var qty = Number(order.quantity) || 1;
    var items = Array.isArray(ad.items) ? ad.items.slice() : [];
    var itemIndex = (order.itemIndex != null ? Number(order.itemIndex) : (order.selectedItemIndex != null ? Number(order.selectedItemIndex) : -1));
    // Dinâmico: baixa só o item escolhido
    if (String(ad.model || '').toLowerCase() === 'dinamico' && items.length && itemIndex >= 0 && items[itemIndex]) {
      var it = Object.assign({}, items[itemIndex]);
      it.stock = Math.max(0, (Number(it.stock) || 0) - qty);
      items[itemIndex] = it;
      var sumStock = 0;
      items.forEach(function (x) { sumStock += Math.max(0, Number(x.stock) || 0); });
      var prevSold = Number(ad.sold); if (isNaN(prevSold)) prevSold = Number(ad.sales) || 0;
      var patch = {
        items: items,
        stock: sumStock,
        sold: prevSold + qty,
        updatedAtMs: Date.now()
      };
      // só pausa o anúncio inteiro se TODOS os itens zeram
      if (sumStock <= 0) patch.status = 'pausado';
      await aref.update(patch);
    } else {
      var stock = Math.max(0, (Number(ad.stock) || 0) - qty);
      var prevSold2 = Number(ad.sold); if (isNaN(prevSold2)) prevSold2 = Number(ad.sales) || 0;
      var patch2 = { stock: stock, sold: prevSold2 + qty, updatedAtMs: Date.now() };
      if (stock <= 0) patch2.status = 'pausado';
      await aref.update(patch2);
    }
    await getDb().collection('orders').doc(order.id).update({ stockApplied: true });
    console.log('[Bloxzuh] estoque/vendidos atualizados ad=', order.adId, 'item=', itemIndex);
  } catch (e) {
    console.warn('fsApplyOrderStock', e && e.message, e);
  }
}

/** Vendas (entregas concluídas) — só quando status = concluido */
async function fsApplyDeliverySale(order) {
  if (!order || !order.adId) return;
  if (order.saleCounted) return;
  try {
    var aref = getDb().collection('ads').doc(order.adId);
    var adoc = await aref.get();
    if (!adoc.exists) {
      await getDb().collection('orders').doc(order.id).update({ saleCounted: true });
      return;
    }
    var ad = adoc.data();
    var qty = Number(order.quantity) || 1;
    var sales = (Number(ad.sales) || 0) + qty;
    await aref.update({ sales: sales, updatedAtMs: Date.now() });
    await getDb().collection('orders').doc(order.id).update({ saleCounted: true });
    console.log('[Bloxzuh] vendas +1 ad=', order.adId, 'sales=', sales);
  } catch (e) {
    console.warn('fsApplyDeliverySale', e);
  }
}

window.fsApplyOrderStock = fsApplyOrderStock;
window.fsApplyDeliverySale = fsApplyDeliverySale;
window.fsAddReview = fsAddReview;
window.attachReviewerPhotos = attachReviewerPhotos;
window.fsAddBuyerReview = fsAddBuyerReview;
window.fsGetSellerReviews = fsGetSellerReviews;
window.fsGetAdReviews = fsGetAdReviews;

async function fsAddReview(order, stars, comment) {
  const u = requireUser();
  if (!order || !order.id) throw new Error('Pedido inválido.');
  if (order.buyerUid !== u.uid) throw new Error('Só o comprador pode avaliar.');
  if (order.status !== 'concluido') throw new Error('Avalie após a entrega confirmada.');
  if (order.reviewed) throw new Error('Você já avaliou este pedido.');
  stars = Math.min(5, Math.max(1, parseInt(stars, 10) || 5));
  comment = String(comment || '').slice(0, 500);
  var rid = (typeof bloxzuhDocId === 'function') ? bloxzuhDocId('RV') : ('RV' + Date.now().toString(36).toUpperCase());
  var buyerName = u.displayName || localStorage.getItem('xinzuh-username') || (u.email ? u.email.split('@')[0] : 'Comprador');
  var buyerPhoto = '';
  try {
    buyerPhoto = localStorage.getItem('xinzuh-photo-' + u.uid) || localStorage.getItem('xinzuh-photo') || '';
    if (typeof fsGetProfile === 'function') {
      var bp = await fsGetProfile(u.uid);
      if (bp && (bp.photo || bp.photoURL)) buyerPhoto = bp.photo || bp.photoURL;
    }
  } catch (e) {}
  await getDb().collection('reviews').doc(rid).set({
    type: 'ad',
    orderId: order.id,
    adId: order.adId || '',
    adTitle: order.adTitle || '',
    itemName: order.itemName || '',
    sellerUid: order.sellerUid || '',
    buyerUid: u.uid,
    buyerName: buyerName,
    buyerPhoto: buyerPhoto,
    fromUid: u.uid,
    fromName: buyerName,
    fromPhoto: buyerPhoto,
    stars: stars,
    comment: comment,
    createdAtMs: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await getDb().collection('orders').doc(order.id).update({
    reviewed: true,
    reviewStars: stars,
    reviewComment: comment,
    updatedAtMs: Date.now()
  });
  // média do anúncio
  if (order.adId) {
    try {
      var snap = await getDb().collection('reviews').where('adId', '==', order.adId).limit(200).get();
      var sum = 0, n = 0;
      snap.forEach(function (d) { sum += Number(d.data().stars) || 0; n++; });
      if (n > 0) {
        await getDb().collection('ads').doc(order.adId).update({
          rating: Math.round((sum / n) * 10) / 10,
          ratingCount: n,
          updatedAtMs: Date.now()
        });
      }
    } catch (e) { console.warn('ad rating', e); }
  }
  // média do vendedor no perfil
  if (order.sellerUid) {
    try {
      var snap2 = await getDb().collection('reviews').where('sellerUid', '==', order.sellerUid).limit(200).get();
      var sum2 = 0, n2 = 0;
      snap2.forEach(function (d) { sum2 += Number(d.data().stars) || 0; n2++; });
      if (n2 > 0) {
        await getDb().collection('profiles').doc(order.sellerUid).set({
          rating: Math.round((sum2 / n2) * 10) / 10,
          ratingCount: n2,
          updatedAtMs: Date.now()
        }, { merge: true });
      }
    } catch (e) { console.warn('seller rating', e); }
  }
  // notifica vendedor
  try {
    if (typeof fsAddNotification === 'function' && order.sellerUid) {
      await fsAddNotification(order.sellerUid, {
        type: 'review',
        title: 'Nova avaliação ' + stars + '★',
        body: buyerName + (order.itemName ? (' · ' + order.itemName) : '') + (comment ? (': ' + comment.slice(0, 80)) : ''),
        link: order.adId ? ('anuncio.html?id=' + encodeURIComponent(order.adId)) : 'painel.html',
        createdAtMs: Date.now()
      });
    }
  } catch (e) {}
  return rid;
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
  const u = requireUser();
  if (!order || !order.id) throw new Error('Pedido inválido.');
  if (order.sellerUid !== u.uid) throw new Error('Só o vendedor pode avaliar o comprador.');
  if (order.status !== 'concluido') throw new Error('Avalie após a entrega concluída.');
  if (order.buyerReviewed) throw new Error('Você já avaliou este comprador.');
  stars = Math.min(5, Math.max(1, parseInt(stars, 10) || 5));
  comment = String(comment || '').slice(0, 500);
  var rid = (typeof bloxzuhDocId === 'function') ? bloxzuhDocId('RB') : ('RB' + Date.now().toString(36).toUpperCase());
  var fromName = u.displayName || localStorage.getItem('xinzuh-username') || 'Vendedor';
  var fromPhoto = '';
  try {
    fromPhoto = localStorage.getItem('xinzuh-photo-' + u.uid) || localStorage.getItem('xinzuh-photo') || '';
    if (typeof fsGetProfile === 'function') {
      var pr = await fsGetProfile(u.uid);
      if (pr && (pr.photo || pr.photoURL)) fromPhoto = pr.photo || pr.photoURL;
    }
  } catch (e) {}
  await getDb().collection('reviews').doc(rid).set({
    type: 'buyer',
    orderId: order.id,
    adId: order.adId || '',
    adTitle: order.adTitle || '',
    itemName: order.itemName || '',
    sellerUid: order.sellerUid || '',
    buyerUid: order.buyerUid || '',
    fromUid: u.uid,
    fromName: fromName,
    fromPhoto: fromPhoto,
    toUid: order.buyerUid || '',
    buyerName: order.buyerName || 'Comprador',
    stars: stars,
    comment: comment,
    createdAtMs: Date.now(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await getDb().collection('orders').doc(order.id).update({
    buyerReviewed: true,
    buyerReviewStars: stars,
    buyerReviewComment: comment,
    updatedAtMs: Date.now()
  });
  // (média do comprador fica só nas reviews; perfil do comprador só ele mesmo pode escrever)

  try {
    if (typeof fsAddNotification === 'function' && order.buyerUid) {
      await fsAddNotification(order.buyerUid, {
        type: 'review',
        title: 'O vendedor te avaliou ' + stars + '★',
        body: fromName + (comment ? (': ' + comment.slice(0, 80)) : ''),
        link: 'pedido.html?id=' + encodeURIComponent(order.id),
        createdAtMs: Date.now()
      });
    }
  } catch (e) {}
  return rid;
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
  const u = requireUser();
  opts = opts || {};
  amount = Number(amount) || 0;
  if (amount < 1) throw new Error('Valor minimo de saque: R$ 1.');
  pixKey = String(pixKey || '').trim();
  if (!pixKey) throw new Error('Informe a chave Pix.');
  var mode = (opts.mode === 'turbo') ? 'turbo' : 'normal';
  // TESTE: normal 2 min, turbo 30s. Producao: normal ~2 dias uteis, turbo 30 min
  var NORMAL_MS = (typeof window.BLOXZUH_SAQUE_NORMAL_MS === 'number') ? window.BLOXZUH_SAQUE_NORMAL_MS : (2 * 60 * 1000);
  var TURBO_MS = (typeof window.BLOXZUH_SAQUE_TURBO_MS === 'number') ? window.BLOXZUH_SAQUE_TURBO_MS : (30 * 1000);
  var TURBO_FEE = (typeof window.BLOXZUH_SAQUE_TURBO_FEE === 'number') ? window.BLOXZUH_SAQUE_TURBO_FEE : 2.00;
  var fee = mode === 'turbo' ? TURBO_FEE : 0;
  var delayMs = mode === 'turbo' ? TURBO_MS : NORMAL_MS;
  var totalDebit = Math.round((amount + fee) * 100) / 100;

  var wref = getDb().collection('wallets').doc(u.uid);
  var wdoc = await wref.get();
  var saldo = wdoc.exists ? (Number(wdoc.data().saldo) || 0) : 0;
  if (totalDebit > saldo) throw new Error('Saldo disponivel insuficiente' + (fee ? ' (valor + taxa turbo R$ ' + fee.toFixed(2).replace('.',',') + ')' : '') + '.');

  var wid = (typeof bloxzuhDocId === 'function') ? bloxzuhDocId('WD') : ('WD' + Date.now().toString(36).toUpperCase());
  var now = Date.now();
  await getDb().collection('withdrawals').doc(wid).set({
    userId: u.uid,
    userName: u.displayName || opts.holderName || '',
    userEmail: u.email || '',
    holderName: opts.holderName || u.displayName || '',
    holderCpf: opts.cpf || '',
    pixType: opts.pixType || 'cpf',
    amount: Math.round(amount * 100) / 100,
    fee: fee,
    mode: mode,
    pixKey: pixKey,
    status: 'processando',
    availableAtMs: now + delayMs,
    createdAtMs: now,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await wref.set({
    saldo: Math.round((saldo - totalDebit) * 100) / 100,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { id: wid, availableAtMs: now + delayMs, mode: mode, fee: fee };
}

/** Libera saques cujo tempo ja passou (processando -> aprovado) */
async function fsProcessMyWithdrawals() {
  const u = requireUser();
  var snap = await getDb().collection('withdrawals').where('userId', '==', u.uid).limit(50).get();
  var now = Date.now();
  var list = [];
  var updates = [];
  snap.forEach(function (d) {
    var w = Object.assign({ id: d.id }, d.data());
    if (w.status === 'processando' && w.availableAtMs && w.availableAtMs <= now) {
      updates.push(getDb().collection('withdrawals').doc(d.id).update({
        status: 'aprovado',
        paidAtMs: now,
        updatedAtMs: now
      }));
      w.status = 'aprovado';
      w.paidAtMs = now;
    }
    list.push(w);
  });
  if (updates.length) await Promise.all(updates);
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
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

/** Presença online: ativo se lastSeenMs < 2 min */
function isUserOnline(profileOrMs) {
  var ms = 0;
  if (profileOrMs && typeof profileOrMs === 'object') {
    ms = Number(profileOrMs.lastSeenMs) || 0;
  } else {
    ms = Number(profileOrMs) || 0;
  }
  if (!ms) return false;
  return (Date.now() - ms) < 120000;
}
window.isUserOnline = isUserOnline;

async function fsTouchPresence() {
  try {
    var u = firebase.auth().currentUser;
    if (!u) return;
    var ref = getDb().collection('profiles').doc(u.uid);
    var snap = await ref.get();
    var patch = {
      lastSeenMs: Date.now(),
      online: true,
      updatedAtMs: Date.now(),
      email: u.email || '',
      displayName: u.displayName || ''
    };
    if (!snap.exists || !(snap.data() && snap.data().memberSinceMs)) {
      var created = Date.now();
      try {
        if (u.metadata && u.metadata.creationTime) {
          created = new Date(u.metadata.creationTime).getTime() || created;
        }
      } catch (e) {}
      patch.memberSinceMs = created;
    }
    await ref.set(patch, { merge: true });
  } catch (e) { console.warn('presence', e); }
}
window.fsTouchPresence = fsTouchPresence;

async function fsSetOffline() {
  try {
    var u = firebase.auth().currentUser;
    if (!u) return;
    await getDb().collection('profiles').doc(u.uid).set({
      online: false,
      lastSeenMs: Date.now() - 180000,
      updatedAtMs: Date.now()
    }, { merge: true });
  } catch (e) {}
}
window.fsSetOffline = fsSetOffline;

(function startPresenceLoop() {
  function tick() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth) return;
      if (!firebase.auth().currentUser) return;
      if (typeof fsTouchPresence === 'function') fsTouchPresence();
    } catch (e) {}
  }
  function bind() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(bind, 400);
      return;
    }
    firebase.auth().onAuthStateChanged(function (u) {
      if (u) {
        tick();
        if (!window.__bzPresenceTimer) {
          window.__bzPresenceTimer = setInterval(tick, 30000);
        }
      } else if (window.__bzPresenceTimer) {
        clearInterval(window.__bzPresenceTimer);
        window.__bzPresenceTimer = null;
      }
    });
  }
  bind();
  window.addEventListener('beforeunload', function () {
    try {
      var u = firebase.auth().currentUser;
      if (!u || !firebase.firestore) return;
      firebase.firestore().collection('profiles').doc(u.uid).set({
        online: false,
        lastSeenMs: Date.now() - 180000,
        updatedAtMs: Date.now()
      }, { merge: true });
    } catch (e) {}
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') tick();
  });
  // primeiro tick atrasado (firebase pronto)
  setTimeout(tick, 1500);
  setTimeout(tick, 4000);
})();

window.fsGetWallet = fsGetWallet;
console.log('[Bloxzuh] firestore-db carregado, fsCreateOrder=', typeof fsCreateOrder);

window.fsSyncSellerWallet = fsSyncSellerWallet;
window.fsProcessWalletReleases = fsProcessWalletReleases;
window.fsSyncSellerSalesAndWallet = fsSyncSellerSalesAndWallet;

console.log('[Bloxzuh] firestore-db v-readable-ids-3');


async function trySaquePayout(w) {
  var url = window.BLOXZUH_SAQUE_WORKER_URL || window.MP_WORKER_URL || '';
  if (!url || !w) return null;
  try {
    var res = await fetch(String(url).replace(/\/$/, '') + '/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        withdrawalId: w.id,
        amount: w.amount,
        pixKey: w.pixKey,
        pixType: w.pixType || 'cpf',
        holderName: w.holderName || '',
        holderCpf: w.holderCpf || '',
        email: w.userEmail || ''
      })
    });
    return await res.json();
  } catch (e) {
    console.warn('payout', e);
    return { ok: false, status: 'pending_manual' };
  }
}
window.trySaquePayout = trySaquePayout;
