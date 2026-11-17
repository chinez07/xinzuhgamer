// JavaScript / max-subscription.test.mjs / Node.js 22+ SQLite / Clube MAX.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {handleMaxRequest, maxMembership, maxPaymentState, maxProfileInput, maxValidCPF, MAX_PERIOD} from '../workers/max-core.mjs';

function database() {
  const sql = new DatabaseSync(':memory:');
  function prepare(text, args = []) {
    return {bind(...values) {return prepare(text, values);},
      async run() {sql.prepare(text).run(...args); return {success: true};},
      async first() {return sql.prepare(text).get(...args) || null;},
      async all() {return {results: sql.prepare(text).all(...args)};}};
  }
  return {sql, prepare, async batch(statements) {sql.exec('BEGIN'); try {const rows = []; for (const s of statements) rows.push(await s.run()); sql.exec('COMMIT'); return rows;} catch (e) {sql.exec('ROLLBACK'); throw e;}}};
}
function token(uid = 'alice', aud = 'xinzuhgamer-87ff5') {return 'header.' + Buffer.from(JSON.stringify({aud, iss: 'https://securetoken.google.com/xinzuhgamer-87ff5', sub: uid})).toString('base64url') + '.signature';}
function fixture() {
  const db = database(), payments = new Map();
  const env = {MAX_DB: db, MAX_SALES_ENABLED: 'true', MP_ACCESS_TOKEN: 'mock-token'};
  let created = 0;
  const fetcher = async (url, options = {}) => {
    if (url.includes('identitytoolkit')) {
      const body = JSON.parse(options.body);
      const uid = JSON.parse(Buffer.from(body.idToken.split('.')[1], 'base64url').toString()).sub;
      return Response.json({users: [{localId: uid, email: uid + '@example.test', displayName: 'Loja ' + uid}]});
    }
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      const payment = {id: ++created, status: 'pending', currency_id: 'BRL', live_mode: true, ...body,
        point_of_interaction: {transaction_data: {qr_code: 'mock-pix', qr_code_base64: 'mock-base64'}}};
      payments.set(String(payment.id), payment);
      return Response.json(payment);
    }
    const id = url.split('/').at(-1);
    return payments.has(id) ? Response.json(payments.get(id)) : Response.json({error: 'not-found'}, {status: 404});
  };
  async function call(path, body, uid = 'alice', method = body ? 'POST' : 'GET') {
    const headers = {'Content-Type': 'application/json'};
    if (uid) headers.Authorization = 'Bearer ' + token(uid);
    const response = await handleMaxRequest(new Request('https://worker.example/max/' + path, {method, headers, body: body ? JSON.stringify(body) : undefined}), env, fetcher);
    return {status: response.status, body: await response.json()};
  }
  async function checkout(id = crypto.randomUUID()) {return call('checkout', {cpf: '11144477735', requestId: id, acceptedTerms: true, amount: .01});}
  function approve(id, extra = {}) {Object.assign(payments.get(String(id)), {status: 'approved', date_approved: new Date().toISOString()}, extra);}
  return {db, env, payments, fetcher, call, checkout, approve, get created() {return created;}};
}
test('CPF validation rejects repeated digits and invalid check digits', () => {
  assert.equal(maxValidCPF('111.444.777-35'), true);
  assert.equal(maxValidCPF('11111111111'), false);
  assert.equal(maxValidCPF('11144477734'), false);
});
test('Membership uses approval timestamps, expiration, and one period per payment', () => {
  const now = Date.now(), event = {payment_id: '1', status: 'approved', live: 1, paid_at: now};
  assert.equal(maxMembership([event, event], now).expiresAt, now + MAX_PERIOD);
  assert.equal(maxMembership([event], now + MAX_PERIOD).active, false);
  assert.equal(maxMembership([{...event, status: 'refunded'}], now).active, false);
  const renewed = maxMembership([event, {...event, payment_id: '2', paid_at: now + 1000}], now);
  assert.equal(renewed.expiresAt, now + MAX_PERIOD * 2);
});
test('Checkout price is server-defined and replay does not create another payment', async () => {
  const f = fixture(), id = crypto.randomUUID();
  const one = await f.checkout(id), two = await f.checkout(id);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  assert.equal(f.created, 1);
  assert.equal(f.payments.get('1').transaction_amount, 45);
  assert.equal(f.payments.get('1').notification_url, 'https://worker.example/max/webhook');
  assert.equal(one.body.member.active, false);
  assert.equal(one.body.paymentId, two.body.paymentId);
});
test('A pending or client-declared approved payment cannot grant MAX', async () => {
  const f = fixture();
  const invoice = await f.checkout();
  const status = await f.call('payment?id=' + invoice.body.paymentId);
  assert.equal(status.body.member.active, false);
  const member = await f.call('public?uid=alice', null, null);
  assert.equal(member.body.active, false);
});
test('Approved Pix grants 30 days, repeated webhook/status never extends it', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId);
  const first = await f.call('payment?id=' + invoice.body.paymentId);
  assert.equal(first.body.member.active, true);
  const expiry = first.body.member.expiresAt;
  await f.call('webhook', {data: {id: invoice.body.paymentId}}, null);
  await f.call('webhook', {data: {id: invoice.body.paymentId}}, null);
  const second = await f.call('payment?id=' + invoice.body.paymentId);
  assert.equal(second.body.member.expiresAt, expiry);
});
test('A second approved payment extends the current period by exactly 30 days', async () => {
  const f = fixture(), one = await f.checkout(); f.approve(one.body.paymentId);
  const first = await f.call('payment?id=' + one.body.paymentId);
  const two = await f.checkout(); f.approve(two.body.paymentId);
  const second = await f.call('payment?id=' + two.body.paymentId);
  assert.equal(second.body.member.expiresAt, first.body.member.expiresAt + MAX_PERIOD);
});
test('Another account cannot query or claim the payment', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId);
  assert.equal((await f.call('payment?id=' + invoice.body.paymentId, null, 'bob')).status, 404);
  assert.equal((await f.call('me', null, 'bob')).body.member.active, false);
});
test('Wrong amount, currency, metadata, reference or payment ID cannot activate MAX', async () => {
  const record = {payment_id: '1', reference: 'MAX:alice:one', uid: 'alice'};
  const valid = {id: 1, external_reference: record.reference, metadata: {bloxzuh_max_uid: 'alice'}, transaction_amount: 45, currency_id: 'BRL', payment_method_id: 'pix', live_mode: true, status: 'approved', date_approved: new Date().toISOString()};
  for (const patch of [{transaction_amount: 1}, {currency_id: 'USD'}, {metadata: {bloxzuh_max_uid: 'bob'}}, {external_reference: 'another'}, {id: 2}, {payment_method_id: 'credit_card'}]) {
    assert.throws(() => maxPaymentState({...valid, ...patch}, record), /não corresponde/);
  }
});
test('Sandbox payments do not activate production entitlements', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId, {live_mode: false});
  const checked = await f.call('payment?id=' + invoice.body.paymentId);
  assert.equal(checked.body.status, 'test_payment'); assert.equal(checked.body.member.active, false);
});
test('Refund webhook revokes benefits and leaves configuration stored', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId);
  await f.call('payment?id=' + invoice.body.paymentId);
  const schedule = Array.from({length: 7}, () => ({open: true, start: '09:00', end: '18:00'}));
  assert.equal((await f.call('profile', {shopName: 'Alice Store', cover: '', schedule, offlineMessage: 'Voltamos amanhã'}, 'alice', 'PUT')).status, 200);
  Object.assign(f.payments.get(invoice.body.paymentId), {status: 'refunded', transaction_amount_refunded: 45});
  await f.call('webhook', {data: {id: invoice.body.paymentId}}, null);
  const member = await f.call('public?uid=alice', null, null);
  assert.equal(member.body.active, false); assert.equal(member.body.shopName, undefined);
  const me = await f.call('me'); assert.equal(me.body.settings.shopName, 'Alice Store');
  assert.equal((await f.call('profile', {shopName: 'changed', cover: '', schedule}, 'alice', 'PUT')).status, 403);
});
test('Profile edits require an active paid subscription, even with forged local state', async () => {
  const f = fixture();
  const schedule = Array.from({length: 7}, () => ({open: false}));
  assert.equal((await f.call('profile', {shopName: 'Fake MAX', schedule, plan: 'max', active: true}, 'alice', 'PUT')).status, 403);
});
test('A late approved response cannot reactivate a refunded payment', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId);
  await f.call('payment?id=' + invoice.body.paymentId);
  Object.assign(f.payments.get(invoice.body.paymentId), {status: 'refunded', transaction_amount_refunded: 45});
  await f.call('webhook', {data: {id: invoice.body.paymentId}}, null);
  Object.assign(f.payments.get(invoice.body.paymentId), {status: 'approved', transaction_amount_refunded: 0});
  const stale = await f.call('payment?id=' + invoice.body.paymentId);
  assert.equal(stale.body.status, 'refunded'); assert.equal(stale.body.member.active, false);
});
test('Invalid or missing Firebase session is rejected', async () => {
  const f = fixture();
  assert.equal((await f.call('me', null, null)).status, 401);
  const request = new Request('https://worker.example/max/me', {headers: {Authorization: 'Bearer ' + token('alice', 'other-project')}});
  assert.equal((await handleMaxRequest(request, f.env, f.fetcher)).status, 401);
});
test('An unverified JWT payload cannot bypass Firebase token validation', async () => {
  const f = fixture();
  const request = new Request('https://worker.example/max/me', {headers: {Authorization: 'Bearer ' + token('alice')}});
  const response = await handleMaxRequest(request, f.env, async () => Response.json({error: {message: 'INVALID_ID_TOKEN'}}, {status: 400}));
  assert.equal(response.status, 401);
});
test('Combined deployment preserves legacy Pix endpoints without requiring D1', async () => {
  const code = fs.readFileSync(new URL('../workers/mp-pix.js', import.meta.url), 'utf8');
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))).default;
  const home = await worker.fetch(new Request('https://worker.example/'), {}, {});
  assert.equal((await home.json()).service, 'bloxzuh-mp-pix');
  const create = await worker.fetch(new Request('https://worker.example/create-pix', {method: 'POST', body: '{}'}), {}, {});
  assert.equal(create.status, 500);
  const webhook = await worker.fetch(new Request('https://worker.example/webhook', {method: 'POST', body: '{}'}), {}, {});
  assert.equal((await webhook.json()).skipped, true);
  const config = await worker.fetch(new Request('https://worker.example/max/config'), {}, {});
  assert.equal((await config.json()).salesEnabled, false);
});
test('Closed launch flag and missing terms prevent payment creation', async () => {
  const f = fixture(); f.env.MAX_SALES_ENABLED = 'false';
  assert.equal((await f.checkout()).status, 503); assert.equal(f.created, 0);
  f.env.MAX_SALES_ENABLED = 'true';
  assert.equal((await f.call('checkout', {cpf: '11144477735', requestId: crypto.randomUUID()})).status, 400);
  assert.equal(f.created, 0);
});
test('Profile validation rejects unsafe images, invalid times and excessive text', () => {
  const base = {shopName: 'Loja', schedule: Array.from({length: 7}, () => ({open: false})), cover: '', offlineMessage: ''};
  assert.equal(maxProfileInput(base).shopName, 'Loja');
  assert.throws(() => maxProfileInput({...base, cover: 'javascript:alert(1)'}), /capa/);
  assert.throws(() => maxProfileInput({...base, shopName: 'x'.repeat(41)}), /nome/);
  assert.throws(() => maxProfileInput({...base, offlineMessage: 'x'.repeat(501)}), /mensagem/);
  assert.throws(() => maxProfileInput({...base, schedule: Array.from({length: 7}, () => ({open: true, start: '18:00', end: '09:00'}))}), /encerramento/);
});


test('Administrative test access unlocks benefits only for its UID without payments', async () => {
  const f = fixture(); await f.call('me');
  const now = Date.now(), end = now + 7 * 86400000;
  f.db.sql.prepare('INSERT INTO max_test_grants VALUES (?, ?, ?, ?, NULL, ?)').run('alice', now - 1000, end, 'administrative_test', now);
  const me = await f.call('me');
  assert.equal(me.body.member.active, true);
  assert.equal(me.body.member.testAccess, true);
  assert.equal(me.body.member.expiresAt, end);
  assert.deepEqual(me.body.payments, []);
  assert.equal(f.created, 0);
  assert.equal((await f.call('me', null, 'bob')).body.member.active, false);
  const schedule = Array.from({length: 7}, () => ({open: false, start: '09:00', end: '18:00'}));
  assert.equal((await f.call('profile', {shopName: 'Test store', cover: '', schedule, offlineMessage: ''}, 'alice', 'PUT')).status, 200);
  assert.equal((await f.call('public?uid=alice', null, null)).body.shopName, 'Test store');
  assert.equal((await f.call('test-grants', {uid: 'bob', expiresAt: end})).status, 404);
});

test('Expired, future, and revoked administrative grants cannot unlock MAX', async () => {
  const f = fixture(); await f.call('me');
  const now = Date.now();
  const insert = f.db.sql.prepare('INSERT OR REPLACE INTO max_test_grants VALUES (?, ?, ?, ?, ?, ?)');
  for (const [start, end, revoked] of [[now - 2000, now - 1000, null], [now + 1000, now + 86400000, null], [now - 1000, now + 86400000, now]]) {
    insert.run('alice', start, end, 'administrative_test', revoked, now);
    assert.equal((await f.call('me')).body.member.active, false);
    assert.equal((await f.call('profile', {shopName: 'Test'}, 'alice', 'PUT')).status, 403);
  }
});

test('Test grants never extend paid periods or survive their own revocation', async () => {
  const f = fixture(), invoice = await f.checkout(); f.approve(invoice.body.paymentId);
  const paid = await f.call('payment?id=' + invoice.body.paymentId);
  const now = Date.now();
  f.db.sql.prepare('INSERT INTO max_test_grants VALUES (?, ?, ?, ?, NULL, ?)').run('alice', now - 1000, now + MAX_PERIOD * 2, 'administrative_test', now);
  const me = await f.call('me');
  assert.equal(me.body.member.expiresAt, paid.body.member.expiresAt);
  assert.equal(me.body.member.testAccess, undefined);
  f.db.sql.prepare('UPDATE max_test_grants SET revoked_at = ? WHERE uid = ?').run(now, 'alice');
  assert.equal((await f.call('me')).body.member.expiresAt, paid.body.member.expiresAt);
});
