// JavaScript / max-client.test.cjs / Node.js / horários, erros e retorno do login.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.join(__dirname, '..');
function client(fetcher = async () => Response.json({})) {
  const box = vm.createContext({window: {}, document: {readyState: 'loading', addEventListener() {}}, fetch: fetcher, console, Intl, Date});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/max-client.js'), 'utf8'), box);
  return box.window.BloxzuhMax;
}
test('Opening hours use Brasília time, including the closing boundary', () => {
  const api = client(), schedule = Array.from({length: 7}, () => ({open: true, start: '09:00', end: '18:00'}));
  assert.equal(api.opening(schedule, new Date('2026-11-17T12:00:00Z')).open, true);
  assert.equal(api.opening(schedule, new Date('2026-11-17T20:59:00Z')).open, true);
  assert.equal(api.opening(schedule, new Date('2026-11-17T21:00:00Z')).open, false);
  schedule[2].open = false;
  assert.equal(api.opening(schedule, new Date('2026-11-17T12:00:00Z')).open, false);
});
test('Checkout errors preserve status so expired attempts can be retried', async () => {
  const api = client(async () => Response.json({error: 'A tentativa anterior expirou.'}, {status: 409}));
  await assert.rejects(api.api('checkout', {method: 'POST', body: {}}), e => e.status === 409 && /expirou/.test(e.message));
});
test('Login returns to the MAX page but rejects redirects to another origin', () => {
  const source = fs.readFileSync(path.join(root, 'js/firebase-auth.js'), 'utf8');
  const fn = source.slice(source.indexOf('function authReturnPath()'), source.indexOf('// Firebase Auth - Bloxzuh'));
  function destination(value) {
    const location = new URL('https://xinzuhgamer.pages.dev/login.html?redirect=' + encodeURIComponent(value));
    const context = vm.createContext({window: {location}, URL, URLSearchParams});
    vm.runInContext(fn, context); return context.authReturnPath();
  }
  assert.equal(destination('plano-max.html#assinatura'), '/plano-max.html#assinatura');
  assert.equal(destination('https://example.test/'), 'index.html');
  assert.equal(destination('https://bloxzuh.store/conta.html'), 'index.html');
  assert.equal(destination('javascript:alert(1)'), 'index.html');
  assert.equal(destination('login.html'), 'index.html');
});
