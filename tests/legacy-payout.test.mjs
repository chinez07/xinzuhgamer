// JavaScript / legacy-payout.test.mjs / Node.js / o Worker legado nunca inicia transferências.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../workers/saque-locked.mjs';
test('Bloqueia todos os POSTs legados, inclusive com token e dados de saque, sem chamar provedor',async()=>{
  const previous=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Transferência inesperada');};
  try {
    for(const path of ['/','/payout','/qualquer-rota']) {
      const response=await worker.fetch(new Request('https://worker.test'+path,{method:'POST',headers:{Authorization:'Bearer invalid-test-token'},body:JSON.stringify({amount:100,pixKey:'invalid-test-key'})}),{});
      assert.equal(response.status,403);
    }
    assert.equal(calls,0);
  } finally {globalThis.fetch=previous;}
});
test('Saúde informa processamento manual e não concede CORS a sites externos',async()=>{
  const health=await worker.fetch(new Request('https://worker.test/'));
  assert.equal((await health.json()).automaticPayouts,false);
  const external=await worker.fetch(new Request('https://worker.test/',{headers:{Origin:'https://untrusted.example'}}));
  assert.equal(external.status,403);assert.equal(external.headers.get('Access-Control-Allow-Origin'),null);
});
