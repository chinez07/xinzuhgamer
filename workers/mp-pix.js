// JavaScript / max-core.mjs / Cloudflare Workers + D1 / Clube MAX Bloxzuh.
const MAX_PRICE = 45;
const MAX_TRIAL_PERIOD = 10 * 24 * 60 * 60 * 1000;
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
      db.prepare("CREATE TABLE IF NOT EXISTS max_test_grants (uid TEXT PRIMARY KEY, starts_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, reason TEXT NOT NULL, revoked_at INTEGER, created_at INTEGER NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS max_themes (uid TEXT PRIMARY KEY, theme_json TEXT NOT NULL, updated_at INTEGER NOT NULL)")
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
async function maxTrialEligible(db, uid) {
  const used = await db.prepare('SELECT uid FROM max_test_grants WHERE uid = ?').bind(uid).first();
  const paid = await db.prepare('SELECT payment_id FROM max_payments WHERE uid = ? AND paid_at IS NOT NULL LIMIT 1').bind(uid).first();
  return !used && !paid;
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
function maxThemeInput(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) maxError('Tema da loja inválido.');
  const accent = String(value.accent || '#a78bfa');
  if (!/^#[0-9a-f]{6}$/i.test(accent)) maxError('Escolha uma cor válida para a loja.');
  const backgrounds = {};
  for (const key of ['backgroundDesktop', 'backgroundMobile']) {
    const image = String(value[key] || '');
    if (image.length > 500000 || (image && !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) maxError('O fundo deve ser JPG, PNG ou WebP de até 500 KB após a compressão.');
    backgrounds[key] = image;
  }
  const panels = {};
  if (value.panelColor !== undefined) {
    if (typeof value.panelColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.panelColor)) maxError('Escolha uma cor válida para os painéis.');
    panels.panelColor = value.panelColor.toLowerCase();
  }
  if (value.panelTransparency !== undefined) {
    if (typeof value.panelTransparency !== 'number' || !Number.isInteger(value.panelTransparency) || value.panelTransparency < 0 || value.panelTransparency > 100) maxError('A transparência deve estar entre 0% e 100%.');
    panels.panelTransparency = value.panelTransparency;
  }
  return {accent: accent.toLowerCase(), ...backgrounds, ...panels};
}
async function maxReadTheme(db, uid) {
  const row = await db.prepare('SELECT theme_json FROM max_themes WHERE uid = ?').bind(uid).first();
  return row ? JSON.parse(row.theme_json) : {accent: '#a78bfa', backgroundDesktop: '', backgroundMobile: ''};
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
  return {shopName, cover, offlineMessage, schedule: clean, ...(body.theme === undefined ? {} : {theme: maxThemeInput(body.theme)})};
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
    schedule: row ? JSON.parse(row.schedule_json) : [], offlineMessage: row?.offline_message || '', theme: await maxReadTheme(db, uid)};
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
    if (path === '/max/config' && request.method === 'GET') return maxJSON({price: MAX_PRICE, days: 30, manualRenewal: true, trialDays: 10, salesEnabled: !!env.MAX_DB && !!env.MP_ACCESS_TOKEN && !String(env.MP_ACCESS_TOKEN).startsWith('TEST-') && env.MAX_SALES_ENABLED === 'true'});
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
      return maxJSON({member: await maxPublic(db, user.uid), trialEligible: await maxTrialEligible(db, user.uid), payments: results,
        settings: saved ? {shopName: saved.shop_name, cover: saved.cover, schedule: JSON.parse(saved.schedule_json), offlineMessage: saved.offline_message, theme: await maxReadTheme(db, user.uid)} : null});
    }
    if (path === '/max/trial' && request.method === 'POST') {
      const now = Date.now();
      // Atomic single-use claim for the authenticated UID; no client-supplied dates or UID.
      await db.prepare("INSERT INTO max_test_grants (uid, starts_at, expires_at, reason, revoked_at, created_at) SELECT ?, ?, ?, 'intro_trial_10days', NULL, ? WHERE NOT EXISTS (SELECT 1 FROM max_payments WHERE uid = ? AND paid_at IS NOT NULL) ON CONFLICT(uid) DO NOTHING")
        .bind(user.uid, now, now + MAX_TRIAL_PERIOD, now, user.uid).run();
      const grant = await db.prepare('SELECT reason, expires_at, revoked_at FROM max_test_grants WHERE uid = ?').bind(user.uid).first();
      if (!grant || grant.reason !== 'intro_trial_10days' || grant.revoked_at !== null || grant.expires_at <= now) maxError('O teste gratuito já foi utilizado ou sua conta já teve uma assinatura paga.', 409);
      return maxJSON({ok: true, member: await maxPublic(db, user.uid)});
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
      const writes = [db.prepare('INSERT INTO max_profiles(uid, shop_name, cover, schedule_json, offline_message, updated_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(uid) DO UPDATE SET shop_name=excluded.shop_name, cover=excluded.cover, schedule_json=excluded.schedule_json, offline_message=excluded.offline_message, updated_at=excluded.updated_at')
        .bind(user.uid, settings.shopName, settings.cover, JSON.stringify(settings.schedule), settings.offlineMessage, Date.now())];
      if (settings.theme) writes.push(db.prepare('INSERT INTO max_themes(uid, theme_json, updated_at) VALUES(?, ?, ?) ON CONFLICT(uid) DO UPDATE SET theme_json=excluded.theme_json, updated_at=excluded.updated_at')
        .bind(user.uid, JSON.stringify({...await maxReadTheme(db, user.uid), ...settings.theme}), Date.now()));
      await db.batch(writes);
      return maxJSON({ok: true, member: await maxPublic(db, user.uid)});
    }
    return maxJSON({error: 'Rota MAX não encontrada.'}, 404);
  } catch (e) {return maxJSON({error: e.status ? e.message : 'Não foi possível concluir agora. Tente novamente.'}, e.status || 500);}
}


// JavaScript / firestore-service.mjs / Cloudflare Workers / acesso privado ao Firestore.
let serviceToken;
const projectId = 'xinzuhgamer-87ff5';
const root = 'projects/' + projectId + '/databases/(default)/documents';
function base64url(bytes) {return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function encoded(value) {return base64url(new TextEncoder().encode(JSON.stringify(value)));}
function firestoreValue(value) {
  if (value === null) return {nullValue:null};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'number') {if (!Number.isFinite(value)) throw Error('Número inválido.'); return Number.isInteger(value) ? {integerValue:String(value)} : {doubleValue:value};}
  if (typeof value === 'string') return {stringValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(firestoreValue)}};
  return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item]) => [key,firestoreValue(item)]))}};
}
function firestoreDecode(value) {
  if ('nullValue' in value) return null;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(firestoreDecode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key,item]) => [key,firestoreDecode(item)]));
  throw Error('Campo Firestore não suportado.');
}
async function firestoreAccess(env, fetcher) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {const error = Error('A proteção financeira está em configuração. Tente mais tarde.'); error.status = 503; throw error;}
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  if (account.project_id !== projectId || !account.client_email || !account.private_key) throw Error('Credencial do projeto inválida.');
  if (serviceToken && serviceToken.email === account.client_email && serviceToken.expires > Date.now()) return serviceToken.token;
  const now = Math.floor(Date.now()/1000);
  const assertion = encoded({alg:'RS256',typ:'JWT'}) + '.' + encoded({iss:account.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const pem = account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key = await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(assertion));
  const response = await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:assertion+'.'+base64url(new Uint8Array(signature))})});
  const result = await response.json();
  if (!response.ok || !result.access_token) throw Error('Não foi possível autenticar o serviço financeiro.');
  serviceToken = {email:account.client_email,token:result.access_token,expires:Date.now()+Math.max(60,Number(result.expires_in)-120)*1000};
  return result.access_token;
}
function firestoreService(env, fetcher = fetch) {
  async function call(path, options = {}) {
    const token = await firestoreAccess(env,fetcher);
    const response = await fetcher('https://firestore.googleapis.com/v1/'+root+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:options.body ? JSON.stringify(options.body) : undefined});
    const data = await response.json();
    if (!response.ok) {const error = Error('Não foi possível atualizar os dados agora.'); error.status = response.status === 404 ? 404 : 503; error.conflict = [409,412].includes(response.status) || ['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(data.error?.status); throw error;}
    return data;
  }
  return {
    async get(path) {
      if (!/^[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_-]{1,128}$/.test(path)) throw Error('Documento inválido.');
      try {const data = await call('/'+path); return {path,version:data.updateTime,data:firestoreDecode({mapValue:{fields:data.fields}})};} catch(error) {if(error.status===404) return {path,version:null,data:null}; throw error;}
    },
    async commit(changes) {
      return call(':commit',{method:'POST',body:{writes:changes.map(({doc,patch}) => ({update:{name:root+'/'+doc.path,fields:firestoreValue(patch).mapValue.fields},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:doc.version ? {updateTime:doc.version} : {exists:false}}))}});
    }
  };
}


// JavaScript / market-core.mjs / Cloudflare Workers / pedidos e carteira com autoridade no servidor.
const MARKET_RELEASE = 10*86400000;
let marketRateReady;
function marketError(text,status=400) {const error=Error(text); error.status=status; throw error;}
function marketId(value) {if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(value||''))) marketError('Identificador inválido.'); return String(value);}
function marketCents(value) {const number=Number(value); if(!Number.isFinite(number)||number<0.01||number>100000) marketError('Valor inválido.'); return Math.round(number*100);}
function marketParty(order,user) {if (!order || ![order.buyerUid,order.sellerUid].includes(user.uid)) marketError('Sem permissão para este pedido.',403);}
async function marketSecure(db,order) {
  if(order?.secureVersion!==1) marketError('Este pedido antigo precisa de conferência administrativa.',409);
  const proof=await db.get('marketOrderProofs/'+marketId(order.code));
  if(!proof.data) marketError('Este pedido não tem registro financeiro comprovado.',409);
  for(const field of ['code','adId','buyerUid','sellerUid','total','price','quantity','feePercent','itemIndex']) if(proof.data[field]!==order[field]) marketError('Pedido divergente do registro financeiro.',409);
  if(!!order.paymentVerified!==!!proof.data.paymentVerified) marketError('Pagamento divergente do registro financeiro.',409);
  return proof;
}
function marketQuote(ad, input, user) {
  if (!ad || ad.status!=='ativo' || !ad.sellerUid) marketError('Anúncio indisponível.',409);
  if(ad.sellerUid===user.uid) marketError('Você não pode comprar o próprio anúncio.');
  const quantity = input.quantity == null ? 1 : Number(input.quantity);
  if(!Number.isInteger(quantity)||quantity<1||quantity>100) marketError('Quantidade inválida.');
  let item=null,index=null;
  if(String(ad.model).toLowerCase()==='dinamico') {
    index=Number(input.itemIndex);
    if(input.itemIndex==null||!Number.isInteger(index)||index<0||!ad.items?.[index]) marketError('Escolha um item válido.');
    item=ad.items[index];
  }
  const stock=Number(item ? item.stock : ad.stock);
  if(!Number.isInteger(stock)||stock<quantity) marketError('Estoque insuficiente.',409);
  const cents=marketCents(item ? item.price : ad.price);
  if(cents*quantity>10000000) marketError('Pedido acima do limite.');
  const fees={prata:9.99,ouro:11.99,diamante:12.99};
  const feePercent=fees[String(ad.visibility||'prata').toLowerCase()] || fees.prata;
  return {price:cents/100,quantity,total:cents*quantity/100,feePercent,itemIndex:index,itemName:item ? String(item.name||item.title||'Item').slice(0,120) : ''};
}
async function marketAtomic(db, work) {
  for(let attempt=0;attempt<5;attempt++) {try {return await work();} catch(error) {if(!error.conflict||attempt===4) throw error;}}
}
async function marketRate(env,key,limit) {
  if(!env.MAX_DB) marketError('Proteção contra abuso indisponível.',503);
  if(!marketRateReady) marketRateReady=env.MAX_DB.exec('CREATE TABLE IF NOT EXISTS market_rate (key TEXT PRIMARY KEY, bucket INTEGER NOT NULL, count INTEGER NOT NULL)').catch(error=>{marketRateReady=null;throw error;});
  await marketRateReady;
  const bucket=Math.floor(Date.now()/60000);
  const row=await env.MAX_DB.prepare('INSERT INTO market_rate(key,bucket,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count').bind(key,bucket).first();
  if(row.count>limit) marketError('Muitas tentativas. Aguarde um minuto.',429);
}
function marketWalletState(data,now=Date.now()) {
  const wallet=data||{};
  let available=wallet.secureVersion===1 ? Number(wallet.secureSaldoCents)||0 : 0;
  let pending=0;
  const items=(wallet.securePendingItems||[]).map(item=>{
    if(!Number.isSafeInteger(item.cents)||item.cents<0) marketError('Carteira exige conferência.',409);
    if(!item.released&&item.releaseAtMs<=now) {available+=item.cents; return {...item,released:true};}
    if(!item.released) pending+=item.cents;
    return item;
  });
  if(!Number.isSafeInteger(available)||available<0) marketError('Carteira exige conferência.',409);
  return {available,pending,items,withdrawn:Number(wallet.secureWithdrawnCents)||0,blocked:!!wallet.securityHold};
}
function marketWalletPatch(state) {return {secureVersion:1,secureSaldoCents:state.available,securePendingItems:state.items,secureWithdrawnCents:state.withdrawn,updatedAtMs:Date.now()};}
function marketNotification(uid,order,title,body) {
  return {doc:{path:'notifications/NT'+crypto.randomUUID().replace(/-/g,''),version:null},patch:{userId:uid,type:'venda',title,body:String(body||'').slice(0,120),link:'pedido.html?id='+encodeURIComponent(order.code),read:false,createdAtMs:Date.now()}};
}
async function marketWallet(db,uid) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('financialWallets/'+uid),state=marketWalletState(doc.data);
    const legacy=await db.get('wallets/'+uid);
    await db.commit([{doc,patch:marketWalletPatch(state)}]);
    return {saldo:state.available/100,pending:state.pending/100,withdrawn:state.withdrawn/100,pendingItems:state.items.map(item=>({...item,amount:item.cents/100})),securityHold:state.blocked,legacyBalanceReview:!!(legacy.data?.saldo||legacy.data?.pending)};
  });
}
function marketCheckPayment(payment,order,id) {
  if(String(payment.id)!==String(id)||String(order.mpPaymentId)!==String(id)||payment.external_reference!==order.code||payment.metadata?.bloxzuh_order!==order.code||payment.metadata?.buyer_uid!==order.buyerUid||marketCents(payment.transaction_amount)!==marketCents(order.total)||payment.currency_id!=='BRL'||payment.payment_method_id!=='pix') marketError('O pagamento não corresponde ao pedido.',409);
  if(payment.status==='approved'&&payment.live_mode!==true) marketError('Pagamento de teste não libera uma compra real.',409);
  if(Number(payment.transaction_amount_refunded)>0||['refunded','charged_back'].includes(payment.status)) return 'refunded';
  return payment.status;
}
async function marketMP(env,fetcher,id) {
  const response=await fetcher('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(marketId(id)),{headers:{Authorization:'Bearer '+env.MP_ACCESS_TOKEN}});
  if(!response.ok) marketError('Não foi possível consultar o Pix.',502);
  return response.json();
}
async function marketSettle(db,payment,orderId) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(orderId)),order=doc.data;
    if(!order) marketError('Pedido não encontrado.',404);
    const proof=await marketSecure(db,order);
    const status=marketCheckPayment(payment,order,payment.id);
    if(status==='refunded') {
      const wallet=await db.get('financialWallets/'+marketId(order.sellerUid));
      await db.commit([{doc,patch:{status:'reembolsado',paymentVerified:false,updatedAtMs:Date.now()}},{doc:proof,patch:{paymentVerified:false}},{doc:wallet,patch:{securityHold:true,securityHoldReason:'Pagamento estornado: '+order.code}}]);
      return {status:'refunded',approved:false};
    }
    if(status!=='approved') return {status,approved:false};
    if(order.paymentVerified) return {status:'approved',approved:true};
    if(order.sellerWalletApplied) marketError('Pagamento em conferência administrativa.',409);
    const paidAt=Date.parse(payment.date_approved||'');
    if(!Number.isFinite(paidAt)||paidAt<=0||paidAt>Date.now()+300000) marketError('Data de pagamento inválida.',409);
    const wallet=await db.get('financialWallets/'+marketId(order.sellerUid));
    const state=marketWalletState(wallet.data);
    if(state.items.length>=400) marketError('Carteira exige consolidação administrativa.',409);
    const cents=Math.round(marketCents(order.total)*(1-order.feePercent/100));
    state.items.push({orderId:order.code,code:order.code,cents,releaseAtMs:paidAt+MARKET_RELEASE,released:false});
    const adDoc=await db.get('ads/'+marketId(order.adId)),ad=adDoc.data;
    const changes=[{doc:wallet,patch:marketWalletPatch(state)}];
    let stockIssue=false;
    if(ad) {
      const qty=order.quantity,patch={sold:(Number(ad.sold)||0)+qty,updatedAtMs:Date.now()};
      if(order.itemIndex!=null&&ad.items?.[order.itemIndex]) {
        const items=ad.items.map(item=>({...item}));
        stockIssue=Number(items[order.itemIndex].stock)<qty;
        items[order.itemIndex].stock=Math.max(0,(Number(items[order.itemIndex].stock)||0)-qty);
        patch.items=items; patch.stock=items.reduce((sum,item)=>sum+Math.max(0,Number(item.stock)||0),0);
      } else {stockIssue=Number(ad.stock)<qty; patch.stock=Math.max(0,(Number(ad.stock)||0)-qty);}
      if(!patch.stock) patch.status='pausado';
      changes.push({doc:adDoc,patch});
    } else stockIssue=true;
    if(stockIssue) changes[0].patch={...changes[0].patch,securityHold:true,securityHoldReason:'Estoque em conferência: '+order.code};
    changes.push({doc,patch:{status:'pago',paymentVerified:true,paidAtMs:paidAt,stockApplied:true,stockNeedsReview:stockIssue,sellerWalletApplied:true,sellerNet:cents/100,updatedAtMs:Date.now()}});
    changes.push({doc:proof,patch:{paymentVerified:true}});
    changes.push(marketNotification(order.sellerUid,order,'Pagamento confirmado',order.adTitle));
    await db.commit(changes);
    return {status:'approved',approved:true};
  });
}
async function marketWithdraw(db,user,input) {
  const amount=marketCents(input.amount);
  if(amount<100) marketError('Valor mínimo de saque: R$ 1.');
  const mode=input.mode==='turbo'?'turbo':'normal',fee=mode==='turbo'?200:0;
  const pixKey=String(input.pixKey||'').trim(),cpf=String(input.cpf||'').replace(/\D/g,'');
  if(!pixKey||pixKey.length>200||!maxValidCPF(cpf)) marketError('Confira a chave Pix e o CPF.');
  const withdrawalId='WD'+crypto.randomUUID().replace(/-/g,'').toUpperCase();
  return marketAtomic(db,async()=>{
    const wallet=await db.get('financialWallets/'+user.uid),state=marketWalletState(wallet.data);
    if(state.blocked) marketError('Saque em análise administrativa.',409);
    if(amount+fee>state.available) marketError('Saldo disponível insuficiente.',409);
    state.available-=amount+fee; state.withdrawn+=amount;
    const withdrawal=await db.get('secureWithdrawals/'+withdrawalId),now=Date.now();
    const availableAtMs=now+(mode==='turbo'?1800000:3*86400000);
    await db.commit([{doc:wallet,patch:marketWalletPatch(state)},{doc:withdrawal,patch:{secureVersion:1,userId:user.uid,userName:user.name,userEmail:user.email,holderName:String(input.holderName||user.name).slice(0,120),holderCpf:cpf,pixKey,pixType:String(input.pixType||'cpf').slice(0,30),amount:amount/100,fee:fee/100,mode,status:'processando',availableAtMs,createdAtMs:now}}]);
    return {id:withdrawalId,availableAtMs,mode,fee:fee/100};
  });
}
async function marketChangeStatus(db,user,id,next) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(id)),order=doc.data;
    marketParty(order,user); await marketSecure(db,order);
    if(next===order.status) return {ok:true};
    const seller=order.sellerUid===user.uid,buyer=order.buyerUid===user.uid;
    const allowed=(next==='cancelado'&&buyer&&order.status==='aguardando_pagamento'&&!order.mpPaymentId)||(next==='em_entrega'&&seller&&order.status==='pago'&&order.paymentVerified)||(next==='concluido'&&buyer&&['pago','em_entrega'].includes(order.status)&&order.paymentVerified);
    if(!allowed) marketError('Esta alteração de pedido não é permitida.',409);
    const changes=[{doc,patch:{status:next,updatedAtMs:Date.now(),...(next==='concluido'?{completedAtMs:Date.now(),saleCounted:true}:{})}},marketNotification(buyer?order.sellerUid:order.buyerUid,order,'Pedido atualizado',next)];
    if(next==='concluido') {const ad=await db.get('ads/'+marketId(order.adId)); if(ad.data) changes.push({doc:ad,patch:{sales:(Number(ad.data.sales)||0)+order.quantity,updatedAtMs:Date.now()}});}
    await db.commit(changes);
    return {ok:true};
  });
}
async function marketCreate(db,user,input) {
  const doc=await db.get('ads/'+marketId(input.adId));
  const quote=marketQuote(doc.data,input,user),code='BZ'+crypto.randomUUID().replace(/-/g,'').toUpperCase();
  const order=await db.get('orders/'+code),now=Date.now(),ad=doc.data;
  const payload={secureVersion:1,code,adId:input.adId,adTitle:String(ad.title||'').slice(0,200)+(quote.itemName?' — '+quote.itemName:''),adCover:String(ad.cover||''),sellerUid:ad.sellerUid,sellerName:String(ad.sellerName||'Vendedor'),buyerUid:user.uid,buyerName:user.name,buyerEmail:user.email,category:String(ad.category||''),...quote,status:'aguardando_pagamento',createdAtMs:now,updatedAtMs:now};
  const proof={path:'marketOrderProofs/'+code,version:null};
  const immutable=Object.fromEntries(['code','adId','buyerUid','sellerUid','total','price','quantity','feePercent','itemIndex'].map(field=>[field,payload[field]]));
  await db.commit([{doc:order,patch:payload},{doc:proof,patch:{...immutable,paymentVerified:false}},marketNotification(ad.sellerUid,payload,'Novo pedido',payload.adTitle)]); return {id:code,...payload};
}
async function marketMessage(db,user,input,read=false) {
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(input.orderId)),order=doc.data;
    marketParty(order,user);
    await marketSecure(db,order);
    if(!order.paymentVerified||order.secureVersion!==1||!['pago','em_entrega','concluido'].includes(order.status)) marketError('O chat é liberado após a confirmação real do pagamento.',409);
    let messages=Array.isArray(order.messages)?order.messages.slice():[];
    const changes=[];
    if(read) messages=messages.map(item=>item.senderUid!==user.uid?{...item,read:true,readAtMs:Date.now()}:item);
    else {
      const text=String(input.text||'').trim();
      if(!text||text.length>2000) marketError('Mensagem deve ter entre 1 e 2000 caracteres.');
      if(messages.length>=250) marketError('Limite do chat atingido. Entre em contato com o suporte.',409);
      messages.push({id:crypto.randomUUID(),senderUid:user.uid,senderName:user.name,text,createdAtMs:Date.now(),read:false});
      changes.push(marketNotification(user.uid===order.buyerUid?order.sellerUid:order.buyerUid,order,'Nova mensagem',text));
    }
    changes.push({doc,patch:{messages,updatedAtMs:Date.now()}});
    await db.commit(changes); return {ok:true};
  });
}
async function marketReview(db,user,input) {
  const stars=Number(input.stars),comment=String(input.comment||'').trim();
  if(!Number.isInteger(stars)||stars<1||stars>5||comment.length>500) marketError('Avaliação inválida.');
  return marketAtomic(db,async()=>{
    const doc=await db.get('orders/'+marketId(input.orderId)),order=doc.data;
    marketParty(order,user); await marketSecure(db,order);
    if(!order.paymentVerified||order.status!=='concluido') marketError('Aguarde a conclusão da compra para avaliar.',409);
    const buyer=order.buyerUid===user.uid,flag=buyer?'reviewed':'buyerReviewed';
    if(order[flag]) marketError('Este pedido já foi avaliado.',409);
    const review=await db.get('reviews/'+(buyer?'RV':'RB')+order.code),now=Date.now();
    if(review.data) marketError('Este pedido já foi avaliado.',409);
    const payload={type:buyer?'ad':'buyer',orderId:order.code,adId:order.adId,adTitle:order.adTitle,itemName:order.itemName||'',sellerUid:order.sellerUid,buyerUid:order.buyerUid,buyerName:order.buyerName,fromUid:user.uid,fromName:user.name,toUid:buyer?order.sellerUid:order.buyerUid,stars,comment,createdAtMs:now};
    const patch=buyer?{reviewed:true,reviewStars:stars,reviewComment:comment}:{buyerReviewed:true,buyerReviewStars:stars,buyerReviewComment:comment};
    const changes=[{doc:review,patch:payload},{doc,patch:{...patch,updatedAtMs:now}},marketNotification(payload.toUid,order,'Nova avaliação',stars+' estrelas')];
    if(buyer) {
      const ad=await db.get('ads/'+marketId(order.adId));
      if(ad.data) {const count=(Number(ad.data.secureRatingCount)||0)+1,sum=(Number(ad.data.secureRatingSum)||0)+stars; changes.push({doc:ad,patch:{secureRatingCount:count,secureRatingSum:sum,rating:Math.round(sum/count*10)/10,ratingCount:count}});}
    }
    await db.commit(changes); return {id:review.path.split('/')[1]};
  });
}
async function marketCreatePix(db,env,user,input,request,fetcher) {
  const id=marketId(input.orderId),doc=await db.get('orders/'+id),order=doc.data;
  marketParty(order,user); await marketSecure(db,order);
  if(order.buyerUid!==user.uid) marketError('Só o comprador pode gerar o Pix.',403);
  if(order.mpPaymentId) {const payment=await marketMP(env,fetcher,order.mpPaymentId); marketCheckPayment(payment,order,payment.id); return marketPixResponse(payment);}
  if(order.status!=='aguardando_pagamento') marketError('Pedido não está aguardando pagamento.',409);
  const cpf=String(input.cpf||order.payerCpf||'').replace(/\D/g,'');
  if(!maxValidCPF(cpf)||!user.email) marketError('Confira o CPF e o e-mail da conta.');
  const response=await fetcher('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:'Bearer '+env.MP_ACCESS_TOKEN,'Content-Type':'application/json','X-Idempotency-Key':'market-'+id},body:JSON.stringify({transaction_amount:order.total,description:'Pedido Bloxzuh '+id,payment_method_id:'pix',external_reference:id,metadata:{bloxzuh_order:id,buyer_uid:user.uid},payer:{email:user.email,identification:{type:'CPF',number:cpf}},date_of_expiration:new Date(Date.now()+30*60000).toISOString(),notification_url:new URL('/webhook',request.url).href})});
  const payment=await response.json();
  if(!response.ok||!payment.id) marketError('Não foi possível gerar o Pix. Confira os dados e tente novamente.',502);
  const patch={mpPaymentId:String(payment.id),pixCopyPaste:payment.point_of_interaction?.transaction_data?.qr_code||'',pixQrBase64:payment.point_of_interaction?.transaction_data?.qr_code_base64||'',paymentExpiresAtMs:Date.parse(payment.date_of_expiration),payerCpf:cpf,updatedAtMs:Date.now()};
  // Um Pix concorrente usa a mesma chave idempotente. Nunca substitui uma confirmação por dados antigos.
  await marketAtomic(db,async()=>{const current=await db.get('orders/'+id); if(current.data.mpPaymentId) {if(current.data.mpPaymentId!==patch.mpPaymentId) marketError('Pagamento divergente.',409); return;} if(current.data.status!=='aguardando_pagamento') marketError('Pedido não está aguardando pagamento.',409); await db.commit([{doc:current,patch}]);});
  return marketPixResponse(payment);
}
function marketPixResponse(payment) {return {paymentId:String(payment.id),id:String(payment.id),qr_code:payment.point_of_interaction?.transaction_data?.qr_code||'',qr_code_base64:payment.point_of_interaction?.transaction_data?.qr_code_base64||'',date_of_expiration:payment.date_of_expiration};}
async function marketHandle(request,env,dependencies={}) {
  const fetcher=dependencies.fetcher||fetch,db=dependencies.db||firestoreService(env,fetcher),url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  const origin=request.headers.get('Origin');
  const allowed=['https://bloxzuh.store','https://www.bloxzuh.store'];
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',Vary:'Origin',...(allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
  function reply(data,status=200) {return new Response(JSON.stringify(data),{status,headers});}
  try {
    if(origin&&!allowed.includes(origin)) marketError('Origem não permitida.',403);
    if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
  if(path==='/market/health') return reply({service:'bloxzuh-market',configured:!!env.FIREBASE_SERVICE_ACCOUNT});
    if(Number(request.headers.get('Content-Length')||0)>16000) marketError('Requisição muito grande.',413);
    if(path==='/webhook'&&request.method==='POST') {
      // A notificação é apenas um aviso. Estado, valor e destinatário sempre vêm da API autenticada do MP.
      const text=await request.text(); if(text.length>16000) marketError('Requisição muito grande.',413);
      const body=JSON.parse(text||'{}'),paymentId=body.data?.id||url.searchParams.get('data.id');
      if(!paymentId) return reply({ok:true});
      await (dependencies.rate||marketRate)(env,'webhook:'+(request.headers.get('CF-Connecting-IP')||'unknown'),300);
      const payment=await marketMP(env,fetcher,String(paymentId));
      if(!payment.metadata?.bloxzuh_order) return reply({ok:true});
      await marketSettle(db,payment,marketId(payment.metadata.bloxzuh_order));
      return reply({ok:true});
    }
    const user=await (dependencies.auth||maxUser)(request,fetcher);
    await (dependencies.rate||marketRate)(env,user.uid+':'+path,path==='/create-pix'||path==='/market/orders'?10:60);
    if(path==='/market/wallet'&&request.method==='GET') return reply(await marketWallet(db,user.uid));
    if(path==='/status'&&request.method==='GET') {
      const id=marketId(url.searchParams.get('orderId')),doc=await db.get('orders/'+id); marketParty(doc.data,user); await marketSecure(db,doc.data);
      if(!doc.data.mpPaymentId) return reply({status:doc.data.status,approved:false});
      return reply(await marketSettle(db,await marketMP(env,fetcher,doc.data.mpPaymentId),id));
    }
    if(request.method!=='POST') marketError('Rota não encontrada.',404);
    const raw=await request.text(); if(raw.length>16000) marketError('Requisição muito grande.',413);
    const body=JSON.parse(raw||'{}');
    if(path==='/market/orders') return reply(await marketCreate(db,user,body));
    if(path==='/market/status') return reply(await marketChangeStatus(db,user,body.orderId,body.status));
    if(path==='/market/message') return reply(await marketMessage(db,user,body));
    if(path==='/market/read') return reply(await marketMessage(db,user,body,true));
    if(path==='/market/review') return reply(await marketReview(db,user,body));
    if(path==='/market/withdraw') return reply(await marketWithdraw(db,user,body));
    if(path==='/market/payment-data') {
      const doc=await db.get('orders/'+marketId(body.orderId)); marketParty(doc.data,user); await marketSecure(db,doc.data);
      if(doc.data.buyerUid!==user.uid||doc.data.status!=='aguardando_pagamento'||doc.data.mpPaymentId) marketError('Não é possível alterar os dados deste pagamento.',409);
      // Planos adicionais sem serviço configurado não são cobrados.
      if(body.vipPlan&&body.vipPlan!=='none') marketError('Planos adicionais ainda não estão disponíveis. Selecione sem plano.');
      const cpf=String(body.payerCpf||'').replace(/\D/g,''); if(!maxValidCPF(cpf)) marketError('CPF inválido.');
      await db.commit([{doc,patch:{paymentMethod:'pix',payerName:String(body.payerName||user.name).slice(0,120),payerCpf:cpf,vipPlan:'none',updatedAtMs:Date.now()}}]);
      return reply({ok:true});
    }
    if(path==='/create-pix') return reply(await marketCreatePix(db,env,user,body,request,fetcher));
    marketError('Rota não encontrada.',404);
  } catch(error) {return reply({error:error.status&&error.status<500?error.message:'O serviço financeiro está temporariamente indisponível.'},error.status||503);}
}


export default {async fetch(request,env) {
  const path = new URL(request.url).pathname.replace(/\/$/,'');
  if (path.startsWith('/max/')) return handleMaxRequest(request,env);
  return marketHandle(request,env);
}};
