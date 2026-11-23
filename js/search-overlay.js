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
    { id: 'outros', name: 'Outros jogos', href: 'anuncios.html?cat=outros' },
    { id: 'premium', name: 'Assinaturas', href: 'anuncios.html?cat=premium' }
  ];

  var adsCache = null;
  var profilesCache = null;
  var debounceT = null, searchVersion = 0, previousFocus = null, restoringFocus = false, searchAnchor = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureOverlay() {
    if (document.getElementById('bzSearchOverlay')) return;
    var el = document.createElement('dialog');
    el.id = 'bzSearchOverlay';
    el.setAttribute('aria-label','Buscar anúncios, usuários e categorias');
    el.innerHTML =
      '<div class="bz-search-panel">' +
        '<div class="bz-search-bar">' +
          '<i class="fas fa-search"></i>' +
          '<input type="search" id="bzSearchInput" aria-label="Buscar anúncios, usuários e categorias" placeholder="Anúncio, usuário ou categoria" autocomplete="off" enterkeyhint="search">' +
          '<button type="button" class="bz-search-close" id="bzSearchClose" aria-label="Fechar busca">Esc</button>' +
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
      var style=document.createElement('link');style.id='bzSearchStyles';style.rel='stylesheet';style.href='/css/search-overlay.css?v=3';document.head.append(style);
    }
    el.addEventListener('cancel',function(event){event.preventDefault();closeSearch();});
    document.addEventListener('pointerdown',function(event){if(el.open&&!el.contains(event.target)&&!event.target.closest('#homeSearch,#btnOpenSearch,[data-open-search]'))closeSearch(false);},true);
    document.addEventListener('keydown',function(event){if(el.open&&event.key==='Escape'){event.preventDefault();closeSearch();}});
    window.addEventListener('resize',positionSearch);
    window.addEventListener('scroll',positionSearch,{passive:true});
    document.getElementById('bzSearchClose').onclick = closeSearch;
    el.addEventListener('click', function (e) {
      if (e.target === el) {var box=el.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)closeSearch();}
    });
    document.getElementById('bzSearchInput').addEventListener('input', onInput);
    document.getElementById('bzSearchInput').addEventListener('keydown', function (e) {
      if(e.key==='Enter' && this.value.trim().length>=3){e.preventDefault();location.href='/anuncios?q='+encodeURIComponent(this.value.trim());}
    });
  }

  function positionSearch(force) {
    var overlay=document.getElementById('bzSearchOverlay');if(!overlay||(!overlay.open&&force!==true))return;
    var box=searchAnchor&&searchAnchor.getBoundingClientRect(),width,left,top;
    if(box&&box.top>=60&&box.bottom<window.innerHeight-100){width=Math.min(window.innerWidth-20,box.width+16);left=Math.max(10,Math.min(box.left-8,window.innerWidth-width-10));top=box.top-8;}
    else{width=Math.min(720,window.innerWidth-20);left=(window.innerWidth-width)/2;top=80;}
    overlay.style.position='fixed';overlay.style.width=width+'px';overlay.style.left=left+'px';overlay.style.top=top+'px';
    overlay.style.setProperty('--bz-search-space',Math.max(180,window.innerHeight-top-12)+'px');
  }

  function openSearch(prefill) {
    if(restoringFocus)return;
    ensureOverlay();
    var ov = document.getElementById('bzSearchOverlay');
    if(ov.open)return;
    previousFocus=document.activeElement;
    var home=document.getElementById('homeSearch');searchAnchor=home&&home.closest('.search-box');
    positionSearch(true);ov.show();
    var inp = document.getElementById('bzSearchInput');
    if (typeof prefill==='string') inp.value = prefill;
    inp.focus({preventScroll:true});
    if ((inp.value || '').trim().length >= 3) runSearch(inp.value.trim());
    else showEmpty();
  }

  function closeSearch(restoreFocus) {
    var ov = document.getElementById('bzSearchOverlay');
    searchVersion++;clearTimeout(debounceT);
    restoringFocus=true;
    if (ov && ov.open) ov.close();
    if(restoreFocus!==false && previousFocus && previousFocus.isConnected)previousFocus.focus({preventScroll:true});
    restoringFocus=false;
  }

  function showEmpty() {
    var featured=CATS.filter(function(c){return ['roblox','freefire','valorant','lol','fortnite','genshin'].includes(c.id);});
    document.getElementById('bzSearchBody').innerHTML='<div class="bz-discover"><section><h2 class="bz-sec">Explorar categorias</h2>'+featured.map(function(c){return '<a class="bz-item bz-category" href="'+esc(c.href)+'"><img src="/assets/categorias/'+c.id+'.jpg" alt=""><span class="t">'+esc(c.name)+'</span><span class="bz-arrow" aria-hidden="true">↗</span></a>';}).join('')+'</section><section><h2 class="bz-sec">Encontre no Bloxzuh</h2><a class="bz-item" href="/anuncios"><span class="bz-av" aria-hidden="true">↗</span><span><span class="t">Todos os anúncios</span><span class="s">Explore as ofertas disponíveis</span></span></a><a class="bz-item" href="/categorias"><span class="bz-av" aria-hidden="true">▦</span><span><span class="t">Todas as categorias</span><span class="s">Escolha seu jogo ou produto</span></span></a><a class="bz-item" href="/favoritos"><span class="bz-av" aria-hidden="true">♡</span><span><span class="t">Meus favoritos</span><span class="s">Volte aos anúncios que você salvou</span></span></a></section></div><p class="bz-search-hint">Digite pelo menos 3 letras para buscar anúncios, usuários e categorias.</p>';
  }

  function onInput() {
    var q = (document.getElementById('bzSearchInput').value || '').trim();
    clearTimeout(debounceT);searchVersion++;
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
        var response=await fetch('https://bloxzuh-pix.hskkaj48.workers.dev/market/public-profiles');
        if(!response.ok)throw Error('Busca de perfis indisponível.');
        (await response.json()).profiles.forEach(function(p){var name=p.displayName||p.name||'';if(name)map[p.uid]={uid:p.uid,name:name,photo:p.photo||p.photoURL||''};});
      }
    } catch (e) {}
    profilesCache = Object.keys(map).map(function (k) { return map[k]; });
    return profilesCache;
  }

  function visOf(ad) {
    return String(ad.visibility || (ad.raw && ad.raw.visibility) || 'prata').toLowerCase();
  }

  async function runSearch(q) {
    var version=++searchVersion;
    q = q.toLowerCase();
    var body = document.getElementById('bzSearchBody');
    try {
      var ads = await loadAds();
      var users = await loadProfiles();
      if(version!==searchVersion||!document.getElementById('bzSearchOverlay').open)return;

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
      if(version!==searchVersion||!document.getElementById('bzSearchOverlay').open)return;
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
        if(restoringFocus)return;
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
