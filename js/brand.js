/**
 * Logo + favicon Bloxzuh (B com coroa)
 */
(function () {
  var LOGO = 'https://i.ibb.co/Rp7zLN9J/acce3b9a1d18.png';
  var LOGO_HD = 'https://i.ibb.co/5gNDMtF4/ac9afc57bcc1.png';
  var FAVICON = 'https://i.ibb.co/0jK0YF2L/e058937827d3.png';

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
    if (!el || el.getAttribute('data-bz-logo') === '1') return;
    el.setAttribute('data-bz-logo', '1');
    size = size || 36;
    el.style.cssText = 'background:transparent!important;box-shadow:none!important;overflow:visible;display:inline-flex;align-items:center;justify-content:center;padding:0;width:' + size + 'px;height:' + size + 'px;min-width:' + size + 'px;border-radius:10px;';
    el.innerHTML = '';
    var img = document.createElement('img');
    img.src = LOGO;
    img.alt = 'Bloxzuh';
    img.width = size;
    img.height = size;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
    el.appendChild(img);
  }

  function replaceLogos() {
    try {
      document.querySelectorAll('.logo-icon, .logo-i').forEach(function (el) {
        applyImg(el, 36);
      });
      document.querySelectorAll('a.logo i.fa-bolt, .logo i.fa-bolt, .logo i.fas.fa-bolt').forEach(function (i) {
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 50);
  setTimeout(run, 400);
  setTimeout(run, 1500);
  window.bloxzuhApplyBrand = run;
})();
