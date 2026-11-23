// JavaScript / build-max-worker.cjs / Node.js / Worker Pix + MAX em arquivo único.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const shared = ['ad-catalog.js','content-policy.js'].map(file=>fs.readFileSync(path.join(root,'js',file),'utf8'));
const sources = ['max-core.mjs','firestore-service.mjs','home-trends.mjs','market-core.mjs','moderation-ai.mjs','ad-moderation.mjs'].map(file => fs.readFileSync(path.join(root,'workers',file),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export default \{fetch:handleModeration\};\r?\n?/gm,'').replace(/^export /gm,''));
const entry = `export default {async fetch(request,env,ctx) {
  const path = new URL(request.url).pathname.replace(/\\/$/,'');
  if (path.startsWith('/max/')) return handleMaxRequest(request,env);
  if (path.startsWith('/moderation/')) return handleModeration(request,env,ctx);
  return marketHandle(request,env);
}};`;
fs.writeFileSync(path.join(root,'workers/mp-pix.js'),shared.concat(sources).join('\n\n')+'\n\n'+entry+'\n');
console.log('Worker Pix + MAX gerado com validação financeira no servidor.');
