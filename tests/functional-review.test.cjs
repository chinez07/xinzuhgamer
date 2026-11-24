const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function biography({profile={bio:'Cloud bio'},readError=false,writeError=false}={}) {
 const storage=new Map([['xinzuh-bio-alice','Stale local bio']]),writes=[];
 const source=read('js/firebase-auth.js'),box={auth:{currentUser:{uid:'alice'}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fsGetProfile:async()=>{if(readError)throw Error('offline');return profile},fsSaveProfile:async data=>{if(writeError)throw Error('offline');writes.push(data)}};
 vm.runInNewContext(source.slice(source.indexOf('async function getBio()'),source.indexOf('async function deactivateAccountLocal')),box);
 return {box,storage,writes};
}
test('Biography loads from cloud on another device and clears stale local content for an empty cloud value',async()=>{
 const f=biography();assert.equal(await f.box.getBio(),'Cloud bio');assert.equal(f.storage.get('xinzuh-bio-alice'),'Cloud bio');
 const empty=biography({profile:{bio:''}});assert.equal(await empty.box.getBio(),'');
});
test('Biography cache changes only after cloud save succeeds and preserves unrelated profile fields',async()=>{
 const f=biography();await f.box.saveBio(' New bio ');assert.deepEqual(JSON.parse(JSON.stringify(f.writes)),[{bio:'New bio'}]);assert.equal(f.storage.get('xinzuh-bio-alice'),'New bio');
 const failed=biography({writeError:true});await assert.rejects(failed.box.saveBio('Not saved'),/offline/);assert.equal(failed.storage.get('xinzuh-bio-alice'),'Stale local bio');
});
test('Biography read failures are not silently treated as empty cloud data',async()=>{await assert.rejects(biography({readError:true}).box.getBio(),/offline/)});
test('Removing a gallery image keeps pending upload files aligned with the remaining images',()=>{
 const source=read('anunciar.html'),state={gallery:['old','newA','newB'],galleryFiles:[{index:1,file:'A'},{index:2,file:'B'}]},box={state,renderGallery(){}};
 vm.runInNewContext(source.slice(source.indexOf('    function removeGalleryImage('),source.indexOf('    function renderGallery(')),box);
 box.removeGalleryImage(0);assert.deepEqual(JSON.parse(JSON.stringify(state)),{gallery:['newA','newB'],galleryFiles:[{index:0,file:'A'},{index:1,file:'B'}]});
 box.removeGalleryImage(0);assert.deepEqual(JSON.parse(JSON.stringify(state)),{gallery:['newB'],galleryFiles:[{index:0,file:'B'}]});
});
test('Ad summary renders markup as text rather than executable HTML',()=>{
 const source=read('anunciar.html'),box={};vm.runInNewContext(source.slice(source.indexOf('    function escapeSummary('),source.indexOf('    function goStep(')),box);
 assert.equal(box.escapeSummary('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('Dashboard average uses actual reviews and never a sale count as a five-star review',()=>{
 const source=read('painel.html'),node={textContent:''},box={cacheReviews:[],document:{getElementById:()=>node}};
 vm.runInNewContext(source.slice(source.indexOf('    function renderAverageRating('),source.indexOf('    async function loadReviews(')),box);
 box.renderAverageRating();assert.equal(node.textContent,'—');box.cacheReviews=[{stars:5},{stars:3},{stars:9}];box.renderAverageRating();assert.equal(node.textContent,'4.0 ★');
});
test('Public profile has zero rating until actual reviews exist',()=>{
 const source=read('perfil.html'),box={};vm.runInNewContext(source.slice(source.indexOf('      function statsOf('),source.indexOf('      // padrão: recebido como vendedor')),box);
 assert.equal(box.statsOf([]).avg,0);assert.equal(box.statsOf([{stars:5},{stars:3}]).avg,4);
});
