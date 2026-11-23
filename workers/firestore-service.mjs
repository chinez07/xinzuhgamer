// JavaScript / firestore-service.mjs / Cloudflare Workers / acesso privado ao Firestore.
let serviceToken;
const projectId = 'xinzuhgamer-87ff5';
const root = 'projects/' + projectId + '/databases/(default)/documents';
function base64url(bytes) {return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function encoded(value) {return base64url(new TextEncoder().encode(JSON.stringify(value)));}
export function firestoreValue(value) {
  if (value === null) return {nullValue:null};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'number') {if (!Number.isFinite(value)) throw Error('Número inválido.'); return Number.isInteger(value) ? {integerValue:String(value)} : {doubleValue:value};}
  if (typeof value === 'string') return {stringValue:value};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(firestoreValue)}};
  return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([key,item]) => [key,firestoreValue(item)]))}};
}
export function firestoreDecode(value) {
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
export function firestoreService(env, fetcher = fetch) {
  async function call(path, options = {}) {
    const token = await firestoreAccess(env,fetcher);
    const response = await fetcher('https://firestore.googleapis.com/v1/'+root+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:options.body ? JSON.stringify(options.body) : undefined});
    const data = await response.json();
    if (!response.ok) {const error = Error('Não foi possível atualizar os dados agora.'); error.status = response.status === 404 ? 404 : 503; error.conflict = [409,412].includes(response.status) || ['ABORTED','FAILED_PRECONDITION','ALREADY_EXISTS'].includes(data.error?.status); throw error;}
    return data;
  }
  return {
    async get(path) {
      if (!/^[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_-]{1,128}(?:\/[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_-]{1,128})?$/.test(path)) throw Error('Documento inválido.');
      try {const data = await call('/'+path); return {path,version:data.updateTime,data:firestoreDecode({mapValue:{fields:data.fields}})};} catch(error) {if(error.status===404) return {path,version:null,data:null}; throw error;}
    },
    async list(collection,pageSize=40,pageToken='') {
      if(!/^[A-Za-z][A-Za-z0-9]*$/.test(collection))throw Error('Coleção inválida.');
      const data=await call('/'+collection+'?'+new URLSearchParams({pageSize:String(Math.min(80,pageSize)),...(pageToken?{pageToken}:{})}));
      return {documents:(data.documents||[]).map(doc=>({path:doc.name.split('/documents/')[1],version:doc.updateTime,data:firestoreDecode({mapValue:{fields:doc.fields}})})),nextPageToken:data.nextPageToken||''};
    },
    async recentCompletedOrders(since,cursor=null) {
      const query={from:[{collectionId:'orders'}],
        select:{fields:['secureVersion','paymentVerified','status','completedAtMs','adId','discoveryCategory'].map(fieldPath=>({fieldPath}))},
        where:{fieldFilter:{field:{fieldPath:'completedAtMs'},op:'GREATER_THAN_OR_EQUAL',value:firestoreValue(since)}},
        orderBy:[{field:{fieldPath:'completedAtMs'},direction:'ASCENDING'},{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:500};
      if(cursor)query.startAt={values:[firestoreValue(cursor.time),{referenceValue:root+'/'+cursor.path}],before:false};
      const rows=await call(':runQuery',{method:'POST',body:{structuredQuery:query}});
      const documents=rows.filter(row=>row.document).map(({document:doc})=>({path:doc.name.split('/documents/')[1],data:firestoreDecode({mapValue:{fields:doc.fields}})}));
      const last=documents.at(-1);
      return {documents,nextCursor:documents.length===500?{time:last.data.completedAtMs,path:last.path}:null};
    },
    async commit(changes) {
      return call(':commit',{method:'POST',body:{writes:changes.map(({doc,patch}) => ({update:{name:root+'/'+doc.path,fields:firestoreValue(patch).mapValue.fields},updateMask:{fieldPaths:Object.keys(patch)},currentDocument:doc.version ? {updateTime:doc.version} : {exists:false}}))}});
    }
  };
}
