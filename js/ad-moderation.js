// JavaScript / ad-moderation.js / navegador / análise de imagens antes de enviar anúncio.
(function (root) {
  'use strict';
  var endpoint = root.BLOXZUH_MODERATION_URL || 'https://bloxzuh-pix.hskkaj48.workers.dev/moderation';
  async function review(data) {
    var textCheck=root.BloxzuhAdCatalog.reviewText(data);
    if(textCheck.decision==='rejected')throw new Error(textCheck.reason);
    if (!endpoint) throw new Error('A análise de imagens ainda não foi conectada. Use a prévia local para testar; nenhum anúncio foi enviado.');
    var user = root.firebase.auth().currentUser;
    if (!user) throw new Error('Entre na sua conta.');
    var response = await fetch(endpoint + '/review', {method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({title:data.title,desc:data.desc,category:data.category,subcategory:data.subcategory,section:data.section || '',gameName:data.gameName || '',experienceName:data.experienceName || '',productType:data.productType,imageFrame:data.imageFrame||{},cover:data.cover,gallery:data.gallery || []})});
    var result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível analisar as imagens.');
    if (result.decision === 'rejected') throw new Error(result.message || 'Imagem reprovada. Remova contatos e use fotos do jogo selecionado.');
    if (!['approved','review'].includes(result.decision) || !result.reviewId) throw new Error('Análise inválida. Tente novamente.');
    return result;
  }
  root.BloxzuhAdModeration = {review:review};
})(window);
