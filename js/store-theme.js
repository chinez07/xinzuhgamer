// JavaScript / store-theme.js / navegador e Node.js / aparência da loja MAX.
(function (root) {
  'use strict';
  function normalize(value) {
    value = value || {};
    function image(src) {return typeof src === 'string' && src.length <= 500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';}
    return {accent: /^#[0-9a-f]{6}$/i.test(value.accent || '') ? value.accent : '#a78bfa', backgroundDesktop: image(value.backgroundDesktop), backgroundMobile: image(value.backgroundMobile)};
  }
  function luminance(hex) {
    var channels = hex.slice(1).match(/../g).map(function (c) {var v = parseInt(c, 16) / 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4);});
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  }
  function colors(accent) {
    accent = normalize({accent: accent}).accent;
    var light = luminance(accent), card = luminance('#16161f');
    return {accent: accent, onAccent: light > .179 ? '#09090f' : '#ffffff', readable: (Math.max(light, card) + .05) / (Math.min(light, card) + .05) >= 4.5 ? accent : '#ede9fe'};
  }
  function apply(element, value) {
    var theme = normalize(value), palette = colors(theme.accent);
    element.style.setProperty('--store-accent', palette.accent);
    element.style.setProperty('--store-readable', palette.readable);
    element.style.setProperty('--store-on-accent', palette.onAccent);
    element.style.setProperty('--store-background-desktop', theme.backgroundDesktop ? 'url("' + theme.backgroundDesktop + '")' : 'none');
    element.style.setProperty('--store-background-mobile', theme.backgroundMobile || theme.backgroundDesktop ? 'url("' + (theme.backgroundMobile || theme.backgroundDesktop) + '")' : 'none');
    return theme;
  }
  var api = {normalize: normalize, colors: colors, apply: apply};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloxzuhStoreTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
