// JavaScript / max-page.js / navegadores atuais / compra e configuração do Clube MAX.
(function () {
  var api = BloxzuhMax.api;
  var uid = '', revision = 0, polling = null, paymentId = '', cover = '', salesEnabled = false;
  var days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  function el(id) {return document.getElementById(id);}
  function message(text, error) {el('maxMessage').hidden = !text; el('maxMessage').textContent = text; el('maxMessage').className = 'max-message' + (error ? ' error' : '');}
  function paymentStatus(value) {return ({pending: 'aguardando pagamento', in_process: 'em análise', approved: 'aprovado', rejected: 'recusado', cancelled: 'cancelado', refunded: 'estornado', charged_back: 'contestado', test_payment: 'pagamento de teste'})[value] || 'aguardando confirmação';}
  function date(value) {return new Date(value).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short'});}
  function requestKey() {return 'bloxzuh-max-checkout-' + uid;}
  function clearRequest() {try {localStorage.removeItem(requestKey());} catch (e) {}}
  function requestId() {
    var id = ''; try {id = localStorage.getItem(requestKey()) || '';} catch (e) {}
    if (!id) {id = crypto.randomUUID(); try {localStorage.setItem(requestKey(), id);} catch (e) {}}
    return id;
  }
  function scheduleFields(value) {
    var box = el('maxSchedule'); box.textContent = '';
    days.forEach(function (day, i) {
      var selected = value && value.length === 7 ? value[i] : {open: i > 0 && i < 6, start: '09:00', end: '18:00'};
      var row = document.createElement('div'); row.className = 'max-schedule-row';
      var label = document.createElement('label');
      var check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.open; check.dataset.maxDay = i;
      label.appendChild(check); label.appendChild(document.createTextNode(' ' + day)); row.appendChild(label);
      ['start', 'end'].forEach(function (kind) {var input = document.createElement('input'); input.type = 'time'; input.value = selected[kind] || (kind === 'start' ? '09:00' : '18:00'); input.dataset.maxTime = kind; input.disabled = !check.checked; input.setAttribute('aria-label', (kind === 'start' ? 'Abertura ' : 'Encerramento ') + day); row.appendChild(input);});
      check.addEventListener('change', function () {row.querySelectorAll('input[type=time]').forEach(function (input) {input.disabled = !check.checked;});});
      box.appendChild(row);
    });
  }
  function renderMember(data) {
    var member = data.member;
    var active = !!member.active;
    el('maxSettings').hidden = !active;
    el('maxTrial').hidden = !data.trialEligible;
    el('maxState').textContent = active ? (member.testAccess ? 'Acesso de teste gratuito até ' : 'Assinatura ativa até ') + date(member.expiresAt) + ' · horário de Brasília' : 'Sua conta ainda não tem uma assinatura MAX ativa.';
    el('maxCheckout').hidden = !salesEnabled;
    el('maxGenerate').textContent = active && !member.testAccess ? 'Gerar Pix para renovar por 30 dias · R$ 45' : 'Gerar Pix de R$ 45 · 30 dias';
    el('maxRenewNote').textContent = member.testAccess ? 'Seu acesso de teste não gera cobrança. Se assinar, os 30 dias começam na aprovação do Pix.' : active ? 'A renovação soma 30 dias ao período atual. Não há cobrança automática.' : 'Os 30 dias começam na aprovação do Pix. Não há cobrança automática.';
    if (active) {
      var settings = data.settings || member;
      el('maxShopName').value = settings.shopName || firebase.auth().currentUser.displayName || '';
      el('maxOffline').value = settings.offlineMessage || '';
      cover = settings.cover || '';
      el('maxCoverPreview').hidden = !cover;
      if (cover) el('maxCoverPreview').src = cover; else el('maxCoverPreview').removeAttribute('src');
      scheduleFields(settings.schedule);
      el('maxMyStore').href = 'loja.html?uid=' + encodeURIComponent(uid);
      el('maxMyProfile').href = 'perfil.html?uid=' + encodeURIComponent(uid);
    }
    var pending = (data.payments || []).find(function (p) {return ['pending', 'in_process'].indexOf(p.status) >= 0;});
    el('maxPending').hidden = !pending;
    if (pending) {
      el('maxPending').textContent = 'Você tem um Pix pendente. Use “Gerar Pix” para retomar a cobrança deste aparelho ou consulte a confirmação.';
      paymentId = pending.payment_id; el('maxCheckExisting').hidden = false;
    } else el('maxCheckExisting').hidden = true;
  }
  async function reloadAccount(expected) {
    var data = await api('me', {auth: true});
    if (expected !== revision) return;
    renderMember(data);
  }
  el('maxStartTrial').addEventListener('click', async function () {
    if (!uid) return;
    var expected = revision;
    el('maxStartTrial').disabled = true;
    try {
      await api('trial', {auth: true, method: 'POST', body: {}});
      if (expected !== revision) return;
      await reloadAccount(expected);
      if (expected === revision) message('Seus 10 dias grátis começaram! Personalize sua loja abaixo. Não há cobrança automática.');
    } catch (e) {if (expected === revision) {message(e.message, true); if (e.status === 409) await reloadAccount(expected);}}
    finally {el('maxStartTrial').disabled = false;}
  });
  async function checkPayment() {
    if (!paymentId || !uid) return;
    var expected = revision;
    var data = await api('payment?id=' + encodeURIComponent(paymentId), {auth: true});
    if (expected !== revision) return;
    el('maxPaymentState').textContent = data.status === 'approved' ? 'Pagamento aprovado. Clube MAX ativo!' :
      (data.status === 'test_payment' ? 'Pagamento de teste não ativa assinatura de produção.' : 'Status do Pix: ' + paymentStatus(data.status));
    if (data.status === 'approved' && data.member.active) {
      clearInterval(polling); polling = null; clearRequest();
      message('Pagamento confirmado! Agora personalize sua loja MAX.');
      el('maxPayment').hidden = true;
      await reloadAccount(expected);
    } else if (['rejected', 'cancelled', 'refunded', 'charged_back', 'test_payment'].indexOf(data.status) >= 0) {
      clearInterval(polling); polling = null; clearRequest();
      message('Este Pix não ativou a assinatura. Status: ' + paymentStatus(data.status) + '.', true);
      await reloadAccount(expected);
    }
  }
  function showPayment(data) {
    paymentId = data.paymentId;
    el('maxPayment').hidden = false;
    el('maxQr').hidden = !data.qrBase64;
    if (data.qrBase64) el('maxQr').src = 'data:image/png;base64,' + data.qrBase64;
    el('maxPixCode').value = data.qrCode || '';
    el('maxPaymentState').textContent = 'Aguardando pagamento. A assinatura só será ativada após a confirmação.';
    var expiration = Date.parse(data.expiresAt || '');
    el('maxPixExpiry').textContent = Number.isFinite(expiration) ? 'Este Pix vence em ' + date(expiration) + ' (Brasília).' : '';
    clearInterval(polling);
    polling = setInterval(function () {
      if (Number.isFinite(expiration) && Date.now() > expiration) {
        clearInterval(polling); polling = null; clearRequest();
        el('maxPaymentState').textContent = 'O prazo deste Pix terminou. Consulte o pagamento antes de gerar um novo.';
        return;
      }
      if (document.visibilityState === 'visible') checkPayment().catch(function () {el('maxPaymentState').textContent = 'Não foi possível consultar agora. Use “Já paguei, consultar”.';});
    }, 7000);
    el('maxPayment').scrollIntoView({behavior: 'smooth', block: 'start'});
  }
  el('maxCheckoutForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!uid) return;
    var expected = revision;
    el('maxGenerate').disabled = true; message('Gerando seu Pix de R$ 45…');
    try {
      var data = await api('checkout', {auth: true, method: 'POST', body: {requestId: requestId(), cpf: el('maxCPF').value, acceptedTerms: el('maxAgree').checked}});
      if (expected !== revision) return;
      el('maxCPF').value = '';
      message('Pix gerado. Confira o valor e pague no aplicativo do seu banco.');
      if (data.status === 'approved') {paymentId = data.paymentId; await checkPayment();} else showPayment(data);
    } catch (e) {if (e.status === 409) clearRequest(); message(e.message, true);} finally {el('maxGenerate').disabled = false;}
  });
  [el('maxCheckNow'), el('maxCheckExisting')].forEach(function (button) {button.addEventListener('click', async function () {
    button.disabled = true; try {await checkPayment();} catch (e) {message(e.message, true);} finally {button.disabled = false;}
  });});
  el('maxCopy').addEventListener('click', async function () {
    try {await navigator.clipboard.writeText(el('maxPixCode').value); el('maxCopy').textContent = 'Código copiado';}
    catch (e) {el('maxPixCode').focus(); el('maxPixCode').select(); message('Selecione e copie o código Pix acima.');}
  });
  el('maxCoverFile').addEventListener('change', async function (event) {
    var file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) {message('A capa deve ser JPG, PNG ou WebP de até 5 MB.', true); event.target.value = ''; return;}
    try {
      var data = await new Promise(function (resolve, reject) {var reader = new FileReader(); reader.onload = function () {resolve(reader.result);}; reader.onerror = reject; reader.readAsDataURL(file);});
      var image = new Image();
      await new Promise(function (resolve, reject) {image.onload = resolve; image.onerror = reject; image.src = data;});
      var canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 360;
      var scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      canvas.getContext('2d').drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
      cover = canvas.toDataURL('image/jpeg', .72);
      if (cover.length > 350000) cover = canvas.toDataURL('image/jpeg', .4);
      if (cover.length > 350000) throw new Error('A imagem continua muito grande. Escolha uma capa mais simples.');
      el('maxCoverPreview').src = cover; el('maxCoverPreview').hidden = false;
      message('Prévia da capa pronta. Clique em “Salvar minha loja” para publicá-la.');
    } catch (e) {message(e.message || 'Não foi possível abrir essa imagem.', true);} finally {event.target.value = '';}
  });
  el('maxRemoveCover').addEventListener('click', function () {cover = ''; el('maxCoverPreview').hidden = true; el('maxCoverPreview').removeAttribute('src');});
  el('maxSettingsForm').addEventListener('submit', async function (event) {
    event.preventDefault(); var expected = revision; el('maxSave').disabled = true;
    try {
      var schedule = [...el('maxSchedule').children].map(function (row) {return {open: row.querySelector('input[type=checkbox]').checked, start: row.querySelector('[data-max-time=start]').value, end: row.querySelector('[data-max-time=end]').value};});
      await api('profile', {method: 'PUT', auth: true, body: {shopName: el('maxShopName').value, cover: cover, schedule: schedule, offlineMessage: el('maxOffline').value}});
      if (expected === revision) message('Sua loja MAX foi salva e já está disponível no perfil e na vitrine.');
    } catch (e) {message(e.message, true);} finally {el('maxSave').disabled = false;}
  });
  var configuration = api('config').then(function (config) {
    salesEnabled = config.salesEnabled;
    document.querySelectorAll('[data-max-sales-status]').forEach(function (element) {element.textContent = salesEnabled ? 'Clube MAX disponível' : 'Assinaturas temporariamente indisponíveis';});
    el('maxSalesNote').textContent = salesEnabled ? 'Primeiro uso: 10 dias grátis. Depois, R$ 45 por 30 dias, com pagamento manual.' : 'Estamos finalizando a ativação das assinaturas. Nenhuma cobrança pode ser gerada por enquanto.';
  }).catch(function () {el('maxSalesNote').textContent = 'O Clube MAX está temporariamente indisponível. Tente novamente mais tarde.';});
  auth.onAuthStateChanged(async function (user) {
    revision++; var expected = revision; uid = user ? user.uid : ''; clearInterval(polling); polling = null; paymentId = ''; cover = '';
    el('maxCPF').value = ''; el('maxAgree').checked = false;
    el('maxManagement').hidden = !user; el('maxGuest').hidden = !!user;
    el('maxPayment').hidden = true; el('maxSettings').hidden = true; el('maxTrial').hidden = true; message('');
    if (!user) return;
    el('maxState').textContent = 'Consultando sua assinatura…';
    try {await configuration; await reloadAccount(expected);} catch (e) {if (expected === revision) message(e.message, true);}
  });
})();
