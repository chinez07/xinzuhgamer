// Favoritos Bloxzuh (por conta no navegador)
function getFavIds() {
  try {
    return JSON.parse(localStorage.getItem('bloxzuh-favs') || '[]').map(String);
  } catch (e) {
    return [];
  }
}
function setFavIds(ids) {
  localStorage.setItem('bloxzuh-favs', JSON.stringify(ids.map(String)));
}
function isFav(id) {
  return getFavIds().indexOf(String(id)) >= 0;
}
function toggleFav(id, btnEl) {
  id = String(id);
  var favs = getFavIds();
  var i = favs.indexOf(id);
  var on;
  if (i >= 0) {
    favs.splice(i, 1);
    on = false;
  } else {
    favs.push(id);
    on = true;
  }
  setFavIds(favs);
  updateAllFavButtons(id, on);
  if (btnEl) applyFavBtn(btnEl, on);
  return on;
}
function applyFavBtn(btn, on) {
  if (!btn) return;
  btn.classList.toggle('is-fav', !!on);
  var icon = btn.querySelector('i');
  if (icon) {
    icon.className = on ? 'fas fa-heart' : 'far fa-heart';
  }
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
}
function updateAllFavButtons(id, on) {
  document.querySelectorAll('.fav[data-id="' + id + '"], .fav-btn[data-id="' + id + '"]').forEach(function (b) {
    applyFavBtn(b, on);
  });
}
function syncFavButtonsIn(rootEl) {
  var root = rootEl || document;
  root.querySelectorAll('.fav[data-id], .fav-btn[data-id]').forEach(function (b) {
    applyFavBtn(b, isFav(b.getAttribute('data-id')));
  });
}
window.getFavIds = getFavIds;
window.isFav = isFav;
window.toggleFav = toggleFav;
window.syncFavButtonsIn = syncFavButtonsIn;
