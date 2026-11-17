// JavaScript / tests/painel-settings.test.cjs / Node.js / dados e segurança da conta no painel.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
async function settings(options={}){
 const nodes=new Map(),authListeners=[],writes=[],passwords=[],sent=[];
 const user={uid:'alice',email:'alice@example.test',displayName:'Alice',emailVerified:false,providerData:[{providerId:options.google?'google.com':'password'}],metadata:{creationTime:'2026-10-01T00:00:00Z'},async sendEmailVerification(){sent.push(true)},async reload(){this.emailVerified=true},async updatePassword(value){if(options.recentLogin)throw {code:'auth/requires-recent-login'};passwords.push(value)}};
 function element(id){if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false,disabled:false,handlers:{},classList:{toggle(){}},addEventListener(event,fn){this.handlers[event]=fn}});return nodes.get(id)}
 const local=[];
 const box={window:{},document:{getElementById:element},firebase:{auth:()=>({currentUser:user,onAuthStateChanged:fn=>{authListeners.push(fn);fn(user)}})},fsGetProfile:async()=>{if(options.readError)throw Error('offline');return {bio:'Bio salva',photo:'preserved'}},fsSaveProfile:async data=>writes.push(data),updateDisplayName:async name=>{user.displayName=name},localStorage:{setItem:(key,value)=>local.push([key,value])},Date,console};
 vm.runInNewContext(fs.readFileSync('js/painel-settings.js','utf8'),box);await new Promise(resolve=>setImmediate(resolve));
 return {user,nodes,writes,passwords,sent,local,element,async trigger(id,event='click'){await element(id).handlers[event]({preventDefault(){}})}};
}
test('Data updates save only name and biography, preserving existing photo and email',async()=>{
 const f=await settings();assert.equal(f.element('sellerDataSave').disabled,false);assert.equal(f.element('sellerDataBio').value,'Bio salva');
 f.element('sellerDataName').value='Nova Alice';f.element('sellerDataBio').value='Nova bio';await f.trigger('sellerDataForm','submit');
 assert.deepEqual(JSON.parse(JSON.stringify(f.writes)),[{displayName:'Nova Alice',bio:'Nova bio'}]);assert.equal(f.user.displayName,'Nova Alice');
});
test('Failed reads cannot overwrite cloud data with blank fields',async()=>{
 const f=await settings({readError:true});assert.equal(f.element('sellerDataSave').disabled,true);await f.trigger('sellerDataForm','submit');assert.equal(f.writes.length,0);
});
test('Verification is based on Auth state and email is sent only after the button action',async()=>{
 const f=await settings();assert.equal(f.sent.length,0);assert.equal(f.element('sellerEmailStatus').textContent,'Pendente');
 await f.trigger('sellerSendVerification');assert.equal(f.sent.length,1);await f.trigger('sellerRefreshVerification');assert.equal(f.element('sellerEmailStatus').textContent,'Confirmado');assert.equal(f.element('sellerSendVerification').hidden,true);
});
test('Google-only accounts never receive an email/password change form',async()=>{
 const f=await settings({google:true});assert.equal(f.element('sellerPasswordCard').hidden,true);assert.equal(f.element('sellerGoogleSecurity').hidden,false);await f.trigger('sellerPasswordForm','submit');assert.equal(f.passwords.length,0);
});
test('Password mismatch does not call Firebase; recent-login errors clear both password fields',async()=>{
 const f=await settings({recentLogin:true});f.element('sellerNewPassword').value='test-password';f.element('sellerConfirmPassword').value='different';await f.trigger('sellerPasswordForm','submit');assert.equal(f.passwords.length,0);
 f.element('sellerConfirmPassword').value='test-password';await f.trigger('sellerPasswordForm','submit');assert.equal(f.element('sellerNewPassword').value,'');assert.equal(f.element('sellerConfirmPassword').value,'');assert.match(f.element('sellerPasswordMessage').textContent,/entre novamente/);assert.equal(f.local.length,0);
});
