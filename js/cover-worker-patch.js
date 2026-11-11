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
    console.log('[Bloxzuh] prepareAdCover start', file && file.name, 'worker=', window.BLOXZUH_IMGBB_WORKER);
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
        console.log('[Bloxzuh] Worker status', res.status, json && json.success);
        if (json && json.success && json.data && (json.data.url || json.data.display_url)) {
          var url = json.data.url || json.data.display_url;
          console.log('[Bloxzuh] capa OK via Worker:', url);
          return url;
        }
        console.warn('[Bloxzuh] Worker sem URL', json);
      } catch (e) {
        console.warn('[Bloxzuh] Worker erro', e);
      }
    }

    if (dataUrl.length > 250000) return '';
    console.warn('[Bloxzuh] usando dataURL (fallback)');
    return dataUrl;
  }

  window.prepareAdCover = prepareAdCover;
  window.__bzGalleryFiles = window.__bzGalleryFiles || [];

  function hookGalleryInput() {
    var gal = document.getElementById('galInput');
    if (!gal || gal.getAttribute('data-bz-hook') === '1') return;
    gal.setAttribute('data-bz-hook', '1');
    gal.addEventListener('change', function () {
      try {
        var files = Array.prototype.slice.call(gal.files || [], 0, 6);
        files.forEach(function (f) {
          if (f && f.type && f.type.indexOf('image/') === 0) {
            window.__bzGalleryFiles.push(f);
          }
        });
        if (window.__bzGalleryFiles.length > 6) {
          window.__bzGalleryFiles = window.__bzGalleryFiles.slice(-6);
        }
        console.log('[Bloxzuh] galeria arquivos guardados:', window.__bzGalleryFiles.length);
      } catch (e) {}
    });
  }

  function hookFsCreate() {
    if (typeof window.fsCreateAd !== 'function' || window.fsCreateAd.__bzGal) return;
    var origCreate = window.fsCreateAd;
    window.fsCreateAd = async function (data) {
      data = data || {};
      try {
        var files = window.__bzGalleryFiles || [];
        if (files.length) {
          console.log('[Bloxzuh] enviando galeria via Worker...', files.length);
          var urls = [];
          for (var i = 0; i < files.length && i < 6; i++) {
            try {
              var u = await prepareAdCover(files[i]);
              if (u && String(u).indexOf('http') === 0) {
                urls.push(u);
                console.log('[Bloxzuh] galeria', i + 1, u);
              }
            } catch (e) {
              console.warn('[Bloxzuh] galeria falhou', i, e);
            }
          }
          if (urls.length) data.gallery = urls;
          window.__bzGalleryFiles = [];
        } else if (data.gallery && data.gallery.length) {
          var out = [];
          for (var j = 0; j < data.gallery.length && j < 6; j++) {
            var g = data.gallery[j];
            if (!g) continue;
            if (String(g).indexOf('http') === 0) { out.push(g); continue; }
            if (String(g).indexOf('data:') === 0) {
              try {
                var blob = await (await fetch(g)).blob();
                var file = new File([blob], 'gal' + j + '.jpg', { type: blob.type || 'image/jpeg' });
                var uu = await prepareAdCover(file);
                if (uu && String(uu).indexOf('http') === 0) out.push(uu);
              } catch (e2) {
                console.warn('[Bloxzuh] gal dataURL', j, e2);
              }
            }
          }
          if (out.length) data.gallery = out;
        }
        console.log('[Bloxzuh] galeria final no anúncio:', (data.gallery || []).length);
      } catch (e) {
        console.warn('[Bloxzuh] hook galeria', e);
      }
      return origCreate(data);
    };
    window.fsCreateAd.__bzGal = true;
    console.log('[Bloxzuh] fsCreateAd hook galeria ativo');
  }

  function run() {
    hookGalleryInput();
    hookFsCreate();
  }
  run();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  setTimeout(run, 100);
  setTimeout(run, 500);
  setTimeout(run, 1500);
  console.log('[Bloxzuh] cover-worker-patch ativo');
})();
