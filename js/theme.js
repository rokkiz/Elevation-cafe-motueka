(() => {
  'use strict';
  const settings = window.restaurantSettings;
  const key = settings.storageNamespace + '-theme';
  const root = document.documentElement;
  const themes = {cream: {label: 'Kem ấm', color: '#f5f1e8'}, forest: {label: 'Xanh đêm', color: '#081d16'}, burgundy: {label: 'Bordeaux', color: '#2b0d1b'}};
  const fallback = Object.hasOwn(themes, settings.defaultTheme) ? settings.defaultTheme : 'cream';
  let theme = fallback;
  root.dataset.table = settings.tableStyle === 'original' ? 'original' : 'walnut';
  try {
    const saved = settings.rememberPreferences ? localStorage.getItem(key) : null;
    if (Object.hasOwn(themes, saved)) theme = saved;
  } catch {}
  root.dataset.theme = theme;

  function sync() {
    document.querySelectorAll('[data-theme-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeOption === theme)));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[theme].color);
  }
  sync();
  function init() {
    sync();
    document.querySelector('#theme-toggle').addEventListener('click', event => {
      const button = event.target.closest('[data-theme-option]');
      if (!button || button.dataset.themeOption === theme) return;
      theme = button.dataset.themeOption;
      root.dataset.theme = theme;
      try { if (settings.rememberPreferences) localStorage.setItem(key, theme); } catch {}
      sync();
      document.querySelector('#theme-status').textContent = `Đã bật giao diện ${themes[theme].label}.`;
    });
    window.addEventListener('storage', event => {
      if (!settings.rememberPreferences || event.key !== key) return;
      theme = Object.hasOwn(themes, event.newValue) ? event.newValue : fallback;
      root.dataset.theme = theme;
      sync();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
