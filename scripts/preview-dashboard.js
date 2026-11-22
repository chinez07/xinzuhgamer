// JavaScript / preview-dashboard.js / navegador local / testes e revisão de anúncios locais.
(function(){
  var input=document.getElementById('testContact'),out=document.getElementById('testMasked');
  input.addEventListener('input',function(){out.textContent=BloxzuhContentPolicy.mask(input.value);});out.textContent=BloxzuhContentPolicy.mask(input.value);
  async function load(){var root=document.getElementById('localAds'),ads=await(await fetch('/api/ads')).json();root.replaceChildren();
    Object.entries(ads).forEach(function(entry){var id=entry[0],ad=entry[1],card=document.createElement('article');card.className='info-card release';var title=document.createElement('h3');title.textContent=ad.title+' · '+ad.status;card.append(title);var description=document.createElement('p');description.textContent='Descrição: '+(ad.desc||'Não informada');card.append(description);var category=document.createElement('p');category.textContent=[ad.subcategory,ad.gameName,ad.section,ad.experienceName,ad.productType].filter(Boolean).join(' · ');card.append(category);if(ad.moderationReason){var why=document.createElement('p');why.textContent='Motivo: '+ad.moderationReason;card.append(why);}var edit=document.createElement('a');edit.href='/anunciar.html?edit='+encodeURIComponent(id);edit.className='action';edit.textContent='Editar anúncio local';card.append(edit);
      [ad.cover,...(ad.gallery||[])].filter(Boolean).forEach(function(src){var image=document.createElement('img');image.src=src;image.alt='Imagem do anúncio local';image.style.cssText='width:160px;height:120px;object-fit:contain;margin:8px';card.append(image);});
      if(ad.status==='pendente'){var reason=document.createElement('input');reason.placeholder='Motivo da decisão';reason.style.cssText='display:block;width:100%;padding:12px;margin:12px 0';card.append(reason);
        ['approved','rejected'].forEach(function(decision){var button=document.createElement('button');button.className='action';button.textContent=decision==='approved'?'Aprovar no teste':'Reprovar no teste';button.addEventListener('click',async function(){var r=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:id,decision:decision,reason:reason.value})});var body=await r.json();if(!r.ok){alert(body.error);return;}load();});card.append(button);});
      }root.append(card);
    });if(!Object.keys(ads).length)root.textContent='Nenhum anúncio local. Crie um para testar o fluxo.';
  }
  fetch('/api/ai-status').then(r=>r.json()).then(function(status){if(status.connected){document.getElementById('visionStatus').textContent='IA real conectada: '+status.model+' · '+(status.calls||0)+'/'+(status.dailyLimit||20)+' chamadas locais hoje. Fotos e descrições de teste são enviadas à Cloudflare.';}}).catch(function(){});
  document.getElementById('refreshLocal').addEventListener('click',load);load();
})();
