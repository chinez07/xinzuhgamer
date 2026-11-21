// JavaScript / saque-locked.mjs / Cloudflare Workers / bloqueia o endpoint legado de transferências sem autorização.
export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const allowed = ['https://bloxzuh.store', 'https://www.bloxzuh.store'];
    const headers = {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
      'X-Content-Type-Options':'nosniff', 'Vary':'Origin',
      ...(allowed.includes(origin) ? {'Access-Control-Allow-Origin':origin} : {})};
    const json = (data,status=200) => new Response(JSON.stringify(data),{status,headers});
    if (origin && !allowed.includes(origin)) return json({error:'Origem não permitida.'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,
      'Access-Control-Allow-Methods':'GET, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization'}});
    if (request.method === 'GET') return json({service:'bloxzuh-saque',automaticPayouts:false,mode:'manual'});
    return json({error:'Transferências automáticas indisponíveis. Solicite o saque pelo Painel do Vendedor para conferência administrativa.'},403);
  }
};
