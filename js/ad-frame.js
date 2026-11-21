// JavaScript / ad-frame.js / navegador e Node.js / moldura MAX independente por anúncio.
(function (root) {
  'use strict';
  function normalize(value) {
    value = value || {};
    function number(key, fallback, min, max) {return Number.isInteger(value[key]) && value[key] >= min && value[key] <= max ? value[key] : fallback;}
    function color(key, fallback) {return typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key]) ? value[key] : fallback;}
    return {style: ['none','solid','gradient','neon'].includes(value.style) ? value.style : 'none', color: color('color','#7c3aed'), secondary: color('secondary','#ec4899'), width: number('width',5,1,12), radius: number('radius',20,0,40)};
  }
  function apply(element, value, active) {
    var frame = normalize(value);
    element.classList.remove('max-image-frame');
    element.removeAttribute('data-frame-style');
    ['color','secondary','width','radius'].forEach(function (key) {element.style.removeProperty('--ad-frame-' + key);});
    if (!active || frame.style === 'none') return frame;
    element.classList.add('max-image-frame');
    element.setAttribute('data-frame-style', frame.style);
    element.style.setProperty('--ad-frame-color', frame.color);
    element.style.setProperty('--ad-frame-secondary', frame.secondary);
    element.style.setProperty('--ad-frame-width', frame.width + 'px');
    element.style.setProperty('--ad-frame-radius', frame.radius + 'px');
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
    var value = normalize(), allowed = false, revision = 0;
    var controls = host.querySelector('fieldset'), status = host.querySelector('[data-frame-status]');
    var preview = host.querySelector('[data-frame-preview]'), image = preview.querySelector('img');
    var fields = {};
    ['style','color','secondary','width','radius'].forEach(function (key) {
      fields[key] = host.querySelector('[data-frame-input="' + key + '"]');
      fields[key].addEventListener('input', function () {
        value[key] = ['width','radius'].includes(key) ? Number(fields[key].value) : fields[key].value;
        paint();
      });
    });
    function paint() {
      value = normalize(value);
      Object.keys(fields).forEach(function (key) {fields[key].value = value[key];});
      host.querySelector('[data-frame-width]').textContent = value.width + ' px';
      host.querySelector('[data-frame-radius]').textContent = value.radius + ' px';
      host.querySelector('[data-frame-secondary-label]').hidden = value.style !== 'gradient';
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
    // The image upload updates its preview asynchronously; follow only that subtree.
    var coverZone = document.getElementById('coverZone');
    if (coverZone) new MutationObserver(paint).observe(coverZone, {childList:true,subtree:true});
    paint();
    return {load: function (saved) {value = normalize(saved); paint();}, read: function () {return normalize(value);}};
  }
  var api = {normalize:normalize, apply:apply, decorate:decorate, editor:editor};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloxzuhAdFrame = api;
})(typeof window !== 'undefined' ? window : globalThis);
