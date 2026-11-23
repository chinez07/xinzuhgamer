// JavaScript / background-settings.test.cjs / Node.js / isolamento e validação dos fundos pessoais.
const {test}=require('node:test'),assert=require('node:assert/strict');
const bg=require('../js/background-settings.js');
test('preferências antigas usam apenas os novos fundos e mantêm opção padrão',()=>{
  assert.equal(bg.pick(bg.normalize(null,7),'desktop'),'/assets/fundos/ghost-pc.jpg');
  assert.equal(bg.pick(bg.normalize(null,6),'mobile'),'/assets/fundos/minecraft-mobile-1.jpg');
  assert.equal(bg.pick(bg.normalize(null,-1),'desktop'),'');
  assert.equal(bg.presets.desktop.length,2);assert.equal(bg.presets.mobile.length,2);
});
test('imagem pessoal e seleção do PC não alteram a escolha do celular',()=>{
  const custom='data:image/jpeg;base64,YWJj';
  const value=bg.normalize({desktop:{preset:0,custom},mobile:{preset:1,custom:''}});
  assert.equal(bg.pick(value,'desktop'),custom);
  assert.equal(bg.pick(value,'mobile'),'/assets/fundos/minecraft-mobile-2.jpg');
  value.desktop={preset:-1,custom:''};
  assert.equal(bg.pick(value,'desktop'),'');
  assert.equal(bg.pick(value,'mobile'),'/assets/fundos/minecraft-mobile-2.jpg');
});
test('fundo pessoal rejeita URLs externas, SVG, CSS e dados excessivos',()=>{
  for(const custom of ['https://example.test/track.jpg','data:image/svg+xml;base64,YWJj','data:image/jpeg;base64,abc");color:red','data:image/jpeg;base64,'+'A'.repeat(180000)]){
    assert.equal(bg.normalize({desktop:{preset:0,custom}}).desktop.custom,'');
  }
  assert.equal(bg.normalize({desktop:{preset:99}}).desktop.preset,-1);
});
test('envio rejeita arquivo inválido antes de tentar decodificá-lo',async()=>{
  await assert.rejects(bg.readFile({type:'image/svg+xml',size:10}),/JPG, PNG ou WebP/);
  await assert.rejects(bg.readFile({type:'image/jpeg',size:11*1024*1024}),/10 MB/);
});
