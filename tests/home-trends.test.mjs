// JavaScript / home-trends.test.mjs / Node.js / ranking de compras concluídas e privacidade.
import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCompletedGames,homeTrends} from '../workers/home-trends.mjs';
import {marketHandle} from '../workers/market-core.mjs';
import {firestoreService,firestoreValue} from '../workers/firestore-service.mjs';
import {generateKeyPairSync} from 'node:crypto';
const now=1800000000000,week=7*86400000;
const sale=(id,game,patch={})=>({id,discoveryCategory:game,secureVersion:1,paymentVerified:true,status:'concluido',completedAtMs:now-1000,...patch});
test('Fortnite sobe com mais pedidos concluídos; quantidade e valor não alteram ranking',()=>{
  const rows=[sale('a','fortnite'),sale('b','roblox',{quantity:100,total:10000}),sale('c','fortnite')];
  assert.deepEqual(rankCompletedGames(rows,now),['fortnite','roblox']);
});
test('exclui pendentes, cancelados, estornos, legados, datas fora da semana e duplicatas',()=>{
  const rows=[sale('a','roblox'),sale('a','roblox'),sale('b','fortnite',{paymentVerified:false}),sale('c','fortnite',{status:'reembolsado'}),sale('d','fortnite',{status:'pago'}),sale('e','fortnite',{secureVersion:0}),sale('f','fortnite',{completedAtMs:now-week-1}),sale('g','fortnite',{completedAtMs:now+1}),sale('h','fortnite',{completedAtMs:null}),sale('i','__proto__')];
  assert.deepEqual(rankCompletedGames(rows,now),['roblox']);
  assert.deepEqual(rankCompletedGames([sale('limite','fortnite',{completedAtMs:now-week})],now),['fortnite']);
});
test('pagina pedidos e resolve categoria antiga sem vazar dados privados; cache por 5 minutos',async()=>{
  let queries=0,reads=0;const env={};
  const db={async recentCompletedOrders(since,cursor){queries++;assert.equal(since,now-week);return cursor?{documents:[{path:'orders/b',data:sale('b','fortnite')}],nextCursor:null}:{documents:[{path:'orders/a',data:{...sale('a',''),adId:'AD1',buyerEmail:'private@example.test'}}],nextCursor:{time:1,path:'orders/a'}};},async get(){reads++;return {data:{subcategory:'Fortnite',category:'Jogos'}};}};
  const result=await homeTrends(db,env,now);
  assert.deepEqual(result,{categories:['fortnite'],windowDays:7,generatedAtMs:now});assert.equal(reads,1);assert.equal(queries,2);
  await homeTrends(db,env,now+1);assert.equal(queries,2);
  await homeTrends({...db,async recentCompletedOrders(){queries++;return {documents:[],nextCursor:null};}},env,now+300001);assert.equal(queries,3);
});
test('endpoint é público somente de leitura, retorna categorias e mantém CORS restrito',async()=>{
  const db={async recentCompletedOrders(){return {documents:[],nextCursor:null};}},env={};
  const dependencies={db,auth(){throw Error('não deveria exigir login');},rate:async()=>{}};
  const response=await marketHandle(new Request('https://worker.test/market/home-trends',{headers:{Origin:'https://xinzuhgamer.pages.dev'}}),env,dependencies);
  assert.equal(response.status,200);assert.deepEqual((await response.json()).categories,[]);
  const blocked=await marketHandle(new Request('https://worker.test/market/home-trends',{headers:{Origin:'https://other.test'}}),env,dependencies);assert.equal(blocked.status,403);
});
test('consulta Firestore usa data e cursor estável, selecionando apenas campos necessários',async()=>{
  const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});let query;
  const env={FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'xinzuhgamer-87ff5',client_email:'test@example.test',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
  const db=firestoreService(env,async(url,options)=>{
    if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fake-local-test',expires_in:3600});
    assert.match(url,/:runQuery$/);query=JSON.parse(options.body).structuredQuery;
    return Response.json([{document:{name:'projects/test/databases/(default)/documents/orders/ZZ',fields:firestoreValue({completedAtMs:now}).mapValue.fields}}]);
  });
  const page=await db.recentCompletedOrders(now-week,{time:now-100,path:'orders/AA'});
  assert.equal(query.limit,500);assert.equal(query.startAt.before,false);
  assert.equal(query.startAt.values[1].referenceValue.endsWith('/orders/AA'),true);
  assert.equal(query.where.fieldFilter.op,'GREATER_THAN_OR_EQUAL');
  assert.deepEqual(query.select.fields.map(x=>x.fieldPath),['secureVersion','paymentVerified','status','completedAtMs','adId','discoveryCategory']);
  assert.equal(page.nextCursor,null);assert.equal(page.documents[0].path,'orders/ZZ');
});
