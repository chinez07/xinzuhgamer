// JavaScript / tests/store-theme.test.cjs / Node.js / tema seguro e legível da vitrine.
const test = require('node:test'), assert = require('node:assert/strict');
const theme = require('../js/store-theme.js');
test('Invalid themes cannot inject CSS, remote tracking images or SVG', () => {
  const result = theme.normalize({accent:'red;background:url(x)',backgroundDesktop:'https://example.test/a.jpg',backgroundMobile:'data:image/svg+xml;base64,YWJj'});
  assert.deepEqual(result,{accent:'#a78bfa',panelColor:'#16161f',panelTransparency:4,backgroundDesktop:'',backgroundMobile:''});
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


test('Panel transparency changes only the surface and accepts fully transparent and solid colors', () => {
  assert.equal(theme.panelColors({panelColor:'#123456',panelTransparency:100}).background,'rgba(18,52,86,0)');
  assert.equal(theme.panelColors({panelColor:'#123456',panelTransparency:0}).background,'rgba(18,52,86,1)');
  assert.equal(theme.panelColors({panelColor:'#123456',panelTransparency:50}).background,'rgba(18,52,86,0.5)');
  assert.equal(theme.panelColors({panelColor:'#ffffff',panelTransparency:0}).text,'#111118');
  assert.equal(theme.panelColors({panelColor:'#ffffff',panelTransparency:100}).text,'#f3f4f6');
  assert.equal(theme.panelColors({panelColor:'#ffffff',panelTransparency:100}).surface,'transparent');
});

test('Invalid panel styles fall back without allowing CSS injection or invalid alpha values', () => {
  const value=theme.normalize({panelColor:'red;display:none',panelTransparency:999});
  assert.equal(value.panelColor,'#16161f');
  assert.equal(value.panelTransparency,4);
});
