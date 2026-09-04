// ════════════════════════════════════════════════════════════
// Scenarios — structured objective-based campaigns
// ════════════════════════════════════════════════════════════

import { G } from './state.js?realm=198';
import {
  FIRST_MUSTER_CHAPTER_ID,
  getFirstMusterScenarioObjectives,
  isFirstMusterComplete,
} from './first-muster.js?realm=198';
import {
  getPostRaidRecoveryScenarioObjectives,
  isPostRaidRecoveryComplete,
} from './post-raid-recovery.js?realm=198';

export const SCENARIOS = [
  {
    id: 'peaceful_start',
    name: '🌾 Peaceful Valley',
    desc: 'A quiet island. Build your first settlement.',
    objectives: [
      { text: 'Reach 10 population', check: () => G.population >= 10, progress: () => [G.population, 10] },
      { text: 'Complete a Church', check: () => G.buildings.some(b => b.type === 'church' && b.buildProgress >= 1) },
      { text: 'Reach 80% happiness', check: () => G.happiness >= 80, progress: () => [Math.floor(G.happiness), 80] },
    ],
    startResources: { wood: 55, stone: 30, food: 12, gold: 15, iron: 0 },
    raidStart: 30,
  },
  {
    id: 'military_rise',
    name: '⚔️ Rise of the Sword',
    desc: 'A hungry military frontier. Establish food, raise a company, scout the warband, and hold the line.',
    chapterId: FIRST_MUSTER_CHAPTER_ID,
    get objectives() {
      if (!isFirstMusterComplete(G)) {
        return getFirstMusterScenarioObjectives(G);
      }
      return getPostRaidRecoveryScenarioObjectives(G);
    },
    // Six opening ration-days force food production to become real before the
    // three-recruit muster, while still leaving enough runway to recover from
    // a placement mistake or one interrupted work shift.
    startResources: { wood: 60, stone: 80, food: 18, gold: 50, iron: 20, planks: 20 },
    startEra: 2,
    startResearch: ['agriculture', 'forestry', 'masonry', 'metallurgy', 'military'],
    raidStart: 8,
  },
  {
    id: 'merchant_kingdom',
    name: '🪙 Merchant Kingdom',
    desc: 'Grow rich through trade and commerce.',
    objectives: [
      { text: 'Accumulate 500 gold', check: () => G.resources.gold >= 500, progress: () => [Math.floor(G.resources.gold || 0), 500] },
      { text: 'Complete 3 Markets', check: () => G.buildings.filter(b => b.type === 'market' && b.buildProgress >= 1).length >= 3, progress: () => [G.buildings.filter(b => b.type === 'market' && b.buildProgress >= 1).length, 3] },
      { text: 'Complete 2 Trading Posts', check: () => G.buildings.filter(b => b.type === 'tradingpost' && b.buildProgress >= 1).length >= 2, progress: () => [G.buildings.filter(b => b.type === 'tradingpost' && b.buildProgress >= 1).length, 2] },
    ],
    startResources: { wood: 80, stone: 40, food: 80, gold: 100, iron: 10 },
    raidStart: 20,
  },
  {
    id: 'seafaring',
    name: '⛵ Seafaring Nation',
    desc: 'Master the seas through trade and fishing.',
    objectives: [
      { text: 'Complete 3 Fisherman Huts', check: () => G.buildings.filter(b=>b.type==='fisherman' && b.buildProgress>=1).length>=3, progress: () => [G.buildings.filter(b=>b.type==='fisherman' && b.buildProgress>=1).length, 3] },
      { text: 'Complete 2 Trading Posts', check: () => G.buildings.filter(b=>b.type==='tradingpost' && b.buildProgress>=1).length>=2, progress: () => [G.buildings.filter(b=>b.type==='tradingpost' && b.buildProgress>=1).length, 2] },
      { text: 'Accumulate 300 gold', check: () => G.resources.gold >= 300, progress: () => [Math.floor(G.resources.gold || 0), 300] },
    ],
    startResources: { wood: 70, stone: 30, food: 60, gold: 40, iron: 5 },
    raidStart: 15,
  },
  {
    id: 'industrial',
    name: '⚙️ Industrial Expansion',
    desc: 'Build a production empire.',
    objectives: [
      { text: 'Complete a Windmill + Bakery', check: () => G.buildings.some(b=>b.type==='windmill' && b.buildProgress>=1) && G.buildings.some(b=>b.type==='bakery' && b.buildProgress>=1) },
      { text: 'Complete 2 Iron Mines', check: () => G.buildings.filter(b=>b.type==='mine' && b.buildProgress>=1).length>=2, progress: () => [G.buildings.filter(b=>b.type==='mine' && b.buildProgress>=1).length, 2] },
      { text: 'Reach 30 population', check: () => G.population >= 30, progress: () => [G.population, 30] },
    ],
    startResources: { wood: 100, stone: 60, food: 100, gold: 40, iron: 0 },
    raidStart: 12,
  },
];

export function getActiveScenario() {
  return SCENARIOS.find(s => s.id === G.scenario) || SCENARIOS[0];
}

export function checkScenarioComplete() {
  const scen = getActiveScenario();
  if (!scen) return false;
  if (scen.chapterId === FIRST_MUSTER_CHAPTER_ID) {
    return isFirstMusterComplete(G) && isPostRaidRecoveryComplete(G);
  }
  return scen.objectives.every(o => o.check());
}
