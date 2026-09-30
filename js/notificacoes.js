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
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    addLocalNotif(userId, data);
    return;
  }
  try {
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
  } catch (e) {
    console.warn('notif cloud', e);
    addLocalNotif(userId, data);
  }
}

async function fsGetMyNotifications(limit) {
  var u = null;
  try { u = firebase.auth().currentUser; } catch (e) {}
  if (!u) return getLocalNotifs(null);
  var list = [];
  try {
    var snap = await firebase.firestore().collection('notifications')
      .where('userId', '==', u.uid)
      .limit(limit || 50)
      .get();
    snap.forEach(function (doc) {
      var d = doc.data();
      list.push({
        id: doc.id,
        type: d.type,
        title: d.title,
        body: d.body,
        link: d.link,
        read: !!d.read,
        createdAtMs: d.createdAtMs || 0
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
    if (n.id === id) n.read = true;
    return n;
  }));
  updateNotifBadge();
}

async function fsMarkAllNotifsRead() {
  var list = await fsGetMyNotifications(50);
  for (var i = 0; i < list.length; i++) {
    if (!list[i].read) await fsMarkNotifRead(list[i].id);
  }
  var u = firebase.auth().currentUser;
  if (u) setLocalNotifs(u.uid, getLocalNotifs(u.uid).map(function (n) { n.read = true; return n; }));
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
  var badge = document.getElementById('notifBadge');
  if (!badge) return;
  var u = null;
  try { u = firebase.auth && firebase.auth().currentUser; } catch (e) {}
  var localCount = getLocalNotifs(u && u.uid).filter(function (n) { return !n.read; }).length;
  setBadgeCount(localCount);
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

function renderNotifDropdown(list) {
  var panel = document.getElementById('notifPanel');
  if (!panel) return;
  if (!list || !list.length) {
    panel.innerHTML =
      '<div class="notif-empty">' +
        '<i class="fas fa-bell"></i>' +
        '<strong>Nenhuma notificação</strong>' +
        '<p>Você não tem notificações pendentes no momento.</p>' +
      '</div>' +
      '<a class="notif-footer" href="notificacoes.html">Ver central de notificações</a>';
    return;
  }
  panel.innerHTML = list.slice(0, 8).map(function (n) {
    return '<a class="notif-item' + (n.read ? '' : ' unread') + '" href="' + (n.link || 'notificacoes.html') + '" data-nid="' + n.id + '">' +
      '<div class="notif-ico"><i class="fas ' + notifIcon(n.type) + '"></i></div>' +
      '<div><div class="notif-title">' + (n.title || '') + '</div>' +
      '<div class="notif-body">' + (n.body || '') + '</div>' +
      '<div class="notif-time">' + timeAgo(n.createdAtMs) + '</div></div></a>';
  }).join('') + '<a class="notif-footer" href="notificacoes.html">Ver central de notificações</a>';
  panel.querySelectorAll('[data-nid]').forEach(function (el) {
    el.addEventListener('click', function () { fsMarkNotifRead(el.getAttribute('data-nid')); });
  });
}

function positionNotifPanel(btn, panel) {
  var r = btn.getBoundingClientRect();
  panel.style.cssText =
    'display:block;position:fixed;z-index:99999;' +
    'top:' + Math.min(r.bottom + 8, window.innerHeight - 100) + 'px;' +
    'right:' + Math.max(8, window.innerWidth - r.right) + 'px;' +
    'left:auto;width:min(340px, calc(100vw - 24px));' +
    'max-height:min(70vh,480px);overflow:auto;' +
    'background:#1a1a24;border:1px solid #2d2d3a;border-radius:14px;' +
    'box-shadow:0 16px 48px rgba(0,0,0,.55);';
}

function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  var panel = document.getElementById('notifPanel');
  if (!btn || !panel) {
    console.warn('notif bell elements missing');
    return;
  }
  // avoid double bind
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async function (e) {
    e.preventDefault();
    e.stopPropagation();
    var isOpen = panel.classList.contains('show');
    if (isOpen) {
      panel.classList.remove('show');
      panel.style.display = 'none';
      return;
    }
    positionNotifPanel(btn, panel);
    panel.classList.add('show');
    panel.innerHTML = '<div class="notif-empty">Carregando…</div>';
    try {
      var list = await fsGetMyNotifications(20);
      renderNotifDropdown(list);
      positionNotifPanel(btn, panel);
      updateNotifBadge();
    } catch (err) {
      panel.innerHTML = '<div class="notif-empty">Erro ao carregar</div><a class="notif-footer" href="notificacoes.html">Ver central de notificações</a>';
    }
  });

  document.addEventListener('click', function (e) {
    if (!panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      panel.classList.remove('show');
      panel.style.display = 'none';
    }
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });

  updateNotifBadge();
  try {
    firebase.auth().onAuthStateChanged(function () {
      updateNotifBadge();
    });
  } catch (e) {}
  // retry badge after auth settles
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

// auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () { setupNotifBell(); });
} else {
  setupNotifBell();
}
