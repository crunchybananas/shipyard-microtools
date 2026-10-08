/** Shared economy data. No renderer, DOM, or simulation imports. */
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const RESOURCES = freeze({
  wood: { name: 'Timber', short: 'Wood', icon: '▰', color: '#a37950', physical: true },
  stone: { name: 'Stone', short: 'Stone', icon: '◆', color: '#8d9b93', physical: true },
  food: { name: 'Food', short: 'Food', icon: '●', color: '#bd9752', physical: true },
  grain: { name: 'Grain', short: 'Grain', icon: '♧', color: '#d1b365', physical: true },
  flour: { name: 'Flour', short: 'Flour', icon: '◒', color: '#e8ddba', physical: true },
  planks: { name: 'Planks', short: 'Planks', icon: '▤', color: '#9e7150', physical: true },
  ore: { name: 'Iron ore', short: 'Ore', icon: '⬟', color: '#805c49', physical: true },
  iron: { name: 'Iron', short: 'Iron', icon: '▬', color: '#647978', physical: true },
  tools: { name: 'Tools', short: 'Tools', icon: '⚒', color: '#526b70', physical: true },
  flax: { name: 'Flax', short: 'Flax', icon: '❋', color: '#8aa69a', physical: true },
  cloth: { name: 'Cloth', short: 'Cloth', icon: '▧', color: '#bb8e79', physical: true },
  ale: { name: 'Ale', short: 'Ale', icon: '◓', color: '#b77743', physical: true },
  gold: { name: 'Coin', short: 'Coin', icon: '◈', color: '#d1aa55', physical: false },
  knowledge: { name: 'Knowledge', short: 'Lore', icon: '✦', color: '#698593', physical: false },
});
export const RESOURCE_NAMES = Object.freeze(Object.keys(RESOURCES));

export const JOBS = freeze({
  spearman: { name: 'Spearman', plural: 'Spearmen', color: '#557e91' },
  archer: { name: 'Archer', plural: 'Archers', color: '#7b9661' },
  engineer: { name: 'Frontier builder', plural: 'Frontier builders', color: '#bd9858' },
  explorer: { name: 'Surveyor', plural: 'Surveyors', color: '#598d87' },
  restorer: { name: 'Restorer', plural: 'Restorers', color: '#ba8b56' },
  envoy: { name: 'Envoy', plural: 'Envoys', color: '#b58d6b' },
  builder: { name: 'Builder', plural: 'Builders', color: '#bd9858' },
  forager: { name: 'Forager', plural: 'Foragers', color: '#8a9e58' },
  farmer: { name: 'Farmer', plural: 'Farmers', color: '#8aa35c' },
  lumberjack: { name: 'Woodcutter', plural: 'Woodcutters', color: '#9b784d' },
  quarryworker: { name: 'Stoneworker', plural: 'Stoneworkers', color: '#89988e' },
  miller: { name: 'Miller', plural: 'Millers', color: '#d2bd7c' },
  baker: { name: 'Baker', plural: 'Bakers', color: '#d5b58a' },
  carpenter: { name: 'Carpenter', plural: 'Carpenters', color: '#b6855a' },
  miner: { name: 'Miner', plural: 'Miners', color: '#816c61' },
  smith: { name: 'Smith', plural: 'Smiths', color: '#647982' },
  weaver: { name: 'Weaver', plural: 'Weavers', color: '#af8190' },
  brewer: { name: 'Brewer', plural: 'Brewers', color: '#a97b47' },
  trader: { name: 'Trader', plural: 'Traders', color: '#b0a265' },
  scholar: { name: 'Scholar', plural: 'Scholars', color: '#678c9e' },
  medic: { name: 'Healer', plural: 'Healers', color: '#8bb6a2' },
  chaplain: { name: 'Keeper', plural: 'Keepers', color: '#a68d9b' },
  guard: { name: 'Guard', plural: 'Guards', color: '#aa7259' },
  steward: { name: 'Steward', plural: 'Stewards', color: '#6a8399' },
});

const cost = values => Object.fromEntries(RESOURCE_NAMES.map(resource => [resource, values[resource] || 0]));
const recipe = (input = {}, output = {}, perDay = 1) => ({ input, output, perDay });
const upgrades = (second, third) => [
  { level: 2, work: 65, productionMultiplier: 1.5, ...second, cost: cost(second.cost || {}) },
  { level: 3, work: 110, productionMultiplier: 2.2, requires: 'mastercraft', ...third, cost: cost(third.cost || {}) },
];
const productionUpgrades = (workers = 2) => upgrades(
  { cost: { planks: 12, stone: 10, tools: 2 }, workers, productionMultiplier: workers === 1 ? 1.4 : 1.6 },
  { cost: { planks: 24, iron: 8, tools: 6, gold: 20 }, workers: workers === 1 ? 1 : workers + 1, productionMultiplier: workers === 1 ? 2 : 2.7 },
);
const serviceUpgrades = (kind, second, third) => {
  const result = productionUpgrades();
  return result.map((upgrade, index) => {
    const value = index ? third : second;
    return { ...upgrade, workers: value.workers, productionMultiplier: value.upkeep, service: { kind, radius: value.radius, capacity: value.capacity, strength: 1 } };
  });
};
const service = (kind, radius, capacity) => ({ kind, radius, capacity, strength: 1 });
const define = spec => ({
  category: 'civic', cost: cost({}), work: 40, workers: 0, job: null,
  recipe: recipe(), housing: 0, model: 'cottage', unlock: null,
  shortcut: '', production: '', upgrades: [], ...spec, cost: cost(spec.cost || {}),
});

export const BUILDINGS = freeze(Object.fromEntries(Object.entries({
  hearth: {
    name: 'Founders’ hearth', category: 'civic', model: 'hearth', work: 0,
    workers: 2, job: 'forager', housing: 6, recipe: recipe({}, { wood: 4, stone: 3, food: 10 }),
    description: 'Two foragers keep the first six islanders fed and bring home usable timber and stone. Its work is real, and the hearth is always a place to recover.',
    production: '2 foragers · 4 timber, 3 stone, 10 food / day',
  },
  cottage: {
    name: 'Cottage', category: 'housing', model: 'cottage', cost: { wood: 16, stone: 8 }, work: 36, housing: 4, shortcut: '1',
    description: 'Beds, a little hearth, and a reason to stay. A garden or well nearby makes a better neighborhood.', production: '4 beds',
    upgrades: upgrades({ cost: { planks: 12, stone: 8, cloth: 2 }, work: 50, housing: 7 }, { cost: { planks: 20, stone: 20, tools: 4, cloth: 5 }, work: 80, housing: 10 }),
  },
  orchard: {
    name: 'Orchard', category: 'food', model: 'orchard', cost: { wood: 12, stone: 3 }, work: 28, workers: 2, job: 'farmer', shortcut: '2', recipe: recipe({}, { food: 14 }),
    description: 'A reliable harvest with no seed cost. Garden neighbors improve the yield; workers still have to pick the fruit.', production: '2 farmers · 14 food / day', upgrades: productionUpgrades(2),
  },
  lumber: {
    name: 'Woodcutter', category: 'materials', model: 'lumber', cost: { wood: 14, stone: 5 }, work: 32, workers: 2, job: 'lumberjack', shortcut: '3', recipe: recipe({}, { wood: 10 }),
    description: 'Harvests a shared grove of 12 nearby trees and automatically replants every stump. Saplings mature in 3 in-game days (18 minutes at 1×). Nearby forest improves the timber harvest.', production: '2 woodcutters · 10 timber / day before siting bonus', upgrades: productionUpgrades(2),
  },
  quarry: {
    name: 'Stoneworks', category: 'materials', model: 'quarry', cost: { wood: 12, stone: 8 }, work: 38, workers: 2, job: 'quarryworker', shortcut: '4', recipe: recipe({}, { stone: 8 }),
    description: 'Cuts foundations from island stone. A rocky outcrop nearby saves a great deal of walking.', production: '2 stoneworkers · 8 stone / day before siting bonus', upgrades: productionUpgrades(2),
  },
  garden: {
    name: 'Kitchen garden', category: 'food', model: 'garden', cost: { wood: 6, stone: 3 }, work: 20, workers: 1, job: 'farmer', shortcut: '5', recipe: recipe({}, { food: 7 }),
    description: 'The founders brought seeds. An inexpensive food source that can rescue an empty pantry. Nearby homes lend a hand.', production: '1 gardener · 7 food / day before neighbors', upgrades: productionUpgrades(1),
  },
  windmill: {
    name: 'Windmill', category: 'food', model: 'windmill', cost: { wood: 22, stone: 18, planks: 6 }, work: 65, workers: 2, job: 'miller', unlock: 'milling', shortcut: '6', recipe: recipe({ grain: 24 }, { flour: 18 }),
    description: 'Turns one grain farm’s harvest into flour for a bakery. The blades may turn in the breeze, but only staffed mills fill the flour sacks.', production: '24 grain → 18 flour / day', upgrades: productionUpgrades(2),
  },
  bell: {
    name: 'Bell tower', category: 'civic', model: 'bell', cost: { wood: 50, stone: 60, food: 20 }, work: 90, shortcut: '7',
    description: 'Restore the old bell when ten islanders have homes and a dependable supper. Its ringing is the first chapter of the town, with much still to build.', production: 'A landmark and the first village ambition',
  },
  farm: {
    name: 'Grain farm', category: 'food', model: 'farm', cost: { wood: 18, stone: 6 }, work: 45, workers: 3, job: 'farmer', unlock: 'cultivation', recipe: recipe({}, { grain: 24 }),
    description: 'Grows grain for bread and ale. Grain is a workshop input, not a ready supper; keep an orchard or garden until your bakery works.', production: '3 farmers · 24 grain / day', upgrades: productionUpgrades(3),
  },
  bakery: {
    name: 'Bakery', category: 'food', model: 'bakery', cost: { wood: 12, stone: 20, planks: 8 }, work: 60, workers: 2, job: 'baker', unlock: 'milling', recipe: recipe({ flour: 18, wood: 4 }, { food: 84 }),
    description: 'A complete farm, mill, and bakery makes eighty-four meals with seven workers and four timber for fuel. The payoff is strong; an interrupted grain or flour supply stops the ovens.', production: '18 flour + 4 timber → 84 food / day', upgrades: productionUpgrades(2),
  },
  sawmill: {
    name: 'Sawmill', category: 'industry', model: 'sawmill', cost: { wood: 24, stone: 12 }, work: 55, workers: 2, job: 'carpenter', unlock: 'joinery', recipe: recipe({ wood: 12 }, { planks: 8 }),
    description: 'Seasoned boards open the way to better homes and larger workshops. Keep timber flowing from a staffed woodcutter.', production: '12 timber → 8 planks / day', upgrades: productionUpgrades(2),
  },
  mine: {
    name: 'Iron mine', category: 'materials', model: 'mine', cost: { wood: 20, stone: 18, planks: 10 }, work: 75, workers: 3, job: 'miner', unlock: 'metallurgy', recipe: recipe({}, { ore: 12 }),
    description: 'Extracts iron ore for the smith. Close rocky ground improves the working day; the ore still needs fuel and a forge.', production: '3 miners · 12 ore / day', upgrades: productionUpgrades(3),
  },
  smith: {
    name: 'Smithy', category: 'industry', model: 'smith', cost: { stone: 24, planks: 12, gold: 8 }, work: 70, workers: 2, job: 'smith', unlock: 'metallurgy', recipe: recipe({ ore: 8, wood: 4 }, { iron: 6 }),
    description: 'Smelts ore with timber fuel into iron. A toolmaker can turn these bars into the tools needed by advanced workshops.', production: '8 ore + 4 timber → 6 iron / day', upgrades: productionUpgrades(2),
  },
  toolmaker: {
    name: 'Toolmaker', category: 'industry', model: 'smith', cost: { stone: 18, planks: 16, iron: 6 }, work: 75, workers: 2, job: 'smith', unlock: 'metallurgy', recipe: recipe({ iron: 4, planks: 2 }, { tools: 4 }),
    description: 'Forges axes, chisels, and hinges. Tools make research, upgraded homes, clinics, and long-distance cargo possible.', production: '4 iron + 2 planks → 4 tools / day', upgrades: productionUpgrades(2),
  },
  flaxfield: {
    name: 'Flax field', category: 'materials', model: 'farm', cost: { wood: 12, stone: 4 }, work: 35, workers: 2, job: 'farmer', unlock: 'textiles', recipe: recipe({}, { flax: 12 }),
    description: 'Blue flowers become strong fiber. A weaver turns the harvest into cloth for bedding, healers, and coastal trade.', production: '2 farmers · 12 flax / day', upgrades: productionUpgrades(2),
  },
  weaver: {
    name: 'Weaver', category: 'industry', model: 'market', cost: { wood: 16, planks: 10, stone: 8 }, work: 55, workers: 2, job: 'weaver', unlock: 'textiles', recipe: recipe({ flax: 8 }, { cloth: 5 }),
    description: 'Turns local flax into useful cloth. Better homes need warm bedding, clinics need clean linen, and merchants always need cargo.', production: '8 flax → 5 cloth / day', upgrades: productionUpgrades(2),
  },
  brewery: {
    name: 'Brewhouse', category: 'food', model: 'bakery', cost: { stone: 20, planks: 14, iron: 4 }, work: 65, workers: 2, job: 'brewer', unlock: 'brewing', recipe: recipe({ grain: 10 }, { ale: 6 }),
    description: 'Brews grain into ale for gatherings and profitable cargo. Save enough grain for the mill before filling the barrels.', production: '10 grain → 6 ale / day', service: service('leisure', 3, 24), upgrades: productionUpgrades(2).map((upgrade, index) => ({ ...upgrade, service: service('leisure', 4 + index, index ? 54 : 36) })),
  },
  market: {
    name: 'Market hall', category: 'trade', model: 'market', cost: { wood: 18, stone: 10, planks: 6 }, work: 55, workers: 2, job: 'trader', unlock: 'barter', recipe: recipe({ food: 6 }, { gold: 4 }),
    description: 'Sells a measured part of the harvest for coin. Contracts and coastal routes offer better returns when the town can spare crafted goods.', production: '6 food → 4 coin / day', upgrades: productionUpgrades(2),
  },
  school: {
    name: 'Schoolhouse', category: 'civic', model: 'school', cost: { wood: 18, stone: 12 }, work: 45, workers: 2, job: 'scholar', recipe: recipe({ food: 2 }, { knowledge: 7 }),
    description: 'Two scholars turn shared meals and careful study into knowledge. The founding school is available before any research so the town can choose its own path.', production: '2 food → 7 knowledge / day', upgrades: productionUpgrades(2),
  },
  well: {
    name: 'Village well', category: 'services', model: 'well', cost: { wood: 8, stone: 16 }, work: 35,
    description: 'Clean water within four spaces makes nearby homes healthier. A well supplies thirty-five beds without a permanent worker; upgrades serve larger neighborhoods.', production: 'Water for 35 beds · radius 4', service: service('water', 4, 35),
    upgrades: upgrades({ cost: { stone: 16, iron: 4 }, work: 45, service: service('water', 5, 52) }, { cost: { stone: 30, tools: 6, gold: 12 }, service: service('water', 6, 75) }),
  },
  clinic: {
    name: 'Clinic', category: 'services', model: 'clinic', cost: { planks: 18, stone: 20, tools: 4, cloth: 6 }, work: 75, workers: 2, job: 'medic', unlock: 'public_health', recipe: recipe({ food: 2, cloth: 1 }),
    description: 'Healers need clean linen, meals, and time. Two supplied healers serve thirty nearby beds; expanded clinics serve more homes with less linen per patient.', production: '2 food + 1 cloth / day · health for 30 beds', service: service('health', 5, 30), upgrades: serviceUpgrades('health', { workers: 2, upkeep: 1.35, radius: 6, capacity: 48 }, { workers: 3, upkeep: 1.8, radius: 7, capacity: 72 }),
  },
  chapel: {
    name: 'Assembly chapel', category: 'services', model: 'school', cost: { stone: 24, planks: 16, cloth: 4 }, work: 70, workers: 1, job: 'chaplain', unlock: 'civic_order', recipe: recipe({ food: 1 }),
    description: 'A keeper opens the doors for ceremonies, remembrance, and a quiet hour together. Larger assembly rooms welcome more neighbors without tying up another worker.', production: '1 food / day · community for 24 beds', service: service('faith', 5, 24), upgrades: serviceUpgrades('faith', { workers: 1, upkeep: 1.3, radius: 6, capacity: 36 }, { workers: 1, upkeep: 1.8, radius: 7, capacity: 54 }),
  },
  barracks: {
    name: 'Watch house', category: 'security', model: 'barracks', cost: { planks: 20, stone: 20, tools: 6 }, work: 85, workers: 3, job: 'guard', unlock: 'watchkeeping', recipe: recipe({ food: 3 }),
    description: 'Feeds a standing watch. Guards must patrol during coastal warnings to protect the town’s stores, and escort readiness opens distant trade.', production: '3 food / day · 3 guards at full staffing', service: service('security', 5, 30), upgrades: serviceUpgrades('security', { workers: 4, upkeep: 4 / 3, radius: 6, capacity: 48 }, { workers: 6, upkeep: 2, radius: 7, capacity: 72 }),
  },
  warehouse: {
    name: 'Warehouse', category: 'trade', model: 'warehouse', cost: { planks: 20, stone: 16 }, work: 65, storage: 180, unlock: 'logistics',
    description: 'Dry shelves and a loading yard raise the capacity of every physical stockpile. Coin and knowledge do not occupy its stores.', production: '+180 physical storage',
    upgrades: upgrades({ cost: { planks: 25, stone: 20, tools: 4 }, storage: 360 }, { cost: { planks: 40, iron: 12, tools: 8, gold: 30 }, storage: 650 }),
  },
  manor: {
    name: 'Town hall', category: 'civic', model: 'cottage', cost: { planks: 40, stone: 60, iron: 12, tools: 10, cloth: 10, gold: 50 }, work: 160, workers: 2, job: 'steward', housing: 12, unlock: 'town_charter', recipe: recipe({ gold: 2 }, { knowledge: 5 }),
    description: 'A civic home for a growing port. Stewards keep records, residents gain rooms, and the island begins to govern its own future.', production: '12 beds · 2 coin → 5 knowledge / day', service: service('civic', 6, 40),
    upgrades: upgrades({ cost: { planks: 45, stone: 45, tools: 12, cloth: 12, gold: 60 }, work: 180, housing: 18, workers: 2, productionMultiplier: 1.6, service: service('civic', 7, 64) }, { cost: { planks: 70, iron: 25, tools: 20, cloth: 20, gold: 120 }, work: 240, housing: 24, workers: 3, productionMultiplier: 2.7, service: service('civic', 8, 96) }),
  },
}).map(([type, spec]) => [type, define(spec)])));

/** The next upgrade's price and work, or null at the maximum level. */
export function getUpgrade(type, currentLevel = 1) {
  return BUILDINGS[type]?.upgrades.find(upgrade => upgrade.level === currentLevel + 1) || null;
}

/** Resolved level data; recipe quantities are already scaled for that level. */
export function getBuildingSpec(type, level = 1) {
  const base = BUILDINGS[type];
  if (!base) return null;
  const requested = Math.max(1, Math.min(3, Number.isInteger(level) ? level : 1));
  const spec = { ...base, level: 1, productionMultiplier: 1 };
  for (const upgrade of base.upgrades) if (upgrade.level <= requested) {
    const { cost: _cost, work: _work, requires: _requires, ...effects } = upgrade;
    Object.assign(spec, effects);
  }
  const multiplier = spec.productionMultiplier;
  spec.recipe = {
    input: Object.fromEntries(Object.entries(base.recipe.input).map(([key, amount]) => [key, amount * multiplier])),
    output: Object.fromEntries(Object.entries(base.recipe.output).map(([key, amount]) => [key, amount * multiplier])),
    perDay: base.recipe.perDay,
  };
  return spec;
}
