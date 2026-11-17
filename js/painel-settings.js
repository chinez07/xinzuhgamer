// JavaScript / painel-settings.js / navegadores atuais / configurações da própria conta no painel.
(function () {
  'use strict';
  var revision = 0, loaded = false, loading = false;
  function el(id) {return document.getElementById(id);}
  function me() {return firebase.auth().currentUser;}
  function same(uid, version) {var user = me(); return user && user.uid === uid && version === revision;}
  function message(id, text, error) {el(id).textContent = text; el(id).classList.toggle('error', !!error);}
  function errorText(error) {
    var codes = {'auth/requires-recent-login':'Saia e entre novamente para confirmar sua identidade; depois tente outra vez.', 'auth/too-many-requests':'Aguarde um pouco antes de tentar novamente.', 'auth/network-request-failed':'Não foi possível conectar. Confira sua internet.', 'auth/weak-password':'A senha precisa ter pelo menos 6 caracteres.', 'permission-denied':'Não foi possível salvar seus dados. Entre novamente e tente outra vez.'};
    return codes[error.code] || 'Não foi possível concluir agora. Tente novamente.';
  }
  function providers(user) {return (user.providerData || []).map(function (provider) {return provider.providerId;});}
  function render(user) {
    var ids = providers(user), labels = ids.map(function (id) {return id === 'google.com' ? 'Google' : (id === 'password' ? 'E-mail e senha' : id);});
    el('sellerDataEmail').value = user.email || '';
    el('sellerProviders').textContent = labels.join(' · ') || 'Não informado';
    el('sellerSecurityMethods').textContent = labels.join(' · ') || 'Não informado';
    var created = Date.parse(user.metadata && user.metadata.creationTime || '');
    el('sellerJoined').textContent = Number.isFinite(created) ? new Date(created).toLocaleDateString('pt-BR', {timeZone:'America/Sao_Paulo'}) : 'Não informado';
    el('sellerVerificationEmail').textContent = user.email || 'Nenhum e-mail cadastrado.';
    el('sellerEmailStatus').textContent = user.emailVerified ? 'Confirmado' : 'Pendente';
    el('sellerEmailStatus').classList.toggle('verified', !!user.emailVerified);
    el('sellerVerificationNote').textContent = user.emailVerified ? 'O Firebase confirmou o endereço de e-mail desta conta.' : 'Confirme seu endereço pelo link enviado ao e-mail e depois atualize esta verificação.';
    el('sellerSendVerification').hidden = !user.email || user.emailVerified;
    el('sellerPasswordCard').hidden = ids.indexOf('password') < 0;
    el('sellerGoogleSecurity').hidden = ids.indexOf('google.com') < 0;
  }
  async function loadData() {
    var user = me(); if (!user || loaded || loading) return;
    var uid = user.uid, version = revision; loading = true; el('sellerDataSave').disabled = true;
    try {
      var profile = await fsGetProfile(uid);
      if (!same(uid, version)) return;
      el('sellerDataName').value = user.displayName || profile && profile.displayName || '';
      el('sellerDataBio').value = profile && profile.bio || '';
      loaded = true; message('sellerDataMessage','');
    } catch (error) {if (same(uid,version)) message('sellerDataMessage','Não foi possível carregar seus dados. Abra esta seção novamente para tentar outra vez.',true);}
    finally {if (version === revision) {loading = false; el('sellerDataSave').disabled = !loaded;}}
  }
  el('sellerDataForm').addEventListener('submit', async function (event) {
    event.preventDefault(); var user = me(); if (!user || !loaded) return;
    var name = el('sellerDataName').value.trim(), bio = el('sellerDataBio').value.trim(), version = revision, uid = user.uid;
    if (!name || name.length > 60 || bio.length > 1000) {message('sellerDataMessage','Informe um nome de até 60 caracteres e uma biografia de até 1000.',true); return;}
    el('sellerDataSave').disabled = true;
    try {
      await fsSaveProfile({displayName:name,bio:bio});
      if (!same(uid,version)) return;
      if (user.displayName !== name) await updateDisplayName(name);
      if (!same(uid,version)) return;
      try {localStorage.setItem('xinzuh-bio-' + uid,bio);} catch (e) {}
      el('painelUser').textContent = name; el('sellerAvatarFallback').textContent = name.charAt(0).toUpperCase();
      message('sellerDataMessage','Seus dados foram salvos.');
    } catch (error) {if (same(uid,version)) message('sellerDataMessage',errorText(error),true);}
    finally {if (same(uid,version)) el('sellerDataSave').disabled = false;}
  });
  el('sellerSendVerification').addEventListener('click', async function () {
    var user = me(); if (!user || user.emailVerified) return;
    var uid = user.uid, version = revision; el('sellerSendVerification').disabled = true;
    try {await user.sendEmailVerification(); if (same(uid,version)) message('sellerVerificationMessage','E-mail enviado. Confira sua caixa de entrada e o spam; depois clique em Atualizar verificação.');}
    catch (error) {if (same(uid,version)) message('sellerVerificationMessage',errorText(error),true);}
    finally {if (same(uid,version)) el('sellerSendVerification').disabled = false;}
  });
  el('sellerRefreshVerification').addEventListener('click', async function () {
    var user = me(); if (!user) return;
    var uid = user.uid, version = revision; el('sellerRefreshVerification').disabled = true;
    try {await user.reload(); if (same(uid,version)) {render(me()); message('sellerVerificationMessage',me().emailVerified ? 'E-mail confirmado.' : 'Seu e-mail ainda está pendente de confirmação.');}}
    catch (error) {if (same(uid,version)) message('sellerVerificationMessage',errorText(error),true);}
    finally {if (same(uid,version)) el('sellerRefreshVerification').disabled = false;}
  });
  el('sellerPasswordForm').addEventListener('submit', async function (event) {
    event.preventDefault(); var user = me(); if (!user || providers(user).indexOf('password') < 0) return;
    var password = el('sellerNewPassword').value, confirmation = el('sellerConfirmPassword').value, uid = user.uid, version = revision;
    if (password.length < 6) {message('sellerPasswordMessage','A senha deve ter pelo menos 6 caracteres.',true); return;}
    if (password !== confirmation) {message('sellerPasswordMessage','As senhas não coincidem.',true); return;}
    el('sellerPasswordSave').disabled = true;
    try {await user.updatePassword(password); if (same(uid,version)) message('sellerPasswordMessage','Sua senha foi alterada.');}
    catch (error) {if (same(uid,version)) message('sellerPasswordMessage',errorText(error),true);}
    finally {el('sellerNewPassword').value = ''; el('sellerConfirmPassword').value = ''; if (same(uid,version)) el('sellerPasswordSave').disabled = false;}
  });
  firebase.auth().onAuthStateChanged(function (user) {
    revision++; loaded = false; loading = false;
    ['sellerDataName','sellerDataEmail','sellerDataBio','sellerNewPassword','sellerConfirmPassword'].forEach(function (id) {el(id).value = '';});
    ['sellerDataMessage','sellerVerificationMessage','sellerPasswordMessage'].forEach(function (id) {message(id,'');});
    el('sellerDataSave').disabled = true; el('sellerSendVerification').disabled = false; el('sellerRefreshVerification').disabled = false; el('sellerPasswordSave').disabled = false;
    el('sellerPasswordCard').hidden = true; el('sellerGoogleSecurity').hidden = true; el('sellerSendVerification').hidden = true;
    if (user) {render(user); loadData();}
  });
  window.BloxzuhSellerSettings = {open:function (id) {if (['dados','verificacoes','seguranca'].indexOf(id) >= 0) {var user = me(); if (user) render(user); if (id === 'dados') loadData();}}};
})();
