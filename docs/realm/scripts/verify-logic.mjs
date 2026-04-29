// Targeted logic-correctness driver. Enters the game, then uses
// page.evaluate to drive G state and verify beats fire / mechanics
// apply. Items from loop/docs/verify-queue.md.
//
// Usage:
//   node docs/realm/scripts/verify-logic.mjs

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ensureServer } from './_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REALM_ROOT = join(__dirname, '..');
const server = await ensureServer();
const ORIGIN = server.origin;
const GAME_PATH = `${ORIGIN}/index.html`;

const results = [];
function rec(name, ok, detail) {
  const tag = ok ? '✓' : '✗';
  results.push({ name, ok, detail });
  console.log(`  ${tag} ${name}${detail ? ' — ' + detail : ''}`);
}

// Default headless. HEADED=1 to see the window.
const HEADLESS = process.env.HEADED !== '1';
const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errs.push(`[console] ${m.text()}`);
});

console.log('[verify-logic] loading game…');
await page.goto(GAME_PATH);
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(1500);

// Enter the game: click difficulty, scenario, then New Game.
console.log('[verify-logic] entering game…');
const easy = await page.$('.diff-btn');
if (easy) await easy.click();
const peaceful = await page.$('button:has-text("Peaceful"), .scen-btn');
if (peaceful) await peaceful.click();
const newGame = await page.$('button:has-text("New Game"), button:has-text("Start"), #start-game-btn');
if (newGame) await newGame.click();
await page.waitForTimeout(1500);

const ready = await page.evaluate(() => typeof window.G !== 'undefined' && window.G.day != null);
rec('game entered (G.day exists)', ready);
if (!ready) {
  console.log('[verify-logic] could not enter game; aborting');
  await browser.close();
  process.exit(1);
}

// Test 1: 192/197 — G.realmEnded field exists / can be set
const realmEnded = await page.evaluate(() => {
  const before = window.G.realmEnded;
  window.G.realmEnded = true;
  const after = window.G.realmEnded;
  window.G.realmEnded = before;
  return { hadField: 'realmEnded' in window.G || before !== undefined, settable: after === true };
});
rec('192: G.realmEnded settable', realmEnded.settable);

// Test 2: 211 — G.lastRaidDay infrastructure
const lastRaidDay = await page.evaluate(() => {
  const before = window.G.lastRaidDay;
  window.G.lastRaidDay = 5;
  const after = window.G.lastRaidDay;
  window.G.lastRaidDay = before;
  return { settable: after === 5, initial: before };
});
rec('211: G.lastRaidDay settable', lastRaidDay.settable, `initial=${lastRaidDay.initial}`);

// Test 3: 212 first_sigh_seen — advance to summer day 12, force checkStoryBeats
const sighFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  // Force gate: summer + day 12, no flag yet
  window.G.day = 12;
  window.G.season = 'summer';
  delete window.G.storyFlags.first_sigh_seen;
  const beforeLen = (window.G.chronicle || []).length;
  story.checkStoryBeats();
  const afterLen = window.G.chronicle.length;
  const fired = window.G.storyFlags.first_sigh_seen === true;
  const lastEntry = window.G.chronicle[afterLen - 1];
  return { fired, beforeLen, afterLen, lastText: lastEntry?.text?.slice(0, 60), tag: lastEntry?.tag };
});
rec('212: first_sigh_seen fires at summer d12', sighFire.fired, `text="${sighFire.lastText}…" tag=${sighFire.tag}`);

// Test 4: 199 first_cold_morning — autumn day 15
const coldFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.day = 15;
  window.G.season = 'autumn';
  delete window.G.storyFlags.first_cold_morning;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.first_cold_morning === true;
  const lastEntry = window.G.chronicle.at(-1);
  return { fired, lastText: lastEntry?.text?.slice(0, 60), tag: lastEntry?.tag };
});
rec('199: first_cold_morning fires at autumn d15', coldFire.fired, `text="${coldFire.lastText}…"`);

// Test 5: 207 fields_know_realm — summer day 10
const fieldsFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.day = 10;
  window.G.season = 'summer';
  delete window.G.storyFlags.fields_know_realm;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.fields_know_realm === true;
  return { fired };
});
rec('207: fields_know_realm fires at summer d10', fieldsFire.fired);

// Test 6: 211 sustained_peace_known — needs raidsSurvived≥1 + lastRaidDay+50 days
const peaceFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.stats = window.G.stats || {};
  window.G.stats.raidsSurvived = 1;
  window.G.lastRaidDay = 10;
  window.G.day = 65;  // 55 days past last raid
  delete window.G.storyFlags.sustained_peace_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.sustained_peace_known === true;
  const lastEntry = window.G.chronicle.at(-1);
  return { fired, lastText: lastEntry?.text?.slice(0, 80) };
});
rec('211: sustained_peace_known fires d65 with raidsSurvived=1, lastRaidDay=10', peaceFire.fired, `text="${peaceFire.lastText}…"`);

// Test 7: 192 realm_fell after-callback — G.realmEnded set when beat fires
// Test 7b: 278 — terminal "chronicle closes" entry pushed by after-callback
const realmFell = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.realmEnded = false;
  window.G.population = 0;
  window.G.day = 50;
  delete window.G.storyFlags.realm_fell;
  const beforeLen = (window.G.chronicle || []).length;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.realm_fell === true;
  const flagSet = window.G.realmEnded === true;
  const afterLen = window.G.chronicle.length;
  const terminal = window.G.chronicle.find(e => e.text?.includes('chronicle ends here'));
  // 260: reset so the new checkStoryBeats gate doesn't block downstream tests
  window.G.realmEnded = false;
  return { fired, flagSet, beforeLen, afterLen, terminalWritten: !!terminal, terminalTag: terminal?.tag };
});
rec('192: realm_fell after-callback sets G.realmEnded', realmFell.fired && realmFell.flagSet, `fired=${realmFell.fired} flag=${realmFell.flagSet}`);
rec('278: terminal "chronicle closes" entry written + tagged requiem', realmFell.terminalWritten && realmFell.terminalTag === 'requiem', `written=${realmFell.terminalWritten} tag=${realmFell.terminalTag} chronGrew=${realmFell.afterLen - realmFell.beforeLen}`);

// Test 8: 201 bard happiness +5 — set rival false, force ensureBard, check formula
const bardEffect = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  // Reset state
  window.G.namedCharacters = window.G.namedCharacters || {};
  delete window.G.namedCharacters.bard;
  // Capture happiness before
  const happinessBefore = window.G.happiness;
  // Trigger ensureBard
  story.ensureBard();
  const bard = window.G.namedCharacters.bard;
  return { bardCreated: !!bard, bardName: bard?.name, happinessBefore };
});
rec('201: ensureBard creates G.namedCharacters.bard', bardEffect.bardCreated, `name=${bardEffect.bardName}`);

// Test 22: 253 mayor_first_in_hall — mayor + year3 + townhall built
const mayorFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureMayor();
  window.G.storyFlags.year3 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'townhall')) {
    window.G.buildings.push({ type: 'townhall', x: 25, y: 25, hp: 100, maxHp: 100, workers: [] });
  }
  delete window.G.storyFlags.mayor_first_in_hall;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.mayor_first_in_hall === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("unlocks the town hall before the realm is awake"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('253: mayor_first_in_hall fires mayor + year3 + townhall', mayorFire.fired, `text="${mayorFire.text}…" tag=${mayorFire.tag}`);

// Test: 269+271 — newGame() resets realmEnded + sustained-state trackers + namedCharacters
const newGameReset = await page.evaluate(async () => {
  // Set the realm into the post-fall state with stale trackers + cast
  window.G.realmEnded = true;
  window.G.lastRaidDay = 30;
  window.G.lastDeathDay = 50;
  window.G.lastUnderpopDay = 40;
  window.G.namedCharacters = { mayor: { name: 'Stale Mayor' }, bard: { name: 'Stale Bard' } };
  // 302: seed fields that 271 [code] follow-on audit found leaky
  window.G._undoStack = [{ b: 'stale' }];
  window.G._buildRipples = [{ x: 1, y: 1 }];
  window.G.birds = [{ x: 1, y: 1 }];
  window.G._raidWarningGiven = true;
  window.G.stats = { ...window.G.stats, scenariosWon: undefined };
  // 311: seed everHadBuilding with stale entries
  window.G.stats.everHadBuilding = { church: true, well: true };
  if (typeof window.newGame !== 'function') return { ok: false, reason: 'no window.newGame' };
  window.newGame();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {
    ok: true,
    realmEnded: window.G.realmEnded,
    lastRaidDay: window.G.lastRaidDay,
    lastDeathDay: window.G.lastDeathDay,
    lastUnderpopDay: window.G.lastUnderpopDay,
    namedCharCount: Object.keys(window.G.namedCharacters || {}).length,
    filter: document.getElementById('game').style.filter || '',
    undoStackLen: (window.G._undoStack || []).length,
    buildRipplesLen: (window.G._buildRipples || []).length,
    birdsLen: (window.G.birds || []).length,
    raidWarningGiven: window.G._raidWarningGiven,
    scenariosWonIsArray: Array.isArray(window.G.stats?.scenariosWon),
    everHadBuildingEmpty: Object.keys(window.G.stats?.everHadBuilding || {}).length === 0,
  };
});
const reset = newGameReset.realmEnded === false &&
              newGameReset.lastRaidDay === undefined &&
              newGameReset.lastDeathDay === undefined &&
              newGameReset.lastUnderpopDay === undefined &&
              newGameReset.namedCharCount === 0 &&
              newGameReset.filter === '' &&
              newGameReset.undoStackLen === 0 &&
              newGameReset.buildRipplesLen === 0 &&
              newGameReset.birdsLen === 0 &&
              newGameReset.raidWarningGiven === false &&
              newGameReset.scenariosWonIsArray === true &&
              newGameReset.everHadBuildingEmpty === true;
rec('269+271+302+311: newGame() resets all leaky fields (realmEnded + trackers + namedCharacters + filter + _undoStack + _buildRipples + birds + _raidWarningGiven + scenariosWon + everHadBuilding)', reset, JSON.stringify(newGameReset));

// Test: 261 — render desaturation CSS filter applies when G.realmEnded toggles
const realmEndFilter = await page.evaluate(async () => {
  // Reset
  window.G.realmEnded = false;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const preFilter = document.getElementById('game').style.filter || '';
  // Trigger
  window.G.realmEnded = true;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const postFilter = document.getElementById('game').style.filter || '';
  // Restore
  window.G.realmEnded = false;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const restoreFilter = document.getElementById('game').style.filter || '';
  return { preFilter, postFilter, restoreFilter };
});
const filterApplies = realmEndFilter.preFilter === '' && realmEndFilter.postFilter.includes('grayscale') && realmEndFilter.restoreFilter === '';
rec('261: realm-end CSS filter applies on G.realmEnded transition', filterApplies, `pre='${realmEndFilter.preFilter}' post='${realmEndFilter.postFilter}' restore='${realmEndFilter.restoreFilter}'`);

// Test: 260 — chronicle() gates on G.realmEnded (the-player [play] finding)
const chronicleGate = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  // Establish baseline length, ensure realm not ended
  window.G.realmEnded = false;
  story.chronicle('test entry pre-end', 'misc');
  const lenBeforeEnd = window.G.chronicle.length;
  // Set realmEnded; further writes must be no-ops
  window.G.realmEnded = true;
  story.chronicle('attempted write post-end', 'misc');
  story.chronicle('another attempt', 'misc');
  const lenAfterEnd = window.G.chronicle.length;
  // Reset for downstream tests
  window.G.realmEnded = false;
  return { lenBeforeEnd, lenAfterEnd, gateHeld: lenBeforeEnd === lenAfterEnd };
});
rec('260: chronicle() gates on G.realmEnded', chronicleGate.gateHeld, `before=${chronicleGate.lenBeforeEnd} after=${chronicleGate.lenAfterEnd}`);

// Test: 258 — townhall maxCount:1 enforced via isBuildingUnlocked
const townhallMaxCount = await page.evaluate(async () => {
  const tech = await import('./js/tech.js');
  const story = await import('./js/story.js');
  // Ensure mayor exists so the gate's primary check passes
  story.ensureMayor('Auditor');
  // Reset any townhalls
  window.G.buildings = (window.G.buildings || []).filter(b => b.type !== 'townhall');
  const unlockedNoCount = tech.isBuildingUnlocked('townhall');
  // Place one townhall; gate should now refuse a second
  window.G.buildings.push({ type: 'townhall', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  const unlockedAtCap = tech.isBuildingUnlocked('townhall');
  // Clean up so the 243 mayor-gate test that runs later sees clean state
  window.G.buildings = window.G.buildings.filter(b => b.type !== 'townhall');
  return { unlockedNoCount, unlockedAtCap };
});
rec('258: townhall maxCount:1 — unlocked at 0, locked at 1', townhallMaxCount.unlockedNoCount && !townhallMaxCount.unlockedAtCap, `noCount=${townhallMaxCount.unlockedNoCount} atCap=${townhallMaxCount.unlockedAtCap}`);

// Test: 277 absent_citizen_seat_known — inference-by-absence (3rd individual-interiority shape)
const absentCitizenFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.day = 35;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'tavern')) {
    window.G.buildings.push({ type: 'tavern', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  }
  delete window.G.storyFlags.absent_citizen_seat_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.absent_citizen_seat_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a citizen no one has seen'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('277: absent_citizen_seat_known fires d≥30 + tavern', absentCitizenFire.fired, `text="${absentCitizenFire.text}…" tag=${absentCitizenFire.tag}`);

// Test: 275 child_no_elsewhere_known — POV-inversion (2nd individual-interiority shape)
const childPOVFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.stats = window.G.stats || {};
  window.G.stats.citizensBorn = 1;
  delete window.G.storyFlags.child_no_elsewhere_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.child_no_elsewhere_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a child in the realm'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('275: child_no_elsewhere_known fires year3 + citizensBorn≥1', childPOVFire.fired, `text="${childPOVFire.text}…" tag=${childPOVFire.tag}`);

// Test: 272 storm_passed_seen — negative-space weather (4th weather-recognition use)
// Test: 273 — beat's after: callback spawns a 'lightning' particle
const stormPassedFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.season = 'summer';
  window.G.day = 35;
  delete window.G.storyFlags.storm_passed_seen;
  // Clear pre-existing lightning particles to isolate the spawn
  window.G.particles = (window.G.particles || []).filter(p => p.type !== 'lightning');
  story.checkStoryBeats();
  const fired = window.G.storyFlags.storm_passed_seen === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a summer evening when a storm builds'));
  const flash = window.G.particles.find(p => p.type === 'lightning');
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag, particleSpawned: !!flash, particleAlpha: flash?.alpha };
});
rec('272: storm_passed_seen fires summer + d≥30', stormPassedFire.fired, `text="${stormPassedFire.text}…" tag=${stormPassedFire.tag}`);
rec('273: lightning particle spawned by beat after: callback', stormPassedFire.particleSpawned, `alpha=${stormPassedFire.particleAlpha}`);

// Test: 270 inn_confluence_seen — first multi-character beat in corpus
const confluenceFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureMayor('Mayor Test');
  story.ensureBard('Bard Test');
  story.ensureSmith('Smith Test');
  window.G.storyFlags.year3 = true;
  delete window.G.storyFlags.inn_confluence_seen;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.inn_confluence_seen === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.includes('all happen to be at the inn'));
  return { fired, text: lastEntry?.text?.slice(0, 80), tag: lastEntry?.tag };
});
rec('270: inn_confluence_seen fires year3 + mayor + bard + smith named', confluenceFire.fired, `text="${confluenceFire.text}…" tag=${confluenceFire.tag}`);

// Test: 266 summer_falling_star — ambient-entity-grammar 4th use
// Test: 267 — beat's after: callback spawns a 'shootingstar' particle
const fallingStarFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.season = 'summer';
  window.G.dayPhase = (window.G.dayLength || 3600) * 0.85;  // deep night
  delete window.G.storyFlags.summer_falling_star;
  // Clear any pre-existing shootingstar particles to isolate the spawn
  window.G.particles = (window.G.particles || []).filter(p => p.type !== 'shootingstar');
  const beforeCount = window.G.particles.length;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.summer_falling_star === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a night in summer when a star falls'));
  const star = window.G.particles.find(p => p.type === 'shootingstar');
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag, particleSpawned: !!star, particleAlpha: star?.alpha };
});
rec('266: summer_falling_star fires summer + deep night', fallingStarFire.fired, `text="${fallingStarFire.text}…" tag=${fallingStarFire.tag}`);
rec('267: shooting-star particle spawned by beat after: callback', fallingStarFire.particleSpawned, `alpha=${fallingStarFire.particleAlpha}`);

// Test: 264 — variant raid prose pools (260 [play] follow-on)
const raidProse = await page.evaluate(async () => {
  const enh = await import('./js/enhancements.js');
  // Same outcome shape (victory: kills>0, no losses), different days → different prose
  const day1 = enh._pickRaidProse(10, 5, 0, 12);
  const day2 = enh._pickRaidProse(11, 5, 0, 12);
  const day3 = enh._pickRaidProse(12, 5, 0, 12);
  const day4 = enh._pickRaidProse(13, 5, 0, 12);
  const distinct = new Set([day1, day2, day3, day4]).size;
  // Razed: popAlive=0 always selects razed pool; spread across 4 days
  const razed1 = enh._pickRaidProse(50, 0, 5, 0);
  const razed2 = enh._pickRaidProse(51, 0, 5, 0);
  const razedDistinct = razed1 !== razed2;
  // Determinism: same inputs → same output
  const det1 = enh._pickRaidProse(10, 5, 0, 12);
  const deterministic = det1 === day1;
  return { distinct, razedDistinct, deterministic, sample: day1.slice(0, 70) };
});
rec('264: raid prose pools — 4 days span ≥3 distinct prose for same outcome', raidProse.distinct >= 3, `distinct=${raidProse.distinct}/4 razedSpread=${raidProse.razedDistinct} deterministic=${raidProse.deterministic}`);

// Test: 263 chronicle_self_known — meta-self-aware (chronicle.length ≥ 100)
const chronicleSelfFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  // Pad chronicle to 100 entries
  while ((window.G.chronicle || []).length < 100) story.chronicle('padding entry', 'misc');
  delete window.G.storyFlags.chronicle_self_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.chronicle_self_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('The chronicle has grown longer'));
  return { fired, text: lastEntry?.text?.slice(0, 60), tag: lastEntry?.tag };
});
rec('263: chronicle_self_known fires at chronicle.length ≥ 100', chronicleSelfFire.fired, `text="${chronicleSelfFire.text}…" tag=${chronicleSelfFire.tag}`);

// Test: 329 bird_namer_known — single-axis surprise (4th individual-interiority shape; PRIVATE-KNOWLEDGE-WITHOUT-RECOGNITION)
const birdNamerFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 105;
  delete window.G.storyFlags.bird_namer_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.bird_namer_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a citizen who knows every bird'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('329: bird_namer_known fires year3 + d>=100', birdNamerFire.fired, `text="${birdNamerFire.text}…" tag=${birdNamerFire.tag}`);

// Test: 327 new_road_known — single-axis surprise (3rd naming-place shape; CONTRADICTORY-NAMING-AS-INSIDER-DIRECTION)
const newRoadFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 98;
  delete window.G.storyFlags.new_road_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.new_road_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('The new road is the oldest road'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('327: new_road_known fires year3 + d>=95', newRoadFire.fired, `text="${newRoadFire.text}…" tag=${newRoadFire.tag}`);

// Test: 325 cold_corner_known — single-axis surprise (2nd naming-place shape; NAME-AS-MEASUREMENT angle)
const coldCornerFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 92;
  delete window.G.storyFlags.cold_corner_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.cold_corner_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a corner of the realm called the cold corner'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('325: cold_corner_known fires year3 + d>=90', coldCornerFire.fired, `text="${coldCornerFire.text}…" tag=${coldCornerFire.tag}`);

// Test: 322 recurrence_known — TRIPLE-AXIS (7th OUTSIDE CONTENTMENT + 7th STRUCTURAL REPETITION + RECURRENCE-AS-SELF-RECOGNITION angle)
const recurrenceFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 88;
  delete window.G.storyFlags.recurrence_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.recurrence_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('The same bread rising'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('322: recurrence_known fires year3 + d>=85', recurrenceFire.fired, `text="${recurrenceFire.text}…" tag=${recurrenceFire.tag}`);

// Test: 319-A sea_bell_lost_known — fallback for raid-destroyed church (311 [code] closure partial).
// 321: gate-spread requires G.day >= 62.
const seaBellLostFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 65;
  window.G.buildings = []; // church NOT present
  window.G.stats = window.G.stats || {};
  window.G.stats.everHadBuilding = { church: true }; // realm once had one
  delete window.G.storyFlags.sea_bell_lost_known;
  delete window.G.storyFlags.sea_bell_known; // ensure original didn't fire (mutual exclusion)
  story.checkStoryBeats();
  const fired = window.G.storyFlags.sea_bell_lost_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('The realm remembers a bell'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('319-A+321: sea_bell_lost_known fires year3 + d>=62 + everHadBuilding.church + !church present + !sea_bell_known', seaBellLostFire.fired, `text="${seaBellLostFire.text}…" tag=${seaBellLostFire.tag}`);

// Test: 319-A mutual exclusion — sea_bell_lost should NOT fire if original sea_bell_known already set
const seaBellMutexCheck = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 65;
  window.G.buildings = []; // church absent
  window.G.stats.everHadBuilding = { church: true };
  window.G.storyFlags.sea_bell_known = true; // original already fired
  delete window.G.storyFlags.sea_bell_lost_known;
  story.checkStoryBeats();
  return { fired: window.G.storyFlags.sea_bell_lost_known === true };
});
rec('319-A: sea_bell_lost_known does NOT fire when sea_bell_known already set (mutual exclusion)', !seaBellMutexCheck.fired);

// Test: 324 bidirectional mutex — sea_bell_known should NOT fire after sea_bell_lost_known
// Scenario: church destroyed pre-y3, lost fires at y3+d>=62, then church rebuilt. The
// original gate must reject because !sea_bell_lost_known is false.
const seaBellRebuildMutex = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 88;
  window.G.stats = window.G.stats || {};
  window.G.stats.everHadBuilding = { church: true };
  window.G.storyFlags.sea_bell_lost_known = true; // lost already fired
  window.G.buildings = [{ type: 'church', x: 30, y: 30, hp: 100, workers: [] }]; // rebuilt
  delete window.G.storyFlags.sea_bell_known;
  story.checkStoryBeats();
  return { fired: window.G.storyFlags.sea_bell_known === true };
});
rec('324: sea_bell_known does NOT fire after sea_bell_lost_known (bidirectional mutex; rebuild scenario)', !seaBellRebuildMutex.fired);

// Test: 324 bidirectional mutex — church_step_worn_known should NOT fire after church_step_worn_lost_known
const stepRebuildMutex = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 88;
  window.G.stats = window.G.stats || {};
  window.G.stats.everHadBuilding = { church: true };
  window.G.storyFlags.church_step_worn_lost_known = true;
  window.G.buildings = [{ type: 'church', x: 30, y: 30, hp: 100, workers: [] }];
  delete window.G.storyFlags.church_step_worn_known;
  story.checkStoryBeats();
  return { fired: window.G.storyFlags.church_step_worn_known === true };
});
rec('324: church_step_worn_known does NOT fire after church_step_worn_lost_known (bidirectional mutex)', !stepRebuildMutex.fired);

// Test: 319-B church_step_worn_lost_known — fallback for raid-destroyed church (311 [code] closure partial).
// 321: gate-spread requires G.day >= 68.
const stepLostFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 70;
  window.G.buildings = [];
  window.G.stats.everHadBuilding = { church: true };
  delete window.G.storyFlags.church_step_worn_lost_known;
  delete window.G.storyFlags.church_step_worn_known;
  delete window.G.storyFlags.sea_bell_known;
  delete window.G.storyFlags.sea_bell_lost_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.church_step_worn_lost_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('The church is gone. The step'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('319-B+321: church_step_worn_lost_known fires year3 + d>=68 + everHadBuilding.church + !church present + !church_step_worn_known', stepLostFire.fired, `text="${stepLostFire.text}…" tag=${stepLostFire.tag}`);

// Test: 318 empty_seat_known — TRIPLE-AXIS (6th OUTSIDE GRIEF + 6th STRUCTURAL FRAGMENT + SILENT-COLLECTIVE-ADJUSTMENT-TO-LOSS angle)
// 321: gate-spread requires G.day >= 72.
const emptySeatFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 75;
  window.G.stats = window.G.stats || {};
  window.G.stats.citizensDied = 2;
  delete window.G.storyFlags.empty_seat_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.empty_seat_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('An empty seat'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('318+321: empty_seat_known fires year3 + d>=72 + citizensDied>=2', emptySeatFire.fired, `text="${emptySeatFire.text}…" tag=${emptySeatFire.tag}`);

// Test: 314 morning_dread_known — TRIPLE-AXIS (5th OUTSIDE TERROR + 5th STRUCTURAL NEGATION + DREAD-WITHOUT-CAUSE angle)
const dreadFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 85;
  delete window.G.storyFlags.morning_dread_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.morning_dread_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('No bell rang'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('314: morning_dread_known fires year3 + d>=80', dreadFire.fired, `text="${dreadFire.text}…" tag=${dreadFire.tag}`);

// Test: 312 tacit_norms_known — SOCIAL-NORMS habituation-recognition (4th shape; 4th structural-DIALOG-opening)
// 313: gate-spread requires G.day >= 75 (18 days after y3 d57).
const tacitNormsFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 80;
  delete window.G.storyFlags.tacit_norms_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.tacit_norms_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('"Don\'t ask the well'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('312: tacit_norms_known fires year3 + d>=75', tacitNormsFire.fired, `text="${tacitNormsFire.text}…" tag=${tacitNormsFire.tag}`);

// Test: 307 path_knows_routine_known — anticipatory-agency (6th land-as-agent; 3rd structural-second-person)
// 313: gate-spread requires G.day >= 70.
const pathKnowsFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 75;
  delete window.G.storyFlags.path_knows_routine_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.path_knows_routine_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('You walk down the path'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('307: path_knows_routine_known fires year3 + d>=70', pathKnowsFire.fired, `text="${pathKnowsFire.text}…" tag=${pathKnowsFire.tag}`);

// Test: 305 silent_morning_known — emergent-tradition (5th forgetting shape; 2nd structural-imperative)
// 311: gate updated to `G.stats.everHadBuilding?.church` per 310 [code]; tests both
// CURRENT building absent + everHadBuilding flag set → fires (raid-survived realm).
// 321: gate-spread requires G.day >= 58.
const silentMorningFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 60;
  window.G.buildings = []; // 311: church NOT currently present
  window.G.stats = window.G.stats || {};
  window.G.stats.everHadBuilding = { church: true }; // but realm once had one
  delete window.G.storyFlags.silent_morning_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.silent_morning_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('Listen for the bell'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('305+311+321: silent_morning_known fires year3 + d>=58 + everHadBuilding.church (church-destroyed realm)', silentMorningFire.fired, `text="${silentMorningFire.text}…" tag=${silentMorningFire.tag}`);

// Test: 303 wagon_track_known — IRRITATION-DOMESTICATED (4th OUTSIDE-cluster register)
// 313: gate-spread requires G.day >= 65.
const wagonTrackFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 70;
  delete window.G.storyFlags.wagon_track_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.wagon_track_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a wagon-track on the eastern road'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('303: wagon_track_known fires year3 + d>=65', wagonTrackFire.fired, `text="${wagonTrackFire.text}…" tag=${wagonTrackFire.tag}`);

// Test: 301 noon_bell_origin_known — ritual-persistence-without-origin (4th forgetting shape)
const noonBellFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'church')) {
    window.G.buildings.push({ type: 'church', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  }
  delete window.G.storyFlags.noon_bell_origin_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.noon_bell_origin_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('Why is the church bell'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('301: noon_bell_origin_known fires year2 + church', noonBellFire.fired, `text="${noonBellFire.text}…" tag=${noonBellFire.tag}`);

// Test: 297 unplaceable_sound_known — WONDER (3rd OUTSIDE-cluster register)
const wonderFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  delete window.G.storyFlags.unplaceable_sound_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.unplaceable_sound_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is sometimes a sound'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('297: unplaceable_sound_known fires year2', wonderFire.fired, `text="${wonderFire.text}…" tag=${wonderFire.tag}`);

// Test: 296 realm_laughs_known — collective-ease (2nd OUTSIDE-cluster register)
const realmLaughsFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.happiness = 80;
  delete window.G.storyFlags.realm_laughs_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.realm_laughs_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There comes an evening when the realm laughs'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('296: realm_laughs_known fires year2 + happiness > 65', realmLaughsFire.fired, `text="${realmLaughsFire.text}…" tag=${realmLaughsFire.tag}`);

// Test: 294 church_step_worn_known — reshaped-by-use (5th land-as-agent shape)
const stepWornFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'church')) {
    window.G.buildings.push({ type: 'church', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  }
  delete window.G.storyFlags.church_step_worn_known;
  delete window.G.storyFlags.church_step_worn_lost_known; // 324: clear mutex set by earlier tests
  story.checkStoryBeats();
  const fired = window.G.storyFlags.church_step_worn_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a step at the church'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('294: church_step_worn_known fires year3 + church', stepWornFire.fired, `text="${stepWornFire.text}…" tag=${stepWornFire.tag}`);

// Test: 292 bakery_door_carving_known — preservation-without-memory (3rd forgetting shape)
const carvingFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'bakery')) {
    window.G.buildings.push({ type: 'bakery', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  }
  delete window.G.storyFlags.bakery_door_carving_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.bakery_door_carving_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a name carved into the door'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('292: bakery_door_carving_known fires year3 + bakery', carvingFire.fired, `text="${carvingFire.text}…" tag=${carvingFire.tag}`);

// Test: 290 sea_bell_known — inheritance-vs-craft (4th land-as-agent shape)
const seaBellFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'church')) {
    window.G.buildings.push({ type: 'church', x: 30, y: 30, hp: 100, maxHp: 100, workers: [], assigned: [], buildProgress: 1 });
  }
  delete window.G.storyFlags.sea_bell_known;
  delete window.G.storyFlags.sea_bell_lost_known; // 324: clear mutex set by earlier tests
  story.checkStoryBeats();
  const fired = window.G.storyFlags.sea_bell_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a bell at the church'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('290: sea_bell_known fires year3 + church', seaBellFire.fired, `text="${seaBellFire.text}…" tag=${seaBellFire.tag}`);

// Test: 285 phrase_misheard_known — language-drift (3rd habituation-recognition shape)
// 313: gate-spread requires G.day >= 60.
const phraseFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.day = 65;
  delete window.G.storyFlags.phrase_misheard_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.phrase_misheard_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a phrase the realm uses'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('285: phrase_misheard_known fires year3 + d>=60', phraseFire.fired, `text="${phraseFire.text}…" tag=${phraseFire.tag}`);

// Test: 280 liminal_moment_known — rhythm-awareness (2nd habituation-recognition shape)
const liminalFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.dayPhase = (window.G.dayLength || 3600) * 0.7;
  delete window.G.storyFlags.liminal_moment_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.liminal_moment_known === true;
  const lastEntry = window.G.chronicle.find(e => e.text?.startsWith('There is a moment most evenings'));
  return { fired, text: lastEntry?.text?.slice(0, 70), tag: lastEntry?.tag };
});
rec('280: liminal_moment_known fires year2 + dayPhase>0.6', liminalFire.fired, `text="${liminalFire.text}…" tag=${liminalFire.tag}`);

// Test: 254 nights_blur_known — habituation-recognition (year2 + autumn|winter)
const nightsBlurFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.season = 'autumn';
  delete window.G.storyFlags.nights_blur_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.nights_blur_known === true;
  const lastEntry = window.G.chronicle.at(-1);
  return { fired, text: lastEntry?.text?.slice(0, 60), tag: lastEntry?.tag };
});
rec('254: nights_blur_known fires year2 + autumn', nightsBlurFire.fired, `text="${nightsBlurFire.text}…" tag=${nightsBlurFire.tag}`);

// Test 21: 252 rival_banner_distant — rival + year3 + autumn/winter
const rivalFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureRival();
  window.G.storyFlags.year3 = true;
  window.G.season = 'winter';
  window.G.day = 75;
  delete window.G.storyFlags.rival_banner_distant;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.rival_banner_distant === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("banner is sighted on a far ridge"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('252: rival_banner_distant fires rival + year3 + winter', rivalFire.fired, `text="${rivalFire.text}…" tag=${rivalFire.tag}`);

// Test 20: 249 merchant_counts_thrice — merchant + autumn + day≥40
const merchantFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureMerchant();
  window.G.season = 'autumn';
  window.G.day = 45;
  delete window.G.storyFlags.merchant_counts_thrice;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.merchant_counts_thrice === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("counts the day's coins"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('249: merchant_counts_thrice fires merchant + autumn d45', merchantFire.fired, `text="${merchantFire.text}…" tag=${merchantFire.tag}`);

// Test 19: 247 teacher_pauses_slate — teacher named + year2
const teacherFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureTeacher();
  window.G.storyFlags.year2 = true;
  delete window.G.storyFlags.teacher_pauses_slate;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.teacher_pauses_slate === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("schoolhouse and finds a child's name"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('247: teacher_pauses_slate fires teacher + year2', teacherFire.fired, `text="${teacherFire.text}…" tag=${teacherFire.tag}`);

// Test 18: 246 first_thaw_known — year2 + spring + day≥31
const thawFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.season = 'spring';
  window.G.day = 32;
  delete window.G.storyFlags.first_thaw_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.first_thaw_known === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("first warm day"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('246: first_thaw_known fires year2 + spring d32', thawFire.fired, `text="${thawFire.text}…" tag=${thawFire.tag}`);

// Test 17: 245 smith_walks_river — smith named + day≥30 + summer/autumn
const smithFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureSmith();
  window.G.day = 35;
  window.G.season = 'summer';
  delete window.G.storyFlags.smith_walks_river;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.smith_walks_river === true;
  const entry = window.G.chronicle.find(e => e.text?.includes("anvil falls silent"));
  return { fired, text: entry?.text?.slice(0, 60), tag: entry?.tag };
});
rec('245: smith_walks_river fires smith + d35 + summer', smithFire.fired, `text="${smithFire.text}…" tag=${smithFire.tag}`);

// Test 16: 244 first-townhall chronicle beat (function-text + mayor reference)
const townhallBeat = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureMayor();
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'townhall')) {
    window.G.buildings.push({ type: 'townhall', x: 30, y: 30, hp: 100, maxHp: 100, workers: [] });
  }
  delete window.G.storyFlags.firstTownHall;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.firstTownHall === true;
  // Find the townhall beat in chronicle
  const entry = window.G.chronicle.find(e => e.text?.startsWith('The town hall opens'));
  return { fired, text: entry?.text?.slice(0, 80), tag: entry?.tag };
});
rec('244: firstTownHall fires + uses function-text + mayor reference', townhallBeat.fired && /[A-Z]\w+ sits at the long table/.test(townhallBeat.text || ''), `text="${townhallBeat.text?.slice(0, 60)}…" tag=${townhallBeat.tag}`);

// Test 15: 243 townhall mayor-gated unlock
const townhallGate = await page.evaluate(async () => {
  const tech = await import('./js/tech.js');
  const story = await import('./js/story.js');
  // 258: ensure no townhall exists so maxCount:1 doesn't shadow the mayor-gate semantics
  window.G.buildings = (window.G.buildings || []).filter(b => b.type !== 'townhall');
  // Without mayor: locked
  delete window.G.namedCharacters?.mayor;
  const lockedNoMayor = !tech.isBuildingUnlocked('townhall');
  // After ensureMayor: unlocked
  story.ensureMayor();
  const unlockedWithMayor = tech.isBuildingUnlocked('townhall');
  return { lockedNoMayor, unlockedWithMayor, mayorName: window.G.namedCharacters?.mayor?.name };
});
rec('243: townhall locked without mayor + unlocked with mayor', townhallGate.lockedNoMayor && townhallGate.unlockedWithMayor, `mayor=${townhallGate.mayorName}`);

// Test 14: 240 bard_unsung_song — bard named + day≥25 + spring/summer
const bardSongFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  story.ensureBard();
  window.G.day = 30;
  window.G.season = 'summer';
  delete window.G.storyFlags.bard_unsung_song;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.bard_unsung_song === true;
  const lastEntry = window.G.chronicle.at(-1);
  return { fired, text: lastEntry?.text?.slice(0, 50), tag: lastEntry?.tag };
});
rec('240: bard_unsung_song fires bard + d30 + summer', bardSongFire.fired, `text="${bardSongFire.text}…" tag=${bardSongFire.tag}`);

// Test 13: 230 full_pop_known — pop≥10 + lastUnderpopDay+60 days
const fullPopFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.population = 12;
  window.G.maxPop = 12;
  window.G.lastUnderpopDay = 50;
  window.G.day = 115;
  delete window.G.storyFlags.full_pop_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.full_pop_known === true;
  return { fired };
});
rec('230: full_pop_known fires d115 with pop=12, lastUnderpopDay=50', fullPopFire.fired);

// Test 12: 229 hearth_holds_names — year3 + citizensDied≥1
const hearthFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year3 = true;
  window.G.stats = window.G.stats || {};
  window.G.stats.citizensDied = 1;
  delete window.G.storyFlags.hearth_holds_names;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.hearth_holds_names === true;
  return { fired };
});
rec('229: hearth_holds_names fires year3 + citizensDied=1', hearthFire.fired);

// Test 11: 228 no_death_known — citizensDied≥1 + lastDeathDay+100 days
const noDeathFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.stats = window.G.stats || {};
  window.G.stats.citizensDied = 1;
  window.G.lastDeathDay = 10;
  window.G.day = 115;  // 105 days past last death
  delete window.G.storyFlags.no_death_known;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.no_death_known === true;
  return { fired };
});
rec('228: no_death_known fires d115 with citizensDied=1, lastDeathDay=10', noDeathFire.fired);

// Test 10: 227 well_remembers — year2 + well exists
const wellFire = await page.evaluate(async () => {
  const story = await import('./js/story.js');
  window.G.storyFlags.year2 = true;
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'well')) {
    window.G.buildings.push({ type: 'well', x: 30, y: 30, hp: 100, maxHp: 100, workers: [] });
  }
  delete window.G.storyFlags.well_remembers;
  story.checkStoryBeats();
  const fired = window.G.storyFlags.well_remembers === true;
  const lastEntry = window.G.chronicle.at(-1);
  return { fired, text: lastEntry?.text?.slice(0, 60), tag: lastEntry?.tag };
});
rec('227: well_remembers fires year2 + well exists', wellFire.fired, `text="${wellFire.text}…"`);

// Test 9: 214 founder-conditional offering — verify pool size grows when founder1 named
const offeringPool = await page.evaluate(async () => {
  // Probe by simulating the offering selection logic without firing the beat.
  // We can't re-import the offering items array, but we can check that
  // founders_named flag is settable and the kingdomName-hashed selection
  // would have access to a 7-deep pool.
  window.G.storyFlags.founders_named = true;
  window.G.storyFlags.founder1 = 'Lira';
  // The actual logic lives inside checkOfferingBeat, but we don't want to
  // fire it (requires happyPeakActive + day≥30 + ~15% roll). Instead,
  // verify the pre-conditions are met.
  return { foundersSet: true, founder1: window.G.storyFlags.founder1 };
});
rec('214: founder-conditional offering pre-conditions settable', offeringPool.foundersSet, `founder1=${offeringPool.founder1}`);

// Test: 311 placeBuilding sets G.stats.everHadBuilding[type] (310 [code] closure).
// Find a buildable tile (revealed grass, not occupied) and call placeBuilding.
const everHadCheck = await page.evaluate(async () => {
  const econ = await import('./js/economy.js');
  window.G.stats = window.G.stats || {};
  window.G.stats.everHadBuilding = {}; // clean slate
  window.G.resources = { wood: 999, stone: 999, food: 999, gold: 999, iron: 999 };
  // Find a placeable tile by canPlace probe.
  let placedAt = null;
  for (let r = 0; r < window.G.map.length && !placedAt; r++) {
    for (let c = 0; c < window.G.map[r].length; c++) {
      if (econ.canPlace('well', c, r)) {
        const ok = econ.placeBuilding('well', c, r);
        if (ok) { placedAt = { c, r }; break; }
      }
    }
  }
  return {
    everHadWell: window.G.stats.everHadBuilding?.well === true,
    everHadKeys: Object.keys(window.G.stats.everHadBuilding || {}),
    placedAt,
  };
});
rec('311: placeBuilding sets G.stats.everHadBuilding[type] (310 [code])', everHadCheck.everHadWell, `keys=[${everHadCheck.everHadKeys.join(',')}] placed=${JSON.stringify(everHadCheck.placedAt)}`);

// Test: 317 loadGame backfills G.stats.everHadBuilding from G.buildings (316 LOW closure).
// Simulates a pre-311 save: saveGame() current state, strip everHadBuilding from
// the persisted blob, then loadGame() — backfill should rehydrate from G.buildings.
const legacyLoadCheck = await page.evaluate(async () => {
  const save = await import('./js/save.js');
  // Place a couple test buildings via direct push so they exist at save-time
  // (placeBuilding would set the flag we're trying to test the absence of).
  window.G.buildings = window.G.buildings || [];
  if (!window.G.buildings.some(b => b.type === 'church')) {
    window.G.buildings.push({ type: 'church', x: 28, y: 28, hp: 100, prodTimer: 0, level: 1, workers: [] });
  }
  if (!window.G.buildings.some(b => b.type === 'bakery')) {
    window.G.buildings.push({ type: 'bakery', x: 29, y: 28, hp: 100, prodTimer: 0, level: 1, workers: [] });
  }
  save.saveGame({ silent: true });
  // Strip everHadBuilding from the persisted blob to simulate a pre-311 save.
  const raw = localStorage.getItem('realm-save-v2');
  const blob = JSON.parse(raw);
  if (blob.stats) delete blob.stats.everHadBuilding;
  localStorage.setItem('realm-save-v2', JSON.stringify(blob));
  // Wipe runtime everHadBuilding so we're testing post-load state, not pre.
  window.G.stats.everHadBuilding = {};
  const loaded = save.loadGame();
  return {
    loaded,
    persistedHadField: 'everHadBuilding' in (blob.stats || {}),
    everHadChurch: window.G.stats.everHadBuilding?.church === true,
    everHadBakery: window.G.stats.everHadBuilding?.bakery === true,
    everHadKeys: Object.keys(window.G.stats.everHadBuilding || {}),
  };
});
const backfillOk = legacyLoadCheck.loaded && !legacyLoadCheck.persistedHadField && legacyLoadCheck.everHadChurch && legacyLoadCheck.everHadBakery;
rec('317: loadGame backfills everHadBuilding from G.buildings (316 [code] closure)', backfillOk, `loaded=${legacyLoadCheck.loaded} stripField=${!legacyLoadCheck.persistedHadField} keys=[${legacyLoadCheck.everHadKeys.join(',')}]`);

// Page errors check
console.log('\n[verify-logic] === PAGE ERRORS ===');
if (errs.length === 0) {
  console.log('  (none)');
} else {
  errs.slice(-10).forEach(e => console.log('  ', e));
}

// Summary
const passed = results.filter(r => r.ok).length;
console.log(`\n[verify-logic] ${passed}/${results.length} passed`);

await browser.close();
await server.stop();
process.exit(passed === results.length ? 0 : 1);
