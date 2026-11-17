// JavaScript / store-theme.js / navegador e Node.js / aparência da loja MAX.
(function (root) {
  'use strict';
  function normalize(value) {
    value = value || {};
    function image(src) {return typeof src === 'string' && src.length <= 500000 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';}
    return {accent: /^#[0-9a-f]{6}$/i.test(value.accent || '') ? value.accent : '#a78bfa', panelColor: /^#[0-9a-f]{6}$/i.test(value.panelColor || '') ? value.panelColor : '#16161f', panelTransparency: Number.isInteger(value.panelTransparency) && value.panelTransparency >= 0 && value.panelTransparency <= 100 ? value.panelTransparency : 4, backgroundDesktop: image(value.backgroundDesktop), backgroundMobile: image(value.backgroundMobile)};
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
  function panelColors(value) {
    var theme = normalize(value), alpha = (100 - theme.panelTransparency) / 100;
    var rgb = theme.panelColor.slice(1).match(/../g).map(function (channel) {return parseInt(channel, 16);});
    // The backgrounds already have a dark overlay. Estimate their base for text contrast.
    var blend = rgb.map(function (channel, i) {return Math.round(channel * alpha + [12,12,20][i] * (1 - alpha));});
    var blendHex = '#' + blend.map(function (channel) {return channel.toString(16).padStart(2, '0');}).join('');
    var light = luminance(blendHex) > .179, base = luminance(blendHex), accent = luminance(theme.accent);
    return {background: 'rgba(' + rgb.join(',') + ',' + alpha + ')', text: light ? '#111118' : '#f3f4f6', muted: light ? '#373744' : '#c7c4d5',
      readable: (Math.max(base, accent) + .05) / (Math.min(base, accent) + .05) >= 4.5 ? theme.accent : (light ? '#242033' : '#ede9fe'),
      surface: alpha === 0 ? 'transparent' : (light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)'), border: light ? '#00000025' : '#ffffff25', positive: light ? '#166534' : '#4ade80'};
  }
  function apply(element, value) {
    var theme = normalize(value), palette = colors(theme.accent), panels = panelColors(theme);
    Object.keys(panels).forEach(function (key) {element.style.setProperty('--store-panel-' + key, panels[key]);});
    element.style.setProperty('--store-accent', palette.accent);
    element.style.setProperty('--store-readable', palette.readable);
    element.style.setProperty('--store-on-accent', palette.onAccent);
    element.style.setProperty('--store-background-desktop', theme.backgroundDesktop ? 'url("' + theme.backgroundDesktop + '")' : 'none');
    element.style.setProperty('--store-background-mobile', theme.backgroundMobile || theme.backgroundDesktop ? 'url("' + (theme.backgroundMobile || theme.backgroundDesktop) + '")' : 'none');
    return theme;
  }
  var api = {normalize: normalize, colors: colors, panelColors: panelColors, apply: apply};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BloxzuhStoreTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
