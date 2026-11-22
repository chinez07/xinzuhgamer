// JavaScript / content-moderation.test.mjs / Node.js / contatos, catálogo e análise visual conservadora.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {decision,input,reviewImages,analyzeImage} from '../workers/ad-moderation.mjs';
const require=createRequire(import.meta.url),policy=require('../js/content-policy.js'),catalog=require('../js/ad-catalog.js');
test('Public contacts are masked in common and disguised Brazilian phone formats',()=>{
  for(const text of ['(11) 99999-1234','1 1 9 9 9 9 9 1 2 3 4','11999991234','+55 21 98888-1234','11 99999 1234','11\u200b999991234','９９９９９-１２３４','meu zap: nove nove nove nove oito oito oito oito','teste@email.com','https://wa.me/5511999991234','discord.gg/exemplo','@meuperfil'])assert.notEqual(policy.mask(text),text);
});
test('Prices, stock, game amounts, ordinary questions and dates are preserved',()=>{
  for(const text of ['R$ 123456789,00','Tenho 100000000 Robux','ID 12345678','Entrega em 21/11/2026','Histórico 1999-2026','Tem 500 diamantes?','Como recebo o produto?'])assert.equal(policy.mask(text),text);
});
test('Robux belongs to Roblox; Free Fire has Diamonds; other games require a name',()=>{
  assert.ok(catalog.get('Roblox').products.includes('Robux'));
  assert.ok(catalog.get('Free Fire').products.includes('Diamantes'));
  assert.ok(catalog.validate({subcategory:'Free Fire',productType:'Robux'}));
  assert.ok(catalog.validate({subcategory:'Outros jogos',productType:'Conta'}));
  assert.equal(catalog.validate({subcategory:'Outros jogos',gameName:'Jogo novo',productType:'Conta'}),'');
  assert.ok(catalog.validate({subcategory:'Roblox',section:'Outros jogos',productType:'Robux'}));
  assert.equal(catalog.validate({subcategory:'Roblox',section:'Outros jogos',experienceName:'Experiência nova',productType:'Conta'}),'');
});
test('Vision decisions approve only complete high-confidence matches and send uncertainty to review',()=>{
  assert.equal(decision({hasContact:false,gameMatch:'match',confidence:.99}).decision,'approved');
  assert.equal(decision({hasContact:true,gameMatch:'match',confidence:.99}).decision,'rejected');
  assert.equal(decision({hasContact:false,gameMatch:'mismatch',confidence:.99}).decision,'rejected');
  for(const value of ['invalid','{}',{hasContact:false,gameMatch:'uncertain',confidence:.99},{hasContact:false,gameMatch:'match',confidence:.70},{hasContact:false,gameMatch:'match',confidence:5}])assert.equal(decision(value).decision,'review');
});
test('Image sources cannot request arbitrary hosts or redirect into private services',()=>{
  const data={category:'Jogos',subcategory:'Roblox',section:'Blox Fruits',productType:'Conta',cover:'https://i.ibb.co/test/photo.png',gallery:[]};
  assert.equal(input(data).subcategory,'Roblox');
  for(const cover of ['http://127.0.0.1/secret','https://i.ibb.co.evil.com/a','https://user@i.ibb.co/a','file:///secret'])assert.throws(()=>input({...data,cover}));
});
test('Every gallery image is inspected and one contact or wrong-game photo blocks the set',async()=>{
  const data={title:'Conta Roblox Blox Fruits',desc:'Conta com itens descritos e entrega pelo chat após confirmação.',subcategory:'Roblox',section:'Blox Fruits',productType:'Conta',cover:'https://i.ibb.co/a',gallery:['https://i.ibb.co/b']};let calls=0;
  const ai={run:async(model,body)=>({response:JSON.stringify(Array.isArray(body.messages?.[1]?.content)?{hasContact:++calls===2,gameMatch:'match',confidence:.99}:{compatible:true,clear:true,confidence:.99})})};
  const fetcher=async(url,options)=>{assert.equal(options.redirect,'error');return new Response(new Uint8Array([137,80,78,71,13,10,26,10]),{headers:{'Content-Type':'image/png'}});};
  const result=await reviewImages(data,ai,fetcher);assert.equal(calls,2);assert.equal(result.decision,'rejected');
  assert.equal((await reviewImages(data,null,fetcher)).decision,'review');
});
test('Provider failures never silently approve an image',async()=>{
  const result=await analyzeImage(new Uint8Array([137,80,78,71]),{subcategory:'Roblox'}, {run:async()=>{throw Error('offline');}});
  assert.equal(result.decision,'review');
});


test('Robux in Blox Fruits is rejected even before image analysis or manual approval',()=>{
  const listing={category:'Jogos',subcategory:'Roblox',section:'Blox Fruits',productType:'Robux',title:'Robux · teste',desc:'Pacote de 100 Robux com entrega explicada no anúncio.'};
  assert.equal(catalog.reviewText(listing).decision,'rejected');
  assert.match(catalog.reviewText(listing).reason,/Roblox geral/);
  assert.equal(catalog.reviewText({...listing,section:'Roblox geral'}).decision,'approved');
  assert.equal(catalog.reviewText({...listing,productType:'Conta'}).decision,'rejected');
});
test('Missing, vague and contradictory descriptions have distinct review outcomes',()=>{
  const listing={category:'Jogos',subcategory:'Free Fire',productType:'Conta',title:'Conta Free Fire com itens',desc:'Conta Free Fire com os itens descritos. Entrega pelo chat após o pagamento.'};
  assert.equal(catalog.reviewText(listing).decision,'approved');
  assert.equal(catalog.reviewText({...listing,desc:''}).decision,'rejected');
  assert.equal(catalog.reviewText({...listing,desc:'Um produto muito bom'}).decision,'review');
  assert.equal(catalog.reviewText({...listing,title:'Conta Valorant completa'}).decision,'rejected');
});


test('Gemma vision requests carry a typed image and JSON-only output; malformed images fail closed',async()=>{
  const {moderationRequest,modelJSON,MODERATION_MODELS}=await import('../workers/moderation-ai.mjs');
  const body=moderationRequest('Analyze the product',new Uint8Array([137,80,78,71]));
  assert.equal(MODERATION_MODELS.primary,'@cf/google/gemma-4-26b-a4b-it');
  assert.match(body.messages[1].content[1].image_url.url,/^data:image\/png;base64,/);
  assert.equal(body.response_format.type,'json_object');assert.equal(body.store,false);
  assert.deepEqual(modelJSON({choices:[{message:{content:'{"compatible":true}'}}]}),{compatible:true});
  assert.throws(()=>moderationRequest('image',new Uint8Array([1,2,3])));
});
