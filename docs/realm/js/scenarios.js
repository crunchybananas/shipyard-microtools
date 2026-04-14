// ════════════════════════════════════════════════════════════
// Scenarios — structured objective-based campaigns
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

export const SCENARIOS = [
  {
    id: 'peaceful_start',
    name: '🌾 Peaceful Valley',
    desc: 'A quiet island. Build your first settlement.',
    objectives: [
      { text: 'Reach 10 population', check: () => G.population >= 10 },
      { text: 'Build a Church', check: () => G.buildings.some(b => b.type === 'church') },
      { text: 'Reach 80% happiness', check: () => G.happiness >= 80 },
    ],
    startResources: { wood: 100, stone: 50, food: 100, gold: 30, iron: 0 },
    raidStart: 30,
    raidIntervalMult: 1.5,
  },
  {
    id: 'military_rise',
    name: '⚔️ Rise of the Sword',
    desc: 'Hostile neighbors approach. Build an army.',
    objectives: [
      { text: 'Train 10 soldiers', check: () => G.soldiers && G.soldiers.length >= 10 },
      { text: 'Survive 5 raids', check: () => G.stats?.raidsSurvived >= 5 },
      { text: 'Build a Castle', check: () => G.buildings.some(b => b.type === 'castle') },
    ],
    startResources: { wood: 60, stone: 80, food: 80, gold: 50, iron: 20 },
    raidStart: 8,
    raidIntervalMult: 0.8,
  },
  {
    id: 'merchant_kingdom',
    name: '🪙 Merchant Kingdom',
    desc: 'Grow rich through trade and commerce.',
    objectives: [
      { text: 'Accumulate 500 gold', check: () => G.resources.gold >= 500 },
      { text: 'Build 3 Markets', check: () => G.buildings.filter(b => b.type === 'market').length >= 3 },
      { text: 'Build 2 Trading Posts', check: () => G.buildings.filter(b => b.type === 'tradingpost').length >= 2 },
    ],
    startResources: { wood: 80, stone: 40, food: 80, gold: 100, iron: 10 },
    raidStart: 20,
    raidIntervalMult: 1.2,
  },
];

export function getActiveScenario() {
  return SCENARIOS.find(s => s.id === G.scenario) || SCENARIOS[0];
}

export function checkScenarioComplete() {
  const scen = getActiveScenario();
  if (!scen) return false;
  return scen.objectives.every(o => o.check());
}
