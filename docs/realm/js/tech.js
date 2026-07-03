// ════════════════════════════════════════════════════════════
// Technology Tree — research unlocks building tiers
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS } from './state.js?realm=130';
import { sfx as playSound } from './log.js?realm=130';
import { emit } from './bus.js?realm=130';
import { chronicle } from './log.js?realm=130';
import { announce as notify } from './log.js?realm=130';

export const TECHS = {
  agriculture: {
    name: 'Agriculture',
    desc: 'Unlocks farms for food production',
    cost: { gold: 0 },
    time: 0,
    unlocks: ['farm', 'granary', 'storehouse', 'fisherman'],
    icon: '🌾',
    prereq: null,
    era: 1,
  },
  forestry: {
    name: 'Forestry',
    desc: 'Unlocks lumber mills to harvest wood',
    cost: { gold: 0 },
    time: 0,
    unlocks: ['lumber'],
    icon: '🪓',
    prereq: null,
    era: 1,
  },
  masonry: {
    name: 'Masonry',
    desc: 'Unlocks quarries, stone walls, roads and wells',
    cost: { gold: 15, wood: 20 },
    time: 300,
    // well + road live in Era I so Cottage evolution (well visits,
    // state.js HOUSE_TIERS) is reachable before the Age of Charter.
    unlocks: ['quarry', 'wall', 'road', 'well'],
    icon: '🧱',
    prereq: null,
    era: 1,
  },
  engineering: {
    name: 'Engineering',
    desc: 'Unlocks sawmills and churches',
    cost: { gold: 20, stone: 15 },
    time: 900,
    unlocks: ['sawmill', 'church'],
    icon: '⚙️',
    prereq: 'masonry',
    era: 2,
  },
  metallurgy: {
    name: 'Metallurgy',
    desc: 'Unlocks iron mines for advanced materials',
    cost: { gold: 30, stone: 20 },
    time: 1000,
    unlocks: ['mine'],
    icon: '⛏️',
    prereq: 'masonry',
    era: 2,
  },
  commerce: {
    name: 'Commerce',
    desc: 'Unlocks markets for gold generation',
    cost: { gold: 20, wood: 15 },
    time: 350,
    unlocks: ['market', 'tradingpost', 'school'],
    icon: '🏪',
    prereq: null,
    era: 1,
  },
  military: {
    name: 'Military',
    desc: 'Unlocks barracks and watch towers',
    cost: { gold: 25, iron: 5 },
    time: 1100,
    unlocks: ['barracks', 'tower'],
    icon: '⚔️',
    prereq: 'metallurgy',
    era: 2,
  },
  brewing: {
    name: 'Brewing',
    desc: 'Unlocks taverns for happiness',
    cost: { gold: 15, food: 20 },
    time: 700,
    unlocks: ['tavern'],
    icon: '🍺',
    prereq: 'commerce',
    era: 2,
  },
  architecture: {
    name: 'Architecture',
    desc: 'Grand designs in stone. Unlocks the Castle — the Wonder\'s foundation',
    cost: { gold: 50, stone: 30, iron: 10 },
    time: 2000,
    unlocks: ['castle'],
    icon: '🏰',
    prereq: 'military',
    era: 3,
  },
  baking: {
    name: 'Baking',
    desc: 'Unlocks windmill and bakery for food processing',
    cost: { gold: 20, wood: 15 },
    time: 350,
    unlocks: ['windmill', 'bakery'],
    icon: '🍞',
    prereq: 'agriculture',
    era: 1,
  },
  husbandry: {
    name: 'Animal Husbandry',
    desc: 'Unlocks chicken coops and cow pens',
    cost: { gold: 15, wood: 10 },
    time: 300,
    unlocks: ['chickencoop', 'cowpen'],
    icon: '🐄',
    prereq: 'agriculture',
    era: 1,
  },
  smithing: {
    name: 'Smithing',
    desc: 'Unlocks blacksmith for better weapons',
    cost: { gold: 25, iron: 5 },
    time: 900,
    unlocks: ['blacksmith'],
    icon: '🔨',
    prereq: 'metallurgy',
    era: 2,
  },
  archery: {
    name: 'Archery',
    desc: 'Unlocks archery range for ranged units',
    cost: { gold: 20, wood: 20 },
    time: 900,
    unlocks: ['archery'],
    icon: '🏹',
    prereq: 'military',
    era: 2,
  },
  guilds: {
    name: 'Guilds',
    desc: 'Charters the craft guilds — converters work half again as fast',
    cost: { gold: 60, planks: 20 },
    time: 1500,
    unlocks: [],
    icon: '🏛️',
    prereq: 'smithing',
    era: 3,
  },
  monuments: {
    name: 'Monuments',
    desc: 'The realm learns to build for the ages — the path to a Wonder',
    cost: { gold: 100, stone: 50, planks: 30, tools: 10 },
    time: 2400,
    unlocks: ['wonder'],
    icon: '🕍',
    prereq: 'architecture',
    era: 3,
  },
};

// Which building types require NO tech (always available)
export const FREE_BUILDINGS = ['house'];

export function isTechResearched(techId) {
  return G.researchedTechs.has(techId);
}

export function isBuildingUnlocked(buildingType) {
  if (FREE_BUILDINGS.includes(buildingType)) return true;
  // Loop 258 (the-fixer, 256 MEDIUM finding): maxCount enforcement.
  // When BUILDINGS[type].maxCount is set, the build option hides once the
  // realm reaches the cap. First use: townhall maxCount:1 (state.js:77).
  // Generic check so future capped buildings work the same way.
  const def = BUILDINGS[buildingType];
  if (def && def.maxCount != null) {
    const built = G.buildings ? G.buildings.filter(b => b.type === buildingType).length : 0;
    if (built >= def.maxCount) return false;
  }
  // Loop 243: townhall is gated on a NAMED MAYOR (set by tavern-build per
  // 034 hook), not a tech. Mayor-as-prerequisite is the 6th and last
  // named-character mechanic per 101 filing.
  if (buildingType === 'townhall') return !!G.namedCharacters?.mayor;
  // Phase D: the Wonder needs the Monuments tech AND a completed castle
  // standing — the castle is the prerequisite, not the win (wonder.js).
  if (buildingType === 'wonder') {
    if (!G.researchedTechs.has('monuments')) return false;
    return (G.buildings || []).some(b => b.type === 'castle' && (b.buildProgress === undefined || b.buildProgress >= 1));
  }
  for (const [techId, tech] of Object.entries(TECHS)) {
    if (tech.unlocks.includes(buildingType) && G.researchedTechs.has(techId)) return true;
  }
  return false;
}

export function canResearch(techId) {
  const tech = TECHS[techId];
  if (!tech) return false;
  if (G.researchedTechs.has(techId)) return false;
  if (G.currentResearch) return false;
  if (tech.prereq && !G.researchedTechs.has(tech.prereq)) return false;
  if ((tech.era || 1) > (G.era || 1)) return false;
  for (const [k, v] of Object.entries(tech.cost)) {
    if ((G.resources[k] || 0) < v) return false;
  }
  return true;
}

export function startResearch(techId) {
  if (!canResearch(techId)) return false;
  const tech = TECHS[techId];
  for (const [k, v] of Object.entries(tech.cost)) G.resources[k] -= v;
  G.currentResearch = { techId, progress: 0, total: tech.time };
  playSound('click');
  return true;
}

// Loop 065 (the-fixer, 060 HIGH): chronicle beats for research
// completion. 060's audit found research was the widest uncovered
// narrative axis — techs finished silently, without the realm
// acknowledging mastery. Each tech gets an imagistic one-liner in
// the voice of BUILDING_FIRST_BEATS. Missing entries fall through
// to a generic "<tech> is mastered" beat so new techs always get
// at least a default chronicle.
const RESEARCH_BEATS = {
  masonry:      'The realm masters masonry. Stone now speaks in lines and courses.',
  engineering:  'Engineering is grasped. Water runs where it is told; the roads remember where they lead.',
  metallurgy:   'Ore yields to fire at last. The realm learns to fetch the buried heat.',
  commerce:     'Commerce is taught. Coins begin to remember which hands they have passed through.',
  military:     'The art of arms is set down in lore. Recruits study what they once only endured.',
  brewing:      'Brewing is learned. What cold spring water could not cheer, malted barley will.',
  architecture: 'Architecture is learned. Thresholds now know where walls begin and where they end.',
  baking:       "Baking is mastered. Bread cools on a shelf the village knows the shape of.",
  husbandry:    'Husbandry is grasped. Hoof and horn are counted, named, remembered.',
  smithing:     'Smithing is learned. Hammers now strike with purpose beyond force.',
  archery:      "The fletcher's trade is mastered. Arrows fly true to measure, not to hope.",
  guilds:       'The guilds receive their charters. Craft now answers to craft, and the wheels turn faster.',
  monuments:    'The realm learns to build for the ages. Somewhere beyond the scaffolds, a Wonder waits.',
};

export function updateResearch() {
  if (!G.currentResearch) return;
  // Schools boost research speed by 50% each (multiplicative)
  const schools = G.buildings.filter(b => b.type === 'school' && b.workers.length > 0).length;
  // Loop 101 (the-fixer, 050 filed 50+ ticks): named teacher adds a
  // flat +10% speed bonus. Graduates the named-character system from
  // "chronicle decoration" (034) to "game mechanic" — 050 and 100
  // both asked for this shape. Additive alongside school bonus; no
  // chronicle beat (034's character-intro already announced teacher).
  const teacherBonus = G.namedCharacters?.teacher ? 0.1 : 0;
  const speedMult = 1 + schools * 0.5 + teacherBonus;
  G.currentResearch.progress += speedMult;
  if (G.currentResearch.progress >= G.currentResearch.total) {
    const techId = G.currentResearch.techId;
    G.researchedTechs.add(techId);
    G.currentResearch = null;
    playSound('mission');
    const tech = TECHS[techId];
    notify(`Research complete: ${tech.name}`, 'info', { chronicle: false });
    // Loop 065: chronicle beat. Fallback for any future tech.
    const text = RESEARCH_BEATS[techId] || `${tech.name} is mastered. The realm bends a new skill into its lore.`;
    try { chronicle(text, 'research'); } catch (_e) {}
    checkEraAdvance();
  }
}

export function getResearchProgress() {
  if (!G.currentResearch) return null;
  const { techId, progress, total } = G.currentResearch;
  return { techId, fraction: Math.min(1, progress / total), name: TECHS[techId].name };
}

// ════════════════════════════════════════════════════════════
// The Three Ages — eras gate tech tiers (canResearch); the realm
// advances by what it achieves, not by research alone. G.era only
// ever rises. Checked from research completion and the simTick
// story-beat cadence (main.js crossed(60)).
// ════════════════════════════════════════════════════════════

export const ERAS = [
  { id: 1, name: 'Age of Hearth',    icon: '🏕️' },
  { id: 2, name: 'Age of Charter',   icon: '📜' },
  { id: 3, name: 'Age of the Crown', icon: '👑' },
];

// Count researched techs of one era, excluding the free time-0 starters
// (agriculture/forestry) so the Era-I gate counts real research choices.
function researchedTechsOfEra(era) {
  let n = 0;
  for (const [id, t] of Object.entries(TECHS)) {
    if ((t.era || 1) === era && t.time > 0 && G.researchedTechs.has(id)) n++;
  }
  return n;
}

function highestHouseTier() {
  let best = 0;
  for (const b of G.buildings) {
    if (b.type === 'house') best = Math.max(best, b.level || 1);
  }
  return best;
}

// Gate to LEAVE the keyed era. Age of the Crown is terminal — its
// ladder is the Wonder (Phase D4), not a fourth era.
const ERA_GATES = {
  1: () => [
    { label: 'Research Masonry',          cur: G.researchedTechs.has('masonry') ? 1 : 0, goal: 1 },
    { label: 'Age of Hearth techs',       cur: researchedTechsOfEra(1),                  goal: 3 },
    { label: 'Population',                cur: G.population,                             goal: 15 },
    { label: 'A house becomes a Cottage', cur: highestHouseTier() >= 2 ? 1 : 0,          goal: 1 },
  ],
  2: () => [
    { label: 'Research Military',           cur: G.researchedTechs.has('military') ? 1 : 0, goal: 1 },
    { label: 'Age of Charter techs',        cur: researchedTechsOfEra(2),                   goal: 4 },
    { label: 'A house becomes a Homestead', cur: highestHouseTier() >= 3 ? 1 : 0,           goal: 1 },
    { label: 'Survive a raid',              cur: G.stats?.raidsSurvived || 0,               goal: 1 },
  ],
};

function eraGateSatisfied(era) {
  const gate = ERA_GATES[era];
  if (!gate) return false;
  return gate().every(g => g.cur >= g.goal);
}

// Checklist for the current era's advance gate, for the research
// panel / HUD. Returns null in the terminal era.
export function getEraProgress() {
  const gate = ERA_GATES[G.era || 1];
  if (!gate) return null;
  return gate().map(g => ({
    label: g.label,
    cur: Math.min(g.cur, g.goal),
    goal: g.goal,
    done: g.cur >= g.goal,
  }));
}

// Era-up chronicle beats get the dedicated eviction-immune 'era' tag;
// notify()'s auto-chronicle is suppressed so the beat is written
// exactly once (notifications.js files 'event' under the generic tag).
const ERA_BEATS = {
  2: 'A charter is drawn and sealed. The camp that was is now a town with a name worth defending — the Age of Charter begins.',
  3: 'Banners rise above stone and slate. The realm speaks of a crown, and of a hall to outlast it — the Age of the Crown begins.',
};

export function checkEraAdvance() {
  if (G.realmEnded) return;
  while ((G.era || 1) < ERAS.length && eraGateSatisfied(G.era || 1)) {
    G.era = (G.era || 1) + 1;
    G.eraStartDay = G.eraStartDay || { 1: 1 };
    G.eraStartDay[G.era] = G.day;
    const era = ERAS[G.era - 1];
    playSound('mission');
    try { notify(`${era.icon} The realm enters the ${era.name}!`, 'event', { chronicle: false }); } catch (_e) {}
    try { chronicle(ERA_BEATS[G.era] || `The realm enters the ${era.name}.`, 'era'); } catch (_e) {}
    emit('era-advanced', { era: G.era });
  }
}



// Backfill for saves written before eras existed: the highest era any
// researched tech belongs to (nothing already researched may lock out),
// then climb any gates the loaded realm already satisfies.
export function deriveEra() {
  let era = 1;
  for (const [id, t] of Object.entries(TECHS)) {
    if (G.researchedTechs.has(id)) era = Math.max(era, t.era || 1);
  }
  while (era < ERAS.length && eraGateSatisfied(era)) era++;
  return era;
}
