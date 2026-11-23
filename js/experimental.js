/**
 * Versão experimental + fundo em tempo real (v6)
 * Anuncio page + categorias + takeover inline
 */
(function () {

  (function () {
    if (document.getElementById('bz-brand-css-early')) return;
    var s = document.createElement('style');
    s.id = 'bz-brand-css-early';
    s.textContent = '.logo-icon i.fa-bolt,.logo-i i.fa-bolt,.logo i.fa-bolt,.logo-icon i.fas,.logo-i i.fas{display:none!important;opacity:0!important;font-size:0!important}' +
      '.logo-icon,.logo-i,.header .logo-icon,.logo .logo-icon{background:transparent url(https://i.ibb.co/Rp7zLN9J/acce3b9a1d18.png) center/contain no-repeat!important;background-image:url(https://i.ibb.co/Rp7zLN9J/acce3b9a1d18.png)!important;box-shadow:none!important;background-color:transparent!important}';
    (document.head || document.documentElement).appendChild(s);
  })();

  // Fix Minha Conta (PC): cards legíveis + inline styles
  function fixContaPage() {
    try {
      var path = (location.pathname || '').toLowerCase();
      if (path.indexOf('conta') === -1) return;

      if (!document.getElementById('bz-conta-fix')) {
        var s = document.createElement('style');
        s.id = 'bz-conta-fix';
        s.textContent =
          '.conta-page{position:relative!important;z-index:20!important;isolation:isolate!important}' +
          '.conta-card{position:relative!important;z-index:20!important;background:#1a1a24!important;border:1px solid #2d2d3a!important;color:#f3f4f6!important;border-radius:16px!important;padding:24px 20px!important;margin-bottom:16px!important;box-shadow:0 8px 32px rgba(0,0,0,.65)!important;opacity:1!important;visibility:visible!important;backdrop-filter:none!important}' +
          '.conta-card h2,.conta-card label,.conta-card p,.conta-card .danger-text,.conta-card .avatar-edit,.conta-card span{color:#f3f4f6!important}' +
          '.conta-card input,.conta-card textarea{background:#0f0f14!important;color:#f3f4f6!important;border:1.5px solid #2d2d3a!important;width:100%!important;opacity:1!important}' +
          '.conta-card input:disabled{opacity:.95!important;color:#e5e7eb!important;-webkit-text-fill-color:#e5e7eb!important}' +
          '#avatarBox,.avatar-placeholder{background:linear-gradient(135deg,#7c3aed,#a78bfa)!important;color:#fff!important}' +
          '.header{position:sticky!important;top:0!important;z-index:100!important;background:#14141c!important}' +
          'body.exp-bg .conta-card{background:rgba(22,16,35,.98)!important;border-color:rgba(167,139,250,.45)!important}' +
          '#bzBgLayer{z-index:0!important;pointer-events:none!important}' +
          'body.exp-bg{background-attachment:scroll!important}';
        (document.head || document.documentElement).appendChild(s);
      }

      document.querySelectorAll('.conta-card').forEach(function (el) {
        el.style.setProperty('background', 'rgba(22,16,35,0.98)', 'important');
        el.style.setProperty('color', '#f3f4f6', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('position', 'relative', 'important');
        el.style.setProperty('z-index', '20', 'important');
      });
      document.querySelectorAll('.conta-page').forEach(function (el) {
        el.style.setProperty('position', 'relative', 'important');
        el.style.setProperty('z-index', '20', 'important');
      });
      document.querySelectorAll('.conta-card input, .conta-card textarea, .conta-card label, .conta-card h2, .conta-card p').forEach(function (el) {
        el.style.setProperty('color', '#f3f4f6', 'important');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.style.setProperty('background', '#0f0f14', 'important');
          el.style.setProperty('-webkit-text-fill-color', '#f3f4f6', 'important');
        }
      });
      console.log('[Bloxzuh] conta-fix ativo (PC)');
    } catch (e) { console.warn(e); }
  }
  fixContaPage();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fixContaPage);
  setTimeout(fixContaPage, 100);
  setTimeout(fixContaPage, 500);
  setTimeout(fixContaPage, 1500);

  try {
    if (!document.querySelector('script[src*="brand.js"]')) {
      var sb = document.createElement('script');
      sb.src = 'js/brand.js';
      (document.head || document.documentElement).appendChild(sb);
    }
  } catch (eb) {}

  var backgroundDevice = null, backgroundBusy = false, backgroundEdit = 0, lastBgFocus;
  function backgroundSettings() {
    var value;try { value=JSON.parse(localStorage.getItem(expStorageKey()+'-backgrounds-v2')||'null'); } catch(e) {}
    return BloxzuhBackgrounds.normalize(value,getBgIndex());
  }
  async function saveBackgrounds(settings) {
    backgroundEdit++;
    localStorage.setItem(expStorageKey()+'-backgrounds-v2',JSON.stringify(settings));
    applyExperimentalBackground();
    var u=currentUser();
    if(u&&firebase.firestore)await firebase.firestore().collection('profiles').doc(u.uid).set({experimentalBackgrounds:settings,updatedAtMs:Date.now()},{merge:true});
  }

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
    var email = localStorage.getItem('xinzuh-email') || '';
    var name = localStorage.getItem('xinzuh-username') || 'guest';
    return 'bloxzuh-exp-' + (email || name);
  }
  function legacyExpKey() {
    var email = localStorage.getItem('xinzuh-email') || '';
    var name = localStorage.getItem('xinzuh-username') || 'guest';
    return 'xinzuh-exp-' + (email || name);
  }
  function isExperimental() {
    if (localStorage.getItem(expStorageKey() + '-on') === '1') return true;
    if (localStorage.getItem(legacyExpKey() + '-on') === '1') return true;
    return false;
  }
  function writeExpOn(on) {
    var v = on ? '1' : '0';
    localStorage.setItem(expStorageKey() + '-on', v);
    localStorage.setItem(legacyExpKey() + '-on', v);
  }
  function writeExpBg(idx) {
    localStorage.setItem(expStorageKey() + '-bg', String(idx));
    localStorage.setItem(legacyExpKey() + '-bg', String(idx));
  }
  function getBgIndex() {
    var v = localStorage.getItem(expStorageKey() + '-bg');
    if (v === null || v === '') v = localStorage.getItem(legacyExpKey() + '-bg');
    if (v === null || v === '') return -1;
    var n = parseInt(v, 10);
    return isNaN(n) ? -1 : n;
  }
  function isMobileView() { return window.matchMedia('(max-width: 768px)').matches; }
  function isPainelPage() {
    try { return (location.pathname || '').toLowerCase().indexOf('painel') !== -1; } catch (e) { return false; }
  }

  function isAdDetailPage() {
    try { return /(?:^|\/)anuncio(?:\.html)?\/?$/i.test(location.pathname || ''); } catch (e) { return false; }
  }

  function injectCoverFix() {
    var id = 'bz-cover-fix';
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id;
    s.textContent =
      '.wrap,#page{position:relative;z-index:2!important}' +
      '.cover,.cover-carousel{position:relative;z-index:5!important;width:100%!important;' +
      'aspect-ratio:16/10!important;min-height:220px!important;overflow:hidden!important;' +
      'border-radius:16px!important;background:#1e1b4b!important;margin:8px 0 12px!important;display:block!important}' +
      '.cover img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;opacity:1!important}' +
      '.cover-carousel .slides{position:absolute!important;inset:0!important;display:flex!important;width:100%!important;height:100%!important;transition:transform .28s ease}' +
      '.cover-carousel .slides .slide{flex:0 0 100%!important;width:100%!important;height:100%!important;position:relative!important}' +
      '.cover-carousel .slides .slide img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;opacity:1!important}' +
      '.cover-carousel .nav{z-index:6!important}';
    document.head.appendChild(s);
  }

  function injectCatFix() {
    var css =
      'body.exp-bg .category-card{background:rgba(15,10,25,.94)!important;border:1px solid rgba(167,139,250,.4)!important;box-shadow:0 4px 16px rgba(0,0,0,.4)}' +
      'body.exp-bg .category-card h3{color:#f3f4f6!important;text-shadow:0 1px 3px rgba(0,0,0,.9)!important;background:rgba(10,6,18,.75)!important;margin:0;padding:10px 8px 12px;display:block}' +
      'body.exp-bg .product-card{background:rgba(15,10,25,.94)!important;border:1px solid rgba(167,139,250,.28)!important}' +
      'body.exp-bg .product-body h3,body.exp-bg .product-price,body.exp-bg .product-seller{color:#f3f4f6!important}' +
      'body.exp-bg .header{background:rgba(15,10,25,.92)!important;backdrop-filter:blur(10px)}' +
      'body.exp-bg .footer{background:rgba(15,10,25,.92)!important}' +
      'body.exp-bg .section-title,body.exp-bg .hero-tag,body.exp-bg .hero-sub{color:#f3f4f6!important;text-shadow:0 2px 8px rgba(0,0,0,.75)}' +
      'body.exp-bg main,body.exp-bg .container,body.exp-bg .section,body.exp-bg .hero,body.exp-bg .wrap,body.exp-bg .top,body.exp-bg #page,body.exp-bg .page,body.exp-bg .conta-page,body.exp-bg .conta-card{position:relative;z-index:5!important}' +
      'body.exp-bg .top,body.exp-bg .header{background:rgba(15,10,25,.95)!important;border-bottom:1px solid rgba(167,139,250,.25)!important;z-index:30!important}' +
      'body.exp-bg .card,body.exp-bg .item-sel,body.exp-bg .panel,body.exp-bg .box,body.exp-bg .conta-card{background:rgba(15,10,25,.97)!important;border-color:rgba(167,139,250,.35)!important;color:#f3f4f6!important}' +
      'body.exp-bg .wrap,body.exp-bg .conta-page,body.exp-bg .conta-card,body.exp-bg label,body.exp-bg h1,body.exp-bg h2,body.exp-bg h3,body.exp-bg p{color:#f3f4f6!important}' +
      'body.exp-bg input,body.exp-bg textarea,body.exp-bg select{background:#0f0f14!important;color:#f3f4f6!important;border-color:#2d2d3a!important}' +
      'body.exp-bg input:disabled{opacity:.85;color:#d1d5db!important}' +
      'body.exp-bg .avatar-placeholder,body.exp-bg #avatarBox{background:#7c3aed!important;color:#fff!important}' +
      'body.exp-bg .msg{position:relative;z-index:3}' +
      '#bzBgLayer{position:fixed;inset:0;z-index:0;pointer-events:none;background-size:cover;background-position:center;background-repeat:no-repeat}' +
      'body:not(.exp-bg){background-image:none!important}' +
      '.conta-page{position:relative;z-index:5!important}' +
      '.conta-card{position:relative;z-index:5!important;background:#1a1a24!important;color:#f3f4f6!important}';
    var s = document.getElementById('bz-exp-cat-fix');
    if (!s) {
      s = document.createElement('style');
      s.id = 'bz-exp-cat-fix';
      document.head.appendChild(s);
    }
    s.textContent = css;
  }

  function forceDarkBg() {
    document.documentElement.setAttribute('data-mode', 'dark');
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

  function ensureLayer() {
    var layer = document.getElementById('bzBgLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'bzBgLayer';
      if (document.body.firstChild) document.body.insertBefore(layer, document.body.firstChild);
      else document.body.appendChild(layer);
    }
    return layer;
  }

  function clearBg() {
    document.body.classList.remove('exp-bg');
    document.documentElement.classList.remove('exp-bg');
    try {
      document.body.style.removeProperty('background-image');
      document.body.style.removeProperty('background-size');
      document.body.style.removeProperty('background-position');
      document.body.style.removeProperty('background-attachment');
      document.body.style.removeProperty('background-repeat');
      document.body.style.removeProperty('--exp-bg-image');
    } catch (e) {}
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#0f0f14';
    document.documentElement.style.removeProperty('--exp-bg-image');
    var layer = document.getElementById('bzBgLayer');
    if (layer) {
      layer.style.backgroundImage = 'none';
      layer.style.display = 'none';
    }
    forceDarkBg();
    void document.body.offsetHeight;
  }

  function applyExperimentalBackground() {
    injectCoverFix();
    injectCatFix();
    forceDarkBg();
    // The public ad background belongs to that ad, never to the visitor's experimental preferences.
    if (isPainelPage() || isAdDetailPage()) {
      var b = document.getElementById('bgChangeBtn');
      if (b) { b.classList.remove('show'); b.style.display = 'none'; }
      clearBg();
      return;
    }
    var btn = document.getElementById('bgChangeBtn');
    var on = isExperimental() && isLogged();
    if (btn) {
      if (on) { btn.classList.add('show'); btn.style.display = 'inline-flex'; }
      else { btn.classList.remove('show'); btn.style.display = 'none'; }
    }
    if (!on) { clearBg(); return; }
    var url = BloxzuhBackgrounds.pick(backgroundSettings(),isMobileView()?'mobile':'desktop');
    if (!url) { clearBg(); return; }
    document.body.classList.add('exp-bg');
    document.documentElement.classList.add('exp-bg');
    document.documentElement.style.setProperty('--exp-bg-image', 'url("' + url + '")');
    document.body.style.setProperty('--exp-bg-image', 'url("' + url + '")');
    document.body.style.backgroundColor = '#0f0f14';
    document.body.style.backgroundImage = 'url("' + url + '")';
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = (window.matchMedia('(max-width: 768px)').matches ? 'scroll' : 'scroll');
    document.body.style.backgroundRepeat = 'no-repeat';
    var layer = ensureLayer();
    layer.style.display = 'block';
    layer.style.backgroundImage = 'url("' + url + '")';
    layer.style.backgroundSize = 'cover';
    layer.style.backgroundPosition = 'center';
    layer.style.backgroundRepeat = 'no-repeat';
    void document.body.offsetHeight;
    try { if (typeof fixContaPage === 'function') fixContaPage(); } catch (eC) {}
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
    writeExpOn(!!on);
    var t2 = document.getElementById('expToggle');
    if (t2) t2.checked = !!on;
    persistToProfile({ experimentalOn: !!on, updatedAtMs: Date.now() });
    applyExperimentalBackground();
  }

  function renderBackgrounds() {
    var device=backgroundDevice,settings=backgroundSettings(),row=settings[device],grid=document.getElementById('bgGrid');
    document.getElementById('bgDeviceHint').textContent=device==='desktop'?'Fundos horizontais para PC. Sua escolha não muda o fundo do celular.':'Fundos verticais para celular. Sua escolha não muda o fundo do PC.';
    document.querySelectorAll('[data-bg-device]').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.bgDevice===device));});
    grid.replaceChildren();
    BloxzuhBackgrounds.presets[device].forEach(function(preset,i){
      var button=document.createElement('button'),img=document.createElement('img'),label=document.createElement('span');
      button.type='button';button.className='bg-opt';button.setAttribute('aria-pressed',String(!row.custom&&row.preset===i));img.src=preset.url;img.alt='';label.textContent=preset.name;button.append(img,label);
      button.onclick=async function(){if(backgroundBusy)return;settings[device]={preset:i,custom:''};await storeChoice(settings);renderBackgrounds();};grid.append(button);
    });
    var custom=document.getElementById('bgCustomPreview');custom.hidden=!row.custom;
    if(row.custom)custom.src=row.custom;else custom.removeAttribute('src');
    document.getElementById('bgUpload').value='';
  }
  async function storeChoice(settings) {
    backgroundBusy=true;document.getElementById('bgStatus').textContent='Salvando…';
    document.getElementById('bgUpload').disabled=true;
    try{await saveBackgrounds(settings);document.getElementById('bgStatus').textContent=currentUser()?'Fundo salvo na sua conta.':'Fundo salvo neste navegador.';}
    catch(error){document.getElementById('bgStatus').textContent='Aplicado neste navegador. Não foi possível sincronizar com a conta; tente novamente.';}
    finally{backgroundBusy=false;document.getElementById('bgUpload').disabled=false;}
  }
  function openBgModal() {
    ensureModal();backgroundDevice=isMobileView()?'mobile':'desktop';lastBgFocus=document.activeElement;
    renderBackgrounds();document.getElementById('bgStatus').textContent='';document.getElementById('bgModal').showModal();document.getElementById('bgClose').focus();
  }
  function closeBgModal() {var modal=document.getElementById('bgModal');if(modal)modal.close();if(lastBgFocus)lastBgFocus.focus();}
  async function resetBg() {
    if(backgroundBusy)return;
    var settings=backgroundSettings();settings[backgroundDevice]={preset:-1,custom:''};await storeChoice(settings);renderBackgrounds();
  }
  function ensureModal() {
    if(document.getElementById('bgModal'))return;
    if(!document.getElementById('bzBackgroundPickerCss')){var link=document.createElement('link');link.id='bzBackgroundPickerCss';link.rel='stylesheet';link.href='/css/background-picker.css?v=2';document.head.append(link);}
    var btn=document.createElement('button');btn.type='button';btn.id='bgChangeBtn';btn.textContent='Mudar fundo';btn.onclick=openBgModal;document.body.append(btn);
    var modal=document.createElement('dialog');modal.id='bgModal';modal.setAttribute('aria-labelledby','bgTitle');
    modal.innerHTML='<div class="bg-panel"><div class="bg-heading"><div><span class="bg-eyebrow">DO SEU JEITO</span><h2 id="bgTitle">Personalizar meu fundo</h2></div><button type="button" id="bgClose" aria-label="Fechar personalização">×</button></div><p class="bg-description">Visível só para você, com a versão experimental ligada.</p><div class="bg-devices" role="group" aria-label="Dispositivo"><button type="button" data-bg-device="desktop">PC</button><button type="button" data-bg-device="mobile">Celular</button></div><p id="bgDeviceHint"></p><div class="bg-grid" id="bgGrid"></div><div class="bg-upload"><label for="bgUpload">Usar minha imagem</label><p>JPG, PNG ou WebP · até 10 MB. A imagem é ajustada para salvar na sua conta.</p><input type="file" id="bgUpload" accept="image/jpeg,image/png,image/webp"><img id="bgCustomPreview" alt="Sua imagem de fundo" hidden></div><p id="bgStatus" role="status"></p><button type="button" id="bgReset">Usar fundo padrão neste dispositivo</button></div>';
    document.body.append(modal);
    document.getElementById('bgClose').onclick=closeBgModal;document.getElementById('bgReset').onclick=resetBg;
    modal.querySelectorAll('[data-bg-device]').forEach(function(button){button.onclick=function(){if(backgroundBusy)return;backgroundDevice=button.dataset.bgDevice;renderBackgrounds();};});
    document.getElementById('bgUpload').onchange=async function(event){
      var file=event.target.files[0];if(!file||backgroundBusy)return;
      var device=backgroundDevice; backgroundBusy=true;event.target.disabled=true;document.getElementById('bgStatus').textContent='Preparando imagem…';
      try{var image=await BloxzuhBackgrounds.readFile(file),settings=backgroundSettings();settings[device]={preset:-1,custom:image};await storeChoice(settings);renderBackgrounds();}
      catch(error){document.getElementById('bgStatus').textContent=error.message;}
      finally{backgroundBusy=false;event.target.disabled=false;}
    };
    modal.addEventListener('click',function(event){if(event.target===modal){var rect=modal.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeBgModal();}});
  }

  function wireModal() { ensureModal(); }

  function loadFromProfileThenApply() {
    forceDarkBg();
    var u = currentUser();
    if (!u || !firebase.firestore) { applyExperimentalBackground(); return; }
    var editAtLoad=backgroundEdit;
    firebase.firestore().collection('profiles').doc(u.uid).get().then(function (doc) {
      if(currentUser()?.uid!==u.uid||editAtLoad!==backgroundEdit)return;
      if (doc.exists) {
        var d = doc.data() || {};
        if (d.experimentalOn === true) writeExpOn(true);
        if (d.experimentalOn === false) writeExpOn(false);
        if (typeof d.experimentalBg === 'number') writeExpBg(d.experimentalBg);
        if(d.experimentalBackgrounds)localStorage.setItem(expStorageKey()+'-backgrounds-v2',JSON.stringify(BloxzuhBackgrounds.normalize(d.experimentalBackgrounds,d.experimentalBg)));
      }
      var t = document.getElementById('expToggle');
      if (t) t.checked = isExperimental();
      applyExperimentalBackground();
    }).catch(function () { applyExperimentalBackground(); });
  }

  function takeOver() {
    window.setExperimental = setExperimental;
    window.applyExperimentalBackground = applyExperimentalBackground;
    window.isExperimental = isExperimental;
    window.resetBg = resetBg;
    window.openBgModal = openBgModal;
    window.closeBgModal = closeBgModal;
    window.expStorageKey = expStorageKey;
    window.bgUserKey = expStorageKey;
  }

  function boot() {
    injectCoverFix();
    injectCatFix();
    forceDarkBg();
    takeOver();
    wireModal();
    applyExperimentalBackground();
    setTimeout(takeOver, 0);
    setTimeout(function () { takeOver(); wireModal(); applyExperimentalBackground(); }, 100);
    setTimeout(takeOver, 500);
    setTimeout(function () { takeOver(); applyExperimentalBackground(); }, 1200);
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
  takeOver();

  try {
    if ((location.pathname || '').toLowerCase().indexOf('anuncio') !== -1) {
      if (!document.querySelector('script[src*="anuncio-cover-fix"]')) {
        var sc = document.createElement('script');
        sc.src = 'js/anuncio-cover-fix.js';
        document.head.appendChild(sc);
      }
    }
  } catch (e0) {}

  try {
    if (!document.querySelector('script[src*="profile-name-sync"]')) {
      var s = document.createElement('script');
      s.src = 'js/profile-name-sync.js';
      s.async = true;
      document.head.appendChild(s);
    }
  } catch (e) {}

})();
