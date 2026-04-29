// ════════════════════════════════════════════════════════════
// Technology Tree — research unlocks building tiers
// ════════════════════════════════════════════════════════════

import { G } from './state.js';
import { playSound } from './audio.js';
import { chronicle } from './story.js';

export const TECHS = {
  agriculture: {
    name: 'Agriculture',
    desc: 'Unlocks farms for food production',
    cost: { gold: 0 },
    time: 0,
    unlocks: ['farm', 'granary', 'fisherman'],
    icon: '🌾',
    prereq: null,
  },
  forestry: {
    name: 'Forestry',
    desc: 'Unlocks lumber mills to harvest wood',
    cost: { gold: 0 },
    time: 0,
    unlocks: ['lumber'],
    icon: '🪓',
    prereq: null,
  },
  masonry: {
    name: 'Masonry',
    desc: 'Unlocks quarries and stone walls',
    cost: { gold: 15, wood: 20 },
    time: 300,
    unlocks: ['quarry', 'wall', 'church'],
    icon: '🧱',
    prereq: null,
  },
  engineering: {
    name: 'Engineering',
    desc: 'Unlocks roads and wells',
    cost: { gold: 20, stone: 15 },
    time: 400,
    unlocks: ['road', 'well'],
    icon: '⚙️',
    prereq: 'masonry',
  },
  metallurgy: {
    name: 'Metallurgy',
    desc: 'Unlocks iron mines for advanced materials',
    cost: { gold: 30, stone: 20 },
    time: 500,
    unlocks: ['mine'],
    icon: '⛏️',
    prereq: 'masonry',
  },
  commerce: {
    name: 'Commerce',
    desc: 'Unlocks markets for gold generation',
    cost: { gold: 20, wood: 15 },
    time: 350,
    unlocks: ['market', 'tradingpost', 'school'],
    icon: '🏪',
    prereq: null,
  },
  military: {
    name: 'Military',
    desc: 'Unlocks barracks and watch towers',
    cost: { gold: 25, iron: 5 },
    time: 450,
    unlocks: ['barracks', 'tower'],
    icon: '⚔️',
    prereq: 'metallurgy',
  },
  brewing: {
    name: 'Brewing',
    desc: 'Unlocks taverns for happiness',
    cost: { gold: 15, food: 20 },
    time: 250,
    unlocks: ['tavern'],
    icon: '🍺',
    prereq: 'commerce',
  },
  architecture: {
    name: 'Architecture',
    desc: 'The pinnacle of knowledge. Unlocks the Castle — build it to win!',
    cost: { gold: 50, stone: 30, iron: 10 },
    time: 800,
    unlocks: ['castle'],
    icon: '🏰',
    prereq: 'military',
  },
  baking: {
    name: 'Baking',
    desc: 'Unlocks windmill and bakery for food processing',
    cost: { gold: 20, wood: 15 },
    time: 350,
    unlocks: ['windmill', 'bakery'],
    icon: '🍞',
    prereq: 'agriculture',
  },
  husbandry: {
    name: 'Animal Husbandry',
    desc: 'Unlocks chicken coops and cow pens',
    cost: { gold: 15, wood: 10 },
    time: 300,
    unlocks: ['chickencoop', 'cowpen'],
    icon: '🐄',
    prereq: 'agriculture',
  },
  smithing: {
    name: 'Smithing',
    desc: 'Unlocks blacksmith for better weapons',
    cost: { gold: 25, iron: 5 },
    time: 400,
    unlocks: ['blacksmith'],
    icon: '🔨',
    prereq: 'metallurgy',
  },
  archery: {
    name: 'Archery',
    desc: 'Unlocks archery range for ranged units',
    cost: { gold: 20, wood: 20 },
    time: 400,
    unlocks: ['archery'],
    icon: '🏹',
    prereq: 'military',
  },
};

// Which building types require NO tech (always available)
export const FREE_BUILDINGS = ['house'];

export function isTechResearched(techId) {
  return G.researchedTechs.has(techId);
}

export function isBuildingUnlocked(buildingType) {
  if (FREE_BUILDINGS.includes(buildingType)) return true;
  // Loop 243: townhall is gated on a NAMED MAYOR (set by tavern-build per
  // 034 hook), not a tech. Mayor-as-prerequisite is the 6th and last
  // named-character mechanic per 101 filing.
  if (buildingType === 'townhall') return !!G.namedCharacters?.mayor;
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
  G.currentResearch.progress += G.speed * speedMult;
  if (G.currentResearch.progress >= G.currentResearch.total) {
    const techId = G.currentResearch.techId;
    G.researchedTechs.add(techId);
    G.currentResearch = null;
    playSound('mission');
    const tech = TECHS[techId];
    showToast(`Research complete: ${tech.name}`);
    // Loop 065: chronicle beat. Fallback for any future tech.
    const text = RESEARCH_BEATS[techId] || `${tech.name} is mastered. The realm bends a new skill into its lore.`;
    try { chronicle(text, 'research'); } catch (_e) {}
  }
}

export function getResearchProgress() {
  if (!G.currentResearch) return null;
  const { techId, progress, total } = G.currentResearch;
  return { techId, fraction: Math.min(1, progress / total), name: TECHS[techId].name };
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}
