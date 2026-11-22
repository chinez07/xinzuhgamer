// JavaScript / tests/visibility.test.cjs / Node.js 18+ / Bloxzuh.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const dbSource = read('js/firestore-db.js');
const helpers = dbSource.slice(dbSource.indexOf('function bloxzuhVisRank('), dbSource.indexOf('function normalizeAd('));
const homeSource = read('index.html');
const homeLoader = homeSource.slice(homeSource.indexOf('async function loadFirestoreAdsHome()'), homeSource.indexOf('loadFirestoreAdsHome().then'));
const listingSource = read('anuncios.html');
const filters = listingSource.slice(listingSource.indexOf('    function applyFilters()'), listingSource.indexOf('    async function loadAds()'));

function ad(id, visibility, extra = {}) {
  return { id, visibility, title: 'conta teste', category: 'premium', price: 10, status: 'ativo', ...extra };
}
function context(ads, query = '', sort = 'rel') {
  const elements = Object.fromEntries(['premiumScroll', 'featuredScroll', 'dynamicCatTitle', 'adsList', 'adsMeta'].map(id => [id, { innerHTML: '', textContent: '' }]));
  for (const [id, value] of Object.entries({fSearch: query, fCat: '', fProduct:'', fExperience:'', fMin: '', fMax: '', fSort: sort})) elements[id] = {value};
  const sandbox = vm.createContext({
    window: {}, console, setTimeout() {},
    localStorage: {getItem: () => 'premium'},
    document: {getElementById: id => elements[id]},
    fsGetPublicAds: async () => ads,
    adsData: ads,
    createProductCard: a => '[' + a.id + ']'
  });
  vm.runInContext(helpers + '\n' + homeLoader + '\n' + filters, sandbox);
  return {sandbox, elements};
}

test('Prata never fills empty home highlights or home category carousel', async () => {
  const {sandbox, elements} = context([ad('silver', 'prata')]);
  await vm.runInContext('loadFirestoreAdsHome()', sandbox);
  assert.doesNotMatch(elements.featuredScroll.innerHTML, /\[silver\]/);
  assert.doesNotMatch(elements.premiumScroll.innerHTML, /\[silver\]/);
  vm.runInContext('applyFilters()', sandbox);
  assert.equal(elements.adsList.innerHTML, '[silver]');
});

test('Home includes only active Ouro and Diamante, with Diamante first', async () => {
  const {sandbox, elements} = context([
    ad('silver', 'prata'), ad('gold', 'ouro'), ad('diamond', 'diamante'),
    ad('paused', 'diamante', {status: 'pausado'}), ad('default', undefined)
  ]);
  await vm.runInContext('loadFirestoreAdsHome()', sandbox);
  assert.equal(elements.featuredScroll.innerHTML, '[diamond][gold]');
  assert.equal(elements.premiumScroll.innerHTML, '[diamond][gold]');
});

test('Category relevance orders Diamante, Ouro, then Prata', () => {
  const {sandbox, elements} = context([ad('silver', 'prata'), ad('gold', 'ouro'), ad('diamond', 'diamante')]);
  vm.runInContext('applyFilters()', sandbox);
  assert.equal(elements.adsList.innerHTML, '[diamond][gold][silver]');
});

test('Search promotes only Diamante and preserves ordinary order for Ouro/Prata', () => {
  const {sandbox, elements} = context([ad('silver', 'prata'), ad('gold', 'ouro'), ad('diamond', 'diamante')], 'teste');
  vm.runInContext('applyFilters()', sandbox);
  assert.equal(elements.adsList.innerHTML, '[diamond][silver][gold]');
});

test('Explicit price sorting takes precedence over visibility', () => {
  const {sandbox, elements} = context([
    ad('diamond', 'diamante', {price: 30}), ad('gold', 'ouro', {price: 20}), ad('silver', 'prata', {price: 10})
  ], '', 'price_asc');
  vm.runInContext('applyFilters()', sandbox);
  assert.equal(elements.adsList.innerHTML, '[silver][gold][diamond]');
});


test('Product and Roblox experience filters separate Robux from accounts',()=>{
  const {sandbox,elements}=context([ad('account','prata',{category:'roblox',productType:'Conta',raw:{section:'Blox Fruits'}}),ad('robux','prata',{category:'roblox',productType:'Robux',raw:{section:'Outros jogos'}})]);
  elements.fCat.value='roblox';elements.fProduct.value='Robux';vm.runInContext('applyFilters()',sandbox);
  assert.match(elements.adsList.innerHTML,/\[robux\]/);assert.doesNotMatch(elements.adsList.innerHTML,/\[account\]/);
  elements.fExperience.value='Blox Fruits';vm.runInContext('applyFilters()',sandbox);assert.doesNotMatch(elements.adsList.innerHTML,/\[robux\]/);
});
