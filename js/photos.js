window.BloxzuhPhotos = (function () {
  var cache = {};
  var versions = {};
  var syncing = {};

  function getLocal(uid) {
    try {
      return localStorage.getItem('xinzuh-photo-' + uid) || '';
    } catch (e) { return ''; }
  }

  function setLocal(uid, url, isCustom) {
    if (!uid || !url) return;
    cache[uid] = url;
    versions[uid] = (versions[uid] || 0) + 1;
    try {
      localStorage.setItem('xinzuh-photo-' + uid, url);
      var me = firebase.auth && firebase.auth().currentUser;
      if (me && me.uid === uid) localStorage.setItem('xinzuh-photo', url);
      if (isCustom) {
        localStorage.setItem('xinzuh-photo-custom-' + uid, '1');
      } else if (isCustom === false) {
        localStorage.removeItem('xinzuh-photo-custom-' + uid);
      }
    } catch (e) {}
  }

  function pickPhoto(p) {
    if (!p) return '';
    return p.photo || p.photoURL || p.avatar || p.image || '';
  }

  async function fetchProfile(uid) {
    if (!uid) return '';
    if (cache[uid]) return cache[uid];
    // local first (fast)
    var version = versions[uid] || 0;
    var local = getLocal(uid);
    if (local) {
      cache[uid] = local;
      // still try firestore in background
    }
    try {
      var p = null;
      if (typeof fsGetProfile === 'function') {
        p = await fsGetProfile(uid);
      } else if (typeof firebase !== 'undefined' && firebase.firestore) {
        var doc = await firebase.firestore().collection('profiles').doc(uid).get();
        if (doc.exists) p = Object.assign({ uid: uid }, doc.data());
      }
      if ((versions[uid] || 0) !== version) return cache[uid] || getLocal(uid);
      var url = pickPhoto(p);
      if (url) {
        cache[uid] = url;
        setLocal(uid, url);
        return url;
      }
    } catch (e) { console.warn('photo fetch', e); }
    if (local) return local;
    return '';
  }

  async function attachToAds(list) {
    if (!list || !list.length) return list;
    var uids = {};
    list.forEach(function (a) {
      var uid = (a.raw && a.raw.sellerUid) || a.sellerUid || '';
      if (uid) uids[uid] = 1;
    });
    var keys = Object.keys(uids);
    await Promise.all(keys.map(function (uid) { return fetchProfile(uid); }));
    list.forEach(function (a) {
      var uid = (a.raw && a.raw.sellerUid) || a.sellerUid || '';
      if (uid && cache[uid]) a.sellerPhoto = cache[uid];
    });
    return list;
  }

  function avatarHtml(photo, letter, size) {
    letter = (letter || '?').charAt(0).toUpperCase();
    size = size || 28;
    if (photo) {
      return '<span class="bz-av" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;display:inline-flex;flex-shrink:0;background:#2a2a36">' +
        '<img src="' + String(photo).replace(/"/g, '') + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentNode.textContent=\'' + letter + '\'"></span>';
    }
    return '<span class="bz-av" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#7c3aed;color:#fff;font-weight:700;font-size:' + Math.max(11, size * 0.4) + 'px;flex-shrink:0">' + letter + '</span>';
  }

  async function syncFromCloud(user) {
    var uid = user.uid;
    var version = versions[uid] || 0;
    var local = getLocal(uid);
    var isCustom = false;
    try { isCustom = localStorage.getItem('xinzuh-photo-custom-' + uid) === '1'; } catch (e) {}
    var profile;
    try {
      if (typeof fsGetProfile === 'function') profile = await fsGetProfile(uid);
      else {
        var doc = await firebase.firestore().collection('profiles').doc(uid).get();
        profile = doc.exists ? doc.data() : null;
      }
    } catch (e) {
      console.warn('sync photo profile', e);
      return local || user.photoURL || '';
    }
    // Uma troca de foto durante a leitura deve prevalecer sobre a resposta antiga.
    if ((versions[uid] || 0) !== version) return cache[uid] || getLocal(uid);
    if (!firebase.auth().currentUser || firebase.auth().currentUser.uid !== uid) return '';
    var remote = pickPhoto(profile);
    if (profile && profile.photo) {
      setLocal(uid, remote, profile.photoSource !== 'google');
      return remote;
    }
    // Recupera a foto antiga do aparelho se a rotina anterior apagou a nuvem.
    if (local && isCustom) {
      try {
        if (typeof fsSaveProfile === 'function') await fsSaveProfile({photo: local, photoSource: 'custom'});
      } catch (e) { console.warn('recover profile photo', e); }
      setLocal(uid, local, true);
      return local;
    }
    var fallback = remote || local || user.photoURL || '';
    if (fallback) setLocal(uid, fallback, false);
    return fallback;
  }

  function syncMyPhoto(user) {
    if (!user) return Promise.resolve('');
    if (!syncing[user.uid]) {
      syncing[user.uid] = syncFromCloud(user).finally(function () { delete syncing[user.uid]; });
    }
    return syncing[user.uid];
  }

  if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) syncMyPhoto(user).catch(function (e) { console.warn('sync photo', e); });
    });
  }

  return {
    fetch: fetchProfile,
    attachToAds: attachToAds,
    avatarHtml: avatarHtml,
    syncMyPhoto: syncMyPhoto,
    setLocal: setLocal,
    getLocal: getLocal,
    cache: cache
  };
})();
