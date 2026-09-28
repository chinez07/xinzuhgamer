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
  localStorage.setItem('xinzuh-username', user.displayName || user.email?.split('@')[0] || 'Jogador');
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
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase. Adicione bloxzuh.store em Domínios autorizados.',
  };
  return map[err.code] || (err.message || 'Erro desconhecido');
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
        alert(friendlyError(e2));
      }
    } else {
      alert(friendlyError(err));
      console.error(err);
    }
  }
}

async function loginWithEmail(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email.trim(), password);
    saveUser(result.user, 'email');
    window.location.href = 'index.html';
  } catch (err) {
    alert(friendlyError(err));
    console.error(err);
  }
}

async function registerWithEmail(email, password, displayName) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email.trim(), password);
    if (displayName) {
      await result.user.updateProfile({ displayName: displayName.trim() });
    }
    saveUser(auth.currentUser, 'email');
    alert('Conta criada com sucesso!');
    window.location.href = 'index.html';
  } catch (err) {
    alert(friendlyError(err));
    console.error(err);
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
  auth.signOut().then(() => {
    saveUser(null);
    window.location.href = 'index.html';
  });
}

auth.onAuthStateChanged((user) => {
  if (user) saveUser(user, localStorage.getItem('xinzuh-login-method') || 'email');
});

handleRedirectResult();
