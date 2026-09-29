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
    category: data.category,
    price: Number(data.price),
    desc: data.desc || '',
    status: 'ativo',
    sales: 0,
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

/** Anúncios ativos públicos (para a home no futuro) */
async function fsGetPublicAds(limit) {
  const snap = await db.collection('ads')
    .where('status', '==', 'ativo')
    .limit(limit || 24)
    .get();
  const list = [];
  snap.forEach(function (doc) {
    list.push(Object.assign({ id: doc.id }, doc.data()));
  });
  return list;
}
