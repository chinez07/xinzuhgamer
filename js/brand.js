/**
 * Logo + favicon Bloxzuh (B com coroa) — v3 com imagens locais desde o HTML
 */
(function () {
  var LOGO = 'assets/bloxzuh-logo.png';
  var LOGO_HD = 'assets/bloxzuh-logo-hd.png';
  var FAVICON = 'assets/bloxzuh-favicon.png';

  (function injectBrandCss() {
    if (document.getElementById('bz-brand-css')) return;
    var s = document.createElement('style');
    s.id = 'bz-brand-css';
    s.textContent =
      '.logo-icon i.fa-bolt,.logo-i i.fa-bolt,.logo i.fa-bolt{display:none!important}' +
      '.logo-icon:not([data-bz-logo="1"]),.logo-i:not([data-bz-logo="1"]){' +
      'background:transparent url(' + LOGO + ') center/contain no-repeat!important;' +
      'box-shadow:none!important}' +
      '.logo-icon img,.logo-i img{width:100%;height:100%;object-fit:contain;display:block}';
    (document.head || document.documentElement).appendChild(s);
  })();

  function setFavicon() {
    try {
      [
        { rel: 'icon', type: 'image/png', href: FAVICON, sizes: '32x32' },
        { rel: 'shortcut icon', href: FAVICON },
        { rel: 'apple-touch-icon', href: LOGO_HD }
      ].forEach(function (cfg) {
        var el = document.querySelector('link[rel="' + cfg.rel + '"]');
        if (!el) {
          el = document.createElement('link');
          el.rel = cfg.rel;
          document.head.appendChild(el);
        }
        if (cfg.type) el.type = cfg.type;
        if (cfg.sizes) el.setAttribute('sizes', cfg.sizes);
        el.href = cfg.href;
      });
    } catch (e) {}
  }

  function applyImg(el, size) {
    if (!el) return;
    size = size || 36;
    el.setAttribute('data-bz-logo', '1');
    el.style.cssText = 'background:transparent!important;box-shadow:none!important;overflow:visible;display:inline-flex;align-items:center;justify-content:center;padding:0;width:' + size + 'px;height:' + size + 'px;min-width:' + size + 'px;border-radius:10px;';
    var img = el.querySelector('img');
    if (!img) {
      el.innerHTML = '';
      img = document.createElement('img');
      el.appendChild(img);
    }
    if (img.getAttribute('src') !== LOGO) img.src = LOGO;
    img.alt = '';
    img.width = size;
    img.height = size;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
  }

  function replaceLogos() {
    try {
      document.querySelectorAll('.logo-icon, .logo-i').forEach(function (el) {
        applyImg(el, 36);
      });
      document.querySelectorAll('a.logo i.fa-bolt, .logo i.fa-bolt').forEach(function (i) {
        var wrap = document.createElement('span');
        wrap.className = 'logo-icon';
        if (i.parentNode) i.parentNode.replaceChild(wrap, i);
        applyImg(wrap, 36);
      });
    } catch (e) {}
  }

  function run() {
    setFavicon();
    replaceLogos();
  }

  run();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  }
  setTimeout(run, 0);
  setTimeout(run, 50);
  setTimeout(run, 300);
  setTimeout(run, 1000);
  window.bloxzuhApplyBrand = run;
})();
