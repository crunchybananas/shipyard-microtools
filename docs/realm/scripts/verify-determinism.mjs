// Golden-master determinism gate (ENGINE.md Phase 2c).
//
// Boots the CORE headless in Node — no DOM, no canvas, zero bus
// subscribers — runs 12 game-days of coreTick() with a scripted
// command log, and hashes the sim-relevant state. The gate holds when:
//   • two runs with the same seed produce IDENTICAL hashes, and
//   • a different seed produces a DIFFERENT hash.
// Same seed + same command log → identical state is the property that
// makes multiplayer sync verifiable and the native port testable.
//
// Each run executes in a child process because G is module-level state
// (one coherent module graph per process).
//
// Usage: node docs/realm/scripts/verify-determinism.mjs

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// ── Child mode: actually run the sim ────────────────────────────────
if (process.env.REALM_DET_CHILD) {
  const seed = Number(process.env.REALM_DET_SEED);
  const { createHash } = await import('node:crypto');
  const { G, setSeed, getSeed } = await import('../js/state.js?realm=128');
  const { generateWorld } = await import('../js/world.js?realm=128');
  const { coreTick } = await import('../js/sim.js?realm=128');
  const { dispatch } = await import('../js/commands.js?realm=128');
  const { canPlace } = await import('../js/economy.js?realm=128');
  const { initChronicle } = await import('../js/log.js?realm=128');

  setSeed(seed);
  generateWorld();
  initChronicle();
  G.resources = { wood: 500, stone: 500, food: 500, gold: 500, iron: 50, wheat: 0, flour: 0, planks: 0, tools: 0 };

  // Deterministic placement helper: spiral out from map center, first
  // legal tile wins. Same seed → same map → same spot.
  const CX = 40, CY = 40;
  function findSpot(type) {
    for (let r = 0; r < 25; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (canPlace(type, CX + dx, CY + dy)) return { x: CX + dx, y: CY + dy };
        }
      }
    }
    return null;
  }

  const script = [
    { at: 10,   type: 'house' },
    { at: 40,   type: 'house' },
    { at: 90,   type: 'farm' },
    { at: 140,  type: 'lumber' },
    { at: 200,  type: 'well' },
    { at: 260,  type: 'granary' },
    { at: 400,  type: 'quarry' },
    { at: 900,  research: 'masonry' },
    { at: 1200, type: 'market' },
    { at: 5000, research: 'commerce' },
    { at: 9000, type: 'tavern' },
  ];

  const TICKS = 12 * G.dayLength; // 12 game-days: crosses events (day 4+) and raids (day 8)
  const applied = [];
  for (let t = 1; t <= TICKS; t++) {
    for (const cmd of script) {
      if (cmd.at !== t) continue;
      let res;
      if (cmd.type) {
        const spot = findSpot(cmd.type);
        res = spot ? dispatch({ type: 'PLACE_BUILDING', building: cmd.type, x: spot.x, y: spot.y }) : { ok: false, reason: 'no-spot' };
      } else {
        res = dispatch({ type: 'START_RESEARCH', tech: cmd.research });
      }
      applied.push(`${t}:${cmd.type || cmd.research}:${res.ok ? 'ok' : res.reason}`);
    }
    coreTick();
  }

  // ── Hash the sim-relevant state ────────────────────────────────────
  // Excluded on purpose: particles (cosmetic), chronicle/notificationLog
  // (narrative text, host-owned in MP), storyFlags/namedCharacters
  // (written by shell-side story beats), fog (derived; summarized as a
  // count), camera (client-local), tileWear (cosmetic).
  function stable(v) {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
      return o;
    }
    return v;
  }
  const snapshot = {
    seed: getSeed(),
    tick: G.gameTick, day: G.day, dayPhase: G.dayPhase,
    resources: G.resources,
    population: G.population, maxPop: G.maxPop,
    happiness: G.happiness, defense: G.defense,
    era: G.era, won: G.won,
    nextRaidDay: G.nextRaidDay, raidInterval: G.raidInterval,
    fogOpen: G.fog.flat().filter(Boolean).length,
    buildings: G.buildings.map(b => [b.type, b.x, b.y, +b.hp.toFixed(4), b.level || 1, b.prodTimer, (b.workers || []).length, +(b.buildProgress ?? 1).toFixed(4)]),
    citizens: G.citizens.map(c => [+c.x.toFixed(4), +c.y.toFixed(4), c.state, Math.round(c.hunger), c.carrying || '', c.carryAmount || 0]),
    soldiers: G.soldiers.map(s => [s.type, +s.x.toFixed(4), +s.y.toFixed(4), s.hp]),
    enemies: G.enemies.map(e => [+e.x.toFixed(4), +e.y.toFixed(4), e.hp, e.state]),
    walkers: G.walkers.length,
    caravans: G.caravans.map(c => [c.phase, +c.x.toFixed(4), +c.y.toFixed(4), c.gold]),
    techs: [...G.researchedTechs].sort(),
    research: G.currentResearch ? [G.currentResearch.techId, Math.round(G.currentResearch.progress)] : null,
    event: G.activeEvent ? [G.activeEvent.id, G.activeEvent.endDay] : null,
    modifiers: G.eventModifiers,
    wonder: G.wonder,
    stats: { born: G.stats.citizensBorn, died: G.stats.citizensDied, raids: G.stats.raidsFaced, gold: G.stats.goldEarned },
    commands: (G._commandLog || []).length,
    applied,
  };
  const json = JSON.stringify(stable(snapshot));
  const hash = createHash('sha256').update(json).digest('hex');
  console.log(JSON.stringify({ hash, tick: G.gameTick, day: G.day, pop: G.population, buildings: G.buildings.length, applied }));
  process.exit(0);
}

// ── Parent mode: orchestrate three runs and compare ─────────────────
function run(seed) {
  const r = spawnSync(process.execPath, [__filename], {
    env: { ...process.env, REALM_DET_CHILD: '1', REALM_DET_SEED: String(seed) },
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (r.status !== 0) {
    console.error(`[determinism] child (seed ${seed}) failed:\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  const line = r.stdout.trim().split('\n').pop();
  return JSON.parse(line);
}

console.log('[determinism] run A (seed 12345)…');
const a = run(12345);
console.log(`  day ${a.day}, pop ${a.pop}, ${a.buildings} buildings, cmds: ${a.applied.join(' | ')}`);
console.log('[determinism] run B (seed 12345, repeat)…');
const b = run(12345);
console.log('[determinism] run C (seed 99999, control)…');
const c = run(99999);

let failed = false;
if (a.hash === b.hash) {
  console.log(`✓ same seed + same commands → identical hash (${a.hash.slice(0, 16)}…)`);
} else {
  console.error('✗ REPLAY DIVERGENCE: identical runs produced different hashes');
  console.error(`  A: ${a.hash}\n  B: ${b.hash}`);
  failed = true;
}
if (a.hash !== c.hash) {
  console.log('✓ different seed → different hash (control)');
} else {
  console.error('✗ CONTROL FAILURE: different seeds produced the same hash — hash is not sensitive');
  failed = true;
}
if (failed) { console.error('[determinism] FAILED'); process.exit(1); }
console.log('[determinism] OK — core is headless and deterministic');
