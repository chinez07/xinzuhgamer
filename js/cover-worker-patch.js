/**
 * Upload capa + galeria via Cloudflare Worker (ImgBB)
 * Carregar DEPOIS de firestore-db.js
 */
(function () {
  function compressImageFile(file, maxSide, quality) {
    maxSide = maxSide || 320;
    quality = quality || 0.42;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxSide || h > maxSide) {
            if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
            else { w = Math.round(w * maxSide / h); h = maxSide; }
          }
          var c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = function () { reject(new Error('Imagem inválida')); };
        img.src = reader.result;
      };
      reader.onerror = function () { reject(new Error('Falha ao ler arquivo')); };
      reader.readAsDataURL(file);
    });
  }

  async function prepareAdCover(file) {
    if (!file) return '';
    console.log('[Bloxzuh] prepareAdCover', file && file.name, 'worker=', window.BLOXZUH_IMGBB_WORKER);
    var dataUrl = await compressImageFile(file, 320, 0.42);
    if (dataUrl.length > 220000) dataUrl = await compressImageFile(file, 240, 0.32);
    if (dataUrl.length > 220000) dataUrl = await compressImageFile(file, 180, 0.28);

    var worker = (window.BLOXZUH_IMGBB_WORKER || '').trim();
    if (worker) {
      try {
        var b64 = dataUrl.split(',')[1] || '';
        var res = await fetch(worker, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64 })
        });
        var json = await res.json();
        if (json && json.success && json.data && (json.data.url || json.data.display_url)) {
          var url = json.data.url || json.data.display_url;
          console.log('[Bloxzuh] imagem OK via Worker:', url);
          return url;
        }
        console.warn('[Bloxzuh] Worker resposta', json);
      } catch (e) {
        console.warn('[Bloxzuh] Worker erro', e);
      }
    }
    if (dataUrl.length > 250000) return '';
    return dataUrl;
  }

  window.prepareAdCover = prepareAdCover;
  window.__bzGalleryFiles = window.__bzGalleryFiles || [];

  async function dataUrlToHosted(g) {
    if (!g) return '';
    if (String(g).indexOf('http') === 0) return g;
    if (String(g).indexOf('data:') !== 0) return '';
    try {
      var blob = await (await fetch(g)).blob();
      var file = new File([blob], 'img.jpg', { type: blob.type || 'image/jpeg' });
      return await prepareAdCover(file);
    } catch (e) {
      console.warn('[Bloxzuh] dataUrlToHosted', e);
      return '';
    }
  }

  async function ensureHostedImages(data) {
    data = data || {};
    if (data.cover && String(data.cover).indexOf('data:') === 0) {
      var c = await dataUrlToHosted(data.cover);
      if (c) data.cover = c;
      else data.cover = '';
      console.log('[Bloxzuh] capa convertida:', data.cover ? data.cover.slice(0, 60) : '(vazia)');
    }
    var files = window.__bzGalleryFiles || [];
    var urls = [];
    if (files.length) {
      console.log('[Bloxzuh] enviando galeria arquivos:', files.length);
      for (var i = 0; i < files.length && i < 6; i++) {
        try {
          var u = await prepareAdCover(files[i]);
          if (u && String(u).indexOf('http') === 0) {
            urls.push(u);
            console.log('[Bloxzuh] galeria', i + 1, u);
          }
        } catch (e) {
          console.warn('[Bloxzuh] galeria', i, e);
        }
      }
      window.__bzGalleryFiles = [];
    } else if (data.gallery && data.gallery.length) {
      console.log('[Bloxzuh] convertendo gallery dataURL:', data.gallery.length);
      for (var j = 0; j < data.gallery.length && j < 6; j++) {
        var g = data.gallery[j];
        if (!g) continue;
        if (String(g).indexOf('http') === 0) urls.push(g);
        else {
          var uu = await dataUrlToHosted(g);
          if (uu && String(uu).indexOf('http') === 0) urls.push(uu);
        }
      }
    }
    if (urls.length) data.gallery = urls;
    else if (!data.gallery) data.gallery = [];
    console.log('[Bloxzuh] imagens finais capa=', data.cover ? 'sim' : 'não', 'galeria=', (data.gallery || []).length);
    return data;
  }

  function hookGalleryInput() {
    var gal = document.getElementById('galInput');
    if (!gal || gal.getAttribute('data-bz-hook') === '1') return;
    gal.setAttribute('data-bz-hook', '1');
    gal.addEventListener('change', function () {
      try {
        var files = Array.prototype.slice.call(gal.files || [], 0, 6);
        files.forEach(function (f) {
          if (f && f.type && f.type.indexOf('image/') === 0) window.__bzGalleryFiles.push(f);
        });
        if (window.__bzGalleryFiles.length > 6) window.__bzGalleryFiles = window.__bzGalleryFiles.slice(-6);
        console.log('[Bloxzuh] galeria arquivos guardados:', window.__bzGalleryFiles.length);
      } catch (e) {}
    }, true);
  }

  function hookFs() {
    if (typeof window.fsCreateAd === 'function' && !window.fsCreateAd.__bzGal) {
      var origC = window.fsCreateAd;
      window.fsCreateAd = async function (data) {
        try { data = await ensureHostedImages(data || {}); } catch (e) { console.warn('[Bloxzuh] ensureHostedImages', e); }
        return origC(data);
      };
      window.fsCreateAd.__bzGal = true;
      console.log('[Bloxzuh] hook fsCreateAd ativo');
    }
    if (typeof window.fsUpdateAd === 'function' && !window.fsUpdateAd.__bzGal) {
      var origU = window.fsUpdateAd;
      window.fsUpdateAd = async function (adId, patch) {
        try { patch = await ensureHostedImages(patch || {}); } catch (e) { console.warn('[Bloxzuh] ensureHostedImages', e); }
        return origU(adId, patch);
      };
      window.fsUpdateAd.__bzGal = true;
      console.log('[Bloxzuh] hook fsUpdateAd ativo');
    }
  }

  function run() {
    hookGalleryInput();
    hookFs();
  }

  run();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  var n = 0;
  var timer = setInterval(function () {
    run();
    n++;
    if (n > 40) clearInterval(timer);
  }, 250);

  console.log('[Bloxzuh] cover-worker-patch ativo (capa+galeria)');
})();
