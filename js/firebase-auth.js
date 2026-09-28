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

function saveUser(user) {
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
  localStorage.setItem('xinzuh-login-method', 'google');
}

async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    // Popup funciona melhor no desktop; no celular tenta popup e cai para redirect
    const result = await auth.signInWithPopup(provider);
    saveUser(result.user);
    window.location.href = 'index.html';
  } catch (err) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      try {
        await auth.signInWithRedirect(provider);
      } catch (e2) {
        alert('Não foi possível abrir o login do Google. Tente novamente.\\n' + (e2.message || ''));
      }
    } else if (err.code === 'auth/unauthorized-domain') {
      alert('Domínio não autorizado no Firebase.\\nAdicione bloxzuh.store e xinzuhgamer.pages.dev em Authentication → Domínios autorizados.');
    } else {
      alert('Erro no login: ' + (err.message || err.code));
      console.error(err);
    }
  }
}

async function handleRedirectResult() {
  try {
    const result = await auth.getRedirectResult();
    if (result && result.user) {
      saveUser(result.user);
      window.location.href = 'index.html';
    }
  } catch (err) {
    if (err.code === 'auth/unauthorized-domain') {
      alert('Domínio não autorizado no Firebase. Adicione seu domínio em Authentication → Domínios autorizados.');
    }
    console.error(err);
  }
}

function logoutFirebase() {
  auth.signOut().then(() => {
    saveUser(null);
    window.location.href = 'index.html';
  });
}

// Escuta mudanças de login
auth.onAuthStateChanged((user) => {
  if (user) saveUser(user);
});

// Processa retorno do redirect (mobile)
handleRedirectResult();
