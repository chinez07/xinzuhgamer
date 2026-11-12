/**
 * Força capa/galeria visíveis na página do anúncio
 */
(function () {
  function forceCoverCss() {
    if (document.getElementById('bz-anuncio-cover-fix')) return;
    var s = document.createElement('style');
    s.id = 'bz-anuncio-cover-fix';
    s.textContent =
      '#page.wrap,.wrap{position:relative!important;z-index:2!important}' +
      '.cover,.cover-carousel{' +
      'position:relative!important;z-index:5!important;display:block!important;' +
      'width:100%!important;min-height:220px!important;height:auto!important;' +
      'aspect-ratio:16/10!important;overflow:hidden!important;border-radius:16px!important;' +
      'background:#1e1b4b!important;margin:8px 0 14px!important}' +
      '.cover img,.cover-carousel .slides .slide img{' +
      'position:absolute!important;top:0!important;left:0!important;right:0!important;bottom:0!important;' +
      'width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;' +
      'opacity:1!important;visibility:visible!important}' +
      '.cover-carousel .slides{position:absolute!important;inset:0!important;display:flex!important;' +
      'width:100%!important;height:100%!important}' +
      '.cover-carousel .slides .slide{flex:0 0 100%!important;width:100%!important;height:100%!important;position:relative!important}' +
      '.cover-carousel .nav{z-index:6!important}';
    document.head.appendChild(s);
  }

  function fixDom() {
    forceCoverCss();
    var covers = document.querySelectorAll('.cover, .cover-carousel');
    covers.forEach(function (el) {
      el.style.position = 'relative';
      el.style.zIndex = '5';
      el.style.minHeight = '220px';
      el.style.width = '100%';
      el.style.display = 'block';
      el.style.overflow = 'hidden';
      el.style.background = '#1e1b4b';
      el.style.aspectRatio = '16/10';
      el.querySelectorAll('img').forEach(function (img) {
        img.style.position = 'absolute';
        img.style.inset = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.display = 'block';
        img.style.opacity = '1';
        img.style.visibility = 'visible';
        if (!img.getAttribute('referrerpolicy')) img.setAttribute('referrerpolicy', 'no-referrer');
      });
      var slides = el.querySelector('.slides');
      if (slides) {
        slides.style.position = 'absolute';
        slides.style.inset = '0';
        slides.style.display = 'flex';
        slides.style.width = '100%';
        slides.style.height = '100%';
      }
    });
  }

  forceCoverCss();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      forceCoverCss();
      setTimeout(fixDom, 50);
      setTimeout(fixDom, 300);
      setTimeout(fixDom, 1000);
      setTimeout(fixDom, 2500);
    });
  } else {
    setTimeout(fixDom, 50);
    setTimeout(fixDom, 300);
    setTimeout(fixDom, 1000);
    setTimeout(fixDom, 2500);
  }

  try {
    var page = document.getElementById('page');
    if (page) {
      var mo = new MutationObserver(function () { fixDom(); });
      mo.observe(page, { childList: true, subtree: true });
    }
  } catch (e) {}

  console.log('[Bloxzuh] anuncio-cover-fix ativo');
})();
