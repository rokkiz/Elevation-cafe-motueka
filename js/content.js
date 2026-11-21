(() => {
  'use strict';
  const settings = window.restaurantSettings;
  const dictionary = window.restaurantEnglish;
  function prepare(value) {
    if (Array.isArray(value)) return value.map(prepare);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.vi === 'string') {
      if (typeof value.en === 'string') dictionary[value.vi] = value.en;
      return value.vi;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, prepare(item)]));
  }
  const content = prepare(window.restaurantContent);
  window.restaurantMenu = prepare(window.restaurantMenu);
  const set = (selector, value, parent = document) => {
    const element = parent.querySelector(selector);
    if (element) element.textContent = value;
    return element;
  };
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function lines(node, values) {
    node.replaceChildren();
    values.forEach((value, index) => {
      if (index) node.append(document.createElement('br'));
      node.append(document.createTextNode(value));
    });
  }
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(content.restaurant.mapQuery || content.restaurant.address);
  const phoneUrl = 'tel:' + content.restaurant.phone.replace(/[^+\d]/g, '');
  function contactLink(node, text, href) {
    node.textContent = text;
    node.href = href;
    node.hidden = !text;
  }

  document.title = content.site.title;
  document.querySelector('meta[name="description"]').content = content.site.description;
  document.querySelectorAll('.brand-logo, .navigation-logo, .footer-logo').forEach(img => {
    img.src = content.site.logo;
    img.alt = content.site.logoAlt;
  });
  const homeLabel = content.site.name + ' — ' + content.navigation.home;
  dictionary[homeLabel] = content.site.name + ' — ' + (dictionary[content.navigation.home] || content.navigation.home);
  document.querySelectorAll('.brand, .footer-logo-link').forEach(link => link.setAttribute('aria-label', homeLabel));
  set('.header-note', content.header.note);
  const { photo, welcome, ...navigationLabels } = content.navigation;
  set('#navigation-title', welcome);
  const navigationPhoto = document.querySelector('.navigation-photo');
  if (photo) navigationPhoto.src = photo;
  else navigationPhoto.hidden = true;
  const navigationLinks = document.querySelector('.navigation-links');
  const footerNavigation = document.querySelector('.footer-navigation');
  for (const [key, value] of Object.entries(navigationLabels)) {
    const selector = `:is([data-navigation-view="${key}"], [data-navigation-target="${key}"])`;
    set(`${selector} > span`, value, navigationLinks);
    set(selector, value, footerNavigation);
  }
  set('.navigation-info-hours > span', content.restaurant.hoursSummary);
  set('.navigation-address > span', content.restaurant.address);
  document.querySelector('.navigation-address').href = mapUrl;
  set('.table-kicker', content.hero.kicker);
  lines(document.querySelector('.table-caption b'), content.hero.title);
  lines(document.querySelector('.table-caption p'), content.hero.description);
  lines(document.querySelector('#explore-dish > span'), content.hero.button);
  set('.orbit-hint > p', content.hero.hint);
  document.querySelector('.theme-switcher').hidden = !settings.showThemeSwitcher;
  document.querySelector('.language-switcher').hidden = !settings.showLanguageSwitcher;

  const about = content.pages.about;
  const article = element('article', undefined, 'about-article');
  const header = element('header');
  const title = element('h2');
  title.id = 'navigation-view-title';
  title.tabIndex = -1;
  lines(title, about.title);
  header.append(element('p', about.kicker, 'navigation-kicker'), title, element('p', about.intro, 'about-lead'));
  article.append(header);
  let imageCount = 0;
  for (const block of about.blocks) {
    if (block.type === 'image') {
      const figure = element('figure', undefined, 'about-figure');
      const image = element('img');
      image.src = block.src;
      image.alt = block.alt;
      image.width = 1536;
      image.height = 1024;
      image.decoding = 'async';
      if (imageCount++) image.loading = 'lazy';
      figure.append(image, element('figcaption', block.caption));
      article.append(figure);
    } else if (block.type === 'quote') article.append(element('blockquote', block.text));
    else if (block.type === 'text') {
      const section = element('section');
      section.append(element('h3', block.heading), ...block.paragraphs.map(text => element('p', text)));
      article.append(section);
    }
  }
  const actions = element('div', undefined, 'about-actions');
  for (const [text, key, target, className] of [[about.menuButton, 'navigationTarget', 'menu', 'navigation-primary'], [about.reservationButton, 'navigationView', 'reservation', 'navigation-primary about-secondary']]) {
    const button = element('button', text, className);
    button.type = 'button';
    button.dataset[key] = target;
    actions.append(button);
  }
  article.append(actions);
  document.querySelector('#navigation-about').content.replaceChildren(article);

  for (const name of ['reservation', 'events', 'hours', 'contact']) {
    const page = content.pages[name];
    const template = document.querySelector('#navigation-' + name).content;
    set('.navigation-kicker', page.kicker, template);
    set('h2', page.title, template);
    set('p:not(.navigation-kicker)', page.intro, template);
    if (name === 'events') {
      const notes = template.querySelector('[data-event-notes]');
      for (const note of page.notes) {
        const node = element('div', undefined, 'navigation-note');
        const copy = element('div', undefined, 'navigation-note-copy');
        copy.append(element('h3', note.heading), element('p', note.text));
        if (note.image) {
          const image = element('img');
          image.src = note.image;
          image.alt = note.imageAlt || '';
          image.width = 1200;
          image.height = 800;
          image.loading = 'lazy';
          image.decoding = 'async';
          node.append(image);
        }
        if (note.features) {
          const list = element('ul', undefined, 'navigation-note-features');
          note.features.forEach(feature => list.append(element('li', feature)));
          copy.append(list);
        }
        if (note.button) {
          const button = element(note.href ? 'a' : 'button', note.button, 'navigation-primary venue-note-cta');
          if (note.href) button.href = note.href;
          else {
            button.type = 'button';
            button.dataset.navigationView = 'contact';
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-controls', 'navigation-dialog');
          }
          copy.append(button);
        }
        node.prepend(copy);
        notes.append(node);
      }
    }
    if (name === 'hours') {
      const list = template.querySelector('.navigation-hours');
      for (const row of page.rows) {
        const node = element('div');
        node.append(element('dt', row.label), element('dd', row.value));
        list.append(node);
      }
    }
    if (name === 'reservation') {
      const time = template.querySelector('input[name="time"]');
      time.min = settings.reservation.earliestTime;
      time.max = settings.reservation.latestTime;
      time.defaultValue = settings.reservation.defaultTime;
    }
  }

  set('.footer-description', content.footer.description);
  set('#footer-navigation-title', content.footer.navigationHeading);
  set('#footer-contact-title', content.footer.contactHeading);
  set('.footer-hours', content.restaurant.hoursSummary);
  set('.footer-address span', content.restaurant.address);
  document.querySelector('.footer-address').href = mapUrl;
  contactLink(document.querySelector('.footer-phone'), content.restaurant.phone, phoneUrl);
  contactLink(document.querySelector('.footer-email'), content.restaurant.email, 'mailto:' + content.restaurant.email);
  set('.footer-reservation', content.footer.reservationLabel);
  set('#footer-year', new Date().getFullYear());
  set('.footer-copyright', content.footer.copyright);
  set('.footer-top', content.footer.backToTop);
})();
