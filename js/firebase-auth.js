// Firebase Auth - XinzuhGamer
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
    localStorage.removeItem('xinzuh-photo');
    localStorage.removeItem('xinzuh-login-method');
    return;
  }
  localStorage.setItem('xinzuh-logged', 'true');
  localStorage.setItem('xinzuh-username', user.displayName || (user.email ? user.email.split('@')[0] : 'Jogador'));
  localStorage.setItem('xinzuh-email', user.email || '');
  localStorage.setItem('xinzuh-photo', user.photoURL || '');
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
    el.style.cssText = 'margin:12px 0;padding:12px 14px;border-radius:10px;font-size:0.9rem;font-weight:500;';
    const form = document.querySelector('form');
    if (form) form.parentNode.insertBefore(el, form);
    else document.body.prepend(el);
  }
  el.style.background = type === 'ok' ? '#dcfce7' : '#fee2e2';
  el.style.color = type === 'ok' ? '#166534' : '#991b1b';
  el.textContent = text;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  const btn = document.querySelector('#btn-reset, form button[type="submit"]');
  if (btn) setLoading(btn, true);
  try {
    await auth.sendPasswordResetEmail(email.trim());
    showMsg('Enviamos um e-mail para redefinir sua senha. Confira a caixa de entrada e o spam.', 'ok');
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
