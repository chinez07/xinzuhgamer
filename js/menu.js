// Menu unificado Bloxzuh
// (versão experimental: usa window.setExperimental / isExperimental do experimental.js)

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
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</a>' +
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-bullhorn"></i> Atualizações</a>' +
      '<div class="user-menu-divider"></div>' +
      '<div class="user-menu-item" style="justify-content:space-between;cursor:default" onclick="event.stopPropagation()">' +
        '<span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>' +
        '<label class="switch"><input type="checkbox" id="expToggle" onchange="window.setExperimental && window.setExperimental(this.checked)"><span class="slider"></span></label>' +
      '</div>' +
      '<div class="user-menu-divider"></div>' +
      '<button type="button" class="user-menu-item" style="color:#ef4444" onclick="doLogout()">' +
        '<i class="fas fa-sign-out-alt"></i> Sair' +
      '</button>';
    setTimeout(function () {
      var t = document.getElementById('expToggle');
      if (t && typeof window.isExperimental === 'function') t.checked = !!window.isExperimental();
    }, 0);
  } else {
    dropdown.innerHTML =
      '<a href="login.html" class="user-menu-item"><i class="fas fa-sign-in-alt"></i> Entrar</a>' +
      '<a href="cadastro.html" class="user-menu-item"><i class="fas fa-user-plus"></i> Criar conta</a>' +
      '<a href="anuncios.html" class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</a>' +
      '<div class="user-menu-divider"></div>' +
      '<div class="user-menu-item" style="justify-content:space-between;cursor:default" onclick="event.stopPropagation()">' +
        '<span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>' +
        '<label class="switch"><input type="checkbox" id="expToggle" onchange="window.setExperimental && window.setExperimental(this.checked)"><span class="slider"></span></label>' +
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
