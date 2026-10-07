import { BUILDINGS, RESOURCES } from './catalog.js';
import { RESEARCH } from './progression.js';

export const BREAD_RESEARCH = Object.freeze(['joinery', 'cultivation', 'milling']);
const stock = value => Math.floor(Math.max(0, value) * 10) / 10;
const quantity = value => Math.ceil(Math.max(0, value) * 10) / 10;

/** One optional goal, derived from the real town. Reading this never advances work. */
export function firstBreadStep(state, { paused = false, daily = {} } = {}) {
  if (!state.won || state.guidance?.goal !== 'first_bread') return null;
  const base = { count: 'Food town · first bread' };
  const step = value => ({ ...base, ...value, count: value.count && !value.finishGoal ? `First bread · ${value.count}` : value.count || base.count });
  const wait = value => step(paused ? { ...value, description: `${value.description} Time is paused.`, label: 'Resume time', resume: true } : value);
  if (state.guidance.firstBread) return step({ title: 'Your bakery made its first bread', description: `On day ${state.guidance.firstBread.day}, your bakers put food into town stores. Grain → flour → bread now has a real payoff. The Food town charter is a later choice.`, label: 'Return to town goals', finishGoal: true, count: 'First bread made', progress: 1 });

  const find = type => {
    const matches = state.buildings.filter(b => b.type === type);
    return matches.find(b => b.status === 'ready' && !b.paused && b.production?.efficiency > 0)
      || matches.find(b => b.status === 'ready' && !b.paused) || matches.find(b => b.status === 'ready') || matches[0];
  };
  function supply(key, amount, purpose) {
    const missing = quantity(amount - (state.resources[key] || 0)), name = RESOURCES[key].name.toLowerCase();
    const rate = daily[key] || 0;
    if (rate > 0) return wait({ title: `${RESOURCES[key].name} for ${purpose}`, description: `${missing} more ${name} needed. Your town adds ${quantity(rate)} per day; keep the supply running.`, label: 'View town stores', resource: key, count: `${stock(state.resources[key])} / ${amount} ${name}`, progress: state.resources[key] / amount });
    const producerType = { wood: 'lumber', stone: 'quarry', planks: 'sawmill', grain: 'farm', flour: 'windmill', knowledge: 'school' }[key];
    const producer = producerType && find(producerType);
    return step({ title: `Supply ${name} for ${purpose}`, description: `${missing} more ${name} needed. ${key === 'gold' ? 'Complete a coastal order to earn coin.' : 'Production is not building a surplus. Check workers and inputs; resting a competing workplace can free people and supplies.'}`, label: key === 'gold' ? 'View coastal orders' : producer ? `Check ${BUILDINGS[producerType].name.toLowerCase()}` : 'Review people & supplies', ...(key === 'gold' ? { tab: 'trade' } : producer ? { buildingId: producer.id } : { tab: 'workforce' }), count: `${stock(state.resources[key])} / ${amount} ${name}` });
  }
  function workplace(type, purpose) {
    const name = BUILDINGS[type].name, b = find(type);
    if (!b) {
      const missing = Object.entries(BUILDINGS[type].cost).find(([key, value]) => state.resources[key] + 0.000001 < value);
      if (missing) return supply(missing[0], missing[1], name.toLowerCase());
      return step({ title: `Build a ${name.toLowerCase()}`, description: purpose, label: `Plan ${name.toLowerCase()}`, type, count: Object.entries(BUILDINGS[type].cost).map(([key, n]) => `${n} ${RESOURCES[key].name.toLowerCase()}`).join(' · ') });
    }
    if (b.status !== 'ready') {
      const description = b.paused ? 'This project is paused. Resume it in Projects.' : !state.builderTarget ? 'No builders are requested. Assign a construction crew in People.' : 'The crew shares your residents with other jobs. Projects shows its queue position and progress.';
      const value = { title: `Finish the ${name.toLowerCase()}`, description, label: !state.builderTarget ? 'Assign builders' : 'View projects', tab: !state.builderTarget ? 'workforce' : 'construction', progress: b.progress / b.workRequired };
      return b.paused || !state.builderTarget ? step(value) : wait(value);
    }
    if (b.paused) return step({ title: `Reopen the ${name.toLowerCase()}`, description: 'This workplace is resting. Resume its work to continue your bread chain.', label: 'View workplace', buildingId: b.id });
    if (!b.workerIds?.length) return step({ title: `Give the ${name.toLowerCase()} its workers`, description: b.desiredWorkers ? 'Workers are requested, but everyone is busy. In People, rest another workplace or raise this one’s priority. Nothing is reassigned automatically.' : 'No workers are requested. Assign people in the workplace controls.', label: b.desiredWorkers ? 'Find available workers' : 'Assign workers', ...(b.desiredWorkers ? { workforceId: b.id } : { buildingId: b.id }) });
    if (!(b.production?.efficiency > 0)) {
      const reason = b.production?.blockedReason || 'Waiting for supplies';
      if (reason === 'Storage full') return step({ title: `Make room for the ${name.toLowerCase()}`, description: 'Its output store is full. Let the next workshop use the stock, sell a surplus, or expand storage.', label: 'View town stores', tab: 'stores' });
      const key = reason.startsWith('Needs ') ? reason.slice(6) : null;
      const value = { title: `Supply the ${name.toLowerCase()}`, description: `${reason}. ${purpose}`, label: 'Check inputs & workers', buildingId: b.id };
      // Resuming time only helps when the missing input is actually accumulating.
      if (key && daily[key] > 0) return wait(value);
      const supplier = find({ flour: 'windmill', grain: 'farm', wood: 'lumber' }[key]);
      return step(supplier ? { ...value, label: `Check ${BUILDINGS[supplier.type].name.toLowerCase()}`, buildingId: supplier.id } : key === 'food' ? { ...value, label: 'Review food workers', tab: 'workforce', buildingId: undefined } : value);
    }
    return null;
  }
  function research(id) {
    const actual = state.research.active?.id || id, spec = RESEARCH[actual];
    const school = workplace('school', 'Scholars need food and available residents. They earn knowledge and advance the one project you choose.');
    if (school) return school;
    if (state.research.active) return wait({ title: `Learning ${spec.name.toLowerCase()}`, description: `${actual === id ? 'This discovery moves your bread chain forward.' : 'Finish your current project first; your bread goal is remembered.'} Supplied scholars advance it.`, label: 'View current research', researchId: actual, progress: state.research.active.progress / spec.duration, count: `${Math.floor(state.research.active.progress / spec.duration * 100)}% learned` });
    const missing = Object.entries(spec.cost).find(([key, value]) => state.resources[key] + 0.00001 < value);
    if (missing) return supply(missing[0], missing[1], spec.name.toLowerCase());
    return step({ title: `Learn ${spec.name.toLowerCase()}`, description: `${spec.description} Open the quote to choose whether to pay and begin.`, label: `View ${spec.name}`, researchId: id });
  }
  const learned = id => state.research.completed.includes(id);
  if (!learned('joinery')) return research('joinery');
  // Make building materials while scholars work on the food discoveries.
  if (state.resources.planks < 14 && !find('windmill') && !find('bakery')) {
    const mill = workplace('sawmill', 'Timber becomes planks for your windmill and bakery. Keep the woodcutters supplied with workers.');
    if (mill) return mill;
  }
  if (!learned('cultivation')) return research('cultivation');
  const farm = workplace('farm', 'Grain feeds a windmill, not residents directly. Keep your orchard or garden working until bread is ready.');
  if (farm && !(find('farm')?.production?.blockedReason === 'Storage full')) return farm;
  if (!learned('milling')) return research('milling');
  const mill = workplace('windmill', 'Your grain farm supplies the mill. Flour then feeds the bakery.');
  if (mill && !(find('windmill')?.production?.blockedReason === 'Storage full')) return mill;
  const bakery = workplace('bakery', 'Bakers use flour from the windmill and timber for their ovens. Bread enters the food store automatically.');
  if (bakery) return bakery;
  return wait({ title: 'Let the first bread reach town stores', description: 'Your bakery has workers and supplies. Let time run until it adds food; this goal checks actual production.', label: 'Watch your bakery', buildingId: find('bakery').id });
}
