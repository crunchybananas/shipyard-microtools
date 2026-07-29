// ════════════════════════════════════════════════════════════
// Sim — the deterministic core tick (ENGINE.md rules 1–5).
//
// coreTick() advances the simulation by exactly ONE tick: the clock,
// every core actor system, production, research, and the tick-gated
// core checks (missions, eras, scenarios, wonder). It must stay
// headless: no DOM, no canvas, no audio, no wall clock, no
// Math.random — effects leave through the bus, randomness through the
// seeded rng(). The shell (main.js) decides how many ticks run per
// frame and runs its own ambient/UI work alongside.
//
// The Node determinism harness drives this function directly; anything
// added here MUST pass verify-core-purity + verify-determinism.
// ════════════════════════════════════════════════════════════

import { G, updateSeason, getSeasonData } from './state.js?realm=166';
import { updateCitizens } from './citizens.js?realm=166';
import { updateAvatar } from './avatar.js?realm=166';
import { updateSoldiers } from './soldiers.js?realm=166';
import { updateEnemies, updateProjectiles, updateTowers } from './combat.js?realm=166';
import { updateWalkers } from './walkers.js?realm=166';
import { updateProduction, checkRaids, collectTaxes, updateFires } from './economy.js?realm=166';
import { checkMissions } from './missions.js?realm=166';
import { updateResearch, checkEraAdvance } from './tech.js?realm=166';
import { updateWonder } from './wonder.js?realm=166';
import { checkRandomEvents } from './events.js?realm=166';
import { checkScenarioComplete } from './scenarios.js?realm=166';
import { chronicle, announce, sfx } from './log.js?realm=166';
import { emit } from './bus.js?realm=166';
import { checkStoryBeats } from './story.js?realm=166';
import { updateRaidSummary } from './raid-summary.js?realm=166';

// ── Day/Night clock (moved from main.js updateTime) ─────────────────
function tickClock() {
  G.dayPhase += 1; // one tick = one unit of day-time (ENGINE.md rule 5)
  if (G.dayPhase < G.dayLength) return;
  G.dayPhase = 0;
  G.day++;
  if (G.stats) G.stats.daysLived++;
  // Bell toll at dawn if church exists
  sfx('bellToll');
  collectTaxes();
  checkRaids();
  // Note: raidsSurvived increments inside checkRaids() only when the
  // player had defenses at the moment of raid-spawn (Loop 014).
  checkRandomEvents();
  if (updateSeason()) {
    const s = getSeasonData();
    const seasonNum = Math.floor((G.day - 1) / 7) + 1;
    // Loop 070: {chronicle:false} — the direct chronicle() below IS the
    // narrative memory; the announcement is ephemeral UX.
    announce(`${s.name} begins! (Season ${seasonNum})`, 'event', { chronicle: false });
    sfx('mission');
    // Loop 265: season prose pools, picked by G.day so consecutive
    // seasons see different variants (deterministic — saved state).
    const seasonTextPools = {
      spring: [
        'The snows melt. Green shoots push through the thawing earth.',
        'The first warm rain comes. The earth breathes again.',
        'Spring arrives. The realm wakes to birdsong.',
      ],
      summer: [
        'Long days and warm winds. The fields grow golden.',
        'The shadows lean long. The noonday sun holds the realm in amber.',
        'Summer is fully arrived. Bees move thick between the blossoms.',
      ],
      autumn: [
        'Leaves turn amber and crimson. The harvest is upon us.',
        'The wind sharpens. Smoke from harvest fires drifts low across the fields.',
        'Autumn comes. The realm gathers what summer made.',
      ],
      winter: [
        'Frost grips the land. Fires burn low in every hearth.',
        'The first deep cold settles. The realm pulls inward.',
        'Winter holds the realm. Snow muffles every footfall.',
      ],
    };
    const pool = seasonTextPools[G.season];
    const seasonText = pool ? pool[((G.day % pool.length) + pool.length) % pool.length] : `${s.name} begins.`;
    chronicle(seasonText, 'season');
    // Celebration particles are cosmetic — the shell renders them.
    emit('season-changed', { season: G.season, seasonNum });
  }
}

function checkScenarioVictory() {
  if (G._scenarioWon) return;
  if (!checkScenarioComplete()) return;
  G._scenarioWon = true;
  if (!G.stats.scenariosWon.includes(G.scenario)) G.stats.scenariosWon.push(G.scenario);
  emit('scenario-won', { id: G.scenario });
}

// One tick of simulation. G.speed must never appear in here or below
// here — the shell multiplies TICK COUNT, not per-tick deltas.
export function coreTick() {
  G.gameTick++;
  const t = G.gameTick;
  for (const system of CORE_SYSTEMS) {
    if (!system.every || t % system.every === 0) system.run();
  }
}

// This is executable order, not documentation. runtime-contract.json is the
// authoritative contract and verify-module-graph.mjs compares this exported
// sequence to it. Reordering or adding a system therefore requires an explicit
// coreSystemOrderVersion change.
const CORE_SYSTEMS = Object.freeze([
  { id: 'advance-clock', run: tickClock },
  { id: 'avatar', run: updateAvatar },
  { id: 'citizens', run: updateCitizens },
  { id: 'soldiers', run: updateSoldiers },
  { id: 'enemies', run: updateEnemies },
  { id: 'towers', run: updateTowers },
  { id: 'projectiles', run: updateProjectiles },
  { id: 'walkers', run: updateWalkers },
  { id: 'production', run: updateProduction },
  { id: 'fires', run: updateFires },
  { id: 'research', run: updateResearch },
  { id: 'missions@60', every: 60, run: checkMissions },
  { id: 'era@60', every: 60, run: checkEraAdvance },
  { id: 'scenario@120', every: 120, run: checkScenarioVictory },
  { id: 'wonder@720', every: 720, run: updateWonder },
  { id: 'raid-summary', run: updateRaidSummary },
  { id: 'story@60', every: 60, run: checkStoryBeats },
]);

export const CORE_SYSTEM_ORDER = Object.freeze(CORE_SYSTEMS.map(system => system.id));

// Direct graph-coherence probe used by the determinism gate. Returning the
// reference makes a split state.js URL identity observable instead of letting
// another tick-0 false positive pass.
export function coreStateIdentity() { return G; }
