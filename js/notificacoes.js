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
    badge.style.display = 'flex';
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

function ensurePanel() {
  var panel = document.getElementById('notifPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    document.body.appendChild(panel);
  }
  if (panel.parentElement !== document.body) {
    document.body.appendChild(panel);
  }
  return panel;
}

function showPanelBox(panel) {
  // largura boa no celular, bem abaixo do header
  var header = document.querySelector('.header');
  var top = 72;
  if (header) {
    var hr = header.getBoundingClientRect();
    top = Math.round(hr.bottom + 12);
  }
  panel.style.cssText =
    'display:block !important;' +
    'position:fixed !important;' +
    'z-index:2147483647 !important;' +
    'top:' + top + 'px !important;' +
    'left:12px !important;' +
    'right:12px !important;' +
    'width:auto !important;' +
    'max-width:420px !important;' +
    'margin-left:auto !important;' +
    'max-height:60vh !important;' +
    'overflow:auto !important;' +
    'background:#1a1a24 !important;' +
    'border:1px solid #4c1d95 !important;' +
    'border-radius:16px !important;' +
    'box-shadow:0 20px 50px rgba(0,0,0,.7) !important;' +
    'color:#f3f4f6 !important;' +
    'visibility:visible !important;' +
    'opacity:1 !important;' +
    'min-height:120px !important;';
}

function renderNotifDropdown(list) {
  var panel = ensurePanel();
  showPanelBox(panel);
  if (!list || !list.length) {
    panel.innerHTML =
      '<div style="text-align:center;padding:28px 16px;color:#9ca3af">' +
        '<div style="font-size:1.8rem;margin-bottom:8px;opacity:.5">🔔</div>' +
        '<strong style="display:block;color:#fff;margin-bottom:6px">Nenhuma notificação</strong>' +
        '<p style="font-size:0.85rem">Você não tem notificações pendentes.</p>' +
      '</div>' +
      '<a href="notificacoes.html" style="display:block;text-align:center;padding:14px;font-weight:700;color:#c4b5fd;text-decoration:none;border-top:1px solid #2d2d3a">Ver central de notificações</a>';
    return;
  }
  var html = list.slice(0, 8).map(function (n) {
    var bg = n.read ? 'transparent' : 'rgba(124,58,237,.15)';
    return '<a href="' + (n.link || 'notificacoes.html') + '" data-nid="' + n.id + '" style="display:flex;gap:12px;padding:14px;text-decoration:none;color:#f3f4f6;border-bottom:1px solid #2d2d3a;background:' + bg + '">' +
      '<div style="width:40px;height:40px;border-radius:12px;background:rgba(124,58,237,.2);color:#c4b5fd;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + notifIcon(n.type) + '"></i></div>' +
      '<div style="min-width:0"><div style="font-weight:700;margin-bottom:4px">' + (n.title || '') + '</div>' +
      '<div style="color:#9ca3af;font-size:0.85rem;line-height:1.35">' + (n.body || '') + '</div>' +
      '<div style="font-size:0.75rem;color:#9ca3af;margin-top:6px">' + timeAgo(n.createdAtMs) + '</div></div></a>';
  }).join('');
  panel.innerHTML = html +
    '<a href="notificacoes.html" style="display:block;text-align:center;padding:14px;font-weight:700;color:#c4b5fd;text-decoration:none;border-top:1px solid #2d2d3a;background:#1a1a24;position:sticky;bottom:0">Ver central de notificações</a>';
  panel.querySelectorAll('[data-nid]').forEach(function (el) {
    el.addEventListener('click', function () { fsMarkNotifRead(el.getAttribute('data-nid')); });
  });
}

function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  if (!btn) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  var panel = ensurePanel();
  panel.style.display = 'none';
  var open = false;
  var ignoreCloseUntil = 0;

  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      open = false;
      panel.style.display = 'none';
      return;
    }
    open = true;
    ignoreCloseUntil = Date.now() + 400;
    panel.innerHTML = '<div style="padding:24px;text-align:center;color:#9ca3af">Carregando…</div>';
    showPanelBox(panel);
    fsGetMyNotifications(20).then(function (list) {
      if (!open) return;
      renderNotifDropdown(list);
      showPanelBox(panel);
      updateNotifBadge();
    }).catch(function () {
      if (!open) return;
      panel.innerHTML = '<div style="padding:24px;text-align:center;color:#9ca3af">Não foi possível carregar.</div>' +
        '<a href="notificacoes.html" style="display:block;text-align:center;padding:14px;color:#c4b5fd;font-weight:700;text-decoration:none">Ver central de notificações</a>';
      showPanelBox(panel);
    });
  });

  document.addEventListener('click', function (e) {
    if (!open) return;
    if (Date.now() < ignoreCloseUntil) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    open = false;
    panel.style.display = 'none';
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupNotifBell);
} else {
  setupNotifBell();
}
