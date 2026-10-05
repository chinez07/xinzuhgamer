// Versão experimental - estado por conta (localStorage)
function expStorageKey() {
  var email = localStorage.getItem('xinzuh-email') || '';
  var name = localStorage.getItem('xinzuh-username') || 'guest';
  return 'xinzuh-exp-' + (email || name);
}
function isExperimental() {
  return localStorage.getItem(expStorageKey() + '-on') === '1';
}
function setExperimental(on) {
  var logged = localStorage.getItem('xinzuh-logged') === 'true';
  if (!logged) {
    if (typeof showToast==='function') showToast('Entre na sua conta para usar a versão experimental.'); else console.log('Entre na conta');
    var t = document.getElementById('expToggle');
    if (t) t.checked = false;
    return;
  }
  localStorage.setItem(expStorageKey() + '-on', on ? '1' : '0');
  var t2 = document.getElementById('expToggle');
  if (t2) t2.checked = !!on;
  if (typeof applyExperimentalBackground === 'function') {
    applyExperimentalBackground();
  }
  var btn = document.getElementById('bgChangeBtn');
  if (btn) btn.classList.toggle('show', !!on && logged);
}
window.isExperimental = isExperimental;
window.setExperimental = setExperimental;
window.expStorageKey = expStorageKey;
