/**
 * Garante que o perfil no Firestore tenha name/displayName legíveis.
 * O ID do documento CONTINUA sendo o UID (obrigatório para o app funcionar).
 * No console do Firebase a lista sempre mostra o ID; o nome fica DENTRO do documento.
 */
(function () {
  function niceName(u, data) {
    data = data || {};
    return (
      (u && u.displayName) ||
      data.displayName ||
      data.name ||
      data.username ||
      (u && u.email ? u.email.split('@')[0] : '') ||
      'Usuário'
    );
  }

  async function syncProfileName() {
    try {
      if (typeof firebase === 'undefined' || !firebase.auth || !firebase.firestore) return;
      var u = firebase.auth().currentUser;
      if (!u) return;
      var ref = firebase.firestore().collection('profiles').doc(u.uid);
      var snap = await ref.get();
      var data = snap.exists ? (snap.data() || {}) : {};
      var name = niceName(u, data);
      var patch = {
        displayName: name,
        name: name,
        username: data.username || name,
        email: u.email || data.email || '',
        updatedAtMs: Date.now()
      };
      if (!data.memberSinceMs) {
        var created = Date.now();
        try {
          if (u.metadata && u.metadata.creationTime) {
            created = new Date(u.metadata.creationTime).getTime() || created;
          }
        } catch (e) {}
        patch.memberSinceMs = created;
      }
      await ref.set(patch, { merge: true });
    } catch (e) {
      console.warn('[Bloxzuh] profile-name-sync', e);
    }
  }

  function boot() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      setTimeout(boot, 500);
      return;
    }
    firebase.auth().onAuthStateChanged(function (u) {
      if (u) syncProfileName();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.bloxzuhSyncProfileName = syncProfileName;
})();
