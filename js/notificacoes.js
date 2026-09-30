// Tempo relativo + Notificações Bloxzuh
function timeAgo(ts) {
  if (ts == null || ts === '') return '';
  if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = parseInt(ts, 10);
  if (typeof ts === 'string') {
    var parsed = Date.parse(ts);
    if (!isNaN(parsed)) ts = parsed;
    else return ts;
  }
  var n = Number(ts);
  if (!n || isNaN(n)) return '';
  var diff = Math.max(0, Date.now() - n);
  var sec = Math.floor(diff / 1000);
  if (sec < 10) return 'agora';
  if (sec < 60) return sec === 1 ? 'há 1 segundo' : 'há ' + sec + ' segundos';
  var min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? 'há 1 minuto' : 'há ' + min + ' minutos';
  var hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? 'há 1 hora' : 'há ' + hr + ' horas';
  var day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? 'há 1 dia' : 'há ' + day + ' dias';
  var week = Math.floor(day / 7);
  if (week < 5) return week === 1 ? 'há 1 semana' : 'há ' + week + ' semanas';
  var month = Math.floor(day / 30);
  if (month < 12) return month === 1 ? 'há 1 mês' : 'há ' + month + ' meses';
  var year = Math.floor(day / 365);
  return year === 1 ? 'há 1 ano' : 'há ' + year + ' anos';
}

function notifKey(uid) {
  return 'bloxzuh-notifs-' + (uid || localStorage.getItem('xinzuh-email') || 'guest');
}
function getLocalNotifs(uid) {
  try { return JSON.parse(localStorage.getItem(notifKey(uid)) || '[]'); } catch (e) { return []; }
}
function setLocalNotifs(uid, list) {
  localStorage.setItem(notifKey(uid), JSON.stringify((list || []).slice(0, 100)));
}
function addLocalNotif(uid, n) {
  if (!uid) return;
  var list = getLocalNotifs(uid);
  list.unshift({
    id: n.id || ('n' + Date.now()),
    type: n.type || 'sistema',
    title: n.title || 'Notificação',
    body: n.body || '',
    link: n.link || 'notificacoes.html',
    read: false,
    createdAtMs: n.createdAtMs || Date.now()
  });
  setLocalNotifs(uid, list);
  updateNotifBadge();
}

async function fsAddNotification(userId, data) {
  if (!userId) return;
  try {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      await firebase.firestore().collection('notifications').add({
        userId: userId,
        type: data.type || 'sistema',
        title: data.title || 'Notificação',
        body: data.body || '',
        link: data.link || 'notificacoes.html',
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now()
      });
      return;
    }
  } catch (e) { console.warn(e); }
  addLocalNotif(userId, data);
}

async function fsGetMyNotifications(limit) {
  var u = null;
  try { u = firebase.auth().currentUser; } catch (e) {}
  if (!u) return getLocalNotifs(null);
  var list = [];
  try {
    var snap = await firebase.firestore().collection('notifications')
      .where('userId', '==', u.uid).limit(limit || 50).get();
    snap.forEach(function (doc) {
      var d = doc.data();
      list.push({
        id: doc.id, type: d.type, title: d.title, body: d.body,
        link: d.link, read: !!d.read, createdAtMs: d.createdAtMs || 0
      });
    });
  } catch (e) { console.warn(e); }
  getLocalNotifs(u.uid).forEach(function (n) {
    if (!list.some(function (x) { return x.id === n.id; })) list.push(n);
  });
  list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
  return list;
}

async function fsMarkNotifRead(id) {
  var u = null;
  try { u = firebase.auth().currentUser; } catch (e) {}
  if (!u || !id) return;
  try { await firebase.firestore().collection('notifications').doc(id).update({ read: true }); } catch (e) {}
  setLocalNotifs(u.uid, getLocalNotifs(u.uid).map(function (n) {
    if (n.id === id) n.read = true; return n;
  }));
  updateNotifBadge();
}

async function fsMarkAllNotifsRead() {
  var list = await fsGetMyNotifications(50);
  for (var i = 0; i < list.length; i++) {
    if (!list[i].read) await fsMarkNotifRead(list[i].id);
  }
  updateNotifBadge();
}

function setBadgeCount(count) {
  var badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.style.cssText = 'display:flex!important;position:absolute;top:0;right:0;min-width:18px;height:18px;background:#ef4444;color:#fff;font-size:0.65rem;font-weight:800;border-radius:999px;align-items:center;justify-content:center;padding:0 4px;z-index:5;border:2px solid #12121a';
    badge.textContent = count > 99 ? '99+' : String(count);
  } else {
    badge.style.display = 'none';
    badge.textContent = '';
  }
}

function updateNotifBadge() {
  var u = null;
  try { u = firebase.auth && firebase.auth().currentUser; } catch (e) {}
  setBadgeCount(getLocalNotifs(u && u.uid).filter(function (n) { return !n.read; }).length);
  if (u) {
    fsGetMyNotifications(50).then(function (list) {
      setBadgeCount(list.filter(function (n) { return !n.read; }).length);
    }).catch(function () {});
  }
}

function notifIcon(type) {
  if (type === 'pergunta' || type === 'resposta') return 'fa-comment';
  if (type === 'venda' || type === 'compra') return 'fa-dollar-sign';
  if (type === 'anuncio') return 'fa-bullhorn';
  return 'fa-bell';
}

function getOverlay() {
  var ov = document.getElementById('notifOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'notifOverlay';
  ov.innerHTML =
    '<div id="notifModal" role="dialog" aria-label="Notificações">' +
      '<div id="notifModalHead">' +
        '<strong>Notificações</strong>' +
        '<button type="button" id="notifModalClose" aria-label="Fechar">✕</button>' +
      '</div>' +
      '<div id="notifModalBody">Carregando…</div>' +
      '<a id="notifModalFoot" href="notificacoes.html">Ver central de notificações</a>' +
    '</div>';
  document.body.appendChild(ov);

  // styles once
  var st = document.createElement('style');
  st.id = 'notifOverlayStyles';
  st.textContent =
    '#notifOverlay{display:none;position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);' +
      'align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
    '#notifOverlay.open{display:flex!important}' +
    '#notifModal{width:100%;max-width:400px;max-height:75vh;background:#1a1a24;border:1px solid #6d28d9;' +
      'border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.7);display:flex;flex-direction:column;overflow:hidden}' +
    '#notifModalHead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;' +
      'border-bottom:1px solid #2d2d3a;color:#fff;font-size:1.05rem}' +
    '#notifModalClose{background:transparent;border:none;color:#9ca3af;font-size:1.2rem;cursor:pointer;padding:4px 8px}' +
    '#notifModalBody{overflow:auto;flex:1;min-height:100px}' +
    '#notifModalFoot{display:block;text-align:center;padding:14px;font-weight:700;color:#c4b5fd;' +
      'text-decoration:none;border-top:1px solid #2d2d3a;background:#16161f}' +
    '.ni{display:flex;gap:12px;padding:14px;text-decoration:none;color:#f3f4f6;border-bottom:1px solid #2d2d3a}' +
    '.ni.un{background:rgba(124,58,237,.15)}' +
    '.ni-ico{width:40px;height:40px;border-radius:12px;background:rgba(124,58,237,.2);color:#c4b5fd;' +
      'display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
    '.ni-t{font-weight:700;margin-bottom:4px}' +
    '.ni-b{color:#9ca3af;font-size:0.85rem;line-height:1.35}' +
    '.ni-time{font-size:0.75rem;color:#9ca3af;margin-top:6px}' +
    '.ni-empty{text-align:center;padding:36px 16px;color:#9ca3af}' +
    '.ni-empty strong{display:block;color:#fff;margin:8px 0 6px}';
  document.head.appendChild(st);

  document.getElementById('notifModalClose').onclick = function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeNotifModal();
  };
  ov.addEventListener('click', function (e) {
    if (e.target === ov) closeNotifModal();
  });
  return ov;
}

function closeNotifModal() {
  var ov = document.getElementById('notifOverlay');
  if (ov) ov.classList.remove('open');
}

function fillNotifModal(list) {
  var body = document.getElementById('notifModalBody');
  if (!body) return;
  if (!list || !list.length) {
    body.innerHTML =
      '<div class="ni-empty">' +
        '<div style="font-size:2rem;opacity:.5">🔔</div>' +
        '<strong>Nenhuma notificação</strong>' +
        '<p>Você não tem notificações pendentes no momento.</p>' +
      '</div>';
    return;
  }
  body.innerHTML = list.slice(0, 12).map(function (n) {
    return '<a class="ni' + (n.read ? '' : ' un') + '" href="' + (n.link || 'notificacoes.html') + '" data-nid="' + n.id + '">' +
      '<div class="ni-ico"><i class="fas ' + notifIcon(n.type) + '"></i></div>' +
      '<div><div class="ni-t">' + (n.title || '') + '</div>' +
      '<div class="ni-b">' + (n.body || '') + '</div>' +
      '<div class="ni-time">' + timeAgo(n.createdAtMs) + '</div></div></a>';
  }).join('');
  body.querySelectorAll('[data-nid]').forEach(function (el) {
    el.addEventListener('click', function () { fsMarkNotifRead(el.getAttribute('data-nid')); });
  });
}

function openNotifModal() {
  var ov = getOverlay();
  var body = document.getElementById('notifModalBody');
  body.innerHTML = '<div class="ni-empty">Carregando…</div>';
  ov.classList.add('open');
  fsGetMyNotifications(20).then(function (list) {
    fillNotifModal(list);
    updateNotifBadge();
  }).catch(function () {
    body.innerHTML = '<div class="ni-empty">Não foi possível carregar.<br><a href="notificacoes.html" style="color:#c4b5fd">Abrir central</a></div>';
  });
}

function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  if (!btn) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    var ov = document.getElementById('notifOverlay');
    if (ov && ov.classList.contains('open')) {
      closeNotifModal();
    } else {
      openNotifModal();
    }
  });

  updateNotifBadge();
  try {
    firebase.auth().onAuthStateChanged(function () { updateNotifBadge(); });
  } catch (e) {}
  setTimeout(updateNotifBadge, 1500);
  setTimeout(updateNotifBadge, 4000);
}

window.timeAgo = timeAgo;
window.fsAddNotification = fsAddNotification;
window.fsGetMyNotifications = fsGetMyNotifications;
window.fsMarkNotifRead = fsMarkNotifRead;
window.fsMarkAllNotifsRead = fsMarkAllNotifsRead;
window.setupNotifBell = setupNotifBell;
window.updateNotifBadge = updateNotifBadge;
window.openNotifModal = openNotifModal;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupNotifBell);
} else {
  setupNotifBell();
}
// retry bind (header may load late)
setTimeout(setupNotifBell, 800);
setTimeout(setupNotifBell, 2000);
