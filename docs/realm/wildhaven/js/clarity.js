/** Presentation facts derived from the economy. Never changes town state. */
import { BUILDINGS, JOBS, RESOURCES, getBuildingSpec } from './catalog.js';
import { RESEARCH } from './progression.js';

const PURPOSE = Object.freeze({
  hearth: ['First supplies', 'Reserve gatherers bring food, timber and stone.'],
  cottage: ['Room to grow', 'Spare beds welcome arrivals when food and town needs are met.'],
  orchard: ['Daily meals', 'Picked fruit goes straight into the town pantry.'],
  garden: ['Daily meals', 'Vegetables feed residents; nearby homes improve the harvest.'],
  lumber: ['Build · sawmill', 'Timber builds homes, feeds sawmills and fuels ovens and smithies.'],
  quarry: ['Build · upgrade', 'Stone pays for foundations, the bell and better buildings.'],
  farm: ['Mill · brewhouse', 'Send grain to a windmill for flour or a brewhouse for ale.'],
  windmill: ['Feeds a bakery', 'Flour feeds a bakery. The bakery turns flour and timber into food.'],
  bakery: ['Feeds the town', 'Bread goes into the food stockpile that feeds every resident.'],
  sawmill: ['Build · upgrade', 'Planks build mills and workshops, and improve homes.'],
  mine: ['Feeds a smithy', 'Ore needs a smithy and timber fuel before it becomes iron.'],
  smith: ['Tools · upgrades', 'Iron supplies the toolmaker, building work and coastal cargo.'],
  toolmaker: ['Upgrade · research', 'Tools pay for advanced buildings, research and upgrades.'],
  flaxfield: ['Feeds a weaver', 'A weaver turns this fiber into cloth.'],
  weaver: ['Homes · clinics', 'Cloth supplies better homes, clinics and trade orders.'],
  brewery: ['Gatherings · trade', 'Supplied brewhouses serve community needs; surplus ale can be sold.'],
  market: ['Buy · sell cargo', 'Staff and supply the market to buy goods, sell surpluses and send voyages.'],
  school: ['Unlock new crafts', 'Scholars earn knowledge and advance your selected research project.'],
  well: ['Water for homes', 'Nearby homes need water access for the town to grow beyond twenty.'],
  clinic: ['Health for homes', 'Supplied healers provide health access needed for growth beyond forty.'],
  chapel: ['Community', 'Served homes gain community access needed for growth beyond sixty.'],
  barracks: ['Coast · escorts', 'Supplied guards prepare coastal patrols and provide voyage readiness.'],
  warehouse: ['Room for cargo', 'Raises every physical stockpile’s limit and reduces coastal cargo exposure.'],
  bell: ['First milestone', 'Restore the bell after three cottages, two orchards or gardens and ten residents.'],
  manor: ['Beds · knowledge', 'A civic home adds beds and earns knowledge from coin.'],
});
const SERVICE_NAMES = { water: 'Water', health: 'Health', faith: 'Community', leisure: 'Community', security: 'Watch', civic: 'Civic service' };
const quantities = bag => Object.entries(bag || {}).filter(([, n]) => n > 0).map(([id, amount]) => ({ id, amount, name: RESOURCES[id].name, icon: RESOURCES[id].icon }));
export function buildingFacts(type, level = 1) {
  const spec = getBuildingSpec(type, level);
  if (!spec) return null;
  const input = quantities(spec.recipe.input), output = quantities(spec.recipe.output);
  const service = spec.service && { ...spec.service, name: SERVICE_NAMES[spec.service.kind], capacity: Math.round(spec.service.capacity * (spec.service.strength || 1)) };
  const result = output.length ? output.map(r => r.name).join(' + ') : spec.housing ? `${spec.housing} beds` : spec.storage ? `+${spec.storage} storage` : service ? `${service.name} · ${service.capacity} beds` : 'Restore the bell';
  return {
    input, output, service, housing: spec.housing, storage: spec.storage || 0,
    jobs: spec.workers, job: spec.workers ? (spec.workers === 1 ? JOBS[spec.job].name : JOBS[spec.job].plural).toLowerCase() : '',
    staffing: spec.workers ? `${spec.workers} ${(spec.workers === 1 ? JOBS[spec.job].name : JOBS[spec.job].plural).toLowerCase()}` : 'No permanent staff',
    shortFlow: `${input.length ? `${input.map(r => r.name).join(' + ')} → ` : ''}${result}`,
    next: PURPOSE[type][0], payoff: PURPOSE[type][1],
  };
}

export function researchRequirements(state, research) {
  return research.prerequisites.map(id => ({ id, name: RESEARCH[id].name, met: state.research.completed.includes(id) }));
}

/** Each suggestion is one real next action; the larger ambition remains a detail. */
export function nextTownStep(state, ambition, needs) {
  if (!state.won) return null;
  if (ambition.step === 6 && state.resources.tools < 12) return { title: 'Have twelve tools in stock', description: 'Made or imported tools enter town stores automatically. A toolmaker produces them; a supplied market can import them.', label: 'Find tools', tab: 'stores', resource: 'tools', count: `${Math.floor(state.resources.tools)} / 12 tools in stock`, progress: state.resources.tools / 12 };
  if (ambition.step !== 5) return null;
  const schools = state.buildings.filter(b => b.type === 'school');
  const school = schools.find(b => b.status === 'ready');
  if (!school) return schools.length
    ? { title: 'Finish the schoolhouse', description: 'Your builders are opening a place to earn knowledge and study new crafts.', label: 'View the project', tab: 'construction', count: 'School construction in progress' }
    : { title: 'Open a schoolhouse', description: 'Two scholars turn 2 food into 7 knowledge each day and study new crafts.', label: 'Build a schoolhouse', type: 'school', count: 'Build: 18 timber · 12 stone' };
  const productiveSchool = schools.some(b => b.status === 'ready' && !b.paused && b.production?.efficiency > 0);
  if (!productiveSchool) return { title: 'Give the school its scholars', description: school.production?.blockedReason || 'Assign residents and keep food supplied to earn knowledge and move research forward.', label: 'Staff the schoolhouse', buildingId: school.id, count: `${school.workerIds?.length || 0} scholars assigned · ${Math.round(getBuildingSpec('school', school.level).recipe.input.food * 10) / 10} food/day at full staffing` };
  if (state.research.completed.length < 3) {
    if (state.research.active) {
      const research = RESEARCH[state.research.active.id];
      return { title: `Learning ${research.name.toLowerCase()}`, description: research.unlocks.length ? `Next: ${research.unlocks.map(id => BUILDINGS[id].name.toLowerCase()).join(' + ')}.` : research.description, label: 'View the research', tab: 'council', count: `${Math.floor(state.research.active.progress / research.duration * 100)}% researched`, progress: state.research.active.progress / research.duration };
    }
    return { title: 'Choose the next craft', description: 'Timber framing opens planks; Fieldcraft opens grain; Fair measures opens market trade.', label: 'Choose research', tab: 'council', count: `${state.research.completed.length} of 3 fields learned` };
  }
  const well = state.buildings.find(b => b.type === 'well' && b.status === 'ready' && !b.paused) || state.buildings.find(b => b.type === 'well');
  if (!well || well.status !== 'ready') return { title: well ? 'Finish the village well' : 'Bring water to the homes', description: 'Water access supports arrivals as your town grows beyond twenty residents.', label: well ? 'View the project' : 'Place a well', ...(well ? { tab: 'construction' } : { type: 'well' }), count: well ? 'Well construction in progress' : 'Build: 8 timber · 16 stone' };
  if (well.paused) return { title: 'Open the village well', description: 'This well is resting. Resume it to supply nearby homes.', label: 'View the well', buildingId: well.id, count: 'Water service paused' };
  if (state.resources.food < 40) return { title: 'Keep forty food in reserve', description: 'Give food workplaces enough hands, or use the landing’s coastal orders to fund supplies.', label: 'Review food and jobs', tab: 'workforce', count: `${Math.floor(state.resources.food)} / 40 food reserved`, progress: state.resources.food / 40 };
  return { title: 'Welcome twenty neighbors', description: needs.migration.reason, label: needs.housing.have <= state.population ? 'Build a cottage' : 'Review town needs', ...(needs.housing.have <= state.population ? { type: 'cottage' } : { tab: 'stores' }), count: `${state.population} / 20 residents`, progress: state.population / 20 };
}

export function rankContracts(contracts, resources) {
  const score = c => c.status === 'active' && c.canComplete ? 0 : c.status === 'active' ? 1 : c.canAccept && Object.entries(c.requirements).every(([key, n]) => resources[key] >= n) ? 2 : 3;
  return [...contracts].sort((a, b) => score(a) - score(b));
}
