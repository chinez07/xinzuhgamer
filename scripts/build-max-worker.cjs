// JavaScript / build-max-worker.cjs / Node.js / Worker Pix + MAX em arquivo único.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const sources = ['max-core.mjs','firestore-service.mjs','market-core.mjs'].map(file => fs.readFileSync(path.join(root,'workers',file),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,''));
const entry = `export default {async fetch(request,env) {
  const path = new URL(request.url).pathname.replace(/\\/$/,'');
  if (path.startsWith('/max/')) return handleMaxRequest(request,env);
  return marketHandle(request,env);
}};`;
fs.writeFileSync(path.join(root,'workers/mp-pix.js'),sources.join('\n\n')+'\n\n'+entry+'\n');
console.log('Worker Pix + MAX gerado com validação financeira no servidor.');
