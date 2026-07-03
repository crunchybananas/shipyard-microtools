// Core-purity gate (ENGINE.md rules 1–2, Phase 2b).
//
// Static checks over the CORE tier:
//   1. Core files must not contain platform/wall-clock/unseeded-random
//      tokens (document, window, localStorage, Math.random, Date.now,
//      performance.now, setTimeout, requestAnimationFrame, …).
//   2. Core files may import ONLY other core files.
//   3. Shell files must not import the seeded rng family (calling rng()
//      from frame-rate-dependent code would desync the stream).
//
// Usage: node docs/realm/scripts/verify-core-purity.mjs
// Exits 1 on any violation — run before committing engine changes.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS = join(__dirname, '..', 'js');

const CORE = new Set([
  'state.js', 'world.js', 'pathfinding.js', 'citizens.js', 'soldiers.js',
  'combat.js', 'walkers.js', 'economy.js', 'events.js', 'tech.js',
  'trade.js', 'wonder.js', 'scenarios.js', 'missions.js', 'sim.js',
  'commands.js', 'bus.js', 'log.js', 'fx.js', 'avatar.js',
]);

const BANNED = [
  [/\bdocument\b/, 'document'],
  [/\bwindow\b/, 'window'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bnavigator\b/, 'navigator'],
  [/\brequestAnimationFrame\b/, 'requestAnimationFrame'],
  [/\bsetTimeout\b/, 'setTimeout'],
  [/\bsetInterval\b/, 'setInterval'],
  [/\bMath\.random\b/, 'Math.random'],
  [/\bDate\.now\b/, 'Date.now'],
  [/\bperformance\.now\b/, 'performance.now'],
  [/\bnew Date\b/, 'new Date'],
  [/\binnerWidth\b/, 'innerWidth'],
  [/\bgetElementById\b/, 'getElementById'],
];

// Strip comments and string CONTENTS (quotes kept) so prose mentioning
// "window" or emoji strings never trips the gate.
function stripInert(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  out = out.replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  out = out.replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
  out = out.replace(/`(?:[^`\\]|\\.)*`/g, '``');
  return out;
}

const importRe = /from\s+['"]\.\/([A-Za-z0-9_-]+\.js)(?:\?[^'"]*)?['"]/g;

let failures = 0;
const files = readdirSync(JS).filter(f => f.endsWith('.js'));

for (const f of files) {
  const raw = readFileSync(join(JS, f), 'utf8');
  const src = stripInert(raw);

  if (CORE.has(f)) {
    for (const [re, name] of BANNED) {
      const m = src.match(re);
      if (m) {
        // report first offending line number from the raw file
        const idx = src.search(re);
        const line = src.slice(0, idx).split('\n').length;
        console.error(`✗ ${f}:${line} core file uses banned token '${name}'`);
        failures++;
      }
    }
    for (const m of raw.matchAll(importRe)) {
      if (!CORE.has(m[1])) {
        console.error(`✗ ${f} (core) imports shell file '${m[1]}'`);
        failures++;
      }
    }
  } else {
    // Shell tier: never consume the seeded stream.
    for (const m of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/state\.js/g)) {
      const names = m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]);
      const bad = names.filter(n => n === 'rng' || n === 'rngInt' || n === 'rngRange');
      if (bad.length) {
        console.error(`✗ ${f} (shell) imports seeded RNG (${bad.join(', ')}) — would desync the stream`);
        failures++;
      }
    }
  }
}

if (failures) {
  console.error(`\n[core-purity] FAILED — ${failures} violation${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`[core-purity] OK — ${CORE.size} core files clean, ${files.length - CORE.size} shell files rng-free`);
