// Firebase Auth - Bloxzuh
const firebaseConfig = {
  apiKey: "AIzaSyCaBMtonCi3KKKCvr8MuaMbsNOC14960Is",
  authDomain: "xinzuhgamer-87ff5.firebaseapp.com",
  projectId: "xinzuhgamer-87ff5",
  storageBucket: "xinzuhgamer-87ff5.firebasestorage.app",
  messagingSenderId: "482705892945",
  appId: "1:482705892945:web:fd6c1d6db07b9164d9fa70",
  measurementId: "G-721FB02DQX"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

function saveUser(user, method) {
  if (!user) {
    localStorage.removeItem('xinzuh-logged');
    localStorage.removeItem('xinzuh-username');
    localStorage.removeItem('xinzuh-email');
    // não apaga foto local do uid
    localStorage.removeItem('xinzuh-login-method');
    return;
  }
  localStorage.setItem('xinzuh-logged', 'true');
  localStorage.setItem('xinzuh-username', user.displayName || (user.email ? user.email.split('@')[0] : 'Jogador'));
  localStorage.setItem('xinzuh-email', user.email || '');
  var custom = localStorage.getItem('xinzuh-photo-' + user.uid) || '';
  var isCustom = localStorage.getItem('xinzuh-photo-custom-' + user.uid) === '1';
  // Nunca sobrescreve foto que o usuário escolheu
  if (custom && (isCustom || custom.indexOf('data:') === 0)) {
    localStorage.setItem('xinzuh-photo', custom);
  } else if (custom) {
    localStorage.setItem('xinzuh-photo', custom);
  } else if (user.photoURL) {
    // só Google se ainda não tem custom
    localStorage.setItem('xinzuh-photo-' + user.uid, user.photoURL);
    localStorage.setItem('xinzuh-photo', user.photoURL);
  } else {
    localStorage.setItem('xinzuh-photo', '');
  }
  localStorage.setItem('xinzuh-login-method', method || 'email');
}

function friendlyError(err) {
  const map = {
    'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/user-not-found': 'Conta não encontrada. Crie uma conta primeiro.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
    'auth/network-request-failed': 'Erro de rede. Verifique a internet.',
    'auth/popup-blocked': 'Popup bloqueado pelo navegador.',
    'auth/popup-closed-by-user': 'Login cancelado.',
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase.',
    'auth/missing-email': 'Digite seu e-mail.',
    'auth/operation-not-allowed': 'Login por e-mail desativado no Firebase. Ative em Authentication → Método de login → E-mail/senha.',
  };
  return map[err.code] || (err.message || 'Erro desconhecido');
}

function showMsg(text, type) {
  let el = document.getElementById('auth-msg');
  if (!el) {
    el = document.createElement('div');
    el.id = 'auth-msg';
    const card = document.querySelector('.auth-card') || document.querySelector('form')?.parentNode;
    if (card) card.insertBefore(el, card.firstChild.nextSibling || card.firstChild);
    else document.body.prepend(el);
  }
  el.style.cssText = 'display:block;margin:0 0 16px;padding:14px 16px;border-radius:10px;font-size:0.95rem;font-weight:600;line-height:1.4;';
  if (type === 'ok') {
    el.style.background = '#dcfce7';
    el.style.color = '#166534';
    el.style.border = '1px solid #86efac';
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.style.border = '1px solid #fca5a5';
  }
  el.textContent = text;
  try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {}
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.oldText = btn.dataset.oldText || btn.textContent;
  btn.textContent = loading ? 'Aguarde...' : btn.dataset.oldText;
}

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const result = await auth.signInWithPopup(provider);
    saveUser(result.user, 'google');
    window.location.href = 'index.html';
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      try {
        await auth.signInWithRedirect(provider);
      } catch (e2) {
        showMsg(friendlyError(e2), 'err');
      }
    } else {
      showMsg(friendlyError(err), 'err');
      console.error(err);
    }
  }
}

async function loginWithEmail(email, password) {
  const btn = document.querySelector('form button[type="submit"]');
  setLoading(btn, true);
  try {
    const result = await auth.signInWithEmailAndPassword(email.trim(), password);
    saveUser(result.user, 'email');
    showMsg('Login ok! Redirecionando...', 'ok');
    window.location.href = 'index.html';
  } catch (err) {
    showMsg(friendlyError(err), 'err');
    console.error(err);
    setLoading(btn, false);
  }
}

async function registerWithEmail(email, password, displayName) {
  const btn = document.querySelector('form button[type="submit"]');
  setLoading(btn, true);
  try {
    const result = await auth.createUserWithEmailAndPassword(email.trim(), password);
    if (displayName) {
      try {
        await result.user.updateProfile({ displayName: displayName.trim() });
      } catch (e) {
        console.warn('updateProfile', e);
      }
    }
    saveUser(auth.currentUser || result.user, 'email');
    showMsg('Conta criada com sucesso! Entrando...', 'ok');
    setTimeout(function () { window.location.href = 'index.html'; }, 800);
  } catch (err) {
    showMsg(friendlyError(err), 'err');
    console.error(err);
    setLoading(btn, false);
  }
}


async function resetPasswordWithEmail(email) {
  const btn = document.getElementById('btn-reset');
  if (!email || !String(email).trim()) {
    showMsg('Coloque o e-mail primeiro.', 'err');
    return;
  }
  if (btn) setLoading(btn, true);
  try {
    const em = email.trim();
    await auth.sendPasswordResetEmail(em, {
      url: 'https://bloxzuh.store/login.html',
      handleCodeInApp: false
    });
    showMsg('Se existir conta com ' + em + ', enviamos o link. Confira a caixa de entrada e a pasta SPAM/Lixo eletrônico. O e-mail pode demorar alguns minutos.', 'ok');
  } catch (err) {
    showMsg(friendlyError(err), 'err');
    console.error(err);
  } finally {
    if (btn) setLoading(btn, false);
  }
}

async function handleRedirectResult() {
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      saveUser(result.user, 'google');
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error(err);
  }
}

function logoutFirebase() {
  auth.signOut().then(function () {
    saveUser(null);
    window.location.href = 'index.html';
  });
}

auth.onAuthStateChanged(function (user) {
  if (user) saveUser(user, localStorage.getItem('xinzuh-login-method') || 'email');
});

handleRedirectResult();


async function updateDisplayName(name) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login primeiro.');
  await user.updateProfile({ displayName: name.trim() });
  saveUser(auth.currentUser, localStorage.getItem('xinzuh-login-method') || 'email');
}

async function updateUserPassword(newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login primeiro.');
  await user.updatePassword(newPassword);
}

async function uploadProfilePhoto(file) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login primeiro.');
  if (!file) throw new Error('Escolha uma imagem.');
  if (!file.type.startsWith('image/')) throw new Error('Envie uma imagem (JPG, PNG, etc).');
  if (file.size > 5 * 1024 * 1024) throw new Error('Imagem no máximo 5 MB.');

  const dataUrl = await new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const img = new Image();
      img.onload = function () {
        const max = 280;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = function () { reject(new Error('Não foi possível ler a imagem.')); };
      img.src = reader.result;
    };
    reader.onerror = function () { reject(new Error('Falha ao ler o arquivo.')); };
    reader.readAsDataURL(file);
  });

  try {
    localStorage.setItem('xinzuh-photo-' + user.uid, dataUrl);
    localStorage.setItem('xinzuh-photo', dataUrl);
    localStorage.setItem('xinzuh-photo-custom-' + user.uid, '1');
  } catch (e) {
    throw new Error('Espaço insuficiente no navegador. Use uma imagem menor.');
  }
  return dataUrl;
}


function getLocalPhoto(uid) {
  if (uid) {
    var p = localStorage.getItem('xinzuh-photo-' + uid);
    if (p) return p;
  }
  return '';
}

function getBio() {
  const user = auth.currentUser;
  if (!user) return '';
  return localStorage.getItem('xinzuh-bio-' + user.uid) || '';
}

function saveBio(text) {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login primeiro.');
  localStorage.setItem('xinzuh-bio-' + user.uid, text || '');
}

async function deactivateAccountLocal() {
  // Soft flag local + sign out (exclusão real exige reauth e delete())
  const user = auth.currentUser;
  if (!user) return;
  localStorage.setItem('xinzuh-deactivated-' + user.uid, '1');
  await auth.signOut();
  saveUser(null);
  window.location.href = 'index.html';
}
