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
    alert('Entre na sua conta para usar a versão experimental.');
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

// Menu unificado Bloxzuh
function getLoggedIn() {
  return localStorage.getItem('xinzuh-logged') === 'true';
}
function getUserName() {
  return localStorage.getItem('xinzuh-username') || 'Jogador';
}

function renderUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  if (!dropdown) return;
  const isLoggedIn = getLoggedIn();
  const userName = getUserName();
  const mode = document.documentElement.getAttribute('data-mode') || localStorage.getItem('xinzuh-mode') || 'light';
  const modeIcon = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  const modeLabel = mode === 'dark' ? 'Tema claro' : 'Tema escuro';

  if (isLoggedIn) {
    dropdown.innerHTML =
      '<div class="user-menu-header" onclick="location.href=\'conta.html\'" style="cursor:pointer">' +
        '<strong>Olá, ' + userName + '!</strong>' +
        '<span>VER MINHA CONTA</span>' +
      '</div>' +
      '<a href="compras.html" class="user-menu-item"><i class="fas fa-shopping-bag"></i> Minhas Compras</a>' +
      '<a href="vendas.html" class="user-menu-item"><i class="fas fa-store"></i> Minhas Vendas</a>' +
      '<a href="painel.html" class="user-menu-item"><i class="fas fa-chart-line"></i> Painel do Vendedor</a>' +
      '<a href="conta.html" class="user-menu-item"><i class="fas fa-user-cog"></i> Minha conta</a>' +
      '<a href="notificacoes.html" class="user-menu-item"><i class="fas fa-bell"></i> Notificações</a>' +
      '<a href="favoritos.html" class="user-menu-item"><i class="fas fa-heart"></i> Meus Favoritos</a>' +
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</a>' +
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-bullhorn"></i> Atualizações</a>' +
      '<button type="button" class="user-menu-item" onclick="typeof toggleMode===\'function\' && toggleMode()">' +
        '<i data-mode-icon class="' + modeIcon + '"></i> ' +
        '<span data-mode-label>' + modeLabel + '</span>' +
      '</button>' +
      '<div class="user-menu-divider"></div>' +
      '<div class="user-menu-item" style="justify-content:space-between;cursor:default" onclick="event.stopPropagation()">' +
        '<span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>' +
        '<label class="switch"><input type="checkbox" id="expToggle" onchange="typeof setExperimental===\'function\' && setExperimental(this.checked)"><span class="slider"></span></label>' +
      '</div>' +
      '<div class="user-menu-divider"></div>' +
      '<button type="button" class="user-menu-item" style="color:#ef4444" onclick="doLogout()">' +
        '<i class="fas fa-sign-out-alt"></i> Sair' +
      '</button>';
    // sync experimental toggle if helper exists
    setTimeout(function () {
      var t = document.getElementById('expToggle');
      if (t && typeof isExperimental === 'function') t.checked = isExperimental();
    }, 0);
  } else {
    dropdown.innerHTML =
      '<a href="login.html" class="user-menu-item"><i class="fas fa-sign-in-alt"></i> Entrar</a>' +
      '<a href="cadastro.html" class="user-menu-item"><i class="fas fa-user-plus"></i> Criar conta</a>' +
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</a>' +
      '<button type="button" class="user-menu-item" onclick="typeof toggleMode===\'function\' && toggleMode()">' +
        '<i data-mode-icon class="' + modeIcon + '"></i> ' +
        '<span data-mode-label>' + modeLabel + '</span>' +
      '</button>' +
      '<div class="user-menu-divider"></div>' +
      '<div class="user-menu-item" style="justify-content:space-between;cursor:default" onclick="event.stopPropagation()">' +
        '<span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>' +
        '<label class="switch"><input type="checkbox" id="expToggle" onchange="typeof setExperimental===\'function\' && setExperimental(this.checked)"><span class="slider"></span></label>' +
      '</div>';
  }
}

function doLogin() {
  window.location.href = 'login.html';
}

function doLogout() {
  if (typeof logoutFirebase === 'function') {
    logoutFirebase();
    return;
  }
  localStorage.removeItem('xinzuh-logged');
  localStorage.removeItem('xinzuh-username');
  localStorage.removeItem('xinzuh-email');
  window.location.href = 'index.html';
}

window.renderUserMenu = renderUserMenu;
window.doLogin = doLogin;
window.doLogout = doLogout;
