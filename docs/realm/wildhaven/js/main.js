import { calendarDay, calendarFraction, perMinute, perMinuteGoods, until } from './calendar.js';
import { createFieldbook } from './fieldbook-ui.js';
import { isFieldworker } from './discovery.js';
import { VillageWorld } from './world.js';
import * as sim from './sim.js';
import { BUILDINGS, JOBS, RESOURCES, RESOURCE_NAMES, getBuildingSpec } from './catalog.js';
import { canUnlockBuilding } from './progression.js';
import { createTownUI, resourceText } from './town-ui.js';
import { createAudio } from './audio.js';
import { pressureOptions } from './pressure.js';
import { createFrontierUI } from './frontier-ui.js';
import { buildingFacts, nextTownStep } from './clarity.js';
import { buildingPurpose } from './clarity-ui.js';
import { createCompanionStore } from './companion-store.js';
import { createCompanionUI } from './companion-ui.js';

const $ = id => document.getElementById(id);
const compactTablet = matchMedia('(min-width:0px)');
const SAVE_KEY = 'wildhaven.v4', SETTINGS_KEY = 'wildhaven.preferences.v1';
const CATEGORIES = {
  beginnings: { name: 'Foundations', types: ['cottage','orchard','lumber','quarry','garden','well','school','bell'] },
  harvest: { name: 'Food & fields', types: ['garden','orchard','farm','windmill','bakery','brewery'] },
  craft: { name: 'Craft & industry', types: ['lumber','quarry','sawmill','mine','smith','toolmaker','flaxfield','weaver'] },
  town: { name: 'Town life', types: ['cottage','well','school','clinic','chapel','manor'] },
  coast: { name: 'Trade & watch', types: ['market','warehouse','barracks','bell'] },
};
let state = sim.createGame(), saved = null, playing = false, speed = 1, previousSpeed = 1;
let tool = null, hovered = null, rotation = 0, selected = null, icons = {}, uiClock = 0, saveClock = 0, toastTimer;
let touchPlacement = false, touchSite = null;
let soundEnabled = false, storageAvailable = true, victorySeen = false, world, town, frontierUI, fieldbook, companionUI, category = 'beginnings';
const keys = new Set();
let lastInspectorSignature = '', currentNextStep = null, soundMix={effects:.8,ambience:.55};
let objectiveBeforeTablet = !matchMedia('(max-width:760px)').matches;
function closeBuildDrawer() { document.body.classList.remove('tablet-build-open'); $('tablet-build-toggle')?.setAttribute('aria-expanded', 'false'); }
function setObjectiveExpanded(expanded) {
  $('ambition-body').hidden = !expanded; $('collapse-objective').textContent = expanded ? '−' : '+';
  $('collapse-objective').setAttribute('aria-expanded', String(expanded)); $('collapse-objective').setAttribute('aria-label', expanded ? 'Collapse ambition' : 'Expand ambition');
}
function tabletLayoutChanged() {
  closeBuildDrawer();
  if (compactTablet.matches) { objectiveBeforeTablet = !$('ambition-body').hidden; setObjectiveExpanded(false); }
  else setObjectiveExpanded(objectiveBeforeTablet);
}
function mountTabletControls() {
  const buildButton = document.createElement('button'); buildButton.id = 'tablet-build-toggle'; buildButton.textContent = 'Build'; buildButton.setAttribute('aria-controls', 'build-shelf'); buildButton.setAttribute('aria-expanded', 'false');
  const townButton = document.createElement('button'); townButton.id = 'tablet-town-toggle'; townButton.textContent = 'Town'; townButton.setAttribute('aria-controls', 'town-book'); townButton.setAttribute('aria-expanded', 'false');
  document.querySelector('.controls-hint>div').prepend(buildButton, townButton);
  buildButton.onclick = () => {
    if (!playing || !companions.canManage) return;
    const wasOpen = document.body.classList.contains('tablet-build-open');
    companionUI?.close(); fieldbook?.close(); frontierUI?.close(); town.close(); closeInspector(); cancelTool(); $('journal').hidden = true;
    if (!wasOpen) { document.body.classList.add('tablet-build-open'); buildButton.setAttribute('aria-expanded', 'true'); }
  };
  townButton.onclick = () => { if (town.activeTab) town.close(); else if (state.pressure?.active) town.open('watch'); else if (state.won && !state.policies.charter) town.revealPaths(); else town.open('workforce'); };
  compactTablet.addEventListener('change', tabletLayoutChanged); tabletLayoutChanged();
}

try { saved = sim.restore(localStorage.getItem(SAVE_KEY) || localStorage.getItem('wildhaven.v3') || localStorage.getItem('wildhaven.v2') || localStorage.getItem('wildhaven.v1')); const prefs=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');soundEnabled=!!prefs.sound;soundMix={effects:prefs.effects??.8,ambience:prefs.ambience??.55}; } catch { storageAvailable = false; }
let deviceStorage = null; try { deviceStorage = localStorage; } catch {}
const companions = createCompanionStore({ storage: deviceStorage });
const audio = createAudio({ muted: !soundEnabled, ...soundMix });
const format = value => Math.floor(value).toLocaleString();
const rateFormat = value => `${value >= 0 ? '+' : ''}${Math.round(value * 10) / 10}`;
const costText = resourceText;
function announce(message, error = false) { if (!message) return; $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, error ? 4800 : 3600); }
function save() {
  if (!playing) return;
  const result = companions.save(state); storageAvailable = result.ok;
  $('save-state').textContent = result.reason || (storageAvailable ? 'Saved on this device' : 'Storage unavailable · keep this tab open');
  $('save-warning').hidden = result.ok; $('save-warning').textContent = result.ok ? '' : result.reason;
}
function sync() { sim.refreshTown(state); world.sync(state); updateUI(); save(); }
function mutate(result, cue='build') { if (!companions.canManage) return; if (result?.ok) { sync(); audio.play(cue); } else audio.play('error'); announce(result?.reason, !result?.ok); }
function newVillage() { if (!companions.canManage) return; saved = null; state = sim.createGame(); victorySeen = false; enter(); announce('Six neighbors, two builders. Give them a roof, then a living.'); }
function enter(resuming = false) {
  playing = true; tool = null; selected = null; speed = resuming ? 0 : 1; previousSpeed = 1;
  touchPlacement = false; touchSite = null; closeBuildDrawer(); document.body.classList.remove('touch-placement-active'); $('confirm-building').hidden = true;
  $('intro').hidden = true; $('hud').hidden = false;
  document.querySelectorAll('dialog').forEach(d => d.close());
  $('restart-confirm').hidden = true; $('inspector').hidden = true; $('placement').hidden = true;
  town.close(); frontierUI?.close(); fieldbook?.close(); companionUI?.close(); world.select(null); world.selectCitizen?.(null); world.hoverCitizen?.(null); world.showPreview(null); world.home(); world.sync(state); updateUI(); save(); audio.start();
}
function useTool(type) {
  if (!playing || !companions.canManage) return;
  closeBuildDrawer();
  companionUI?.close(); frontierUI?.close(); fieldbook?.close();
  if (type === 'bell') { const bell = state.buildings.find(b => b.type === 'bell'); inspect(bell); world.focus(bell); return; }
  const unlocked = canUnlockBuilding(state, type);
  if (!unlocked.ok) { cancelTool(); town.revealResearch(BUILDINGS[type].unlock); announce(unlocked.reason, true); return; }
  if (tool === type) { cancelTool(); return; }
  town.close(); tool = type; selected = null; rotation = 0; touchSite = null; touchPlacement = matchMedia('(any-pointer:coarse)').matches;
  document.body.classList.toggle('touch-placement-active', touchPlacement);
  if (touchPlacement) { hovered = null; world.showPreview(null); }
  $('inspector').hidden = true; $('journal').hidden = true; world.select(null); world.selectCitizen?.(null);
  $('placement').hidden = false; $('placement-title').textContent = `${BUILDINGS[type].name} · ${costText(BUILDINGS[type].cost)}`;
  $('placement-purpose').replaceChildren(buildingPurpose(type));
  $('placement-detail').textContent = touchPlacement ? 'Tap a site to inspect the entrance and reach. Build here confirms the plan.' : 'Choose a site. The arrow marks the entrance; keep its approach clear.';
  $('confirm-building').hidden = !touchPlacement; $('confirm-building').disabled = true;
  $('world').style.cursor = 'crosshair'; if (hovered) hover(hovered); updateShelf(); audio.play('select');
}
function cancelTool() { tool = null; touchSite = null; touchPlacement = false; closeBuildDrawer(); document.body.classList.remove('touch-placement-active'); world.showPreview(null); world.showServiceArea(null, null); $('placement').hidden = true; $('confirm-building').hidden = true; $('world').style.cursor = 'grab'; updateShelf(); }
function hover(tile, pointer = {}) {
  if (tool && touchPlacement && pointer.pointerType === 'mouse') { touchPlacement = false; touchSite = null; document.body.classList.remove('touch-placement-active'); $('confirm-building').hidden = true; }
  if (tool && touchPlacement && ['touch','pen'].includes(pointer.pointerType)) return;
  hovered = tile; if (!playing) return; world.hoverCitizen?.(!tool ? tile?.citizen?.id || null : null); if (frontierUI?.hover(tile)) return; if (!tool) return;
  if (!tile) { world.showPreview(null); world.showServiceArea(null, null); $('placement-detail').textContent = 'Choose a site on the island.'; $('placement').classList.remove('invalid'); return; }
  const verdict = sim.canBuild(state, tool, tile.x, tile.z, rotation), spec = BUILDINGS[tool];
  world.showPreview(tool, tile, verdict.ok, rotation, { entranceLabel: !touchPlacement }); const reach = world.showServiceArea(tool, tile, 1, { label: !touchPlacement }); $('placement').classList.toggle('invalid', !verdict.ok);
  $('confirm-building').disabled = !verdict.ok || !touchSite;
  $('placement-detail').textContent = verdict.ok ? `${touchPlacement ? 'Entrance clear · ' : ''}${spec.work} person-seconds to build.${verdict.boosted ? ` ${verdict.bonus}` : touchPlacement ? '' : ' Keep the arrow’s approach clear.'}${reach ? ` ${touchPlacement ? `${reach.radius}-space reach · ` : ''}✓ ${reach.inRangeHomes} homes in reach · − ${reach.outsideHomes} outside.${touchPlacement ? '' : ' Staff and supplies determine service.'}` : ''}` : verdict.reason;
}
function commitBuilding(tile) {
  if (!tool || !tile || !companions.canManage) return;
  const result = sim.build(state, tool, tile.x, tile.z, rotation);
  if (!result.ok) { announce(result.reason, true); audio.play('error'); hover(tile); return; }
  audio.play('build'); sync(); world.showPreview(null); hovered = null; $('placement').classList.remove('invalid'); $('placement-detail').textContent = 'Queued. Choose another site, or Done to watch it grow.'; announce(`${BUILDINGS[tool].name} added to the construction queue.`);
}
function tap(tile, pointer = {}) {
  if (!playing || !companions.canManage || document.querySelector('dialog[open]')) return;
  if(!tool&&tile?.discovery&&!frontierUI?.activeTab){fieldbook.open(tile.discovery.id);return;}
  if(!tool&&tile?.unit&&isFieldworker(tile.unit)){fieldbook.open(tile.unit.missionSiteId);return;}
  if (frontierUI?.handleTap(tile)) return;
  if (!tile) { if (!tool) closeInspector(); return; }
  if (tool) {
    if (['touch','pen'].includes(pointer.pointerType)) {
      touchPlacement = true; touchSite = { x: tile.x, z: tile.z }; document.body.classList.add('touch-placement-active'); $('confirm-building').hidden = false; hover(touchSite); return;
    }
    commitBuilding(tile);
  } else {
    if (tile.citizen) { focusCitizen(tile.citizen); return; }
    if (tile.landmark === 'landing' || (tile.x === 2 && tile.z >= 7)) { inspectLanding(); return; }
    const building = sim.getBuildingAt(state, tile.x, tile.z);
    if (building) inspect(building); else closeInspector();
  }
}
function closeInspector() { lastInspectorSignature = ''; selected = null; $('inspector').hidden = true; world.select(null); world.selectCitizen?.(null); world.showServiceArea(null, null); }
function inspect(building) {
  if (!building) return;
  companionUI?.close(); frontierUI?.close(); fieldbook?.close(); selected = building; cancelTool(); town.close(); world.selectCitizen?.(null); world.select(building); world.showServiceArea(building.type, building, building.level, { label: !matchMedia('(pointer: coarse)').matches }); $('inspector').hidden = false; $('journal').hidden = true; audio.play('select'); updateInspector();
}
function inspectLanding() { frontierUI?.close(); fieldbook?.close(); selected = { id: 'landing', type: 'landing', x: 2, z: 8 }; cancelTool(); town.close(); world.select(selected); $('inspector').hidden = false; $('journal').hidden = true; audio.play('select'); updateInspector(); }
function focusCitizen(citizen) {
  const unit = state.frontier?.units.find(u => u.citizenId === citizen.id && !['dead','released'].includes(u.status));
  if(unit&&isFieldworker(unit)){fieldbook.open(unit.missionSiteId);world.focusWorld(unit.x,unit.z,14);return;}
  if (unit) { frontierUI.select('troop', unit.id); world.focusWorld?.(unit.x, unit.z, 14); return; }
  frontierUI?.close(); fieldbook?.close(); selected = { id: citizen.id, type: 'citizen' }; cancelTool(); town.close(); world.select(null); world.selectCitizen?.(citizen.id);
  const actor = world.actors.find(a => a.citizen.id === citizen.id);
  if (actor) { world.pan.set(actor.root.position.x, 0, actor.root.position.z); world.targetZoom = 12; }
  $('inspector').hidden = false; $('journal').hidden = true; audio.play('select'); updateInspector();
}
function updateInspector() {
  if (!selected) return;
  const signature = JSON.stringify([selected.id, selected.type, state.day, state.population, speed === 0,
    state.buildings.map(b => [b.id, b.level, b.status, b.progress, b.workerIds, b.desiredWorkers, b.paused, b.restored, Math.round((b.production?.efficiency || 0) * 100), b.production?.blockedReason]),
    Object.values(state.resources).map(Math.floor), state.research.completed,
    selected.type === 'citizen' ? [state.citizens.find(c => c.id === selected.id),world.actors.find(a=>a.citizen.id===selected.id)?.root.userData.workState,world.actors.find(a=>a.citizen.id===selected.id)?.parcel.visible] : null]);
  if (signature === lastInspectorSignature) return;
  lastInspectorSignature = signature;
  $('inspect-secondary').hidden = true; $('inspect-action').disabled = false; $('inspect-focus').hidden = false; $('inspect-purpose').replaceChildren();
  if (selected.type === 'landing') {
    $('inspect-title').textContent = 'The landing'; $('inspect-kind').textContent = 'A town beyond the horizon';
    $('inspect-description').textContent = 'Supply skiffs bring materials. Coastal neighbors place orders. Research navigation to send cargo along the coast.';
    $('inspect-image').src = icons.boat; $('inspect-image').hidden = false;
    $('inspect-detail').textContent = sim.tradeOffer(state, 'wood').reason; $('inspect-management').replaceChildren();
    $('inspect-action').textContent = 'Open trade & voyages'; return;
  }
  if (selected.type === 'citizen') {
    const citizen = state.citizens.find(c => c.id === selected.id); if (!citizen) { closeInspector(); return; }
    const workplace = state.buildings.find(b => b.id === citizen.workplace), job = JOBS[citizen.job];
    $('inspect-title').textContent = citizen.name; $('inspect-kind').textContent = `${job?.name || 'Available for work'} · arrived day ${calendarDay(state, citizen.arrivalDay)}`;
    $('inspect-description').textContent = workplace ? `${citizen.name} works at ${BUILDINGS[workplace.type].name.toLowerCase()}. Work assignments follow your staffing requests and workplace priorities.` : `${citizen.name} is available. Open People & jobs to give this neighbor a place to work.`;
    $('inspect-image').hidden = true; $('inspect-management').replaceChildren();
    const actor=world.actors.find(a=>a.citizen.id===citizen.id),activity=world.citizenCue?.(citizen.id)?.action || (actor?.parcel.visible?`Carrying ${actor.parcel.userData.cargo} to the village stores`:({working:'At the workbench',foraging:'Gathering food',walking:'On the way',unloading:'Delivering goods',watching:'Keeping watch',waiting:'Taking a short break'})[actor?.root.userData.workState]||'Finding the next task');
    $('inspect-description').textContent=(speed === 0 ? 'Time paused · ' : '')+activity+'. '+$('inspect-description').textContent;
    $('inspect-detail').textContent = `Practice: +${Math.round((sim.citizenSkill(citizen, citizen.job) - 1) * 100)}% output in this job. Experience stays with the person when work changes.`;
    $('inspect-action').textContent = 'Manage people & jobs'; $('inspect-focus').hidden = true;
    if (workplace) { $('inspect-secondary').hidden = false; $('inspect-secondary').textContent = 'Find their workplace'; } return;
  }
  selected = state.buildings.find(b => b.id === selected.id); if (!selected) { closeInspector(); return; }
  const spec = getBuildingSpec(selected.type, selected.level), status = sim.buildingStatus(state, selected);
  $('inspect-title').textContent = selected.type === 'bell' && !selected.restored ? 'The old bell' : spec.name;
  $('inspect-kind').textContent = `${selected.status === 'ready' ? 'Level ' + selected.level : selected.constructionKind === 'upgrade' ? 'Upgrading to level ' + selected.targetLevel : 'Under construction'} · ${status.label}`;
  $('inspect-description').textContent = ''; $('inspect-purpose').replaceChildren(buildingPurpose(selected.type, selected.level)); $('inspect-image').src = icons[selected.type] || icons.cottage; $('inspect-image').hidden = selected.type === 'hearth';
  const detail = $('inspect-detail'), action = $('inspect-action');
  if (selected.status !== 'ready') {
    detail.textContent = selected.constructionKind === 'upgrade' ? 'Production rests until the upgrade is complete. Existing residents keep their beds.' : 'Housing and production open when the crew finishes.';
    action.textContent = 'Cancel construction';
  } else if (selected.type === 'bell') {
    const verdict = sim.canBuild(state, 'bell', selected.x, selected.z);
    detail.textContent = selected.restored ? 'The bell is your first milestone. Research, craft, trade, and choose a charter to shape the town.' : `${costText(spec.cost)}. ${verdict.ok ? 'The village is ready for the work.' : verdict.reason}`;
    action.textContent = selected.restored ? 'Ring the bell' : 'Queue the restoration'; action.disabled = !selected.restored && !verdict.ok;
  } else {
    const production = sim.rates(state).buildings[selected.id];
    const details = [];
    if (status.housing) {
      details.push(`${status.housing} beds for your neighbors.`);
      const home = sim.villageNeeds(state).homes?.find(h => h.id === selected.id);
      if (home) details.push(['water', 'health', 'community'].map(k => `${k}: ${Math.round((home.coverage[k] || 0) * 100)}%`).join(' · ') + '.');
    }
    if (status.maxWorkers) details.push(`${status.blockedReason || 'Working'}${production && Object.values(production.output || {}).some(n => n > 0) ? ` · ${resourceText(perMinuteGoods(production.output))} per minute` : ''}${production && Object.values(production.input || {}).some(n => n > 0) ? ` · uses ${resourceText(perMinuteGoods(production.input))} per minute` : ''}.`);
    if (spec.service) {
      const reach = world.showServiceArea(selected.type, selected, selected.level, { label: !matchMedia('(pointer: coarse)').matches });
      if (reach) details.push(`✓ ${reach.inRangeHomes} homes in reach · − ${reach.outsideHomes} outside. ${Math.round(reach.allocatedBeds || 0)} beds served / ${Math.round(reach.capacity || 0)} supplied capacity. Radius ${reach.radius}.`);
    }
    detail.textContent = details.join(' ');
    const protectedHouse = status.housing && state.population > sim.rates(state).capacity - status.housing;
    action.textContent = selected.type === 'hearth' ? 'The hearth stays lit' : protectedHouse ? 'Complete replacement housing first' : 'Salvage · recover 75% of materials';
    action.disabled = selected.type === 'hearth' || protectedHouse;
  }
  town.inspectorControls(selected);
}
function updateShelf() {
  for (const button of document.querySelectorAll('[data-build]')) {
    const type = button.dataset.build, unlocked = canUnlockBuilding(state, type);
    button.setAttribute('aria-pressed', String(type === tool)); button.classList.toggle('locked', !unlocked.ok);
    button.querySelector('.build-access').textContent = unlocked.ok ? '' : 'Research needed';
    for (const k of RESOURCE_NAMES) { const span = button.querySelector(`[data-cost="${k}"]`); if (span) span.classList.toggle('unavailable', state.resources[k] < BUILDINGS[type].cost[k]); }
  }
}
function updateUI() {
  if (!companions.canManage) speed = 0;
  const daily = sim.rates(state), ambition = sim.objective(state), needs = sim.villageNeeds(state);
  for (const key of ['wood','stone','food']) { $(key).textContent = format(state.resources[key]); $(`${key}-rate`).textContent = `${rateFormat(perMinute(daily[key]))}/min`; $(`${key}-rate`).classList.toggle('negative', daily[key] < 0); }
  $('people').innerHTML = `${state.population} <em>/ ${daily.capacity}</em>`;
  $('arrival-status').textContent = needs.migration.eligible ? 'Welcoming arrivals' : daily.capacity <= state.population ? 'Homes are full' : 'Check town needs';
  $('arrival-status').parentElement.title = needs.migration.reason; $('day').textContent = `Day ${calendarDay(state)}`;
  const portion = calendarFraction(state);
  $('season').textContent = speed === 0 ? 'Taking a breath' : portion < .3 ? 'Early morning' : portion < .65 ? 'A good afternoon' : 'Almost tomorrow';
  $('day-progress').style.width = `${portion * 100}%`; $('village-mood').textContent = `${Math.round(state.morale)}% morale · ${state.population >= 40 ? 'A growing town' : state.population >= 20 ? 'Finding its purpose' : 'Putting down roots'}`;
  currentNextStep = nextTownStep(state, ambition, needs);
  $('objective-title').textContent = currentNextStep?.title || ambition.title; $('objective-description').textContent = currentNextStep?.description || ambition.description;
  $('objective-bar').parentElement.hidden = !!currentNextStep && currentNextStep.progress === undefined;
  $('objective-bar').style.width = `${Math.min(1, currentNextStep?.progress ?? ambition.current / ambition.total) * 100}%`;
  $('objective-count').textContent = currentNextStep?.count || (ambition.complete ? 'The town is yours to grow.' : `${Math.floor(ambition.current)} of ${Math.ceil(ambition.total)}`);
  $('objective-action').hidden = !currentNextStep; $('objective-action').textContent = currentNextStep?.label || '';
  $('objective-bigger').hidden = !currentNextStep; $('objective-bigger-text').textContent = `${ambition.title}: ${ambition.description}`;
  $('choose-town-path').hidden = !state.won || !!state.policies.charter;
  const townToggle = $('tablet-town-toggle'), incident = pressureOptions(state).active;
  townToggle?.setAttribute('aria-expanded', String(!!town?.activeTab));
  if (townToggle) {
    townToggle.textContent = incident ? `Town · ${until(state, incident.deadline)}` : 'Town';
    townToggle.classList.toggle('threatened', !!incident);
    townToggle.title = incident ? `${incident.title}: arrival in ${until(state, incident.deadline)} at 1×. Open the watch.` : 'People, projects, stores, council and trade';
  }
  const projects = sim.constructionQueue(state).length;
  if ($('tablet-build-toggle')) $('tablet-build-toggle').textContent = projects ? `Build · ${projects}` : 'Build';
  $('find-bell').hidden = state.won || ambition.step < 4; $('undo').disabled = !state.undo;
  $('pause').classList.toggle('active', speed === 0); $('pause').textContent = speed === 0 ? '▶' : 'Ⅱ'; $('pause').setAttribute('aria-label', speed === 0 ? 'Resume' : 'Pause');
  for (const button of document.querySelectorAll('[data-speed]')) button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speed));
  $('journal-entries').replaceChildren(...state.events.map(event => { const item = document.createElement('li'), label = document.createElement('small'); label.textContent = `Day ${calendarDay(state, event.day)}`; item.append(label, document.createTextNode(event.text)); return item; }));
  updateShelf(); updateInspector(); town?.update(); frontierUI?.update(); fieldbook?.update(); companionUI?.update(); if (tool && hovered) hover(hovered);
}
function setSpeed(value) { if (value > 0 && !companions.canManage) { announce(companions.readOnly ? 'This is a paused visit. Take the chair to manage this local town.' : companions.reason, true); return; } speed = value; if (value > 0) previousSpeed = value; updateUI(); audio.play('select'); }
function togglePause() { setSpeed(speed === 0 ? previousSpeed : 0); }
function toggleAudio() { soundEnabled = !soundEnabled; audio.mute(!soundEnabled); if (soundEnabled) audio.start(); updateAudio(); try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ sound: soundEnabled, effects:audio.effectsLevel,ambience:audio.ambienceLevel })); } catch {} }
function updateAudio() { $('sound').setAttribute('aria-pressed', String(soundEnabled)); $('sound').setAttribute('aria-label', soundEnabled ? 'Mute sound' : 'Enable sound'); $('sound').title = soundEnabled ? 'Mute sound' : 'Enable sound'; $('intro-sound').textContent = soundEnabled ? 'Sound is on' : 'Sound is off';$('mixer-toggle').textContent=soundEnabled?'Mute the island':'Enable sound';$('mixer-toggle').setAttribute('aria-pressed',String(soundEnabled)); }
function win() {
  if (victorySeen) return; victorySeen = true; cancelTool(); closeInspector(); town.close(); audio.play('win'); world.home();
  $('win-stats').innerHTML = `<span><strong>${state.population}</strong>islanders</span><span><strong>${calendarDay(state)}</strong>days together</span><span><strong>${state.buildings.length - 2}</strong>little places</span>`;
  setTimeout(() => { if (playing) $('win-dialog').showModal(); }, 1200);
}
function advance(dt) {
  if (!companions.canManage) return { changed: false, newDay: false, completed: 0 };
  const priorIncident = state.pressure?.active?.id, priorDay = calendarDay(state);
  const result = sim.tick(state, dt); if (result.changed) world.sync(state);
  if (result.newDay || result.completed) { updateUI(); save(); }
  if (calendarDay(state) !== priorDay) { audio.play('day'); announce(`Day ${calendarDay(state)}. A new morning on the island.`); }
  if (result.arrivals) { announce(`${result.arrivals} new ${result.arrivals === 1 ? 'neighbor has' : 'neighbors have'} arrived. ${state.migration.reason}`); }
  else if (result.completed) { audio.play('build'); announce(`${result.completed} ${result.completed === 1 ? 'project is' : 'projects are'} finished. Your builders are finding their next job.`); }
  if (state.pressure?.active?.id !== priorIncident) {
    const coast = pressureOptions(state);
    if (coast.active) { announce(`${coast.active.title}: the crew arrives in ${until(state, coast.active.deadline)} at 1×. Open the watch to plan your response.`, true); audio.play('bell'); }
    else if (priorIncident) announce(state.events.find(e => ['pressure','defense'].includes(e.type))?.text, true);
  }
  const frontierNotice = result.frontierEvents?.findLast(event => ['warning','battle','war','conquest','death'].includes(event.type));
  if (frontierNotice) { announce(frontierNotice.text, true); audio.play('bell'); }
  const fieldNotice=result.frontierEvents?.findLast(e=>['field-report','field-complete'].includes(e.type));if(fieldNotice){announce(fieldNotice.text);audio.play('discovery');save();}
  if (result.won && !victorySeen) win(); return result;
}
function makeShelf() {
  $('build-categories').replaceChildren(...Object.entries(CATEGORIES).map(([id, item]) => { const button = document.createElement('button'); button.textContent = item.name; button.dataset.category = id; button.setAttribute('aria-pressed', String(category === id)); button.onclick = () => { const drawer = document.body.classList.contains('tablet-build-open'); category = id; cancelTool(); makeShelf(); if (drawer) { document.body.classList.add('tablet-build-open'); $('tablet-build-toggle').setAttribute('aria-expanded', 'true'); } }; return button; }));
  $('build-shelf').replaceChildren(); $('shelf-title').textContent = CATEGORIES[category].name;
  CATEGORIES[category].types.forEach((type, index) => {
    const spec = BUILDINGS[type], facts = buildingFacts(type), button = document.createElement('button'); button.className = 'build-choice'; button.dataset.build = type; button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', `${spec.name}. ${facts.shortFlow}. ${facts.staffing}. ${facts.payoff} Build with ${costText(spec.cost)}.`);
    const key = document.createElement('kbd'); key.textContent = index + 1; const img = document.createElement('img'); img.src = icons[type]; img.alt = ''; const name = document.createElement('strong'); name.textContent = spec.name; const cost = document.createElement('span'); cost.className = 'cost';
    for (const resource of RESOURCE_NAMES.filter(k => spec.cost[k])) { const tag = document.createElement('span'); tag.dataset.cost = resource; tag.textContent = `${spec.cost[resource]} ${RESOURCES[resource].short}`; tag.setAttribute('aria-label', `${spec.cost[resource]} ${RESOURCES[resource].name}`); cost.append(tag); }
    const flow = document.createElement('span'); flow.className = 'build-flow'; flow.textContent = facts.shortFlow;
    const use = document.createElement('span'); use.className = 'build-use'; use.textContent = `${facts.jobs ? `${facts.jobs} ${facts.job}` : facts.staffing} · ${facts.next}`;
    const access = document.createElement('small'); access.className = 'build-access'; button.append(key, img, name, flow, use, cost, access); button.addEventListener('click', () => useTool(type)); $('build-shelf').append(button);
  }); updateShelf();
}
function attractVillage() {
  const demo = sim.createGame();
  const places = [['cottage',-2,0,0],['cottage',2,1,0],['cottage',-3,3,1],['cottage',3,-2,0],['orchard',-3,-2,0],['garden',-2,2,0],['windmill',3,4,0],['lumber',-5,-1,0],['quarry',5,-3,0],['school',2,-1,0]];
  demo.buildings.push(...places.map(([type,x,z,rotation],i) => ({ id:`preview${i}`,type,x,z,rotation,builtDay:1,level:1,status:'ready',workerIds:[],desiredWorkers:0,progress:0,workRequired:0 })));
  demo.buildings[1].restored = true;
  demo.citizens.forEach((c,i) => { c.job = i < 2 ? 'builder' : 'farmer'; c.workplace = i < 2 ? 'preview0' : 'preview4'; }); return demo;
}
function bind() {
  $('start').onclick = () => { if (saved) { $('help-dialog').showModal(); $('restart-confirm').hidden = false; } else newVillage(); };
  $('continue').onclick = () => { state = saved; victorySeen = state.won; enter(true); announce('Welcome home. Time is paused while you find your bearings.'); };
  $('sound-settings').onclick=()=>{$('sound-mixer').showModal();};$('mixer-toggle').onclick=toggleAudio;
  for(const key of ['effects','ambience']){const input=$('mix-'+key);input.value=audio[key+'Level']*100;input.oninput=()=>{audio.setMix({[key]:Number(input.value)/100});try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({sound:soundEnabled,effects:audio.effectsLevel,ambience:audio.ambienceLevel}));}catch{}};}
  $('sound-preview').onclick=async()=>{if(!soundEnabled)toggleAudio();await audio.start();audio.effect('anvil',{gain:.7,pan:-.3});};
  $('sound').onclick = toggleAudio; $('intro-sound').onclick = toggleAudio;
  $('pause').onclick = togglePause; for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => setSpeed(Number(b.dataset.speed));
  $('home').onclick = () => world.home(); $('turn-left').onclick = () => world.rotate(-1); $('turn-right').onclick = () => world.rotate(1); $('zoom-in').onclick = () => world.zoomBy(-3); $('zoom-out').onclick = () => world.zoomBy(3);
  $('cancel-building').onclick = cancelTool; $('rotate-building').onclick = () => { rotation = (rotation + 1) % 4; if (hovered) hover(hovered); };
  $('confirm-building').onclick = () => commitBuilding(touchSite);
  $('close-inspector').onclick = closeInspector; $('inspect-focus').onclick = () => selected && world.focus(selected);
  $('inspect-action').onclick = () => {
    if (!selected || !companions.canManage) return;
    if (selected.type === 'landing' || selected.type === 'citizen') { town.open(selected.type === 'landing' ? 'trade' : 'workforce'); return; }
    if (selected.status !== 'ready') { mutate(sim.cancelConstruction(state, selected.id)); return; }
    if (selected.type === 'bell') { if (selected.restored) { audio.play('bell'); announce('The bell carries all the way across the water.'); } else mutate(sim.build(state, 'bell', 0, -5)); return; }
    const result = sim.demolish(state, selected.id); if (result.ok) closeInspector(); mutate(result);
  };
  $('inspect-secondary').onclick = () => { const citizen = state.citizens.find(c => c.id === selected?.id), workplace = state.buildings.find(b => b.id === citizen?.workplace); if (workplace) { inspect(workplace); world.focus(workplace); } };
  $('landing-button').onclick = () => { cancelTool(); town.open('trade'); };
  $('undo').onclick = () => { if (companions.canManage) mutate(sim.undo(state)); };
  $('find-bell').onclick = () => { const b = state.buildings.find(b => b.type === 'bell'); inspect(b); world.focus(b); };
  $('objective-action').onclick = () => { const next = currentNextStep; if (!next) return; if (next.resource) town.revealResource(next.resource); else if (next.type) useTool(next.type); else if (next.buildingId) { const b = state.buildings.find(b => b.id === next.buildingId); inspect(b); world.focus(b); } else town.open(next.tab); };
  $('collapse-objective').onclick = () => setObjectiveExpanded($('ambition-body').hidden);
  $('choose-town-path').onclick = () => town.revealPaths();
  $('journal-button').onclick = () => { $('journal').hidden = !$('journal').hidden; }; $('close-journal').onclick = () => $('journal').hidden = true;
  $('help').onclick = () => { $('restart-confirm').hidden = true; $('help-dialog').showModal(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('restart').onclick = () => { $('restart-confirm').querySelector('p').textContent = companions.activeId === 'home' ? 'This replaces your saved home village. A linked companion town is kept.' : 'This replaces the local companion village. Your home town is kept.'; $('restart-confirm').hidden = false; }; $('cancel-restart').onclick = () => $('restart-confirm').hidden = true; $('confirm-restart').onclick = newVillage;
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || document.querySelector('dialog[open]') || !playing) return;
    if (!companions.canManage && !['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','Home','Escape','KeyP'].includes(e.code)) return;
    if (e.code === 'Space' && e.target.closest('button,summary')) return;
    if (e.code.startsWith('Arrow') && e.target.closest('#town-book, #inspector, #journal, #frontier-panel, #fieldbook, #companion-panel')) return;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    keys.add(e.code); if (e.repeat) return;
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ') { e.preventDefault(); $('undo').click(); return; }
    const index = Number(e.key) - 1; if (/^[1-9]$/.test(e.key) && CATEGORIES[category].types[index]) { useTool(CATEGORIES[category].types[index]); return; }
    if (e.code === 'Space') togglePause();
    if (e.code === 'Escape') { if (frontierUI?.cancelCommand()) return; frontierUI?.close(); fieldbook?.close(); companionUI?.close(); cancelTool(); closeInspector(); town.close(); $('journal').hidden = true; }
    if (e.code === 'KeyT') { cancelTool(); town.activeTab ? town.close() : town.open('workforce'); }
    if (e.code === 'KeyQ') world.rotate(-1); if (e.code === 'KeyE') world.rotate(1);
    if(e.code==='KeyB'){fieldbook.active?fieldbook.close():fieldbook.open();}
    if (e.code === 'KeyF') frontierUI?.activeTab ? frontierUI.close() : frontierUI?.open('neighbors');
    if (e.code === 'KeyR' && !frontierUI?.rotateCommand()) $('rotate-building').click(); if (e.code === 'Home') world.home();
    if (e.key === '?' || e.code === 'KeyH') $('help').click();
    if (e.code === 'Enter' && tool && (e.target === $('world') || e.target === document.body)) tap(hovered || { x: Math.round(world.pan.x / 1.8), z: Math.round(world.pan.z / 1.8) });
    if (e.code === 'KeyP') document.body.classList.toggle('photo');
  });
  document.addEventListener('keyup', e => keys.delete(e.code)); window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => { keys.clear(); if (document.hidden) save(); }); window.addEventListener('pagehide', save);
}
async function boot() {
  try {
    await companions.ready; saved = companions.loadHome(saved);
    world = new VillageWorld($('world'), { onHover: hover, onTap: tap, onSound:(kind,options)=>{if(playing&&speed>0)audio.effect(kind,options);}, onCamera: () => { if (tool && hovered) hover(hovered); } });
    let last = performance.now(), frames = 0, total = 0;
    function frame(now) { requestAnimationFrame(frame); const wallDt = (now - last) / 1000, dt = Math.min(wallDt, .08); last = now; if (document.hidden) return;
      const modal = !!document.querySelector('dialog[open]');
      if (playing && !modal) {
        let dx = 0, dz = 0; if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1; if (keys.has('KeyW') || keys.has('ArrowUp')) dz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) dz += 1;
        if (dx || dz) world.moveCamera(dx * dt * 8, dz * dt * 8); if (speed > 0 && companions.canManage) advance(Math.min(wallDt, .5) * speed);
        uiClock += dt; saveClock += dt; if (uiClock > .5) { updateUI(); uiClock = 0; } if (saveClock > 5) { save(); saveClock = 0; }
      }
      world.render(dt, { speed: playing ? (companions.canManage ? speed : 0) : 1, playing: !modal, dayTime: calendarFraction(state), won: playing && state.won }); frames++; total += wallDt;
      if (total > 2) { document.documentElement.dataset.fps = String(Math.round(frames / total)); frames = 0; total = 0; }
    }
    requestAnimationFrame(frame);
    icons = await world.load();
    town = createTownUI({ getState: () => state, canMutate: () => companions.canManage, getPaused: () => speed === 0, resume: () => setSpeed(previousSpeed), build: useTool, beforeOpen: () => { companionUI?.close(); frontierUI?.close(); fieldbook?.close(); cancelTool(); closeInspector(); }, mutate, inspect: b => { inspect(b); world.focus(b); }, focusCitizen, getIcons: () => icons });
    frontierUI = createFrontierUI({ getState: () => state, canMutate: () => companions.canManage, mutate, getContext: () => sim.frontierContext(state), beforeOpen: () => { companionUI?.close(); fieldbook?.close(); cancelTool(); closeInspector(); town.close(); $('journal').hidden = true; }, focus: item => item.kind === 'region' ? world.focusRegion?.(item.id) : world.focusWorld?.(item.x, item.z, item.kind === 'neighbor' ? 23 : 14), preview: value => world.showFrontierCommand?.(value), onSelection: value => world.selectFrontier?.(value) });
    document.querySelector('.controls-hint>div').append($('frontier-toggle'));
    fieldbook=createFieldbook({getState:()=>state,canMutate:()=>companions.canManage,getPaused:()=>speed===0,resume:()=>setSpeed(previousSpeed),getContext:()=>sim.frontierContext(state),getIcons:()=>icons,mutate,beforeOpen:()=>{companionUI?.close();frontierUI.close();cancelTool();closeInspector();town.close();$('journal').hidden=true;},focus:item=>item.mark?world.focusDiscovery(item.id):world.focusWorld(item.x,item.z,12)});
    companionUI=createCompanionUI({store:companions,getState:()=>state,beforeOpen:()=>{fieldbook.close();frontierUI.close();cancelTool();closeInspector();town.close();$('journal').hidden=true;},onStateChange:next=>{state=next;victorySeen=state.won;keys.clear();enter(true);},announce});
    mountTabletControls();
    const shelfObserver=new ResizeObserver(()=>{document.documentElement.style.setProperty('--shelf-edge',`${innerHeight-document.querySelector('footer').getBoundingClientRect().top+12}px`);});shelfObserver.observe(document.querySelector('footer'));
    makeShelf(); bind(); updateAudio(); world.sync(attractVillage()); world.pan.set(innerWidth < 700 ? -2 : -5, 0, 0); world.targetZoom = innerWidth < 700 ? 38 : 29;
    $('loading').hidden = true; $('intro').hidden = false;
    if (companions.blocked) { $('intro').querySelector('.intro-copy small').textContent = companions.reason; $('start').disabled = true; }
    if (saved) { $('continue').hidden = false; $('continue').className = 'primary'; $('start').textContent = 'Start somewhere new'; $('start').className = ''; }
    window.Wildhaven = Object.freeze({ getSnapshot: () => JSON.parse(sim.serialize(state)), getDiagnostics: () => ({ ...world.diagnostics(), fps: Number(document.documentElement.dataset.fps || 0) }) });
    if (['localhost','127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('review')) window.__wildhaven = { world, frontierUI, fieldbook, companionUI, audio, companionInfo:()=>companions.info(), frontierContext: () => sim.frontierContext(state), get state() { return state; }, advance, sync, project: (x,z) => world.project(x,z), snapshot: () => JSON.parse(sim.serialize(state)), canBuild: (type,x,z) => sim.canBuild(state,type,x,z) };
  } catch (error) {
    console.error(error); $('loading').replaceChildren(); const title = document.createElement('p'); title.textContent = 'The island couldn’t open.'; const message = document.createElement('small'); message.textContent = 'The island needs WebGL 2 and its local model files. Reload, or try a current browser.'; const retry = document.createElement('button'); retry.textContent = 'Try again'; retry.className = 'primary'; retry.onclick = () => location.reload(); $('loading').append(title,message,retry);
  }
}
boot();
