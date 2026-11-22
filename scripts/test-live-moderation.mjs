// JavaScript / test-live-moderation.mjs / Node.js / verificação limitada com IA real e exemplos de teste.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createLocalAI} from './local-ai.mjs';
import {analyzeImage,analyzeText} from '../workers/ad-moderation.mjs';
import {MODERATION_MODELS} from '../workers/moderation-ai.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),folder=path.join(root,'.local-preview');
const ai=await createLocalAI(folder);
const listing={title:'Pacote de 100 Robux para Roblox',desc:'Pacote de 100 Robux para uso no Roblox. A entrega é combinada pelo chat da compra depois da confirmação do pagamento.',category:'Jogos',subcategory:'Roblox',section:'Roblox geral',productType:'Robux'};
const results=[];
async function check(name,model,work){const start=Date.now(),result=await work();results.push({name,model,...result,elapsedMs:Date.now()-start});console.log(JSON.stringify(results.at(-1)));}
await check('Descrição clara de Robux',MODERATION_MODELS.primary,()=>analyzeText(listing,ai));
await check('Descrição contradiz o produto',MODERATION_MODELS.primary,()=>analyzeText({...listing,desc:'Este produto é somente uma conta Free Fire. O comprador não receberá Robux e não é uma conta Roblox.'},ai));
await check('Contato explícito em imagem de teste',MODERATION_MODELS.primary,async()=>analyzeImage(new Uint8Array(await fs.readFile(path.join(folder,'test-contact.png'))),listing,ai));
await check('Imagem de outra categoria ou sem prova suficiente',MODERATION_MODELS.primary,async()=>analyzeImage(new Uint8Array(await fs.readFile(path.join(root,'assets/categorias/freefire.jpg'))),listing,ai));
const comparison={run:(_,body)=>ai.run(MODERATION_MODELS.comparison,body)};
await check('Comparação: descrição clara de Robux',MODERATION_MODELS.comparison,()=>analyzeText(listing,comparison));
await fs.writeFile(path.join(folder,'live-moderation-report.json'),JSON.stringify({createdAt:new Date().toISOString(),results},null,2));
