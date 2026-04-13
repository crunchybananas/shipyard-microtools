// ════════════════════════════════════════════════════════════
// Random Events — drought, gold rush, plague, migration, etc.
// ════════════════════════════════════════════════════════════

import { G, rng, rngInt } from './state.js';
import { trySpawnSettlers } from './economy.js';
import { playSound } from './audio.js';

// positive:true → green banner + 'season' sound
// positive:false → red banner + 'raidWarning' sound
export const EVENT_DEFS = [
  {
    id: 'drought',
    name: '☀️ Drought',
    desc: 'Scorching heat halves food production for 3 days.',
    duration: 3,
    color: '#f59e0b',
    positive: false,
    onStart() { G.eventModifiers.foodProd = 0.5; },
    onEnd()   { G.eventModifiers.foodProd = 1; },
    endMsg:   '☀️ The drought has broken. Food production restored.',
  },
  {
    id: 'gold_rush',
    name: '🪙 Gold Rush',
    desc: 'Prospectors find gold veins! +50% gold income for 2 days.',
    duration: 2,
    color: '#ffd166',
    positive: true,
    onStart() { G.eventModifiers.goldProd = 1.5; },
    onEnd()   { G.eventModifiers.goldProd = 1; },
    endMsg:   '🪙 The gold rush fades. Income returns to normal.',
  },
  {
    id: 'plague',
    name: '🦠 Plague',
    desc: 'Illness spreads! Happiness −20 and citizens move 30% slower for 3 days.',
    duration: 3,
    color: '#a855f7',
    positive: false,
    onStart() {
      G.eventModifiers.happinessOffset = -20;
      G.eventModifiers.speedMult = 0.7;
    },
    onEnd() {
      G.eventModifiers.happinessOffset = 0;
      G.eventModifiers.speedMult = 1;
    },
    endMsg: '🦠 The plague subsides. Citizens recover.',
  },
  {
    id: 'migration',
    name: '🚶 Migration Wave',
    desc: 'Refugees arrive seeking shelter! +5 settlers.',
    duration: 0,
    color: '#4ade80',
    positive: true,
    onStart() {
      const count = Math.min(5, G.maxPop - G.population);
      if (count > 0) trySpawnSettlers(count);
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'bountiful',
    name: '🌾 Bountiful Harvest',
    desc: 'Rain brings a great harvest! Food production doubled for 2 days.',
    duration: 2,
    color: '#4ade80',
    positive: true,
    onStart() { G.eventModifiers.foodProd = 2; },
    onEnd()   { G.eventModifiers.foodProd = 1; },
    endMsg:   '🌾 The bountiful harvest season ends.',
  },
  {
    id: 'bandits',
    name: '🏴 Bandit Sighting',
    desc: 'Bandits spotted nearby. Extra raid in 2 days!',
    duration: 0,
    color: '#ef4444',
    positive: false,
    onStart() { G.nextRaidDay = Math.min(G.nextRaidDay, G.day + 2); },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'festival',
    name: '🎉 Festival',
    desc: 'Citizens celebrate! +20 happiness for 2 days.',
    duration: 2,
    color: '#f472b6',
    positive: true,
    onStart() { G.eventModifiers.happinessOffset = 20; },
    onEnd()   { G.eventModifiers.happinessOffset = 0; },
    endMsg:   '🎉 The festival ends. Citizens return to work.',
  },
  {
    id: 'iron_discovery',
    name: '⛏️ Iron Discovery',
    desc: 'Scouts found an iron deposit! +10 iron.',
    duration: 0,
    color: '#60a5fa',
    positive: true,
    onStart() { G.resources.iron += 10; },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'wandering_merchant',
    name: '🛒 Wandering Merchant',
    desc: 'A merchant offers rare goods! +30 gold, +10 iron.',
    duration: 0,
    color: '#fbbf24',
    positive: true,
    onStart() {
      G.resources.gold += 30;
      G.resources.iron += 10;
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'earthquake',
    name: '🌋 Earthquake',
    desc: 'The ground shakes! A random building takes 30 damage.',
    duration: 0,
    color: '#dc2626',
    positive: false,
    onStart() {
      if (G.buildings.length === 0) return;
      const target = G.buildings[rngInt(0, G.buildings.length - 1)];
      target.hp = Math.max(10, (target.hp ?? 100) - 30);
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'fog_of_exploration',
    name: '🗺️ Fog of Exploration',
    desc: 'Scouts discover new territory! 3 extra tiles revealed.',
    duration: 0,
    color: '#38bdf8',
    positive: true,
    onStart() {
      // Reveal up to 3 random fogged tiles near map centre
      let revealed = 0;
      const cx = Math.floor(G.fog[0]?.length / 2) || 40;
      const cy = Math.floor(G.fog.length / 2) || 40;
      const radius = 15;
      for (let attempt = 0; attempt < 60 && revealed < 3; attempt++) {
        const tx = cx + rngInt(-radius, radius);
        const ty = cy + rngInt(-radius, radius);
        if (ty >= 0 && ty < G.fog.length && tx >= 0 && tx < (G.fog[0]?.length || 0)) {
          if (G.fog[ty][tx]) {
            G.fog[ty][tx] = false;
            revealed++;
          }
        }
      }
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'gold_windfall',
    name: '💰 Gold Windfall',
    desc: 'Gold deposits found nearby! +50 gold.',
    duration: 0,
    color: '#ffd166',
    positive: true,
    onStart() { G.resources.gold += 50; },
    onEnd() {},
    endMsg: '',
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
      const endMsg = def?.endMsg;
      if (endMsg) showToast(endMsg, !def.positive);
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
    positive: def.positive,
    endDay: G.day + def.duration,
  };
  def.onStart();

  // Sound: wind chimes for positive, raid drums for negative
  playSound(def.positive ? 'season' : 'raidWarning');

  showToast(`📢 Event: ${def.name} — ${def.desc}`, !def.positive);
  updateEventBanner();
}

export function updateEventBanner() {
  const banner = document.getElementById('event-banner');
  if (!banner) return;

  if (G.activeEvent && G.activeEvent.endDay > G.day) {
    const remaining = G.activeEvent.endDay - G.day;
    const isPositive = G.activeEvent.positive ?? true;
    const borderColor = isPositive ? '#4ade80' : '#f87171';
    const bgColor = isPositive
      ? 'rgba(74,222,128,0.08)'
      : 'rgba(248,113,113,0.08)';

    banner.style.display = 'flex';
    banner.style.borderColor = borderColor;
    banner.style.borderWidth = '2px';
    banner.style.background = bgColor;
    banner.style.padding = '0.5rem 1.1rem';
    banner.style.fontSize = '0.82rem';
    banner.innerHTML = `
      <span style="color:${G.activeEvent.color};font-weight:800;font-size:0.88rem">${G.activeEvent.name}</span>
      <span style="opacity:0.85">${G.activeEvent.desc}</span>
      ${remaining > 0
        ? `<span class="eb-days" style="background:${bgColor};border:1px solid ${borderColor};color:${borderColor};font-weight:700">${remaining}d left</span>`
        : ''}`;
  } else if (G.activeEvent && G.activeEvent.endDay <= G.day) {
    // Instant events (duration 0): hide immediately
    banner.style.display = 'none';
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

// Citizen movement speed modifier (Plague, etc.)
export function getCitizenSpeedMult() {
  return G.eventModifiers?.speedMult ?? 1;
}
