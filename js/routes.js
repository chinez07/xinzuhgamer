// JavaScript / routes.js / navegador e Node.js / endereços públicos do Bloxzuh.
(function (root) {
  'use strict';
  var categories = {freefire:'free-fire',lol:'league-of-legends',fortnite:'fortnite',genshin:'genshin-impact',cs2:'cs2',roblox:'roblox',valorant:'valorant',premium:'assinaturas',outros:'outros-jogos'};
  var pages = new Set(['admin','ajuda','anunciar','anuncio','anuncios','atualizacoes','cadastro','categorias','checkout','compras','config-pix','conta','favoritos','index','login','loja','niveis','notificacoes','pagamento','painel','pedido','perfil','plano-max','privacidade','reembolso','revisao-anuncios','suporte','termos','vendas']);
  function categoryId(path) {
    var slug = path.replace(/\/$/, '').replace(/^\/categoria\//, '');
    return Object.keys(categories).find(function (id) { return categories[id] === slug; }) || '';
  }
  function cleanHref(value, base) {
    var url;
    try { url = new URL(value, base); } catch (_) { return value; }
    if (url.origin !== new URL(base).origin || !/^https?:$/.test(url.protocol)) return value;
    var match = url.pathname.match(/^\/([^/]+)\.html$/);
    if (match && pages.has(match[1])) url.pathname = match[1] === 'index' ? '/' : '/' + match[1];
    if (url.pathname === '/anuncios' && categories[url.searchParams.get('cat')]) {
      url.pathname = '/categoria/' + categories[url.searchParams.get('cat')];
      url.searchParams.delete('cat');
    }
    return url.pathname + url.search + url.hash;
  }
  var api = {categoryId:categoryId, cleanHref:cleanHref};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (!root.document) return;
  root.BloxzuhRoutes = api;
  var document = root.document;
  function updateLink(link) {
    var raw = link.getAttribute('href');
    if (!raw || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(raw) || link.hasAttribute('download')) return;
    var clean = cleanHref(raw, document.baseURI);
    if (raw !== clean) link.setAttribute('href', clean);
  }
  function updateTree(node) {
    if (node.nodeType !== 1) return;
    if (node.matches('a[href],area[href]')) updateLink(node);
    node.querySelectorAll('a[href],area[href]').forEach(updateLink);
  }
  new MutationObserver(function (changes) {
    changes.forEach(function (change) {
      if (change.type === 'attributes') updateLink(change.target);
      else change.addedNodes.forEach(updateTree);
    });
  }).observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['href']});
  updateTree(document.documentElement);
})(typeof window !== 'undefined' ? window : globalThis);
