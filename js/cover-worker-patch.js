/**
 * Garante upload de capa pelo Cloudflare Worker.
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
    if (!worker) {
      console.warn('[Bloxzuh] Worker URL vazia');
    } else {
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
  console.log('[Bloxzuh] cover-worker-patch ativo');
})();
