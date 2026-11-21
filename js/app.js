(() => {
  "use strict";

  const {
    dishes,
    ingredientCatalog
  } = window.restaurantMenu;
  const settings = window.restaurantSettings;
  const initialDish = Math.max(0, Math.min(dishes.length - 1, Math.trunc(Number(settings.initialDish) || 0)));
  const maxQuantity = Math.max(1, Math.trunc(Number(settings.maxOrderQuantity) || 99));
  const wheel = document.querySelector('#wheel'),
    track = document.querySelector('#menu-track'),
    details = document.querySelector('#details'),
    pager = document.querySelector('#pager');
  const PAGE_SIZE = Math.max(2, Math.min(6, Math.trunc(Number(settings.itemsPerPage) || 4))),
    PAGE_COUNT = Math.ceil(dishes.length / PAGE_SIZE);
  const currencyFormatter = new Intl.NumberFormat('vi-VN');
  const formatPrice = n => currencyFormatter.format(n);
  document.documentElement.style.setProperty('--menu-columns', PAGE_SIZE);
  let selectedDishIndex = initialDish,
    menuPage = Math.floor(initialDish / PAGE_SIZE),
    tableTurn = 0;
  let detailState = "idle";
  const plates = Array.from({
    length: 4
  }, (_, i) => {
    const plate = document.createElement('div');
    plate.className = 'plate-position';
    plate.style.setProperty('--angle', `${i * 90}deg`);
    plate.setAttribute('aria-hidden', 'true');
    const img = new Image();
    img.src = dishes[(initialDish + i) % dishes.length].image;
    img.alt = '';
    img.draggable = false;
    plate.append(img);
    wheel.append(plate);
    return img;
  });
  function renderMenuPage() {
    track.replaceChildren();
    dishes.slice(menuPage * PAGE_SIZE, (menuPage + 1) * PAGE_SIZE).forEach((d, localIndex) => {
      const index = menuPage * PAGE_SIZE + localIndex,
        b = document.createElement('button');
      b.className = 'dish-card';
      b.type = 'button';
      b.dataset.index = index;
      b.setAttribute('aria-pressed', String(index === selectedDishIndex));
      b.setAttribute('aria-label', `${d.name}, ${formatPrice(d.price)} đồng`);
      const photo = document.createElement('img');
      photo.src = d.image;
      photo.alt = '';
      photo.draggable = false;
      const copy = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = d.name;
      const price = document.createElement('span');
      price.className = 'card-price';
      price.textContent = formatPrice(d.price) + ' đ';
      copy.append(name, price);
      b.append(photo, copy);
      b.addEventListener('click', () => {
        if (detailState !== 'idle' || menuAnimating) return;
        if (settings.scrollToTopOnSelect) window.scrollTo({top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
        selectDish(index);
      });
      track.append(b);
    });
    document.querySelector('#counter').textContent = `TRANG ${String(menuPage + 1).padStart(2, '0')} / ${String(PAGE_COUNT).padStart(2, '0')}`;
    [...pager.children].forEach((b, i) => {
      b.classList.toggle('active', i === menuPage);
      b.setAttribute('aria-current', i === menuPage ? 'page' : 'false');
    });
  }
  let menuAnimating = false;
  async function changeMenuPage(index, direction) {
    if (detailState !== 'idle' || menuAnimating) return;
    const nextPage = (index + PAGE_COUNT) % PAGE_COUNT;
    if (nextPage === menuPage) return;
    if (reducedMotion.matches) {
      menuPage = nextPage;
      renderMenuPage();
      return;
    }
    const sign = direction ?? (nextPage > menuPage ? 1 : -1);
    const controls = [document.querySelector('#previous'), document.querySelector('#next'), ...pager.children];
    const animations = [];
    menuAnimating = true;
    track.inert = true;
    track.setAttribute('aria-busy', 'true');
    controls.forEach(b => b.setAttribute('aria-disabled', 'true'));
    try {
      await Promise.all(dishes.slice(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE).map(d => {
        const img = new Image();
        img.src = d.image;
        return img.decode().catch(() => {});
      }));
      const oldCards = [...track.children],
        layout = getComputedStyle(track);
      const oldHeight = track.getBoundingClientRect().height;
      const outgoing = document.createElement('div');
      outgoing.className = 'menu-outgoing';
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.inert = true;
      outgoing.style.gridTemplateColumns = layout.gridTemplateColumns;
      outgoing.style.gap = layout.gap;
      outgoing.style.padding = layout.padding;
      track.style.minHeight = `${oldHeight}px`;
      track.classList.add('is-paging');
      menuPage = nextPage;
      renderMenuPage();
      const newCards = [...track.children];
      outgoing.append(...oldCards);
      track.append(outgoing);
      const distance = track.getBoundingClientRect().width + 16;
      const speed = 1.2,
        stagger = 65 / speed,
        exitDuration = 620 / speed,
        entryDuration = 680 / speed;
      const entryStart = exitDuration + (oldCards.length - 1) * stagger;
      const slide = (elements, entering) => elements.map((el, i) => {
        const order = sign > 0 ? i : elements.length - 1 - i;
        const animation = el.animate([{
          transform: `translateX(${entering ? sign * distance : 0}px)`
        }, {
          transform: `translateX(${entering ? 0 : -sign * distance}px)`
        }], {
          duration: entering ? entryDuration : exitDuration,
          delay: order * stagger + (entering ? entryStart : 0),
          easing: entering ? 'cubic-bezier(.22,.61,.36,1)' : 'cubic-bezier(.4,0,.6,1)',
          fill: 'both'
        });
        animations.push(animation);
        return animation.finished;
      });
      await Promise.all([...slide(oldCards, false), ...slide(newCards, true)]);
    } finally {
      track.querySelector('.menu-outgoing')?.remove();
      animations.forEach(a => a.cancel());
      track.classList.remove('is-paging');
      track.style.minHeight = '';
      track.inert = false;
      track.removeAttribute('aria-busy');
      controls.forEach(b => b.removeAttribute('aria-disabled'));
      menuAnimating = false;
    }
  }
  for (let i = 0; i < PAGE_COUNT; i++) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Trang menu ${i + 1}`);
    dot.addEventListener('click', () => changeMenuPage(i));
    pager.append(dot);
  }
  function selectDish(index, initial = false) {
    if (detailState !== "idle") return;
    if (index === selectedDishIndex && !initial) return;
    const d = dishes[index];
    if (!initial) {
      tableTurn++;
      plates[tableTurn % 4].src = d.image;
      wheel.style.setProperty('--rotation', `${-tableTurn * 90}deg`);
    }
    selectedDishIndex = index;
    document.querySelector('#dish-name').textContent = d.name;
    document.querySelector('#category').textContent = d.category;
    document.querySelector('#description').textContent = d.description;
    document.querySelector('#price').innerHTML = formatPrice(d.price) + ' <small>đ</small>';
    document.querySelector('#time').textContent = d.time;
    document.querySelector('#tags').replaceChildren(...(d.tags || []).map(t => {
      const el = document.createElement('span');
      el.textContent = t;
      return el;
    }));
    [...track.children].forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.index) === selectedDishIndex)));
    if (!initial) {
      details.classList.remove('changing');
      void details.offsetWidth;
      details.classList.add('changing');
    }
  }
  document.querySelector('#previous').addEventListener('click', () => changeMenuPage(menuPage - 1, -1));
  document.querySelector('#next').addEventListener('click', () => changeMenuPage(menuPage + 1, 1));
  track.addEventListener('keydown', e => {
    const i = [...track.children].indexOf(document.activeElement);
    if (i < 0) return;
    let target;
    const count = track.children.length;
    if (e.key === 'ArrowRight') target = (i + 1) % count;
    if (e.key === 'ArrowLeft') target = (i + count - 1) % count;
    if (e.key === 'Home') target = 0;
    if (e.key === 'End') target = count - 1;
    if (target !== undefined) {
      e.preventDefault();
      track.children[target].focus({
        preventScroll: true
      });
    }
  });
  document.addEventListener('pointerdown', () => {
    document.documentElement.dataset.input = 'pointer';
  }, true);
  document.addEventListener('keydown', e => {
    if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) document.documentElement.dataset.input = 'keyboard';
  }, true);
  const stage = document.querySelector('#stage'),
    dialog = document.querySelector('#dish-dialog'),
    panel = document.querySelector('#detail-panel'),
    flyer = document.querySelector('#flying-plate');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const orderView = document.querySelector('#dish-order-view');
  const infoView = document.querySelector('#dish-info-view');
  const panelScroll = document.querySelector('#detail-panel-scroll');
  const orderForm = document.querySelector('#dish-order-form');
  const orderQuantity = document.querySelector('#order-quantity');
  orderQuantity.max = maxQuantity;
  let orderDishIndex = null, viewTransition = 0, viewAnimating = false, viewAnimations = [];
  let transitionId = 0,
    activeAnimations = [],
    returnFocus = null,
    previousOverflow = '',
    detailMotion = null;

  function updateDelivery() {
    const delivery = document.querySelector('#order-fulfillment').value === 'delivery';
    document.querySelector('#order-address-label').hidden = !delivery;
    document.querySelector('#order-address').required = delivery;
    document.querySelector('#order-address').disabled = !delivery;
  }

  function updateOrderTotal() {
    const quantity = Number(orderQuantity.value);
    const valid = Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity;
    document.querySelector('#order-total').textContent = formatPrice(dishes[selectedDishIndex].price * (valid ? quantity : 0)) + ' đ';
    document.querySelector('#order-minus').disabled = !valid || quantity <= 1;
    document.querySelector('#order-plus').disabled = !valid || quantity >= maxQuantity;
  }

  function resetOrderView() {
    viewTransition++;
    viewAnimations.forEach(animation => animation.cancel());
    viewAnimations = [];
    viewAnimating = false;
    orderDishIndex = null;
    orderForm.reset();
    updateDelivery();
    orderView.hidden = true;
    panel.classList.remove('is-ordering');
    panel.style.height = '';
    document.querySelector('#order-status').hidden = true;
    dialog.setAttribute('aria-labelledby', 'modal-name');
  }

  async function switchDishView(ordering) {
    if (detailState !== 'open' || viewAnimating) return;
    viewAnimating = true;
    const run = ++viewTransition;
    const info = [infoView];
    const leaving = ordering ? info : [orderView];
    const entering = ordering ? [orderView] : info;
    const animate = async (elements, incoming) => {
      if (reducedMotion.matches) return;
      await Promise.all(elements.map(el => {
        const animation = el.animate(incoming ? [{opacity: 0, transform: 'translateY(7px)'}, {opacity: 1, transform: 'translateY(0)'}] : [{opacity: 1, transform: 'translateY(0)'}, {opacity: 0, transform: 'translateY(-5px)'}], {duration: incoming ? 200 : 140, easing: 'ease-out'});
        viewAnimations.push(animation);
        return animation.finished.catch(() => {});
      }));
    };
    dialog.setAttribute('aria-busy', 'true');
    if (ordering) {
      panel.style.height = `${panel.getBoundingClientRect().height}px`;
      if (orderDishIndex !== selectedDishIndex) {
        orderForm.reset();
        orderDishIndex = selectedDishIndex;
        updateDelivery();
      }
      const dish = dishes[selectedDishIndex];
      document.querySelector('#order-image').src = dish.image;
      document.querySelector('#order-selected-name').textContent = dish.name;
      document.querySelector('#order-unit-price').textContent = formatPrice(dish.price) + ' đ / phần';
      document.querySelector('#order-status').hidden = true;
      updateOrderTotal();
    }
    try {
      await animate(leaving, false);
      if (run !== viewTransition) return;
      panel.classList.toggle('is-ordering', ordering);
      orderView.hidden = !ordering;
      if (!ordering) panel.style.height = '';
      panelScroll.scrollTop = 0;
      dialog.setAttribute('aria-labelledby', ordering ? 'order-title' : 'modal-name');
      if (ordering) document.querySelector('#order-title').focus({preventScroll: true});
      else document.querySelector('#order-dish').focus({preventScroll: true});
      await animate(entering, true);
    } finally {
      if (run === viewTransition) {
        viewAnimating = false;
        dialog.removeAttribute('aria-busy');
        viewAnimations.forEach(animation => animation.cancel());
        viewAnimations = [];
      }
    }
  }
  function renderDishDetails(d) {
    document.querySelector('#modal-name').textContent = d.name;
    document.querySelector('#modal-category').textContent = d.category;
    document.querySelector('#modal-description').textContent = d.description;
    document.querySelector('#modal-time').textContent = d.time;
    document.querySelector('#modal-price').innerHTML = formatPrice(d.price) + ' <small>đ</small>';
    document.querySelector('#modal-ingredients').replaceChildren(...(d.ingredients || []).filter(key => ingredientCatalog[key]).map(key => {
      const [name, cell] = ingredientCatalog[key];
      const item = document.createElement('li');
      item.className = 'ingredient-item';
      const photo = document.createElement('span');
      photo.className = 'ingredient-photo';
      photo.setAttribute('aria-hidden', 'true');
      photo.style.setProperty('--ingredient-x', `${cell % 5 * 25}%`);
      photo.style.setProperty('--ingredient-y', `${Math.floor(cell / 5) * 100 / 3}%`);
      const label = document.createElement('span');
      label.className = 'ingredient-name';
      label.textContent = name;
      item.append(photo, label);
      return item;
    }));
  }
  async function runDetailAnimation(el, keyframes, options) {
    const animation = el.animate(keyframes, {
      fill: 'forwards',
      ...options
    });
    activeAnimations.push(animation);
    await animation.finished;
  }
  function resetDishDetails() {
    if (detailState === 'idle') return;
    transitionId++;
    detailState = 'idle';
    const wheelTransition = wheel.style.transition;
    wheel.style.transition = 'none';
    document.body.classList.remove('dish-open');
    dialog.classList.remove('returning');
    void wheel.offsetWidth;
    activeAnimations.forEach(a => a.cancel());
    activeAnimations = [];
    detailMotion = null;
    void wheel.offsetWidth;
    wheel.style.transition = wheelTransition;
    document.body.style.overflow = previousOverflow;
    plates.forEach(img => img.classList.remove('lifted'));
    panel.hidden = true;
    panel.inert = false;
    panel.style.visibility = '';
    panel.classList.remove('forming');
    resetOrderView();
    flyer.hidden = true;
    dialog.removeAttribute('aria-busy');
    document.querySelector('#detail-status').textContent = '';
    if (dialog.open) dialog.close();
    if (returnFocus?.isConnected) returnFocus.focus({
      preventScroll: true
    });
  }
  async function closeDishDetails() {
    if (detailState === 'idle' || detailState.startsWith('closing') || detailState === 'returning') return;
    if (detailState !== 'open' || viewAnimating || reducedMotion.matches || !detailMotion || detailMotion.width !== innerWidth || detailMotion.height !== innerHeight) {
      resetDishDetails();
      return;
    }
    const run = ++transitionId;
    panel.inert = true;
    dialog.focus({
      preventScroll: true
    });
    dialog.setAttribute('aria-busy', 'true');
    const reverse = animations => Promise.all(animations.map(animation => {
      animation.reverse();
      return animation.finished;
    }));
    try {
      detailState = 'closing-content';
      await reverse(detailMotion.content);
      if (run !== transitionId) return;
      detailState = 'closing-surface';
      panel.hidden = true;
      flyer.hidden = false;
      await reverse([detailMotion.surface]);
      if (run !== transitionId) return;
      detailState = 'returning';
      dialog.classList.add('returning');
      const returnAnimations = detailMotion.flight.filter(animation => animation.effect.getKeyframes().some(frame => frame.opacity !== undefined));
      returnAnimations.forEach(animation => {
        animation.currentTime = 1000;
      });
      const returnPlate = runDetailAnimation(flyer, [{
        transform: getComputedStyle(flyer).transform
      }, {
        transform: `translate(0,0) scale(${detailMotion.homeScaleX},${detailMotion.homeScaleY})`
      }], {
        delay: 420,
        duration: 580,
        easing: 'cubic-bezier(.4,0,.2,1)'
      });
      const lowerTable = runDetailAnimation(wheel, [{
        translate: getComputedStyle(wheel).translate
      }, {
        translate: '0 0'
      }], {
        delay: 420,
        duration: 580,
        easing: 'cubic-bezier(.4,0,.2,1)'
      });
      await Promise.all([reverse(returnAnimations), returnPlate, lowerTable]);
      if (run === transitionId) resetDishDetails();
    } catch (error) {
      if (run === transitionId) {
        resetDishDetails();
        console.error('Dish close transition failed', error);
      }
    }
  }
  async function openDishDetails() {
    if (detailState !== 'idle' || menuAnimating) return;
    resetOrderView();
    detailState = 'flying';
    const run = ++transitionId;
    returnFocus = document.activeElement;
    detailMotion = {
      width: innerWidth,
      height: innerHeight
    };
    wheel.getAnimations().forEach(a => a.finish());
    const img = plates[tableTurn % 4],
      rect = img.getBoundingClientRect(),
      d = dishes[selectedDishIndex];
    const restingSize = getComputedStyle(img);
    detailMotion.homeScaleX = parseFloat(restingSize.width) / rect.width;
    detailMotion.homeScaleY = parseFloat(restingSize.height) / rect.height;
    renderDishDetails(d);
    flyer.querySelector('img').src = img.src;
    flyer.hidden = false;
    flyer.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
    panel.hidden = true;
    panel.inert = true;
    panel.style.visibility = '';
    panelScroll.scrollTop = 0;
    panel.classList.remove('forming');
    dialog.setAttribute('aria-busy', 'true');
    document.querySelector('#detail-status').textContent = 'Đang mở chi tiết ' + d.name;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.focus({
      preventScroll: true
    });
    img.classList.add('lifted');
    document.body.classList.add('dish-open');
    try {
      if (!reducedMotion.matches) {
        const size = Math.min(340, innerWidth - 64, innerHeight * .46);
        const dx = innerWidth / 2 - (rect.left + rect.width / 2),
          dy = innerHeight / 2 - (rect.top + rect.height / 2),
          scale = size / rect.width;
        const pose = `translate(${dx}px,${dy}px) scale(${scale})`;
        detailState = 'spinning';
        const surface = flyer.querySelector('.plate-solid'),
          photo = flyer.querySelector('img');
        await Promise.all([runDetailAnimation(flyer, [{
          transform: 'translate(0,0) scale(1)'
        }, {
          transform: pose
        }], {
          duration: 580,
          easing: 'cubic-bezier(.22,.7,.2,1)'
        }), runDetailAnimation(photo, [{
          transform: 'rotate(0deg)'
        }, {
          transform: 'rotate(360deg)'
        }], {
          duration: 1000,
          easing: 'linear'
        }), runDetailAnimation(surface, [{
          opacity: 0
        }, {
          opacity: 1
        }], {
          delay: 800,
          duration: 160,
          easing: 'ease-out'
        }), runDetailAnimation(photo, [{
          opacity: 1
        }, {
          opacity: 0
        }], {
          delay: 800,
          duration: 200,
          easing: 'ease-in-out'
        })]);
        if (run !== transitionId) return;
        detailMotion.flight = activeAnimations.slice();
        detailState = 'expanding';
        panel.classList.add('forming');
        panel.hidden = false;
        panel.style.visibility = 'hidden';
        const bounds = panel.getBoundingClientRect(),
          panelStyle = getComputedStyle(panel);
        const corner = parseFloat(panelStyle.borderTopLeftRadius);
        const targetWidth = bounds.width / scale,
          targetHeight = bounds.height / scale;
        const offsetX = (bounds.left + bounds.width / 2 - innerWidth / 2) / scale;
        const offsetY = (bounds.top + bounds.height / 2 - innerHeight / 2) / scale;
        await runDetailAnimation(surface, [{
          width: `${rect.width * .92}px`,
          height: `${rect.height * .92}px`,
          borderRadius: '50%',
          transform: 'translate(-50%,-50%)',
          boxShadow: '0 0 0 #13211400'
        }, {
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          borderRadius: `${corner / scale}px`,
          transform: `translate(calc(-50% + ${offsetX}px),calc(-50% + ${offsetY}px))`,
          boxShadow: `0 ${30 / scale}px ${100 / scale}px #1321142a`
        }], {
          duration: 820,
          easing: 'cubic-bezier(.4,0,.2,1)'
        });
        if (run !== transitionId) return;
        detailMotion.surface = activeAnimations[activeAnimations.length - 1];
        panel.style.visibility = '';
        flyer.hidden = true;
        panel.classList.remove('forming');
        detailState = 'revealing';
        const contentStart = activeAnimations.length;
        await Promise.all([...panel.children].filter(el => !el.hidden).map(el => runDetailAnimation(el, [{
          opacity: 0,
          transform: 'translateY(7px)'
        }, {
          opacity: 1,
          transform: 'translateY(0)'
        }], {
          duration: 220,
          easing: 'ease-out'
        })));
        detailMotion.content = activeAnimations.slice(contentStart);
      }
      if (run !== transitionId) return;
      flyer.hidden = true;
      panel.hidden = false;
      panel.inert = false;
      detailState = 'open';
      dialog.removeAttribute('aria-busy');
      document.querySelector('#detail-status').textContent = '';
      panel.querySelector('.dialog-close').focus({
        preventScroll: true
      });
    } catch (error) {
      if (run === transitionId) {
        closeDishDetails();
        console.error('Dish detail transition failed', error);
      }
    }
  }
  document.querySelector('#explore-dish').addEventListener('click', openDishDetails);
  stage.addEventListener('click', e => {
    if (e.target.closest('.table-wheel')) openDishDetails();
  });
  stage.addEventListener('keydown', e => {
    if (e.target === stage && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openDishDetails();
    }
  });
  document.querySelector('#order-dish').addEventListener('click', () => switchDishView(true));
  document.querySelector('#back-to-dish').addEventListener('click', () => switchDishView(false));
  document.querySelector('#order-fulfillment').addEventListener('change', updateDelivery);
  orderQuantity.addEventListener('input', updateOrderTotal);
  for (const [id, delta] of [['order-minus', -1], ['order-plus', 1]]) document.querySelector('#' + id).addEventListener('click', () => {
    orderQuantity.value = String(Math.min(maxQuantity, Math.max(1, (Number(orderQuantity.value) || 1) + delta)));
    updateOrderTotal();
  });
  orderForm.addEventListener('submit', event => {
    event.preventDefault();
    const status = document.querySelector('#order-status');
    status.hidden = false;
    status.textContent = 'Đây là bản demo. Yêu cầu đặt món chưa được gửi đến nhà hàng.';
    status.scrollIntoView({block: 'nearest', behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  });
  dialog.querySelector('.dialog-close').addEventListener('click', closeDishDetails);
  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    closeDishDetails();
  });
  dialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const buttons = [...dialog.querySelectorAll('button, input, select, textarea, a[href]')].filter(b => b.getClientRects().length && !b.disabled && !b.closest('[inert]'));
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (!first) {
      e.preventDefault();
      dialog.focus({
        preventScroll: true
      });
      return;
    }
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('click', e => {
    if (e.target === dialog && detailState === 'open') closeDishDetails();
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open && detailState !== 'idle') resetDishDetails();
  });
  renderMenuPage();
  selectDish(initialDish, true);
})();
