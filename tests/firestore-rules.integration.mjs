// JavaScript / firestore-rules.integration.mjs / Node.js + Firestore Emulator / nenhuma conexão com produção.
import {test,before,after,beforeEach} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../.local-preview/rules-tools/package.json',import.meta.url));
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,setDoc,getDoc,updateDoc,collection,query,where,getDocs,writeBatch}=require('firebase/firestore');
let env;
const admin='cQaqR7WBJVZGodL23p6Csi7vrEn2';
const ad={sellerUid:'seller',sellerName:'Vendedor',title:'Conta Roblox Blox Fruits',desc:'Conta com os itens descritos e entrega pelo chat.',category:'Jogos',subcategory:'Roblox',section:'Blox Fruits',gameName:'',experienceName:'',productType:'Conta',cover:'https://i.ibb.co/test/cover.jpg',gallery:[],imageFrame:{},stock:1,price:10,sales:0,sold:0,status:'ativo',moderationReviewId:'IRAPPROVED'};
const receipt={...Object.fromEntries(['sellerUid','title','desc','category','subcategory','section','gameName','experienceName','productType','cover','gallery','imageFrame'].map(k=>[k,ad[k]])),decision:'approved'};
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-bloxzuh-moderation',firestore:{host:'127.0.0.1',port:8089,rules:fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();await setDoc(doc(db,'ads/EXISTING'),ad);await setDoc(doc(db,'imageReviews/IRAPPROVED'),receipt);await setDoc(doc(db,'imageReviews/IRPENDING'),{...receipt,decision:'review'});});});
const db=uid=>env.authenticatedContext(uid).firestore();
test('Approved receipts allow only the owning seller and exact reviewed content',async()=>{
  await assertSucceeds(setDoc(doc(db('seller'),'ads/VALID'),ad));
  await assertFails(setDoc(doc(db('attacker'),'ads/STOLEN'),{...ad,sellerUid:'attacker'}));
  for(const patch of [{cover:'https://i.ibb.co/changed.jpg'},{title:'Outro produto'},{desc:'Descrição modificada'},{subcategory:'Free Fire'},{productType:'Robux'},{moderationReviewId:'MISSING'}])await assertFails(setDoc(doc(db('seller'),'ads/TAMPERED'),{...ad,...patch}));
});
test('Pending ads cannot become public or active through the seller client',async()=>{
  const pending={...ad,status:'pendente',moderationReviewId:'IRPENDING'};
  await assertSucceeds(setDoc(doc(db('seller'),'ads/PENDING'),pending));
  await assertFails(updateDoc(doc(db('seller'),'ads/PENDING'),{status:'ativo'}));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'ads/PENDING')));
  await assertSucceeds(getDoc(doc(db('seller'),'ads/PENDING')));
  await assertSucceeds(getDoc(doc(db(admin),'ads/PENDING')));
  await assertFails(setDoc(doc(db('seller'),'imageReviews/FAKE'),receipt));
  await assertFails(updateDoc(doc(db('seller'),'imageReviews/IRPENDING'),{decision:'approved'}));
});
test('An administrator can atomically approve a pending review and the ad',async()=>{
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'ads/PENDING'),{...ad,status:'pendente',moderationReviewId:'IRPENDING'}));
  const database=db(admin),batch=writeBatch(database);
  batch.update(doc(database,'imageReviews/IRPENDING'),{decision:'approved',reviewedBy:admin,reviewedAtMs:Date.now(),reason:'Imagens conferidas'});
  batch.update(doc(database,'ads/PENDING'),{status:'ativo'});
  await assertSucceeds(batch.commit());
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'ads/PENDING')));
});
test('Public queries are limited to active ads and preserve seller storefront queries',async()=>{
  const publicDb=env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(query(collection(publicDb,'ads'),where('sellerUid','==','seller'),where('status','==','ativo'))));
  await assertFails(getDocs(collection(publicDb,'ads')));
});
test('Legacy ads can be paused without forging an approval but cannot change media',async()=>{
  const legacy={...ad};delete legacy.moderationReviewId;
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'ads/LEGACY'),legacy));
  await assertSucceeds(updateDoc(doc(db('seller'),'ads/LEGACY'),{status:'pausado'}));
  await assertFails(updateDoc(doc(db('seller'),'ads/LEGACY'),{status:'ativo'}));
  await assertFails(updateDoc(doc(db('seller'),'ads/LEGACY'),{cover:'https://i.ibb.co/new.jpg'}));
});
test('Financial invariants remain server-only after moderation changes',async()=>{
  await assertFails(updateDoc(doc(db('seller'),'ads/EXISTING'),{sales:100,sold:100}));
  await assertFails(setDoc(doc(db('seller'),'wallets/seller'),{saldo:1000}));
  await assertFails(setDoc(doc(db('buyer'),'orders/FAKE'),{buyerUid:'buyer',sellerUid:'seller',status:'pago'}));
});
test('Raw phone numbers are denied in public questions and masked text can be saved',async()=>{
  const question={adId:'EXISTING',sellerUid:'seller',userUid:'buyer',userId:'buyer',text:'Me chama no 1 1 9 9 9 9 9 1 2 3 4',reply:''};
  await assertFails(setDoc(doc(db('buyer'),'adQuestions/PHONE'),question));
  await assertSucceeds(setDoc(doc(db('buyer'),'adQuestions/MASKED'),{...question,text:'Me chama no * * * * * * * * * * *'}));
  await assertFails(updateDoc(doc(db('seller'),'adQuestions/MASKED'),{reply:'(11) 99999-1234',replyUid:'seller'}));
  await assertSucceeds(updateDoc(doc(db('seller'),'adQuestions/MASKED'),{reply:'Contato: ***********',replyUid:'seller'}));
});
