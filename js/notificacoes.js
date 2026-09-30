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

// Sino só abre a página de notificações (sem painel)
function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  if (!btn) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'notificacoes.html';
  });
  // remove empty panel if exists
  var panel = document.getElementById('notifPanel');
  if (panel) panel.remove();
  var ov = document.getElementById('notifOverlay');
  if (ov) ov.remove();
  updateNotifBadge();
  try {
    firebase.auth().onAuthStateChanged(function () { updateNotifBadge(); });
  } catch (e) {}
  setTimeout(updateNotifBadge, 1500);
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
