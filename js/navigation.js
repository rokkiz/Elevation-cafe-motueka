(() => {
  'use strict';

  const drawer = document.querySelector('#site-navigation');
  const popup = document.querySelector('#navigation-dialog');
  const trigger = document.querySelector('#open-navigation');
  const content = popup.querySelector('.navigation-dialog-scroll');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let previousOverflow = '';
  let pageLocked = false;
  let handingOff = false;
  let closingMenu = null;
  let closingPopup = null;
  let restoreMenuFocus = true;
  let restorePopupFocus = true;

  function markCurrent(item) {
    if (!item) return;
    drawer.querySelectorAll('.navigation-links [aria-current]').forEach(link => link.removeAttribute('aria-current'));
    item.setAttribute('aria-current', item.matches('a') ? 'page' : 'true');
  }

  function lockPage() {
    if (!pageLocked) previousOverflow = document.body.style.overflow;
    pageLocked = true;
    document.body.style.overflow = 'hidden';
  }

  function unlockPage() {
    if (drawer.open || popup.open || handingOff || !pageLocked) return;
    document.body.style.overflow = previousOverflow;
    pageLocked = false;
  }

  async function finishClosing(dialog) {
    dialog.classList.add('is-closing');
    if (!motion.matches) await Promise.all(dialog.getAnimations().map(animation => animation.finished.catch(() => {})));
    dialog.close();
  }

  function openMenu() {
    if (drawer.open || popup.open || closingMenu || handingOff) return;
    restoreMenuFocus = true;
    lockPage();
    trigger.setAttribute('aria-expanded', 'true');
    drawer.showModal();
    drawer.querySelector('.navigation-body').scrollTop = 0;
  }

  function closeMenu(restoreFocus = true) {
    if (closingMenu) return closingMenu;
    if (!drawer.open) return Promise.resolve();
    restoreMenuFocus = restoreFocus;
    closingMenu = finishClosing(drawer).finally(() => { closingMenu = null; });
    return closingMenu;
  }

  function closeContent(restoreFocus = true) {
    if (closingPopup) return closingPopup;
    if (!popup.open) return Promise.resolve();
    restorePopupFocus = restoreFocus;
    closingPopup = finishClosing(popup).finally(() => { closingPopup = null; });
    return closingPopup;
  }

  async function openContent(name) {
    const template = document.querySelector(`#navigation-${name}`);
    if (!(template instanceof HTMLTemplateElement) || handingOff || closingPopup) return;
    markCurrent(drawer.querySelector(`[data-navigation-view="${name}"]`));
    handingOff = true;
    lockPage();
    try {
      await closeMenu(false);
      popup.dataset.view = name;
      content.replaceChildren(template.content.cloneNode(true));
      const date = content.querySelector('input[type="date"]');
      if (date) {
        const now = new Date();
        date.min = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
      const alreadyOpen = popup.open;
      if (!alreadyOpen) {
        restorePopupFocus = true;
        popup.showModal();
      }
      content.scrollTop = 0;
      content.querySelector('h2').focus({preventScroll: true});
      if (alreadyOpen && !motion.matches) content.animate([{opacity: 0, transform: 'translateY(6px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 180, easing: 'ease-out'});
    } finally {
      handingOff = false;
      unlockPage();
    }
  }

  async function navigate(event) {
    if (closingMenu || closingPopup || handingOff) return;
    const item = event.target.closest('[data-navigation-view]');
    if (item) {
      event.preventDefault();
      await openContent(item.dataset.navigationView);
      return;
    }
    const link = event.target.closest('[data-navigation-target]');
    if (!link) return;
    event.preventDefault();
    markCurrent(drawer.querySelector(`[data-navigation-target="${link.dataset.navigationTarget}"]`));
    await Promise.all([closeMenu(false), closeContent(false)]);
    const home = link.dataset.navigationTarget === 'home';
    const destination = home ? document.querySelector('.brand') : document.querySelector('#thuc-don');
    if (home) window.scrollTo({top: 0, behavior: motion.matches ? 'instant' : 'smooth'});
    else destination.scrollIntoView({behavior: motion.matches ? 'instant' : 'smooth', block: 'start'});
    (home ? destination : destination.querySelector('.dish-card'))?.focus({preventScroll: true});
  }

  document.querySelector('.site-footer').addEventListener('click', navigate);
  trigger.addEventListener('click', openMenu);
  document.querySelector('#close-navigation').addEventListener('click', () => closeMenu());
  document.querySelector('#close-navigation-dialog').addEventListener('click', () => closeContent());
  for (const [dialog, close] of [[drawer, closeMenu], [popup, closeContent]]) {
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) {
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      } else navigate(event);
    });
    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-closing');
      if (dialog === drawer) trigger.setAttribute('aria-expanded', 'false');
      unlockPage();
      const restore = dialog === drawer ? restoreMenuFocus : restorePopupFocus;
      if (restore && !handingOff && !drawer.open && !popup.open) trigger.focus({preventScroll: true});
    });
  }

  document.querySelectorAll('[data-navigation-view]').forEach(button => {
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', 'navigation-dialog');
  });
  popup.addEventListener('submit', event => {
    const form = event.target.closest('[data-navigation-form]');
    if (!form) return;
    event.preventDefault();
    const status = form.querySelector('.navigation-form-status');
    status.hidden = false;
    status.textContent = 'Đây là bản demo. Thông tin của bạn chưa được gửi đến nhà hàng.';
  });
})();
