// ════════════════════════════════════════════════════════════
// Technology Tree — research unlocks building tiers
// ════════════════════════════════════════════════════════════

import { G } from './state.js';
import { playSound } from './audio.js';

export const TECHS = {
  agriculture: {
    name: 'Agriculture',
    desc: 'Unlocks farms for food production',
    cost: { gold: 0 },
    time: 0,
    unlocks: ['farm', 'granary'],
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
};

// Which building types require NO tech (always available)
export const FREE_BUILDINGS = ['house'];

export function isTechResearched(techId) {
  return G.researchedTechs.has(techId);
}

export function isBuildingUnlocked(buildingType) {
  if (FREE_BUILDINGS.includes(buildingType)) return true;
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

export function updateResearch() {
  if (!G.currentResearch) return;
  // Schools boost research speed by 50% each (multiplicative)
  const schools = G.buildings.filter(b => b.type === 'school' && b.workers.length > 0).length;
  const speedMult = 1 + schools * 0.5;
  G.currentResearch.progress += G.speed * speedMult;
  if (G.currentResearch.progress >= G.currentResearch.total) {
    const techId = G.currentResearch.techId;
    G.researchedTechs.add(techId);
    G.currentResearch = null;
    playSound('mission');
    const tech = TECHS[techId];
    showToast(`Research complete: ${tech.name}`);
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
