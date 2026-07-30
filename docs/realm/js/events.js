// ════════════════════════════════════════════════════════════
// Random Events — drought, gold rush, plague, migration, etc.
// ════════════════════════════════════════════════════════════

import { G, rng, rngInt } from './state.js?realm=178';
import { trySpawnSettlers } from './economy.js?realm=178';
import { sfx as playSound } from './log.js?realm=178';
import { emit } from './bus.js?realm=178';
import { chronicle, announce } from './log.js?realm=178';
import { recordDeathMarker } from './death-markers.js?realm=178';
import { removeCitizenFromWorld } from './citizen-ownership.js?realm=178';

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
    id: 'migration',
    name: '🚶 Migration Wave',
    desc: 'Refugees arrive seeking shelter! +5 settlers.',
    duration: 0,
    color: '#4ade80',
    positive: true,
    canFire: () => G.maxPop - G.population >= 1,
    onStart() {
      const count = Math.min(5, G.maxPop - G.population);
      if (count > 0) trySpawnSettlers(count);
    },
    onEnd() {},
    // Loop 033 (the-fixer, closing 021 audit): migration previously had
    // an empty endMsg, so an event that DID do something (+5 settlers)
    // ended silently. Closing beat matches the tone of the duration>0
    // events (drought/plague/festival etc.) which all narrate their
    // endings. Other duration:0 events still have empty endMsg — that's
    // a broader pattern question deferred to a future tick (see 033
    // journal).
    endMsg: '🚶 The newcomers have settled in. Their foreign accents are fading already.',
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
    canFire: () => G.buildings.length > 0,
    onStart() {
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
  {
    id: 'blessed_harvest',
    name: '🌾 Blessed Harvest',
    desc: 'A blessing! Food production doubled for 2 days.',
    duration: 2,
    color: '#4ade80',
    positive: true,
    onStart() { G.eventModifiers.foodProd = 2; },
    onEnd()   { G.eventModifiers.foodProd = 1; },
    endMsg:   '🌾 The blessed harvest ends. Food production returns to normal.',
  },
  {
    id: 'winter_storm',
    name: '❄️ Winter Storm',
    desc: 'A brutal storm! Food production halved for 3 days.',
    duration: 3,
    color: '#93c5fd',
    positive: false,
    onStart() { G.eventModifiers.foodProd = 0.5; },
    onEnd()   { G.eventModifiers.foodProd = 1; },
    endMsg:   '❄️ The winter storm passes. Food production restored.',
  },
  {
    id: 'royal_visit',
    name: '👑 Royal Visit',
    desc: 'A royal ambassador visits! +50 gold tribute.',
    duration: 0,
    color: '#ffd166',
    positive: true,
    onStart() { G.resources.gold += 50; },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'bandit_raid',
    name: '🗡️ Bandit Raid',
    desc: 'Bandits steal resources! −30 gold, −20 food.',
    duration: 0,
    color: '#ef4444',
    positive: false,
    onStart() {
      G.resources.gold = Math.max(0, G.resources.gold - 30);
      G.resources.food = Math.max(0, G.resources.food - 20);
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'rainstorm',
    name: '🌧️ Rain',
    desc: 'Rain falls over the settlement.',
    duration: 2,
    color: '#60a5fa',
    positive: true,
    onStart() { G.weather = 'rain'; },
    onEnd()   { G.weather = 'clear'; },
    endMsg:   '🌧️ The rain stops. Skies clear.',
  },
  {
    id: 'fire',
    name: '🔥 Fire!',
    desc: 'A building catches fire! Act fast or it will burn down.',
    duration: 0,
    color: '#f97316',
    positive: false,
    canFire: () => G.buildings.some(b => ['house','tavern','bakery','lumber','windmill'].includes(b.type)),
    onStart() {
      const flammable = G.buildings.filter(b => ['house','tavern','bakery','lumber','windmill'].includes(b.type));
      const b = flammable[Math.floor(rng() * flammable.length)];
      b.onFire = true;
      b._fireTimer = 0;
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'plague',
    name: '☠️ Plague!',
    desc: 'A plague sweeps through the settlement! −1–2 citizens, movement slowed for 3 days.',
    duration: 3,
    color: '#a855f7',
    positive: false,
    // Need at least 2 citizens for plague to actually claim one — the
    // last-survivor cap below would otherwise leave losses=0 and the
    // toast would lie about "1-2 deaths" while no one died.
    canFire: () => G.citizens.length > 1,
    onStart() {
      // Deep-play (cycle 71) caught: old code always took 2 (contradicting the
      // "−1–2" description) AND deaths were silent — population quietly dropped
      // 2 while G.stats.citizensDied stayed at 0 and the chronicle never named
      // the fallen. Cycle 49 fixed the same class of bug for combat deaths;
      // this brings plague to parity.
      const intent = 1 + Math.floor(rng() * 2); // 1 or 2
      // Always leave at least one survivor. Plague should be a setback,
      // not a wipe — with a 2-citizen settlement, intent=2 would have
      // hit population zero and tripped realm_fell mid-event.
      const losses = Math.max(0, Math.min(intent, G.citizens.length - 1));
      for (let i = 0; i < losses; i++) {
        const c = G.citizens.at(-1);
        if (!c) continue;
        removeCitizenFromWorld(c);
        if (G.stats) G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;
        G.lastDeathDay = G.day;  // Loop 242 (241 pessimist HIGH fix): plague is a death site too
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -20,
          text: `🪦 ${c.identity.name}`,
          alpha: 2.0, vy: -0.25, decay: 0.012, type: 'text',
          color: '#a855f7',
        });
        // Loop 77: persistent gravestone at actual death tile for plague victims too
        recordDeathMarker({ x: c.x, y: c.y, name: c.identity.name, cause: 'plague' });
        try { chronicle(`${c.identity.name} succumbed to the plague. The healer could do nothing.`, 'death'); } catch(_e){}
        playSound('death');
      }
      G.eventModifiers.speedMult = 0.7;
    },
    onEnd() { G.eventModifiers.speedMult = 1; },
    endMsg: '☠️ The plague subsides. Citizens recover.',
  },
  {
    id: 'stranger_trade',
    name: '🤝 A Stranger Arrives',
    desc: 'A cloaked traveler offers a trade: 20 food for 15 iron. You accept.',
    duration: 0,
    color: '#c084fc',
    positive: true,
    onStart() {
      if (G.resources.food >= 20) {
        G.resources.food -= 20;
        G.resources.iron += 15;
        try { chronicle('A cloaked stranger arrived at dawn, trading iron for food. They vanished by nightfall.', 'event'); } catch(_e){}
      } else {
        G.resources.iron += 5;
        try { chronicle('A cloaked stranger visited but we had little to offer. They left a small gift of iron.', 'event'); } catch(_e){}
      }
    },
    onEnd() {},
    endMsg: '',
  },
  {
    id: 'bard_song',
    name: '🎵 The Bard Plays',
    desc: 'A wandering bard lifts spirits with song! +15 happiness for 2 days.',
    duration: 2,
    color: '#c084fc',
    positive: true,
    onStart() {
      G.eventModifiers.happinessOffset = 15;
      try { chronicle('A bard arrived and sang tales of heroism. The realm rejoiced.', 'character'); } catch(_e){}
    },
    onEnd() { G.eventModifiers.happinessOffset = 0; },
    endMsg: '🎵 The bard departs, promising to return.',
  },
  {
    id: 'rival_demand',
    name: '🏴 Rival Lord\'s Demand',
    desc: 'A rival lord demands tribute: −20 gold or face a raid sooner.',
    duration: 0,
    color: '#ef4444',
    positive: false,
    onStart() {
      if (G.resources.gold >= 20) {
        G.resources.gold -= 20;
        try { chronicle('A rival lord sent emissaries demanding gold. We paid to keep the peace.', 'event'); } catch(_e){}
      } else {
        G.nextRaidDay = Math.min(G.nextRaidDay, G.day + 2);
        try { chronicle('A rival lord demanded tribute we could not pay. War looms closer.', 'raid'); } catch(_e){}
      }
    },
    onEnd() {},
    endMsg: '',
  },
];

export function checkRandomEvents() {
  // Only fire at day transitions, skip early game
  if (G.day < 4) return;
  // Loop 356 (the-fixer, 355 [code] filing): skip random-event rolls
  // when probe-harness has set G.debug.disableEvents = true. Lets
  // active events still expire normally (caller below). Analog to
  // nextRaidDay=9999 (raid-suppress); closes 355 pessimist finding
  // where 240-day fastForward + raid-suppress STILL hit realm_fell
  // via drought/plague before reaching long-day beat gates.
  if (G.debug?.disableEvents && !G.activeEvent) return;
  if (G.activeEvent) {
    // Check if active event expired
    if (G.activeEvent.endDay <= G.day) {
      const def = EVENT_DEFS.find(e => e.id === G.activeEvent.id);
      def?.onEnd();
      const endMsg = def?.endMsg;
      if (endMsg) announce(endMsg, def.positive ? 'event' : 'danger', { chronicle: false });
      G.activeEvent = null;
      emit('realm-event', { id: null });
    }
    return; // one event at a time
  }

  // 8% chance per day
  if (rng() > 0.08) return;

  // Only consider events whose preconditions are currently satisfied.
  // Events without `canFire` are always eligible. Picking from the eligible
  // set (instead of rolling-and-skipping on the full pool) avoids the
  // "fire toast but nothing burns" UX bug when no flammable buildings exist.
  const eligible = EVENT_DEFS.filter(e => !e.canFire || e.canFire());
  if (eligible.length === 0) return;
  const def = eligible[rngInt(0, eligible.length - 1)];
  G.activeEvent = {
    id: def.id,
    name: def.name,
    desc: def.desc,
    color: def.color,
    positive: def.positive,
    endDay: G.day + def.duration,
  };
  def.onStart();
  emit('realm-event', { id: def.id, positive: def.positive });

  // Sound: wind chimes for positive, raid drums for negative
  playSound(def.positive ? 'season' : 'raidWarning');

  announce(`📢 Event: ${def.name} — ${def.desc}`, def.positive ? 'event' : 'danger', { chronicle: false });
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
