// JavaScript / max-core.mjs / Cloudflare Workers + D1 / Clube MAX Bloxzuh.
const MAX_PRICE = 45;
const MAX_PERIOD = 30 * 24 * 60 * 60 * 1000;
const PROJECT = 'xinzuhgamer-87ff5';
const FIREBASE_KEY = 'AIzaSyCaBMtonCi3KKKCvr8MuaMbsNOC14960Is';
const initialized = new WeakMap();

function maxError(message, status = 400) {throw Object.assign(new Error(message), {status});}
function maxJSON(value, status = 200) {
  return new Response(JSON.stringify(value), {status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }});
}
async function maxInit(db) {
  if (!db) maxError('O Clube MAX ainda está sendo preparado.', 503);
  if (!initialized.has(db)) {
    const ready = db.batch([
      db.prepare('CREATE TABLE IF NOT EXISTS max_intents (reference TEXT PRIMARY KEY, uid TEXT NOT NULL, request_id TEXT NOT NULL, created_at INTEGER NOT NULL, payment_id TEXT UNIQUE, UNIQUE(uid, request_id))'),
      db.prepare('CREATE TABLE IF NOT EXISTS max_payments (payment_id TEXT PRIMARY KEY, uid TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL, paid_at INTEGER, created_at INTEGER NOT NULL, live INTEGER NOT NULL DEFAULT 0)'),
      db.prepare('CREATE INDEX IF NOT EXISTS max_payments_user ON max_payments(uid)'),
      db.prepare("CREATE TABLE IF NOT EXISTS max_profiles (uid TEXT PRIMARY KEY, shop_name TEXT NOT NULL DEFAULT '', cover TEXT NOT NULL DEFAULT '', schedule_json TEXT NOT NULL DEFAULT '[]', offline_message TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS max_test_grants (uid TEXT PRIMARY KEY, starts_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, reason TEXT NOT NULL, revoked_at INTEGER, created_at INTEGER NOT NULL)")
    ]).catch(e => {initialized.delete(db); throw e;});
    initialized.set(db, ready);
  }
  await initialized.get(db);
}
function maxMembership(events, now = Date.now()) {
  const unique = new Map();
  for (const event of events) unique.set(String(event.payment_id), event);
  let expiresAt = 0;
  const eligible = [...unique.values()].filter(e => e.status === 'approved' && e.live === 1 && Number.isFinite(e.paid_at) && e.paid_at > 0)
    .sort((a, b) => a.paid_at - b.paid_at || String(a.payment_id).localeCompare(String(b.payment_id)));
  for (const event of eligible) expiresAt = Math.max(expiresAt, event.paid_at) + MAX_PERIOD;
  return {active: expiresAt > now, expiresAt: expiresAt || null};
}
async function maxMember(db, uid) {
  const {results} = await db.prepare('SELECT payment_id, status, live, paid_at FROM max_payments WHERE uid = ?').bind(uid).all();
  const paid = maxMembership(results);
  // A courtesy test never extends, fabricates or changes a paid period.
  if (paid.active) return paid;
  const grant = await db.prepare('SELECT starts_at, expires_at, revoked_at FROM max_test_grants WHERE uid = ?').bind(uid).first();
  const now = Date.now();
  if (grant && grant.revoked_at === null && Number.isFinite(grant.starts_at) && Number.isFinite(grant.expires_at) && grant.starts_at <= now && grant.expires_at > now) {
    return {active: true, expiresAt: grant.expires_at, testAccess: true};
  }
  return paid;
}
async function maxUser(request, fetcher) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || token.length > 15000) maxError('Entre na sua conta para continuar.', 401);
  let claims;
  try {claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));} catch {maxError('Sessão inválida. Entre novamente.', 401);}
  if (claims.aud !== PROJECT || claims.iss !== 'https://securetoken.google.com/' + PROJECT || !claims.sub) maxError('Sessão inválida.', 401);
  const response = await fetcher('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_KEY, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({idToken: token})
  });
  const data = await response.json();
  const user = data.users && data.users[0];
  if (!response.ok || !user || user.localId !== claims.sub || user.disabled) maxError('Sua sessão expirou. Entre novamente.', 401);
  return {uid: user.localId, email: user.email || '', name: user.displayName || 'Assinante Bloxzuh'};
}
function maxValidCPF(value) {
  const cpf = String(value || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1+$/.test(cpf)) return false;
  for (let length = 9; length <= 10; length++) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const digit = (sum * 10 % 11) % 10;
    if (digit !== Number(cpf[length])) return false;
  }
  return true;
}
function maxProfileInput(body) {
  const shopName = String(body.shopName || '').trim();
  const cover = String(body.cover || '');
  const offlineMessage = String(body.offlineMessage || '').trim();
  if (!shopName || shopName.length > 40) maxError('O nome da loja deve ter entre 1 e 40 caracteres.');
  if (offlineMessage.length > 500) maxError('A mensagem de ausência deve ter até 500 caracteres.');
  if (cover.length > 350000 || (cover && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(cover))) maxError('Envie uma capa em JPG, PNG ou WebP de até 350 KB após a compressão.');
  const schedule = body.schedule;
  if (!Array.isArray(schedule) || schedule.length !== 7) maxError('Informe os horários dos sete dias da semana.');
  const clean = schedule.map(day => {
    if (!day || typeof day.open !== 'boolean') maxError('Horário inválido.');
    if (!day.open) return {open: false, start: '09:00', end: '18:00'};
    const valid = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!valid(day.start) || !valid(day.end) || day.start >= day.end) maxError('O horário de encerramento deve ser posterior ao de abertura.');
    return {open: true, start: day.start, end: day.end};
  });
  return {shopName, cover, offlineMessage, schedule: clean};
}
async function maxPublic(db, uid, compact = false) {
  const member = await maxMember(db, uid);
  if (!member.active) return {uid, ...member};
  if (compact) {
    const brief = await db.prepare('SELECT shop_name FROM max_profiles WHERE uid = ?').bind(uid).first();
    return {uid, ...member, shopName: brief?.shop_name || ''};
  }
  const row = await db.prepare('SELECT shop_name, cover, schedule_json, offline_message FROM max_profiles WHERE uid = ?').bind(uid).first();
  return {uid, ...member, shopName: row?.shop_name || '', cover: row?.cover || '',
    schedule: row ? JSON.parse(row.schedule_json) : [], offlineMessage: row?.offline_message || ''};
}
async function maxMP(env, fetcher, id) {
  const response = await fetcher('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), {headers: {Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN}});
  if (!response.ok) maxError('Não foi possível consultar o Pix agora. Tente novamente.', 502);
  return response.json();
}
function maxPaymentState(payment, record, allowTest = false) {
  if (String(payment.id) !== String(record.payment_id) || payment.external_reference !== record.reference ||
      payment.metadata?.bloxzuh_max_uid !== record.uid || Number(payment.transaction_amount) !== MAX_PRICE ||
      payment.currency_id !== 'BRL' || payment.payment_method_id !== 'pix') maxError('O pagamento não corresponde à assinatura.', 409);
  let status = payment.status;
  const live = payment.live_mode === true || (allowTest && payment.live_mode === false);
  if (status === 'approved' && !live) status = 'test_payment';
  if (Number(payment.transaction_amount_refunded) > 0) status = 'refunded';
  const paidAt = Date.parse(payment.date_approved || '');
  if (status === 'approved' && (!Number.isFinite(paidAt) || paidAt <= 0 || paidAt > Date.now() + 300000)) maxError('Data de aprovação inválida.', 409);
  return {status, live: live ? 1 : 0, paidAt: Number.isFinite(paidAt) ? paidAt : null};
}
async function maxSync(db, env, fetcher, record, payment) {
  const state = maxPaymentState(payment, record, env.MAX_ALLOW_TEST_PAYMENTS === 'true');
  // Uma consulta antiga não pode reativar um pagamento já estornado.
  await db.prepare("UPDATE max_payments SET status = ?, live = ?, paid_at = COALESCE(?, paid_at) WHERE payment_id = ? AND NOT (status IN ('refunded', 'charged_back') AND ? NOT IN ('refunded', 'charged_back')) AND NOT (status = 'approved' AND ? IN ('pending', 'in_process', 'authorized'))")
    .bind(state.status, state.live, state.paidAt, record.payment_id, state.status, state.status).run();
  const saved = await db.prepare('SELECT status, live, paid_at FROM max_payments WHERE payment_id = ?').bind(record.payment_id).first();
  return {status: saved.status, live: saved.live, paidAt: saved.paid_at};
}
async function maxCheckout(request, env, user, fetcher) {
  if (env.MAX_SALES_ENABLED !== 'true' || !env.MP_ACCESS_TOKEN || String(env.MP_ACCESS_TOKEN).startsWith('TEST-')) maxError('As assinaturas MAX ainda não foram abertas.', 503);
  const body = await request.json();
  if (body.acceptedTerms !== true) maxError('Confirme as condições da assinatura para gerar o Pix.');
  if (!maxValidCPF(body.cpf)) maxError('Informe um CPF válido para gerar o Pix.');
  if (!user.email) maxError('Cadastre um e-mail na sua conta antes de assinar.');
  if (!/^[a-f0-9-]{36}$/i.test(body.requestId || '')) maxError('Identificador de checkout inválido.');
  const db = env.MAX_DB;
  const reference = 'MAX:' + user.uid + ':' + body.requestId;
  await db.prepare('INSERT INTO max_intents(reference, uid, request_id, created_at) VALUES(?, ?, ?, ?) ON CONFLICT(uid, request_id) DO NOTHING')
    .bind(reference, user.uid, body.requestId, Date.now()).run();
  const intent = await db.prepare('SELECT reference, payment_id, created_at FROM max_intents WHERE uid = ? AND request_id = ?').bind(user.uid, body.requestId).first();
  let payment;
  if (intent.payment_id) payment = await maxMP(env, fetcher, intent.payment_id);
  else {
    if (intent.created_at + 30 * 60000 <= Date.now()) maxError('A tentativa anterior expirou. Gere um novo Pix.', 409);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reference));
    const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const key = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
    const parts = user.name.split(/\s+/);
    const response = await fetcher('https://api.mercadopago.com/v1/payments', {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN, 'X-Idempotency-Key': key},
      body: JSON.stringify({transaction_amount: MAX_PRICE, description: 'Clube MAX Bloxzuh · 30 dias', payment_method_id: 'pix',
        external_reference: reference, metadata: {bloxzuh_max_uid: user.uid},
        date_of_expiration: new Date(intent.created_at + 30 * 60000).toISOString(),
        notification_url: new URL('/max/webhook', request.url).href,
        payer: {email: user.email, first_name: parts[0], last_name: parts.slice(1).join(' ') || 'Bloxzuh', identification: {type: 'CPF', number: String(body.cpf).replace(/\D/g, '')}}})
    });
    payment = await response.json();
    if (!response.ok || !payment.id) maxError('Não foi possível gerar o Pix. Confira seus dados e tente novamente.', 502);
    await db.batch([
      db.prepare('UPDATE max_intents SET payment_id = ? WHERE reference = ?').bind(String(payment.id), reference),
      db.prepare('INSERT INTO max_payments(payment_id, uid, reference, status, created_at) VALUES(?, ?, ?, ?, ?) ON CONFLICT(payment_id) DO NOTHING')
        .bind(String(payment.id), user.uid, reference, 'pending', Date.now())
    ]);
  }
  const record = {payment_id: String(payment.id), reference, uid: user.uid};
  const state = await maxSync(db, env, fetcher, record, payment);
  const transaction = payment.point_of_interaction?.transaction_data || {};
  return {paymentId: record.payment_id, status: state.status, qrCode: transaction.qr_code || '', qrBase64: transaction.qr_code_base64 || '',
    expiresAt: payment.date_of_expiration || null, member: await maxPublic(db, user.uid)};
}
async function handleMaxRequest(request, env, fetcher = fetch) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '');
    if (request.method === 'OPTIONS') return maxJSON({ok: true});
    if (path === '/max/config' && request.method === 'GET') return maxJSON({price: MAX_PRICE, days: 30, manualRenewal: true, salesEnabled: !!env.MAX_DB && !!env.MP_ACCESS_TOKEN && !String(env.MP_ACCESS_TOKEN).startsWith('TEST-') && env.MAX_SALES_ENABLED === 'true'});
    await maxInit(env.MAX_DB);
    const db = env.MAX_DB;
    if (path === '/max/public' && request.method === 'GET') {
      const uid = url.searchParams.get('uid') || '';
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) maxError('Perfil inválido.');
      return maxJSON(await maxPublic(db, uid, url.searchParams.get('compact') === '1'));
    }
    if (path === '/max/webhook' && request.method === 'POST') {
      let body = {}; try {body = await request.json();} catch {}
      const id = String(body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
      if (!/^\d+$/.test(id)) return maxJSON({ok: true, skipped: true});
      const record = await db.prepare('SELECT * FROM max_payments WHERE payment_id = ?').bind(id).first();
      if (!record) return maxJSON({ok: true, skipped: true});
      await maxSync(db, env, fetcher, record, await maxMP(env, fetcher, id));
      return maxJSON({ok: true});
    }
    const user = await maxUser(request, fetcher);
    if (path === '/max/me' && request.method === 'GET') {
      const {results} = await db.prepare('SELECT payment_id, status, created_at FROM max_payments WHERE uid = ? ORDER BY created_at DESC LIMIT 10').bind(user.uid).all();
      const saved = await db.prepare('SELECT shop_name, cover, schedule_json, offline_message FROM max_profiles WHERE uid = ?').bind(user.uid).first();
      return maxJSON({member: await maxPublic(db, user.uid), payments: results,
        settings: saved ? {shopName: saved.shop_name, cover: saved.cover, schedule: JSON.parse(saved.schedule_json), offlineMessage: saved.offline_message} : null});
    }
    if (path === '/max/checkout' && request.method === 'POST') return maxJSON(await maxCheckout(request, env, user, fetcher));
    if (path === '/max/payment' && request.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      const record = await db.prepare('SELECT * FROM max_payments WHERE payment_id = ? AND uid = ?').bind(id, user.uid).first();
      if (!record) maxError('Pagamento não encontrado.', 404);
      const payment = await maxMP(env, fetcher, id);
      const state = await maxSync(db, env, fetcher, record, payment);
      return maxJSON({paymentId: id, status: state.status, member: await maxPublic(db, user.uid)});
    }
    if (path === '/max/profile' && request.method === 'PUT') {
      if (!(await maxMember(db, user.uid)).active) maxError('Sua assinatura MAX precisa estar ativa para salvar a loja.', 403);
      const settings = maxProfileInput(await request.json());
      await db.prepare('INSERT INTO max_profiles(uid, shop_name, cover, schedule_json, offline_message, updated_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET shop_name=excluded.shop_name, cover=excluded.cover, schedule_json=excluded.schedule_json, offline_message=excluded.offline_message, updated_at=excluded.updated_at')
        .bind(user.uid, settings.shopName, settings.cover, JSON.stringify(settings.schedule), settings.offlineMessage, Date.now()).run();
      return maxJSON({ok: true, member: await maxPublic(db, user.uid)});
    }
    return maxJSON({error: 'Rota MAX não encontrada.'}, 404);
  } catch (e) {return maxJSON({error: e.status ? e.message : 'Não foi possível concluir agora. Tente novamente.'}, e.status || 500);}
}


/**
 *  * Bloxzuh – Cloudflare Worker (Mercado Pago Pix)
  *
   * Secrets (wrangler secret / Dashboard):
    *   MP_ACCESS_TOKEN   = Access Token do Mercado Pago (APP_USR-...)
     *   WEBHOOK_SECRET    = texto aleatório (opcional, para validar)
      *
       * Rotas:
        *   POST /create-pix   body: { orderId, amount, email, name, cpf, description, notificationUrl? }
         *   GET  /status?paymentId=123
          *   POST /webhook      (notificação MP)
           */

           export default {
             async fetch(request, env, ctx) {
                 const url = new URL(request.url);
                     const path = url.pathname.replace(/\/$/, '') || '/';
    if (path.startsWith('/max/')) return handleMaxRequest(request, env);

                         // CORS
                             if (request.method === 'OPTIONS') {
                                   return new Response(null, { status: 204, headers: corsHeaders() });
                                       }

                                           try {
                                                 if (path.endsWith('/create-pix') && request.method === 'POST') {
                                                         return await createPix(request, env);
                                                               }
                                                                     if (path.endsWith('/status') && request.method === 'GET') {
                                                                             return await paymentStatus(url, env);
                                                                                   }
                                                                                         if (path.endsWith('/webhook') && request.method === 'POST') {
                                                                                                 return await handleWebhook(request, env);
                                                                                                       }
                                                                                                             return json({ ok: true, service: 'bloxzuh-mp-pix', routes: ['/create-pix', '/status', '/webhook'] });
                                                                                                                 } catch (e) {
                                                                                                                       return json({ error: e.message || 'Erro interno' }, 500);
                                                                                                                           }
                                                                                                                             }
                                                                                                                             };

                                                                                                                             function corsHeaders() {
                                                                                                                               return {
                                                                                                                                   'Access-Control-Allow-Origin': '*',
                                                                                                                                       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                                                                                                                                           'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                                                                                                                                             };
                                                                                                                                             }

                                                                                                                                             function json(data, status = 200) {
                                                                                                                                               return new Response(JSON.stringify(data), {
                                                                                                                                                   status,
                                                                                                                                                       headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                                                                                                                                                         });
                                                                                                                                                         }

                                                                                                                                                         async function createPix(request, env) {
                                                                                                                                                           if (!env.MP_ACCESS_TOKEN) {
                                                                                                                                                               return json({ error: 'MP_ACCESS_TOKEN não configurado no Worker' }, 500);
                                                                                                                                                                 }
                                                                                                                                                                   const body = await request.json();
                                                                                                                                                                     const amount = Number(body.amount);
                                                                                                                                                                       const email = String(body.email || '').trim();
                                                                                                                                                                         const name = String(body.name || 'Comprador').trim();
                                                                                                                                                                           const cpf = String(body.cpf || '').replace(/\D/g, '');
                                                                                                                                                                             const orderId = String(body.orderId || '');
                                                                                                                                                                               const description = String(body.description || 'Pedido Bloxzuh').slice(0, 200);

                                                                                                                                                                                 if (!amount || amount < 0.01) return json({ error: 'Valor inválido' }, 400);
                                                                                                                                                                                   if (!email) return json({ error: 'E-mail obrigatório' }, 400);
                                                                                                                                                                                     if (cpf.length !== 11) return json({ error: 'CPF inválido' }, 400);
                                                                                                                                                                                       if (!orderId) return json({ error: 'orderId obrigatório' }, 400);

                                                                                                                                                                                         const parts = name.split(/\s+/);
                                                                                                                                                                                           const firstName = parts[0] || 'Comprador';
                                                                                                                                                                                             const lastName = parts.slice(1).join(' ') || 'Bloxzuh';

                                                                                                                                                                                               const idempotency = crypto.randomUUID();
                                                                                                                                                                                                 const payload = {
                                                                                                                                                                                                     transaction_amount: Math.round(amount * 100) / 100,
                                                                                                                                                                                                         description,
                                                                                                                                                                                                             payment_method_id: 'pix',
                                                                                                                                                                                                                 external_reference: orderId,
                                                                                                                                                                                                                     payer: {
                                                                                                                                                                                                                           email,
                                                                                                                                                                                                                                 first_name: firstName,
                                                                                                                                                                                                                                       last_name: lastName,
                                                                                                                                                                                                                                             identification: { type: 'CPF', number: cpf },
                                                                                                                                                                                                                                                 },
                                                                                                                                                                                                                                                   };

                                                                                                                                                                                                                                                     // notification_url se informado (webhook)
                                                                                                                                                                                                                                                       if (body.notificationUrl) {
                                                                                                                                                                                                                                                           payload.notification_url = body.notificationUrl;
                                                                                                                                                                                                                                                             }

                                                                                                                                                                                                                                                               const res = await fetch('https://api.mercadopago.com/v1/payments', {
                                                                                                                                                                                                                                                                   method: 'POST',
                                                                                                                                                                                                                                                                       headers: {
                                                                                                                                                                                                                                                                             'Content-Type': 'application/json',
                                                                                                                                                                                                                                                                                   Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN,
                                                                                                                                                                                                                                                                                         'X-Idempotency-Key': idempotency,
                                                                                                                                                                                                                                                                                             },
                                                                                                                                                                                                                                                                                                 body: JSON.stringify(payload),
                                                                                                                                                                                                                                                                                                   });

                                                                                                                                                                                                                                                                                                     const data = await res.json();
                                                                                                                                                                                                                                                                                                       if (!res.ok) {
                                                                                                                                                                                                                                                                                                           const msg = (data && data.message) || (data && data.cause && data.cause[0] && data.cause[0].description) || 'Erro Mercado Pago';
                                                                                                                                                                                                                                                                                                               return json({ error: msg, details: data }, res.status);
                                                                                                                                                                                                                                                                                                                 }

                                                                                                                                                                                                                                                                                                                   const td = (data.point_of_interaction && data.point_of_interaction.transaction_data) || {};
                                                                                                                                                                                                                                                                                                                     return json({
                                                                                                                                                                                                                                                                                                                         paymentId: data.id,
                                                                                                                                                                                                                                                                                                                             status: data.status,
                                                                                                                                                                                                                                                                                                                                 status_detail: data.status_detail,
                                                                                                                                                                                                                                                                                                                                     qr_code: td.qr_code || null,
                                                                                                                                                                                                                                                                                                                                         qr_code_base64: td.qr_code_base64 || null,
                                                                                                                                                                                                                                                                                                                                             ticket_url: td.ticket_url || null,
                                                                                                                                                                                                                                                                                                                                                 external_reference: data.external_reference,
                                                                                                                                                                                                                                                                                                                                                     date_of_expiration: data.date_of_expiration || null,
                                                                                                                                                                                                                                                                                                                                                       });
                                                                                                                                                                                                                                                                                                                                                       }

                                                                                                                                                                                                                                                                                                                                                       async function paymentStatus(url, env) {
                                                                                                                                                                                                                                                                                                                                                         if (!env.MP_ACCESS_TOKEN) return json({ error: 'MP_ACCESS_TOKEN não configurado' }, 500);
                                                                                                                                                                                                                                                                                                                                                           const paymentId = url.searchParams.get('paymentId');
                                                                                                                                                                                                                                                                                                                                                             if (!paymentId) return json({ error: 'paymentId obrigatório' }, 400);

                                                                                                                                                                                                                                                                                                                                                               const res = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
                                                                                                                                                                                                                                                                                                                                                                   headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN },
                                                                                                                                                                                                                                                                                                                                                                     });
                                                                                                                                                                                                                                                                                                                                                                       const data = await res.json();
                                                                                                                                                                                                                                                                                                                                                                         if (!res.ok) return json({ error: data.message || 'Erro ao consultar' }, res.status);

                                                                                                                                                                                                                                                                                                                                                                           return json({
                                                                                                                                                                                                                                                                                                                                                                               paymentId: data.id,
                                                                                                                                                                                                                                                                                                                                                                                   status: data.status,
                                                                                                                                                                                                                                                                                                                                                                                       status_detail: data.status_detail,
                                                                                                                                                                                                                                                                                                                                                                                           external_reference: data.external_reference,
                                                                                                                                                                                                                                                                                                                                                                                               approved: data.status === 'approved',
                                                                                                                                                                                                                                                                                                                                                                                                 });
                                                                                                                                                                                                                                                                                                                                                                                                 }

                                                                                                                                                                                                                                                                                                                                                                                                 async function handleWebhook(request, env) {
                                                                                                                                                                                                                                                                                                                                                                                                   // MP envia query ?topic=payment&id= or body type/data
                                                                                                                                                                                                                                                                                                                                                                                                     const url = new URL(request.url);
                                                                                                                                                                                                                                                                                                                                                                                                       let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');
                                                                                                                                                                                                                                                                                                                                                                                                         try {
                                                                                                                                                                                                                                                                                                                                                                                                             const body = await request.json();
                                                                                                                                                                                                                                                                                                                                                                                                                 if (body && body.data && body.data.id) paymentId = body.data.id;
                                                                                                                                                                                                                                                                                                                                                                                                                     if (body && body.resource) {
                                                                                                                                                                                                                                                                                                                                                                                                                           const m = String(body.resource).match(/(\d+)/);
                                                                                                                                                                                                                                                                                                                                                                                                                                 if (m) paymentId = m[1];
                                                                                                                                                                                                                                                                                                                                                                                                                                     }
                                                                                                                                                                                                                                                                                                                                                                                                                                       } catch (e) {}

                                                                                                                                                                                                                                                                                                                                                                                                                                         if (!paymentId || !env.MP_ACCESS_TOKEN) {
                                                                                                                                                                                                                                                                                                                                                                                                                                             return json({ ok: true, skipped: true });
                                                                                                                                                                                                                                                                                                                                                                                                                                               }

                                                                                                                                                                                                                                                                                                                                                                                                                                                 const res = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
                                                                                                                                                                                                                                                                                                                                                                                                                                                     headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN },
                                                                                                                                                                                                                                                                                                                                                                                                                                                       });
                                                                                                                                                                                                                                                                                                                                                                                                                                                         const data = await res.json();
                                                                                                                                                                                                                                                                                                                                                                                                                                                           // Frontend faz polling; webhook só confirma recebimento
                                                                                                                                                                                                                                                                                                                                                                                                                                                             return json({
                                                                                                                                                                                                                                                                                                                                                                                                                                                                 ok: true,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                     paymentId: data.id,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                         status: data.status,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                             external_reference: data.external_reference,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 approved: data.status === 'approved',
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   });
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   }