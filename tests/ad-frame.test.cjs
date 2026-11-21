// JavaScript / ad-frame.test.cjs / Node.js / persistência e elegibilidade das molduras MAX.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const frame = require('../js/ad-frame.js');
function element() {
  const classes = new Set(), props = new Map(), attrs = new Map();
  return {classes, props, attrs, isConnected:true,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},
    style:{setProperty:(k,v)=>props.set(k,v),removeProperty:k=>props.delete(k)},
    setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
}
test('Untrusted frame values cannot inject CSS, URLs or oversized borders', () => {
  assert.deepEqual(frame.normalize({style:'url(evil)',color:'red;position:fixed',secondary:'url(x)',width:999,radius:-1}),frame.normalize());
  assert.equal(frame.normalize({style:'gradient',color:'#123456',width:12,radius:0}).radius,0);
});
test('Active MAX applies each ad independently; inactive, expired and failed lookups remove decorations', async () => {
  const a=element(), b=element(), saved={style:'gradient',color:'#123456'};
  await frame.decorate(a,saved,'seller',async()=>({active:true}));
  await frame.decorate(b,{style:'solid',color:'#abcdef'},'seller',async()=>({active:true}));
  assert.equal(a.props.get('--ad-frame-color'),'#123456');
  assert.equal(b.props.get('--ad-frame-color'),'#abcdef');
  for (const lookup of [async()=>({active:false}),async()=>({active:'true'}),async()=>{throw Error('offline');}]) {
    frame.apply(a,saved,true);
    await frame.decorate(a,saved,'seller',lookup);
    assert.equal(a.classes.size,0); assert.equal(a.props.size,0);
  }
});
test('No frame is the default and never requires a subscription request', async () => {
  const el=element(); let calls=0;
  await frame.decorate(el,undefined,'seller',async()=>{calls++;return {active:true};});
  assert.equal(calls,0); assert.equal(el.classes.size,0);
  frame.apply(el,{style:'neon'},true); frame.apply(el,{style:'none'},true);
  assert.equal(el.classes.size,0); assert.equal(el.attrs.size,0);
});
test('Creating, editing and reloading two ads preserves different frames and original gallery photos', async () => {
  const docs=new Map(); let seq=0;
  const firestore=()=>({collection:()=>({doc:id=>({
    set:async value=>docs.set(id,value),
    get:async()=>({exists:docs.has(id),data:()=>docs.get(id)}),
    update:async patch=>docs.set(id,{...docs.get(id),...patch})
  })})});
  firestore.FieldValue={serverTimestamp:()=>0};
  const context=vm.createContext({window:{BloxzuhAdFrame:frame},BloxzuhAdFrame:frame,firebase:{firestore,auth:()=>({currentUser:{uid:'seller'},onAuthStateChanged(){}})},document:{addEventListener(){}},setTimeout(){},console:{log(){},warn(){},error(){}}});
  const source=fs.readFileSync(path.join(__dirname,'../js/firestore-db.js'),'utf8');
  vm.runInContext(source,context);
  context.bloxzuhDocId=()=> 'AD'+(++seq);
  const data={title:'Test',price:10,cover:'original.jpg',gallery:['original.jpg','second.jpg']};
  const a=await context.fsCreateAd({...data,imageFrame:{style:'neon',color:'#abcdef'}});
  const b=await context.fsCreateAd({...data,imageFrame:{style:'solid',color:'#123456'}});
  await context.fsUpdateAd(a,{imageFrame:frame.normalize({style:'gradient',color:'#654321'})});
  assert.equal((await context.fsGetAdById(a)).raw.imageFrame.style,'gradient');
  assert.equal((await context.fsGetAdById(b)).raw.imageFrame.color,'#123456');
  assert.equal(docs.get(a).cover,data.cover);
  assert.deepEqual(docs.get(a).gallery,data.gallery);
  // Authentication is also checked by Firestore rules in production.
  context.requireUser=()=>({uid:'other-seller'});
  await assert.rejects(()=>context.fsUpdateAd(a,{imageFrame:{style:'none'}}),/Sem permissão/);
});
