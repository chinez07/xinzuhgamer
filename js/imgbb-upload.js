/**
 * Upload capa + galeria via Cloudflare Worker (ImgBB).
 * window.BLOXZUH_IMGBB_WORKER = URL do Worker
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

  async function uploadViaWorker(fileOrDataUrl, label) {
    label = label || 'img';
    var dataUrl = '';
    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.indexOf('data:') === 0) {
      dataUrl = fileOrDataUrl;
    } else if (fileOrDataUrl && fileOrDataUrl.size != null) {
      dataUrl = await compressImageFile(fileOrDataUrl, 320, 0.42);
      if (dataUrl.length > 220000) dataUrl = await compressImageFile(fileOrDataUrl, 240, 0.32);
      if (dataUrl.length > 220000) dataUrl = await compressImageFile(fileOrDataUrl, 180, 0.28);
    } else if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.indexOf('http') === 0) {
      return fileOrDataUrl;
    } else {
      return '';
    }

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
          console.log('[Bloxzuh]', label, 'enviada via Worker:', url);
          return url;
        }
        console.warn('[Bloxzuh] Worker resposta', label, json);
      } catch (e) {
        console.warn('[Bloxzuh] Worker falhou', label, e);
      }
    }
    if (dataUrl.length > 250000) return '';
    return dataUrl;
  }

  async function prepareAdCover(file) {
    if (!file) return '';
    return uploadViaWorker(file, 'capa');
  }

  window.prepareAdCover = prepareAdCover;
  window.__bzGalleryFiles = window.__bzGalleryFiles || [];

  async function processAdImages(data) {
    data = data || {};
    if (data.cover && String(data.cover).indexOf('data:') === 0) {
      data.cover = await uploadViaWorker(data.cover, 'capa');
    }
    var out = [];
    var files = window.__bzGalleryFiles || [];
    if (files.length) {
      for (var i = 0; i < files.length && i < 6; i++) {
        var u = await uploadViaWorker(files[i], 'galeria' + (i + 1));
        if (u && String(u).indexOf('http') === 0) out.push(u);
      }
      window.__bzGalleryFiles = [];
    } else if (data.gallery && data.gallery.length) {
      for (var j = 0; j < data.gallery.length && j < 6; j++) {
        var g = data.gallery[j];
        if (!g) continue;
        if (String(g).indexOf('http') === 0) out.push(g);
        else if (String(g).indexOf('data:') === 0) {
          var uu = await uploadViaWorker(g, 'galeria' + (j + 1));
          if (uu && String(uu).indexOf('http') === 0) out.push(uu);
        }
      }
    }
    if (out.length) data.gallery = out;
    console.log('[Bloxzuh] imagens finais capa=', data.cover && String(data.cover).indexOf('http') === 0 ? 'OK' : 'não', 'galeria=', (data.gallery || []).length);
    return data;
  }

  function hookGalleryInput() {
    var gal = document.getElementById('galInput');
    if (!gal || gal.getAttribute('data-bz-imgbb') === '1') return;
    gal.setAttribute('data-bz-imgbb', '1');
    gal.addEventListener('change', function () {
      try {
        var files = Array.prototype.slice.call(gal.files || [], 0, 6);
        files.forEach(function (f) {
          if (f && f.type && f.type.indexOf('image/') === 0) window.__bzGalleryFiles.push(f);
        });
        if (window.__bzGalleryFiles.length > 6) window.__bzGalleryFiles = window.__bzGalleryFiles.slice(-6);
        console.log('[Bloxzuh] galeria arquivos:', window.__bzGalleryFiles.length);
      } catch (e) {}
    }, true);
  }

  function hookCreate() {
    if (typeof window.fsCreateAd === 'function' && !window.fsCreateAd.__bzImgbb) {
      var orig = window.fsCreateAd;
      window.fsCreateAd = async function (data) {
        try { data = await processAdImages(data || {}); } catch (e) { console.warn(e); }
        return orig(data);
      };
      window.fsCreateAd.__bzImgbb = true;
      console.log('[Bloxzuh] imgbb hook fsCreateAd OK');
    }
    if (typeof window.fsUpdateAd === 'function' && !window.fsUpdateAd.__bzImgbb) {
      var origU = window.fsUpdateAd;
      window.fsUpdateAd = async function (id, patch) {
        try { patch = await processAdImages(patch || {}); } catch (e) { console.warn(e); }
        return origU(id, patch);
      };
      window.fsUpdateAd.__bzImgbb = true;
      console.log('[Bloxzuh] imgbb hook fsUpdateAd OK');
    }
  }

  function install() {
    window.prepareAdCover = prepareAdCover;
    hookGalleryInput();
    hookCreate();
  }

  install();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  var n = 0;
  var t = setInterval(function () {
    install();
    n++;
    if (n > 50) clearInterval(t);
  }, 200);
  console.log('[Bloxzuh] imgbb-upload (capa+galeria) ativo');
})();
