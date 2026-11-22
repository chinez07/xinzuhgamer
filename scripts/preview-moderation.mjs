// JavaScript / preview-moderation.mjs / Node.js 22+ / prévia isolada em http://127.0.0.1:8789.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeImage,analyzeText} from '../workers/ad-moderation.mjs';
import '../js/content-policy.js';
import {createLocalAI} from './local-ai.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), folder=path.join(root,'.local-preview');
await fs.mkdir(folder,{recursive:true});
const file=path.join(folder,'ads.json'),port=8789,origin='http://127.0.0.1:'+port;
let store;try{store=JSON.parse(await fs.readFile(file,'utf8'));}catch{store={ads:{},reviews:{}};}
const save=()=>fs.writeFile(file,JSON.stringify(store,null,2));
// Reclassifica somente incompatibilidades claras nos registros locais antigos.
let migrated=false;
for(const ad of Object.values(store.ads)){const check=globalThis.BloxzuhAdCatalog.reviewText(ad);if(ad.status==='ativo'&&check.decision==='rejected'){ad.status='reprovado';ad.moderationReason=check.reason;migrated=true;}}
if(migrated){await fs.copyFile(file,path.join(folder,'ads.before-text-review.json'));await save();}
const enabled=process.argv.includes('--vision');
const ai=enabled?await createLocalAI(folder):null;
if(ai&&!(await ai.verify()).active)throw Error('A credencial de IA está expirada ou inválida.');
function dataImage(value){const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value||'');if(!match)throw Error('Na prévia, envie uma imagem local JPG, PNG ou WebP.');const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>5*1024*1024)throw Error('Imagem vazia ou maior que 5 MB.');return bytes;}
function fields(data){return {title:data.title||'',desc:data.desc||'',category:data.category||'',subcategory:data.subcategory||'',gameName:data.gameName||'',experienceName:data.experienceName||'',section:data.section||'',productType:data.productType||'',cover:data.cover,gallery:data.gallery||[],imageFrame:data.imageFrame||{}};}
const dashboard=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Teste local de anúncios</title><link rel="stylesheet" href="/css/community.css"><link rel="stylesheet" href="/css/info-pages.css"><main class="shell info-main"><span class="eyebrow">Teste local · não publicado</span><h1>Teste de categorias e moderação</h1><p>Nenhum dado desta página vai para Firebase, ImgBB ou para o site público. Os anúncios ficam apenas neste computador.</p><a class="action primary" href="/anunciar.html">Criar anúncio de teste</a><h2 style="margin-top:30px">Filtro das perguntas</h2><label>Digite uma pergunta com telefone<input id="testContact" style="display:block;width:100%;padding:14px;margin:12px 0;background:#16161f;color:white;border:1px solid #555" value="Me chama no (11) 99999-1234"></label><p>Como aparecerá: <strong id="testMasked"></strong></p><h2>Fotos e revisão</h2><p id="visionStatus">${enabled?'Análise real conectada com Gemma 4. Fotos e descrições são enviadas à Cloudflare; limite local de 20 chamadas de IA por dia.':'Serviço de visão não conectado: fotos reais seguem para revisão manual. Aprovação automática e rejeição por IA são verificadas pelos testes automatizados.'}</p><button class="action" id="refreshLocal">Atualizar lista</button><div id="localAds"></div></main><script src="/js/content-policy.js"></script><script src="/scripts/preview-dashboard.js"></script></html>`;
const server=http.createServer(async(req,res)=>{
  const send=(data,status=200,type='application/json')=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: blob:; connect-src 'self'; form-action 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(data):data);};
  try {
    if(req.headers.host!=='127.0.0.1:'+port)return send({error:'Host inválido.'},403);
    const url=new URL(req.url,origin);
    if(req.method==='POST'){
      if(req.headers.origin!==origin||!String(req.headers['content-type']).startsWith('application/json'))return send({error:'Origem inválida.'},403);
      let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>24*1024*1024)throw Error('Solicitação acima do limite.');chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString());
      if(url.pathname==='/api/moderation/review'){
        const data=fields(body),error=globalThis.BloxzuhAdCatalog.validate(data);if(error)throw Error(error);
        if(!Array.isArray(data.gallery)||data.gallery.length>6)throw Error('Máximo de seis fotos na galeria.');
        const images=[data.cover,...data.gallery,data.imageFrame.image,data.imageFrame.backgroundImage].filter(Boolean);if(!images.length)throw Error('Adicione uma capa.');
        const textResult=await analyzeText(data,ai);
        const results=[{kind:'text',...textResult}];for(const image of images)results.push(await analyzeImage(dataImage(image),data,ai));
        const decision=results.some(r=>r.decision==='rejected')?'rejected':results.some(r=>r.decision==='review')?'review':'approved';
        const reviewId='LOCALIR'+crypto.randomUUID();store.reviews[reviewId]={...data,decision,results};await save();
        return send({reviewId,decision,message:decision==='rejected'?(results.find(r=>r.decision==='rejected')?.reason||'Imagem reprovada pela análise. Corrija a foto.'):decision==='review'?'Aguardando revisão local.':'Aprovado pela análise.'});
      }
      if(url.pathname==='/api/ads'){
        const data=body.data,review=store.reviews[data.moderationReviewId];
        const textCheck=globalThis.BloxzuhAdCatalog.reviewText(data);if(textCheck.decision==='rejected')throw Error(textCheck.reason);
        if(!review||!['review','approved'].includes(review.decision)||JSON.stringify(fields(data))!==JSON.stringify(fields(review)))throw Error('Imagens ou categoria mudaram depois da análise. Envie novamente.');
        const id=body.id||'LOCALAD'+Date.now();store.ads[id]={...data,sellerUid:'local-test',sellerName:'Vendedor de teste',status:review.decision==='approved'?'ativo':'pendente'};await save();return send({id});
      }
      if(url.pathname==='/api/review'){
        const ad=store.ads[body.id];if(!ad||ad.status!=='pendente'||!['approved','rejected'].includes(body.decision))throw Error('Revisão inválida.');
        if(!String(body.reason||'').trim())throw Error('Informe o motivo da decisão.');
        const textCheck=globalThis.BloxzuhAdCatalog.reviewText(ad);if(body.decision==='approved'&&textCheck.decision==='rejected')throw Error(textCheck.reason);
        store.reviews[ad.moderationReviewId].decision=body.decision;ad.status=body.decision==='approved'?(Number(ad.stock)>0?'ativo':'pausado'):'reprovado';ad.moderationReason=String(body.reason).slice(0,500);await save();return send({ok:true});
      }
      return send({error:'Rota não encontrada.'},404);
    }
    if(req.method!=='GET')return send({error:'Método inválido.'},405);
    if(url.pathname==='/api/ai-status'){try{return send(JSON.parse(await fs.readFile(path.join(folder,'ai-status.json'),'utf8')));}catch{return send({connected:false,enabled});}}
    if(url.pathname==='/api/ads')return send(store.ads);
    if(url.pathname==='/'||url.pathname==='/painel.html')return send(dashboard,200,'text/html');
    if(url.pathname==='/anunciar.html'){
      let html=await fs.readFile(path.join(root,'anunciar.html'),'utf8');
      html=html.replace(/<script src="[^"]*(?:gstatic|firebase-auth|firestore-db|max-client|photos\.js|cover-worker-patch|brand\.js)[^"]*"><\/script>/g,'');
      html=html.replace('<body>','<body><script src="/scripts/preview-adapter.js"></script><div style="padding:12px;background:#3b2370;color:white;text-align:center">PRÉVIA LOCAL · nenhum envio ao site público · <a href="/">Abrir testes e revisão</a></div>');
      html=html.replace('Li e aceito os Termos de uso da Bloxzuh','Confirmo que este anúncio é um teste local');
      return send(html,200,'text/html');
    }
    if(!/^\/(?:js|css|assets)\/[a-zA-Z0-9_./ -]+$/.test(url.pathname)&&!/^\/scripts\/preview-(adapter|dashboard)\.js$/.test(url.pathname))return send({error:'Página não disponível nesta prévia isolada.'},404);
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!target.startsWith(root+path.sep))return send({},403);
    const type={'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(target)];if(!type)return send({},404);
    return send(await fs.readFile(target),200,type);
  }catch(e){send({error:e.message},400);}
});
server.listen(port,'127.0.0.1',()=>process.stdout.write('Prévia isolada: '+origin+' · visão real: '+(enabled?'ativada':'não conectada')+'\n'));
