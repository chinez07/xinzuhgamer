// JavaScript / moderation-counter.test.mjs / Node.js SQLite / limites de consumo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {moderationCounter} from '../workers/ad-moderation.mjs';
function database(){
  const sql=new DatabaseSync(':memory:');
  return {async exec(text){sql.exec(text);},prepare(text){return {bind(...values){return {async first(){return sql.prepare(text).get(...values);}};}};}};
}
test('Rate limits reject excess requests, reset by bucket and isolate users and databases',async()=>{
  const env={MAX_DB:database()};
  await moderationCounter(env,'alice',1,2);
  await moderationCounter(env,'alice',1,2);
  await assert.rejects(moderationCounter(env,'alice',1,2),{status:429});
  await moderationCounter(env,'bob',1,2);
  await moderationCounter(env,'alice',2,2);
  await moderationCounter({MAX_DB:database()},'alice',1,2);
});
test('Missing persistent counters fail closed',async()=>{
  await assert.rejects(moderationCounter({},'ai-global',1,20),{status:503});
});
