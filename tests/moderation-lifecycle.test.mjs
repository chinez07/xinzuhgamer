// JavaScript / moderation-lifecycle.test.mjs / Node.js / transições assíncronas de anúncios.
import test from 'node:test';
import assert from 'node:assert/strict';
import {processSavedModeration} from '../workers/ad-moderation.mjs';
const listing={sellerUid:'seller',title:'Conta Roblox completa',desc:'Conta Roblox com inventário básico e entrega pelo chat da compra.',category:'Jogos',subcategory:'Roblox',section:'Roblox geral',productType:'Conta',cover:'https://i.ibb.co/test/cover.png',gallery:[],stock:1,status:'pendente',moderationRevision:'REV1',moderationReviewId:'IR1'};
function fixture(patch={}){
 const rows=new Map([['ads/AD1',{...listing,...patch}],['imageReviews/IR1',{decision:'review'}]]);let committed=0;
 return {rows,get committed(){return committed;},async get(path){return {path,data:structuredClone(rows.get(path)),version:1};},async commit(changes){committed++;for(const {doc,patch}of changes)rows.set(doc.path,{...rows.get(doc.path),...patch});}};
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const photo=async()=>new Response(png,{headers:{'Content-Type':'image/png'}});
const goodAI={async run(_model,body){return {response:JSON.stringify(body.messages.some(m=>Array.isArray(m.content)&&m.content.some(c=>c.type==='image_url'))?{hasContact:false,gameMatch:'match',confidence:.99}:{compatible:true,clear:true,confidence:.99})};}};
test('A pending ad is activated only after approved text and images',async()=>{
 const db=fixture();await processSavedModeration(db,'AD1','REV1','IR1',goodAI,photo);assert.equal(db.rows.get('ads/AD1').status,'ativo');assert.equal(db.rows.get('imageReviews/IR1').decision,'approved');
});
test('Category contradictions are saved as rejected with a correction reason',async()=>{
 const db=fixture({title:'Conta de Free Fire'});await processSavedModeration(db,'AD1','REV1','IR1',goodAI,photo);assert.equal(db.rows.get('ads/AD1').status,'reprovado');assert.match(db.rows.get('ads/AD1').moderationReason,/Free Fire/);
});
test('An AI outage leaves the saved ad pending and unavailable for purchase',async()=>{
 const db=fixture();await processSavedModeration(db,'AD1','REV1','IR1',null,photo);assert.equal(db.rows.get('ads/AD1').status,'pendente');assert.equal(db.rows.get('imageReviews/IR1').decision,'review');
});
test('An image fetch failure stays in manual review instead of losing the listing',async()=>{
 const db=fixture();await processSavedModeration(db,'AD1','REV1','IR1',goodAI,async()=>{throw Error('offline');});assert.equal(db.rows.get('ads/AD1').status,'pendente');assert.match(db.rows.get('ads/AD1').moderationReason,/indisponível/);
});
test('A late AI result cannot approve newer edits or override a manual decision',async()=>{
 for(const mutation of [()=>({moderationRevision:'REV2'}),()=>({status:'reprovado'})]){
 const db=fixture();let changed=false;const ai={async run(...args){if(!changed){changed=true;db.rows.set('ads/AD1',{...db.rows.get('ads/AD1'),...mutation()});}return goodAI.run(...args);}};
 await processSavedModeration(db,'AD1','REV1','IR1',ai,photo);assert.equal(db.committed,0);
 }
});
test('Approved ads without stock remain paused',async()=>{
 const db=fixture({stock:0});await processSavedModeration(db,'AD1','REV1','IR1',goodAI,photo);assert.equal(db.rows.get('ads/AD1').status,'pausado');
});

test('Worker image fetch uses manual redirects and never follows another location',async()=>{
 const db=fixture();let calls=0;
 await processSavedModeration(db,'AD1','REV1','IR1',goodAI,async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/private'}});});
 assert.equal(calls,1);assert.equal(db.rows.get('ads/AD1').status,'pendente');assert.equal(db.rows.get('imageReviews/IR1').decision,'review');
});
