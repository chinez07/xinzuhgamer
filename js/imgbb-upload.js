/**
 * Upload de capa via Cloudflare Worker (chave ImgBB NÃO fica no navegador).
 * Configure window.BLOXZUH_IMGBB_WORKER no firebase-auth.js
 * Ex: https://bloxzuh-imgbb.SEU_SUBDOMINIO.workers.dev
 */
(function () {
  var ORIGIN_PREPARE = null;

  async function compressImageFile(file, maxSide, quality) {
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

  async function prepareAdCoverViaWorker(file) {
    if (!file) return '';
    var dataUrl = await compressImageFile(file, 320, 0.42);
    if (dataUrl.length > 220000) dataUrl = await compressImageFile(file, 240, 0.32);
    if (dataUrl.length > 220000) dataUrl = await compressImageFile(file, 180, 0.28);

    var worker = window.BLOXZUH_IMGBB_WORKER || '';
    if (worker) {
      try {
        var b64 = dataUrl.split(',')[1] || '';
        var res = await fetch(worker, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: b64 })
        });
        var json = await res.json();
        if (json && json.success && json.data && json.data.url) {
          return json.data.url;
        }
        console.warn('[Bloxzuh] Worker ImgBB', json);
      } catch (e) {
        console.warn('[Bloxzuh] Worker ImgBB falhou', e);
      }
    }

    // fallback: função original (se existir) ou dataURL pequena
    if (typeof ORIGIN_PREPARE === 'function') {
      try { return await ORIGIN_PREPARE(file); } catch (e) {}
    }
    if (dataUrl.length > 250000) return '';
    return dataUrl;
  }

  function install() {
    if (typeof window.prepareAdCover === 'function' && !ORIGIN_PREPARE) {
      ORIGIN_PREPARE = window.prepareAdCover;
    }
    window.prepareAdCover = prepareAdCoverViaWorker;
  }

  install();
  setTimeout(install, 0);
  setTimeout(install, 500);
  setTimeout(install, 1500);
})();
