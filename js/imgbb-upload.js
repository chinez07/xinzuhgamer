/**
 * Upload de capa via Cloudflare Worker (chave ImgBB NÃO fica no navegador).
 * URL: window.BLOXZUH_IMGBB_WORKER
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

  async function prepareAdCoverViaWorker(file) {
    if (!file) return '';
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
          console.log('[Bloxzuh] capa enviada via Worker:', url);
          return url;
        }
        console.warn('[Bloxzuh] Worker ImgBB resposta:', json);
      } catch (e) {
        console.warn('[Bloxzuh] Worker ImgBB falhou', e);
      }
    } else {
      console.warn('[Bloxzuh] BLOXZUH_IMGBB_WORKER não configurado');
    }

    if (dataUrl.length > 250000) return '';
    return dataUrl;
  }

  function install() {
    window.prepareAdCover = prepareAdCoverViaWorker;
  }

  install();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  }
  setTimeout(install, 0);
  setTimeout(install, 300);
  setTimeout(install, 1000);
})();
