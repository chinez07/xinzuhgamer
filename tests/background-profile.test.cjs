// JavaScript / background-profile.test.cjs / Node.js / sincronização privada das preferências.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('js/experimental.js','utf8');
function extract(name,next){return source.slice(source.indexOf('  '+(name==='saveBackgrounds'?'async ':'')+'function '+name+'('),source.indexOf('  function '+next+'('));}
test('salva imagens e escolhas em profiles do próprio usuário',async()=>{
 const stored=new Map(),writes=[];let applied=0;
 const c=vm.createContext({backgroundEdit:0,localStorage:{setItem:(k,v)=>stored.set(k,v)},expStorageKey:()=> 'bloxzuh-exp-alice',applyExperimentalBackground:()=>applied++,currentUser:()=>({uid:'alice'}),firebase:{firestore:()=>({collection:name=>({doc:id=>({set:async(patch,options)=>writes.push({name,id,patch,options})})})})}});
 vm.runInContext(extract('saveBackgrounds','currentUser'),c);
 const settings={desktop:{preset:0,custom:''},mobile:{preset:-1,custom:'data:image/jpeg;base64,YWJj'}};
 await c.saveBackgrounds(settings);
 assert.equal(applied,1);assert.equal(writes[0].name,'profiles');assert.equal(writes[0].id,'alice');assert.equal(writes[0].options.merge,true);
 assert.deepEqual(writes[0].patch.experimentalBackgrounds,settings);
 assert.deepEqual(JSON.parse(stored.get('bloxzuh-exp-alice-backgrounds-v2')),settings);
});
test('restaura fundos da conta sem sobrescrever edição mais recente',async()=>{
 const settings={desktop:{preset:1,custom:''},mobile:{preset:0,custom:''}},stored=new Map();let finish,applied=0;
 const c=vm.createContext({backgroundEdit:0,forceDarkBg(){},currentUser:()=>({uid:'alice'}),expStorageKey:()=> 'alice',localStorage:{setItem:(k,v)=>stored.set(k,v)},BloxzuhBackgrounds:require('../js/background-settings.js'),firebase:{firestore:()=>({collection:()=>({doc:()=>({get:()=>new Promise(r=>finish=r)})})})},writeExpOn(){},writeExpBg(){},document:{getElementById:()=>null},isExperimental:()=>true,applyExperimentalBackground:()=>applied++});
 vm.runInContext(extract('loadFromProfileThenApply','takeOver'),c);
 c.loadFromProfileThenApply();finish({exists:true,data:()=>({experimentalBackgrounds:settings})});await new Promise(r=>setImmediate(r));
 assert.deepEqual(JSON.parse(stored.get('alice-backgrounds-v2')),settings);assert.equal(applied,1);
 stored.clear();c.loadFromProfileThenApply();c.backgroundEdit++;finish({exists:true,data:()=>({experimentalBackgrounds:settings})});await new Promise(r=>setImmediate(r));assert.equal(stored.size,0);
});
