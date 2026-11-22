// JavaScript / content-policy.js / navegador e Node.js / filtro público de contatos.
(function (root) {
  'use strict';
  function mask(value) {
    var text = String(value || '').normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
    var stars = function (s) {return s.replace(/[^\s]/g, '*');};
    text = text.replace(/(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|discord\.gg\/)[^\s<>]+/gi, stars)
      .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, stars)
      .replace(/@[a-z0-9_][a-z0-9_.-]{1,}/gi, stars);
    text = text.replace(/(?<!\d)(?:\+[ .()-]*)?\(?\d(?:[ .()-]*\d){7,12}\)?(?![ .()-]*\d)/g, function (candidate, offset) {
      var digits = candidate.replace(/\D/g, ''), length = digits.length;
      var before = text.slice(Math.max(0, offset - 12), offset);
      var after = text.slice(offset + candidate.length, offset + candidate.length + 10);
      if (/R\$\s*$|\d[.,]$/.test(before) || (length < 10 && /^[.,]\d|^\s*(?:robux|gold|xp|moedas|diamantes)\b/i.test(after))) return candidate;
      if (/^(?:19|20)\d{2}-(?:19|20)\d{2}$/.test(candidate.trim())) return candidate;
      var local = length === 8 || length === 9;
      var formatted = /[ .()-]/.test(candidate.trim());
      var context = /(?:tel|cel|fone|zap|whats|contato)\W*$/i.test(before);
      var full = length === 10 || length === 11 || ((length === 12 || length === 13) && digits.startsWith('55'));
      return full || (local && (formatted || context)) ? stars(candidate) : candidate;
    });
    text = text.replace(/\b(?:whats(?:app)?|zap|telefone|celular|discord|instagram)\s*[:=]\s*[^\n,;!?]{3,80}/gi, stars);
    return text;
  }
  var api = {mask: mask, hasContact: function (text) {return mask(text) !== String(text || '').normalize('NFKC').replace(/[\u200b-\u200f\u2060\ufeff]/g, '');}};
  root.BloxzuhContentPolicy = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
