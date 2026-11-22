// JavaScript / ad-category-form.js / navegador / seleção progressiva de categoria e produto.
(function(root){
  root.BloxzuhAdCategoryForm=function(){
    var cat=document.getElementById('category'),game=document.getElementById('subcategory'),type=document.getElementById('productType'),section=document.getElementById('section');
    var gameName=document.getElementById('gameName'),experience=document.getElementById('experienceSelect'),experienceName=document.getElementById('experienceName');
    var origin=document.getElementById('origin'),account=document.getElementById('accountInfo');
    function options(select,values,value){select.replaceChildren();[''].concat(values).forEach(function(v){var opt=document.createElement('option');opt.value=v;opt.textContent=v?(v==='Conta'?'Contas':v):'Selecione';select.append(opt);});select.value=values.includes(value)?value:'';}
    function field(el,show){var label=el.closest('label');if(label)label.hidden=!show;else{el.hidden=!show;var before=el.previousElementSibling;if(before&&before.tagName==='LABEL')before.hidden=!show;}el.disabled=!show;}
    function showFields(){
      var selected=!!cat.value,hasGame=selected&&!!game.value,roblox=hasGame&&game.value==='Roblox';
      field(game,selected);field(gameName,hasGame&&game.value==='Outros jogos');field(experience,roblox);
      field(experienceName,roblox&&experience.value==='Outros jogos');
      var ready=hasGame&&(game.value!=='Outros jogos'||!!gameName.value.trim())&&(!roblox||(!!experience.value&&(experience.value!=='Outros jogos'||!!experienceName.value.trim())));
      field(type,ready);field(section,ready&&!!type.value&&!roblox&&(type.value!=='Conta'||!!origin.value&&!!account.value));
      var accountProduct=ready&&type.value==='Conta';
      field(origin,accountProduct);field(account,accountProduct&&!!origin.value);
      if(roblox){section.value=experience.value;experience.disabled=type.value==='Robux';}
    }
    function resetProducts(){options(type,root.BloxzuhAdCatalog.get(game.value).products,'');origin.value='';account.value='';}
    function fillGames(){options(game,cat.value==='Assinaturas'?['Assinatura']:Object.keys(root.BloxzuhAdCatalog.games).filter(g=>g!=='Assinatura'),'');section.value='';gameName.value='';experienceName.value='';options(experience,[],'');resetProducts();showFields();}
    game.addEventListener('change',function(){section.value='';gameName.value='';experienceName.value='';options(experience,root.BloxzuhAdCatalog.get(game.value).sections,'');resetProducts();showFields();});
    experience.addEventListener('change',function(){experienceName.value='';resetProducts();showFields();});
    type.addEventListener('change',function(){
      if(game.value==='Roblox'&&type.value==='Robux'){experience.value='Roblox geral';experienceName.value='';}
      if(type.value!=='Conta'){if(!Array.from(origin.options).some(o=>o.value==='Não se aplica')){var opt=document.createElement('option');opt.value=opt.textContent='Não se aplica';origin.append(opt);}origin.value=account.value='Não se aplica';}else{origin.value='';account.value='';}
      showFields();
    });
    origin.addEventListener('change',showFields);gameName.addEventListener('input',showFields);experienceName.addEventListener('input',showFields);
    // A escolha das informações da conta também deve ser explícita.
    var blank=document.createElement('option');blank.value='';blank.textContent='Selecione';account.prepend(blank);
    var notApplicable=document.createElement('option');notApplicable.value=notApplicable.textContent='Não se aplica';origin.append(notApplicable);
    fillGames();
    return {fillGames:fillGames,load:function(data){
      cat.value=data.category||'Jogos';options(game,cat.value==='Assinaturas'?['Assinatura']:Object.keys(root.BloxzuhAdCatalog.games).filter(g=>g!=='Assinatura'),data.subcategory);
      var config=root.BloxzuhAdCatalog.get(game.value),value=data.section||'';
      options(experience,config.sections,config.sections.includes(value)?value:(value?'Outros jogos':''));gameName.value=data.gameName||'';experienceName.value=data.experienceName||(!config.sections.includes(value)?value:'');section.value=value;
      options(type,config.products,data.productType);origin.value=data.productType==='Conta'?(data.origin||''):'Não se aplica';account.value=data.productType==='Conta'?(data.accountInfo||''):'Não se aplica';
      if(game.value==='Roblox'&&type.value==='Robux'){experience.value='Roblox geral';experienceName.value='';}
      showFields();
    },read:function(){return {gameName:game.value==='Outros jogos'?gameName.value.trim():'',experienceName:game.value==='Roblox'&&experience.value==='Outros jogos'?experienceName.value.trim():''};}};
  };
})(window);
