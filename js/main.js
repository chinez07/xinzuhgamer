// ===== Theme & Mode =====
const themeToggle = document.getElementById('themeToggle');
const themeDropdown = document.getElementById('themeDropdown');
const themeOptions = document.querySelectorAll('.theme-option[data-theme]');
const modeToggle = document.getElementById('modeToggle');
const modeToggleMenu = document.getElementById('modeToggleMenu');

const savedTheme = localStorage.getItem('xinzuh-theme') || 'purple';
const savedMode = localStorage.getItem('xinzuh-mode') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
document.documentElement.setAttribute('data-mode', savedMode);
updateActiveTheme(savedTheme);

if (themeToggle) {
  themeToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (themeDropdown) themeDropdown.classList.toggle('show');
    const um = document.getElementById('userMenuDropdown');
    if (um) um.classList.remove('show');
  });
}

themeOptions.forEach(option => {
  option.addEventListener('click', () => {
    const theme = option.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('xinzuh-theme', theme);
    updateActiveTheme(theme);
    if (themeDropdown) themeDropdown.classList.remove('show');
  });
});

function updateActiveTheme(theme) {
  themeOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
}

function toggleMode() {
  const current = document.documentElement.getAttribute('data-mode');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-mode', next);
  localStorage.setItem('xinzuh-mode', next);
  updateModeLabels(next);
}

function updateModeLabels(mode) {
  document.querySelectorAll('[data-mode-label]').forEach(el => {
    el.textContent = mode === 'dark' ? 'Tema claro' : 'Tema escuro';
  });
  document.querySelectorAll('[data-mode-icon]').forEach(el => {
    el.className = mode === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  });
}
updateModeLabels(savedMode);

// ===== Login state (mock) =====
let isLoggedIn = localStorage.getItem('xinzuh-logged') === 'true';
const userName = localStorage.getItem('xinzuh-username') || 'Jogador';

function renderUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  if (!dropdown) return;

  if (isLoggedIn) {
    dropdown.innerHTML = `
      <div class="user-menu-header">
        <strong>Olá, ${userName}!</strong>
        <span>VER MINHA CONTA</span>
      </div>
      <button class="user-menu-item"><i class="fas fa-shopping-bag"></i> Minhas Compras</button>
      <a href="painel.html" class="user-menu-item"><i class="fas fa-store"></i> Minhas Vendas</a>
      <a href="painel.html" class="user-menu-item"><i class="fas fa-chart-line"></i> Painel do Vendedor</a>
      <button class="user-menu-item"><i class="fas fa-heart"></i> Meus Favoritos</button>
      <button class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</button>
      <button class="user-menu-item"><i class="fas fa-bullhorn"></i> Atualizações</button>
      <button class="user-menu-item" onclick="toggleMode()">
        <i data-mode-icon class="${document.documentElement.getAttribute('data-mode') === 'dark' ? 'fas fa-sun' : 'fas fa-moon'}"></i>
        <span data-mode-label>${document.documentElement.getAttribute('data-mode') === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
      </button>
      <div class="user-menu-divider"></div>
      <div class="user-menu-item" style="justify-content:space-between;cursor:default">
        <span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>
        <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
      </div>
      <div class="user-menu-divider"></div>
      <button class="user-menu-item" style="color:#ef4444" onclick="doLogout()">
        <i class="fas fa-sign-out-alt"></i> Sair
      </button>
    `;
  } else {
    dropdown.innerHTML = `
      <a href="login.html" class="user-menu-item">
        <i class="fas fa-sign-in-alt"></i> Entrar
      </a>
      <a href="cadastro.html" class="user-menu-item">
        <i class="fas fa-user-plus"></i> Criar conta
      </a>
      <button class="user-menu-item"><i class="fas fa-question-circle"></i> Central de ajuda</button>
      <button class="user-menu-item" onclick="toggleMode()">
        <i data-mode-icon class="${document.documentElement.getAttribute('data-mode') === 'dark' ? 'fas fa-sun' : 'fas fa-moon'}"></i>
        <span data-mode-label>${document.documentElement.getAttribute('data-mode') === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
      </button>
      <div class="user-menu-divider"></div>
      <div class="user-menu-item" style="justify-content:space-between;cursor:default">
        <span style="display:flex;align-items:center;gap:10px"><i class="fas fa-flask"></i> Versão experimental</span>
        <label class="switch"><input type="checkbox"><span class="slider"></span></label>
      </div>
    `;
  }
}

function doLogin() {
  window.location.href = 'login.html';
}

function doLogout() {
  localStorage.setItem('xinzuh-logged', 'false');
  isLoggedIn = false;
  renderUserMenu();
  const um = document.getElementById('userMenuDropdown');
  if (um) um.classList.remove('show');
}

// expose for onclick
window.doLogin = doLogin;
window.doLogout = doLogout;
window.toggleMode = toggleMode;

renderUserMenu();

// ===== User Menu toggle =====
const userMenuBtn = document.getElementById('userMenuBtn');
const userMenuDropdown = document.getElementById('userMenuDropdown');

if (userMenuBtn) {
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (userMenuDropdown) userMenuDropdown.classList.toggle('show');
    if (themeDropdown) themeDropdown.classList.remove('show');
  });
}

document.addEventListener('click', () => {
  if (themeDropdown) themeDropdown.classList.remove('show');
  if (userMenuDropdown) userMenuDropdown.classList.remove('show');
});

// ===== Scroll helpers =====
function scrollCats(dir) {
  const el = document.getElementById('catsScroll');
  if (el) el.scrollBy({ left: dir * 150, behavior: 'smooth' });
}
function scrollProds(id, dir) {
  const el = document.getElementById(id + 'Scroll');
  if (el) el.scrollBy({ left: dir * 280, behavior: 'smooth' });
}
window.scrollCats = scrollCats;
window.scrollProds = scrollProds;

// ===== Product card =====
function createProductCard(ad) {
  const initial = ad.seller.charAt(0).toUpperCase();
  return `
    <a href="anuncio.html?id=${ad.id}" class="product-card">
      <div class="product-img ${ad.imgClass || 'prod-default'}">
        <i class="${ad.icon.includes('fa-') ? (ad.icon.startsWith('fab') ? 'fab' : 'fas') : 'fas'} ${ad.icon.replace('fab ', '').replace('fas ', '')}"></i>
        <button class="fav" onclick="event.preventDefault();event.stopPropagation();">
          <i class="far fa-heart"></i>
        </button>
      </div>
      <div class="product-body">
        <h3>${ad.title}</h3>
        <div class="product-price">R$ ${ad.price.toFixed(2).replace('.', ',')}</div>
        <div class="product-seller">
          <span class="avatar">${initial}</span>
          ${ad.seller}
          <span class="rating"><i class="fas fa-star"></i> ${ad.rating}</span>
          <span>(${ad.sales})</span>
        </div>
      </div>
    </a>
  `;
}

// Home sections
const premiumScroll = document.getElementById('premiumScroll');
if (premiumScroll) {
  premiumScroll.innerHTML = adsData.filter(a => a.category === 'premium').map(createProductCard).join('');
}
const featuredScroll = document.getElementById('featuredScroll');
if (featuredScroll) {
  featuredScroll.innerHTML = adsData.filter(a => a.category !== 'premium').slice(0, 6).map(createProductCard).join('');
}

// ===== Anúncios filters =====
const adsListContainer = document.getElementById('adsList');
const resultsCount = document.getElementById('resultsCount');
const categoryFilter = document.getElementById('categoryFilter');
const sortFilter = document.getElementById('sortFilter');
const priceMin = document.getElementById('priceMin');
const priceMax = document.getElementById('priceMax');
const searchFilter = document.getElementById('searchFilter');

function applyFilters() {
  if (!adsListContainer) return;
  let filtered = [...adsData];

  const urlParams = new URLSearchParams(window.location.search);
  const catFromUrl = urlParams.get('cat');
  if (catFromUrl && categoryFilter) categoryFilter.value = catFromUrl;

  const cat = categoryFilter ? categoryFilter.value : '';
  if (cat && cat !== 'all') filtered = filtered.filter(ad => ad.category === cat);

  const min = priceMin && priceMin.value ? parseFloat(priceMin.value) : 0;
  const max = priceMax && priceMax.value ? parseFloat(priceMax.value) : Infinity;
  filtered = filtered.filter(ad => ad.price >= min && ad.price <= max);

  const search = searchFilter ? searchFilter.value.toLowerCase() : '';
  if (search) {
    filtered = filtered.filter(ad =>
      ad.title.toLowerCase().includes(search) ||
      ad.categoryLabel.toLowerCase().includes(search) ||
      ad.seller.toLowerCase().includes(search)
    );
  }

  const sort = sortFilter ? sortFilter.value : 'relevance';
  if (sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  else if (sort === 'sales') filtered.sort((a, b) => b.sales - a.sales);

  adsListContainer.innerHTML = filtered.length
    ? filtered.map(createProductCard).join('')
    : '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">Nenhum anúncio encontrado.</p>';

  if (resultsCount) {
    resultsCount.textContent = `${filtered.length} anúncio${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`;
  }
}

[categoryFilter, sortFilter, priceMin, priceMax, searchFilter].forEach(el => {
  if (el) {
    el.addEventListener('change', applyFilters);
    el.addEventListener('input', applyFilters);
  }
});
if (adsListContainer) applyFilters();

// ===== Ad detail =====
const adDetailContainer = document.getElementById('adDetail');
if (adDetailContainer) {
  const urlParams = new URLSearchParams(window.location.search);
  const adId = parseInt(urlParams.get('id'));
  const ad = adsData.find(a => a.id === adId);

  if (ad) {
    const iconClass = ad.icon.includes('fab') ? 'fab' : 'fas';
    const iconName = ad.icon.replace('fab ', '').replace('fas ', '');
    adDetailContainer.innerHTML = `
      <div class="ad-detail-grid">
        <div>
          <div class="ad-gallery ${ad.imgClass || ''}">
            <i class="${iconClass} ${iconName}" style="font-size:4.5rem;color:#fff"></i>
          </div>
          <div class="ad-info">
            <div class="cat-label">${ad.categoryLabel}</div>
            <h1>${ad.title}</h1>
            <div class="price">R$ ${ad.price.toFixed(2).replace('.', ',')}</div>
            <p class="description">${ad.description}</p>
            <h3 style="margin-bottom:10px;font-size:1rem">Detalhes</h3>
            <ul style="color:var(--text-muted);line-height:2;font-size:0.95rem;list-style:none">
              <li><strong>Categoria:</strong> ${ad.categoryLabel}</li>
              <li><strong>Vendedor:</strong> ${ad.seller}</li>
              <li><strong>Avaliação:</strong> ${ad.rating} ⭐ (${ad.sales} vendas)</li>
              <li><strong>Entrega:</strong> Via chat da plataforma</li>
            </ul>
          </div>
        </div>
        <div class="ad-sidebar">
          <div class="seller-card">
            <div class="seller-avatar"><i class="fas fa-user"></i></div>
            <div class="seller-info">
              <h4>${ad.seller}</h4>
              <span><i class="fas fa-star" style="color:var(--warning)"></i> ${ad.rating} · ${ad.sales} vendas</span>
            </div>
          </div>
          <button class="btn btn-primary btn-lg buy-btn"><i class="fas fa-shopping-cart"></i> Comprar Agora</button>
          <button class="btn btn-outline" style="width:100%;margin-bottom:12px"><i class="fas fa-comments"></i> Falar com Vendedor</button>
          <div class="guarantee"><i class="fas fa-shield-alt"></i> Compra 100% protegida</div>
        </div>
      </div>
    `;
  } else {
    adDetailContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px">
        <h2>Anúncio não encontrado</h2>
        <p style="color:var(--text-muted);margin:16px 0 24px">O anúncio que você procura não existe ou foi removido.</p>
        <a href="anuncios.html" class="btn btn-primary">Ver todos os anúncios</a>
      </div>
    `;
  }
}
