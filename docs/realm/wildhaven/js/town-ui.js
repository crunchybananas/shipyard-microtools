import { calendarDay, perMinute, perMinuteGoods, until, duration } from './calendar.js';
import * as sim from './sim.js';
import { BUILDINGS, RESOURCES, RESOURCE_NAMES, JOBS, getBuildingSpec } from './catalog.js';
import * as progression from './progression.js';
import { pressureOptions } from './pressure.js';
import { coastalDefenseGuidance } from './defense-guidance.js';
import { researchRequirements, rankContracts } from './clarity.js';
import { resourceChips } from './clarity-ui.js';
import { pathRequirement } from './path-choice.js';
import { createResearchMap } from './research-map.js';
import { createPressGuard } from './press-guard.js';
import { resourceDetails } from './resource-details.js';
import { seasonInfo, festivalQuote, festivalStatus, effectiveMorale } from './seasons.js';

const $ = id => document.getElementById(id);
const format = n => Math.floor(n || 0).toLocaleString();
export const resourceText = resources => Object.entries(resources || {}).filter(([, n]) => n > 0).map(([key, value]) => `${Math.round(value * 10) / 10} ${RESOURCES[key]?.name.toLowerCase() || key}`).join(' · ') || 'No materials';
const titleFor = { workforce: 'People & their work', construction: 'The works in progress', stores: 'The town stores', council: 'Research & town paths', trade: 'Beyond the landing', watch: 'Keep a watch on the coast' };
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function btn(label, actionId, onClick, { disabled = false, className = 'small-button', title = '' } = {}) {
  const node = el('button', className, label); node.dataset.actionId = actionId; node.disabled = disabled; node.title = title; node.onclick = onClick; return node;
}
function progressBar(ratio, paused = false) { const bar = el('div', `work-progress${paused ? ' paused' : ''}`); const fill = el('span'); fill.style.width = `${Math.max(0, Math.min(1, ratio || 0)) * 100}%`; bar.append(fill); return bar; }
function preserveReplace(container, nodes) {
  const active = container.contains(document.activeElement) ? document.activeElement.dataset.actionId : null;
  const scroll = container.scrollTop;
  const disclosures = new Map([...container.querySelectorAll('details[data-disclosure]')].map(node => [node.dataset.disclosure, node.open]));
  const innerScroll = new Map([...container.querySelectorAll('[data-scroll-region]')].map(node => [node.dataset.scrollRegion, { left: node.scrollLeft, top: node.scrollTop }]));
  container.replaceChildren(...nodes);
  for (const node of container.querySelectorAll('details[data-disclosure]')) if (disclosures.has(node.dataset.disclosure)) node.open = disclosures.get(node.dataset.disclosure);
  for (const node of container.querySelectorAll('[data-scroll-region]')) { const prior = innerScroll.get(node.dataset.scrollRegion); if (prior) { node.scrollLeft = prior.left; node.scrollTop = prior.top; } }
  container.scrollTop = scroll;
  if (active) container.querySelector(`[data-action-id="${CSS.escape(active)}"]`)?.focus({ preventScroll: true });
}
function stepper(value, min, max, id, update) {
  const node = el('div', 'stepper');
  node.append(btn('−', `${id}-less`, () => update(value - 1), { disabled: value <= min, title: 'Assign one fewer person' }), el('output', '', `${value}`), btn('+', `${id}-more`, () => update(value + 1), { disabled: value >= max, title: 'Assign one more person' })); return node;
}

export function createTownUI({ getState, mutate, canMutate = () => true, inspect, focusCitizen, getIcons, getPaused = () => false, resume = () => {}, build = () => {}, openCompany = () => {}, onGoalSelected = () => {}, beforeOpen = () => {} }) {
  let tab = null, lastSignature = '', previousFocus = null, researchMapOpen = false, mapSelection = null, mapGesture = false, mapScroll = null, mapScrollUntil = 0;
  let pendingInspector = null, selectedResource = null, storesScroll = 0, festivalPreview = null;
  const townPress = createPressGuard($('town-book-content'), { onRelease: () => update() });
  const inspectorPress = createPressGuard($('inspect-management'), { onRelease: () => {
    const building = pendingInspector; pendingInspector = null;
    if (building && !$('inspector').hidden) inspectorControls(building);
  } });
  function action(fn) { if (!canMutate()) return; mutate(fn()); lastSignature = ''; update(true); }
  function open(next, resource = null) {
    selectedResource = next === 'stores' && RESOURCE_NAMES.includes(resource) ? resource : null; festivalPreview = null;
    beforeOpen(); previousFocus = document.activeElement; tab = next; $('town-book').hidden = false; document.body.classList.add('town-view-active');
    $('town-book-title').textContent = titleFor[tab]; $('town-book-content').scrollTop = 0; update(true);
  }
  function close() { townPress.reset(); const focused = $('town-book').contains(document.activeElement); tab = null; selectedResource = null; festivalPreview = null; researchMapOpen = false; mapGesture = false; $('town-book').hidden = true; document.body.classList.remove('town-view-active'); if (focused) previousFocus?.focus({ preventScroll: true }); update(); }
  $('close-town-book').onclick = close;
  $('town-book-content').addEventListener('pointerdown', event => { if (event.target.closest('[data-scroll-region="research-map"]')) mapGesture = true; });
  document.addEventListener('pointerup', () => { mapGesture = false; }); document.addEventListener('pointercancel', () => { mapGesture = false; });
  $('town-book-content').addEventListener('scroll', event => { if (event.target.dataset?.scrollRegion === 'research-map') { mapScroll = { left: event.target.scrollLeft, top: event.target.scrollTop }; mapScrollUntil = performance.now() + 250; } }, true);
  document.querySelectorAll('[data-town-tab]').forEach(button => button.onclick = () => tab === button.dataset.townTab && button.closest('#town-tools') ? close() : open(button.dataset.townTab));
  function image(type) { const img = el('img'); img.src = getIcons()[type] || getIcons().cottage; img.alt = ''; return img; }
  function pauseCue() { const row = el('div', 'paused-work'); row.append(el('span', '', 'Ⅱ Time paused · work waits'), btn('Resume time', 'resume-time', resume)); return row; }
  function disclosure(id, label, open = false) { const node = el('details', 'town-disclosure'), summary = el('summary', '', label); node.dataset.disclosure = id; node.open = open; summary.dataset.actionId = `disclosure-${id}`; node.append(summary); return node; }
  function workforceContent(state) {
    const work = sim.workforce(state), needs = sim.villageNeeds(state), nodes = [];
    const totals = el('div', 'town-summary');
    for (const [value, label] of [[work.employed, 'at work'], [work.builders, 'building'], [work.idle, 'available']]) { const cell = el('div'); cell.append(el('strong', '', value), document.createTextNode(label)); totals.append(cell); }
    nodes.push(totals, el('p', 'town-intro', `Morale ${Math.round(effectiveMorale(state))}%. ${needs.migration.reason} Every job shares the same residents.`));
    if (getPaused()) nodes.push(pauseCue());
    const builders = el('div', 'town-control'), intro = el('div'); intro.append(el('strong', '', 'Construction crew'), el('small', '', 'Builders take priority while work is queued, then return to the other jobs.'));
    builders.append(intro, stepper(work.builderTarget, 0, state.population, 'builders', value => action(() => sim.setBuilderTarget(state, value)))); nodes.push(builders);
    nodes.push(el('h3', 'town-section', 'Put hands where they matter'));
    for (const job of work.jobs) {
      const b = state.buildings.find(b => b.id === job.id), status = sim.buildingStatus(state, b);
      const row = el('div', 'town-row'), top = el('div', 'town-row-top'), main = el('div', 'town-row-main'); row.dataset.workplace = b.id;
      main.append(el('strong', '', `${job.name} · level ${b.level}`), el('small', '', `${job.workers} working / ${job.desired} wanted · ${JOBS[BUILDINGS[b.type].job]?.plural || 'Workers'}`));
      top.append(image(job.type), main, stepper(job.desired, 0, job.max, `staff-${job.id}`, count => action(() => sim.setWorkers(state, job.id, count))));
      row.append(top, el('p', '', job.names.join(', ') || 'No residents assigned'));
      if (b.type === 'lumber') { const grove = sim.woodlandStatus(state, b); row.append(el('p', 'town-meta', `${grove.mature} mature trees · ${grove.saplings} ${grove.saplings === 1 ? 'sapling' : 'saplings'} · ${grove.stumps} ${grove.stumps === 1 ? 'stump' : 'stumps'}. Automatic replanting · 3 in-game days to mature.`)); }
      if (status.blockedReason) row.append(el('p', 'problem', status.blockedReason));
      const controls = el('div', 'town-row-actions'); controls.append(btn(b.paused ? 'Resume work' : 'Rest workers', `rest-${b.id}`, () => action(() => sim.pauseBuilding(state, b.id, !b.paused))), btn(b.type === 'hearth' ? 'Reserve gatherers' : b.priority < 10 ? 'Priority: high' : 'Raise priority', `priority-${b.id}`, () => action(() => sim.setPriority(state, b.id, b.priority < 10 ? 10 : 0)), { disabled: b.type === 'hearth' }), btn('Find workplace', `find-${b.id}`, () => { close(); inspect(b); }, { className: 'small-button quiet' }));
      row.append(controls); nodes.push(row);
    }
    nodes.push(el('h3', 'town-section', 'Your neighbors'));
    for (const citizen of work.citizens) {
      const row = el('div', 'town-person'), dot = el('i', 'person-dot'), detail = el('div'); dot.style.background = JOBS[citizen.job]?.color || '#8d9e79';
      const employer = state.buildings.find(b => b.id === citizen.workplace);
      const bonus = Math.round((sim.citizenSkill(citizen, citizen.job) - 1) * 100);
      detail.append(el('strong', '', citizen.name), el('small', '', `${JOBS[citizen.job]?.name || 'Available'}${employer ? ` at ${BUILDINGS[employer.type].name}` : ''}${bonus ? ` · +${bonus}% skill` : ''}`));
      row.append(dot, detail, btn('Find', `person-${citizen.id}`, () => { close(); focusCitizen(citizen); })); nodes.push(row);
    }
    return nodes;
  }
  function queueContent(state) {
    const queue = sim.constructionQueue(state), nodes = [el('p', 'town-intro', 'The crew works on one project at a time. Move an urgent home or workshop forward, or rest a site to free your builders. Materials are reserved when you place the plan.')];
    if (getPaused() && queue.length) nodes.push(pauseCue());
    if (!queue.length) nodes.push(el('p', 'town-empty', 'The tools are put away. Choose a building to begin another project.'));
    queue.forEach((site, index) => {
      const row = el('div', 'town-row'), top = el('div', 'town-row-top'), main = el('div', 'town-row-main');
      main.append(el('strong', '', `${index + 1}. ${site.name}${site.kind === 'upgrade' ? ` → level ${site.targetLevel}` : ''}`), el('small', '', site.paused ? 'Project paused' : site.workers ? `${site.workers} builders on site` : 'Waiting for the crew'));
      top.append(image(site.type), main, el('span', 'job-tag', `${Math.round(site.ratio * 100)}%`)); row.append(top, progressBar(site.ratio, site.paused));
      row.append(el('div', 'town-meta', `${Math.ceil(site.workRequired - site.progress)} person-seconds of work left${site.workers ? ` · roughly ${Math.ceil((site.workRequired - site.progress) / site.workers)} seconds with this crew` : ''}`));
      const controls = el('div', 'town-row-actions');
      controls.append(btn('Earlier', `earlier-${site.id}`, () => action(() => sim.reorderConstruction(state, site.id, -1)), { disabled: index === 0 }), btn('Later', `later-${site.id}`, () => action(() => sim.reorderConstruction(state, site.id, 1)), { disabled: index === queue.length - 1 }), btn(site.paused ? 'Resume' : 'Pause', `pause-${site.id}`, () => action(() => sim.pauseBuilding(state, site.id, !site.paused))), btn('View', `project-${site.id}`, () => { close(); inspect(state.buildings.find(b => b.id === site.id)); }), btn('Cancel work', `cancel-${site.id}`, () => action(() => sim.cancelConstruction(state, site.id)), { className: 'small-button quiet', title: `Returns ${resourceText(site.refund)}` }));
      row.append(controls, el('p', '', `If cancelled: ${resourceText(site.refund)} returned. Work already done uses its share of materials.`)); nodes.push(row);
    }); return nodes;
  }
  function storesContent(state) {
    if (selectedResource) return resourceContent(state, selectedResource);
    const daily = sim.rates(state), needs = sim.villageNeeds(state), nodes = [el('p', 'town-intro', 'Goods enter these stores automatically. Choose a resource to see where it comes from, what uses it, and how to get more.')];
    const art = el('img', 'resource-panel-art'); art.src = './assets/resource-pantry.jpg'; art.alt = ''; art.loading = 'lazy'; art.width = 2172; art.height = 724; nodes.unshift(art);
    for (const key of RESOURCE_NAMES) {
      const rate = perMinute(daily[key] || 0), row = btn('', `resource-${key}`, () => revealResource(key), { className: 'stock-row resource-row' });
      const label = el('span'), amount = el('span', 'stock-amount'); row.type = 'button'; row.dataset.resource = key;
      label.append(el('strong', '', RESOURCES[key].name));
      amount.append(document.createTextNode(format(state.resources[key])));
      if (RESOURCES[key].physical) amount.append(el('em', '', ` / ${format(daily.storage[key])}`));
      row.append(label, amount, el('span', `stock-rate${rate < 0 ? ' negative' : ''}`, `${rate >= 0 ? '+' : ''}${rateNumber(rate)} / min`), el('span', 'resource-chevron', '›'));
      row.setAttribute('aria-label', `${RESOURCES[key].name}, ${rateNumber(state.resources[key])} stored. View details`); nodes.push(row);
    }
    nodes.push(el('h3', 'town-section', 'A place to stay'), el('p', 'town-intro', `${needs.housing.required} residents / ${needs.housing.have} beds. ${needs.migration.reason}`));
    for (const [key, service] of Object.entries(needs.services || {})) {
      const row = el('div', 'stock-row'), label = el('div'); label.append(el('strong', '', `${key[0].toUpperCase()}${key.slice(1)} access`));
      label.append(el('small', 'stock-note', `${Math.round(service.served || 0)} / ${Math.round(service.demand || 0)} beds served`));
      row.append(label, el('span', 'stock-amount', `${Math.round(service.coverage * 100)}%`), el('span', 'stock-rate', `Capacity ${Math.round(service.capacity || 0)}`)); nodes.push(row);
    }
    return nodes;
  }
  const rateNumber = value => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
  function allResources() {
    const prior = selectedResource; selectedResource = null; festivalPreview = null; update(true);
    $('town-book-content').scrollTop = storesScroll;
    $('town-book-content').querySelector(`[data-action-id="resource-${prior}"]`)?.focus({ preventScroll: true });
  }
  function resourceQuote(resource) {
    open('trade'); const button = $('town-book-content').querySelector(`[data-action-id="import-import_${resource}"]`);
    const section = button?.closest('details'); if (section) section.open = true;
    button?.closest('.market-quote')?.scrollIntoView({ block: 'start' });
    if (button && !button.disabled) button.focus({ preventScroll: true });
  }
  function manageResourceWorkplace(id) {
    open('workforce'); const row = $('town-book-content').querySelector(`[data-workplace="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: 'start' }); row?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }
  function resourceWorkplaces(entries, label, direction) {
    const section = el('section', 'resource-workplaces'); section.append(el('h3', 'town-section', label));
    if (!entries.length) section.append(el('p', 'town-meta', direction === '+' ? 'No local workplace produces this yet.' : 'No local workplace uses this yet.'));
    for (const item of entries) {
      const row = el('div', 'resource-workplace'), top = el('div', 'resource-workplace-top'), controls = el('div', 'town-row-actions');
      top.append(el('strong', '', item.name), el('span', 'resource-contribution', `${direction}${rateNumber(item.rate)} / min`));
      row.append(top, el('p', 'town-meta', `${item.maxWorkers ? `${item.workers} / ${item.wanted} assigned · ` : ''}${item.reason || item.status}`));
      controls.append(btn('Inspect', `resource-${direction === '+' ? 'source' : 'sink'}-inspect-${item.id}`, () => { const building = getState().buildings.find(b => b.id === item.id); if (building) { close(); inspect(building); } }));
      if (item.maxWorkers) controls.append(btn('Manage jobs', `resource-${direction === '+' ? 'source' : 'sink'}-manage-${item.id}`, () => manageResourceWorkplace(item.id)));
      row.append(controls); section.append(row);
    }
    return section;
  }
  function resourceContent(state, key) {
    const data = resourceDetails(state, key), section = el('section', 'resource-detail'); section.dataset.resourceDetail = key;
    const quote = progression.importOptions(state).find(option => option.id === `import_${key}`);
    const back = btn('‹ All resources', 'all-resources', allResources, { className: 'resource-back small-button' });
    const stock = el('div', 'resource-stock'), quantity = el('strong', '', rateNumber(data.stock));
    stock.append(quantity, el('span', '', data.capacity === null ? `${data.name.toLowerCase()} stored · no storage limit` : `${data.name.toLowerCase()} stored / ${format(data.capacity)} capacity`));
    section.append(back, stock);
    const rates = el('dl', 'resource-rates');
    for (const [label, value, sign] of [['Produced', data.rates.produced, '+'], ['Used by workplaces', data.rates.workplaceUsed, '−'], ['Used by residents', data.rates.residentUsed, '−'], ['Net change', data.rates.net, data.rates.net < 0 ? '−' : '+']]) {
      const row = el('div'); row.append(el('dt', '', label), el('dd', value < 0 ? 'negative' : '', `${sign}${rateNumber(Math.abs(value))}`)); rates.append(row);
    }
    section.append(rates, el('p', 'resource-rate-note', `${getPaused() ? 'Time paused. ' : ''}Per minute at 1×, with current workers and supplies. Imports, construction, trade and other one-time spending are excluded.`));
    if (data.meal) {
      const forecast = el('div', 'resource-forecast');
      forecast.append(el('p', '', data.meal.pantryMeals === null ? 'No resident meals are currently required.' : `Pantry alone covers ${data.meal.pantryMeals} town ${data.meal.pantryMeals === 1 ? 'meal' : 'meals'}, before production or other spending.`));
      forecast.append(el('p', 'town-meta', `Next meal: ${rateNumber(data.meal.amount)} food in ${duration(data.meal.secondsUntil)} at 1×, for the current population. Resident use above is averaged across meals; newcomers also use food.`)); section.append(forecast);
    } else if (data.decline) {
      section.append(el('p', 'resource-forecast', `At current rates, this stock would last about ${duration(data.decline.seconds)} at 1× if rates stay the same and there is no other spending. Workers, supplies and storage can change that estimate.`));
    }
    const quick = el('div', 'town-row-actions resource-quick-actions');
    const source = data.sources.find(item => item.maxWorkers && !['Construction', 'Upgrading'].includes(item.status));
    quick.append(btn('Manage jobs', `resource-manage-${key}`, () => source ? manageResourceWorkplace(source.id) : open('workforce')));
    if (data.producerTypes.length || quote) quick.append(btn(`Get more ${data.name.toLowerCase()}`, `resource-more-${key}`, () => {
      if (!data.producerTypes.length) { resourceQuote(key); return; }
      const plans = $('town-book-content').querySelector(`[data-disclosure="resource-${key}-plans"]`);
      if (plans) { plans.open = true; plans.scrollIntoView({ block: 'start' }); plans.querySelector('summary')?.focus({ preventScroll: true }); }
    }, { className: 'primary' }));
    section.append(quick);
    if (data.full || data.storageLimited) section.append(el('p', 'resource-storage-note', `${data.full ? 'Storage is full. ' : ''}Full shelves can throttle production; output can resume when space opens. The net rate above is a current snapshot.${key === 'food' ? ' A negative rate at full storage does not by itself mean the town lacks food production.' : ''}`));
    else if (data.capacity !== null) section.append(el('p', 'resource-rate-note', 'A warehouse adds capacity for every physical good.'));
    if (key === 'food') {
      const art = el('img', 'resource-panel-art resource-detail-art'); art.src = './assets/resource-pantry.jpg'; art.alt = ''; art.loading = 'lazy'; art.width = 2172; art.height = 724;
      section.append(art, seasonContent(state));
    }
    section.append(resourceWorkplaces(data.sources, 'Where it comes from', '+'), resourceWorkplaces(data.sinks, 'Where it goes', '−'));
    const chains = {
      food: 'Orchards and kitchen gardens make food directly. Bread: Grain farm → Windmill → Bakery → Food. The bakery also burns timber; staff and supply every workplace.',
      grain: 'Grain farm → Windmill → Flour → Bakery → Food. A brewery also uses grain to make ale.',
      flour: 'Grain farm → Windmill → Flour. A staffed bakery turns flour and timber into food.',
      wood: 'Woodcutters harvest and replant woodland. Timber supplies construction, sawmills and bakeries.',
      planks: 'Woodcutter → Sawmill → Planks → Better buildings and tools.',
      ore: 'Iron mine → Iron ore → Smithy → Iron.',
      iron: 'Iron mine → Smithy → Iron → Toolmaker and better buildings.',
      tools: 'Iron mine → Smithy → Toolmaker → Tools. The toolmaker also needs planks from a sawmill. Finished tools enter these stores automatically for upgrades and trade.',
      flax: 'Flax field → Flax → Weaver → Cloth.',
      cloth: 'Flax field → Weaver → Cloth. Staff both workplaces; finished cloth enters these stores automatically for homes, clinics and trade.',
      ale: 'Grain farm → Brewery → Ale → Community supply and trade.',
    };
    if (chains[key]) section.append(el('p', 'resource-chain', chains[key]));
    if (data.producerTypes.length) {
      const plans = disclosure(`resource-${key}-plans`, 'Add a producing workplace');
      plans.append(el('p', 'town-meta', 'Review costs here. Materials are spent only when you confirm a valid building site.'));
      for (const type of data.producerTypes) {
        const spec = BUILDINGS[type], gate = progression.canUnlockBuilding(state, type), row = el('div', 'resource-plan');
        const missing = Object.entries(spec.cost).filter(([resource, amount]) => (state.resources[resource] || 0) + 1e-6 < amount);
        row.append(el('strong', '', spec.name), resourceChips(spec.cost, { state, cost: true }));
        row.append(el('p', 'town-meta', !gate.ok ? gate.reason : missing.length ? `Still needed: ${resourceText(Object.fromEntries(missing.map(([resource, amount]) => [resource, amount - (state.resources[resource] || 0)])))}.` : 'Materials available. Choose a site to check space and entrance access.'));
        row.append(btn(gate.ok ? `Plan ${spec.name.toLowerCase()}` : 'View required research', `resource-plan-${type}`, () => gate.ok ? build(type) : revealResearch(spec.unlock), { disabled: gate.ok && !canMutate() })); plans.append(row);
      }
      section.append(plans);
    }
    if (quote) {
      const trade = el('section', 'resource-import'); trade.append(el('h3', 'town-section', 'Import from the coast'), el('p', '', `${resourceText(quote.cost)} → ${resourceText(quote.reward)}`), el('p', 'town-meta', quote.reason), btn('View import quote', `resource-import-${key}`, () => resourceQuote(key))); section.append(trade);
    }
    return [section];
  }
  function seasonContent(state) {
    const season = seasonInfo(state), status = festivalStatus(state), quote = festivalQuote(state);
    const section = disclosure('season-calendar', 'Seasons & harvest festival'); section.id = 'season-calendar';
    section.append(el('h3', 'town-section', season.label));
    const months = el('ol', 'season-progression'); months.setAttribute('aria-label', 'Season progression');
    for (const name of ['Spring', 'Summer', 'Autumn', 'Winter']) { const item = el('li', name === season.name ? 'current' : '', name); if (name === season.name) item.setAttribute('aria-current', 'date'); months.append(item); }
    section.append(months, el('p', 'town-meta', 'Each season lasts 3 days · 18 minutes at 1×. Seasons mark the calendar; they do not change workplace output.'));
    section.append(el('h3', 'town-section', 'Harvest festival'), el('p', '', '+8 morale, capped at 100, for one day (6m at 1×). Once per year, in autumn.'));
    if (status.active) section.append(el('p', 'resource-festival-active', `Celebrating · ${duration(status.remainingSeconds)} left at 1× · current morale ${Math.round(effectiveMorale(state))}%.`));
    section.append(el('p', '', `Cost: ${quote.cost.food} food. Keep at least ${quote.reserveFood} food for two town meals.`), el('p', 'town-meta', `After this cost: ${rateNumber(Math.max(0, quote.foodAvailable - quote.cost.food))} food${quote.foodAvailable < quote.cost.food ? ' · not enough food to pay' : ''}. ${quote.reason}`));
    if (festivalPreview) {
      const review = el('div', 'resource-festival-confirm');
      review.append(el('strong', '', `Confirm ${festivalPreview.cost.food} food for the festival?`), el('p', 'town-meta', 'This spends food now. Two meals must remain when you pay; that food stays available for ordinary town use.'));
      const controls = el('div', 'town-row-actions');
      controls.append(btn('Confirm festival', 'festival-confirm', () => {
        action(() => {
          const live = getState(), fresh = festivalQuote(live), reviewed = festivalPreview; festivalPreview = null;
          if (!reviewed || fresh.cost.food !== reviewed.cost.food || fresh.reserveFood !== reviewed.reserveFood || fresh.year !== reviewed.year) return { ok: false, reason: 'The festival quote changed. Review the current cost before confirming.' };
          return sim.celebrateHarvest(live);
        });
        $('season-calendar')?.querySelector('summary')?.focus({ preventScroll: true });
      }, { disabled: !quote.ok || !canMutate(), className: 'primary' }), btn('Cancel', 'festival-cancel', () => {
        festivalPreview = null; update(true);
        const preview = $('town-book-content').querySelector('[data-action-id="festival-preview"]');
        (preview && !preview.disabled ? preview : $('season-calendar')?.querySelector('summary'))?.focus({ preventScroll: true });
      }));
      review.append(controls); section.append(review);
    } else section.append(btn('Review festival', 'festival-preview', () => { festivalPreview = festivalQuote(getState()); update(true); $('town-book-content').querySelector('[data-action-id="festival-confirm"]')?.focus({ preventScroll: true }); }, { disabled: !quote.ok || !canMutate() }));
    return section;
  }
  function councilContent(state) {
    const nodes = [], research = progression.researchOptions(state), active = research.find(item => item.active);
    const jumps = el('nav', 'council-jumps'); jumps.setAttribute('aria-label', 'Research and town paths');
    for (const [id, name] of [['paths', 'Paths'], ['research', 'Research'], ['map', 'Research map']]) jumps.append(btn(name, `council-jump-${id}`, () => {
      if (id === 'map') { showResearchMap(); return; }
      researchMapOpen = false; update(true); $('town-book-content').querySelector(`[data-council-section="${id}"]`)?.scrollIntoView({ block: 'start' });
    }));
    nodes.push(jumps);
    if (researchMapOpen) {
      nodes.push(createResearchMap({ state, selectedId: mapSelection || state.research.active?.id, onSelect: id => { mapSelection = id; revealResearch(id); } }));
      return nodes;
    }
    const paths = el('section', 'town-paths'); paths.dataset.councilSection = 'paths';
    paths.append(el('h3', 'town-section', 'Choose your town’s path'), el('p', 'path-terms', 'You can build toward a direction now. Charter bonuses begin only after learning The island charter and choosing below. First charter free; switching costs 60 coin + 25 knowledge.'));
    const requirement = pathRequirement(state);
    if (requirement) {
      const next = el('div', 'path-requirement');
      if (requirement.kind === 'research') {
        const name = progression.RESEARCH[requirement.researchId].name;
        next.append(el('span', '', requirement.active ? `Unlocking paths · studying ${name}` : `To unlock paths, learn ${name} next.`), btn(`View ${name}`, 'path-requirement', () => revealResearch(requirement.researchId)));
      } else if (requirement.kind === 'school') {
        next.append(el('span', '', requirement.building ? 'Finish your schoolhouse to unlock paths.' : 'Research needs a working schoolhouse.'), btn(requirement.building ? 'View schoolhouse' : 'Staff & supply school', 'path-requirement', () => { close(); inspect(state.buildings.find(b => b.id === requirement.buildingId)); }));
      } else next.append(el('span', '', 'Build a schoolhouse to unlock paths.'), btn('Build a schoolhouse', 'path-requirement', () => build('school')));
      paths.append(next);
    }
    const choices = {
      breadbasket: { title: 'Food town', icon: 'farm', payoff: '+25% food workplaces & flax', tradeoffs: 'Industry output −10% · Residents eat 5% more.' },
      freeport: { title: 'Trading town', icon: 'market', payoff: '+30% landing cargo & trade coin', tradeoffs: 'Imports 15% cheaper · 3 shipments per supply boat · 1 extra arrival when needs are met · Food workplaces & flax −10%.' },
      forge: { title: 'Craft town', icon: 'toolmaker', payoff: '+25% industry output', tradeoffs: 'Residents eat 15% more · 1 fewer arrival per opportunity.' },
    };
    for (const policy of progression.policyOptions(state)) {
      const choice = choices[policy.id], row = el('section', `policy-option path-option${policy.selected ? ' selected' : ''}`), top = el('div', 'path-choice-top'), label = el('div', 'path-choice-label');
      row.dataset.path = policy.id;
      label.append(el('strong', '', choice.title), el('small', '', policy.name));
      const choose = btn(policy.selected ? 'Current path' : 'Choose this path', `charter-${policy.id}`, () => action(() => progression.setPolicy(state, policy.id)), { disabled: !policy.canSelect || policy.selected, title: policy.reason });
      choose.setAttribute('aria-label', `${policy.selected ? 'Current path' : 'Choose this path'}: ${choice.title} · ${policy.name}`);
      top.append(image(choice.icon), label, choose);
      row.append(top, el('p', 'path-payoff', choice.payoff));
      const details = disclosure(`path-${policy.id}`, 'Tradeoffs'); details.append(el('p', '', choice.tradeoffs));
      row.append(details);
      if (policy.id === 'breadbasket') {
        const following = state.guidance?.goal === 'first_bread', made = state.guidance?.firstBread;
        row.append(el('p', 'town-meta', made ? `First bread made on day ${calendarDay(state, made.day)}.` : 'A first step: turn grain into flour, then bread. This free goal guides your next action; it grants no charter bonuses.'), btn(following ? 'Stop following bread goal' : made ? 'Revisit first bread' : 'Work toward first bread', 'goal-first-bread', () => { if (!canMutate()) return; action(() => progression.setTownGoal(state, following ? null : 'first_bread')); if (!following) { close(); onGoalSelected(); } }));
      }
      paths.append(row);
    }
    nodes.push(paths);
    const schools = state.buildings.filter(b => b.type === 'school' && b.status === 'ready'), workingSchools = schools.filter(b => !b.paused && b.production?.efficiency > 0);
    const summary = el('div', 'research-work'); summary.dataset.councilSection = 'research';
    summary.append(el('strong', '', active ? `Studying ${active.name}` : 'Choose what the town learns next'), el('p', 'town-meta', 'Pay once to begin. Supplied scholars earn knowledge and advance one selected project.'));
    if (active) summary.append(progressBar(active.progress), el('span', 'job-tag', `${Math.floor(active.progress * 100)}% learned`));
    if (!workingSchools.length) {
      summary.append(el('p', 'problem', schools.length ? 'Research is waiting for school workers and food.' : 'Build and staff a schoolhouse to advance research.'), btn(schools.length ? 'Staff a schoolhouse' : 'Build a schoolhouse', 'research-school', () => schools.length ? inspect(schools[0]) : build('school')));
    }
    if (getPaused()) summary.append(pauseCue());
    nodes.push(summary);
    function researchCard(item) {
      const row = el('section', `research-card${item.completed ? ' completed' : ''}`); row.dataset.research = item.id;
      const title = el('div', 'research-title'); title.append(el('strong', '', item.name), el('span', 'job-tag', item.completed ? 'Learned' : item.active ? 'In progress' : `Tier ${item.tier}`)); row.append(title);
      if (item.unlocks.length) {
        const unlocks = el('div', 'research-unlocks');
        for (const type of item.unlocks) { const card = el('div'); card.append(image(type), el('span', '', BUILDINGS[type].name)); unlocks.append(card); }
        row.append(unlocks);
      }
      row.append(el('p', 'research-payoff', item.description));
      if (mapSelection === item.id) row.append(btn('Back to research map', `research-map-back-${item.id}`, () => showResearchMap(item.id), { className: 'text-button' }));
      if (item.completed) {
        for (const type of item.unlocks) row.append(btn(`Plan ${BUILDINGS[type].name.toLowerCase()}`, `research-build-${type}`, () => build(type)));
        return row;
      }
      const requirements = researchRequirements(state, item), prerequisites = el('div', 'research-requires');
      for (const prerequisite of requirements) prerequisites.append(btn(`${prerequisite.met ? '✓' : '○'} ${prerequisite.name}`, `requires-${item.id}-${prerequisite.id}`, () => revealResearch(prerequisite.id), { className: prerequisite.met ? 'requirement met' : 'requirement missing' }));
      if (requirements.length) row.append(el('small', 'requirement-label', 'Learn first'), prerequisites);
      row.append(resourceChips(item.cost, { state, cost: true }), el('p', 'town-meta', `${item.duration} base seconds with one fully supplied school. Staffing, experience and research bonuses change the time.`));
      row.append(btn(item.active ? 'Research in progress' : `Study ${item.name}`, `research-${item.id}`, () => action(() => progression.startResearch(state, item.id)), { disabled: !item.canStart, className: 'primary' }));
      if (!item.canStart && !item.active) row.append(el('p', 'town-meta', item.reason));
      return row;
    }
    const available = research.filter(item => !item.completed && item.prerequisites.every(id => state.research.completed.includes(id)));
    nodes.push(el('h3', 'town-section', 'Your next discoveries'), ...available.map(researchCard));
    const future = research.filter(item => !item.completed && !available.includes(item));
    if (future.length) { const detail = disclosure('future-research', 'Plan the next crafts'); detail.append(...future.map(researchCard)); nodes.push(detail); }
    const completed = research.filter(item => item.completed);
    if (completed.length) { const detail = disclosure('learned-research', `${completed.length} fields already learned`); detail.append(...completed.map(researchCard)); nodes.push(detail); }
    return nodes;
  }
  function tradeContent(state) {
    const nodes = [], jumps = el('nav', 'trade-jumps'); jumps.setAttribute('aria-label', 'Trading activities');
    for (const [id, name] of [['landing','Landing'], ['orders','Orders'], ['market','Buy / sell'], ['routes','Voyages']]) jumps.append(btn(name, `trade-jump-${id}`, () => { const target = $('town-book-content').querySelector(`[data-trade-section="${id}"]`); if (target?.tagName === 'DETAILS') target.open = true; target?.scrollIntoView({ block: 'start' }); }));
    nodes.push(jumps);
    const tradeHeading = (name, id) => { const heading = el('h3', 'town-section', name); heading.dataset.tradeSection = id; return heading; };
    nodes.push(tradeHeading('At the landing', 'landing'));
    const offers = el('div', 'town-row-actions landing-offers');
    for (const key of ['wood', 'stone']) { const offer = sim.tradeOffer(state, key); offers.append(btn(`12 food → ${offer.amount} ${RESOURCES[key].name.toLowerCase()}`, `landing-${key}`, () => action(() => sim.trade(state, key)), { disabled: !offer.ok })); }
    nodes.push(offers, el('p', 'town-meta', sim.tradeOffer(state, 'wood').reason));
    nodes.push(tradeHeading('Orders you can take now', 'orders'));
    for (const contract of rankContracts(progression.contractOptions(state), state.resources)) {
      const row = el('div', 'town-row contract-card'), ready = Object.entries(contract.requirements).every(([key, n]) => state.resources[key] >= n);
      row.append(el('strong', '', contract.title), el('p', 'contract-flow', `${resourceText(contract.requirements)} → ${resourceText(contract.reward)}`));
      if (contract.status === 'active') row.append(el('p', 'contract-deadline', `Due in ${until(state, contract.deadline + 1)} at 1×`));
      else if (ready) row.append(el('span', 'job-tag', 'Cargo in store · ready to accept'));
      row.append(btn(contract.status === 'active' ? 'Deliver the order' : `Accept · ${until(state, contract.deadline + 1)} to deliver`, `contract-${contract.id}`, () => action(() => contract.status === 'active' ? progression.completeContract(state, contract.id) : progression.acceptContract(state, contract.id)), { disabled: contract.status === 'active' ? !contract.canComplete : !contract.canAccept, className: 'primary' }));
      if (contract.status === 'active' && !contract.canComplete || contract.status !== 'active' && !contract.canAccept) row.append(el('p', 'town-meta', contract.reason)); nodes.push(row);
    }
    const imports = progression.importOptions(state), exports = progression.exportOptions(state), hasMarket = state.buildings.some(b => b.type === 'market' && b.status === 'ready');
    const market = disclosure('market-trade', hasMarket ? 'Harbor counter · buy & sell' : 'Buy & sell cargo · needs a supplied market', hasMarket); market.dataset.tradeSection = 'market';
    market.append(el('p', 'town-meta', 'Staff and supply a market to exchange cargo for coin. Quotes include your charter; quotas reset every 90 seconds at 1×.'));
    if (!hasMarket) market.append(btn(state.research.completed.includes('barter') ? 'Build a market hall' : 'Study Fair measures', 'market-unlock', () => state.research.completed.includes('barter') ? build('market') : revealResearch('barter')));
    for (const [label, list, buying] of [['Buy cargo', imports, true], ['Sell a surplus', exports, false]]) {
      const section = tradeHeading(label, buying ? 'imports' : 'exports'); market.append(section);
      for (const offer of list) {
        const row = el('div', 'market-quote'), detail = el('div'); detail.append(el('strong', '', `${resourceText(offer.cost)} → ${resourceText(offer.reward)}`), el('small', '', `${offer.remaining} / ${offer.dailyLimit} shipments on this boat`));
        row.append(detail, btn(buying ? 'Buy cargo' : 'Sell cargo', `${buying ? 'import' : 'export'}-${offer.id}`, () => action(() => buying ? progression.importGoods(state, offer.id) : progression.exportGoods(state, offer.id)), { disabled: !offer.ok }));
        if (!offer.ok) row.append(el('p', 'town-meta', offer.reason)); market.append(row);
      }
    }
    nodes.push(market);
    const routes = progression.routeOptions(state), voyages = disclosure('voyages', state.research.completed.includes('coastal_routes') ? 'Voyages along the coast' : 'Voyages · study Coastal partnerships', routes.some(r => r.active || r.canDispatch)); voyages.dataset.tradeSection = 'routes';
    for (const route of routes) {
      const row = el('div', 'town-row'); row.append(el('strong', '', route.name), el('p', 'contract-flow', `${resourceText(route.cargo)} → ${resourceText(route.reward)}`), el('p', 'town-meta', `${until(state, route.returnDay)} at sea at 1× · trust ${route.trust}/${route.requiredTrust}`));
      if (route.active) row.append(el('p', 'contract-deadline', `At sea · back in ${until(state, route.returnDay)} at 1×`));
      else { row.append(btn('Send a voyage', `route-${route.id}`, () => action(() => progression.dispatchRoute(state, route.id)), { disabled: !route.canDispatch, className: 'primary' })); if (!route.canDispatch) row.append(el('p', 'town-meta', route.reason)); }
      voyages.append(row);
    }
    nodes.push(voyages); return nodes;
  }
  function watchContent(state) {
    const coast = pressureOptions(state), incident = coast.active, guidance = coastalDefenseGuidance(state), nodes = [];
    const context = el('div', 'watch-defense-context');
    context.append(el('strong', '', 'Coastal cargo watch'), el('p', 'town-meta', guidance.distinction), btn('Command soldiers in Company', 'watch-company', openCompany, { className: 'text-button' })); nodes.push(context);
    function takeWatchStep(step) {
      if (step.kind === 'research') revealResearch(step.researchId);
      else if (step.kind === 'build') build(step.type);
      else if (step.kind === 'inspect') inspect(state.buildings.find(b => b.id === step.buildingId));
      else if (step.kind === 'town') step.resource ? revealResource(step.resource) : open(step.tab);
      else if (step.kind === 'pressure') action(() => sim.actOnPressure(state, step.action));
    }
    function watchPlan() {
      const plan = disclosure('watch-preparation', 'How to prepare a coastal patrol');
      for (const step of guidance.steps) {
        const item = el('div', 'town-row'); item.append(el('strong', '', `${step.complete ? '✓' : '○'} ${step.label}`), el('p', 'town-meta', step.detail));
        if (!step.complete && !['wait', 'pressure'].includes(step.kind)) item.append(btn(step.kind === 'research' ? 'View research' : step.kind === 'build' ? 'Plan watch house' : step.kind === 'inspect' ? 'Manage watch house' : step.tab === 'workforce' ? 'Manage people & jobs' : 'View food stores', `watch-plan-${step.id}`, () => takeWatchStep(step)));
        plan.append(item);
      }
      return plan;
    }
    function watchStaffing() {
      const box = el('section', 'watch-staffing'), houses = state.buildings.filter(b => b.type === 'barracks'), daily = sim.rates(state);
      box.append(el('h3', 'town-section', 'Staff the coastal watch'), el('p', 'town-meta', 'Guards leave other jobs to protect coastal cargo and provide escorts.'));
      if (getPaused()) box.append(pauseCue());
      if (!houses.length) {
        const unlocked = state.research.completed.includes('watchkeeping');
        box.append(el('p', 'problem', 'No watch house yet.'), btn(unlocked ? 'Build a watch house' : 'Study A standing watch', 'watch-people', () => unlocked ? build('barracks') : revealResearch('watchkeeping'), { className: 'primary' }));
      }
      for (const b of houses) {
        const status = sim.buildingStatus(state, b), spec = getBuildingSpec('barracks', b.level), row = el('div', 'town-row');
        if (b.status !== 'ready') { row.append(el('strong', '', 'Watch house under construction'), btn('View project', `watch-project-${b.id}`, () => inspect(b))); box.append(row); continue; }
        const control = el('div', 'town-control'), label = el('div');
        label.append(el('strong', '', `${status.workers} guards assigned · ${status.desiredWorkers} requested`), el('small', '', `Watch house · level ${b.level}`));
        const step = stepper(status.desiredWorkers, 0, status.maxWorkers, `watch-staff-${b.id}`, count => action(() => sim.setWorkers(state, b.id, count)));
        step.querySelectorAll('button')[0].setAttribute('aria-label', 'Request one fewer coastal guard'); step.querySelectorAll('button')[1].setAttribute('aria-label', 'Request one more coastal guard');
        control.append(label, step); row.append(control);
        const names = state.citizens.filter(c => c.workplace === b.id && c.job === 'guard').map(c => c.name);
        row.append(el('p', 'guard-names', names.length ? `On the watch: ${names.join(', ')}` : 'No residents assigned here.'), el('p', 'town-meta', `${Math.round(perMinute(daily.buildings[b.id]?.input.food || 0) * 10) / 10} food/min for watch supplies · ${Math.round(perMinute(spec.recipe.input.food) * 10) / 10} at full staffing`));
        if (b.type === 'lumber') { const grove = sim.woodlandStatus(state, b); row.append(el('p', 'town-meta', `${grove.mature} mature trees · ${grove.saplings} ${grove.saplings === 1 ? 'sapling' : 'saplings'} · ${grove.stumps} ${grove.stumps === 1 ? 'stump' : 'stumps'}. Automatic replanting · 3 in-game days to mature.`)); }
      if (status.blockedReason) row.append(el('p', 'problem', status.blockedReason));
        if (status.workers < status.desiredWorkers) row.append(el('p', 'problem', 'Requested posts are unfilled. Free residents from other work or raise this workplace’s priority.'));
        const controls = el('div', 'town-row-actions');
        if (b.paused) controls.append(btn('Resume this watch house', `watch-resume-${b.id}`, () => action(() => sim.pauseBuilding(state, b.id, false))));
        controls.append(btn(b.priority < 10 ? 'Priority: high' : 'Give guards priority', `watch-priority-${b.id}`, () => action(() => sim.setPriority(state, b.id, b.priority < 10 ? 10 : 0))), btn('View watch house', `watch-find-${b.id}`, () => inspect(b), { className: 'text-button' })); row.append(controls); box.append(row);
      }
      return box;
    }
    if (!incident) {
      nodes.push(el('p', 'town-empty', 'Quiet water. A chance to prepare.'), el('p', 'town-intro', coast.announcementDeferred ? 'A new cargo warning is held while the island handles its current physical threat. Already announced deadlines still run.' : coast.nextIncidentDay ? `The next cargo warning can begin in ${duration(coast.nextWarningSeconds)} at 1×. Keep a reserve of food and building supplies, or establish a standing watch.` : 'After the bell and twenty residents, coastal crews begin demanding cargo. You can supply them, shelter stores or prepare guards.'), watchPlan(), watchStaffing());
    } else {
      const heading = el('div', 'coastal-warning'); heading.append(el('small', '', `Arrival in ${until(state, incident.deadline)} at 1×`), el('h3', '', incident.title), el('p', 'problem', `Cargo at risk: ${resourceText(incident.projectedLoss)}`)); nodes.push(heading);
      if (!incident.canPrepareInTime) nodes.push(el('p', 'problem', 'At the current staffing and supplies, the watch cannot finish this defense before arrival. Paying ends the warning; sheltering reduces the loss if the crew takes cargo.'));
      const choices = el('div', 'watch-decisions');
      const pay = el('section'); pay.append(el('strong', '', 'Provision the crew'), el('p', '', `${resourceText(incident.demand)} → warning ends now`), btn('Pay the demand', 'pressure-pay', () => action(() => sim.actOnPressure(state, 'pay')), { disabled: !incident.canPay, className: 'primary' }));
      if (!incident.canPay) pay.append(el('small', '', incident.payReason)); choices.append(pay);
      const shelter = el('section'); shelter.append(el('strong', '', incident.sheltered ? 'Stores sheltered' : 'Shelter the stores'), el('p', '', `${resourceText(incident.shelterCost)} → 40% less exposed cargo`));
      if (!incident.sheltered) shelter.append(btn('Shelter the stores', 'pressure-shelter', () => action(() => sim.actOnPressure(state, 'shelter')), { disabled: !incident.canShelter }));
      shelter.append(el('small', '', 'The warning continues.')); if (!incident.canShelter && !incident.sheltered) shelter.append(el('small', '', incident.shelterReason)); choices.append(shelter);
      const defend = el('section'); defend.append(el('strong', '', 'Send the prepared watch'), el('p', '', `${incident.readiness.toFixed(1)} / ${incident.requiredReadiness} readiness · patrol ${Math.floor(incident.preparedness * 100)}%`), btn('Repel the crew', 'pressure-defend', () => action(() => sim.actOnPressure(state, 'defend')), { disabled: !incident.canDefend, className: 'primary' }));
      defend.append(el('small', '', `${resourceText(incident.reward)} + 1 ${incident.partner} trust. Automatic at the deadline if still ready.`)); choices.append(defend); nodes.push(choices);
      const patrol = el('div', 'town-row'); patrol.append(el('strong', '', `${incident.guards} supplied guards · ${incident.readiness.toFixed(1)} / ${incident.requiredReadiness} readiness`), progressBar(incident.preparedness), el('p', '', `Patrol ${Math.floor(incident.preparedness * 100)}% prepared · ${incident.patrolSecondsRemaining === null ? 'work waits for supplied guards' : `${duration(incident.patrolSecondsRemaining)} left at current staffing, at 1×`}.`), el('p', 'town-meta', incident.defendReason), watchPlan(), watchStaffing()); nodes.push(patrol);
      const risk = disclosure('coast-risk', 'Cargo exposure & recovery'); risk.append(el('p', 'town-meta', `Maximum loss: ${resourceText(incident.maximumLoss)}. Warehouses reduce exposure by ${Math.round(incident.warehouseProtection * 100)}%. A failed coastal defense leaves people and buildings intact. Resolving this incident gives at least 12 minutes at 1× before a new cargo warning.`)); nodes.push(risk);
    }
    const history = disclosure('coastal-history', `Coastal record · ${coast.totals.defended} defenses · ${coast.totals.paid} paid · ${coast.totals.losses} raids`);
    for (const record of [...(state.pressure?.history || [])].reverse().slice(0, 8)) { const row = el('div', 'town-row'); row.append(el('strong', '', `Day ${calendarDay(state, record.day)} · ${record.outcome === 'defended' ? 'Shore secured' : record.outcome === 'paid' ? 'Crew provisioned' : 'Cargo taken'}`), el('p', 'town-meta', record.outcome === 'defended' ? `Earned ${resourceText(record.reward)}` : record.outcome === 'paid' ? 'Time to replenish stores before the next warning.' : `Lost ${resourceText(record.loss)}`)); history.append(row); }
    nodes.push(history);
    return nodes;
  }
  function update(force = false) {
    const state = canMutate() ? getState() : structuredClone(getState()), work = sim.workforce(state), queue = sim.constructionQueue(state), narrow = matchMedia('(max-width: 760px)').matches;
    $('workforce-summary').textContent = narrow ? `${work.idle} free` : `${work.idle} free / ${state.population} hands`;
    $('queue-summary').textContent = queue.length ? `${queue.length} ${queue.length === 1 ? 'project' : 'projects'}${narrow ? '' : ` · ${Math.round(queue[0].ratio * 100)}%`}` : narrow ? 'No projects' : 'Tools at rest';
    $('treasury-summary').textContent = `${format(state.resources.gold)} ${narrow ? 'coin' : 'gold'}`;
    $('council-summary').textContent = state.research.active ? 'Researching' : state.policies.charter ? progression.POLICIES[state.policies.charter].name : `${format(state.resources.knowledge)} knowledge`;
    $('trade-summary').textContent = state.contracts.active.length ? `${state.contracts.active.length} ${narrow ? 'orders' : 'active orders'}` : narrow ? 'Requests' : 'Coastal requests';
    const coast = pressureOptions(state);
    $('watch-summary').textContent = coast.active ? `${until(state, coast.active.deadline)} · ${narrow ? 'Sails' : 'Sails offshore'}` : 'Quiet coast';
    $('watch-button').classList.toggle('threatened', !!coast.active);
    document.querySelectorAll('[data-town-tab]').forEach(button => button.setAttribute('aria-pressed', String(tab === button.dataset.townTab)));
    if (!tab || !force && townPress.held) return;
    if (researchMapOpen && (mapGesture || performance.now() < mapScrollUntil) && !force) return;
    const signature = JSON.stringify([tab, selectedResource, state.day, Math.floor(state.time), getPaused(), Object.values(state.resources).map(Math.floor), effectiveMorale(state), state.seasons, state.builderTarget, state.buildings.map(b => [b.id, b.level, b.status, b.desiredWorkers, b.workerIds, b.priority, b.paused, Math.floor(b.progress), Math.round((b.production?.efficiency || 0)*100), b.production?.blockedReason]), state.research, state.policies, state.guidance, state.contracts, state.routes, state.imports, state.pressure, !!state.frontier?.warning, !!state.frontier?.raidActive, state.citizens.map(c => [c.id, c.job, c.workplace])]);
    if (!force && signature === lastSignature) return; lastSignature = signature;
    $('town-book-title').textContent = tab === 'council' && researchMapOpen ? 'Research map' : tab === 'stores' && selectedResource ? RESOURCES[selectedResource].name : titleFor[tab];
    $('town-book-kicker').textContent = `${seasonInfo(state).label} · ${state.population} residents · ${Math.round(effectiveMorale(state))}% morale`;
    const render = { workforce: workforceContent, construction: queueContent, stores: storesContent, council: councilContent, trade: tradeContent, watch: watchContent }[tab];
    preserveReplace($('town-book-content'), render(state));
  }
  function inspectorControls(building) {
    if (inspectorPress.held) { pendingInspector = building; return; }
    pendingInspector = null;
    const state = getState(), status = sim.buildingStatus(state, building), nodes = [];
    if (building.status !== 'ready') {
      if (getPaused()) nodes.push(pauseCue());
      const stage = building.paused ? 'Work paused' : building.workerIds.length ? `The crew is ${building.constructionKind === 'upgrade' ? 'improving' : 'raising'} this building` : 'Waiting for builders';
      nodes.push(el('div', 'construction-stage', stage), progressBar(status.ratio, building.paused), el('p', 'town-meta', `${Math.round(status.ratio * 100)}% complete · ${Math.ceil(status.workRequired - status.progress)} person-seconds left`));
      const actions = el('div', 'town-row-actions'); actions.append(btn('Manage projects', `inspect-queue-${building.id}`, () => open('construction')), btn(building.paused ? 'Resume' : 'Pause', `inspect-project-pause-${building.id}`, () => action(() => sim.pauseBuilding(state, building.id, !building.paused)))); nodes.push(actions);
    } else {
      if (building.paused && !status.maxWorkers) nodes.push(btn('Resume this building', `inspect-rest-${building.id}`, () => action(() => sim.pauseBuilding(state, building.id, false))));
      if (status.maxWorkers) {
        const box = el('div', 'inspect-staffing'), row = el('div', 'town-control'); row.append(el('strong', '', `${status.workers} / ${status.desiredWorkers} working`), stepper(status.desiredWorkers, 0, status.maxWorkers, `inspect-staff-${building.id}`, count => action(() => sim.setWorkers(state, building.id, count))));
        box.append(row, el('p', 'town-meta', `${JOBS[BUILDINGS[building.type].job]?.plural || 'Workers'} · ${Math.round(status.efficiency * 100)}% output`));
        box.append(btn(building.paused ? 'Resume work' : 'Rest this workplace', `inspect-rest-${building.id}`, () => action(() => sim.pauseBuilding(state, building.id, !building.paused)))); if (status.workers < status.desiredWorkers) box.append(btn('Find available workers', `inspect-people-${building.id}`, () => revealWorkplace(building.id)), el('p', 'town-meta', 'Requested workers share the same residents. Rest another workplace or raise this one’s priority in People.'));
        nodes.push(box);
      }
      const upgrade = sim.canUpgrade(state, building.id);
      if (getBuildingSpec(building.type).upgrades?.length && building.level < 3) {
        const box = el('div', 'inspect-upgrade'), next = getBuildingSpec(building.type, building.level + 1);
        const current = getBuildingSpec(building.type, building.level);
        box.append(el('strong', '', `Improve to level ${building.level + 1}`));
        if (next.housing) box.append(el('p', '', `Housing: ${current.housing} → ${next.housing} beds.`));
        if (next.workers) box.append(el('p', '', `Staff for full output: ${current.workers} → ${next.workers}.`));
        if (Object.values(next.recipe.output).some(n => n > 0)) box.append(el('p', '', `Full output/min: ${resourceText(perMinuteGoods(current.recipe.output))} → ${resourceText(perMinuteGoods(next.recipe.output))}.`));
        if (Object.values(next.recipe.input).some(n => n > 0)) box.append(el('p', '', `Full inputs/min: ${resourceText(perMinuteGoods(current.recipe.input))} → ${resourceText(perMinuteGoods(next.recipe.input))}.`));
        if (next.service) box.append(el('p', '', `Service reach: ${current.service.radius} → ${next.service.radius} spaces. Full capacity: ${Math.round((current.service.capacity || 0) * (current.service.strength || 1))} → ${Math.round((next.service.capacity || 0) * (next.service.strength || 1))} beds.`));
        if (next.storage) box.append(el('p', '', `Extra storage: ${current.storage} → ${next.storage} of every physical good.`));
        box.append(el('p', 'upgrade-cost', `Build with ${resourceText(upgrade.cost || {})}.`));
        box.append(btn('Queue the upgrade', `upgrade-${building.id}`, () => action(() => sim.queueUpgrade(state, building.id)), { disabled: !upgrade.ok, title: upgrade.reason, className: 'primary' })); if (!upgrade.ok) box.append(el('p', 'town-meta', upgrade.reason)); nodes.push(box);
      }
    }
    preserveReplace($('inspect-management'), nodes);
  }
  function revealResearch(id) {
    const wasMap = researchMapOpen; researchMapOpen = false;
    if (tab !== 'council') open('council');
    else if (wasMap) update(true);
    const card = $('town-book-content').querySelector(`[data-research="${CSS.escape(id)}"]`);
    if (card?.closest('details')) card.closest('details').open = true;
    card?.scrollIntoView({ block: 'nearest' }); card?.querySelector('button.primary')?.focus({ preventScroll: true });
  }
  function revealPaths() {
    const wasMap = researchMapOpen; researchMapOpen = false;
    if (tab !== 'council') open('council');
    else if (wasMap) update(true);
    $('town-book-content').querySelector('[data-council-section="paths"]')?.scrollIntoView({ block: 'start' });
  }
  function showResearchMap(id = mapSelection) {
    mapSelection = id; researchMapOpen = true; if (tab !== 'council') open('council'); else update(true); $('town-book-content').scrollTop = 0;
    const viewport = $('town-book-content').querySelector('[data-scroll-region="research-map"]');
    if (viewport && mapScroll) { viewport.scrollLeft = mapScroll.left; viewport.scrollTop = mapScroll.top; }
  }
  function revealWorkplace(id) {
    open('workforce'); const row = $('town-book-content').querySelector(`[data-workplace="${CSS.escape(id)}"]`);
    row?.scrollIntoView({ block: 'start' }); row?.querySelector(`[data-action-id="priority-${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }
  function revealResource(id) {
    if (!RESOURCE_NAMES.includes(id)) return;
    if (tab === 'stores') {
      if (!selectedResource) storesScroll = $('town-book-content').scrollTop;
      selectedResource = id; festivalPreview = null; update(true); $('town-book-content').scrollTop = 0;
    } else { storesScroll = 0; open('stores', id); }
    $('town-book-content').querySelector('[data-action-id="all-resources"]')?.focus({ preventScroll: true });
  }
  function revealSeason() {
    revealResource('food'); const section = $('season-calendar');
    if (section) { section.open = true; section.scrollIntoView({ block: 'start' }); section.querySelector('summary')?.focus({ preventScroll: true }); }
  }
  return { open, close, update, inspectorControls, revealResearch, revealPaths, revealResource, revealSeason, revealWorkplace, get selectedResource() { return selectedResource; }, get activeTab() { return tab; } };
}
