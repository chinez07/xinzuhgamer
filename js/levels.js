// JavaScript / js/levels.js / navegador e Node.js / reputação Bloxzuh.
(function (root) {
  'use strict';
  var ranks = [
    {name: 'Quartzo', min: 1, color: '#cbd5e1'},
    {name: 'Ametista', min: 5, color: '#c4b5fd'},
    {name: 'Safira', min: 9, color: '#60a5fa'},
    {name: 'Esmeralda', min: 13, color: '#34d399'},
    {name: 'Rubi', min: 17, color: '#fb7185'}
  ];
  function progress(positiveOrders) {
    var count = Math.max(0, Math.floor(Number(positiveOrders) || 0));
    var xp = count * 100;
    var level = Math.min(20, Math.floor(Math.sqrt(count)) + 1);
    var current = Math.pow(level - 1, 2) * 100;
    var next = level < 20 ? level * level * 100 : null;
    var rank = ranks[0];
    ranks.forEach(function (r) {if (level >= r.min) rank = r;});
    return {level: level, rank: rank.name, color: rank.color, xp: xp, positiveOrders: count,
      nextXP: next, remaining: next === null ? 0 : next - xp,
      percent: next === null ? 100 : Math.floor(100 * (xp - current) / (next - current))};
  }
  function countReviews(uid, reviews) {
    var orders = new Set();
    (reviews || []).forEach(function (r) {
      if (!r || (r.type && r.type !== 'ad' && r.type !== 'buyer') || Number(r.stars) !== 5 || !r.orderId || !r.buyerUid || !r.sellerUid || r.buyerUid === r.sellerUid) return;
      var recipient = r.type === 'buyer' ? r.buyerUid : r.sellerUid;
      var author = r.type === 'buyer' ? r.sellerUid : r.buyerUid;
      if (recipient !== uid || (r.fromUid && r.fromUid !== author)) return;
      orders.add(String(r.orderId));
    });
    return orders.size;
  }
  async function allReviews(db, field, uid) {
    var list = [], last = null;
    while (true) {
      var q = db.collection('reviews').where(field, '==', uid)
        .orderBy(root.firebase.firestore.FieldPath.documentId()).limit(250);
      if (last) q = q.startAfter(last);
      var snap = await q.get();
      snap.forEach(function (doc) {list.push(doc.data());});
      if (snap.size < 250) return list;
      last = snap.docs[snap.docs.length - 1];
    }
  }
  async function load(uid) {
    if (!uid) throw new Error('Perfil não informado.');
    var db = root.firebase.firestore();
    var lists = await Promise.all([allReviews(db, 'sellerUid', uid), allReviews(db, 'buyerUid', uid)]);
    return progress(countReviews(uid, lists[0].concat(lists[1])));
  }
  function render(element, data, compact) {
    if (!element) return;
    element.textContent = '';
    var badge = document.createElement('span');
    badge.className = 'level-badge';
    badge.style.setProperty('--rank-color', data.color);
    var icon = document.createElement('span');
    var rankIndex = ranks.findIndex(function (rank) {return rank.name === data.rank;});
    icon.className = 'level-crystal level-crystal-' + Math.max(0, rankIndex);
    icon.setAttribute('aria-hidden', 'true');
    badge.appendChild(icon);
    badge.appendChild(document.createTextNode('Nível ' + data.level + ' · ' + data.rank));
    element.appendChild(badge);
    if (compact) return;
    var detail = document.createElement('p');
    detail.className = 'level-detail';
    detail.textContent = data.xp.toLocaleString('pt-BR') + ' XP · ' + data.positiveOrders + ' pedidos com avaliação positiva';
    var bar = document.createElement('progress');
    bar.className = 'level-progress'; bar.max = 100; bar.value = data.percent;
    bar.setAttribute('aria-label', 'Progresso para o próximo nível');
    var next = document.createElement('p');
    next.className = 'level-detail';
    next.textContent = data.nextXP === null ? 'Nível máximo alcançado.' : 'Faltam ' + data.remaining.toLocaleString('pt-BR') + ' XP para o nível ' + (data.level + 1) + '.';
    element.appendChild(detail); element.appendChild(bar); element.appendChild(next);
  }
  var api = {progress: progress, countReviews: countReviews, load: load, render: render, ranks: ranks};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloxzuhLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
