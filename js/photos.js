// Bloxzuh – fotos de perfil (prioridade: Firestore > localStorage > Google)
window.BloxzuhPhotos = (function () {
  var cache = {};

  function getLocal(uid) {
    try {
      return localStorage.getItem('xinzuh-photo-' + uid) || '';
    } catch (e) { return ''; }
  }

  function setLocal(uid, url) {
    if (!uid || !url) return;
    try {
      localStorage.setItem('xinzuh-photo-' + uid, url);
      var me = firebase.auth().currentUser;
      if (me && me.uid === uid) localStorage.setItem('xinzuh-photo', url);
      if (url && String(url).indexOf('data:') === 0) {
        try { localStorage.setItem('xinzuh-photo-custom-' + uid, '1'); } catch (e2) {}
      }
    } catch (e) {}
  }

  async function fetchProfile(uid) {
    if (!uid) return null;
    if (cache[uid]) return cache[uid];
    try {
      var p = null;
      if (typeof fsGetProfile === 'function') p = await fsGetProfile(uid);
      else {
        var doc = await firebase.firestore().collection('profiles').doc(uid).get();
        if (doc.exists) p = Object.assign({ uid: uid }, doc.data());
      }
      if (p && p.photo) {
        cache[uid] = p.photo;
        setLocal(uid, p.photo);
        return p.photo;
      }
    } catch (e) { console.warn('photo fetch', e); }
    var local = getLocal(uid);
    if (local) { cache[uid] = local; return local; }
    return '';
  }

  async function attachToAds(list) {
    if (!list || !list.length) return list;
    var uids = {};
    list.forEach(function (a) {
      var uid = (a.raw && a.raw.sellerUid) || a.sellerUid || '';
      if (uid) uids[uid] = 1;
    });
    await Promise.all(Object.keys(uids).map(function (uid) { return fetchProfile(uid); }));
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
        '<img src="' + String(photo).replace(/"/g, '') + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></span>';
    }
    return '<span class="bz-av" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#7c3aed;color:#fff;font-weight:700;font-size:' + Math.max(11, size * 0.4) + 'px;flex-shrink:0">' + letter + '</span>';
  }

  /** Nunca sobrescreve foto custom com Google */
  async function syncMyPhoto(user) {
    if (!user) return '';
    var fromFs = await fetchProfile(user.uid);
    if (fromFs) return fromFs;
    var local = getLocal(user.uid);
    if (local) return local;
    // só usa Google se não houver custom
    if (user.photoURL) {
      setLocal(user.uid, user.photoURL);
      return user.photoURL;
    }
    return '';
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
