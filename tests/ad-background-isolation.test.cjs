// JavaScript / ad-background-isolation.test.cjs / Node.js / fundo público separado das preferências do visitante.
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/experimental.js'),'utf8');
function extract(name,next) {return source.slice(source.indexOf('  function '+name+'('),source.indexOf('  function '+next+'('));}
function setup(url) {
  const props=new Map([['background-image','url(experimental.jpg)'],['--ad-background-image','url(saved-ad.webp)']]);
  const classes=new Set(['exp-bg','ad-custom-background']);
  const body={style:{removeProperty:k=>props.delete(k)},classList:{remove:k=>classes.delete(k),add:k=>classes.add(k)},offsetHeight:0};
  const layer={style:{backgroundImage:'url(experimental.jpg)',display:'block'}};
  const button={classList:{remove(){}},style:{display:'inline-flex'}};
  let preferencesRead=0;
  const context=vm.createContext({location:{pathname:url},document:{body,documentElement:{classList:{remove(){}},style:{removeProperty(){}}},getElementById:id=>id==='bzBgLayer'?layer:id==='bgChangeBtn'?button:null},
    injectCoverFix(){},injectCatFix(){},forceDarkBg(){},isPainelPage:()=>false,isExperimental:()=>{preferencesRead++;return false;},isLogged:()=>true});
  vm.runInContext(extract('isAdDetailPage','injectCoverFix')+extract('clearBg','applyExperimentalBackground')+extract('applyExperimentalBackground','persistToProfile'),context);
  return {context,props,classes,layer,button,reads:()=>preferencesRead};
}
test('Both public ad URLs ignore visitor experimental backgrounds without changing saved ad appearance',()=>{
  for(const url of ['/anuncio','/anuncio.html','/anuncio/']) {
    const s=setup(url);s.context.applyExperimentalBackground();
    assert.equal(s.reads(),0);assert.equal(s.classes.has('exp-bg'),false);
    assert.equal(s.classes.has('ad-custom-background'),true);
    assert.equal(s.props.get('--ad-background-image'),'url(saved-ad.webp)');
    assert.equal(s.props.has('background-image'),false);
    assert.equal(s.layer.style.display,'none');assert.equal(s.button.style.display,'none');
  }
});
test('Home, listings and ad creation keep their existing experimental preference flow',()=>{
  for(const url of ['/','/index.html','/anuncios','/anuncios.html','/anunciar','/anunciar.html']) {
    const s=setup(url);s.context.applyExperimentalBackground();assert.equal(s.reads(),1);
  }
});
