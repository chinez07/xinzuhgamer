// JavaScript / max-active-page.test.cjs / Node.js / checkout oculto durante qualquer acesso MAX ativo.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/max-page.js'),'utf8');
function page() {
  const nodes=new Map(),links=[{},{}];
  function el(id) {if(!nodes.has(id)) nodes.set(id,{hidden:true,textContent:'',value:'',removeAttribute(){}});return nodes.get(id);}
  const context=vm.createContext({el,document:{querySelectorAll:()=>links},memberActive:false,salesEnabled:true,uid:'alice',polling:null,cover:'',theme:{},
    firebase:{auth:()=>({currentUser:{displayName:'Alice'}})},BloxzuhStoreTheme:require('../js/store-theme.js'),
    date:()=> '27/11/2026, 04:14',scheduleMembershipRefresh(){},showBackgrounds(){},scheduleFields(){},clearInterval(){},encodeURIComponent});
  vm.runInContext(source.slice(source.indexOf('  function renderMember('),source.indexOf('  async function reloadAccount(')),context);
  return {context,el,links};
}
test('Paid and trial members see MAX ativo, expiry and settings with checkout and QR hidden',()=>{
  for(const testAccess of [false,true]) {
    const p=page(); p.context.renderMember({member:{active:true,testAccess,expiresAt:Date.now()+86400000},trialEligible:true});
    assert.match(p.el('maxState').textContent,/MAX ativo/);assert.match(p.el('maxState').textContent,/27\/11\/2026/);
    assert.equal(p.el('maxCheckout').hidden,true);assert.equal(p.el('maxGenerate').disabled,true);
    assert.equal(p.el('maxPayment').hidden,true);assert.equal(p.el('maxTrial').hidden,true);assert.equal(p.el('maxSettings').hidden,false);
    assert.ok(p.links.every(l=>l.textContent==='MAX ativo · Gerenciar'));
  }
});
test('Server-confirmed expiry shows purchase again and preserves the closed-sales restriction',()=>{
  const p=page();p.context.renderMember({member:{active:true,expiresAt:Date.now()+1000}});
  p.context.renderMember({member:{active:false,expiresAt:Date.now()-1000},trialEligible:false});
  assert.equal(p.el('maxCheckout').hidden,false);assert.equal(p.el('maxGenerate').disabled,false);assert.equal(p.el('maxSettings').hidden,true);
  p.context.salesEnabled=false;p.context.renderMember({member:{active:false}});
  assert.equal(p.el('maxCheckout').hidden,true);assert.equal(p.el('maxGenerate').disabled,true);
});
