// JavaScript / max-client.js / navegadores atuais / Clube MAX Bloxzuh.
(function () {
  if (window.BloxzuhMax) return;
  var origin = 'https://bloxzuh-pix.hskkaj48.workers.dev';
  var members = new Map();
  async function api(path, options) {
    options = options || {};
    var headers = {'Content-Type': 'application/json'};
    if (options.auth) {
      var user = firebase.auth().currentUser;
      if (!user) throw new Error('Entre na sua conta para continuar.');
      headers.Authorization = 'Bearer ' + await user.getIdToken();
    }
    var response = await fetch(origin + '/max/' + path, {method: options.method || 'GET', headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined});
    var data;
    try {data = await response.json();} catch (e) {throw new Error('O Clube MAX está temporariamente indisponível.');}
    if (!response.ok) {var error = new Error(data.error || 'Não foi possível concluir agora.'); error.status = response.status; throw error;}
    return data;
  }
  function publicMember(uid, refresh, full) {
    var key = uid + (full ? ':full' : ':brief');
    var entry = members.get(key);
    if (!refresh && entry && entry.until > Date.now()) return entry.promise;
    var promise = api('public?uid=' + encodeURIComponent(uid) + (full ? '' : '&compact=1')).catch(function (e) {members.delete(key); throw e;});
    members.set(key, {until: Date.now() + 15000, promise: promise});
    return promise;
  }
  function badge() {
    var host = document.createElement('span');
    host.className = 'max-badge'; host.tabIndex = 0; host.setAttribute('role', 'button');
    host.setAttribute('aria-label', 'Assinante Clube Max'); host.setAttribute('aria-expanded', 'false');
    var crown = document.createElement('i'); crown.className = 'fas fa-crown'; crown.setAttribute('aria-hidden', 'true');
    var tip = document.createElement('span'); tip.className = 'max-tooltip'; tip.setAttribute('role', 'tooltip');
    tip.textContent = 'Assinante Clube Max';
    host.appendChild(crown); host.appendChild(tip);
    function toggle(e) {e.preventDefault(); e.stopPropagation(); host.classList.toggle('max-tip-open'); host.setAttribute('aria-expanded', String(host.classList.contains('max-tip-open')));}
    host.addEventListener('click', toggle);
    host.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') toggle(e);
      else if (e.key === 'Escape') {host.classList.remove('max-tip-open'); host.setAttribute('aria-expanded', 'false');}
    });
    return host;
  }
  function opening(schedule, now) {
    if (!schedule || schedule.length !== 7) return {configured: false, open: false, text: 'Horário não informado'};
    var date = now || new Date();
    var parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(date);
    var values = {}; parts.forEach(function (part) {values[part.type] = part.value;});
    var day = schedule[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(values.weekday)];
    var time = values.hour + ':' + values.minute;
    var isOpen = !!(day && day.open && time >= day.start && time < day.end);
    return {configured: true, open: isOpen, text: isOpen ? 'Atendendo agora · até ' + day.end : 'Fora do horário de atendimento'};
  }
  function hoursCard(member) {
    var card = document.createElement('section'); card.className = 'max-hours';
    var heading = document.createElement('h2'); heading.textContent = 'Horário de atendimento'; card.appendChild(heading);
    var state = opening(member.schedule);
    var status = document.createElement('p'); status.className = state.open ? 'max-open' : 'max-closed'; status.textContent = state.text; card.appendChild(status);
    var zone = document.createElement('small'); zone.textContent = 'Horário de Brasília'; card.appendChild(zone);
    if (state.configured) {
      var days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      var details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Ver todos os horários'; details.appendChild(summary);
      member.schedule.forEach(function (day, i) {var row = document.createElement('p'); row.textContent = days[i] + ': ' + (day.open ? day.start + ' – ' + day.end : 'Fechado'); details.appendChild(row);});
      card.appendChild(details);
    }
    if (state.configured && !state.open && member.offlineMessage) {var message = document.createElement('p'); message.className = 'max-away'; message.textContent = member.offlineMessage; card.appendChild(message);}
    return card;
  }
  function decorate() {
    document.querySelectorAll('[data-max-uid]:not([data-max-ready])').forEach(function (element) {
      element.setAttribute('data-max-ready', '1');
      publicMember(element.getAttribute('data-max-uid')).then(function (member) {
        if (!member.active || !element.isConnected) return;
        if (member.shopName && element.hasAttribute('data-max-name')) element.textContent = member.shopName;
        element.appendChild(badge());
      }).catch(function () {});
    });
    document.querySelectorAll('[data-max-profile]:not([data-max-ready])').forEach(function (element) {
      element.setAttribute('data-max-ready', '1');
      var uid = element.getAttribute('data-max-profile');
      publicMember(uid, false, true).then(function (member) {
        if (!member.active || !element.isConnected) return;
        if (member.cover) {var image = document.createElement('img'); image.className = 'max-profile-cover'; image.src = member.cover; image.alt = 'Capa da loja'; element.appendChild(image);}
        var link = document.createElement('a'); link.className = 'max-store-link'; link.href = 'loja.html?uid=' + encodeURIComponent(uid); link.textContent = 'Conhecer a loja MAX'; element.appendChild(link);
      }).catch(function () {});
    });
  }
  function decorateHours() {
    document.querySelectorAll('[data-max-hours]:not([data-max-ready])').forEach(function (element) {
      element.setAttribute('data-max-ready', '1');
      publicMember(element.getAttribute('data-max-hours'), false, true).then(function (member) {
        if (member.active && element.isConnected) element.appendChild(hoursCard(member));
      }).catch(function () {});
    });
  }
  function start() {
    if (!document.querySelector('link[data-bloxzuh-max-css]')) {var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'css/max.css'; css.setAttribute('data-bloxzuh-max-css', '1'); document.head.appendChild(css);}
    decorate(); decorateHours();
    var scheduled = false;
    new MutationObserver(function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {scheduled = false; decorate(); decorateHours();});
    }).observe(document.body, {childList: true, subtree: true});
    document.addEventListener('click', function () {document.querySelectorAll('.max-tip-open').forEach(function (el) {el.classList.remove('max-tip-open'); el.setAttribute('aria-expanded', 'false');});});
  }
  window.BloxzuhMax = {api: api, publicMember: publicMember, badge: badge, opening: opening, hoursCard: hoursCard, decorate: decorate};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
