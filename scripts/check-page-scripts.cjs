// JavaScript / check-page-scripts.cjs / Node.js / valida a sintaxe dos scripts inline e locais.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
let count=0;
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.html'))) {
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(/\bsrc\s*=/.test(script[1])||/type=["'](?:module|application\/ld\+json)/.test(script[1])) continue;
    new vm.Script(script[2],{filename:file});count++;
  }
}
for(const file of fs.readdirSync(path.join(root,'js')).filter(name=>name.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(path.join(root,'js',file),'utf8'),{filename:file});count++;
}
console.log(count+' scripts com sintaxe válida.');
