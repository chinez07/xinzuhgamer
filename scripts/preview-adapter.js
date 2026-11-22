// JavaScript / preview-adapter.js / navegador local / adaptador sem acesso ao Firebase ou uploads externos.
window.BLOXZUH_MODERATION_URL='/api/moderation';
(function(){
  var user={uid:'local-test',displayName:'Vendedor de teste',email:'teste@localhost',getIdToken:async function(){return 'local-test';}};
  var auth={currentUser:user,onAuthStateChanged:function(fn){setTimeout(function(){fn(user);},0);return function(){};}};
  async function call(url,data){var r=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});var body=await r.json();if(!r.ok)throw Error(body.error);return body;}
  var db={collection:function(){return{doc:function(id){return{get:async function(){var ads=await call('/api/ads');return{exists:!!ads[id],data:function(){return ads[id];}};}};}};}};
  window.firebase={auth:function(){return auth;},firestore:function(){return db;}};
  window.BloxzuhMax={publicMember:async function(){return{active:true};}};
  window.prepareAdCover=function(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=reject;reader.readAsDataURL(file);});};
  window.fsCreateAd=async function(data){var review=await BloxzuhAdModeration.review(data);data.moderationReviewId=review.reviewId;return(await call('/api/ads',{data:data})).id;};
  window.fsUpdateAd=async function(id,patch){var ads=await call('/api/ads'),data=Object.assign({},ads[id],patch);var review=await BloxzuhAdModeration.review(data);data.moderationReviewId=review.reviewId;return(await call('/api/ads',{id:id,data:data})).id;};
  window.logoutFirebase=function(){location.href='/';};
})();
