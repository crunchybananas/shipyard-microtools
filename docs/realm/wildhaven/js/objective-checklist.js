/** Read-only presentation of the existing objective rules. No progress is awarded here. */
import { BUILDINGS, RESOURCES, getBuildingSpec } from './catalog.js';
import { RESEARCH } from './progression.js';
import { objective } from './sim.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const nonnegative = value => Math.max(0, finite(value));
const ready = building => (!building.status || building.status === 'ready') && !building.paused;
const finished = building => building.status === 'ready' && (building.type !== 'bell' || building.restored);
const ofType = (state, type, predicate = ready) => (state.buildings || []).filter(building => building.type === type && predicate(building));
const count = (state, type, predicate) => ofType(state, type, predicate).length;
function staffed(state, type) {
  return ofType(state, type).filter(building => {
    if (!getBuildingSpec(type, building.level || 1).workers) return true;
    const supplied = Number.isFinite(building.production?.efficiency) ? building.production.efficiency > 0 : !building.production?.blockedReason;
    return (building.workerIds?.length || 0) > 0 && supplied;
  }).length;
}
function row(id, label, current, target, unit, detail) {
  current = nonnegative(current);
  return { id, label, current, target, unit, complete: current >= target, ...(detail ? { detail } : {}) };
}
const condition = (id, label, met, detail) => row(id, label, met ? 1 : 0, 1, 'condition', detail);
function either(id, label, alternatives) {
  return { ...condition(id, label, alternatives.some(option => option.complete)), alternatives };
}
const stock = (state, resource, target) => row(`stock-${resource}`, `Keep ${RESOURCES[resource].name.toLowerCase()} in stock`, state.resources?.[resource], target, RESOURCES[resource].name.toLowerCase());
const working = (state, type) => row(`working-${type}`, `Staff and supply a ${BUILDINGS[type].name.toLowerCase()}`, staffed(state, type), 1, 'buildings', 'At least one assigned worker and enough inputs to do some work.');
const completedBuilding = (state, type, target = 1, predicate = ready) => ({ ...row(`built-${type}`, `Finish ${target === 1 ? 'a ' : ''}${BUILDINGS[type].name.toLowerCase()}${target === 1 ? '' : 's'}`, count(state, type, predicate), target, 'buildings', predicate === ready ? 'Finished, unpaused buildings count. Resume a paused building to include it.' : undefined),
  ...(predicate === ready && (state.buildings || []).some(b => b.type === type && b.status === 'ready' && b.paused) ? { notice: 'Paused buildings do not count. Resume them to include them.' } : {}) });
const research = (state, id) => condition(`research-${id}`, `Learn ${RESEARCH[id].name}`, (state.research?.completed || []).includes(id));
function coverage(state, kind, target, name) {
  const value = nonnegative(state.serviceCoverage?.[kind]);
  return { ...row(`coverage-${kind}`, `${name} reaches housing`, value * 100, target * 100, '%', 'Share of housing beds with supplied service.'), complete: value >= target };
}
function construction(building, id, label) {
  return row(id, label, building.workRequired > 0 ? finite(building.progress) / building.workRequired * 100 : 0, 100, '%', building.paused ? 'Construction is paused. Resume the project to continue.' : 'Reserved materials are already paid. Builders finish the work.');
}

function openingChecklist(state, ambition) {
  const buildings = state.buildings || [];
  switch (ambition.step) {
    case 0: {
      const cottage = buildings.find(building => building.type === 'cottage');
      return cottage && cottage.status !== 'ready' && cottage.workRequired > 0
        ? [construction(cottage, 'first-cottage', 'Finish the first cottage')]
        : [completedBuilding(state, 'cottage', 1, finished)];
    }
    case 1: return [row('built-food', 'Finish an orchard or kitchen garden', count(state, 'orchard', finished) + count(state, 'garden', finished), 1, 'buildings')];
    case 2: return [completedBuilding(state, 'lumber', 1, finished), completedBuilding(state, 'quarry', 1, finished)];
    case 3: return [completedBuilding(state, 'cottage', 3, finished), row('built-food', 'Finish orchards or kitchen gardens', count(state, 'orchard', finished) + count(state, 'garden', finished), 2, 'buildings')];
    case 4: return [row('residents', 'Welcome residents', state.population, 10, 'residents')];
    case 5: {
      const bell = buildings.find(building => building.type === 'bell');
      if (bell && bell.status !== 'ready') return [construction(bell, 'restore-bell', 'Finish restoring the old bell')];
      return [...Object.entries(BUILDINGS.bell.cost).map(([resource, target]) => stock(state, resource, target)),
        condition('restore-bell', 'Restore the old bell', !!bell?.restored, 'When the supplies are ready, select the bell and queue its restoration.')];
    }
    default: return [];
  }
}

/**
 * Returns independent requirements for the current objective, never a mixed-unit sum.
 * OR rows contain alternatives with the same row shape; only one must be complete.
 * Current values stay unrounded. Format them for display without changing `complete`.
 */
export function objectiveChecklist(state, ambition = objective(state)) {
  if (!ambition || ambition.complete) return [];
  if (!state.won) return openingChecklist(state, ambition);
  const residents = Array.isArray(state.citizens) ? state.citizens.length : nonnegative(state.population);
  const people = target => row('residents', 'Welcome residents', residents, target, 'residents');
  const ledger = state.imports || {}, sold = ledger.exported || {};
  switch (ambition.step) {
    case 0: return [completedBuilding(state, 'cottage')];
    case 1: return [row('working-food', 'Staff an orchard or kitchen garden', staffed(state, 'orchard') + staffed(state, 'garden'), 1, 'buildings', 'Assigned workers must be able to produce food.')];
    case 2: return [working(state, 'lumber'), working(state, 'quarry')];
    case 3: return [completedBuilding(state, 'cottage', 3), row('built-food', 'Finish orchards or kitchen gardens', count(state, 'orchard') + count(state, 'garden'), 2, 'buildings', 'Finished, unpaused buildings count.'), people(10)];
    case 4: return [condition('restore-bell', 'Restore the old bell', (state.buildings || []).some(building => building.type === 'bell' && building.restored && ready(building)))];
    case 5: return [people(20), stock(state, 'food', 40), working(state, 'school'), completedBuilding(state, 'well'), row('research-count', 'Complete research discoveries', state.research?.completed?.length, 3, 'discoveries', 'Any three completed discoveries count.')];
    case 6: return [people(40), stock(state, 'tools', 12), stock(state, 'cloth', 12), working(state, 'market'), working(state, 'clinic'), coverage(state, 'water', .5, 'Water'), coverage(state, 'health', .4, 'Healthcare')];
    case 7: return [row('delivery-orders', 'Complete delivery orders', state.contracts?.completed, 6, 'orders'),
      either('coastal-trade', 'Complete voyages or harbor-counter exports', [row('voyages', 'Voyages', state.routes?.completed, 3, 'voyages'), row('exports', 'Harbor-counter exports', ledger.exportsCompleted, 12, 'shipments')]),
      stock(state, 'gold', 200), completedBuilding(state, 'manor'), condition('town-path', 'Choose a town path', !!state.policies?.charter)];
    case 8: return [people(75), stock(state, 'food', 150), condition('sustainable-food', 'Food production covers meals', finite(state.foodPotentialBalance, finite(state.foodBalance, -1)) >= 0, 'Staffed, supplied workplaces cover food needs even when a full pantry slows production.'),
      coverage(state, 'water', .6, 'Water'), coverage(state, 'health', .6, 'Healthcare'), coverage(state, 'community', .5, 'Community care'),
      row('coastal-incidents', 'Resolve coastal incidents', (state.pressure?.defended || 0) + (state.pressure?.paid || 0), 3, 'incidents', 'Paying supplies or completing a prepared defense counts. Sheltering cargo alone does not.')];
    case 9: {
      if (state.policies?.charter === 'breadbasket') return [row('export-food', 'Export food', sold.food, 800, 'food'),
        either('export-harvest', 'Export grain or ale', [row('export-grain', 'Grain', sold.grain, 240, 'grain'), row('export-ale', 'Ale', sold.ale, 80, 'ale')]),
        stock(state, 'food', 300), stock(state, 'gold', 600), research(state, 'cultivation'), research(state, 'milling')];
      if (state.policies?.charter === 'forge') return [row('export-iron', 'Export iron', sold.iron, 120, 'iron'), row('export-tools', 'Export tools', sold.tools, 90, 'tools'),
        row('improved-industry', 'Improve industry workshops', (state.buildings || []).filter(building => ready(building) && BUILDINGS[building.type]?.category === 'industry' && building.level >= 2).length, 3, 'buildings', 'Finished, open industry workshops at level 2 or higher.'),
        row('prepared-defenses', 'Repel coastal incidents with the watch', state.pressure?.defended, 3, 'defenses', 'Completed prepared defenses count; payments do not.'), stock(state, 'gold', 600), research(state, 'joinery'), research(state, 'metallurgy'), research(state, 'mastercraft')];
      if (state.policies?.charter === 'freeport') return [row('voyages', 'Complete voyages', state.routes?.completed, 12, 'voyages'), row('imported-shipments', 'Receive imported shipments', ledger.completed, 20, 'shipments'),
        row('trusted-harbors', 'Earn trust with distinct harbors', Object.values(state.routes?.reputation || {}).filter(trust => trust >= 4).length, 2, 'harbors', 'Each harbor needs at least 4 trust.'), stock(state, 'gold', 1000), research(state, 'barter'), research(state, 'logistics'), research(state, 'coastal_routes')];
      return [condition('town-path', 'Choose a town path', !!state.policies?.charter)];
    }
    default: return [];
  }
}

/** One short reason and a real existing destination; this never performs an action. */
export function objectiveGuidance(state, ambition = objective(state)) {
  if (!ambition || ambition.complete) return null;
  const foodChain = ['Grain farm', 'Windmill', 'Bakery', 'Food'];
  const toolsChain = ['Iron mine', 'Smithy', 'Toolmaker', 'Tools'];
  const clothChain = ['Flax field', 'Weaver', 'Cloth'];
  const buildingAction = (type, label) => {
    const building = (state.buildings || []).find(item => item.type === type);
    return building ? { label: label || `View ${BUILDINGS[type].name.toLowerCase()}`, buildingId: building.id } : { label: `Plan ${BUILDINGS[type].name.toLowerCase()}`, type };
  };
  if (!state.won) {
    switch (ambition.step) {
      case 0: return { title: 'A roof makes room', why: 'New homes provide beds for the neighbors who will work in your village.', ...buildingAction('cottage') };
      case 1: return { title: 'Give the village a food supply', why: 'Workers harvest food to feed residents and make new arrivals possible.', ...buildingAction((state.buildings || []).find(building => ['orchard', 'garden'].includes(building.type))?.type || 'orchard') };
      case 2: return { title: 'Keep building materials coming', why: 'Woodcutters and stoneworkers replace the supplies used by new buildings.', ...buildingAction(ambition.type || 'lumber') };
      case 3: return { title: 'Prepare for more neighbors', why: 'Spare beds and food make space for a larger workforce.', label: `Plan another ${BUILDINGS[ambition.type || 'cottage'].name.toLowerCase()}`, type: ambition.type || 'cottage' };
      case 4: return { title: 'Help new neighbors settle', why: 'Arrivals need spare beds, enough food, and a welcoming village.', label: 'Review arrivals and needs', tab: 'stores' };
      case 5: return { title: 'Bring the old bell back', why: 'The first ringing leads into research, better services, and coastal trade.', ...buildingAction('bell', 'View the old bell') };
      default: return null;
    }
  }
  switch (ambition.step) {
    case 0: return { title: 'Make room for neighbors', why: 'A finished cottage provides beds; a building site does not.', ...buildingAction('cottage') };
    case 1: return { title: 'Put hands to the harvest', why: 'Completed food workplaces need assigned workers to fill the pantry.', label: 'Review people and jobs', tab: 'workforce' };
    case 2: return { title: 'Staff the material workplaces', why: 'Builders and workshops share a limited workforce. Requested jobs still need available people.', label: 'Review people and jobs', tab: 'workforce' };
    case 3: return { title: 'Give the village room to grow', why: 'New neighbors need finished homes and a reliable food supply.', label: 'Review arrivals and needs', tab: 'stores' };
    case 4: return { title: 'Restore the old bell', why: 'Its first ringing marks the start of the village’s next chapter.', ...buildingAction('bell', 'View the old bell') };
    case 5: {
      const school = { title: 'Let scholars open new crafts', why: 'Supplied scholars earn knowledge and advance the research you choose.', chain: foodChain };
      if (!staffed(state, 'school')) return { ...school, ...buildingAction('school') };
      if ((state.research?.completed?.length || 0) < 3) return { ...school, label: 'Review research', tab: 'council' };
      if (!count(state, 'well')) return { title: 'Bring water to the homes', why: 'An open well supplies nearby beds and supports growth beyond twenty residents.', ...buildingAction('well') };
      if (finite(state.resources?.food) < 40) return { title: 'Leave meals in the pantry', why: 'A food reserve feeds residents and gives new arrivals a dependable supper.', label: 'Review food stores', resource: 'food', tab: 'stores' };
      return { title: 'Welcome the next neighbors', why: 'New arrivals need spare beds, enough food, and a welcoming village.', label: 'Review arrivals and needs', tab: 'stores' };
    }
    case 6: {
      if (finite(state.resources?.tools) < 12) return { title: 'Keep tools ready for town work', why: 'Tools support building work and research. Made or imported tools enter stores automatically.', label: 'Find tools', resource: 'tools', tab: 'stores', chain: toolsChain };
      if (finite(state.resources?.cloth) < 12) return { title: 'Keep cloth ready for town care', why: 'Cloth supplies bedding and clinics. Made or imported cloth enters stores automatically.', label: 'Review cloth stores', resource: 'cloth', tab: 'stores', chain: clothChain };
      for (const type of ['market', 'clinic']) if (!staffed(state, type)) return { title: type === 'clinic' ? 'Keep the clinic working' : 'Open the market to trade', why: type === 'clinic' ? 'Assigned medics need food and cloth to provide healthcare.' : 'Assigned traders need food to keep imports and exports available.', ...buildingAction(type) };
      return { title: 'Bring care within reach', why: 'Growing neighborhoods need water and healthcare with enough supplied capacity.', label: 'Review stores and housing needs', tab: 'stores' };
    }
    case 7: {
      const rows = objectiveChecklist(state, ambition);
      if (rows.filter(item => ['delivery-orders', 'coastal-trade', 'stock-gold'].includes(item.id)).some(item => !item.complete)) return { title: 'Trade for what your village needs', why: 'Orders and exports earn coin, so you can buy goods instead of making every supply locally.', label: 'Review coastal trade', tab: 'trade' };
      if (!count(state, 'manor')) return { title: 'Give the town a civic home', why: 'A finished town hall adds beds and a place for stewards to keep shared records.', ...buildingAction('manor') };
      return { title: 'Choose the town’s future', why: 'Food, trading, and craft paths reward different ways of growing the town.', label: 'Review town paths', tab: 'council' };
    }
    case 8: return { title: 'Support the whole town', why: 'Food, service capacity, and a prepared coast let a large community thrive.', label: 'Review stores and housing needs', tab: 'stores', ...(finite(state.foodPotentialBalance, finite(state.foodBalance, -1)) < 0 ? { chain: foodChain } : {}) };
    case 9: {
      if (!state.policies?.charter) return { title: 'Choose the town’s future', why: 'Food, trading, and craft paths reward different ways of growing the town.', label: 'Review town paths', tab: 'council' };
      const rows = objectiveChecklist(state, ambition);
      const hint = { title: 'Build on your chosen specialty', why: 'Your chosen path sets the ambition. Focus on the crafts and trading it needs.', ...(state.policies.charter === 'breadbasket' ? { chain: foodChain } : state.policies.charter === 'forge' ? { chain: toolsChain } : {}) };
      if (rows.some(item => item.id.startsWith('research-') && !item.complete)) return { ...hint, label: 'Review research', tab: 'council' };
      if (rows.some(item => item.id === 'prepared-defenses' && !item.complete)) return { ...hint, label: 'Review the coast watch', tab: 'watch' };
      if (rows.some(item => item.id === 'improved-industry' && !item.complete)) return { ...hint, label: 'Review industry workplaces', tab: 'workforce' };
      return { ...hint, label: 'Review coastal trade', tab: 'trade' };
    }
    default: return null;
  }
}
