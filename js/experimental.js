/**
 * Versão experimental + escolher fundo (por conta) - v dark-only
 */
(function () {
  var BG_MOBILE = [
    '/assets/fundos/mobile1.jpg','/assets/fundos/mobile2.jpg','/assets/fundos/mobile3.jpg','/assets/fundos/mobile4.jpg',
    '/assets/fundos/mobile5.png','/assets/fundos/mobile6.png','/assets/fundos/mobile7.png','/assets/fundos/mobile8.png'
  ];
  var BG_PC = [
    '/assets/fundos/pc1.jpg','/assets/fundos/pc2.jpg','/assets/fundos/pc3.jpg',
    '/assets/fundos/pc4.png','/assets/fundos/pc5.png','/assets/fundos/pc6.png'
  ];
  function currentUser() {
    try { if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth().currentUser; } catch (e) {}
    return null;
  }
  function isLogged() {
    if (currentUser()) return true;
    return localStorage.getItem('xinzuh-logged') === 'true';
  }
  function expStorageKey() {
    var u = currentUser();
    if (u && u.uid) return 'bloxzuh-exp-' + u.uid;
    return 'bloxzuh-exp-' + (localStorage.getItem('xinzuh-email') || localStorage.getItem('xinzuh-username') || 'guest');
  }
  function isExperimental() { return localStorage.getItem(expStorageKey() + '-on') === '1'; }
  function getBgIndex() {
    var v = localStorage.getItem(expStorageKey() + '-bg');
    if (v === null || v === '') return -1;
    var n = parseInt(v, 10);
    return isNaN(n) ? -1 : n;
  }
  function isMobileView() { return window.matchMedia('(max-width: 768px)').matches; }
  function isPainelPage() {
    try { return (location.pathname || '').toLowerCase().indexOf('painel') !== -1; } catch (e) { return false; }
  }
  function forceDarkBg() {
    document.documentElement.setAttribute('data-mode', 'dark');
    document.body.style.backgroundColor = '#0f0f14';
    try {
      var s = document.getElementById('bzForceDarkBg');
      if (!s) {
        s = document.createElement('style');
        s.id = 'bzForceDarkBg';
        s.textContent = 'html,body{background-color:#0f0f14!important}';
        document.head.appendChild(s);
      }
    } catch (e) {}
  }
  function clearBg() {
    document.body.classList.remove('exp-bg');
    document.documentElement.classList.remove('exp-bg');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '#0f0f14';
    var layer = document.getElementById('bzBgLayer');
    if (layer) layer.style.display = 'none';
    forceDarkBg();
  }
  function applyExperimentalBackground() {
    forceDarkBg();
    if (isPainelPage()) {
      var b = document.getElementById('bgChangeBtn');
      if (b) b.style.display = 'none';
      clearBg();
      return;
    }
    var btn = document.getElementById('bgChangeBtn');
    var on = isExperimental() && isLogged();
    if (btn) btn.classList.toggle('show', !!on);
    if (!on) { clearBg(); return; }
    var idx = getBgIndex();
    if (idx < 0) { clearBg(); return; }
    var list = isMobileView() ? BG_MOBILE : BG_PC;
    var safeIdx = ((idx % list.length) + list.length) % list.length;
    var url = list[safeIdx];
    if (url && url.charAt(0) !== '/') url = '/' + url;
    document.body.classList.add('exp-bg');
    document.body.style.backgroundColor = '#0f0f14';
    document.body.style.backgroundImage = 'url("' + url + '")';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundRepeat = 'no-repeat';
    var layer = document.getElementById('bzBgLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'bzBgLayer';
      document.body.insertBefore(layer, document.body.firstChild);
    }
    layer.style.cssText = 'display:block;position:fixed;inset:0;z-index:0;pointer-events:none;background-image:url("'+url+'");background-size:cover;background-position:center;background-repeat:no-repeat';
  }
  function persistToProfile(patch) {
    try {
      var u = currentUser();
      if (!u || !firebase.firestore) return;
      firebase.firestore().collection('profiles').doc(u.uid).set(patch, { merge: true });
    } catch (e) {}
  }
  function setExperimental(on) {
    if (!isLogged()) {
      alert('Entre na sua conta para usar a versão experimental.');
      var t = document.getElementById('expToggle');
      if (t) t.checked = false;
      return;
    }
    localStorage.setItem(expStorageKey() + '-on', on ? '1' : '0');
    persistToProfile({ experimentalOn: !!on, updatedAtMs: Date.now() });
    applyExperimentalBackground();
  }
  function openBgModal() {
    ensureModal();
    var modal = document.getElementById('bgModal');
    var grid = document.getElementById('bgGrid');
    if (!modal || !grid) return;
    var list = isMobileView() ? BG_MOBILE : BG_PC;
    var cur = getBgIndex();
    grid.innerHTML = list.map(function (url, i) {
      return '<button type="button" class="bg-opt' + (i === cur ? ' on' : '') + '" data-i="' + i + '"><img src="' + url + '" alt="" style="width:100%;height:80px;object-fit:cover;display:block"></button>';
    }).join('');
    grid.querySelectorAll('.bg-opt').forEach(function (el) {
      el.onclick = function () {
        var i = parseInt(el.getAttribute('data-i'), 10);
        localStorage.setItem(expStorageKey() + '-bg', String(i));
        persistToProfile({ experimentalBg: i, updatedAtMs: Date.now() });
        applyExperimentalBackground();
        closeBgModal();
      };
    });
    modal.classList.add('show');
  }
  function closeBgModal() {
    var modal = document.getElementById('bgModal');
    if (modal) modal.classList.remove('show');
  }
  function resetBg() {
    localStorage.setItem(expStorageKey() + '-bg', '-1');
    persistToProfile({ experimentalBg: -1, updatedAtMs: Date.now() });
    applyExperimentalBackground();
    closeBgModal();
  }
  function ensureModal() {
    if (document.getElementById('bgModal')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'bgChangeBtn';
    btn.innerHTML = '<i class="fas fa-image"></i> Mudar fundo';
    btn.onclick = openBgModal;
    document.body.appendChild(btn);
    var modal = document.createElement('div');
    modal.id = 'bgModal';
    modal.innerHTML = '<div class="bg-panel"><h3>Escolher fundo</h3><div class="bg-grid" id="bgGrid"></div><div class="bg-actions"><button type="button" id="bgReset">Padrão</button><button type="button" id="bgClose">Fechar</button></div></div>';
    document.body.appendChild(modal);
    if (!document.getElementById('bzExpBgStyles')) {
      var st = document.createElement('style');
      st.id = 'bzExpBgStyles';
      st.textContent = '#bgChangeBtn{display:none;position:fixed;right:16px;bottom:18px;z-index:9000;padding:12px 16px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:700;cursor:pointer}#bgChangeBtn.show{display:inline-flex;align-items:center;gap:8px}#bgModal{display:none;position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.55);align-items:flex-end;justify-content:center;padding:16px}#bgModal.show{display:flex}.bg-panel{width:100%;max-width:480px;background:#16161f;color:#f3f4f6;border-radius:16px;padding:16px;max-height:80vh;overflow:auto}.bg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.bg-opt{border:2px solid transparent;border-radius:12px;padding:0;overflow:hidden;cursor:pointer;background:#0f0f14}.bg-opt.on{border-color:#7c3aed}.bg-actions{display:flex;gap:8px;margin-top:12px;justify-content:flex-end}.bg-actions button{padding:8px 14px;border-radius:8px;border:0;cursor:pointer;font-weight:600}#bgReset{background:#374151;color:#fff}#bgClose{background:#7c3aed;color:#fff}';
      document.head.appendChild(st);
    }
    document.getElementById('bgClose').onclick = closeBgModal;
    document.getElementById('bgReset').onclick = resetBg;
    modal.addEventListener('click', function (e) { if (e.target === modal) closeBgModal(); });
  }
  function wireModal() { ensureModal(); }
  function loadFromProfileThenApply() {
    forceDarkBg();
    var u = currentUser();
    if (!u || !firebase.firestore) { applyExperimentalBackground(); return; }
    firebase.firestore().collection('profiles').doc(u.uid).get().then(function (doc) {
      if (doc.exists) {
        var d = doc.data() || {};
        if (d.experimentalOn === true) localStorage.setItem(expStorageKey() + '-on', '1');
        if (d.experimentalOn === false) localStorage.setItem(expStorageKey() + '-on', '0');
        if (typeof d.experimentalBg === 'number') localStorage.setItem(expStorageKey() + '-bg', String(d.experimentalBg));
      }
      var t = document.getElementById('expToggle');
      if (t) t.checked = isExperimental();
      applyExperimentalBackground();
    }).catch(function () { applyExperimentalBackground(); });
  }
  function boot() {
    forceDarkBg();
    wireModal();
    applyExperimentalBackground();
    window.addEventListener('resize', function () {
      if (isExperimental() && isLogged()) applyExperimentalBackground();
    });
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(function () { loadFromProfileThenApply(); });
    } else {
      setTimeout(loadFromProfileThenApply, 800);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.expStorageKey = expStorageKey;
  window.isExperimental = isExperimental;
  window.setExperimental = setExperimental;
  window.applyExperimentalBackground = applyExperimentalBackground;
  window.openBgModal = openBgModal;
  window.closeBgModal = closeBgModal;
  window.resetBg = resetBg;
})();
