/**
 * Overlay de busca Bloxzuh (estilo GGMAX)
 * Anúncios · Usuários · Categorias — mínimo 3 letras
 */
(function () {
  var CATS = [
    { id: 'freefire', name: 'Free Fire', href: 'anuncios.html?cat=freefire' },
    { id: 'roblox', name: 'Roblox', href: 'anuncios.html?cat=roblox' },
    { id: 'valorant', name: 'Valorant', href: 'anuncios.html?cat=valorant' },
    { id: 'lol', name: 'League of Legends', href: 'anuncios.html?cat=lol' },
    { id: 'fortnite', name: 'Fortnite', href: 'anuncios.html?cat=fortnite' },
    { id: 'genshin', name: 'Genshin Impact', href: 'anuncios.html?cat=genshin' },
    { id: 'cs2', name: 'CS2', href: 'anuncios.html?cat=cs2' },
    { id: 'premium', name: 'Assinaturas', href: 'anuncios.html?cat=premium' }
  ];

  var adsCache = null;
  var profilesCache = null;
  var debounceT = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureOverlay() {
    if (document.getElementById('bzSearchOverlay')) return;
    var el = document.createElement('div');
    el.id = 'bzSearchOverlay';
    el.innerHTML =
      '<div class="bz-search-panel">' +
        '<div class="bz-search-bar">' +
          '<i class="fas fa-search"></i>' +
          '<input type="search" id="bzSearchInput" placeholder="Anúncio, usuário ou categoria" autocomplete="off" enterkeyhint="search">' +
          '<button type="button" class="bz-search-close" id="bzSearchClose" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="bz-search-body" id="bzSearchBody">' +
          '<div class="bz-search-empty">' +
            '<div class="bz-search-empty-icon"><i class="fas fa-keyboard"></i></div>' +
            '<strong>Comece a digitar</strong>' +
            '<p>Digite ao menos 3 letras para buscar.</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    if (!document.getElementById('bzSearchStyles')) {
      var st = document.createElement('style');
      st.id = 'bzSearchStyles';
      st.textContent =
        '#bzSearchOverlay{display:none;position:fixed;inset:0;z-index:99990;background:#f8f8fa;color:#111}' +
        'body.dark-mode #bzSearchOverlay,body[data-theme="dark"] #bzSearchOverlay{background:#0f0f14;color:#f3f4f6}' +
        '#bzSearchOverlay.open{display:block}' +
        '.bz-search-panel{max-width:720px;margin:0 auto;height:100%;display:flex;flex-direction:column}' +
        '.bz-search-bar{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(0,0,0,.08);background:inherit;position:sticky;top:0;z-index:2}' +
        'body.dark-mode .bz-search-bar,body[data-theme="dark"] .bz-search-bar{border-bottom-color:rgba(255,255,255,.08)}' +
        '.bz-search-bar i{color:#9ca3af;font-size:1rem}' +
        '.bz-search-bar input{flex:1;border:0;outline:0;background:transparent;font-size:1rem;color:inherit;padding:8px 0}' +
        '.bz-search-close{border:0;background:#e5e7eb;width:36px;height:36px;border-radius:10px;cursor:pointer;font-size:1rem;color:#374151}' +
        'body.dark-mode .bz-search-close,body[data-theme="dark"] .bz-search-close{background:#1f1f2a;color:#e5e7eb}' +
        '.bz-search-body{flex:1;overflow:auto;padding:12px 16px 40px;-webkit-overflow-scrolling:touch}' +
        '.bz-search-empty{text-align:center;padding:64px 20px;color:#6b7280}' +
        '.bz-search-empty-icon{width:56px;height:56px;border-radius:14px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.4rem;color:#6b7280}' +
        'body.dark-mode .bz-search-empty-icon,body[data-theme="dark"] .bz-search-empty-icon{background:#1f1f2a}' +
        '.bz-search-empty strong{display:block;color:inherit;font-size:1.05rem;margin-bottom:6px}' +
        '.bz-search-empty p{font-size:.9rem;opacity:.85}' +
        '.bz-sec{margin:18px 0 8px;font-size:.75rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af}' +
        '.bz-item{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:12px;text-decoration:none;color:inherit;cursor:pointer}' +
        '.bz-item:hover,.bz-item:active{background:rgba(124,58,237,.08)}' +
        '.bz-item img,.bz-av{width:44px;height:44px;border-radius:10px;object-fit:cover;background:#e5e7eb;flex-shrink:0}' +
        '.bz-av{display:flex;align-items:center;justify-content:center;font-weight:800;color:#7c3aed;font-size:1rem}' +
        '.bz-item .t{font-weight:700;font-size:.95rem;line-height:1.25}' +
        '.bz-item .s{font-size:.8rem;color:#6b7280;margin-top:2px}' +
        '.bz-item .price{margin-left:auto;font-weight:800;color:#7c3aed;font-size:.9rem;white-space:nowrap}' +
        '.bz-badge{font-size:.65rem;font-weight:800;padding:2px 6px;border-radius:999px;background:#ede9fe;color:#6d28d9;margin-left:6px}';
      document.head.appendChild(st);
    }

    document.getElementById('bzSearchClose').onclick = closeSearch;
    el.addEventListener('click', function (e) {
      if (e.target === el) closeSearch();
    });
    document.getElementById('bzSearchInput').addEventListener('input', onInput);
    document.getElementById('bzSearchInput').addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSearch();
    });
  }

  function openSearch(prefill) {
    ensureOverlay();
    var ov = document.getElementById('bzSearchOverlay');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    var inp = document.getElementById('bzSearchInput');
    if (prefill) inp.value = prefill;
    setTimeout(function () { inp.focus(); }, 50);
    if ((inp.value || '').trim().length >= 3) runSearch(inp.value.trim());
    else showEmpty();
  }

  function closeSearch() {
    var ov = document.getElementById('bzSearchOverlay');
    if (ov) ov.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showEmpty() {
    document.getElementById('bzSearchBody').innerHTML =
      '<div class="bz-search-empty">' +
        '<div class="bz-search-empty-icon"><i class="fas fa-keyboard"></i></div>' +
        '<strong>Comece a digitar</strong>' +
        '<p>Digite ao menos 3 letras para buscar.</p>' +
      '</div>';
  }

  function onInput() {
    var q = (document.getElementById('bzSearchInput').value || '').trim();
    clearTimeout(debounceT);
    if (q.length < 3) {
      showEmpty();
      return;
    }
    document.getElementById('bzSearchBody').innerHTML =
      '<div class="bz-search-empty"><p>Buscando…</p></div>';
    debounceT = setTimeout(function () { runSearch(q); }, 220);
  }

  async function loadAds() {
    if (adsCache) return adsCache;
    if (window.adsDataLive && window.adsDataLive.length) {
      adsCache = window.adsDataLive;
      return adsCache;
    }
    try {
      if (typeof fsGetPublicAds === 'function') {
        adsCache = await fsGetPublicAds(80);
        return adsCache;
      }
    } catch (e) {}
    adsCache = [];
    return adsCache;
  }

  async function loadProfiles() {
    if (profilesCache) return profilesCache;
    var map = {};
    try {
      var ads = await loadAds();
      ads.forEach(function (a) {
        var uid = a.sellerUid || (a.raw && a.raw.sellerUid) || '';
        if (!uid) return;
        if (!map[uid]) {
          map[uid] = {
            uid: uid,
            name: a.seller || (a.raw && a.raw.sellerName) || 'Vendedor',
            photo: a.sellerPhoto || (a.raw && a.raw.sellerPhoto) || ''
          };
        }
      });
    } catch (e) {}
    try {
      if (firebase.firestore) {
        var snap = await firebase.firestore().collection('profiles').limit(80).get();
        snap.forEach(function (d) {
          var p = d.data() || {};
          var name = p.displayName || p.name || '';
          if (!name) return;
          map[d.id] = {
            uid: d.id,
            name: name,
            photo: p.photo || p.photoURL || ''
          };
        });
      }
    } catch (e) {}
    profilesCache = Object.keys(map).map(function (k) { return map[k]; });
    return profilesCache;
  }

  function visOf(ad) {
    return String(ad.visibility || (ad.raw && ad.raw.visibility) || 'prata').toLowerCase();
  }

  async function runSearch(q) {
    q = q.toLowerCase();
    var body = document.getElementById('bzSearchBody');
    try {
      var ads = await loadAds();
      var users = await loadProfiles();

      var catHits = CATS.filter(function (c) {
        return c.name.toLowerCase().indexOf(q) >= 0 || c.id.indexOf(q) >= 0;
      });

      var adHits = ads.filter(function (a) {
        var st = (a.raw && a.raw.status) || a.status || 'ativo';
        if (st !== 'ativo') return false;
        var t = (a.title || '').toLowerCase();
        var s = (a.seller || '').toLowerCase();
        var c = (a.categoryLabel || a.category || '').toLowerCase();
        return t.indexOf(q) >= 0 || s.indexOf(q) >= 0 || c.indexOf(q) >= 0;
      });
      // Diamante no topo da busca
      adHits.sort(function (a, b) {
        var da = visOf(a) === 'diamante' ? 1 : 0;
        var db = visOf(b) === 'diamante' ? 1 : 0;
        if (db !== da) return db - da;
        if (typeof bloxzuhVisRank === 'function') {
          return bloxzuhVisRank(visOf(b)) - bloxzuhVisRank(visOf(a));
        }
        return 0;
      });
      adHits = adHits.slice(0, 20);

      var userHits = users.filter(function (u) {
        return (u.name || '').toLowerCase().indexOf(q) >= 0;
      }).slice(0, 12);

      if (!catHits.length && !adHits.length && !userHits.length) {
        body.innerHTML =
          '<div class="bz-search-empty">' +
            '<div class="bz-search-empty-icon"><i class="fas fa-search"></i></div>' +
            '<strong>Nada encontrado</strong>' +
            '<p>Tente outro termo.</p>' +
          '</div>';
        return;
      }

      var html = '';
      if (catHits.length) {
        html += '<div class="bz-sec">Categorias</div>';
        catHits.forEach(function (c) {
          html += '<a class="bz-item" href="' + esc(c.href) + '">' +
            '<div class="bz-av"><i class="fas fa-gamepad"></i></div>' +
            '<div><div class="t">' + esc(c.name) + '</div><div class="s">Categoria</div></div></a>';
        });
      }
      if (userHits.length) {
        html += '<div class="bz-sec">Usuários</div>';
        userHits.forEach(function (u) {
          var href = 'perfil.html?uid=' + encodeURIComponent(u.uid) + '&name=' + encodeURIComponent(u.name);
          var av = u.photo
            ? '<img src="' + esc(u.photo) + '" alt="">'
            : '<div class="bz-av">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div>';
          html += '<a class="bz-item" href="' + href + '">' + av +
            '<div><div class="t">' + esc(u.name) + '</div><div class="s">Ver perfil</div></div></a>';
        });
      }
      if (adHits.length) {
        html += '<div class="bz-sec">Anúncios</div>';
        adHits.forEach(function (a) {
          var href = 'anuncio.html?id=' + encodeURIComponent(a.id);
          var cover = a.cover
            ? '<img src="' + esc(a.cover) + '" alt="">'
            : '<div class="bz-av"><i class="fas fa-box"></i></div>';
          var badge = visOf(a) === 'diamante' ? '<span class="bz-badge">Destaque</span>' : '';
          var price = 'R$ ' + (Number(a.price) || 0).toFixed(2).replace('.', ',');
          html += '<a class="bz-item" href="' + href + '">' + cover +
            '<div style="min-width:0;flex:1"><div class="t">' + esc(a.title) + badge + '</div>' +
            '<div class="s">' + esc(a.seller || '') + ' · ' + esc(a.categoryLabel || a.category || '') + '</div></div>' +
            '<div class="price">' + price + '</div></a>';
        });
      }
      body.innerHTML = html;
    } catch (e) {
      console.warn(e);
      body.innerHTML = '<div class="bz-search-empty"><p>Erro ao buscar. Tente de novo.</p></div>';
    }
  }

  function wireTriggers() {
    // botão da lupa no header
    document.querySelectorAll('.header-icon-btn[title="Buscar"], #btnOpenSearch, [data-open-search]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openSearch();
      });
    });
    // campo da home
    var home = document.getElementById('homeSearch');
    if (home) {
      home.addEventListener('focus', function () {
        openSearch(home.value || '');
      });
      home.addEventListener('click', function () {
        openSearch(home.value || '');
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireTriggers);
  } else {
    wireTriggers();
  }

  window.bloxzuhOpenSearch = openSearch;
  window.bloxzuhCloseSearch = closeSearch;
})();
