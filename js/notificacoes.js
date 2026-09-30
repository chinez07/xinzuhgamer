// Tempo relativo + Notificações Bloxzuh
function timeAgo(ts) {
  if (ts == null || ts === '') return '';
  if (typeof ts === 'string' && /^\d+$/.test(ts)) ts = parseInt(ts, 10);
  if (typeof ts === 'string') {
    var parsed = Date.parse(ts);
    if (!isNaN(parsed)) ts = parsed;
    else return ts; // already human text
  }
  var now = Date.now();
  var diff = Math.max(0, now - Number(ts));
  var sec = Math.floor(diff / 1000);
  if (sec < 45) return 'agora';
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
  try {
    return JSON.parse(localStorage.getItem(notifKey(uid)) || '[]');
  } catch (e) { return []; }
}

function setLocalNotifs(uid, list) {
  localStorage.setItem(notifKey(uid), JSON.stringify(list.slice(0, 100)));
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
  if (!userId || typeof firebase === 'undefined') {
    addLocalNotif(userId, data);
    return;
  }
  try {
    var db = firebase.firestore();
    await db.collection('notifications').add({
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
  var u = firebase.auth().currentUser;
  if (!u) return getLocalNotifs(null);
  try {
    var snap = await firebase.firestore().collection('notifications')
      .where('userId', '==', u.uid)
      .limit(limit || 50)
      .get();
    var list = [];
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
    list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
    // merge local
    getLocalNotifs(u.uid).forEach(function (n) {
      if (!list.some(function (x) { return x.id === n.id; })) list.push(n);
    });
    list.sort(function (a, b) { return (b.createdAtMs || 0) - (a.createdAtMs || 0); });
    return list;
  } catch (e) {
    console.warn(e);
    return getLocalNotifs(u.uid);
  }
}

async function fsMarkNotifRead(id) {
  var u = firebase.auth().currentUser;
  if (!u || !id) return;
  try {
    await firebase.firestore().collection('notifications').doc(id).update({ read: true });
  } catch (e) {}
  var list = getLocalNotifs(u.uid).map(function (n) {
    if (n.id === id) n.read = true;
    return n;
  });
  setLocalNotifs(u.uid, list);
}

async function fsMarkAllNotifsRead() {
  var list = await fsGetMyNotifications(50);
  for (var i = 0; i < list.length; i++) {
    if (!list[i].read) await fsMarkNotifRead(list[i].id);
  }
  var u = firebase.auth().currentUser;
  if (u) {
    setLocalNotifs(u.uid, getLocalNotifs(u.uid).map(function (n) { n.read = true; return n; }));
  }
  updateNotifBadge();
}

function updateNotifBadge() {
  var badge = document.getElementById('notifBadge');
  if (!badge) return;
  var uid = (firebase.auth && firebase.auth().currentUser && firebase.auth().currentUser.uid) || null;
  var count = 0;
  // optimistic from local; full count async
  getLocalNotifs(uid).forEach(function (n) { if (!n.read) count++; });
  if (count > 0) {
    badge.style.display = 'block';
    badge.textContent = count > 9 ? '9+' : String(count);
  } else {
    badge.style.display = 'none';
    badge.textContent = '';
  }
  // refine from cloud
  if (typeof fsGetMyNotifications === 'function' && firebase.auth && firebase.auth().currentUser) {
    fsGetMyNotifications(30).then(function (list) {
      var c = list.filter(function (n) { return !n.read; }).length;
      if (c > 0) {
        badge.style.display = 'block';
        badge.textContent = c > 9 ? '9+' : String(c);
      } else {
        badge.style.display = 'none';
      }
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
  var html = list.slice(0, 8).map(function (n) {
    return '<a class="notif-item' + (n.read ? '' : ' unread') + '" href="' + (n.link || 'notificacoes.html') + '" data-nid="' + n.id + '">' +
      '<div class="notif-ico"><i class="fas ' + notifIcon(n.type) + '"></i></div>' +
      '<div><div class="notif-title">' + (n.title || '') + '</div>' +
      '<div class="notif-body">' + (n.body || '') + '</div>' +
      '<div class="notif-time">' + timeAgo(n.createdAtMs) + '</div></div></a>';
  }).join('');
  panel.innerHTML = html + '<a class="notif-footer" href="notificacoes.html">Ver central de notificações</a>';
  panel.querySelectorAll('[data-nid]').forEach(function (el) {
    el.addEventListener('click', function () {
      fsMarkNotifRead(el.getAttribute('data-nid'));
    });
  });
}

function setupNotifBell() {
  var btn = document.getElementById('notifBellBtn');
  var panel = document.getElementById('notifPanel');
  if (!btn || !panel) return;
  btn.addEventListener('click', async function (e) {
    e.stopPropagation();
    var open = panel.classList.toggle('show');
    if (open) {
      var list = await fsGetMyNotifications(20);
      renderNotifDropdown(list);
      updateNotifBadge();
    }
  });
  document.addEventListener('click', function () {
    panel.classList.remove('show');
  });
  panel.addEventListener('click', function (e) { e.stopPropagation(); });
  updateNotifBadge();
  if (firebase.auth) {
    firebase.auth().onAuthStateChanged(function () { updateNotifBadge(); });
  }
}

window.timeAgo = timeAgo;
window.fsAddNotification = fsAddNotification;
window.fsGetMyNotifications = fsGetMyNotifications;
window.fsMarkNotifRead = fsMarkNotifRead;
window.fsMarkAllNotifsRead = fsMarkAllNotifsRead;
window.setupNotifBell = setupNotifBell;
window.updateNotifBadge = updateNotifBadge;
