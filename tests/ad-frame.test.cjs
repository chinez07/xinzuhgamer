// JavaScript / ad-frame.test.cjs / Node.js / persistência e elegibilidade das molduras MAX.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const frame = require('../js/ad-frame.js');
const transparent = 'data:image/webp;base64,YWJj';
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
test('Image overlays accept only bounded embedded raster images and clear completely when MAX expires', async () => {
  const el=element(), saved={style:'image',image:transparent,ratio:1.64,inset:9,fit:'contain'};
  await frame.decorate(el,saved,'seller',async()=>({active:true}));
  assert.equal(el.attrs.get('data-frame-style'),'image');
  assert.equal(el.props.get('--ad-frame-image'),'url("'+transparent+'")');
  assert.equal(el.props.get('--ad-frame-ratio'),'1.64');
  assert.equal(el.props.get('--ad-frame-inset'),'9%');
  assert.equal(el.props.get('--ad-frame-fit'),'contain');
  await frame.decorate(el,saved,'seller',async()=>({active:false}));
  assert.equal(el.props.size,0);
  for(const image of ['https://example.test/tracker.png','data:image/svg+xml;base64,YWJj','data:image/png;base64,'+'A'.repeat(450000),'data:image/png;base64,YWJj");display:none']) {
    assert.equal(frame.normalize({style:'image',image}).style,'none');
  }
  assert.equal(frame.normalize({...saved,ratio:99,inset:100}).ratio,1.6);
  assert.equal(frame.normalize({...saved,ratio:99,inset:100}).inset,8);
});
test('A background without a frame still checks MAX and is removed on expiration or failure', async () => {
  const photo=element(), page=element(), value={backgroundStyle:'image',backgroundImage:transparent,backgroundColor:'#123456',backgroundDim:50};
  await frame.decorate(photo,value,'seller',async()=>({active:true}),page);
  assert.equal(photo.classes.size,0);
  assert.ok(page.classes.has('ad-custom-background'));
  assert.equal(page.props.get('--ad-background-image'),'url("'+transparent+'")');
  assert.equal(page.props.get('--ad-background-dim'),'0.5');
  for(const lookup of [async()=>({active:false}),async()=>{throw Error('offline');}]) {
    await frame.decorate(photo,value,'seller',lookup,page);
    assert.equal(page.classes.size,0); assert.equal(page.props.size,0);
  }
});
test('Backgrounds reject external and SVG images; size, proportions and corners are bounded', () => {
  const value=frame.normalize({backgroundImage:'https://example.test/tracker.png',backgroundColor:'red;display:none',backgroundDim:200,size:900,proportion:'url(evil)',radius:99});
  assert.equal(value.backgroundImage,''); assert.equal(value.backgroundColor,'#0f0f14'); assert.equal(value.backgroundDim,35);
  assert.equal(value.size,100); assert.equal(value.proportion,'auto'); assert.equal(value.radius,20);
  const el=element(); frame.apply(el,{style:'image',image:transparent,size:70,proportion:'wide',radius:24},true);
  assert.equal(el.props.get('--ad-frame-size'),'70%'); assert.equal(el.props.get('--ad-frame-ratio'),String(16/9)); assert.equal(el.props.get('--ad-frame-radius'),'24px');
});
test('Panel color and transparency work independently of frames/backgrounds and require active MAX',async()=>{
  const photo=element(),page=element();let requests=0;
  await frame.decorate(photo,{panelColor:'#123456',panelTransparency:50},'seller',async()=>{requests++;return {active:true};},page);
  assert.equal(requests,1);assert.ok(page.classes.has('ad-panel-theme'));
  assert.equal(page.props.get('--ad-panel-background'),'rgba(18,52,86,0.5)');
  frame.applyPanels(page,{panelColor:'#ffffff',panelTransparency:0},true);
  assert.equal(page.props.get('--ad-panel-text'),'#111118');
  frame.applyPanels(page,{panelColor:'#ffffff',panelTransparency:100},true);
  assert.equal(page.props.get('--ad-panel-background'),'rgba(255,255,255,0)');
  await frame.decorate(photo,{panelColor:'#123456',panelTransparency:50},'seller',async()=>({active:false}),page);
  assert.equal(page.classes.size,0);assert.equal(page.props.size,0);
});
test('Invalid panel settings cannot inject CSS or produce out-of-range transparency',()=>{
  const value=frame.normalize({panelColor:'red;display:none',panelTransparency:101});
  assert.equal(value.panelColor,'#16161f');assert.equal(value.panelTransparency,0);
});
test('Creating, editing and reloading two ads preserves different frames and original gallery photos', async () => {
  const docs=new Map(); let seq=0;
  const firestore=()=>({collection:()=>({doc:id=>({
    set:async value=>docs.set(id,value),
    get:async()=>({exists:docs.has(id),data:()=>docs.get(id)}),
    update:async patch=>docs.set(id,{...docs.get(id),...patch})
  })})});
  firestore.FieldValue={serverTimestamp:()=>0};
  const context=vm.createContext({window:{BloxzuhAdFrame:frame},BloxzuhAdFrame:frame,BloxzuhAdModeration:{review:async()=>({reviewId:'test-approved',decision:'approved'})},firebase:{firestore,auth:()=>({currentUser:{uid:'seller'},onAuthStateChanged(){}})},document:{addEventListener(){}},setTimeout(){},console:{log(){},warn(){},error(){}}});
  const source=fs.readFileSync(path.join(__dirname,'../js/firestore-db.js'),'utf8');
  vm.runInContext(source,context);
  context.bloxzuhDocId=()=> 'AD'+(++seq);
  const data={title:'Test',price:10,cover:'original.jpg',gallery:['original.jpg','second.jpg']};
  const a=await context.fsCreateAd({...data,imageFrame:{style:'image',image:transparent,ratio:1.64,inset:9,backgroundStyle:'image',backgroundImage:transparent,size:80,radius:24,panelColor:'#123456',panelTransparency:65}});
  const b=await context.fsCreateAd({...data,imageFrame:{style:'solid',color:'#123456'}});
  const reloaded=await context.fsGetAdById(a);
  assert.equal(reloaded.raw.imageFrame.image,transparent);
  assert.equal(reloaded.raw.imageFrame.ratio,1.64);
  assert.equal(reloaded.raw.imageFrame.backgroundImage,transparent);
  assert.equal(reloaded.raw.imageFrame.size,80);
  assert.equal(reloaded.raw.imageFrame.panelColor,'#123456');
  assert.equal(reloaded.raw.imageFrame.panelTransparency,65);
  await context.fsUpdateAd(a,{imageFrame:frame.normalize({style:'gradient',color:'#654321'})});
  assert.equal((await context.fsGetAdById(a)).raw.imageFrame.style,'gradient');
  assert.equal((await context.fsGetAdById(b)).raw.imageFrame.color,'#123456');
  assert.equal(docs.get(a).cover,data.cover);
  assert.deepEqual(docs.get(a).gallery,data.gallery);
  docs.set(b,{...docs.get(b),status:'ativo',moderationReviewId:'server-approved'});
  await context.fsUpdateAd(b,{status:'pausado'});
  assert.equal(docs.get(b).status,'pausado');
  context.BloxzuhAdModeration.review=async()=>({reviewId:'test-pending',decision:'review'});
  const pending=await context.fsCreateAd({...data,imageFrame:{style:'none'}});
  assert.equal(docs.get(pending).status,'pendente');
  await assert.rejects(()=>context.fsUpdateAd(pending,{status:'ativo'}),/Aguarde a revisão/);
  context.BloxzuhAdModeration.review=async id=>{assert.equal(docs.get(id).status,'pendente');throw Error('Service offline');};
  const offline=await context.fsCreateAd(data);
  assert.equal(docs.get(offline).status,'pendente');
  assert.equal(docs.get(offline).moderationReviewId,'');
  // Authentication is also checked by Firestore rules in production.
  context.requireUser=()=>({uid:'other-seller'});
  await assert.rejects(()=>context.fsUpdateAd(a,{imageFrame:{style:'none'}}),/Sem permissão/);
});
