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
    title: data.title,
    category: data.category || '',
    subcategory: data.subcategory || '',
    section: data.section || '',
    productType: data.productType || 'Conta',
    origin: data.origin || '',
    accountInfo: data.accountInfo || '',
    model: data.model || 'normal',
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
    feePercent: data.feePercent || 9.99,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  };
  // ID legível do anúncio, ex: AD7K2M9A3B (nunca usar .add)
  var adId = (typeof bloxzuhDocId === 'function' ? bloxzuhDocId('AD') : ('AD' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).toUpperCase().slice(-4)));
  payload.code = adId;
  await getDb().collection('ads').doc(adId).set(payload);
  console.log('[Bloxzuh] anúncio criado com ID=', adId);
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
window.BLOXZUH_RELEASE_MS = 10 * 24 * 60 * 60 * 1000;

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
  const releaseMs = 10 * 24 * 60 * 60 * 1000;
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
        var sold = (Number(ad.sold) || Number(ad.sales) || 0) + qty; // Vendidos: no pagamento
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
  const releaseMs = 10 * 24 * 60 * 60 * 1000;
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
  if ((data.category || '').toLowerCase().indexOf('assinat') >= 0) category = 'premium';
  return {
    id: id,
    title: data.title || 'Anúncio',
    category: category,
    categoryLabel: data.subcategory || data.category || 'Jogos',
    price: Number(data.price) || 0,
    seller: data.sellerName || 'Vendedor',
    rating: 5.0,
    sales: data.sales || 0,
    sold: (data.sold != null ? data.sold : (data.sales || 0)),
    icon: 'fa-gamepad',
    imgClass: 'prod-default',
    cover: data.cover || '',
    description: data.desc || '',
    stock: data.stock || 1,
    visibility: data.visibility || 'prata',
    productType: data.productType || '',
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
      profile.photo = p.photo || p.photoURL || '';
      profile.bio = p.bio || '';
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
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  // Firestore doc limit ~1MB — keep photo small
  if (payload.photo && payload.photo.length > 900000) {
    throw new Error('Foto muito grande. Use uma imagem menor que 1 MB.');
  }
  await getDb().collection('profiles').doc(u.uid).set(payload, { merge: true });
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
    adTitle: ad.title || '',
    adCover: ad.cover || '',
    price: price,
    quantity: (extra && extra.quantity) || 1,
    total: price * ((extra && extra.quantity) || 1),
    status: 'aguardando_pagamento', // aguardando_pagamento | pago | em_entrega | concluido | cancelado | expirado
    buyerUid: u.uid,
    buyerName: u.displayName || localStorage.getItem('xinzuh-username') || 'Comprador',
    buyerEmail: u.email || '',
    sellerUid: sellerUid,
    sellerName: ad.seller || 'Vendedor',
    category: ad.category || '',
    note: (extra && extra.note) || '',
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
    var stock = Math.max(0, (Number(ad.stock) || 0) - qty);
    var sold = (Number(ad.sold) != null ? Number(ad.sold) : (Number(ad.sales) || 0)) + qty;
    var patch = { stock: stock, sold: sold, updatedAtMs: Date.now() };
    if (stock <= 0) patch.status = 'pausado';
    await aref.update(patch);
    await getDb().collection('orders').doc(order.id).update({ stockApplied: true });
    console.log('[Bloxzuh] estoque/vendidos atualizados ad=', order.adId, 'stock=', stock, 'sold=', sold);
  } catch (e) {
    console.warn('fsApplyOrderStock', e);
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
window.fsGetWallet = fsGetWallet;
console.log('[Bloxzuh] firestore-db carregado, fsCreateOrder=', typeof fsCreateOrder);

window.fsSyncSellerWallet = fsSyncSellerWallet;
window.fsProcessWalletReleases = fsProcessWalletReleases;
window.fsSyncSellerSalesAndWallet = fsSyncSellerSalesAndWallet;

console.log('[Bloxzuh] firestore-db v-readable-ids-3');
