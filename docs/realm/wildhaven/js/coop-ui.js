import { COOP_COST, COOP_KEYS, emptyCargo, roomSeat, totalCargo } from './coop-state.js';
import { createCoopView } from './coop-view.js';
import { serialize, restore } from './sim.js';
import { calendarDay } from './calendar.js';
const names = { wood: 'Timber', stone: 'Stone', food: 'Food' };
const el = (tag, cls = '', text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const button = (text, run, cls = '') => { const n = el('button', cls, text); n.type = 'button'; n.onclick = run; return n; };
const cargoText = bag => COOP_KEYS.filter(k => bag[k]).map(k => `${bag[k]} ${names[k].toLowerCase()}`).join(', ') || 'No deliveries yet';

export function createCoopUI({ coop, getState, beforeOpen, openLocal, importState, cloneModel, announce }) {
  const panel = el('aside', 'coop-panel'); panel.id = 'coop-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Play together');
  const heading = el('div', 'coop-heading'); heading.append(el('h2', '', 'Play together'));
  const closeButton = button('×', close); closeButton.setAttribute('aria-label', 'Close Play together'); heading.append(closeButton);
  const status = el('p', 'coop-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const content = el('div', 'coop-content'); content.tabIndex = 0; panel.append(heading, status, content); document.getElementById('hud').append(panel);
  const toggle = button('Play together', () => panel.hidden ? open() : close()); toggle.id = 'coop-toggle'; toggle.setAttribute('aria-controls', panel.id); toggle.setAttribute('aria-expanded', 'false');
  document.querySelector('.controls-hint>div').append(toggle);
  // One dock entry. The existing local towns are still reachable inside this book.
  document.getElementById('companion-toggle').hidden = true;
  const canvas = el('canvas', 'coop-worksite'); canvas.setAttribute('aria-label', 'Shared storehouse worksite'); canvas.setAttribute('role', 'img');
  let view = null, signature = '', priorFocus = null, values = {}, candidate = null, backupMade = false, confirmEnd = false;
  const incoming = new URLSearchParams(location.hash.slice(1)).get('join') || '';
  if (incoming) values['coop-invitation'] = incoming;
  let layoutFrame = null;
  function layout() {
    layoutFrame = null;
    const viewport = window.visualViewport, focused = document.activeElement;
    const editing = !panel.hidden && panel.contains(focused) && focused.matches('input:not([type="file"])');
    if (editing && viewport && viewport.scale === 1 && innerHeight - viewport.height > 120) {
      panel.dataset.keyboard = 'open';
      panel.style.setProperty('--coop-keyboard-top', `${viewport.offsetTop + 8}px`);
      panel.style.setProperty('--coop-keyboard-height', `${Math.max(120, viewport.height - 16)}px`);
    } else delete panel.dataset.keyboard;
    if (editing) {
      const field = focused.getBoundingClientRect(), area = content.getBoundingClientRect();
      if (field.bottom > area.bottom - 16) content.scrollTop += field.bottom - area.bottom + 16;
      else if (field.top < area.top + 12) content.scrollTop -= area.top + 12 - field.top;
    }
  }
  function queueLayout() { if (layoutFrame === null) layoutFrame = requestAnimationFrame(layout); }
  window.addEventListener('resize', queueLayout);
  window.visualViewport?.addEventListener('resize', queueLayout);
  window.visualViewport?.addEventListener('scroll', queueLayout);
  panel.addEventListener('focusin', queueLayout); panel.addEventListener('focusout', queueLayout);

  function field(label, id, type = 'text', options = {}) {
    const wrap = el('label', 'coop-field', label), input = el('input'); input.id = id; input.type = type; input.value = values[id] || ''; input.required = options.required !== false;
    for (const [k, v] of Object.entries(options)) if (k !== 'required') input.setAttribute(k, v);
    input.oninput = () => { values[id] = input.value; }; wrap.append(input); return { wrap, input };
  }
  function action(text, run, cls = '') { const b = button(text, async () => { await run(); update(true); }, cls); b.disabled = coop.info().busy; return b; }
  function invitationLink(room) { const url = new URL(location.href); url.search = ''; url.hash = new URLSearchParams({ join: `${getState().coop.link.roomId}.${room.invite}` }).toString(); return url.href; }
  function authForm() {
    content.append(el('p', 'coop-lead', 'Two towns. One shared project.'), el('p', '', 'Keep building your own town and supply a storehouse together. Both towns earn more storage. Play at the same time or contribute whenever you’re here.'));
    const form = el('form', 'coop-form');
    const email = field('Email', 'coop-email', 'email', { autocomplete: 'username', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' });
    const password = field('Password', 'coop-password', 'password', { autocomplete: 'current-password', minlength: '10' });
    const actions = el('div', 'coop-actions');
    for (const [text, value] of [['Create account','create'],['Sign in','signin']]) { const b = el('button', value === 'create' ? 'primary' : '', text); b.type = 'submit'; b.value = value; b.disabled = coop.info().busy; actions.append(b); }
    form.append(email.wrap, password.wrap, actions);
    form.onsubmit = async e => { e.preventDefault(); await coop.signIn(email.input.value, password.input.value, e.submitter?.value === 'create'); if (coop.info().user) { values['coop-password'] = ''; } update(true); };
    form.append(action('Reset password', async () => { if (email.input.reportValidity()) await coop.reset(email.input.value); }));
    content.append(form, el('p', 'coop-fine', 'Your email is used for sign-in and recovery. Your partner sees only your town name and project contributions. Town saves stay on your device.'));
  }
  function setup(info) {
    if (info.local?.draft) {
      content.append(el('h3', '', 'Finish connecting'), el('p', '', 'The last request has not been confirmed. Reconnect to check whether it succeeded.'),
        action('Reconnect', () => coop.reconnect(), 'primary'), action('Cancel pending invitation', () => coop.cancelDraft())); return;
    }
    content.append(el('h3', '', 'Connect your town'), el('p', '', 'Create a private partnership, then give the invitation to your partner. Each of you keeps control of your own town.'));
    const form = el('form', 'coop-form'), name = field('Your town’s name', 'coop-town-name', 'text', { maxlength: '40', autocomplete: 'off' });
    const invitation = field('Invitation link or code', 'coop-invitation', 'text', { required: false, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    const actions = el('div', 'coop-actions');
    const create = el('button', 'primary', 'Create partnership'); create.type = 'submit'; create.value = 'create'; create.disabled = info.busy;
    const join = el('button', '', 'Join partner'); join.type = 'submit'; join.value = 'join'; join.disabled = info.busy; actions.append(create, join);
    form.append(name.wrap, invitation.wrap, actions);
    form.onsubmit = async e => { e.preventDefault(); if (e.submitter?.value === 'join') await coop.join(name.input.value, invitation.input.value); else await coop.create(name.input.value); update(true); };
    content.append(form, el('p', 'coop-fine', 'No shared controls or attacks between towns. Your town pauses when you close the game. Invitations expire after seven days and can be revoked.'));
  }
  function project(info) {
    const room = info.room, state = getState(), seat = roomSeat(room, info.user.uid, state.coop.townId);
    content.append(canvas);
    const towns = el('div', 'coop-town-pair');
    for (const role of ['owner','guest']) { const box = el('div'); box.append(el('strong', '', room[`${role}Name`] || 'Waiting for your partner'), el('small', '', role === seat ? 'Your town' : room[role] ? 'Partner’s town' : 'Send an invitation')); towns.append(box); }
    content.append(towns);
    if (!room.guest && !room.closed && room.owner === info.user.uid) {
      const inviteBox = el('section', 'coop-invite');
      if (room.invite && room.inviteExpires.getTime() > Date.now()) {
        const label = el('label', 'coop-field', 'Private invitation'), link = el('input'); link.readOnly = true; link.value = invitationLink(room); link.setAttribute('aria-label', 'Private invitation link'); label.append(link);
        inviteBox.append(label, action('Copy invitation', async () => { try { await navigator.clipboard.writeText(link.value); announce('Invitation copied. Send it to your partner.'); } catch { link.select(); announce('Select and copy the invitation link.'); } }, 'primary'));
      } else inviteBox.append(el('p', '', 'There is no active invitation. Create one to let your partner join.'));
      const controls = el('div', 'coop-actions'); controls.append(action('New invitation', () => coop.changeInvitation(false)), action('Revoke invitation', () => coop.changeInvitation(true))); inviteBox.append(controls); content.append(inviteBox);
    }
    content.append(el('h3', '', room.completed ? 'Storehouse complete' : 'Build a shared storehouse'), el('p', '', room.completed ? 'Both towns have earned 20 extra storage for each stored supply. This benefit stays if the partnership ends.' : 'Supply timber, stone and food. Finish the storehouse to add 20 storage for each stored supply in both towns.'));
    const progress = el('progress'); progress.max = 140; progress.value = totalCargo(room.totals); progress.setAttribute('aria-label', 'Storehouse supplies'); content.append(progress);
    const ledger = el('table', 'coop-ledger'), caption = el('caption', '', 'Supplies delivered'); ledger.append(caption);
    const head = el('tr'); for (const text of ['Supply', room.ownerName, room.guestName || 'Partner', 'Still needed']) head.append(el('th', '', text)); const thead = el('thead'); thead.append(head); ledger.append(thead);
    const tbody = el('tbody'); for (const k of COOP_KEYS) { const row = el('tr'); row.append(el('th', '', names[k]), el('td', '', room.supplied.owner[k]), el('td', '', room.supplied.guest[k]), el('td', '', COOP_COST[k] - room.totals[k])); tbody.append(row); } ledger.append(tbody); content.append(ledger);
    if (state.coop.pending) content.append(el('p', 'coop-notice', `Checking a reserved delivery: ${cargoText(state.coop.pending.requested)}. These supplies are held safely until the service confirms the result.`));
    if (!room.completed && !room.closed && room.guest && !info.recovery && !state.coop.pending) {
      const form = el('form', 'coop-form'); const fields = {};
      const row = el('div', 'coop-cargo-fields');
      for (const k of COOP_KEYS) {
        const available = Math.max(0, Math.min(Math.floor(state.resources[k]), COOP_COST[k] - room.totals[k]));
        const f = field(`${names[k]} · ${Math.floor(state.resources[k])} in your stores`, `coop-send-${k}`, 'number', { min: '0', max: String(available), step: '1', inputmode: 'numeric' });
        f.input.value = Math.min(Number(values[f.input.id] || 0), available); fields[k] = f.input; row.append(f.wrap);
      }
      const send = el('button', 'primary', 'Send supplies'); send.type = 'submit'; send.disabled = info.busy;
      const choose = button('Fill remaining supplies', () => { for (const k of COOP_KEYS) { fields[k].value = fields[k].max; values[fields[k].id] = fields[k].value; } }); choose.disabled = info.busy;
      const actions = el('div', 'coop-actions'); actions.append(send, choose); form.append(row, actions);
      form.onsubmit = async e => { e.preventDefault(); const bag = emptyCargo(); for (const k of COOP_KEYS) bag[k] = Number(fields[k].value); await coop.contribute(bag); for (const k of COOP_KEYS) values[`coop-send-${k}`] = ''; update(true); };
      content.append(form, el('p', 'coop-fine', 'Send any share you like. Supplies are taken from this town only. Keep enough food for your residents.'));
    }
    if (room.closed) content.append(el('p', 'coop-notice', 'This partnership has ended. Its confirmed progress is kept.'), action('Unlink this town', () => coop.unlink()));
    else {
      const details = el('details', 'coop-settings'); details.append(el('summary', '', 'Partnership settings'));
      if (!confirmEnd) details.append(action('End partnership…', async () => { confirmEnd = true; }));
      else { details.open = true; details.append(el('p', '', 'End this partnership for both towns? Further deliveries will stop. Towns and earned storage are kept.'), action('End partnership for both towns', async () => { await coop.closePartnership(); confirmEnd = false; }), button('Keep playing together', () => { confirmEnd = false; update(true); })); }
      content.append(details);
    }
  }
  function backup(info) {
    const section = el('details', 'coop-settings'); section.append(el('summary', '', 'Town backup & moving devices'));
    section.append(el('p', '', 'Your account recovers the partnership, not the town on this device. Download a town backup before clearing browser data or moving. Use one device at a time for each town.'));
    const download = button('Download town backup', () => {
      const blob = new Blob([serialize(getState())], { type: 'application/json' }), url = URL.createObjectURL(blob), a = el('a');
      a.href = url; a.download = `island-town-day-${calendarDay(getState())}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); backupMade = true; update(true);
    }); download.disabled = info.busy || !info.available;
    const label = el('label', 'coop-field', 'Import a town backup'), input = el('input'); input.type = 'file'; input.accept = '.json,application/json'; input.disabled = info.busy || !info.available;
    input.onchange = async () => { const file = input.files[0]; if (!file) return;
      if (file.size > 2000000) { announce('That file is too large for a town backup.', true); return; }
      candidate = restore(await file.text()); backupMade = false; if (!candidate) announce('That file is not a valid town save. Your town is unchanged.', true); update(true);
    }; label.append(input); section.append(download, label);
    if (candidate) { section.open = true; section.append(el('p', 'coop-notice', `Replace this device’s town with the backup from day ${calendarDay(candidate)} (${candidate.population} residents)? Download the current town first.`));
      const confirm = button('Restore this backup', () => { const result = importState(candidate); if (result.ok) { candidate = null; backupMade = false; coop.reconnect(); } else announce(result.reason, true); update(true); }); confirm.disabled = !backupMade || info.busy;
      section.append(confirm, button('Cancel import', () => { candidate = null; update(true); }));
    }
    content.append(section);
  }
  function update(force = false) {
    const info = coop.info(); toggle.classList.toggle('coop-complete', !!info.room?.completed);
    if (panel.hidden) return;
    status.textContent = info.message || (info.busy ? 'Connecting…' : info.connected ? 'Connected · project updates every 15 seconds' : info.user ? 'Not connected · your town is saved locally' : 'Private co-op for two players');
    status.classList.toggle('is-error', !!info.message && !info.connected);
    const next = JSON.stringify([info.user, info.room, info.local?.pending, info.local?.draft, info.local?.storehouse, info.recovery, info.available, info.busy, !!candidate, backupMade, confirmEnd]);
    if (!force && next === signature) return;
    // Polls must not replace an input while someone is typing or selecting text.
    const focused = panel.contains(document.activeElement) ? document.activeElement.id : null;
    if (!force && document.activeElement.matches('input') && panel.contains(document.activeElement)) return;
    signature = next; const scroll = content.scrollTop;
    const openDetails = [...content.querySelectorAll('details')].map(n => n.open);
    content.replaceChildren();
    if (!info.available) content.append(el('p', 'coop-notice', 'Online play uses your home town. Return home from local companion towns to connect.'));
    else if (!info.configured) content.append(el('p', 'coop-notice', 'Online play is not configured in this build. Your town remains playable offline.'));
    else if (!info.user) authForm();
    else {
      content.append(el('p', 'coop-account', `Signed in as ${info.user.email}`));
      if (info.recovery) content.append(el('p', 'coop-notice', info.recovery));
      if (info.room) project(info); else if (!info.recovery) setup(info);
      const actions = el('div', 'coop-actions'); actions.append(action('Reconnect', () => coop.reconnect()), action('Sign out', () => coop.signOut())); content.append(actions);
    }
    backup(info);
    content.append(button('Local companion towns on this device', () => { close(); openLocal(); }, 'coop-local'));
    [...content.querySelectorAll('details')].forEach((n, i) => { if (openDetails[i]) n.open = true; });
    content.scrollTop = scroll;
    if (info.room && canvas.isConnected) { try { view ||= createCoopView(canvas, cloneModel); view.draw(info.room); } catch { canvas.hidden = true; } }
    if (focused) document.getElementById(focused)?.focus({ preventScroll: true });
  }
  function open() { beforeOpen(); priorFocus = document.activeElement; panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); document.body.classList.add('coop-active'); update(true); closeButton.focus({ preventScroll: true }); coop.reconnect(); }
  function close() { if (panel.hidden) return; panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); document.body.classList.remove('coop-active'); delete panel.dataset.keyboard; priorFocus?.focus?.({ preventScroll: true }); }
  return { open, close, update, get active() { return !panel.hidden; }, incoming: !!incoming };
}
