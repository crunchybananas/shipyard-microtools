import { listTiles } from './island.js';
const el = (tag, cls = '', text) => { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; };
const button = (label, run, cls = '') => { const node = el('button', cls, label); node.type = 'button'; node.onclick = run; return node; };
const tiles = listTiles();

function preview(state) {
  const canvas = el('canvas', 'town-preview'); canvas.width = 480; canvas.height = 240;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Map preview of this saved town');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#81aaa3'; ctx.fillRect(0, 0, 480, 240);
  const buildings = state.buildings || [], minX = Math.min(-13, ...buildings.map(b => b.x - 3)), maxX = Math.max(13, ...buildings.map(b => b.x + 3));
  const minZ = Math.min(-9, ...buildings.map(b => b.z - 3)), maxZ = Math.max(9, ...buildings.map(b => b.z + 3));
  const scale = Math.min(480 / (maxX - minX + 2), 240 / (maxZ - minZ + 2));
  const x = n => 240 + (n - (minX + maxX) / 2) * scale, y = n => 120 + (n - (minZ + maxZ) / 2) * scale;
  for (const tile of tiles) {
    if (tile.kind === 'water' || tile.x < minX - 2 || tile.x > maxX + 2 || tile.z < minZ - 2 || tile.z > maxZ + 2) continue;
    ctx.fillStyle = tile.kind === 'sand' ? '#cdd1aa' : tile.kind === 'rock' ? '#929d89' : '#b7c69b';
    ctx.fillRect(x(tile.x), y(tile.z), scale + .5, scale + .5);
    if (tile.kind === 'forest') { ctx.fillStyle = '#5c8265'; ctx.beginPath(); ctx.arc(x(tile.x) + scale / 2, y(tile.z) + scale / 2, scale * .32, 0, 7); ctx.fill(); }
  }
  for (const b of buildings) {
    const bx = x(b.x), by = y(b.z);
    ctx.fillStyle = '#35544644'; ctx.fillRect(bx + 2, by + 3, scale * .8, scale * .8);
    ctx.fillStyle = b.status !== 'ready' ? '#d8bf8a' : ['garden','farm','orchard','pasture'].includes(b.type) ? '#648966' : '#f0e4c4';
    ctx.fillRect(bx, by, scale * .8, scale * .8);
    ctx.fillStyle = ['school','assay'].includes(b.type) ? '#567c8b' : '#a97958';
    ctx.fillRect(bx, by, scale * .8, scale * .3);
  }
  return canvas;
}
export function createTownLibraryUI({ library, getState, beforeOpen, canSwitch, onOpenTown }) {
  const dialog = el('dialog', 'your-towns'); dialog.id = 'your-towns'; dialog.setAttribute('aria-labelledby', 'your-towns-title');
  const heading = el('div', 'your-towns-heading'), title = el('h2', '', 'Your towns'); title.id = 'your-towns-title';
  const close = button('×', () => dialog.close(), 'towns-close'); close.setAttribute('aria-label', 'Close Your towns');
  heading.append(title, close);
  const intro = el('p', 'towns-note', 'Each town saves separately on this browser. Duplicate one to try a different direction.');
  const feedback = el('p', 'towns-feedback'); feedback.hidden = true; feedback.setAttribute('role', 'status');
  const newButton = button('New town', () => edit('new'), 'primary');
  const list = el('div', 'town-list'), editor = el('form', 'town-name-form'); editor.hidden = true;
  const label = el('label'), input = el('input'); input.id = 'town-name'; input.maxLength = 40; input.required = true; input.autocomplete = 'off'; label.htmlFor = input.id;
  const submit = el('button', 'primary'); submit.type = 'submit';
  const cancel = button('Cancel', () => { editor.hidden = true; newButton.focus(); });
  const formActions = el('div', 'town-form-actions'); formActions.append(submit, cancel); editor.append(label, input, formActions);
  const tools = el('div', 'towns-toolbar'); tools.append(newButton);
  dialog.append(heading, intro, tools, editor, feedback, list, el('p', 'towns-footnote', 'Copies keep buildings, discoveries and progress. Online partnerships stay with the original. Download backups to keep a copy outside this browser.'));
  document.body.append(dialog);
  let operation = null, source = null, priorFocus = null;
  function message(text, error = false) { feedback.hidden = !text; feedback.textContent = text; feedback.dataset.error = String(error); }
  function guard() { const result = canSwitch(); if (!result.ok) message(result.reason, true); return result.ok; }
  function persist() { const result = library.saveCurrent(getState()); if (!result.ok) message(result.reason, true); return result.ok; }
  function openTown(item) {
    if (!guard()) return;
    const result = library.select(item.slotId, item.townId, getState());
    if (!result.ok) { message(result.reason, true); return; }
    dialog.close(); onOpenTown(result.state);
  }
  function edit(kind, item = null) {
    operation = kind; source = item; editor.hidden = false;
    label.textContent = kind === 'new' ? 'Name your new town' : kind === 'copy' ? `Copy of ${item.name}` : 'Town name';
    input.value = kind === 'new' ? '' : kind === 'copy' ? `${item.name.slice(0, 29)} (copy)` : item.name;
    input.placeholder = 'e.g. Seabrook'; submit.textContent = kind === 'new' ? 'Create town' : kind === 'copy' ? 'Create copy' : 'Save name';
    message(''); input.focus(); input.select(); editor.scrollIntoView({ block: 'nearest' });
  }
  editor.onsubmit = event => {
    event.preventDefault(); if (!guard()) return;
    const result = operation === 'new' ? library.create(input.value, getState()) : operation === 'copy'
      ? library.duplicate(source.slotId, source.townId, input.value, getState()) : library.rename(source.slotId, source.townId, input.value, getState());
    if (!result.ok) { message(result.reason, true); return; }
    editor.hidden = true; render();
    if (operation === 'new') { openTown({ slotId: result.id, townId: 'home' }); return; }
    message(operation === 'copy' ? `“${input.value.trim()}” saved. Your original town is unchanged.` : 'Town name saved.');
    const target = [...list.querySelectorAll('article')].find(card => card.dataset.slot === (result.id || source.slotId) && card.dataset.town === (result.townId || source.townId));
    target?.querySelector('button')?.focus(); target?.scrollIntoView({ block: 'nearest' });
  };
  function download(item) {
    if (!persist()) return;
    const raw = library.exportTown(item.slotId, item.townId); if (!raw) { message('This town could not be exported.', true); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' })), link = el('a');
    link.href = url; link.download = `${item.name.replace(/[^a-z0-9_-]/gi, '-').slice(0, 40)}-day-${item.day}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function render() {
    list.replaceChildren(); newButton.disabled = library.blocked;
    for (const item of library.list()) {
      const card = el('article', `town-save${item.active ? ' current' : ''}`); card.dataset.slot = item.slotId; card.dataset.town = item.townId;
      const body = el('div', 'town-save-body'); body.append(el('h3', '', item.name), el('p', 'town-save-meta', `Day ${item.day} · ${item.population} residents`));
      const tags = [item.active && 'Current town', item.paired && 'Local companion pair', item.linked && 'Online partnership'].filter(Boolean);
      body.append(el('p', 'town-save-tags', tags.join(' · ')));
      const actions = el('div', 'town-save-actions');
      actions.append(button('Continue', () => openTown(item), 'primary'), button('Duplicate', () => edit('copy', item)));
      const extras = el('div', 'town-save-extras'); extras.append(button('Rename', () => edit('rename', item)), button('Download', () => download(item)));
      for (const node of [...actions.children, ...extras.children]) node.disabled = library.blocked;
      body.append(actions, extras); card.append(preview(item.state), body); list.append(card);
    }
    if (!list.children.length) list.append(el('p', 'town-empty', library.blocked ? 'Your saved records are kept on this device.' : 'Your first island starts here. Choose a name, then build a home for the founders.'));
  }
  function open({ create = false } = {}) {
    priorFocus = document.activeElement; beforeOpen(); message(''); editor.hidden = true;
    const saved = persist(); render(); dialog.showModal();
    if (library.blocked) message(library.reason, true);
    if (create && saved && !library.blocked) edit('new'); else close.focus();
  }
  dialog.addEventListener('close', () => { if (priorFocus?.isConnected && priorFocus.getClientRects().length) priorFocus.focus({ preventScroll: true }); });
  return { open };
}
