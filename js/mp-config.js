// Mercado Pago / Bloxzuh – configure a URL do seu Cloudflare Worker
// Exemplo: https://bloxzuh-pix.seuusuario.workers.dev
window.MP_WORKER_URL = window.MP_WORKER_URL || '';
// Deixe vazio até criar o Worker. Enquanto vazio, o site usa modo teste (simular).

window.BLOXZUH_SAQUE_WORKER_URL = window.BLOXZUH_SAQUE_WORKER_URL || (window.MP_WORKER_URL || '');
