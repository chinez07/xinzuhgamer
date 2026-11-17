// JavaScript / profile-theme.js / navegadores atuais / aparência do perfil MAX.
(function () {
  'use strict';
  function start() {
    var page = document.getElementById('page');
    if (!page) return;
    var active = false, ownerUid = '';
    function ownerLink() {
      var link = document.getElementById('profileCustomize'), user = firebase.auth().currentUser;
      if (link) link.hidden = !(active && user && user.uid === ownerUid);
    }
    function load() {
      var hero = page.querySelector('.profile-hero'), marker = page.querySelector('[data-max-profile]');
      if (!hero || !marker) return false;
      ownerUid = marker.getAttribute('data-max-profile');
      BloxzuhMax.publicMember(ownerUid, false, true).then(function (member) {
        if (!hero.isConnected || !member.active) return;
        active = true;
        BloxzuhStoreTheme.apply(document.body, member.theme);
        document.body.classList.add('profile-max-active');
        ownerLink();
      }).catch(function () {});
      return true;
    }
    firebase.auth().onAuthStateChanged(ownerLink);
    if (load()) return;
    var observer = new MutationObserver(function () {if (load()) observer.disconnect();});
    observer.observe(page, {childList: true, subtree: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
