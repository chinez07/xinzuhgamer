// JavaScript / routes.test.cjs / node --test / endereços públicos e filtros.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {cleanHref,categoryId}=require('../js/routes.js');
const base='https://xinzuhgamer.pages.dev/';
test('categorias preservam os outros filtros e fragmentos',()=>{
  assert.equal(cleanHref('anuncios.html?cat=freefire&q=conta#lista',base),'/categoria/free-fire?q=conta#lista');
  assert.equal(categoryId('/categoria/free-fire'),'freefire');
  assert.equal(categoryId('/categoria/league-of-legends/'),'lol');
  assert.equal(categoryId('/categoria/inexistente'),'');
  assert.equal(cleanHref('anuncios.html?cat=desconhecida',base),'/anuncios?cat=desconhecida');
});
test('páginas preservam identificação, retorno do login e seção',()=>{
  assert.equal(cleanHref('pedido.html?id=BZTESTE#chat',base),'/pedido?id=BZTESTE#chat');
  assert.equal(cleanHref('login.html?redirect=checkout.html%3Fid%3DAD1',base),'/login?redirect=checkout.html%3Fid%3DAD1');
  assert.equal(cleanHref('index.html',base),'/');
  assert.equal(cleanHref('/conta',base),'/conta');
  assert.equal(cleanHref('https://externo.example/conta.html',base),'https://externo.example/conta.html');
  assert.equal(cleanHref('/assets/manual.html',base),'/assets/manual.html');
});
test('todos os caminhos de categorias têm filtro e página servida',()=>{
  const rules=fs.readFileSync('_redirects','utf8').split(/\r?\n/).filter(line=>line.startsWith('/categoria/'));
  assert.equal(rules.length,9);
  for(const rule of rules){
    const [path,target,status]=rule.split(/\s+/);
    assert.ok(categoryId(path),path);
    assert.equal(target,'/anuncios');assert.equal(status,'200');
    assert.equal(cleanHref('/anuncios.html?cat='+categoryId(path),base),path);
  }
  const html=fs.readFileSync('anuncios.html','utf8');
  assert.match(html,/<base href="\/">/);
  assert.match(html,/BloxzuhRoutes.categoryId\(location.pathname\)/);
});

