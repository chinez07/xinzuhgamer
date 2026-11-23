// JavaScript / search-overlay.test.cjs / Node.js / resultados e concorrência da busca.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/search-overlay.js','utf8');
function section(name,next){return source.slice(source.indexOf('  function '+name+'('),source.indexOf('  function '+next+'('));}
function context(loadAds){
 const body={innerHTML:''},overlay={open:true};
 const c=vm.createContext({searchVersion:0,document:{getElementById:id=>id==='bzSearchBody'?body:overlay},loadAds,loadProfiles:async()=>[],CATS:[{id:'roblox',name:'Roblox',href:'/categoria/roblox'}],console});
 vm.runInContext(section('esc','ensureOverlay')+section('visOf','wireTriggers'),c);
 return {c,body,overlay};
}
test('resposta lenta anterior não substitui a pesquisa mais recente',async()=>{
 let finish,calls=0;const s=context(()=>++calls===1?new Promise(r=>finish=r):Promise.resolve([]));
 const old=s.c.runSearch('antigo');await s.c.runSearch('roblox');const latest=s.body.innerHTML;
 assert.match(latest,/categoria\/roblox/);finish([{title:'antigo',status:'ativo',id:'old'}]);await old;
 assert.equal(s.body.innerHTML,latest);
});
test('resultados atrasados não alteram a janela após fechar',async()=>{
 let finish;const s=context(()=>new Promise(r=>finish=r));s.body.innerHTML='Categorias';
 const pending=s.c.runSearch('roblox');s.overlay.open=false;finish([]);await pending;
 assert.equal(s.body.innerHTML,'Categorias');
});
test('busca omite anúncio pendente, escapa título e mantém Diamante primeiro',async()=>{
 const s=context(async()=>[{id:'silver',title:'teste comum',status:'ativo',price:10},{id:'diamond',title:'teste <img onerror=alert(1)>',visibility:'diamante',status:'ativo',price:20},{id:'pending',title:'teste pendente',status:'pendente'}]);
 await s.c.runSearch('teste');
 assert.doesNotMatch(s.body.innerHTML,/id=pending|<img onerror/);assert.match(s.body.innerHTML,/&lt;img onerror/);
 assert.ok(s.body.innerHTML.indexOf('id=diamond')<s.body.innerHTML.indexOf('id=silver'));
});
