// JavaScript / verify-ai-access.mjs / Node.js no Windows / teste da conexão privada sem imprimir credenciais.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalAI} from './local-ai.mjs';
import {MODERATION_MODELS,moderationRequest,modelJSON} from '../workers/moderation-ai.mjs';
const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.local-preview');
const ai=await createLocalAI(folder);const access=await ai.verify();
console.log(JSON.stringify({tokenActive:access.active,expires:access.expires}));
if(!access.active)process.exit(1);
if(process.argv.includes('--inference')) {
  const result=await ai.run(MODERATION_MODELS.primary,moderationRequest('Return exactly a JSON object with the single key connection and value ok.'));
  console.log(JSON.stringify({model:MODERATION_MODELS.primary,result:modelJSON(result)}));
}
