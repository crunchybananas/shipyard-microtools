// ══════════════════════════════════════════════════════���═════
// REALM — Main entry point, game loop, initialization
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, updateSeason, getSeasonData, getDifficulty, DIFFICULTY, getDaylight, getSeasonIndex, lightCurve, tintCurve, setSeed } from './state.js';
import { initPostFX, applyPostFX, resizePostFX } from './postfx.js';
import { generateWorld } from './world.js';
import { initRenderer, resizeCanvas, render, renderBuildingIsolated } from './render.js';
import { updateCitizens } from './citizens.js';
import { updateSoldiers } from './soldiers.js';
import { updateProduction, checkRaids, collectTaxes, updateFires, processQueue } from './economy.js';
import { checkMissions, renderMissions } from './missions.js';
import { updateParticles, updateSmokeEmitters } from './particles.js';
import { setupInput } from './input.js';
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel, updateTutorialTip, dismissTutorial, togglePopPanel, hideInfoPanel, toggleStatsPanel, toggleTradePanel, renderTradePanel } from './ui.js';
import { updateResearch } from './tech.js';
import { checkRandomEvents, updateEventBanner } from './events.js';
import { saveGame, loadGame, getSaveSize } from './save.js';
import { updateAmbient, toggleAmbient, isAmbientEnabled, playSound, tickMusic, toggleMusic } from './audio.js';
import { toggleNotificationLog, notify } from './notifications.js';
import { executeTrade } from './trade.js';
import { loadAchievements, checkAchievements, getUnlockedCount, renderAchievementsPanel, ACHIEVEMENTS } from './achievements.js';
import { updateEnemies, updateProjectiles, updateTowers } from './combat.js';
import { getActiveScenario, checkScenarioComplete, SCENARIOS } from './scenarios.js';
import { updateWalkers } from './walkers.js';
import { updateAnimals } from './animals.js';
import { checkAdvisor } from './advisor.js';
import { initGL3D, buildTerrainMesh, buildBuildingsMesh, render3D, resize3D } from './webgl3d.js';
import { updateBoats, updateFlocks, updateBalloons, updateWolves, updateCarts, updateRainbow, updateHawks, updatePuddles, updateFootprints, updateSnowmen, enhUpdateAll } from './enhancements.js';
import { initChronicle, chronicle, toggleChroniclePanel, checkStoryBeats, _realWorldDreamLens, setChronicleFilter } from './story.js';

// ── Init ───────────────────────────────────────────────────
const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');

// ── WebGL 3D canvas setup ──────────────────────────────────
let canvas3d = document.getElementById('game3d');
if (!canvas3d) {
  canvas3d = document.createElement('canvas');
  canvas3d.id = 'game3d';
  canvas3d.style.cssText = 'display:none;position:absolute;top:0;left:0;z-index:5;';
  document.body.appendChild(canvas3d);
}
const gl3dReady = initGL3D(canvas3d);

let _3dVisible = false;
window.toggle3D = () => {
  _3dVisible = !_3dVisible;
  canvas3d.style.display = _3dVisible ? 'block' : 'none';
  canvas.style.display = _3dVisible ? 'none' : 'block';
  const miniEl = document.getElementById('minimap');
  if (miniEl) miniEl.style.display = _3dVisible ? 'none' : 'block';
  if (_3dVisible && gl3dReady) {
    buildTerrainMesh();
    render3D();
  }
};

initRenderer(canvas, minimap);
resizeCanvas();
initPostFX(canvas);
window.addEventListener('resize', () => { resizeCanvas(); resizePostFX(); if (gl3dReady) resize3D(); });

// Loop 127 (the-fixer, 030 filed 96 ticks + 126 HIGH): welcome-back
// summary. On tab blur, snapshot G state. On focus, diff and render a
// brief "during your absence: X" toast so the returning player can
// orient. Accept-the-loss design preserved — game doesn't pause; the
// summary is passive information, not a prompt.
let _blurSnapshot = null;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Only snapshot if the game has started and isn't already snapshotted
    if (G && G.day && !_blurSnapshot) {
      _blurSnapshot = {
        day: G.day, season: G.season,
        population: G.population,
        food: G.resources?.food ?? 0,
        wood: G.resources?.wood ?? 0,
        gold: G.resources?.gold ?? 0,
        citizensBorn: G.stats?.citizensBorn ?? 0,
        citizensDied: G.stats?.citizensDied ?? 0,
        raidsSurvived: G.stats?.raidsSurvived ?? 0,
        wallTime: Date.now(),
      };
    }
  } else if (document.visibilityState === 'visible' && _blurSnapshot) {
    const snap = _blurSnapshot;
    _blurSnapshot = null;
    // Only summarize if enough time OR game-state changed to matter
    const daysPassed = G.day - snap.day;
    const wallMs = Date.now() - snap.wallTime;
    if (daysPassed < 1 && wallMs < 30_000) return;  // too brief to summarize
    // Build deltas
    const popDelta = G.population - snap.population;
    const bornDelta = (G.stats?.citizensBorn ?? 0) - snap.citizensBorn;
    const diedDelta = (G.stats?.citizensDied ?? 0) - snap.citizensDied;
    const raidDelta = (G.stats?.raidsSurvived ?? 0) - snap.raidsSurvived;
    const seasonChanged = G.season !== snap.season;
    // Compose brief summary
    const parts = [`${daysPassed} day${daysPassed === 1 ? '' : 's'}`];
    if (seasonChanged) parts.push(`→ ${G.season}`);
    if (bornDelta > 0) parts.push(`+${bornDelta} born`);
    if (diedDelta > 0) parts.push(`−${diedDelta} lost`);
    if (raidDelta > 0) parts.push(`${raidDelta} raid${raidDelta === 1 ? '' : 's'} survived`);
    if (popDelta !== 0 && bornDelta === 0 && diedDelta === 0) {
      parts.push(`pop ${popDelta > 0 ? '+' : ''}${popDelta}`);
    }
    const text = `While you were away: ${parts.join(', ')}.`;
    notify(text, 'info', { chronicle: false });
  }
});

setupSaveButtons();
loadAchievements();

// Check for existing save to show Continue button with friendly summary
const hasSaveData = !!localStorage.getItem('realm-save-v2');
if (hasSaveData) {
  const loadBtn = document.getElementById('title-load');
  if (loadBtn) {
    // Parse save for kingdom name + day instead of raw byte size
    let label = '📁 Continue';
    try {
      const raw = localStorage.getItem('realm-save-v2');
      if (raw) {
        const save = JSON.parse(raw);
        const kName = save.kingdomName && save.kingdomName !== 'Realm' ? save.kingdomName : null;
        const day = save.day || 1;
        const pop = Array.isArray(save.citizens) ? save.citizens.length : 0;
        const year = Math.floor((day - 1) / 28) + 1;
        const dayInYear = ((day - 1) % 28) + 1;
        label = kName
          ? `📁 Continue ${kName} · Year ${year} Day ${dayInYear} · 👤${pop}`
          : `📁 Continue · Year ${year} Day ${dayInYear} · 👤${pop}`;
      }
    } catch (e) { /* fall back to plain label */ }
    loadBtn.textContent = label;
    loadBtn.style.display = 'inline-block';
  }
}

// Mark completed scenarios on title screen
try {
  const save = JSON.parse(localStorage.getItem('realm-save-v2') || '{}');
  const won = save.G?._scenariosCompleted || [];
  document.querySelectorAll('.scen-btn').forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    const match = onclick.match(/setScenario\(['"]([^'"]+)['"]\)/);
    if (match && won.includes(match[1])) {
      b.innerHTML = '✓ ' + b.innerHTML;
    }
  });
} catch (_e) {}

function beginGame() {
  const titleEl = document.getElementById('title-screen');
  titleEl.style.transition = 'opacity 0.5s';
  titleEl.style.opacity = '0';
  setTimeout(() => { titleEl.style.display = 'none'; }, 500);

  setupInput(canvas, canvas3d);
  initChronicle();
  if (G.chronicle.length === 0) {
    // Avoid "The realm of Realm" collision when the player keeps the default kingdom name
    const foundingText = G.kingdomName && G.kingdomName !== 'Realm'
      ? `The realm of ${G.kingdomName} is founded. Three weary settlers arrive at the shore, carrying all they own in wicker packs.`
      : `A new realm is founded on this quiet island. Three weary settlers arrive at the shore, carrying all they own in wicker packs.`;
    chronicle(foundingText, 'milestone');
  }
  renderBuildBar();
  renderMissions();
  updateUI();
  notify('Welcome to Realm. Build your settlement!');
  gameLoop();

  // Cinematic zoom-in over 1.5 seconds
  G.camera.zoom = 0.9;
  const zoomStart = performance.now();
  function zoomIn() {
    const elapsed = performance.now() - zoomStart;
    const t = Math.min(1, elapsed / 1500);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t; // ease in-out
    G.camera.zoom = 0.9 + 0.4 * ease;
    if (t < 1) requestAnimationFrame(zoomIn);
  }
  requestAnimationFrame(zoomIn);
}

window.setDifficulty = (d) => {
  G.difficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === d);
  });
};

window.setScenario = (id) => {
  G.scenario = id;
  document.querySelectorAll('.scen-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('onclick').includes(id));
  });
  const descEl = document.getElementById('scenario-desc');
  if (descEl) {
    const scen = SCENARIOS.find(s => s.id === id);
    descEl.textContent = scen ? scen.desc : '';
  }
};

window.startNewGame = () => {
  // Apply difficulty settings to starting resources
  const diff = getDifficulty();
  // Loop 132 (the-fixer, 131 HIGH): seed map RNG from kingdom name so
  // topology is reproducible per kingdom. Before 132, `_seed` was
  // `Date.now() % 100000` — two realms named the same thing at
  // different times got different islands. 132 reads the name first,
  // then seeds the RNG, then generates. Same kingdom → same island.
  const nameInput = document.getElementById('kingdom-name-input');
  G.kingdomName = (nameInput && nameInput.value.trim()) || 'Realm';
  let kh = 0;
  for (let i = 0; i < G.kingdomName.length; i++) {
    kh = ((kh << 5) - kh + G.kingdomName.charCodeAt(i)) | 0;
  }
  setSeed(Math.abs(kh) || 1);
  generateWorld();
  if (gl3dReady) buildTerrainMesh(); // pre-build 3D mesh after world gen
  G.resources.food = diff.startFood;
  G.resources.wood = diff.startWood;
  G.resources.gold = diff.startGold;
  G.nextRaidDay = diff.raidStart;
  // Apply scenario starting conditions (override difficulty defaults)
  const scen = getActiveScenario();
  if (scen) {
    G.resources = { ...scen.startResources };
    G.nextRaidDay = scen.raidStart;
  }
  G._scenarioWon = false;
  beginGame();
};

window.loadAndStart = () => {
  generateWorld();
  if (gl3dReady) buildTerrainMesh(); // pre-build 3D mesh after world gen
  if (loadGame()) {
    renderBuildBar();
    updateUI();
    // Loop 135 (the-fixer, 133 HIGH): cross-session welcome-back.
    // 127 handles within-session absence (tab blur/focus) but NOT
    // full-session resume. 135 fires a notify showing the last
    // chronicle entry on Continue so the returning player
    // reconnects to the realm's voice. `chronicle:false` because
    // we're just replaying existing history, not adding a new beat.
    try {
      const ch = G.chronicle;
      if (ch && ch.length > 0) {
        const last = ch[ch.length - 1];
        // Loop 139 (the-fixer, 133 MEDIUM): real-world wait prefix when
        // savedAt is available. Thresholds: >= 24h → "Your realm has
        // been waiting N days." >= 1h → "...a few hours." Below 1h
        // doesn't warrant a mention — resume feels immediate.
        let prefix = '';
        const savedAt = G._savedAt;
        if (savedAt) {
          const waitMs = Date.now() - savedAt;
          const waitDays = Math.floor(waitMs / (24 * 60 * 60 * 1000));
          if (waitDays >= 1) {
            prefix = `Your realm has been waiting ${waitDays} day${waitDays === 1 ? '' : 's'}. `;
          } else if (waitMs >= 60 * 60 * 1000) {
            prefix = 'Your realm has been waiting a few hours. ';
          }
        }
        notify(`${prefix}Where we left off (day ${last.day}): ${last.text}`, 'info', { chronicle: false });
        delete G._savedAt;  // one-shot — don't persist after welcome-back
      }
    } catch (_e) {}
  }
  beginGame();
};

// Expose for inline onclick handlers and console debugging
window.G = G;
G.debug = G.debug || {};
G.debug.lightCurve = lightCurve;
G.debug.tintCurve = tintCurve;
G.debug.dreamLens = _realWorldDreamLens;
G.debug.renderBuildingIsolated = renderBuildingIsolated;
G.debug.fastForward = fastForward;  // 081: synchronous N-day advance
window.forceRender = render;
window.setSpeed = setSpeed;
// Loop 035 (the-fixer): photo-mode toggle. Hides HUD / build-bar /
// mission panel / minimap / controls / pause overlay so the player can
// screenshot a clean frame. Triggered from the H key (input.js) or
// directly from the console.
window.togglePhotoMode = () => {
  G.photoMode = !G.photoMode;
  document.body.classList.toggle('photo-mode', G.photoMode);
};
window.toggleResearch = toggleResearchPanel;
window.toggleHappiness = toggleHappinessPanel;
window.dismissTutorial = dismissTutorial;
window.hideInfoPanel = hideInfoPanel;
window.toggleLog = toggleNotificationLog;
window.newGame = () => {
  // No confirm dialog — it blocks browser automation and interrupts flow
  // Reset all state
  // Loop 25 (render S3): also reset chronicle + storyFlags so new games
  // start with a blank history. Was leaving old raid entries from previous
  // runs contaminating the new chronicle panel.
  G.buildings = []; G.citizens = []; G.caravans = []; G.walkers = []; G.particles = []; G.soldiers = []; G.enemies = []; G.projectiles = []; G.animals = [];
  G.chronicle = []; G.storyFlags = {};
  G.notificationLog = [];
  G.resources = { wood:60, stone:30, food:80, gold:25, iron:0 };
  G.population = 3; G.maxPop = 3; G.happiness = 50; G.defense = 0;
  G.day = 1; G.dayPhase = 0; G.gameTick = 0; G.speed = 1;
  G.selectedBuild = null; G.selectedBuilding = null;
  G.nextRaidDay = 8; G.raidInterval = 8;
  G.researchedTechs = new Set(['agriculture','forestry']);
  G.currentResearch = null;
  G.activeEvent = null;
  G.eventModifiers = { foodProd:1, goldProd:1, happinessOffset:0, speedMult:1 };
  G._lightningTimer = null; G._lightningFlash = 0; G.meteors = [];
  G.season = 'spring'; G.won = false; G._scenarioWon = false;
  G.resourceRates = { wood:0, stone:0, food:0, gold:0, iron:0 };
  G.lastResources = null;
  G.tileWear = null;
  // Loop 302 (the-fixer, 271 [code] follow-on audit): added scenariosWon
  // to G.stats reset. Pre-302, newGame omitted scenariosWon → main.js:531
  // would TypeError on `G.stats.scenariosWon.includes(...)` if a player
  // restarted mid-scenario. Mirrors state.js initial G.stats schema (155).
  // Loop 311 (310 [code]): added everHadBuilding tracking. New realm
  // starts with empty experience; placeBuilding (economy.js:69) sets
  // each type true.
  G.stats = { buildingsBuilt:0, buildingsLost:0, citizensBorn:0, citizensDied:0, raidsSurvived:0, enemiesKilled:0, goldEarned:0, daysLived:0, scenariosWon:[], everHadBuilding:{} };
  // Loop 269 (the-fixer, 268 HIGH+MEDIUM): reset realm-end flag and
  // sustained-state trackers. Without these, a player whose realm fell
  // and clicked "New Game" inherited realmEnded=true (chronicle gated +
  // visuals desaturated + all NARRATIVE_BEATS gated → new realm born
  // already-dead) AND stale lastXDay values that caused 211/228/230 beats
  // to fire at off-by-N-day offsets in the new realm.
  G.realmEnded = false;
  G.lastRaidDay = undefined;
  G.lastDeathDay = undefined;
  G.lastUnderpopDay = undefined;
  // Loop 271 (the-fixer, 269 [code] filing): also reset namedCharacters
  // so the new realm doesn't inherit the previous realm's mayor/bard/
  // smith/teacher/merchant/rival. Without this, the new realm's first
  // tavern build silently re-uses the previous realm's mayor (per 034
  // hook + ensureMayor()), and same for the other 5 ensure-character
  // hooks tied to building first-builds.
  G.namedCharacters = {};
  // Loop 302 (the-fixer, 271 [code] follow-on audit): reset other leaky
  // _underscore-prefixed fields that were missed in 269/271 sweep.
  // _undoStack / _buildRipples / birds / _raidWarningGiven are all
  // realm-scoped runtime state that should NOT carry across newGame().
  G._undoStack = [];
  G._buildRipples = [];
  G.birds = [];
  G._raidWarningGiven = false;
  generateWorld();
  if (gl3dReady) buildTerrainMesh(); // rebuild 3D mesh for new world
  renderBuildBar(); renderMissions(); updateUI();
  notify('New game started!');
};
window.togglePopPanel = togglePopPanel;
window.toggleStats = toggleStatsPanel;
window.toggleTrade = toggleTradePanel;
window.doTrade = (partnerId, resource, amount) => {
  const r = executeTrade(partnerId, resource, amount);
  if (r) {
    const emojis = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };
    notify(`Traded ${r.given} ${emojis[resource] || resource} for ${r.received} ${emojis[r.export] || r.export}`, 'event');
    renderTradePanel();
    updateUI();
  } else {
    notify('Not enough resources for this trade', 'danger', { chronicle: false });  // 077/076 MEDIUM: UI failure, not a raid
  }
};
window.toggleAchievements = () => {
  const p = document.getElementById('achievements-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderAchievementsPanel();
};
window.toggleAmbientSound = () => {
  const on = toggleAmbient();
  const btn = document.getElementById('btn-ambient');
  if (btn) btn.textContent = on ? '🔊' : '🔇';
};
window.toggleMusicBtn = () => {
  const on = toggleMusic();
  const btn = document.getElementById('btn-music');
  if (btn) btn.textContent = on ? '🎵' : '🔕';
};
window.toggleChronicle = toggleChroniclePanel;
window.setChronicleFilter = setChronicleFilter;  // 078: chip-click handler
window.toggleMissions = () => {
  const c = document.getElementById('missions-content');
  const t = document.getElementById('missions-toggle');
  if (!c) return;
  const open = c.style.display !== 'none';
  c.style.display = open ? 'none' : 'block';
  if (t) t.textContent = open ? '▶' : '▼';
};

// (Welcome notification is fired from beginGame() — avoid duplicate at module load)

// ── Day/Night ──────────────────────────────────────────────
function updateTime() {
  G.dayPhase += G.speed;
  if (G.dayPhase >= G.dayLength) {
    G.dayPhase = 0;
    G.day++;
    if (G.stats) G.stats.daysLived++;
    // Bell toll at dawn if church exists
    playSound('bellToll');
    collectTaxes();
    checkRaids();
    // Note: raidsSurvived now increments inside checkRaids() only when the
    // player had defenses at the moment of raid-spawn. Loop 014 fix: the
    // old unconditional increment here counted raids as "survived" even
    // against a settlement with zero military buildings.
    checkRandomEvents();
    if (updateSeason()) {
      const s = getSeasonData();
      const seasonNum = Math.floor((G.day - 1) / 7) + 1;
      // Loop 070 (the-fixer, 069 HIGH): pass `chronicle: false` so the
      // notify-toast doesn't ALSO write to chronicle. 069's live play
      // saw day 8 fire THREE back-to-back chronicle entries at summer
      // (event from toast-route + season from the direct write below
      // + misc from advisor). The toast is ephemeral UX; the direct
      // `chronicle(..., 'season')` below IS the narrative memory. One
      // chronicle row per event is the right shape.
      notify(`${s.name} begins! (Season ${seasonNum})`, 'event', { chronicle: false });
      playSound('mission');
      // Loop 265 (the-fixer, 264 variant-pool axis 2nd use): season prose
      // pools. Pre-265 each season fired ONE fixed string every 7 days for
      // the realm's lifetime — long-lived realm saw "The fields grow golden"
      // 8+ times. Now each season has 3 variants picked by G.day %
      // pool.length, so consecutive seasons see different prose. First
      // variant per pool preserves original prose (backward compat).
      // Two-sentence rhythm preserved across all variants.
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
      // Season banner particles
      const seasonEmojis = { spring:['🌱','🌸','🌿'], summer:['☀️','🌻','🌊'], autumn:['🍂','🍁','🌾'], winter:['❄️','⛄','🌨️'] };
      const emojis = seasonEmojis[G.season] || ['✨'];
      for (let i = 0; i < 15; i++) {
        G.particles.push({
          tx: MAP_W/2 + (Math.random()-0.5)*8,
          ty: MAP_H/2 + (Math.random()-0.5)*8,
          offsetY: -10 - Math.random()*20,
          text: emojis[Math.floor(Math.random()*emojis.length)],
          alpha: 1.5, vy: -0.12 - Math.random()*0.15,
          decay: 0.007, type: 'text',
        });
      }
    }
  }
}

// ── Game Loop ──────────────────────────────────────────────
function simTick() {
  if (G.speed <= 0) return;
  // Crossing check: true iff this simTick advanced gameTick across a multiple
  // of N. Replaces bare `G.gameTick % N === 0`, which silently misses when
  // G.speed doesn't divide N (e.g., speed=4 with an odd-parity gameTick never
  // lands on any multiple of 30 → HUD freezes mid-game until you pause).
  const crossed = (N) => Math.floor(G.gameTick / N) > Math.floor((G.gameTick - G.speed) / N);
  for (let i = 0; i < G.speed; i++) {
    G.gameTick++;
    updateTime();
    updateCitizens();
    updateSoldiers();
    updateEnemies();
    updateTowers();
    updateProjectiles();
    updateWalkers();
    updateAnimals();
    updateBoats();
    updateFlocks(window.innerWidth, window.innerHeight);
    updateBalloons(window.innerWidth, window.innerHeight);
    updateWolves();
    updateCarts();
    updateRainbow();
    updateHawks(window.innerWidth, window.innerHeight);
    updatePuddles();
    updateFootprints();
    updateSnowmen();
    enhUpdateAll(window.innerWidth, window.innerHeight);
    updateProduction();
    updateFires();
    // `crossed(N)` fires when gameTick just crossed a multiple of N in this
    // simTick. Plain `% N === 0` MISSES ENTIRELY when G.speed and G.gameTick
    // don't align (e.g., speed=4 with an odd gameTick never lands on any
    // multiple of 30) — which caused the HUD to freeze mid-game until you
    // paused and resumed. This is robust to any speed ≥ 1.
    if (crossed(60)) processQueue();
    updateParticles();
    updateSmokeEmitters();
    updateResearch();
    if (crossed(60)) {
      checkMissions();
      renderMissions();
      renderResearchPanel();
    }
  }
  if (crossed(30)) {
    // updateUI() already calls updateBuildBarAffordability() for in-place cost/lock
    // updates. Calling renderBuildBar() here would wipe bar.innerHTML every 500ms
    // — if that fires between a user's mousedown and click, the button element is
    // replaced before the click lands, so the first click is lost (reported as
    // "selecting a building requires two clicks"). Full rebuilds happen on the
    // events that change bar structure: placement, research, undo, Escape, etc.
    updateUI();
    updateTutorialTip();
  }
  if (crossed(60)) { updateAmbient(); checkAchievements(); checkStoryBeats(); }
  if (crossed(120)) { tickMusic(); checkAdvisor(); }
  if (crossed(120) && !G._scenarioWon) {
    if (checkScenarioComplete()) {
      G._scenarioWon = true;
      G._scenariosCompleted = G._scenariosCompleted || [];
      if (!G._scenariosCompleted.includes(G.scenario)) G._scenariosCompleted.push(G.scenario);
      if (G.stats && !G.stats.scenariosWon.includes(G.scenario)) G.stats.scenariosWon.push(G.scenario);
      // Victory particles
      for (let i = 0; i < 30; i++) {
        G.particles.push({
          tx: MAP_W/2 + (Math.random()-0.5)*10,
          ty: MAP_H/2 + (Math.random()-0.5)*10,
          offsetY: -20 - Math.random()*40,
          text: ['🎉','⭐','🏆'][Math.floor(Math.random()*3)],
          alpha: 2, vy: -0.15, decay: 0.005, type: 'text',
        });
      }
      showScenarioVictory();
    }
  }
  if (G.gameTick % 3600 === 0 && G.gameTick > 0) saveGame({ silent: true });
  // Bird spawning — screen-space birds fly across sky during daytime.
  // Spawn fully offscreen-left so they don't appear inside the vignette void;
  // let them fly across the visible map and exit right.
  if (!G.birds) G.birds = [];
  if (G.gameTick % 400 === 0 && G.birds.length < 3 && getDaylight() > 0.6) {
    G.birds.push({
      x: -80 - Math.random() * 60,
      y: 80 + Math.random() * 120,
      vx: 0.8 + Math.random() * 0.5,
      vy: 0,
    });
  }
}

// ── Loop 081 (the-fixer, 069 filed 12 ticks ago) ─────────────
// Synchronously advance the simulation N game-days by calling
// simTick() in a tight loop with temporarily-boosted G.speed.
// Bypasses rAF throttling — a 200-day advance completes in ~50ms
// instead of ~48 seconds of background setTimeout accumulation.
//
// Intended for loop ticks that want to verify mid/late-game state
// (069's the-idle-player couldn't reach day 50+ in chrome-mcp;
// fastForward(50) gets there instantly).
//
// Trade-offs:
// - Particles + smoke still tick, may accumulate. Call
//   `G.particles.length = 0` before/after if clean state matters.
// - Rendering is NOT called. If the caller wants a frame after,
//   call window.forceRender().
// - Caps at a safety margin (days × dayLength × 2 iterations) so
//   a bug can't wedge the browser.
function fastForward(days) {
  if (!G || typeof G.dayLength !== 'number') return { error: 'game not initialized' };
  if (!Number.isFinite(days) || days <= 0) return { error: 'days must be positive number' };
  const startDay = G.day;
  const targetDay = startDay + Math.floor(days);
  const origSpeed = G.speed;
  // Loop 291 (the-fixer, 289 [code] filing): reduced fastForward G.speed
  // from 60 to 12 so dayPhase windows are SAMPLED during the run.
  // Root cause discovered at 291: simTick's inner for-loop calls
  // updateTime() G.speed times, each adding G.speed to dayPhase. At
  // G.speed=60 that's 60*60=3600 dayPhase per simTick = a full day per
  // simTick. checkStoryBeats fires at end-of-simTick with dayPhase=0
  // (just rolled over). dayPhase-window beats (266 summer-night > 0.75,
  // 280 late-day > 0.6) silently never fired. With G.speed=12, dayPhase
  // advances 12*12=144 per simTick (~25 simTicks per game-day);
  // checkStoryBeats fires at fractions 0.2/0.4/0.6/0.8/1.0 each day,
  // covering both 266's > 0.75 and 280's > 0.6 gates. ~25× more simTicks
  // than 60-speed path but still ~25 simTicks/day = fast enough for
  // verify/play scripts.
  G.speed = 12;
  const maxIters = Math.ceil(days * G.dayLength / (G.speed * G.speed)) * 2 + 100;
  let iters = 0;
  while (G.day < targetDay && iters < maxIters) {
    simTick();
    iters++;
  }
  G.speed = origSpeed;
  return {
    advancedDays: G.day - startDay,
    gameTick: G.gameTick,
    iters,
    day: G.day,
    season: G.season,
    happiness: G.happiness,
    population: G.population,
    chronicleLen: G.chronicle?.length,
  };
}

// Loop 261 (the-fixer, 192 also-filed + 260 sibling): render desaturation
// when G.realmEnded. The 192 commit added G.realmEnded and named two
// consumers: "chronicle stop" (closed at 260) + "render desat" (closed
// here). Together they complete the realm-end visual+textual story —
// chronicle stops writing AND world goes desaturated/dim. CSS filter on
// both the game canvas + postfx overlay covers the WebGL post-process
// path. Tracked variable avoids every-frame DOM writes (only flips on
// state transition: live realm_fell OR save load with realmEnded=true).
let _lastRealmEndedApplied = null;
let _realmEndTransitionInstalled = false;
function _applyRealmEndFilter() {
  if (G.realmEnded === _lastRealmEndedApplied) return;
  _lastRealmEndedApplied = G.realmEnded;
  // Loop 299 (the-fixer, 261 [code] + 260 long-filed): install CSS
  // transition once so the realm-end filter FADES rather than snaps.
  // 1.5s ease — long enough for the realm-fall moment to feel
  // ceremonial, short enough not to delay the player's visible
  // acknowledgment that the realm has ended. Installed lazily on
  // first flip so the postfx canvas (created by initPostFX) is
  // available. Idempotent — installs only once even if the helper
  // runs on every frame.
  if (!_realmEndTransitionInstalled) {
    _realmEndTransitionInstalled = true;
    canvas.style.transition = 'filter 1.5s ease';
    const post = document.getElementById('postfx');
    if (post) post.style.transition = 'filter 1.5s ease';
  }
  const filterStr = G.realmEnded ? 'grayscale(0.85) brightness(0.85)' : '';
  canvas.style.filter = filterStr;
  const post = document.getElementById('postfx');
  if (post) post.style.filter = filterStr;
}

function gameLoop() {
  try {
    if (document.visibilityState === 'visible') {
      simTick();
      if (_3dVisible && gl3dReady) {
        render3D();
      } else {
        render();
        applyPostFX(canvas, G.gameTick, getDaylight(), getSeasonIndex());
      }
      _applyRealmEndFilter();
      requestAnimationFrame(gameLoop);
    } else {
      for (let i = 0; i < 60; i++) simTick();
      render();
      applyPostFX(canvas, G.gameTick, getDaylight(), getSeasonIndex());
      _applyRealmEndFilter();
      setTimeout(gameLoop, 16);
    }
  } catch (e) {
    console.error('Game loop error:', e);
    setTimeout(gameLoop, 100); // retry after error
  }
}

// ── Scenario victory ───────────────────────────────────────
function showScenarioVictory() {
  const scen = getActiveScenario();
  const el = document.getElementById('scenario-victory');
  const nameEl = document.getElementById('sv-name');
  const statsEl = document.getElementById('sv-stats');
  if (!el || !nameEl || !statsEl) return;
  nameEl.textContent = scen.name;
  statsEl.innerHTML = `
    <div>Days lived: <strong>${G.stats?.daysLived || G.day}</strong></div>
    <div>Population: <strong>${G.population}</strong></div>
    <div>Buildings: <strong>${G.buildings.length}</strong></div>
    <div>Raids survived: <strong>${G.stats?.raidsSurvived || 0}</strong></div>
    <div>Gold earned: <strong>${G.stats?.goldEarned || 0}</strong></div>
  `;
  el.style.display = 'flex';
  playSound('mission');
}
window.continuePlayingScenario = () => {
  document.getElementById('scenario-victory').style.display = 'none';
};
window.returnToTitle = () => {
  location.reload();
};

// Game loop starts when player clicks New Game or Continue from the title screen.

// notify() imported from notifications.js replaces the old showToast
