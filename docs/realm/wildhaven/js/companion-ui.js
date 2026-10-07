import { RESOURCES } from './catalog.js';
import { TRADE_RESOURCES } from './companion-store.js';

const el = (tag, className = '', text) => {
  const node = document.createElement(tag); node.className = className;
  if (text !== undefined) node.textContent = text; return node;
};
const action = (text, id, run, className = '') => {
  const node = el('button', className, text); node.type = 'button'; node.dataset.companionAction = id; node.onclick = run; return node;
};
const cargo = bag => Object.entries(bag).map(([key, n]) => `${n} ${RESOURCES[key]?.name.toLowerCase() || key}`).join(', ') || 'nothing in return';

export function createCompanionUI({ store, getState, onStateChange, beforeOpen, announce }) {
  const panel = el('aside', 'companion-panel'); panel.id = 'companion-panel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Local companion towns');
  const heading = el('div', 'companion-heading'), title = el('div');
  title.append(el('small', '', 'A shared corner of the island'), el('h2', '', 'Companion towns'));
  const closeButton = action('×', 'close', close); closeButton.setAttribute('aria-label', 'Close companion towns');
  heading.append(title, closeButton);
  const feedback = el('p', 'companion-feedback'); feedback.hidden = true; feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
  const content = el('div', 'companion-content'); content.tabIndex = 0;
  panel.append(heading, feedback, content); document.getElementById('hud').append(panel);
  const toggle = action('Companion towns', 'toggle', () => panel.hidden ? open() : close());
  toggle.id = 'companion-toggle'; toggle.setAttribute('aria-controls', panel.id); toggle.setAttribute('aria-expanded', 'false');
  document.querySelector('.controls-hint>div').append(toggle);
  const banner = el('section', 'companion-visit-banner'); banner.id = 'companion-visit-banner'; banner.hidden = true;
  banner.setAttribute('aria-label', 'Current local town'); document.getElementById('hud').append(banner);
  let previousFocus = null, signature = '', lastBanner = '', inertNodes = [];
  let layoutFrame = null, failedForm = null;

  function layout() {
    layoutFrame = null;
    if (!banner.hidden) panel.style.setProperty('--companion-away-top', `${Math.ceil(banner.getBoundingClientRect().bottom) + 8}px`);
    const viewport = window.visualViewport, focused = document.activeElement;
    const editing = !panel.hidden && panel.contains(focused) && focused.matches('input:not([type="checkbox"]),select');
    const keyboard = editing && viewport && viewport.scale === 1 && window.innerHeight - viewport.height > 120;
    if (keyboard) {
      panel.dataset.keyboard = 'open';
      panel.style.setProperty('--companion-keyboard-top', `${viewport.offsetTop + 8}px`);
      panel.style.setProperty('--companion-keyboard-height', `${Math.max(120, viewport.height - 16)}px`);
    } else delete panel.dataset.keyboard;
    if (editing) {
      const field = focused.getBoundingClientRect(), scrollport = content.getBoundingClientRect();
      if (field.bottom > scrollport.bottom - 16) content.scrollTop += field.bottom - scrollport.bottom + 16;
      else if (field.top < scrollport.top + 12) content.scrollTop -= scrollport.top + 12 - field.top;
    }
  }
  function queueLayout() { if (layoutFrame === null) layoutFrame = requestAnimationFrame(layout); }
  window.addEventListener('resize', queueLayout);
  window.visualViewport?.addEventListener('resize', queueLayout);
  window.visualViewport?.addEventListener('scroll', queueLayout);
  panel.addEventListener('focusin', queueLayout); panel.addEventListener('focusout', queueLayout);
  const bannerObserver = new ResizeObserver(queueLayout); bannerObserver.observe(banner);

  function close() {
    panel.hidden = true; document.body.classList.remove('companion-active'); toggle.setAttribute('aria-expanded', 'false');
    if (panel.contains(document.activeElement)) previousFocus?.focus();
    queueLayout();
  }
  function open() {
    beforeOpen?.(); previousFocus = document.activeElement; panel.hidden = false;
    document.body.classList.add('companion-active'); toggle.setAttribute('aria-expanded', 'true'); signature = ''; update(); closeButton.focus(); queueLayout();
  }
  function finish(result, change = false) {
    feedback.textContent = result.reason || ''; feedback.hidden = !result.reason;
    feedback.classList.toggle('is-error', !result.ok);
    announce?.(result.reason, !result.ok);
    if (!result.ok) {
      failedForm = { town: store.activeId, fields: [...content.querySelectorAll('[data-companion-field]')].map(input => [input.dataset.companionField, input.value]),
        details: [...content.querySelectorAll('details[open][data-companion-details]')].map(details => details.dataset.companionDetails) };
      queueLayout(); return result;
    }
    failedForm = null;
    if (result.ok && change && result.state) {
      const info = store.info();
      onStateChange(result.state, { id: info.activeId, mode: info.mode, readOnly: info.readOnly });
    }
    signature = ''; update(); if (!panel.hidden) closeButton.focus({ preventScroll: true }); queueLayout(); return result;
  }
  function travel(id, visit = false) { return finish(store.switchTown(id, getState(), { visit }), true); }
  function textField(labelText, value, key) {
    const label = el('label', 'companion-field', labelText), input = el('input');
    input.value = value; input.maxLength = 40; input.required = true; input.dataset.companionField = key;
    input.autocomplete = 'off'; input.autocapitalize = 'words'; input.enterKeyHint = 'done';
    label.append(input); return { label, input };
  }
  function creation(info) {
    content.append(el('div', 'companion-postcard', 'A second hearth, a different story.'),
      el('h3', '', 'Give your towns a name'),
      el('p', '', 'Your home keeps its progress. A companion town starts with six founders. Take turns, visit, and exchange goods by agreement.'));
    const form = el('form', 'companion-form'), home = textField('Your existing home', info.towns[0].name, 'home-name'), companion = textField('A companion town · local draft', 'Melissa’s village', 'companion-name');
    const submit = el('button', 'primary', 'Create the companion town'); submit.type = 'submit'; submit.disabled = info.blocked;
    form.append(home.label, companion.label, submit);
    form.onsubmit = event => { event.preventDefault(); finish(store.create({ homeName: home.input.value, companionName: companion.input.value }, getState())); };
    content.append(form);
  }
  function townCards(info) {
    const row = el('div', 'companion-town-grid');
    for (const town of info.towns) {
      const current = info.activeId === town.id, card = el('section', `companion-town${current ? ' is-current' : ''}`);
      const stats = el('p', 'companion-town-stat', `Day ${town.day} · ${town.population} residents`), stocks = el('p', 'companion-stock');
      stats.dataset.companionStats = town.id; stocks.dataset.companionStock = town.id;
      card.append(el('small', '', town.id === 'home' ? 'Original home' : 'Companion draft'), el('h3', '', town.name), stats, stocks);
      const buttons = el('div', 'companion-actions');
      if (current && !info.readOnly) buttons.append(el('span', 'companion-current', 'You’re managing this town'));
      else {
        if (!current) buttons.append(action('Visit the island', `visit-${town.id}`, () => travel(town.id, true)));
        buttons.append(action(town.id === 'home' ? 'Return home' : 'Take the chair', `manage-${town.id}`, () => travel(town.id), current ? 'primary' : ''));
      }
      card.append(buttons);
      if (!info.readOnly) {
        const details = el('details', 'companion-rename'), summary = el('summary', '', 'Rename town'), form = el('form'); details.dataset.companionDetails = town.id;
        const name = textField('Town name', town.name, `name-${town.id}`), submit = el('button', '', 'Save name'); submit.type = 'submit';
        form.append(name.label, submit); form.onsubmit = event => { event.preventDefault(); finish(store.renameTown(town.id, name.input.value, getState())); };
        details.append(summary, form); card.append(details);
      }
      row.append(card);
    }
    content.append(row, el('p', 'companion-fine', 'Towns wait while you’re away. Reloading always brings you home.'));
  }
  function cargoField(labelText, key, defaultResource, optional = false) {
    const label = el('label', 'companion-field', labelText), row = el('div', 'companion-cargo-field'), select = el('select'), amount = el('input');
    select.dataset.companionField = `${key}-resource`; select.setAttribute('aria-label', `${labelText} resource`);
    if (optional) { const option = el('option', '', 'A gift · nothing back'); option.value = ''; select.append(option); }
    for (const resource of TRADE_RESOURCES) { const option = el('option', '', RESOURCES[resource].name); option.value = resource; select.append(option); }
    select.value = defaultResource; amount.type = 'number'; amount.min = '1'; amount.max = '9999'; amount.step = '1'; amount.value = '10'; amount.required = true;
    amount.inputMode = 'numeric'; amount.enterKeyHint = 'done';
    amount.dataset.companionField = `${key}-amount`; amount.setAttribute('aria-label', `${labelText} amount`);
    select.onchange = () => { amount.disabled = select.value === ''; }; row.append(select, amount); label.append(row);
    return { label, bag: () => select.value ? { [select.value]: Number(amount.value) } : {} };
  }
  function offers(info) {
    const names = Object.fromEntries(info.towns.map(town => [town.id, town.name]));
    if (!info.readOnly && !info.blocked) {
      const section = el('section', 'companion-trade'), recipient = info.towns.find(town => town.id !== info.activeId);
      section.append(el('h3', '', 'Make an offer'), el('p', '', `To ${recipient.name}. Goods move only after acceptance.`));
      const form = el('form', 'companion-form'), give = cargoField('This town gives', 'give', 'wood'), request = cargoField('This town asks for', 'request', 'food', true);
      const submit = el('button', 'primary', 'Propose exchange'); submit.type = 'submit';
      form.append(give.label, request.label, submit);
      form.onsubmit = event => { event.preventDefault(); finish(store.proposeOffer({ give: give.bag(), request: request.bag() }, getState())); };
      section.append(form); content.append(section);
    }
    const pending = info.offers.filter(offer => offer.status === 'pending');
    const list = el('section', 'companion-offers'); list.append(el('h3', '', `Open offers${pending.length ? ` · ${pending.length}` : ''}`));
    if (!pending.length) list.append(el('p', 'companion-fine', 'No offers waiting. A gift of food makes a good first hello.'));
    for (const offer of pending) {
      const card = el('article', 'companion-offer'); card.dataset.companionOffer = offer.id;
      card.append(el('small', '', `From ${names[offer.from]} · day ${offer.proposedDay}`),
        el('h4', '', `${cargo(offer.give)} → ${names[offer.to]}`), el('p', '', Object.keys(offer.request).length ? `In exchange for ${cargo(offer.request)}.` : 'A gift. Nothing is asked in return.'));
      if (!info.readOnly && !info.blocked && offer.to === info.activeId) {
        const label = el('label', 'companion-consent'), checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.dataset.companionAction = `consent-${offer.id}`;
        label.append(checkbox, document.createTextNode(`I’m reviewing this offer for ${names[offer.to]}.`));
        const accept = action('Accept this exchange', `accept-${offer.id}`, () => { if (checkbox.checked) finish(store.acceptOffer(offer.id, getState()), true); }, 'primary');
        accept.disabled = true; checkbox.onchange = () => { accept.disabled = !checkbox.checked; };
        card.append(label, accept, action('Decline', `close-${offer.id}`, () => finish(store.closeOffer(offer.id, getState()))));
      } else if (!info.readOnly && !info.blocked) {
        card.append(el('p', 'companion-fine', 'Pass the device and open the receiving town to review this offer.'), action('Withdraw offer', `close-${offer.id}`, () => finish(store.closeOffer(offer.id, getState()))));
      }
      list.append(card);
    }
    content.append(list);
    const closed = info.offers.filter(offer => offer.status !== 'pending').slice(0, 6);
    if (closed.length) {
      const details = el('details', 'companion-history'); details.append(el('summary', '', 'Recent exchanges'));
      const list = el('ul');
      for (const offer of closed) list.append(el('li', '', `${offer.status[0].toUpperCase() + offer.status.slice(1)} · ${names[offer.from]} offered ${cargo(offer.give)} for ${cargo(offer.request)}.`));
      details.append(list); content.append(details);
    }
  }
  function updateBanner(info) {
    const next = JSON.stringify([info.enabled, info.activeId, info.mode, info.towns.map(town => town.name)]);
    if (next !== lastBanner) {
      lastBanner = next; banner.replaceChildren(); banner.hidden = !info.enabled || info.activeId === 'home' && !info.readOnly;
      if (!banner.hidden) {
        const town = info.towns.find(town => town.id === info.activeId), text = el('div');
        text.append(el('small', '', info.readOnly ? 'Read-only visit · time is paused' : 'Managing a local draft · your home is paused'), el('strong', '', town.name)); banner.append(text);
        if (info.readOnly) banner.append(action('Take the chair', 'take-chair', () => travel(info.activeId)));
        banner.append(action('Return home', 'return-home', () => travel('home')), action('Towns', 'banner-open', open));
      }
      queueLayout();
    }
    document.body.classList.toggle('companion-visit', info.readOnly);
    document.body.classList.toggle('companion-away', !banner.hidden);
    if (info.readOnly && !inertNodes.length) {
      inertNodes = [...document.getElementById('hud').children].filter(node => node !== panel && node !== banner && !['toast','save-warning'].includes(node.id) && !node.inert);
      for (const node of inertNodes) node.inert = true;
    } else if (!info.readOnly && inertNodes.length) { for (const node of inertNodes) node.inert = false; inertNodes = []; }
  }
  function update() {
    const info = store.info(getState()); updateBanner(info);
    const incoming = info.offers.filter(offer => offer.status === 'pending' && offer.to === info.activeId).length;
    toggle.textContent = incoming ? `Companion towns · ${incoming} offer${incoming === 1 ? '' : 's'}` : 'Companion towns';
    if (panel.hidden) return;
    const updateStocks = () => {
      for (const town of info.towns) {
        const stats = panel.querySelector(`[data-companion-stats="${town.id}"]`), stocks = panel.querySelector(`[data-companion-stock="${town.id}"]`);
        if (stats) stats.textContent = `Day ${town.day} · ${town.population} residents`;
        if (stocks) stocks.textContent = ['wood', 'stone', 'food'].map(key => `${Math.floor(town.resources[key] || 0)} ${RESOURCES[key].short.toLowerCase()}`).join(' · ');
      }
    };
    const next = JSON.stringify([info.enabled, info.blocked, info.reason, info.activeId, info.mode, info.towns.map(town => town.name), info.offers]);
    if (next === signature) { updateStocks(); return; }
    // Autosaving changes revision; keep a half-written name, offer, or consent choice intact.
    if (signature && panel.contains(document.activeElement) && document.activeElement.matches('input,select')) return;
    signature = next; const scroll = content.scrollTop;
    content.replaceChildren();
    content.append(el('p', 'companion-scope', 'Two towns on this device · no online connection'));
    if (info.reason) { const note = el('p', 'companion-notice', info.reason); note.setAttribute('role', info.blocked ? 'alert' : 'status'); content.append(note); }
    if (!info.enabled) creation(info);
    else { townCards(info); offers(info); }
    const future = el('details', 'companion-future');
    future.append(el('summary', '', 'Visits & peaceful towns'), el('p', '', 'Visits are read-only. Take the chair to manage a town; construction and fieldwork resume where you left them. Human-town conflict is not implemented.'));
    content.append(future);
    if (failedForm?.town === info.activeId) {
      for (const [key, value] of failedForm.fields) { const input = content.querySelector(`[data-companion-field="${key}"]`); if (input) { input.value = value; if (input.tagName === 'SELECT') input.onchange?.(); } }
      for (const key of failedForm.details) { const details = content.querySelector(`[data-companion-details="${key}"]`); if (details) details.open = true; }
    }
    updateStocks(); content.scrollTop = scroll;
  }
  update();
  return { open, close, update, get active() { return !panel.hidden; } };
}
