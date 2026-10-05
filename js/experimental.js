/**
 * Versão experimental + escolher fundo (por conta)
 */
(function () {
  var BG_MOBILE = [
    'assets/fundos/mobile1.jpg',
    'assets/fundos/mobile2.jpg',
    'assets/fundos/mobile3.jpg',
    'assets/fundos/mobile4.jpg'
  ];
  var BG_PC = [
    'assets/fundos/pc1.jpg',
    'assets/fundos/pc2.jpg',
    'assets/fundos/pc3.jpg'
  ];

  function currentUser() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) return firebase.auth().currentUser;
    } catch (e) {}
    return null;
  }

  function isLogged() {
    if (currentUser()) return true;
    return localStorage.getItem('xinzuh-logged') === 'true';
  }

  function expStorageKey() {
    var u = currentUser();
    if (u && u.uid) return 'bloxzuh-exp-' + u.uid;
    var email = localStorage.getItem('xinzuh-email') || '';
    var name = localStorage.getItem('xinzuh-username') || 'guest';
    return 'bloxzuh-exp-' + (email || name);
  }

  function isExperimental() {
    return localStorage.getItem(expStorageKey() + '-on') === '1';
  }

  function getBgIndex() {
    var v = localStorage.getItem(expStorageKey() + '-bg');
    if (v === null || v === '') return -1;
    var n = parseInt(v, 10);
    return isNaN(n) ? -1 : n;
  }

  function isMobileView() {
    return window.matchMedia('(max-width: 768px)').matches;
  }

  function applyExperimentalBackground() {
    var btn = document.getElementById('bgChangeBtn');
    var on = isExperimental() && isLogged();
    if (btn) btn.classList.toggle('show', !!on);

    if (!on) {
      document.body.classList.remove('exp-bg');
      document.body.style.removeProperty('--exp-bg-image');
      return;
    }
    var idx = getBgIndex();
    if (idx < 0) {
      document.body.classList.remove('exp-bg');
      document.body.style.removeProperty('--exp-bg-image');
      return;
    }
    var list = isMobileView() ? BG_MOBILE : BG_PC;
    var safeIdx = ((idx % list.length) + list.length) % list.length;
    var url = list[safeIdx];
    document.body.classList.add('exp-bg');
    document.body.style.setProperty('--exp-bg-image', 'url("' + url + '")');
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
      if (typeof bloxzuhMsg === 'function') bloxzuhMsg('Entre na sua conta para usar a versão experimental.', 'err');
      else if (typeof showMsg === 'function') showMsg('Entre na sua conta para usar a versão experimental.', 'err');
      else console.log('Entre na conta');
      var t = document.getElementById('expToggle');
      if (t) t.checked = false;
      return;
    }
    localStorage.setItem(expStorageKey() + '-on', on ? '1' : '0');
    persistToProfile({ experimentalOn: !!on, updatedAtMs: Date.now() });
    var t2 = document.getElementById('expToggle');
    if (t2) t2.checked = !!on;
    applyExperimentalBackground();
  }

  function openBgModal() {
    if (!isLogged() || !isExperimental()) {
      if (typeof bloxzuhMsg === 'function') bloxzuhMsg('Ative a Versão experimental no menu para escolher o fundo.', 'err');
      return;
    }
    ensureModal();
    var modal = document.getElementById('bgModal');
    var grid = document.getElementById('bgGrid');
    if (!modal || !grid) return;
    var mobile = isMobileView();
    var list = mobile ? BG_MOBILE : BG_PC;
    var current = getBgIndex();
    grid.innerHTML = list.map(function (src, i) {
      var active = current === i ? ' active' : '';
      return '<button type="button" class="bg-opt' + active + '" data-i="' + i + '"><img src="' + src + '" alt="Fundo ' + (i + 1) + '" loading="lazy"></button>';
    }).join('');
    grid.querySelectorAll('.bg-opt').forEach(function (el) {
      el.addEventListener('click', function () {
        var i = parseInt(el.getAttribute('data-i'), 10);
        localStorage.setItem(expStorageKey() + '-bg', String(i));
        persistToProfile({ experimentalBg: i, updatedAtMs: Date.now() });
        applyExperimentalBackground();
        openBgModal();
      });
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
    btn.title = 'Mudar fundo';
    btn.innerHTML = '<i class="fas fa-image"></i> Mudar fundo';
    document.body.appendChild(btn);

    var modal = document.createElement('div');
    modal.id = 'bgModal';
    modal.setAttribute('role', 'dialog');
    modal.innerHTML =
      '<div class="bg-panel">' +
        '<h3><i class="fas fa-image"></i> Escolher fundo</h3>' +
        '<p style="font-size:0.8rem;opacity:0.75;margin:0 0 12px">Só na sua conta, com a versão experimental ligada.</p>' +
        '<div class="bg-grid" id="bgGrid"></div>' +
        '<div class="bg-actions">' +
          '<button type="button" class="btn-reset" id="bgReset">Padrão</button>' +
          '<button type="button" class="btn-cancel" id="bgClose">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    if (!document.getElementById('bzExpBgStyles')) {
      var st = document.createElement('style');
      st.id = 'bzExpBgStyles';
      st.textContent =
        '#bgChangeBtn{display:none;position:fixed;right:16px;bottom:18px;z-index:9000;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:999px;background:#7c3aed;color:#fff;font-weight:700;box-shadow:0 8px 24px rgba(124,58,237,.4);cursor:pointer}' +
        '#bgChangeBtn.show{display:inline-flex}' +
        '#bgModal{display:none;position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.55);align-items:flex-end;justify-content:center;padding:16px}' +
        '#bgModal.show{display:flex}' +
        '#bgModal .bg-panel{width:100%;max-width:480px;background:#16161f;color:#f3f4f6;border-radius:16px 16px 12px 12px;padding:16px;max-height:80vh;overflow:auto}' +
        '#bgModal h3{margin:0 0 12px;font-size:1.05rem}' +
        '.bg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}' +
        '@media(min-width:700px){.bg-grid{grid-template-columns:1fr 1fr 1fr}}' +
        '.bg-opt{border:2px solid transparent;border-radius:12px;padding:0;overflow:hidden;cursor:pointer;background:#0f0f14}' +
        '.bg-opt.active{border-color:#7c3aed}' +
        '.bg-opt img{width:100%;height:90px;object-fit:cover;display:block}' +
        '.bg-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}' +
        '.bg-actions button{padding:10px 14px;border-radius:10px;border:0;font-weight:700;cursor:pointer}' +
        '.btn-reset{background:#374151;color:#fff}' +
        '.btn-cancel{background:#7c3aed;color:#fff}' +
        'body.exp-bg{background-color:transparent}' +
        'body.exp-bg::before{content:"";position:fixed;inset:0;z-index:-1;background-image:var(--exp-bg-image);background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none}';
      document.head.appendChild(st);
    }
  }

  function wireModal() {
    ensureModal();
    var btn = document.getElementById('bgChangeBtn');
    var modal = document.getElementById('bgModal');
    var close = document.getElementById('bgClose');
    var reset = document.getElementById('bgReset');
    if (btn) btn.onclick = openBgModal;
    if (close) close.onclick = closeBgModal;
    if (reset) reset.onclick = resetBg;
    if (modal) modal.addEventListener('click', function (e) {
      if (e.target === modal) closeBgModal();
    });
  }

  function loadFromProfileThenApply() {
    var u = currentUser();
    if (!u || !firebase.firestore) {
      applyExperimentalBackground();
      return;
    }
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
    }).catch(function () {
      applyExperimentalBackground();
    });
  }

  function boot() {
    wireModal();
    applyExperimentalBackground();
    window.addEventListener('resize', function () {
      if (isExperimental() && isLogged()) applyExperimentalBackground();
    });
    if (typeof firebase !== 'undefined' && firebase.auth) {
      firebase.auth().onAuthStateChanged(function () {
        loadFromProfileThenApply();
      });
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
