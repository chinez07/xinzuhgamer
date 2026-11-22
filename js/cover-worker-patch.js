// JavaScript / cover-worker-patch.js / navegadores atuais / envio único das imagens em alta qualidade.
(function () {
  'use strict';
  if (window.BloxzuhAdImages) return;
  var pending = new WeakMap();
  function compress(file, maxSide, quality) {
    return new Promise(function (resolve,reject) {
      var reader = new FileReader();
      reader.onerror = function () {reject(new Error('Não foi possível ler a imagem.'));};
      reader.onload = function () {
        var image = new Image();
        image.onerror = function () {reject(new Error('Imagem inválida.'));};
        image.onload = function () {
          try {
            var scale = Math.min(1,maxSide/Math.max(image.naturalWidth || image.width,image.naturalHeight || image.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1,Math.round((image.naturalWidth || image.width)*scale));
            canvas.height = Math.max(1,Math.round((image.naturalHeight || image.height)*scale));
            var context = canvas.getContext('2d');
            context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height);
            context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
            context.drawImage(image,0,0,canvas.width,canvas.height);
            resolve(canvas.toDataURL('image/jpeg',quality));
          } catch (e) {reject(new Error('Não foi possível processar a imagem.'));}
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  async function upload(file) {
    if (!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024) throw new Error('Use JPG, PNG ou WebP de até 5 MB.');
    var worker = (window.BLOXZUH_IMGBB_WORKER || '').trim();
    if (!worker) throw new Error('O envio de imagens está indisponível. Tente novamente.');
    var data = await compress(file,1600,.9);
    if (data.length > 2000000) data = await compress(file,1280,.88);
    if (data.length > 2000000) throw new Error('A imagem está muito pesada. Escolha uma imagem menor.');
    var response;
    try {
      response = await fetch(worker,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data.split(',')[1]})});
      var json = await response.json();
      var url = json && json.success && json.data && (json.data.url || json.data.display_url);
      if (response.ok && typeof url === 'string' && /^https:\/\//.test(url)) return url;
    } catch (e) { /* Show an actionable error rather than silently degrading or dropping the photo. */ }
    throw new Error('Não foi possível enviar a imagem. Tente salvar novamente; as fotos anteriores serão preservadas.');
  }
  function prepare(file) {
    if (!pending.has(file)) pending.set(file,upload(file).catch(function (error) {pending.delete(file);throw error;}));
    return pending.get(file);
  }
  async function hosted(source) {
    if (!source) return '';
    if (/^https:\/\//.test(source)) return source;
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(source)) throw new Error('Formato de imagem inválido.');
    var blob = await (await fetch(source)).blob();
    return prepare(new File([blob],'foto.jpg',{type:blob.type}));
  }
  async function process(data) {
    var next = Object.assign({},data);
    if (next.cover) next.cover = await hosted(next.cover);
    if (Array.isArray(next.gallery)) next.gallery = await Promise.all(next.gallery.slice(0,6).map(hosted));
    return next;
  }
  function hook() {
    if (typeof window.fsCreateAd === 'function' && !window.fsCreateAd.__bzImagesHQ) {
      var create = window.fsCreateAd;
      window.fsCreateAd = async function (data) {return create(await process(data || {}));};
      window.fsCreateAd.__bzImagesHQ = true;
    }
    if (typeof window.fsUpdateAd === 'function' && !window.fsUpdateAd.__bzImagesHQ) {
      var update = window.fsUpdateAd;
      window.fsUpdateAd = async function (id,data) {return update(id,await process(data || {}));};
      window.fsUpdateAd.__bzImagesHQ = true;
    }
  }
  window.BloxzuhAdImages = {prepare:prepare,process:process,compress:compress};
  window.prepareAdCover = prepare;
  hook();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',hook);
  var attempts=0, timer=setInterval(function () {hook();if (++attempts >= 20) clearInterval(timer);},250);
})();
