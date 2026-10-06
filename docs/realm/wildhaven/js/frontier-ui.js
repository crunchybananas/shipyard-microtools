import * as frontier from './frontier.js';
import { RESOURCES } from './catalog.js';
import { ISLAND_BOUNDS, ISLAND_REGIONS, ISLAND_NEIGHBORS, terrainAt, regionAt, isLand } from './island.js';

const el = (tag, className = '', text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const amount = value => Math.round((Number(value) || 0) * 10) / 10;
const goods = bag => Object.entries(bag || {}).filter(([, n]) => n > 0)
  .map(([key, n]) => `${amount(n)} ${RESOURCES[key]?.name.toLowerCase() || key}`).join(' · ') || 'No materials';
const button = (label, id, fn, options = {}) => {
  const node = el('button', options.className || '', label);
  node.type = 'button'; node.dataset.frontierAction = id; node.onclick = fn;
  node.disabled = !!options.disabled;
  if (options.reason) node.title = options.reason;
  if (options.pressed !== undefined) node.setAttribute('aria-pressed', String(options.pressed));
  return node;
};
const meter = (value, max) => {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const bar = el('div', `frontier-health${ratio < .5 ? ' wounded' : ''}`), fill = el('span');
  bar.setAttribute('role', 'meter'); bar.setAttribute('aria-label', 'Health');
  bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(max));
  bar.setAttribute('aria-valuenow', String(value)); fill.style.width = `${ratio * 100}%`; bar.append(fill); return bar;
};
const section = title => el('h3', 'frontier-section', title);
// Keep controls mounted while health, training and construction numbers change.
// Replacing the entire live panel every tick can swallow pointer or touch clicks.
function reconcile(parent, incoming) {
  for (let i = 0; i < incoming.length; i++) {
    const next = incoming[i], current = parent.childNodes[i];
    if (!current) { parent.append(next); continue; }
    if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) { current.replaceWith(next); continue; }
    if (next.nodeType === Node.TEXT_NODE) { if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue; continue; }
    for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
    for (const attr of next.attributes) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
    current.onclick = next.onclick; current.onchange = next.onchange;
    if ('checked' in next) current.checked = next.checked;
    reconcile(current, [...next.childNodes]);
    if (next.nodeName === 'SELECT') current.value = next.value;
  }
  while (parent.childNodes.length > incoming.length) parent.lastChild.remove();
}
const intro = text => el('p', 'frontier-intro', text);
const row = (name, status) => {
  const node = el('div', 'frontier-row'), heading = el('div', 'frontier-row-title');
  heading.append(el('strong', '', name));
  if (status) heading.append(el('span', `frontier-tag${status === 'At war' ? ' hostile' : ''}`, status));
  node.append(heading); return node;
};

/** DOM-only controls. Simulation owns costs, legality, movement and outcomes.
 * Root forwards world taps/hover before ordinary building interaction.
 * preview receives null or {kind, type?, start?, end?, cells?, valid, target?}.
 * focus receives {kind, id, x, z}; no Three.js dependency enters the UI.
 */
export function createFrontierUI({ getState, mutate, getContext = () => ({}), beforeOpen = () => {}, focus = () => {}, preview = () => {}, onSelection = () => {}, api = frontier, mount = document.getElementById('hud') }) {
  if (!mount) throw new Error('Frontier controls need the game HUD.');
  let tab = null, selected = null, command = null, hovered = null, signature = '', confirmation = null;
  const draftResidents = new Map();
  const selectedTroops = new Set();
  const panel = el('aside'); panel.id = 'frontier-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'Frontier');
  const heading = el('div', 'frontier-heading'), title = el('h2', '', 'Beyond the village'); title.id = 'frontier-title';
  const closeButton = button('×', 'close', () => close()); closeButton.setAttribute('aria-label', 'Close frontier');
  heading.append(title, closeButton);
  const tabs = el('nav', 'frontier-tabs'); tabs.setAttribute('aria-label', 'Frontier sections');
  for (const [key, label] of [['defenses', 'Defenses'], ['company', 'Company'], ['neighbors', 'Neighbors']]) tabs.append(button(label, `tab-${key}`, () => open(key)));
  const content = el('div'); content.id = 'frontier-content'; content.tabIndex = 0; content.setAttribute('role', 'region'); content.setAttribute('aria-labelledby', title.id);
  panel.append(heading, tabs, content);
  const strip = el('div'); strip.id = 'frontier-command'; strip.hidden = true;
  const prompt = el('div'), promptTitle = el('strong'), promptDetail = el('p'); promptDetail.setAttribute('role', 'status');
  prompt.append(promptTitle, promptDetail); const rotateButton = button('Rotate', 'rotate-command', () => rotateCommand());
  const buildLineButton = button('Build line', 'commit-wall-line', () => commitWallLine());
  rotateButton.hidden = true; buildLineButton.hidden = true; strip.append(prompt, rotateButton, buildLineButton, button('Cancel', 'cancel-command', () => cancelCommand()));
  const toggle = button('Frontier', 'toggle', () => tab ? close() : open('neighbors')); toggle.id = 'frontier-toggle'; toggle.setAttribute('aria-controls', panel.id); toggle.setAttribute('aria-pressed', 'false');
  mount.append(panel, strip, toggle);

  function action(result) {
    mutate(result); signature = ''; confirmation = null; update(true); return result;
  }
  function open(next = 'neighbors') {
    beforeOpen(); cancelCommand(false); tab = next; selected = null; confirmation = null;
    panel.hidden = false; toggle.setAttribute('aria-pressed', 'true'); document.body.classList.add('frontier-view-active');
    content.scrollTop = 0; signature = ''; update(true);
  }
  function close() {
    tab = null; selected = null; confirmation = null; panel.hidden = true; toggle.setAttribute('aria-pressed', 'false');
    document.body.classList.remove('frontier-view-active'); cancelCommand(false); syncSelection();
  }
  function select(kind, id, { additive = false } = {}) {
    beforeOpen(); cancelCommand(false); confirmation = null;
    const picked = kind === 'troop' ? api.frontierOptions(getState(), getContext()).units.find(unit => unit.id === id) : null;
    if (picked && picked.faction !== 'player') kind = 'enemy';
    selected = { kind, id }; tab = ['troop', 'enemy'].includes(kind) ? 'company' : kind === 'fortification' ? 'defenses' : 'neighbors';
    if (kind === 'troop') { if (!additive) selectedTroops.clear(); if (additive && selectedTroops.has(id)) selectedTroops.delete(id); else selectedTroops.add(id); }
    panel.hidden = false; toggle.setAttribute('aria-pressed', 'true'); document.body.classList.add('frontier-view-active'); content.scrollTop = 0; update(true);
  }
  function begin(next) {
    command = next; confirmation = null; hovered = null; panel.hidden = true; document.body.classList.remove('frontier-view-active');
    document.body.classList.add('frontier-command-active'); strip.hidden = false; updateCommand();
  }
  function cancelCommand(reopen = true) {
    if (!command) return false;
    command = null; hovered = null; strip.hidden = true; document.body.classList.remove('frontier-command-active'); preview(null);
    if (reopen && tab) { panel.hidden = false; document.body.classList.add('frontier-view-active'); update(true); }
    return true;
  }
  function controls(node, items) {
    const actions = el('div', 'frontier-actions');
    for (const item of items) actions.append(button(item.label, item.id, item.run, item));
    node.append(actions);
  }
  function quote(node, option, label = 'Cost') {
    node.append(el('p', 'frontier-cost', `${label}: ${goods(option.cost)}`));
    if (option.ok === false && option.reason) node.append(el('p', 'frontier-reason', option.reason));
  }
  function ask(id, name, detail, execute, cancelLabel = 'Keep the peace') {
    confirmation = { id, name, detail, execute, cancelLabel }; signature = ''; content.scrollTop = 0; update(true);
  }
  function confirmContent(nodes) {
    if (!confirmation) return;
    const card = el('div', 'frontier-diplomacy'); card.setAttribute('role', 'group'); card.setAttribute('aria-label', 'Confirm consequences');
    card.append(el('strong', '', confirmation.name), el('p', '', confirmation.detail));
    controls(card, [{ label: confirmation.name, id: `confirm-${confirmation.id}`, className: 'danger', run: () => action(confirmation.execute()) }, { label: confirmation.cancelLabel, id: 'cancel-confirm', run: () => { confirmation = null; update(true); } }]);
    nodes.unshift(card);
  }

  function logContent(state) {
    const entries = api.frontierOptions(state, getContext()).log || [];
    if (!entries.length) return [];
    const list = el('ol', 'frontier-log');
    for (const event of entries.slice(0, 8)) {
      const item = el('li'); item.append(el('small', '', `Day ${event.day ?? state.day}`), document.createTextNode(event.text || event.message || event.reason || 'Activity on the frontier.')); list.append(item);
    }
    return [section('Word from the frontier'), list];
  }

  function syncSelection() {
    const alive = new Set(api.frontierOptions(getState(), getContext()).units.filter(unit => unit.faction === 'player' && !['dead', 'released'].includes(unit.status)).map(unit => unit.id));
    for (const id of selectedTroops) if (!alive.has(id)) selectedTroops.delete(id);
    onSelection({ unitIds: [...selectedTroops], fortId: selected?.kind === 'fortification' ? selected.id : null, neighborId: selected?.kind === 'neighbor' ? selected.id : null, regionId: selected?.kind === 'region' ? selected.id : null });
  }
  function update(force = false) {
    syncSelection();
    const overview = api.frontierOptions(getState(), getContext());
    toggle.classList.toggle('threatened', !!overview.warning || overview.activeBattles > 0);
    toggle.textContent = overview.activeBattles > 0 ? 'Frontier !' : 'Frontier';
    toggle.setAttribute('aria-label', overview.activeBattles > 0 ? `Frontier, ${overview.activeBattles} hostile troops` : overview.warning ? 'Frontier, approaching raid' : 'Open frontier');
    if (command) updateCommand();
    if (!tab || panel.hidden) return;
    const state = getState();
    const next = JSON.stringify([tab, selected, [...selectedTroops], confirmation?.id, state.frontier, state.resources, state.research, state.day, state.population]);
    if (!force && next === signature) return;
    signature = next;
    const active = content.contains(document.activeElement) ? document.activeElement.dataset.frontierAction : null, scroll = content.scrollTop;
    title.textContent = selected?.kind === 'troop' ? 'The field company' : selected?.kind === 'fortification' ? 'At the town boundary' : { defenses: 'Keep a way home', company: 'The field company', neighbors: 'Along the island' }[tab];
    tabs.querySelectorAll('button').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.frontierAction === `tab-${tab}`)));
    const nodes = tab === 'defenses' ? defensesContent(state) : tab === 'company' ? companyContent(state) : neighborsContent(state);
    const alert = warningContent(overview); if (alert) nodes.unshift(alert);
    confirmContent(nodes); reconcile(content, nodes); content.scrollTop = scroll;
    if (tab === 'neighbors') paintChart(content.querySelector('.frontier-chart'), state);
    if (active) content.querySelector(`[data-frontier-action="${CSS.escape(active)}"]`)?.focus({ preventScroll: true });
  }

  function warningContent(overview) {
    if (!overview.warning && !overview.activeBattles) return null;
    const card = el('div', 'frontier-warning');
    card.append(el('strong', '', overview.warning ? 'Sails on the northern shore' : 'Fighting on the island'));
    if (overview.warning) {
      const seconds = Math.max(0, overview.warning.attackAt - overview.clock);
      card.append(el('p', '', `${overview.warning.amount} raiders are expected in ${Math.ceil(seconds)} seconds. Train defenders and keep a route home.`));
      controls(card, [{ label: 'Find their landing', id: 'find-raider-landing', run: () => { close(); focus({ ...overview.warning.entry, kind: 'region-point' }); } }]);
    } else card.append(el('p', '', `${overview.activeBattles} hostile troops are on the island. Orders and damage continue while time runs.`));
    return card;
  }
  function defensesContent(state) {
    const overview = api.frontierOptions(state, getContext()), forts = overview.fortifications.filter(item => item.faction === 'player'), nodes = [intro('Keep a gate in the route home. Walls and closed gates stop passage; towers cover nearby ground. One named engineer leaves their usual work to build each project.')];
    const fort = forts.find(item => item.id === selected?.id);
    if (fort) {
      const card = el('div', 'frontier-selection');
      card.append(el('h3', '', fort.name || fort.type), meter(fort.hp, fort.maxHp), el('p', '', `${amount(fort.hp)} / ${amount(fort.maxHp)} health`));
      const pending = fort.status === 'building';
      if (pending) card.append(el('p', '', `Under construction · ${Math.round(100 * Math.min(1, (fort.progress || 0) / (fort.work || fort.workRequired || 1)))}% complete${fort.engineerName ? ` · ${fort.engineerName} is building` : ''}`));
      const repair = api.repairOffer(state, fort.id);
      quote(card, repair, 'Repair');
      const actions = [{ label: 'Repair', id: `repair-${fort.id}`, disabled: !repair.ok, reason: repair.reason, run: () => action(api.repairFortification(state, fort.id, getContext())) }];
      if (fort.type === 'gate') actions.unshift({ label: fort.open ? 'Close gate' : 'Open gate', id: `gate-${fort.id}`, disabled: pending, run: () => action(api.setGateOpen(state, fort.id, !fort.open, getContext())) });
      actions.push({ label: 'Find on island', id: `find-fort-${fort.id}`, run: () => focus({ ...fort, kind: 'fortification' }) });
      if (pending) actions.push({ label: 'Cancel unfinished work', id: `cancel-fort-${fort.id}`, run: () => action(api.cancelFortification(state, fort.id)) });
      controls(card, actions); nodes.push(card);
      if (!pending) {
        const salvage = api.salvageOffer(state, fort.id, getContext());
        card.append(el('p', 'frontier-cost', `Salvage returns: ${goods(salvage.refund)}.`));
        if (!salvage.ok) card.append(el('p', 'frontier-reason', salvage.reason));
        if (salvage.regionId) card.append(el('p', '', 'Removing this outpost closes the region to new construction. Existing homes and workshops stay.'));
        controls(card, [{ label: 'Salvage defense', id: `salvage-${fort.id}`, disabled: !salvage.ok, reason: salvage.reason, run: () => salvage.regionId ? ask(`salvage-${fort.id}`, 'Remove the outpost', `This land will need a new claiming outpost before more buildings can be placed. Existing homes and workshops stay. You recover ${goods(salvage.refund)}.`, () => api.salvageFortification(state, fort.id, getContext()), 'Keep the outpost') : action(api.salvageFortification(state, fort.id, getContext())) }]);
      }
    }
    for (const option of api.fortificationOptions(state)) {
      const card = row(option.name); card.append(el('p', '', option.description)); quote(card, option);
      card.append(el('p', '', `${option.work} engineer-seconds · ${option.maxHp} health when complete`));
      const commands = [{ label: option.id === 'outpost' ? 'Choose land to claim' : 'Choose a site', id: `place-${option.id}`, disabled: option.id !== 'outpost' && !option.ok, reason: option.reason, run: () => {
        if (option.id === 'outpost') { open('neighbors'); content.querySelector('[data-frontier-section="claims"]')?.scrollIntoView({ block: 'start' }); }
        else begin({ kind: 'fortification', type: option.id, rotation: 0 });
      } }];
      if (option.id === 'wall' || option.id === 'palisade' || option.line) commands.push({ label: 'Draw a wall line', id: `line-${option.id}`, disabled: !option.ok, reason: option.reason, run: () => begin({ kind: 'wall-line', type: option.id, start: null }) });
      controls(card, commands); nodes.push(card);
    }
    if (forts.length) {
      nodes.push(section('Along your boundary'));
      for (const item of forts) {
        const card = row(item.name || item.type, item.status === 'ready' ? `${Math.round(item.hp)} / ${item.maxHp}` : 'Building');
        controls(card, [{ label: item.type === 'gate' ? `${item.open ? 'Open' : 'Closed'} gate · inspect` : 'Inspect', id: `inspect-fort-${item.id}`, run: () => select('fortification', item.id) }]); nodes.push(card);
      }
    }
    return nodes;
  }
  function companyContent(state) {
    const overview = api.frontierOptions(state, getContext()), units = overview.units.filter(item => item.faction === 'player' && ['spearman', 'archer'].includes(item.kind) && !['dead', 'released'].includes(item.status));
    const nodes = [intro('Recruit residents into the company. Training, duty and recovery take them away from town jobs. Move near unfamiliar ground to scout it; keep wounded people out of a fight.')];
    for (const id of [...selectedTroops]) if (!units.some(item => item.id === id)) selectedTroops.delete(id);
    const enemy = selected?.kind === 'enemy' ? overview.units.find(unit => unit.id === selected.id) : null;
    if (enemy) {
      const card = el('div', 'frontier-selection'); card.append(el('h3', '', enemy.name), meter(enemy.hp, enemy.maxHp), el('p', '', `${enemy.kind} · ${Math.round(enemy.hp)} / ${enemy.maxHp} health · ${enemy.status}`), el('p', '', 'Select your company, choose Attack, then choose this target on the island.')); nodes.push(card);
    }
    const chosen = units.filter(item => selectedTroops.has(item.id));
    if (chosen.length) {
      const card = el('div', 'frontier-selection');
      card.append(el('h3', '', chosen.length === 1 ? chosen[0].name || 'Selected resident' : `${chosen.length} selected`));
      const health = chosen.reduce((n, unit) => n + unit.hp, 0), max = chosen.reduce((n, unit) => n + unit.maxHp, 0);
      card.append(meter(health, max), el('p', '', `${amount(health)} / ${amount(max)} health · ${chosen.map(unit => unit.status || unit.order?.type || 'Ready').join(', ')}`));
      const ids = chosen.map(unit => unit.id), unavailable = chosen.some(unit => unit.status !== 'active');
      if (unavailable) card.append(el('p', 'frontier-reason', 'Only trained, healthy residents can take field orders. Deselect anyone still training or recovering.'));
      for (const unit of chosen.filter(unit => unit.status === 'training')) card.append(el('p', '', `${unit.name}: ${Math.ceil(unit.trainingRemaining)} seconds of training remain.`));
      controls(card, [
        { label: 'Move', id: 'move', disabled: unavailable, run: () => begin({ kind: 'move', ids }) },
        { label: 'Attack', id: 'attack', disabled: unavailable, run: () => begin({ kind: 'attack', ids }) },
        { label: 'Hold ground', id: 'hold', disabled: unavailable, run: () => action(api.commandTroops(state, ids, { type: 'hold' }, getContext())) },
        { label: 'Retreat home', id: 'retreat', disabled: unavailable, run: () => action(api.commandTroops(state, ids, { type: 'retreat' }, getContext())) },
        { label: 'Clear selection', id: 'clear-units', run: () => { selectedTroops.clear(); selected = null; update(true); } },
      ]);
      if (chosen.length === 1) {
        const unit = chosen[0], offer = api.healOffer(state, unit.id, getContext()); quote(card, offer, 'Recovery');
        controls(card, [{ label: 'Tend wounds', id: `heal-${unit.id}`, disabled: !offer.ok, reason: offer.reason, run: () => action(api.healTroop(state, unit.id, getContext())) }]);
        const dismissal = api.dismissOffer(state, unit.id, getContext());
        card.append(el('p', dismissal.ok ? 'frontier-cost' : 'frontier-reason', dismissal.reason));
        controls(card, [{ label: unit.status === 'training' ? 'Cancel training' : 'Return to civilian work', id: `dismiss-${unit.id}`, disabled: !dismissal.ok, reason: dismissal.reason, run: () => action(api.dismissTroop(state, unit.id, getContext())) }]);
      }
      nodes.push(card);
    }
    if (units.length) {
      nodes.push(section('People in the company'));
      const all = el('div'); controls(all, [{ label: 'Select company', id: 'select-company', run: () => { selectedTroops.clear(); units.filter(unit => unit.status === 'active').forEach(unit => selectedTroops.add(unit.id)); update(true); } }]); nodes.push(all);
      for (const unit of units) {
        const item = el('div', 'frontier-unit');
        const pick = button('', `unit-${unit.id}`, () => { selectedTroops.has(unit.id) ? selectedTroops.delete(unit.id) : selectedTroops.add(unit.id); selected = { kind: 'troop', id: unit.id }; update(true); }, { pressed: selectedTroops.has(unit.id) });
        pick.append(el('strong', '', unit.name || unit.citizenName || unit.kind), el('small', '', `${unit.kind} · ${Math.round(unit.hp)} / ${unit.maxHp} health · ${unit.status || unit.order?.type || 'Holding'}`));
        item.append(pick, button('Find', `find-unit-${unit.id}`, () => { close(); focus({ ...unit, kind: 'troop' }); }, { className: 'frontier-locate' })); nodes.push(item);
      }
    } else nodes.push(intro('The company has no recruits yet. A supplied watch-house is where training begins.'));
    const travelers = overview.units.filter(unit => unit.faction === 'player' && ['engineer', 'envoy'].includes(unit.kind) && !['dead', 'released'].includes(unit.status));
    if (travelers.length) {
      nodes.push(section('On a town assignment'));
      for (const unit of travelers) { const item = row(unit.name, unit.kind); item.append(el('p', '', `${Math.round(unit.hp)} / ${unit.maxHp} health · ${unit.order?.type || unit.status}`)); controls(item, [{ label: 'Find', id: `find-traveler-${unit.id}`, run: () => { close(); focus({ ...unit, kind: 'troop' }); } }]); nodes.push(item); }
    }
    nodes.push(section('Recruit a resident'));
    for (const option of api.troopOptions(state)) {
      const card = row(option.name); card.append(el('p', '', option.description)); quote(card, option);
      card.append(el('p', '', `${option.trainingSeconds} seconds to train · ${option.maxHp} health · ${option.damage} base damage · range ${option.range}`));
      const candidates = option.availableCitizens || [], label = el('label', 'frontier-choice', 'Resident'), selectResident = el('select');
      if (!candidates.some(candidate => candidate.id === draftResidents.get(option.id))) draftResidents.delete(option.id);
      selectResident.setAttribute('aria-label', `Resident to train as ${option.name}`); selectResident.dataset.frontierAction = `resident-${option.id}`;
      const auto = el('option', '', 'First available resident'); auto.value = ''; selectResident.append(auto);
      for (const candidate of candidates) { const choice = el('option', '', `${candidate.name} · ${candidate.job || 'Available'}`); choice.value = candidate.id; selectResident.append(choice); }
      selectResident.value = candidates.some(candidate => candidate.id === draftResidents.get(option.id)) ? draftResidents.get(option.id) : '';
      selectResident.onchange = event => draftResidents.set(option.id, event.currentTarget.value || null); label.append(selectResident); card.append(label);
      controls(card, [{ label: 'Begin training', id: `recruit-${option.id}`, className: 'primary', disabled: !option.ok, reason: option.reason, run: () => action(api.recruitTroop(state, option.id, draftResidents.get(option.id) || null, getContext())) }]); nodes.push(card);
    }
    nodes.push(...logContent(state)); return nodes;
  }
  function neighborsContent(state) {
    const nodes = [islandChart(), intro('Send a resident to meet a settlement, or scout it with the company. Contact opens trade and diplomacy. Expansion needs a claim; marching across land does not make it yours.')];
    for (const neighbor of api.neighborOptions(state)) {
      const chosen = selected?.kind === 'neighbor' && selected.id === neighbor.id;
      const card = row(neighbor.name, neighbor.status === 'war' || neighbor.status === 'hostile' ? 'At war' : neighbor.discovered ? neighbor.status || 'Known' : 'Uncontacted');
      card.append(el('p', '', neighbor.discovered ? `Relations ${amount(neighbor.relation)}${neighbor.nextAttackIn !== undefined && neighbor.nextAttackIn !== null ? ` · next attack in ${Math.ceil(neighbor.nextAttackIn)} seconds` : ''}` : 'Their banners are beyond the familiar paths.'));
      const envoy = neighbor.envoy;
      if (!chosen) {
        if (!neighbor.discovered && envoy) quote(card, envoy, 'Envoy provisions');
        controls(card, [{ label: 'Meet & negotiate', id: `neighbor-${neighbor.id}`, run: () => { selected = { kind: 'neighbor', id: neighbor.id }; update(true); } }, { label: 'Find settlement', id: `find-neighbor-${neighbor.id}`, run: () => { close(); focus({ ...neighbor, kind: 'neighbor' }); } }]);
      } else {
        if (neighbor.maxHp) card.append(meter(neighbor.hp, neighbor.maxHp), el('p', '', `${Math.round(neighbor.hp)} / ${neighbor.maxHp} stronghold health`));
        const choices = [
          ['envoy', neighbor.discovered ? 'Send an envoy' : 'Make first contact', () => api.sendEnvoy(state, neighbor.id, null, getContext())],
          ['trade', 'Exchange goods', () => api.tradeWithNeighbor(state, neighbor.id)],
          ['alliance', 'Propose an alliance', () => api.proposeAlliance(state, neighbor.id)],
          ['aid', 'Request aid', () => api.requestAid(state, neighbor.id, getContext())],
          ['truce', 'Offer a truce', () => api.offerTruce(state, neighbor.id)],
          ['war', 'Declare war', () => api.declareWar(state, neighbor.id, getContext())],
        ];
        for (const [id, label, execute] of choices) {
          const offer = neighbor[id]; if (!offer) continue;
          const detail = el('div', 'frontier-row'); detail.append(el('strong', '', label)); quote(detail, offer);
          if (offer.reward) detail.append(el('p', 'frontier-cost', `Receive: ${goods(offer.reward)}`));
          if (id === 'envoy') detail.append(el('p', '', 'A resident walks there and back. Their town job waits while they travel.'));
          if (id === 'war') detail.append(el('p', '', 'Ends peaceful dealings and starts armed conflict. Enemy attacks can wound or kill residents and damage defenses.'));
          controls(detail, [{ label, id: `${id}-${neighbor.id}`, disabled: !offer.ok, reason: offer.reason, className: id === 'war' ? 'danger' : '', run: () => id === 'war' ? ask(`war-${neighbor.id}`, `Declare war on ${neighbor.name}`, 'Trade and peaceful relations end. Prepare a route home and a defense before starting armed conflict.', execute) : action(execute()) }]); card.append(detail);
        }
      }
      nodes.push(card);
    }
    const claimsHeading = section('Room beyond the village'); claimsHeading.dataset.frontierSection = 'claims'; nodes.push(claimsHeading);
    for (const claim of api.claimOptions(state, getContext())) {
      const card = row(claim.name, claim.claimed ? 'Yours' : claim.discovered ? 'Scouted' : 'Unexplored');
      if (claim.description) card.append(el('p', '', claim.description));
      if (!claim.claimed) {
        quote(card, claim, 'Claim');
        if (Array.isArray(claim.requirements)) for (const requirement of claim.requirements) card.append(el('p', '', typeof requirement === 'string' ? requirement : requirement.description || requirement.reason || requirement.name));
        controls(card, [{ label: 'Claim this land', id: `claim-${claim.id}`, disabled: !claim.ok, reason: claim.reason, run: () => action(api.claimRegion(state, claim.id, getContext())) }, { label: 'Find the boundary', id: `find-claim-${claim.id}`, run: () => { close(); focus({ ...claim, kind: 'region' }); } }]);
      } else controls(card, [{ label: 'Find this land', id: `find-claim-${claim.id}`, run: () => { close(); focus({ ...claim, kind: 'region' }); } }]);
      nodes.push(card);
    }
    nodes.push(...logContent(state)); return nodes;
  }
  function chartFrame(canvas) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const spanX = ISLAND_BOUNDS.maxX - ISLAND_BOUNDS.minX + 1, spanZ = ISLAND_BOUNDS.maxZ - ISLAND_BOUNDS.minZ + 1;
    const scale = Math.min((width - 22) / spanX, (height - 18) / spanZ);
    return { width, height, scale, left: (width - spanX * scale) / 2, top: (height - spanZ * scale) / 2 };
  }
  function islandChart() {
    const figure = el('figure', 'frontier-chart-wrap'), canvas = el('canvas', 'frontier-chart');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Island chart. Tap land to look there, or use the Find settlement and Find boundary buttons below.');
    canvas.onclick = event => {
      const node = event.currentTarget, rect = node.getBoundingClientRect(), frame = chartFrame(node);
      const x = (event.clientX - rect.left - frame.left) / frame.scale + ISLAND_BOUNDS.minX;
      const z = (event.clientY - rect.top - frame.top) / frame.scale + ISLAND_BOUNDS.minZ;
      if (isLand(x, z)) { close(); focus({ kind: 'region-point', x, z }); }
    };
    const caption = el('figcaption', '', 'Tap the chart to look across the island.');
    const legend = el('div', 'frontier-chart-legend');
    for (const [color, name] of [['#c6d092', 'Your land'], ['#92ad88', 'Unclaimed'], ['#fff0a4', 'Your company'], ['#af5946', 'Hostile']]) {
      const label = el('span'), swatch = el('i'); swatch.style.background = color; label.append(swatch, document.createTextNode(name)); legend.append(label);
    }
    figure.append(canvas, caption, legend); return figure;
  }
  function paintChart(canvas, state) {
    if (!canvas) return;
    const frame = chartFrame(canvas); if (!frame.width || !frame.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), width = Math.round(frame.width * dpr), height = Math.round(frame.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#84aaa3'; ctx.fillRect(0, 0, frame.width, frame.height);
    const project = (x, z) => ({ x: frame.left + (x - ISLAND_BOUNDS.minX + .5) * frame.scale, y: frame.top + (z - ISLAND_BOUNDS.minZ + .5) * frame.scale });
    const claimed = new Set(['home', ...(state.frontier?.claims || [])]);
    for (let z = ISLAND_BOUNDS.minZ; z <= ISLAND_BOUNDS.maxZ; z++) for (let x = ISLAND_BOUNDS.minX; x <= ISLAND_BOUNDS.maxX; x++) {
      const tile = terrainAt(x, z); if (tile.kind === 'water') continue;
      const point = project(x, z), ours = claimed.has(tile.regionId);
      ctx.fillStyle = tile.kind === 'path' ? '#c8bd8d' : tile.kind === 'rock' ? '#9da69a' : tile.kind === 'forest' ? ours ? '#91a277' : '#6e8e72' : ours ? '#c6d092' : '#92ad88';
      ctx.fillRect(point.x - frame.scale / 2, point.y - frame.scale / 2, frame.scale + .3, frame.scale + .3);
      const neighborRegion = regionAt(x + 1, z)?.id;
      if (neighborRegion && neighborRegion !== tile.regionId) { ctx.fillStyle = '#42665565'; ctx.fillRect(point.x + frame.scale / 2 - .5, point.y - frame.scale / 2, 1, frame.scale); }
    }
    ctx.font = '10px Trebuchet MS, sans-serif'; ctx.textAlign = 'center';
    for (const region of ISLAND_REGIONS) {
      const point = project(region.x, region.z + (region.id === 'crownhill' ? 3 : 1));
      ctx.fillStyle = '#35594ce0'; ctx.fillText(region.name, point.x, point.y);
    }
    const neighbors = api.neighborOptions(state);
    for (const site of ISLAND_NEIGHBORS) {
      const point = project(site.x, site.z), status = neighbors.find(item => item.id === site.id)?.status;
      ctx.fillStyle = ['war', 'hostile'].includes(status) ? '#af5946' : '#f4e8bd'; ctx.strokeStyle = '#375b4d'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = 'bold 10px Trebuchet MS, sans-serif'; ctx.textAlign = site.x < -8 ? 'left' : site.x > 8 ? 'right' : 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = '#d9dfb8'; ctx.strokeText(site.name, point.x, point.y - 7); ctx.fillStyle = '#315442'; ctx.fillText(site.name, point.x, point.y - 7);
    }
    for (const unit of api.frontierOptions(state, getContext()).units) {
      if (['dead', 'released'].includes(unit.status)) continue;
      const point = project(unit.x, unit.z); ctx.fillStyle = unit.faction === 'player' ? '#fff0a4' : '#af5946'; ctx.strokeStyle = '#375347'; ctx.lineWidth = .8;
      ctx.beginPath(); ctx.arc(point.x, point.y, unit.faction === 'player' ? 2.5 : 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  function commandQuote() {
    if (!command || !(command.end || hovered)) return { ok: false, reason: 'Choose a point on the island.' };
    const state = getState();
    if (command.kind === 'fortification') return api.canPlaceFortification(state, command.type, hovered.x, hovered.z, command.rotation || 0, getContext());
    if (command.kind === 'wall-line' && command.start) return api.planWallLine(state, command.type, command.start, command.end || hovered, getContext());
    return { ok: true, reason: '' };
  }
  function updateCommand() {
    if (!command) return;
    const quote = commandQuote(); rotateButton.hidden = command.kind !== 'fortification';
    buildLineButton.hidden = command.kind !== 'wall-line' || !command.end;
    buildLineButton.disabled = !quote.ok; buildLineButton.textContent = `Build ${quote.tiles?.length || ''} sections`.replace('  ', ' ');
    promptTitle.textContent = command.kind === 'wall-line' ? command.end ? 'Review this wall line' : command.start ? 'Choose the other end of the wall' : 'Choose the first end of the wall' : command.kind === 'fortification' ? `Place ${api.fortificationOptions(getState()).find(option => option.id === command.type)?.name || command.type}` : command.kind === 'move' ? `Move ${command.ids.length === 1 ? 'this resident' : `${command.ids.length} residents`}` : 'Choose an enemy or hostile settlement';
    promptDetail.textContent = command.reason || (command.kind === 'wall-line' && !command.start ? 'Tap the first cell, then the last. Review the total before building.' : command.kind === 'move' ? 'Tap open ground. The company finds a traversable route there.' : command.kind === 'attack' ? 'Tap a hostile troop or settlement. The order remains active until you cancel or choose a target.' : quote.ok ? `${goods(quote.cost)}${quote.tiles ? ` · ${quote.tiles.length} sections` : ''}. ${command.end ? 'Build to reserve these materials, or tap a different endpoint.' : 'Tap to choose the site.'}` : quote.reason);
    strip.classList.toggle('invalid', !!command.reason || !quote.ok);
    preview({ kind: command.kind, type: command.type, rotation: command.rotation || 0, start: command.start, end: command.end || hovered, cells: quote.tiles, valid: quote.ok, target: command.end || hovered });
  }
  function commitWallLine() {
    if (command?.kind !== 'wall-line' || !command.end) return;
    const result = api.buildWallLine(getState(), command.type, command.start, command.end, getContext()); mutate(result);
    if (result.ok) { cancelCommand(true); update(true); }
    else { command.reason = result.reason; updateCommand(); }
  }
  function rotateCommand() {
    if (command?.kind !== 'fortification') return false;
    command.rotation = ((command.rotation || 0) + 1) % 4; command.reason = null; updateCommand(); return true;
  }
  function hover(tile) { if (!command) return false; hovered = tile; command.reason = null; updateCommand(); return true; }
  function handleTap(tile) {
    if (!command) {
      for (const kind of ['enemy', 'troop', 'neighbor', 'fortification']) {
        const item = tile?.[kind]; if (item) { select(kind, typeof item === 'string' ? item : item.id); return true; }
      }
      return false;
    }
    if (!tile) { command.reason = 'Choose a point on the island.'; updateCommand(); return true; }
    hovered = tile; const state = getState(); let result;
    if (command.kind === 'wall-line' && !command.start) {
      const verdict = api.canPlaceFortification(state, command.type, tile.x, tile.z, 0, getContext());
      if (verdict.ok) command.start = { x: tile.x, z: tile.z }; else command.reason = verdict.reason;
      updateCommand(); return true;
    }
    if (command.kind === 'wall-line') { command.end = { x: tile.x, z: tile.z }; command.reason = null; updateCommand(); return true; }
    else if (command.kind === 'fortification') result = api.placeFortification(state, command.type, tile.x, tile.z, command.rotation || 0, getContext());
    else if (command.kind === 'move') result = api.commandTroops(state, command.ids, { type: 'move', x: tile.x, z: tile.z }, getContext());
    else if (command.kind === 'attack') {
      const target = tile.enemy || tile.troop || tile.neighbor || tile.fortification;
      let targetId = typeof target === 'string' ? target : target?.id;
      if (tile.neighbor && target === tile.neighbor && targetId && !targetId.startsWith('settlement-')) targetId = `settlement-${targetId}`;
      result = targetId ? api.commandTroops(state, command.ids, { type: 'attack', targetId }, getContext()) : { ok: false, reason: 'Choose an enemy troop or a settlement at war with you.' };
    }
    mutate(result);
    if (result?.ok) { cancelCommand(true); update(true); }
    else { command.reason = result?.reason || 'That command cannot be carried out.'; updateCommand(); }
    return true;
  }

  const resizeChart = () => { if (tab === 'neighbors' && !panel.hidden) paintChart(content.querySelector('.frontier-chart'), getState()); };
  window.addEventListener('resize', resizeChart);

  return {
    open, close, select, update, hover, handleTap, cancelCommand, rotateCommand,
    get activeTab() { return tab; }, get command() { return command; },
    get selectedTroops() { return [...selectedTroops]; },
    dispose() { close(); window.removeEventListener('resize', resizeChart); toggle.remove(); panel.remove(); strip.remove(); },
  };
}
