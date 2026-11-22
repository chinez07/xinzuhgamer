// JavaScript / ad-moderation.js / navegador / aciona a revisão de um anúncio já salvo.
(function(root){
  'use strict';
  var endpoint=root.BLOXZUH_MODERATION_URL||'https://bloxzuh-pix.hskkaj48.workers.dev/moderation';
  async function review(adId){
    var user=root.firebase.auth().currentUser;if(!user)throw Error('Entre na sua conta.');
    var response=await fetch(endpoint+'/review',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({adId:adId})});
    var result=await response.json();if(!response.ok)throw Error(result.error||'A análise será concluída pela revisão administrativa.');return result;
  }
  root.BloxzuhAdModeration={review:review};
})(window);
