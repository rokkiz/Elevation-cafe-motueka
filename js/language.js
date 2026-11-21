(() => {
  'use strict';
  const dictionary = window.restaurantEnglish || {};
  const root = document.documentElement;
  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['aria-label', 'placeholder', 'alt', 'title', 'content'];
  const settings = window.restaurantSettings;
  const key = settings.storageNamespace + '-language';
  let language = settings.defaultLanguage === 'en' ? 'en' : 'vi';
  try {
    const saved = settings.rememberPreferences ? localStorage.getItem(key) : null;
    if (saved === 'en' || saved === 'vi') language = saved;
  } catch {}

  function english(source) {
    const parts = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
    let value = parts[2];
    if (Object.hasOwn(dictionary, value)) value = dictionary[value];
    else {
      const dishLabel = value.match(/^(.+), ([\d.]+) đồng$/);
      if (dishLabel) value = (dictionary[dishLabel[1]] || dishLabel[1]) + ', ' + dishLabel[2].replaceAll('.', ',') + ' VND';
      else if (/^Đang mở chi tiết /.test(value)) value = 'Opening ' + (dictionary[value.replace(/^Đang mở chi tiết /, '')] || value.replace(/^Đang mở chi tiết /, ''));
      else if (/^Đã bật giao diện /.test(value)) {
        const name = value.replace(/^Đã bật giao diện /, '').replace(/\.$/, '');
        value = 'Theme set to ' + (dictionary[name] || name) + '.';
      } else {
        value = value.replace(/^TRANG (\d+) \/ (\d+)$/, 'PAGE $1 / $2')
          .replace(/^Trang menu (\d+)$/, 'Menu page $1')
          .replace(/^(\d+) người$/, (_, count) => count === '1' ? '1 guest' : count + ' guests')
          .replace(/^(\d+[–-]\d+) phút$/, '$1 min')
          .replace(/(\d{1,3}(?:\.\d{3})+)\s*(đồng|đ)?/g, (_, number, unit) => number.replaceAll('.', ',') + (unit ? ' VND' : ''))
          .replace(/ \/ phần$/, ' / serving');
      }
    }
    return parts[1] + value + parts[3];
  }

  function text(node) {
    if (!node.nodeValue.trim() || node.parentElement?.closest('script, style, textarea, [data-language-option]')) return;
    let state = textSources.get(node);
    if (!state || node.nodeValue !== state.rendered) state = {source: node.nodeValue};
    const target = language === 'en' ? english(state.source) : state.source;
    if (node.nodeValue !== target) node.nodeValue = target;
    state.rendered = target;
    textSources.set(node, state);
  }

  function attribute(element, name) {
    if (!element.hasAttribute(name) || element.matches('script, style')) return;
    const value = element.getAttribute(name);
    const states = attributeSources.get(element) || {};
    let state = states[name];
    if (!state || value !== state.rendered) state = {source: value};
    const target = language === 'en' ? english(state.source) : state.source;
    if (value !== target) element.setAttribute(name, target);
    state.rendered = target;
    states[name] = state;
    attributeSources.set(element, states);
  }

  function translate(node) {
    if (node.nodeType === Node.TEXT_NODE) { text(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || node.matches('script, style')) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) text(walker.currentNode);
    for (const element of [node, ...node.querySelectorAll('[aria-label], [placeholder], [alt], [title], meta[content]')]) {
      for (const name of attributes) attribute(element, name);
    }
  }

  function sync() {
    root.lang = language;
    document.querySelectorAll('[data-language-option]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.languageOption === language)));
    translate(root);
  }
  sync();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(translate);
      else if (record.type === 'characterData') text(record.target);
      else attribute(record.target, record.attributeName);
    }
  });
  observer.observe(root, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes});
  document.querySelector('.language-switcher').addEventListener('click', event => {
    const button = event.target.closest('[data-language-option]');
    if (!button || button.dataset.languageOption === language) return;
    language = button.dataset.languageOption;
    try { if (settings.rememberPreferences) localStorage.setItem(key, language); } catch {}
    sync();
  });
})();
