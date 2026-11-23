// JavaScript / category-page.js / navegador e Node.js / navegação e filtros das categorias.
(function(root){
  'use strict';
  var categories={
    roblox:{name:'Roblox',title:'Contas, Robux e itens de Roblox',description:'Encontre contas, moedas e produtos para seus jogos favoritos do Roblox.',image:'roblox.jpg'},
    freefire:{name:'Free Fire',title:'Contas e produtos de Free Fire',description:'Explore contas, diamantes, itens e serviços para sua próxima partida.',image:'freefire.jpg'},
    valorant:{name:'Valorant',title:'Contas e produtos de Valorant',description:'Escolha o tipo de produto e encontre sua próxima conquista.',image:'valorant.jpg'},
    lol:{name:'League of Legends',title:'Contas e produtos de League of Legends',description:'Explore contas, Riot Points, itens e serviços em um só lugar.',image:'lol.jpg'},
    fortnite:{name:'Fortnite',title:'Contas e produtos de Fortnite',description:'Encontre contas, V-Bucks, itens e serviços para o seu jogo.',image:'fortnite.jpg'},
    genshin:{name:'Genshin Impact',title:'Contas e produtos de Genshin Impact',description:'Explore ofertas e escolha o próximo passo da sua aventura.',image:'genshin.jpg'},
    cs2:{name:'CS2',title:'Contas, skins e produtos de CS2',description:'Filtre contas, skins, itens e serviços para encontrar o que procura.',image:'cs2.jpg'},
    premium:{name:'Assinaturas',title:'Assinaturas e produtos digitais',description:'Compare as ofertas e confira o período e as condições em cada anúncio.',image:'assinaturas-vertical.png'},
    outros:{name:'Outros jogos',title:'Outros jogos, novas possibilidades',description:'Busque pelo nome do jogo e descubra contas, moedas, itens e serviços.',image:'outros-jogos.png'}
  };
  function info(id){return categories[id]||{name:'Todos os anúncios',title:'Explore todas as ofertas',description:'Encontre contas, itens e produtos digitais para sua próxima conquista.',image:''};}
  function filterParams(search,values){
    var params=new URLSearchParams(search);
    ['cat','q','produto','experiencia','min','max','ordem'].forEach(function(key){params.delete(key);});
    if(values.cat)params.set('cat',values.cat);
    if(values.q.trim())params.set('q',values.q.trim());
    if(values.product)params.set('produto',values.product);
    if(values.cat==='roblox'&&values.product!=='Robux'&&values.experience)params.set('experiencia',values.experience);
    ['min','max'].forEach(function(key){var value=values[key];if(value!==''&&Number.isFinite(Number(value))&&Number(value)>=0&&(key!=='min'||Number(value)!==0))params.set(key,value);});
    if(['price_asc','price_desc','sales'].includes(values.sort))params.set('ordem',values.sort);
    return params.toString();
  }
  var api={info:info,filterParams:filterParams};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(!root.document)return;
  var document=root.document,$=function(id){return document.getElementById(id);},apply=function(){},initialized=false;
  function values(){return {cat:$('fCat').value,q:$('fSearch').value,product:$('fProduct').value,experience:$('fExperience').value,min:$('fMin').value,max:$('fMax').value,sort:$('fSort').value};}
  function selectValue(id,value){$(id).value=value;apply();}
  function renderOptions(container,select){
    var options=Array.from(select.options),key=JSON.stringify(options.map(function(option){return option.value;}));
    if(container.dataset.options!==key){
      container.replaceChildren();container.dataset.options=key;
      options.forEach(function(option){var button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.textContent=option.value||'Todos';button.onclick=function(){selectValue(select.id,option.value);};container.append(button);});
    }
    container.querySelectorAll('button').forEach(function(button){button.setAttribute('aria-pressed',String(button.dataset.value===select.value));});
  }
  function filterExperiences(){
    var query=$('experienceSearch').value.trim().toLocaleLowerCase('pt-BR'),matches=0;
    $('categoryExperiences').querySelectorAll('button').forEach(function(button){var visible=!button.dataset.value||button.textContent.toLocaleLowerCase('pt-BR').includes(query);button.hidden=!visible;if(visible&&button.dataset.value)matches++;});
    $('experienceEmpty').hidden=matches>0;
  }
  function chips(){
    var container=$('activeListingFilters'),current=values(),items=[];
    if(current.q.trim())items.push(['fSearch','Busca: '+current.q.trim()]);
    if(current.product)items.push(['fProduct',current.product]);
    if(current.cat==='roblox'&&current.experience)items.push(['fExperience',current.experience]);
    if(current.min&&Number(current.min)>0)items.push(['fMin','A partir de R$ '+Number(current.min).toLocaleString('pt-BR')]);
    if(current.max)items.push(['fMax','Até R$ '+Number(current.max).toLocaleString('pt-BR')]);
    container.replaceChildren();items.forEach(function(item){var button=document.createElement('button');button.type='button';button.textContent=item[1]+' ×';button.setAttribute('aria-label','Remover filtro '+item[1]);button.onclick=function(){selectValue(item[0],'');};container.append(button);});
    $('openListingFilters').textContent='Filtros'+(items.length?' ('+items.length+')':'');
  }
  function quickLinks(){
    var container=$('categoryQuickLinks');renderOptions(container,$('fProduct'));
    container.setAttribute('aria-label','Tipos de produto em '+info($('fCat').value).name);
  }
  function sync(){
    var current=values(),entry=info(current.cat);
    if(current.cat==='roblox'&&current.product==='Robux'){$('fExperience').value='';current.experience='';}
    $('fExperienceLabel').hidden=current.cat!=='roblox'||current.product==='Robux';
    $('categoryTitle').textContent=entry.title;$('categoryDescription').textContent=entry.description;$('categoryCrumb').textContent=entry.name;document.title=entry.name+' | zuhstore';
    var img=$('categoryImage'),src=entry.image?'/assets/categorias/'+entry.image:'';
    img.hidden=!src;$('categoryFallback').hidden=!!src;if(src&&img.getAttribute('src')!==src)img.src=src;
    $('fSearch').placeholder=current.cat?'Buscar em '+entry.name+'…':'Buscar anúncio, jogo ou vendedor…';
    renderOptions($('categoryProducts'),$('fProduct'));renderOptions($('categoryExperiences'),$('fExperience'));filterExperiences();quickLinks();chips();
    try{var params=filterParams(root.location.search,current),next=root.BloxzuhRoutes.cleanHref('/anuncios'+(params?'?'+params:''),root.location.origin+'/');if(next!==root.location.pathname+root.location.search)root.history.replaceState(null,'',next+root.location.hash);}catch(error){}
  }
  function clearFilters(){['fSearch','fProduct','fExperience','fMin','fMax'].forEach(function(id){$(id).value='';});$('fSort').value='rel';$('experienceSearch').value='';apply();}
  function init(callback){
    apply=callback;if(initialized){sync();return;}initialized=true;
    var dialog=$('listingFilterDialog'),sidebar=$('listingFilters'),home=$('filterHomeSlot'),mobile=$('mobileFilterSlot');
    $('openListingFilters').onclick=function(){mobile.append(sidebar);dialog.showModal();};
    $('closeListingFilters').onclick=function(){dialog.close();};$('applyListingFilters').onclick=function(){dialog.close();};
    dialog.addEventListener('close',function(){home.append(sidebar);});
    dialog.addEventListener('click',function(event){if(event.target!==dialog)return;var box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
    root.matchMedia('(max-width:850px)').addEventListener('change',function(){if(dialog.open)dialog.close();});
    document.addEventListener('click',function(event){if(event.target.closest('[data-clear-filters]'))clearFilters();});
    $('experienceSearch').addEventListener('input',filterExperiences);sync();
  }
  api.init=init;api.sync=sync;root.BloxzuhCategoryUI=api;
})(typeof window==='undefined'?globalThis:window);
