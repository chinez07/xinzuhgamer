// JavaScript / tests/store-theme.test.cjs / Node.js / tema seguro e legível da vitrine.
const test = require('node:test'), assert = require('node:assert/strict');
const theme = require('../js/store-theme.js');
test('Invalid themes cannot inject CSS, remote tracking images or SVG', () => {
  const result = theme.normalize({accent:'red;background:url(x)',backgroundDesktop:'https://example.test/a.jpg',backgroundMobile:'data:image/svg+xml;base64,YWJj'});
  assert.deepEqual(result,{accent:'#a78bfa',backgroundDesktop:'',backgroundMobile:''});
});
test('Dark custom accents keep readable text and correct foreground colors', () => {
  assert.equal(theme.colors('#000000').readable,'#ede9fe');
  assert.equal(theme.colors('#000000').onAccent,'#ffffff');
  assert.equal(theme.colors('#ffffff').onAccent,'#09090f');
  assert.equal(theme.colors('#60a5fa').readable,'#60a5fa');
});
test('Mobile background falls back to desktop and can override it independently', () => {
  const values = {}, element={style:{setProperty:(key,value)=>values[key]=value}};
  const desktop='data:image/jpeg;base64,YWJj', mobile='data:image/png;base64,ZGVm';
  theme.apply(element,{accent:'#60a5fa',backgroundDesktop:desktop});
  assert.equal(values['--store-background-mobile'],values['--store-background-desktop']);
  theme.apply(element,{backgroundDesktop:desktop,backgroundMobile:mobile});
  assert.equal(values['--store-background-mobile'],'url("'+mobile+'")');
  theme.apply(element,{});
  assert.equal(values['--store-background-desktop'],'none');
  assert.equal(values['--store-background-mobile'],'none');
});
