// JavaScript / image-review-admin.js / navegador / revisão de imagens pelo administrador.
(function () {
  var root=document.getElementById('imageReviewList'), adminUid='cQaqR7WBJVZGodL23p6Csi7vrEn2';
  firebase.auth().onAuthStateChanged(async function(user){
    if(!user||user.uid!==adminUid){root.textContent='Entre com a conta administrativa para revisar anúncios.';return;}
    root.textContent='Carregando anúncios pendentes…';
    try {
      var db=firebase.firestore(),snap=await db.collection('ads').where('status','==','pendente').limit(100).get();root.replaceChildren();
      if(snap.empty){root.textContent='Nenhum anúncio aguardando revisão.';return;}
      snap.forEach(function(doc){var ad=doc.data(),card=document.createElement('article');card.className='info-card release';
        var title=document.createElement('h2');title.textContent=ad.title;card.append(title);var description=document.createElement('p');description.textContent='Descrição: '+(ad.desc||'Não informada');card.append(description);
        var category=document.createElement('p');category.textContent=[ad.subcategory,ad.gameName,ad.section,ad.experienceName,ad.productType].filter(Boolean).join(' · ');card.append(category);
        var images=document.createElement('div');images.className='review-images';
        [ad.cover,...(ad.gallery||[]),ad.imageFrame?.image,ad.imageFrame?.backgroundImage].filter(Boolean).forEach(function(src){var image=document.createElement('img');image.src=src;image.alt='Imagem enviada para revisão';image.loading='lazy';images.append(image);});card.append(images);
        var reason=document.createElement('label');reason.textContent='Motivo da decisão';var input=document.createElement('textarea');input.maxLength=500;reason.append(input);card.append(reason);
        var result=document.createElement('p');result.setAttribute('role','status');card.append(result);
        ['approved','rejected'].forEach(function(value){var button=document.createElement('button');button.type='button';button.className='action';button.textContent=value==='approved'?'Aprovar anúncio':'Reprovar anúncio';button.addEventListener('click',async function(){
          if(value==='rejected'&&!input.value.trim()){result.textContent='Informe o motivo da reprovação.';return;}
          card.querySelectorAll('button').forEach(b=>b.disabled=true);
          try {await db.runTransaction(async function(transaction){
            var adRef=db.collection('ads').doc(doc.id),ref=ad.moderationReviewId?db.collection('imageReviews').doc(ad.moderationReviewId):null;
            var fresh=await transaction.get(adRef),current=fresh.data(),receipt=ref?await transaction.get(ref):null;
            var textCheck=BloxzuhAdCatalog.reviewText(current||{});if(value==='approved'&&textCheck.decision==='rejected')throw Error(textCheck.reason);
            if(!current||current.status!=='pendente'||current.moderationReviewId!==ad.moderationReviewId||current.moderationRevision!==ad.moderationRevision)throw Error('O anúncio mudou. Recarregue a lista antes de decidir.');
            if(ref&&(!receipt.exists||receipt.data().decision!=='review'))throw Error('Revisão inválida ou já concluída.');
            if(ref)transaction.update(ref,{decision:value,reviewedBy:user.uid,reviewedAtMs:Date.now(),reason:input.value.trim()});
            transaction.update(adRef,{status:value==='approved'?(Number(current.stock)>0?'ativo':'pausado'):'reprovado',moderationReason:input.value.trim()});
          });result.textContent=value==='approved'?'Aprovado. Anúncio liberado conforme o estoque.':'Reprovado. O vendedor precisa corrigir e reenviar.';
          }catch(e){result.textContent=e.message;card.querySelectorAll('button').forEach(b=>b.disabled=false);}
        });card.append(button);});root.append(card);
      });
    }catch(e){root.textContent=e.message||'Não foi possível carregar a revisão.';}
  });
})();
