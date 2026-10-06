// Tempo relativo + Notificações Bloxzuh (sem painel flutuante)
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
      var nid = 'NT' + Math.random().toString(36).slice(2, 6).toUpperCase() + Date.now().toString(36).toUpperCase().slice(-4);
      await firebase.firestore().collection('notifications').doc(nid).set({
        userId: userId,
        type: data.type || 'sistema',
        title: data.title || 'Notificação',
        body: data.body || '',
        link: data.link || 'notificacoes.html',
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAtMs: Date.now()
      });
      console.log('[Bloxzuh] notificação ID=', nid);
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
  count = Number(count) || 0;
  var btn = document.getElementById('notifBellBtn');
  if (!btn) return;

  // garante overflow e position
  btn.style.position = 'relative';
  btn.style.overflow = 'visible';
  var wrap = btn.parentElement;
  if (wrap) { wrap.style.position = 'relative'; wrap.style.overflow = 'visible'; }

  var badge = document.getElementById('notifBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'notifBadge';
    badge.className = 'badge-count';
    btn.appendChild(badge);
  }

  if (count > 0) {
    badge.className = 'badge-count show';
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.cssText = [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'position:absolute',
      'top:-4px',
      'right:-6px',
      'min-width:17px',
      'height:17px',
      'padding:0 4px',
      'background:#ef4444',
      'color:#ffffff',
      'font-size:10px',
      'font-weight:800',
      'line-height:1',
      'border-radius:999px',
      'border:2px solid #12121a',
      'z-index:999',
      'pointer-events:none',
      'box-sizing:border-box',
      'visibility:visible',
      'opacity:1'
    ].join('!important;') + '!important;';
  } else {
    badge.className = 'badge-count';
    badge.textContent = '';
    badge.style.cssText = 'display:none!important';
  }
}

var _notifUnsub = null;
var _notifPoll = null;
function countUnreadFromSnap(snap, uid) {
  var unread = 0;
  var ids = {};
  snap.forEach(function (doc) {
    ids[doc.id] = true;
    var d = doc.data() || {};
    if (d.read !== true) unread++;
  });
  getLocalNotifs(uid).forEach(function (n) {
    if (n.read !== true && !ids[n.id]) unread++;
  });
  return unread;
}
function startNotifRealtime(uid) {
  if (_notifUnsub) { try { _notifUnsub(); } catch (e) {} _notifUnsub = null; }
  if (_notifPoll) { clearInterval(_notifPoll); _notifPoll = null; }
  if (!uid) {
    setBadgeCount(0);
    return;
  }
  if (!firebase.firestore) {
    setBadgeCount(getLocalNotifs(uid).filter(function (n) { return n.read !== true; }).length);
    return;
  }
  // poll backup a cada 12s
  function poll() {
    fsGetMyNotifications(80).then(function (list) {
      setBadgeCount(list.filter(function (n) { return n.read !== true; }).length);
    }).catch(function () {});
  }
  poll();
  _notifPoll = setInterval(poll, 12000);
  try {
    _notifUnsub = firebase.firestore().collection('notifications')
      .where('userId', '==', uid)
      .onSnapshot(function (snap) {
        setBadgeCount(countUnreadFromSnap(snap, uid));
      }, function (err) {
        console.warn('[Bloxzuh] notif realtime', err);
        poll();
      });
  } catch (e) {
    console.warn(e);
    poll();
  }
}

function updateNotifBadgeOnce(uid) {
  setBadgeCount(getLocalNotifs(uid).filter(function (n) { return n.read !== true; }).length);
  if (!uid) return;
  fsGetMyNotifications(50).then(function (list) {
    setBadgeCount(list.filter(function (n) { return n.read !== true; }).length);
  }).catch(function () {});
}

function updateNotifBadge() {
  var u = null;
  try { u = firebase.auth && firebase.auth().currentUser; } catch (e) {}
  if (u) startNotifRealtime(u.uid);
  else {
    if (_notifUnsub) { try { _notifUnsub(); } catch (e) {} _notifUnsub = null; }
    setBadgeCount(0);
  }
}

// Sino só abre a página de notificações (sem painel)
function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  if (!btn) return;
  if (!document.getElementById('notifBadge')) {
    var b = document.createElement('span');
    b.className = 'badge-count';
    b.id = 'notifBadge';
    b.style.display = 'none';
    btn.appendChild(b);
  }
  if (btn.dataset.bound === '1') {
    updateNotifBadge();
    return;
  }
  btn.dataset.bound = '1';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'notificacoes.html';
  });
  var panel = document.getElementById('notifPanel');
  if (panel) panel.remove();
  var ov = document.getElementById('notifOverlay');
  if (ov) ov.remove();
  updateNotifBadge();
  try {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) startNotifRealtime(user.uid);
      else {
        if (_notifUnsub) { try { _notifUnsub(); } catch (e) {} _notifUnsub = null; }
        setBadgeCount(0);
      }
    });
  } catch (e) {}
  setTimeout(updateNotifBadge, 800);
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
setTimeout(setupNotifBell, 800);

console.log('[Bloxzuh] notificacoes v-notif-readable');

window.__bzNotifBoot = true;
setInterval(function () {
  try {
    if (typeof updateNotifBadge === 'function' && firebase.auth && firebase.auth().currentUser) {
      /* keep realtime; poll already in startNotifRealtime */
    }
  } catch (e) {}
}, 30000);
