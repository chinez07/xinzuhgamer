// JavaScript / build-max-worker.cjs / Node.js / Worker Pix + MAX em arquivo único.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const legacy = fs.readFileSync(path.join(root, 'workers/mp-pix.legacy.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'workers/max-core.mjs'), 'utf8').replace(/^export /gm, '');
const route = "const path = url.pathname.replace(/\\/$/, '') || '/';";
if (!legacy.includes(route)) throw Error('A rota de entrada do Worker legado mudou.');
const worker = legacy.replace(route, route + "\n    if (path.startsWith('/max/')) return handleMaxRequest(request, env);");
fs.writeFileSync(path.join(root, 'workers/mp-pix.js'), core + '\n\n' + worker);
console.log('Worker Pix + MAX gerado; rotas antigas preservadas.');
