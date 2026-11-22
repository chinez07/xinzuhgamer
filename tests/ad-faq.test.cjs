// JavaScript / ad-faq.test.cjs / Node.js / edição e exibição segura de perguntas frequentes.
const {test}=require('node:test'),assert=require('node:assert/strict');
const faq=require('../js/ad-faq.js');
class Element {
  constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.value='';this.attributes={};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(){this.children=[];}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(k,v){this.listeners[k]=v;}
  focus(){this.focused=true;}
  get lastElementChild(){return this.children.at(-1);}
  querySelector(tag){for(const child of this.children){if(child.tag===tag)return child;const result=child.querySelector(tag);if(result)return result;}return null;}
}
test('Saved FAQ edits and removals update the data that will be published',()=>{
  global.document={createElement:tag=>new Element(tag)};
  const box=new Element('div'),button=new Element('button');let saved;
  const editor=faq.editor(box,button,rows=>saved=rows);
  editor.load([{q:'Entrega?',a:'Pelo chat.'},{q:'Prazo?',a:'Hoje.'}]);
  const answer=box.children[0].querySelector('textarea');answer.value='Após a confirmação.';answer.listeners.input();
  assert.equal(saved[0].a,'Após a confirmação.');
  box.children[0].querySelector('button').listeners.click();
  assert.deepEqual(saved,[{q:'Prazo?',a:'Hoje.'}]);
  button.listeners.click();const input=box.lastElementChild.querySelector('input');input.value='Garantia?';input.listeners.input();
  assert.equal(editor.validate(),false);
  assert.equal(box.lastElementChild.querySelector('textarea').focused,true);
  const reply=box.lastElementChild.querySelector('textarea');reply.value='Conforme a descrição.';reply.listeners.input();
  assert.equal(editor.validate(),true);assert.equal(faq.complete(saved)[1].q,'Garantia?');
  delete global.document;
});
test('FAQ limits entries and renders stored markup as text, without injecting HTML',()=>{
  assert.equal(faq.normalize(Array(8).fill({q:'Q',a:'A'})).length,5);
  assert.deepEqual(faq.complete([{q:' ',a:''},{q:' Q ',a:' A '}]),[{q:'Q',a:'A'}]);
  const html=faq.render([{q:'<img src=x onerror=alert(1)>',a:'</p><script>alert(1)</script>'}]);
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));
  assert.match(html,/&lt;script&gt;/);assert.match(html,/<details/);
});
