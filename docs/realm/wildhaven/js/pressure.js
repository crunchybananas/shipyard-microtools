import { until, duration, WORK_CYCLE_SECONDS, secondsUntil } from './calendar.js';
/** Coastal pressure: announced cargo risks, real patrol labor and bounded recovery. */
import { getBuildingSpec, RESOURCE_NAMES } from './catalog.js';
import { supplyModifiers } from './progression.js';

export const COASTAL_PACING = Object.freeze({ firstWarningSeconds: 360, warningSeconds: 360, recoverySeconds: 720 });
const PRESSURE_VERSION = 2;
const DAY_SECONDS = WORK_CYCLE_SECONDS;
const WARNING_DAYS = COASTAL_PACING.warningSeconds / DAY_SECONDS;
const QUIET_DAYS = COASTAL_PACING.recoverySeconds / DAY_SECONDS;
const LEGACY_WARNING_DAYS = 3, LEGACY_QUIET_DAYS = 5;
const SHELTER_COST = Object.freeze({ wood: 8, planks: 6 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = value => Math.round(value * 1e6) / 1e6;
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const enough = (state, bag) => Object.entries(bag).every(([key, amount]) => (state.resources[key] || 0) + 1e-6 >= amount);
const text = bag => Object.entries(bag).filter(([, amount]) => amount > 0).map(([key, amount]) => `${Math.ceil(amount)} ${key === 'gold' ? 'coin' : key}`).join(', ') || 'no goods';
// Incidents resolve on economy boundaries. Round upward so an action taken late
// in a cycle still receives the full promised preparation/recovery interval.
const scheduleAfter = (state, cycles) => state.day + cycles + (((state.time || 0) + (state.subsecond || 0)) > 0 ? 1 : 0);
const frontierThreat = state => !!(state.frontier?.warning || state.frontier?.raidActive);

const INCIDENTS = [
  { id: 'hungry_sails', title: 'Hungry sails', description: 'A scavenger crew is watching the pantry boats. They will take provisions unless you provision them or secure the shore.', demand: { food: 14 }, risk: { food: 26, wood: 10 }, strength: 3, reward: 12, partner: 'reedbank', partnerName: 'Reedbank' },
  { id: 'timber_runners', title: 'The timber runners', description: 'A fast skiff has marked the timber landing. Its crew demands building supplies; a prepared watch can turn it away.', demand: { wood: 18 }, risk: { wood: 34, planks: 12 }, strength: 4, reward: 16, partner: 'stonehaven', partnerName: 'Stonehaven' },
  { id: 'false_toll', title: 'A false harbor toll', description: 'Armed toll collectors have anchored beyond the quay. Pay their demand, shelter the stores, or prepare the watch before they come ashore.', demand: { gold: 18, food: 6 }, risk: { gold: 32, cloth: 8, food: 14 }, strength: 5, reward: 20, partner: 'lantern_isles', partnerName: 'Lantern Isles' },
  { id: 'night_cargo', title: 'The night cargo raid', description: 'Lookouts report a crew seeking workshop cargo. Guards need a full patrol rotation to secure the landing before the night raid.', demand: { tools: 4, gold: 12 }, risk: { tools: 6, iron: 10, food: 20 }, strength: 6, reward: 24, partner: 'far_sound', partnerName: 'Far Sound' },
];

function terms(active) {
  const spec = INCIDENTS.find(item => item.id === active.templateId);
  const scale = 1 + active.tier * 0.35;
  const bag = values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.ceil(value * scale)]));
  const strength = spec.strength + active.tier * 2;
  return { ...spec, demand: bag(spec.demand), risk: bag(spec.risk), strength, reward: { gold: spec.reward + active.tier * 8 }, watchRequired: strength * DAY_SECONDS };
}

export function createPressureState() {
  return { version: PRESSURE_VERSION, sequence: 0, nextIncidentDay: null, active: null, history: [], defended: 0, paid: 0, losses: 0, graceUntilDay: 0 };
}

/** Strict persisted terms. Costs/rewards are regenerated from the canonical incident. */
export function normalizePressure(state) {
  if (state.pressure === undefined) { state.pressure = createPressureState(); return state.pressure; }
  const value = state.pressure, day = state.day;
  const fail = () => { throw new Error('Invalid coastal pressure save'); };
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, PRESSURE_VERSION].includes(value.version) || !integer(value.sequence, 0, 1000000)) fail();
  const maxScheduledDay = day + (value.version === 1 ? LEGACY_QUIET_DAYS : QUIET_DAYS + 1);
  if (![value.defended, value.paid, value.losses].every(n => integer(n, 0, value.sequence))) fail();
  if (!integer(value.graceUntilDay, 0, maxScheduledDay)) fail();
  // A scheduled warning can remain dormant below the population threshold or
  // during a physical raid. Preserve that date; neither situation corrupts a save.
  if (value.nextIncidentDay !== null && !integer(value.nextIncidentDay, 1, maxScheduledDay)) fail();
  if (!Array.isArray(value.history) || value.history.length > 20) fail();
  let active = null;
  if (value.active !== null) {
    const a = value.active;
    const warningDays = a?.deadline - a?.announcedDay;
    const validWarning = value.version === 1 ? warningDays === LEGACY_WARNING_DAYS : [LEGACY_WARNING_DAYS, WARNING_DAYS].includes(warningDays);
    if (!a || typeof a !== 'object' || Array.isArray(a) || value.sequence < 1 || a.id !== `coast-${value.sequence}` || a.templateId !== INCIDENTS[(value.sequence - 1) % INCIDENTS.length].id || !integer(a.tier, 0, 2) || !integer(a.announcedDay, 1, day) || !validWarning || !integer(a.deadline, day, day + WARNING_DAYS) || typeof a.sheltered !== 'boolean') fail();
    if (!finite(a.watchProgress) || a.watchProgress < 0 || a.watchProgress > terms(a).watchRequired) fail();
    if (value.nextIncidentDay !== null) fail();
    active = { id: a.id, templateId: a.templateId, tier: a.tier, announcedDay: a.announcedDay, deadline: a.deadline, watchProgress: a.watchProgress, sheltered: a.sheltered };
  }
  if (value.defended + value.paid + value.losses !== value.sequence - (active ? 1 : 0)) fail();
  let previous = 0;
  const validBag = bag => bag && typeof bag === 'object' && !Array.isArray(bag) && Object.entries(bag).every(([key, amount]) => RESOURCE_NAMES.includes(key) && finite(amount) && amount >= 0 && amount <= 1000000);
  const history = value.history.map(h => {
    const sequence = typeof h?.id === 'string' && /^coast-[1-9]\d*$/.test(h.id) ? Number(h.id.slice(6)) : 0;
    if (!integer(sequence, previous + 1, value.sequence - (active ? 1 : 0)) || !['defended', 'paid', 'raided'].includes(h.outcome) || !integer(h.day, 1, day) || !validBag(h.loss) || !validBag(h.reward)) fail();
    previous = sequence;
    return { id: h.id, day: h.day, outcome: h.outcome, loss: { ...h.loss }, reward: { ...h.reward } };
  });
  state.pressure = { version: PRESSURE_VERSION, sequence: value.sequence, nextIncidentDay: value.nextIncidentDay, active, history, defended: value.defended, paid: value.paid, losses: value.losses, graceUntilDay: value.graceUntilDay };
  return state.pressure;
}

/** Effective supplied guard labor, including personal experience and researched organization. */
export function coastalReadiness(state) {
  const citizens = new Map((state.citizens || []).map(c => [c.id, c]));
  let readiness = 0, guards = 0;
  for (const b of state.buildings || []) {
    if (b.type !== 'barracks' || b.status !== 'ready' || b.paused) continue;
    const people = [...citizens.values()].filter(c => c.workplace === b.id && c.job === 'guard');
    if (!people.length) continue;
    const spec = getBuildingSpec(b.type, b.level || 1), efficiency = finite(b.production?.efficiency) ? Math.max(0, b.production.efficiency) : 0;
    // A production cache is authoritative for input availability; never invent supplied guards.
    const effective = Math.min(people.length * 1.2, efficiency * spec.workers);
    readiness += effective; if (effective > 0) guards += people.length;
  }
  const factor = supplyModifiers(state, 'barracks').defense || 1;
  return { readiness: round(readiness * factor), guards, modifier: factor };
}

function warehouseProtection(state) {
  return Math.min(0.3, (state.buildings || []).filter(b => b.type === 'warehouse' && b.status === 'ready' && !b.paused).reduce((sum, b) => sum + 0.1 + 0.05 * ((b.level || 1) - 1), 0));
}

export function pressureOptions(state) {
  const pressure = state.pressure || createPressureState();
  const nextWarningSeconds = pressure.nextIncidentDay === null ? null : round(secondsUntil(state, pressure.nextIncidentDay));
  const result = { active: null, nextIncidentDay: pressure.nextIncidentDay, nextWarningSeconds, announcementDeferred: !pressure.active && nextWarningSeconds === 0 && frontierThreat(state), graceUntilDay: pressure.graceUntilDay, totals: { defended: pressure.defended, paid: pressure.paid, losses: pressure.losses } };
  if (!pressure.active) return result;
  const active = pressure.active, spec = terms(active), watch = coastalReadiness(state);
  const preparedness = clamp(active.watchProgress / spec.watchRequired, 0, 1), warehouses = warehouseProtection(state);
  const protection = (1 - warehouses) * (active.sheltered ? 0.6 : 1);
  const maximumLoss = Object.fromEntries(Object.entries(spec.risk).map(([key, amount]) => [key, Math.ceil(amount * protection)]));
  const defense = clamp(watch.readiness / spec.strength, 0, 1) * (0.5 + preparedness * 0.5);
  const projectedLoss = Object.fromEntries(Object.entries(maximumLoss).map(([key, amount]) => [key, Math.min(state.resources[key] || 0, Math.ceil(amount * (1 - defense) - 1e-8))]));
  const canPay = enough(state, spec.demand), canShelter = !active.sheltered && enough(state, SHELTER_COST);
  const canDefend = watch.readiness + 1e-6 >= spec.strength && preparedness + 1e-8 >= 1;
  const remainingPatrol = Math.max(0, spec.watchRequired - active.watchProgress), patrolRate = Math.min(spec.strength, watch.readiness);
  const patrolSecondsRemaining = remainingPatrol === 0 ? 0 : patrolRate > 0 ? round(remainingPatrol / patrolRate) : null;
  const secondsLeft = round(secondsUntil(state, active.deadline));
  const defendReason = canDefend ? 'The supplied watch is ready to end this cargo incident.' : watch.readiness + 1e-6 < spec.strength ? `Need ${spec.strength} supplied watch readiness; ${watch.readiness.toFixed(1)} ready. Assign civilian guards to watch houses and keep food supplied. Recruited company troops have a separate job.` : `Patrol ${Math.floor(preparedness * 100)}% complete; ${duration(patrolSecondsRemaining)} of supplied watch work remains at 1×. Keep the guards at their posts.`;
  result.active = {
    id: active.id, title: spec.title, description: spec.description, announcedDay: active.announcedDay, deadline: active.deadline,
    daysLeft: round(secondsLeft / DAY_SECONDS), secondsLeft, patrolSecondsRemaining,
    demand: spec.demand, maximumLoss, projectedLoss, reward: spec.reward, partner: spec.partnerName, partnerId: spec.partner,
    guardsNeeded: Math.ceil(spec.strength / watch.modifier), requiredReadiness: spec.strength, readiness: watch.readiness, guards: watch.guards,
    readinessShortfall: round(Math.max(0, spec.strength - watch.readiness)), canPrepareInTime: watch.readiness + 1e-6 >= spec.strength && patrolSecondsRemaining !== null && patrolSecondsRemaining <= secondsLeft,
    watchProgress: active.watchProgress, watchRequired: spec.watchRequired, preparedness, sheltered: active.sheltered, warehouseProtection: warehouses,
    shelterCost: { ...SHELTER_COST }, canPay, canShelter, canDefend,
    payReason: canPay ? `Give ${text(spec.demand)} to end this incident.` : `The demand is ${text(spec.demand)}; the stores cannot cover it yet.`,
    shelterReason: active.sheltered ? 'The stores are sheltered. Maximum cargo loss is reduced by another 40%.' : canShelter ? `Spend ${text(SHELTER_COST)} to reduce maximum cargo loss by 40%.` : `Need ${text(SHELTER_COST)} to shelter the stores.`,
    defendReason,
  };
  return result;
}

function finish(state, outcome, option) {
  const pressure = state.pressure, id = pressure.active.id, loss = {}, reward = {};
  if (outcome === 'paid') {
    for (const [key, value] of Object.entries(option.demand)) state.resources[key] = round(Math.max(0, state.resources[key] - value));
    pressure.paid++;
  } else if (outcome === 'defended') {
    // Defense earns coin and trust. Neither can be farmed by repeating a resolved action.
    for (const [key, value] of Object.entries(option.reward)) {
      const room = Math.max(0, (state.storage?.[key] ?? 100000) - (state.resources[key] || 0));
      reward[key] = Math.min(room, value); state.resources[key] = round((state.resources[key] || 0) + reward[key]);
    }
    if (state.routes?.reputation) state.routes.reputation[option.partnerId] = Math.min(12, (state.routes.reputation[option.partnerId] || 0) + 1);
    pressure.defended++;
  } else {
    for (const [key, value] of Object.entries(option.projectedLoss)) {
      loss[key] = Math.min(state.resources[key] || 0, value); state.resources[key] = round(Math.max(0, (state.resources[key] || 0) - loss[key]));
    }
    pressure.losses++;
  }
  pressure.history.push({ id, day: state.day, outcome, loss, reward }); pressure.history = pressure.history.slice(-20);
  pressure.active = null; pressure.graceUntilDay = scheduleAfter(state, QUIET_DAYS); pressure.nextIncidentDay = pressure.graceUntilDay;
  const recovery = `There are at least ${duration(COASTAL_PACING.recoverySeconds)} at 1× to recover before another coastal cargo warning.`;
  const reason = outcome === 'paid' ? `${option.title}: the crew accepted ${text(option.demand)} and sailed away. ${recovery}` : outcome === 'defended' ? `${option.title}: the prepared watch protected the cargo. Earned ${text(reward)} and 1 trust with ${option.partner}. ${recovery}` : `${option.title}: the crew took ${text(loss)}. This cargo incident harmed no residents or buildings. ${recovery}`;
  return { ok: true, outcome, reason, loss, reward, changed: true, events: [{ type: outcome === 'raided' ? 'pressure' : 'defense', text: reason }] };
}

/** Sim wraps this to journal the returned events and refresh resource/rate displays. */
export function actOnPressure(state, action) {
  const option = pressureOptions(state).active;
  if (!option) return { ok: false, reason: 'The coast is quiet. There is no active incident.', events: [] };
  if (action === 'pay') return option.canPay ? finish(state, 'paid', option) : { ok: false, reason: option.payReason, events: [] };
  if (action === 'defend') return option.canDefend ? finish(state, 'defended', option) : { ok: false, reason: option.defendReason, events: [] };
  if (action !== 'shelter') return { ok: false, reason: 'Choose supplies, sheltered stores, or a prepared watch.', events: [] };
  if (!option.canShelter) return { ok: false, reason: option.shelterReason, events: [] };
  for (const [key, amount] of Object.entries(SHELTER_COST)) state.resources[key] = round(Math.max(0, state.resources[key] - amount));
  state.pressure.active.sheltered = true;
  const reason = `${option.title}: citizens sheltered the stores. Maximum losses are reduced by 40%. Keep preparing the watch for the arrival in ${until(state, option.deadline)} at 1×.`;
  return { ok: true, reason, changed: true, events: [{ type: 'defense', text: reason }] };
}

export function tickPressure(state, dt) {
  const active = state.pressure?.active;
  if (!active || !finite(dt) || dt <= 0) return { changed: false, events: [] };
  const spec = terms(active), readiness = coastalReadiness(state).readiness;
  active.watchProgress = round(Math.min(spec.watchRequired, active.watchProgress + Math.min(spec.strength, readiness) * dt));
  return { changed: readiness > 0, events: [] };
}

export function dailyPressure(state) {
  const pressure = state.pressure ||= createPressureState();
  if (pressure.active) {
    if (state.day < pressure.active.deadline) return { changed: false, events: [] };
    const option = pressureOptions(state).active;
    return finish(state, option.canDefend ? 'defended' : 'raided', option);
  }
  if (!state.won || (state.citizens?.length ?? state.population) < 20) return { changed: false, events: [] };
  if (pressure.nextIncidentDay === null) {
    pressure.nextIncidentDay = scheduleAfter(state, COASTAL_PACING.firstWarningSeconds / DAY_SECONDS);
    return { changed: true, events: [{ type: 'coast', text: `A growing town draws eyes from the coast. The first cargo warning is expected in ${until(state, pressure.nextIncidentDay)} at 1×. Build reserves and plan civilian watch-house guards; recruited company troops answer physical raids separately.` }] };
  }
  if (state.day < pressure.nextIncidentDay) return { changed: false, events: [] };
  // Only new announcements wait. An already announced cargo deadline retains
  // its exact terms, including when loaded alongside a legacy physical warning.
  if (frontierThreat(state)) return { changed: false, events: [] };
  const tier = (state.citizens?.length ?? state.population) >= 60 ? 2 : (state.citizens?.length ?? state.population) >= 35 ? 1 : 0;
  const spec = INCIDENTS[pressure.sequence % INCIDENTS.length]; pressure.sequence++;
  pressure.active = { id: `coast-${pressure.sequence}`, templateId: spec.id, tier, announcedDay: state.day, deadline: state.day + WARNING_DAYS, watchProgress: 0, sheltered: false };
  pressure.nextIncidentDay = null;
  const option = pressureOptions(state).active;
  return { changed: true, events: [{ type: 'pressure', text: `${option.title}: a coastal cargo demand, due in ${until(state, option.deadline)} at 1×. Give ${text(option.demand)}, or prepare ${option.requiredReadiness} supplied watch readiness. At most ${text(option.maximumLoss)} is at risk. This incident cannot harm residents or buildings; company troops and walls answer physical raids separately.` }] };
}
