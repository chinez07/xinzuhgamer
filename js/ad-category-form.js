// JavaScript / ad-category-form.js / navegador / seleção de categoria e produto do anúncio.
(function (root) {
  root.BloxzuhAdCategoryForm = function () {
    var cat=document.getElementById('category'), game=document.getElementById('subcategory'), type=document.getElementById('productType'), section=document.getElementById('section');
    var gameName=document.getElementById('gameName'), experience=document.getElementById('experienceSelect'), experienceName=document.getElementById('experienceName');
    function options(select,values,selected) {select.replaceChildren();values.forEach(function(v){var opt=document.createElement('option');opt.value=v;opt.textContent=v==='Conta'?'Contas':v;select.append(opt);});if(values.includes(selected))select.value=selected;}
    function sync(saved) {
      saved=saved||{};var config=root.BloxzuhAdCatalog.get(game.value),roblox=game.value==='Roblox';
      options(type,config.products,saved.productType||type.value);
      gameName.closest('label').hidden=game.value!=='Outros jogos';
      experience.closest('label').hidden=!roblox;section.closest('label').hidden=roblox;
      if(roblox){var value=saved.section||section.value;options(experience,config.sections,config.sections.includes(value)?value:'Outros jogos');if(value&&!config.sections.includes(value))experienceName.value=saved.experienceName||value;section.value=experience.value;}
      experienceName.closest('label').hidden=!roblox||experience.value!=='Outros jogos';
      if(origin)productChanged();
    }
    function fillGames() {options(game,cat.value==='Assinaturas'?['Assinatura']:Object.keys(root.BloxzuhAdCatalog.games).filter(g=>g!=='Assinatura'),game.value);section.value='';sync();}
    var origin=document.getElementById('origin'),account=document.getElementById('accountInfo');
    function productChanged(){
      if(game.value==='Roblox' && type.value==='Robux'){experience.value='Roblox geral';section.value='Roblox geral';experienceName.value='';experienceName.closest('label').hidden=true;experience.disabled=true;}
      else experience.disabled=false;
      if(type.value!=='Conta'){if(![...origin.options].some(o=>o.value==='Não se aplica')){var opt=document.createElement('option');opt.value=opt.textContent='Não se aplica';origin.append(opt);}origin.value='Não se aplica';account.value='Não se aplica';}}
    type.addEventListener('change',productChanged);
    game.addEventListener('change',function(){section.value='';experienceName.value='';sync();});
    experience.addEventListener('change',function(){section.value=experience.value;experienceName.closest('label').hidden=experience.value!=='Outros jogos';});
    fillGames();
    return {fillGames:fillGames,load:function(data){game.value=data.subcategory||'';gameName.value=data.gameName||'';experienceName.value=data.experienceName||'';sync(data);},read:function(){return {gameName:game.value==='Outros jogos'?gameName.value.trim():'',experienceName:game.value==='Roblox'&&experience.value==='Outros jogos'?experienceName.value.trim():''};}};
  };
})(window);
