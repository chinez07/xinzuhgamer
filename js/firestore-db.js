// Firestore helpers - Bloxzuh
// Requires: firebase-app, firebase-auth, firebase-firestore already loaded

const db = firebase.firestore();

function requireUser() {
  const u = firebase.auth().currentUser;
  if (!u) throw new Error('Faça login primeiro.');
  return u;
}

/** Anúncios do vendedor logado */
async function fsGetMyAds() {
  const u = requireUser();
  const snap = await db.collection('ads')
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
  const ref = await db.collection('ads').add(payload);
  return ref.id;
}

async function fsUpdateAd(adId, patch) {
  const u = requireUser();
  const ref = db.collection('ads').doc(adId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Anúncio não encontrado.');
  if (doc.data().sellerUid !== u.uid) throw new Error('Sem permissão.');
  await ref.update(patch);
}

async function fsDeleteAd(adId) {
  const u = requireUser();
  const ref = db.collection('ads').doc(adId);
  const doc = await ref.get();
  if (!doc.exists) throw new Error('Anúncio não encontrado.');
  if (doc.data().sellerUid !== u.uid) throw new Error('Sem permissão.');
  await ref.delete();
}

async function fsGetWallet() {
  const u = requireUser();
  const doc = await db.collection('wallets').doc(u.uid).get();
  if (!doc.exists) return { saldo: 0, pending: 0 };
  const d = doc.data();
  return { saldo: Number(d.saldo) || 0, pending: Number(d.pending) || 0 };
}

async function fsSetWallet(saldo, pending) {
  const u = requireUser();
  await db.collection('wallets').doc(u.uid).set({
    saldo: Number(saldo) || 0,
    pending: Number(pending) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function fsGetMySales() {
  const u = requireUser();
  const snap = await db.collection('sales')
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
  const snap = await db.collection('ads').where('status', '==', 'ativo').limit(limit || 40).get();
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
  const doc = await db.collection('ads').doc(id).get();
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
  const snap = await db.collection('ads')
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
  await db.collection('profiles').doc(u.uid).set(payload, { merge: true });
  return payload;
}

async function fsGetProfile(uid) {
  if (!uid) return null;
  const doc = await db.collection('profiles').doc(uid).get();
  if (!doc.exists) return null;
  return Object.assign({ uid: uid }, doc.data());
}


/** Pedidos (estrutura sem gateway) */
function orderCode() {
  var s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return 'BZ' + s;
}

async function fsCreateOrder(ad, extra) {
  const u = requireUser();
  if (!ad || !ad.id) throw new Error('Anúncio inválido.');
  const sellerUid = (ad.raw && ad.raw.sellerUid) || ad.sellerUid || '';
  if (!sellerUid) throw new Error('Vendedor não encontrado.');
  if (sellerUid === u.uid) throw new Error('Você não pode comprar o próprio anúncio.');

  const price = Number(ad.price) || 0;
  const payload = {
    code: orderCode(),
    adId: ad.id,
    adTitle: ad.title || '',
    adCover: ad.cover || '',
    price: price,
    quantity: (extra && extra.quantity) || 1,
    total: price * ((extra && extra.quantity) || 1),
    status: 'aguardando_pagamento', // aguardando_pagamento | pago | em_entrega | concluido | cancelado
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
  const ref = await db.collection('orders').add(payload);
  return Object.assign({ id: ref.id }, payload);
}

async function fsGetMyPurchases() {
  const u = requireUser();
  const snap = await db.collection('orders').where('buyerUid', '==', u.uid).limit(50).get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}

async function fsGetMySales() {
  const u = requireUser();
  const snap = await db.collection('orders').where('sellerUid', '==', u.uid).limit(50).get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}

async function fsGetOrder(id) {
  if (!id) return null;
  const doc = await db.collection('orders').doc(id).get();
  if (!doc.exists) return null;
  return Object.assign({ id: doc.id }, doc.data());
}

async function fsUpdateOrderStatus(id, status) {
  const u = requireUser();
  const order = await fsGetOrder(id);
  if (!order) throw new Error('Pedido não encontrado.');
  if (order.buyerUid !== u.uid && order.sellerUid !== u.uid) {
    throw new Error('Sem permissão.');
  }
  await db.collection('orders').doc(id).update({
    status: status,
    updatedAtMs: Date.now()
  });
  return true;
}
