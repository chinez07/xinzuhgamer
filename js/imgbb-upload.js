// JavaScript / imgbb-upload.js / navegador / compatibilidade com o único uploader de anúncios.
(function () {
  if (window.BloxzuhAdImages || document.querySelector('script[src*="cover-worker-patch"]')) return;
  var script=document.createElement('script'); script.src='js/cover-worker-patch.js?v=images-hq-1';
  document.head.appendChild(script);
})();
