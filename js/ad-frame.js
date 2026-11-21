// JavaScript / ad-frame.js / navegador e Node.js / moldura MAX independente por anúncio.
(function (root) {
  'use strict';
  function normalize(value) {
    value = value || {};
    function number(key, fallback, min, max) {return Number.isInteger(value[key]) && value[key] >= min && value[key] <= max ? value[key] : fallback;}
    function color(key, fallback) {return typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key] : fallback;}
    var image = typeof value.image === 'string' && value.image.length <= 450000 && /^data:image\/(png|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image) ? value.image : '';
    var style = ['none','solid','gradient','neon','image'].includes(value.style) ? value.style : 'none';
    return {style: style === 'image' && !image ? 'none' : style, image:image,
      ratio: typeof value.ratio === 'number' && value.ratio >= .5 && value.ratio <= 4 ? value.ratio : 1.6,
      inset: number('inset',8,0,24), fit: value.fit === 'contain' ? 'contain' : 'cover',
      color: color('color','#7c3aed'), secondary: color('secondary','#ec4899'), width: number('width',5,1,12), radius: number('radius',20,0,40)};
  }
  function apply(element, value, active) {
    var frame = normalize(value);
    element.classList.remove('max-image-frame');
    element.removeAttribute('data-frame-style');
    ['color','secondary','width','radius','image','ratio','inset','fit'].forEach(function (key) {element.style.removeProperty('--ad-frame-' + key);});
    if (!active || frame.style === 'none') return frame;
    element.classList.add('max-image-frame');
    element.setAttribute('data-frame-style', frame.style);
    element.style.setProperty('--ad-frame-color', frame.color);
    element.style.setProperty('--ad-frame-secondary', frame.secondary);
    element.style.setProperty('--ad-frame-width', frame.width + 'px');
    element.style.setProperty('--ad-frame-radius', frame.radius + 'px');
    if (frame.style === 'image') {
      element.style.setProperty('--ad-frame-image', 'url("' + frame.image + '")');
      element.style.setProperty('--ad-frame-ratio', String(frame.ratio));
      element.style.setProperty('--ad-frame-inset', frame.inset + '%');
      element.style.setProperty('--ad-frame-fit', frame.fit);
    }
    return frame;
  }
  async function decorate(element, value, uid, lookup) {
    apply(element, value, false);
    if (!uid || normalize(value).style === 'none') return;
    try {
      var member = await lookup(uid);
      // An entitlement always comes from the MAX backend, never from the ad's plan field.
      if (element.isConnected !== false) apply(element, value, member.active === true);
    } catch (e) { /* A membership outage must not hide photos or block purchasing. */ }
  }
  function editor(host, getCover) {
    var value = normalize(), allowed = false, revision = 0, uploadRevision = 0, uploading = false;
    var controls = host.querySelector('fieldset'), status = host.querySelector('[data-frame-status]');
    var preview = host.querySelector('[data-frame-preview]'), image = preview.querySelector('img');
    var fields = {};
    ['style','color','secondary','width','radius','inset','fit'].forEach(function (key) {
      fields[key] = host.querySelector('[data-frame-input="' + key + '"]');
      fields[key].addEventListener('input', function () {
        value[key] = ['width','radius','inset'].includes(key) ? Number(fields[key].value) : fields[key].value;
        paint();
      });
    });
    function paint() {
      // Allow selecting image mode before uploading a file; normalize only on save/render.
      var selected = value.style;
      value = normalize(value);
      if (selected === 'image') value.style = 'image';
      Object.keys(fields).forEach(function (key) {fields[key].value = value[key];});
      host.querySelector('[data-frame-width]').textContent = value.width + ' px';
      host.querySelector('[data-frame-radius]').textContent = value.radius + ' px';
      host.querySelector('[data-frame-secondary-label]').hidden = value.style !== 'gradient';
      host.querySelector('[data-frame-upload]').hidden = value.style !== 'image';
      host.querySelector('[data-frame-inset]').textContent = value.inset + '%';
      host.querySelectorAll('[data-frame-basic]').forEach(function (label) {label.hidden = value.style === 'image';});
      apply(preview, value, allowed);
      var cover = getCover();
      image.hidden = !cover;
      if (cover && image.getAttribute('src') !== cover) image.src = cover;
      host.querySelector('[data-frame-placeholder]').hidden = !!cover;
    }
    async function check(user) {
      var attempt = ++revision;
      allowed = false; controls.disabled = true; paint();
      status.textContent = user ? 'Verificando sua assinatura MAX…' : 'Entre na sua conta para verificar o Clube MAX.';
      if (!user) return;
      try {
        var member = await root.BloxzuhMax.publicMember(user.uid, true);
        if (attempt !== revision) return;
        allowed = member.active === true;
        status.textContent = allowed ? 'MAX ativo. Esta moldura será salva apenas neste anúncio e aplicada à capa e à galeria.' : 'Personalização exclusiva para assinantes MAX. As imagens continuam disponíveis sem moldura.';
      } catch (e) {if (attempt !== revision) return; status.textContent = 'Não foi possível verificar o MAX. Reabra esta etapa ou tente verificar novamente.';}
      controls.disabled = !allowed; paint();
    }
    root.firebase.auth().onAuthStateChanged(check);
    host.querySelector('[data-frame-retry]').addEventListener('click', function () {check(root.firebase.auth().currentUser);});
    var fileInput = host.querySelector('[data-frame-file]'), uploadStatus = host.querySelector('[data-frame-upload-status]');
    fileInput.addEventListener('change', async function () {
      var file = fileInput.files[0], attempt = ++uploadRevision;
      if (!file || !allowed) return;
      uploading = true; uploadStatus.textContent = 'Preparando a moldura…';
      try {
        var result = await prepareImage(file);
        if (attempt !== uploadRevision) return;
        value.image = result.image; value.ratio = result.ratio; value.style = 'image';
        uploadStatus.textContent = 'Moldura carregada. Ajuste o espaço interno e confira a prévia antes de salvar.';
        paint();
      } catch (e) {if (attempt === uploadRevision) uploadStatus.textContent = e.message;}
      finally {if (attempt === uploadRevision) uploading = false; fileInput.value = '';}
    });
    host.querySelector('[data-frame-remove]').addEventListener('click', function () {
      ++uploadRevision; uploading = false; value.image = ''; value.style = 'none'; uploadStatus.textContent = 'Imagem da moldura removida. Salve o anúncio para confirmar.'; paint();
    });
    // The image upload updates its preview asynchronously; follow only that subtree.
    var coverZone = document.getElementById('coverZone');
    if (coverZone) new MutationObserver(paint).observe(coverZone, {childList:true,subtree:true});
    paint();
    return {load: function (saved) {value = normalize(saved); paint();}, read: function () {
      if (uploading) throw new Error('Aguarde o carregamento da moldura antes de salvar.');
      if (value.style === 'image' && !value.image) throw new Error('Envie a imagem da moldura ou escolha outro estilo.');
      return normalize(value);
    }};
  }
  async function prepareImage(file) {
    if (!['image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Escolha um PNG ou WebP de até 5 MB, com o centro transparente.');
    var url = URL.createObjectURL(file);
    try {
      var picture = await new Promise(function (resolve,reject) {var img = new Image(); img.onload = function () {resolve(img);}; img.onerror = function () {reject(new Error('Não foi possível ler essa imagem.'));}; img.src = url;});
      var ratio = picture.naturalWidth / picture.naturalHeight;
      if (ratio < .5 || ratio > 4) throw new Error('Use uma moldura com proporção entre 1:2 e 4:1.');
      var canvas = document.createElement('canvas'), size = Math.min(1400, Math.max(picture.naturalWidth,picture.naturalHeight));
      for (var i = 0; i < 6; i++) {
        canvas.width = Math.round(picture.naturalWidth * size / Math.max(picture.naturalWidth,picture.naturalHeight));
        canvas.height = Math.round(canvas.width / ratio);
        var context = canvas.getContext('2d'); context.drawImage(picture,0,0,canvas.width,canvas.height);
        // Reject opaque centers rather than silently covering the product photo.
        var pixel = context.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;
        if (pixel[3] > 240) throw new Error('O centro dessa imagem não é transparente. Use um PNG ou WebP com o centro recortado para a foto aparecer.');
        var encoded = canvas.toDataURL('image/webp',.9);
        if (encoded.length <= 450000) return {image:encoded,ratio:ratio};
        size = Math.round(size * .75);
      }
      throw new Error('A moldura ficou muito grande. Envie uma imagem menor.');
    } finally {URL.revokeObjectURL(url);}
  }
  var api = {normalize:normalize, apply:apply, decorate:decorate, editor:editor};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloxzuhAdFrame = api;
})(typeof window !== 'undefined' ? window : globalThis);
