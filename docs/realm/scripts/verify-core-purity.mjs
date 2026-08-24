// Core-purity gate (ENGINE.md rules 1–2, Phase 2b).
//
// Static checks over the CORE tier:
//   1. Core files must not contain platform/wall-clock/unseeded-random
//      tokens (document, window, localStorage, Math.random, Date.now,
//      performance.now, setTimeout, requestAnimationFrame, …).
//   2. Core files may import ONLY other core files.
//   3. Shell files must not import the seeded rng family (calling rng()
//      from frame-rate-dependent code would desync the stream).
//   4. Core presentation descriptors/scheduling must not consume seeded RNG.
//
// Usage: node docs/realm/scripts/verify-core-purity.mjs
// Exits 1 on any violation — run before committing engine changes.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS = join(__dirname, '..', 'js');

const CORE = new Set([
  'state.js', 'world.js', 'pathfinding-kernel.js', 'pathfinding-service.js',
  'pathfinding.js', 'ground-traffic.js', 'citizens.js', 'soldiers.js',
  'combat.js', 'walkers.js', 'economy.js', 'events.js', 'tech.js',
  'trade.js', 'wonder.js', 'scenarios.js', 'missions.js', 'sim.js',
  'commands.js', 'bus.js', 'log.js', 'fx.js', 'avatar.js', 'military.js',
  'story.js', 'raid-summary.js', 'first-muster.js', 'post-raid-recovery.js',
  'raid-targeting.js',
  'building-lifecycle.js', 'building-operation.js', 'citizen-ownership.js',
  'building-inventory.js', 'building-use.js', 'army-orders.js', 'residences.js',
  'workforce-policy.js', 'death-markers.js', 'company-supply.js',
  'citizen-activity.js', 'citizen-navigation.js', 'citizen-traffic.js',
  'citizen-work.js', 'citizen-shelter.js', 'citizen-food.js', 'citizen-needs.js',
  'citizen-route-state.js',
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

function shellSeededRngViolations(raw) {
  const src = stripInert(raw);
  const violations = [];
  if (/\b(?:rng|rngInt|rngRange)\s*\(/.test(src)) violations.push('bare seeded RNG call');
  if (/\.\s*(?:rng|rngInt|rngRange)\s*\(/.test(src)) violations.push('namespace seeded RNG call');
  if (/import\s*\*\s*as\s+[A-Za-z_$][A-Za-z0-9_$]*\s*from\s*['"]\.\/state\.js/.test(raw)) {
    violations.push('namespace import from state.js');
  }
  if (/import\s*\(\s*['"]\.\/state\.js(?:\?[^'"]*)?['"]\s*\)/.test(raw)) {
    violations.push('dynamic import of state.js');
  }
  for (const match of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/state\.js/g)) {
    const names = match[1].split(',').map(value => value.trim().split(/\s+as\s+/)[0]);
    const seeded = names.filter(name => name === 'rng' || name === 'rngInt' || name === 'rngRange');
    if (seeded.length) violations.push(`named seeded RNG import (${seeded.join(', ')})`);
  }
  return violations;
}

function matchingClose(src, openIndex, open, close) {
  let depth = 0;
  for (let index = openIndex; index < src.length; index++) {
    if (src[index] === open) depth++;
    else if (src[index] === close && --depth === 0) return index;
  }
  return -1;
}

function seededCallNames(raw) {
  const names = new Set(['rng', 'rngInt', 'rngRange']);
  for (const match of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/state\.js/g)) {
    for (const specifier of match[1].split(',')) {
      const [imported, local = imported] = specifier.trim().split(/\s+as\s+/);
      if (imported === 'rng' || imported === 'rngInt' || imported === 'rngRange') names.add(local);
    }
  }
  return names;
}

function presentationCallNames(raw) {
  const names = new Set(['visualJitter', 'spawnDust', 'spawnClashFX']);
  for (const match of raw.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/fx\.js/g)) {
    for (const specifier of match[1].split(',')) {
      const [imported, local = imported] = specifier.trim().split(/\s+as\s+/);
      if (imported) names.add(local);
    }
  }
  return names;
}

function corePresentationSeededRngViolations(raw) {
  const src = stripInert(raw);
  const names = [...seededCallNames(raw)];
  const escaped = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const seededCall = new RegExp(`(?:\\b(?:${escaped.join('|')})|\\.\\s*(?:rng|rngInt|rngRange))\\s*\\(`);
  const particleCall = /G\.particles(?:\?\.)?\.push\s*\(/g;
  const presentationCalls = [...presentationCallNames(raw)]
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const presentationCall = new RegExp(`\\b(?:${presentationCalls})\\s*\\(`, 'g');
  const violations = [];
  const particleRanges = [];
  const scopeAt = new Int32Array(src.length);
  const scopeParents = [-1];
  const scopeStack = [0];
  for (let index = 0; index < src.length; index++) {
    if (src[index] === '{') {
      scopeParents.push(scopeStack[scopeStack.length - 1]);
      scopeStack.push(scopeParents.length - 1);
    }
    scopeAt[index] = scopeStack[scopeStack.length - 1];
    if (src[index] === '}' && scopeStack.length > 1) scopeStack.pop();
  }
  const scopeContains = (ancestor, child) => {
    for (let scope = child; scope >= 0; scope = scopeParents[scope]) {
      if (scope === ancestor) return true;
    }
    return false;
  };

  for (const match of src.matchAll(particleCall)) {
    const open = src.indexOf('(', match.index);
    const close = matchingClose(src, open, '(', ')');
    if (close < 0) continue;
    particleRanges.push([match.index, close + 1]);
    if (seededCall.test(src.slice(open + 1, close))) {
      violations.push('seeded RNG inside a particle descriptor');
    }
  }
  for (const match of src.matchAll(presentationCall)) {
    const open = src.indexOf('(', match.index);
    const close = matchingClose(src, open, '(', ')');
    if (close >= 0 && seededCall.test(src.slice(open + 1, close))) {
      violations.push('seeded RNG passed to a presentation/FX function');
    }
  }

  // Catch a seeded value staged in a local before it enters a descriptor,
  // plus sprite-only entity fields such as raider.variant.
  const tainted = [];
  for (const match of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;\n]+)/g)) {
    if (seededCall.test(match[2])) tainted.push({ name: match[1], scope: scopeAt[match.index] });
  }
  for (const [start, end] of particleRanges) {
    const descriptor = src.slice(start, end);
    for (const local of tainted) {
      if (scopeContains(local.scope, scopeAt[start]) &&
          new RegExp(`\\b${local.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(descriptor)) {
        violations.push(`seeded local '${local.name}' enters a particle descriptor`);
      }
    }
  }
  const presentationName = /\b(?:[A-Za-z0-9_$]*(?:particle|confetti|glint|spark|emote|visual)[A-Za-z0-9_$]*|variant)\b/iu;
  for (const match of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;\n]+)/g)) {
    if (presentationName.test(match[1]) && seededCall.test(match[2])) {
      violations.push(`presentation local '${match[1]}' consumes seeded RNG`);
    }
  }
  for (const match of src.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*:\s*([^,}\n]+)/g)) {
    if (!presentationName.test(match[1])) continue;
    if (seededCall.test(match[2])) {
      violations.push(`presentation field '${match[1]}' consumes seeded RNG`);
    }
    for (const local of tainted) {
      if (scopeContains(local.scope, scopeAt[match.index]) &&
          new RegExp(`\\b${local.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(match[2])) {
        violations.push(`seeded local '${local.name}' enters presentation field '${match[1]}'`);
      }
    }
  }
  for (const match of src.matchAll(/\b([A-Za-z0-9_$]*(?:particle|confetti|glint|spark|emote|visual|variant)[A-Za-z0-9_$]*)\s*=\s*([^;,\n]+)/giu)) {
    if (seededCall.test(match[2])) {
      violations.push(`presentation property '${match[1]}' consumes seeded RNG`);
    }
  }

  // A seeded decision may legitimately cause both gameplay mutation and a
  // descriptive particle (fire dousing is the canonical example). Reject
  // only seeded branches whose body does nothing except emit particles.
  for (const match of src.matchAll(/\bif\s*\(/g)) {
    const conditionOpen = src.indexOf('(', match.index);
    const conditionClose = matchingClose(src, conditionOpen, '(', ')');
    if (conditionClose < 0 || !seededCall.test(src.slice(conditionOpen + 1, conditionClose))) continue;
    let bodyStart = conditionClose + 1;
    while (/\s/.test(src[bodyStart] || '')) bodyStart++;
    let bodyEnd;
    if (src[bodyStart] === '{') bodyEnd = matchingClose(src, bodyStart, '{', '}');
    else bodyEnd = src.indexOf(';', bodyStart);
    if (bodyEnd < 0) continue;
    const body = src.slice(bodyStart === src.indexOf('{', bodyStart) ? bodyStart + 1 : bodyStart, bodyEnd);
    const calls = [];
    for (const particle of body.matchAll(particleCall)) {
      const open = body.indexOf('(', particle.index);
      const close = matchingClose(body, open, '(', ')');
      if (close >= 0) calls.push([particle.index, close + 1]);
    }
    if (!calls.length) continue;
    let remainder = body;
    for (const [start, end] of calls.reverse()) remainder = remainder.slice(0, start) + remainder.slice(end);
    if (!remainder.replace(/[;\s{}]/g, '')) {
      violations.push('seeded RNG controls a presentation-only particle branch');
    }
  }

  return [...new Set(violations)];
}

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
    if (/G\.particles(?:\?\.)?\.length/.test(src)) {
      console.error(`✗ ${f} (core) branches on shell-owned G.particles length`);
      failures++;
    }
    for (const violation of corePresentationSeededRngViolations(raw)) {
      console.error(`✗ ${f} (core) ${violation}`);
      failures++;
    }
  } else {
    // Shell tier: never consume the seeded stream.
    for (const violation of shellSeededRngViolations(raw)) {
      console.error(`✗ ${f} (shell) has ${violation} — would desync the simulation stream`);
      failures++;
    }
    if (f === 'enhancements.js') {
      if (/from\s+['"]\.\/(?:story|log)\.js/.test(raw)) {
        console.error('✗ enhancements.js imports authoritative story writers');
        failures++;
      }
      if (/G\.(?:storyFlags|storyState|namedCharacters|realmEnded)(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?\s*(?:=|\+=|-=|\+\+|--)/.test(src)) {
        console.error('✗ enhancements.js mutates authoritative story state');
        failures++;
      }
    }
  }
}

for (const [label, source] of [
  ['undefined bare call', 'const value = rng();'],
  ['aliased named import', "import { rng as visualRandom } from './state.js?realm=160';\nvisualRandom();"],
  ['namespace call', "import * as state from './state.js?realm=160';\nstate.rngInt(1, 2);"],
  ['dynamic state import', "const state = await import('./state.js?realm=160');\nstate['rng']();"],
]) {
  if (!shellSeededRngViolations(source).length) {
    console.error(`✗ shell RNG negative fixture escaped: ${label}`);
    failures++;
  }
}

for (const [label, source] of [
  ['direct particle descriptor', 'G.particles.push({ vx: rngRange(-1, 1) });'],
  ['presentation-only condition', 'if (rng() < 0.5) { G.particles.push({ type: "spark" }); }'],
  ['tainted descriptor local', 'const offset = rng(); G.particles.push({ vx: offset });'],
  ['presentation-named local', 'const sparklePhase = rng(); use(sparklePhase);'],
  ['sprite-only variant field', 'G.enemies.push({ variant: rngInt(0, 2) });'],
  ['tainted sprite-only field', 'const choice = rngInt(0, 2); G.enemies.push({ variant: choice });'],
  ['presentation property scheduler', 'citizen._hungerEmoteTimer = rngInt(0, 120);'],
  ['FX function argument', 'spawnDust(x + rng(), y);'],
]) {
  if (!corePresentationSeededRngViolations(source).length) {
    console.error(`✗ core presentation RNG negative fixture escaped: ${label}`);
    failures++;
  }
}
if (corePresentationSeededRngViolations(`
  if (rng() < 0.02) {
    building.onFire = false;
    G.particles.push({ text: 'Doused' });
  }
`).length) {
  console.error('✗ authoritative fire-outcome RNG was mistaken for presentation RNG');
  failures++;
}

if (failures) {
  console.error(`\n[core-purity] FAILED — ${failures} violation${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log(`[core-purity] OK — ${CORE.size} core files clean, ${files.length - CORE.size} shell files rng-free`);
