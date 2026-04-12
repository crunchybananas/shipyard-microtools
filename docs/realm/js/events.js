// ════════════════════════════════════════════════════════════
// Random Events — drought, gold rush, plague, migration, etc.
// ════════════════════════════════════════════════════════════

import { G, rng, rngInt } from './state.js';
import { trySpawnSettlers } from './economy.js';
import { playSound } from './audio.js';

export const EVENT_DEFS = [
  {
    id: 'drought',
    name: '☀️ Drought',
    desc: 'Scorching heat halves food production for 3 days.',
    duration: 3,
    color: '#f59e0b',
    onStart() { G.eventModifiers.foodProd = 0.5; },
    onEnd() { G.eventModifiers.foodProd = 1; },
  },
  {
    id: 'gold_rush',
    name: '🪙 Gold Rush',
    desc: 'Prospectors find gold veins! +50% gold income for 2 days.',
    duration: 2,
    color: '#ffd166',
    onStart() { G.eventModifiers.goldProd = 1.5; },
    onEnd() { G.eventModifiers.goldProd = 1; },
  },
  {
    id: 'plague',
    name: '🦠 Plague',
    desc: 'A sickness spreads. Happiness −20 for 3 days.',
    duration: 3,
    color: '#a855f7',
    onStart() { G.eventModifiers.happinessOffset = -20; },
    onEnd() { G.eventModifiers.happinessOffset = 0; },
  },
  {
    id: 'migration',
    name: '🚶 Migration Wave',
    desc: 'Refugees arrive seeking shelter! +5 settlers.',
    duration: 0,
    color: '#4ade80',
    onStart() {
      const count = Math.min(5, G.maxPop - G.population);
      if (count > 0) trySpawnSettlers(count);
    },
    onEnd() {},
  },
  {
    id: 'bountiful',
    name: '🌾 Bountiful Harvest',
    desc: 'Excellent growing conditions double food production for 2 days.',
    duration: 2,
    color: '#4ade80',
    onStart() { G.eventModifiers.foodProd = 2; },
    onEnd() { G.eventModifiers.foodProd = 1; },
  },
  {
    id: 'bandits',
    name: '🏴 Bandit Sighting',
    desc: 'Bandits spotted nearby. Extra raid in 2 days!',
    duration: 0,
    color: '#ef4444',
    onStart() { G.nextRaidDay = Math.min(G.nextRaidDay, G.day + 2); },
    onEnd() {},
  },
  {
    id: 'festival',
    name: '🎉 Festival',
    desc: 'Citizens celebrate! +15 happiness for 2 days.',
    duration: 2,
    color: '#f472b6',
    onStart() { G.eventModifiers.happinessOffset = 15; },
    onEnd() { G.eventModifiers.happinessOffset = 0; },
  },
  {
    id: 'iron_discovery',
    name: '⛏️ Iron Discovery',
    desc: 'Scouts found an iron deposit! +10 iron.',
    duration: 0,
    color: '#60a5fa',
    onStart() { G.resources.iron += 10; },
    onEnd() {},
  },
];

function showToast(msg, danger = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

export function checkRandomEvents() {
  // Only fire at day transitions, skip early game
  if (G.day < 4) return;
  if (G.activeEvent) {
    // Check if active event expired
    if (G.activeEvent.endDay <= G.day) {
      const def = EVENT_DEFS.find(e => e.id === G.activeEvent.id);
      def?.onEnd();
      G.activeEvent = null;
      updateEventBanner();
    }
    return; // one event at a time
  }

  // 8% chance per day
  if (rng() > 0.08) return;

  const def = EVENT_DEFS[rngInt(0, EVENT_DEFS.length - 1)];
  G.activeEvent = {
    id: def.id,
    name: def.name,
    desc: def.desc,
    color: def.color,
    endDay: G.day + def.duration,
  };
  def.onStart();
  playSound('mission');
  showToast(`Event: ${def.name} — ${def.desc}`);
  updateEventBanner();
}

export function updateEventBanner() {
  const banner = document.getElementById('event-banner');
  if (!banner) return;
  if (G.activeEvent && G.activeEvent.endDay > G.day) {
    const remaining = G.activeEvent.endDay - G.day;
    banner.style.display = 'flex';
    banner.style.borderColor = G.activeEvent.color;
    banner.innerHTML = `
      <span style="color:${G.activeEvent.color};font-weight:700">${G.activeEvent.name}</span>
      <span>${G.activeEvent.desc}</span>
      ${remaining > 0 ? `<span class="eb-days">${remaining}d left</span>` : ''}`;
  } else {
    banner.style.display = 'none';
  }
}

// Apply event modifiers to production values
export function getProductionMultiplier(resourceType) {
  if (!G.eventModifiers) return 1;
  if (resourceType === 'food') return G.eventModifiers.foodProd ?? 1;
  if (resourceType === 'gold') return G.eventModifiers.goldProd ?? 1;
  return 1;
}

export function getHappinessOffset() {
  return G.eventModifiers?.happinessOffset ?? 0;
}
