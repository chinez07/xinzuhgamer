// JavaScript / ad-images.test.cjs / Node.js / resolução, envio único e preservação em falhas.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/cover-worker-patch.js'),'utf8');
function setup(fail=false) {
  const encodings=[],uploads=[],writes=[];
  class Reader {readAsDataURL(file) {this.result=file;this.onload();}}
  class Picture {set src(file) {this.naturalWidth=file.width;this.naturalHeight=file.height;this.onload();}}
  const context={WeakMap,FileReader:Reader,Image:Picture,console,document:{readyState:'complete',createElement:()=>{
    const canvas={getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:(type,quality)=>{encodings.push({width:canvas.width,height:canvas.height,quality});return 'data:image/jpeg;base64,YWJj';}};return canvas;
  }},setInterval(){},clearInterval(){},fetch:async(url,request)=>{uploads.push({url,request});return {ok:!fail,json:async()=>fail?{}:{success:true,data:{url:'https://i.ibb.co/test/original.jpg',display_url:'https://i.ibb.co/test/small.jpg'}}};}};
  context.window=context;context.BLOXZUH_IMGBB_WORKER='https://uploader.example';
  context.fsCreateAd=async data=>writes.push(data);context.fsUpdateAd=async(id,data)=>writes.push({id,...data});
  vm.createContext(context);vm.runInContext(source,context);
  return {context,encodings,uploads,writes,api:context.BloxzuhAdImages};
}
test('Uploads preserve 1600px detail at quality .9, keep aspect ratio and prefer original hosted URL',async()=>{
  const s=setup(),file={type:'image/jpeg',size:100000,width:2400,height:1600};
  assert.equal(await s.api.prepare(file),'https://i.ibb.co/test/original.jpg');
  assert.deepEqual(s.encodings,[{width:1600,height:1067,quality:.9}]);
  assert.equal(s.uploads.length,1);
  assert.equal(JSON.parse(s.uploads[0].request.body).image,'YWJj');
});
test('Small originals are never enlarged and retries reuse successful uploads instead of recompressing',async()=>{
  const s=setup(),file={type:'image/png',size:1000,width:320,height:200};
  await Promise.all([s.api.prepare(file),s.api.prepare(file)]);await s.api.prepare(file);
  assert.deepEqual(s.encodings,[{width:320,height:200,quality:.9}]);assert.equal(s.uploads.length,1);
});
test('Upload failure is reported, never falls back to blurry inline images, and can be retried',async()=>{
  const s=setup(true),file={type:'image/jpeg',size:1000,width:1200,height:800};
  await assert.rejects(()=>s.api.prepare(file),/Não foi possível enviar/);
  await assert.rejects(()=>s.api.prepare(file),/Não foi possível enviar/);
  assert.equal(s.uploads.length,2);assert.equal(s.writes.length,0);
});
test('Installing twice does not stack upload hooks; editing preserves existing gallery URLs',async()=>{
  const s=setup(),fn=s.context.fsUpdateAd;
  vm.runInContext(source,s.context);assert.equal(s.context.fsUpdateAd,fn);
  const gallery=['https://i.ibb.co/a/photo.jpg','https://i.ibb.co/b/photo.jpg'];
  await s.context.fsUpdateAd('AD1',{cover:gallery[0],gallery,title:'Updated',imageFrame:{style:'neon'}});
  assert.equal(s.writes.length,1);assert.equal(s.uploads.length,0);
  assert.deepEqual(Array.from(s.writes[0].gallery),gallery);assert.equal(s.writes[0].imageFrame.style,'neon');
});
test('Invalid formats and oversized files are rejected before network requests',async()=>{
  const s=setup();
  for(const file of [{type:'image/svg+xml',size:100},{type:'image/jpeg',size:6*1024*1024}]) await assert.rejects(()=>s.api.prepare(file),/até 5 MB/);
  assert.equal(s.uploads.length,0);
});
