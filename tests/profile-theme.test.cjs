// JavaScript / tests/profile-theme.test.cjs / Node.js / perfil MAX autorizado por conta.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const theme=require('../js/store-theme.js');
async function profile(member,user,fail=false){
  const styles={},classes=new Set(),link={hidden:true};
  const hero={isConnected:true},marker={getAttribute:()=> 'alice'};
  const page={querySelector:q=>q==='.profile-hero'?hero:marker};
  const body={style:{setProperty:(key,value)=>styles[key]=value},classList:{add:value=>classes.add(value)}};
  const doc={readyState:'complete',body,getElementById:id=>id==='page'?page:link};
  const context={document:doc,firebase:{auth:()=>({currentUser:user,onAuthStateChanged:fn=>fn(user)})},BloxzuhMax:{publicMember:async()=>{if(fail)throw Error('unavailable');return member}},BloxzuhStoreTheme:theme};
  vm.runInNewContext(fs.readFileSync('js/profile-theme.js','utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  return {styles,classes,link};
}
test('Only active MAX applies the profile theme and only its owner sees the edit link',async()=>{
  const member={active:true,theme:{accent:'#60a5fa'}};
  const owner=await profile(member,{uid:'alice'});
  assert.equal(owner.link.hidden,false);
  assert.equal(owner.styles['--store-accent'],'#60a5fa');
  assert.equal(owner.classes.has('profile-max-active'),true);
  for(const user of [null,{uid:'bob'}])assert.equal((await profile(member,user)).link.hidden,true);
});
test('Expired MAX and failed membership reads leave premium appearance disabled',async()=>{
  for(const [member,fail] of [[{active:false,theme:{accent:'#60a5fa'}},false],[{},true]]){
    const result=await profile(member,{uid:'alice'},fail);
    assert.equal(result.link.hidden,true);
    assert.equal(result.classes.has('profile-max-active'),false);
    assert.deepEqual(result.styles,{});
  }
});
