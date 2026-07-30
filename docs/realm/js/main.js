// ══════════════════════════════════════════════════════���═════
// REALM — Main entry point, game loop, initialization
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, TH, createResourceStock, DIFFICULTY, getDaylight, getSeasonIndex, lightCurve, resetRuntimeTransientState, tintCurve, setSeed } from './state.js?realm=183';
import { initPostFX, applyPostFX, resizePostFX } from './postfx.js?realm=183';
import { generateWorld } from './world.js?realm=183';
import { initRenderer, resizeCanvas, render, renderBuildingIsolated, screenToWorld, panCameraTo, toScreen } from './render.js?realm=183';
import { initMinimap, setMinimapViewportResolver, renderMinimap } from './minimap.js?realm=183';
import { dispatch } from './commands.js?realm=183';
import { coreTick } from './sim.js?realm=183';
import { on } from './bus.js?realm=183';
import { updateParticles, updateSmokeEmitters } from './particles.js?realm=183';
import { setupInput } from './input.js?realm=183';
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel, updateTutorialTip, dismissTutorial, togglePopPanel, hideInfoPanel, toggleStatsPanel, toggleTradePanel, renderTradePanel, renderMissions, updateEventBanner, showVictoryScreen, showEraBanner } from './ui.js?realm=183';
import { ERAS } from './tech.js?realm=183';
import { saveGame, loadGame, getSaveSummary, getLastLoadedSavedAt } from './save.js?realm=183';
import { updateAmbient, toggleAmbient, isMasterMuted, playSound, tickMusic, toggleMusic } from './audio.js?realm=183';
import { toggleNotificationLog, notify, notifyTransient } from './notifications.js?realm=183';
import { loadAchievements, checkAchievements, renderAchievementsPanel } from './achievements.js?realm=183';
import { getActiveScenario, SCENARIOS } from './scenarios.js?realm=183';
import { updateAnimals } from './animals.js?realm=183';
import { checkAdvisor } from './advisor.js?realm=183';
import { updateBoats, updateFlocks, updateBalloons, updateWolves, updateCarts, updateRainbow, updateHawks, updatePuddles, updateFootprints, updateSnowmen, enhUpdateAll } from './enhancements.js?realm=183';
import { chronicle, initChronicle } from './log.js?realm=183';
import { realWorldDreamLens, setChronicleFilter, toggleChroniclePanel } from './story-ui.js?realm=183';
import { initSpriteLab } from './sprite-lab.js?realm=183';
import { initSpriteMuster } from './sprite-muster.js?realm=183';
import { initCitizenInspector, resetCitizenTransitionLedger } from './citizen-inspector.js?realm=183';
import { updatePresentationCues } from './presentation-cues.js?realm=183';
import { resetCitizenOwnershipRuntime } from './citizen-ownership.js?realm=183';
import { resetCitizenRenderCache } from './citizen-render-cache.js?realm=183';


// ── Core → shell effect wiring (ENGINE.md rule 4) ───────────────────
// Core systems emit facts; the shell decides how they look and sound.
on('raid-started', ({ x, y }) => { try { panCameraTo(x, y, 800); } catch (_e) {} });
on('victory', () => setTimeout(() => showVictoryScreen(), 700));
on('realm-event', () => updateEventBanner());
on('era-advanced', ({ era }) => { if (!G.photoMode) showEraBanner(ERAS[era - 1]); });
on('season-changed', ({ season }) => {
  const seasonEmojis = { spring:['🌱','🌸','🌿'], summer:['☀️','🌻','🌊'], autumn:['🍂','🍁','🌾'], winter:['❄️','⛄','🌨️'] };
  const emojis = seasonEmojis[season] || ['✨'];
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
});
on('scenario-won', () => {
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
});

// ── Init ───────────────────────────────────────────────────
const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const queryParams = new URLSearchParams(location.search);
const spriteMusterMode = queryParams.has('spritemuster');
const runtimeCaptureMode = queryParams.has('runtimecapture');
initCitizenInspector({ enabled: queryParams.has('npcdebug') });

initRenderer(canvas);
initMinimap(minimap);
setMinimapViewportResolver(screenToWorld);
resizeCanvas();
initPostFX(canvas);
window.addEventListener('resize', () => { resizeCanvas(); resizePostFX(); });

// Query-gated visual verification hook for the sprite production pipeline.
// The in-app browser can inspect DOM attributes reliably even when its generic
// tab screenshot path times out on Realm's two high-resolution canvases.
// Nothing is encoded or added to the DOM during ordinary gameplay.
let _runtimeCaptureCanvas = null;
let _runtimeCaptureRequested = runtimeCaptureMode;
let _runtimeCaptureBusy = false;
let _runtimeCaptureResolvers = [];

function _finishRuntimeCapture(value, resolvers) {
  _runtimeCaptureBusy = false;
  for (const resolve of resolvers) resolve(value);
}

function _publishRuntimeCapture() {
  if (!runtimeCaptureMode || !_runtimeCaptureRequested || _runtimeCaptureBusy) return;
  _runtimeCaptureRequested = false;
  _runtimeCaptureBusy = true;
  // Only fulfill requests that existed when this capture began. A caller
  // arriving while PNG encoding is in flight must receive the next frame,
  // not the older image that happened to finish first.
  const captureResolvers = _runtimeCaptureResolvers;
  _runtimeCaptureResolvers = [];

  if (!_runtimeCaptureCanvas) {
    _runtimeCaptureCanvas = document.createElement('canvas');
  }
  if (
    _runtimeCaptureCanvas.width !== canvas.width
    || _runtimeCaptureCanvas.height !== canvas.height
  ) {
    _runtimeCaptureCanvas.width = canvas.width;
    _runtimeCaptureCanvas.height = canvas.height;
  }

  const captureCtx = _runtimeCaptureCanvas.getContext('2d');
  captureCtx.clearRect(0, 0, _runtimeCaptureCanvas.width, _runtimeCaptureCanvas.height);
  captureCtx.drawImage(canvas, 0, 0);
  const post = document.getElementById('postfx');
  if (post && post.style.display !== 'none') {
    captureCtx.drawImage(post, 0, 0);
  }

  let sink = document.getElementById('realm-runtime-capture');
  if (!sink) {
    sink = document.createElement('img');
    sink.id = 'realm-runtime-capture';
    sink.hidden = true;
    sink.alt = '';
    document.body.appendChild(sink);
  }

  // Encoding a full-DPR canvas with toDataURL() on every frame sample blocked
  // the main thread for a visible beat. Capture once on startup, then only on
  // explicit request, and let the browser encode off the render stack.
  const captureTick = G.gameTick;
  _runtimeCaptureCanvas.toBlob((blob) => {
    if (!blob) {
      _finishRuntimeCapture(null, captureResolvers);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      sink.src = String(reader.result || '');
      sink.dataset.tick = String(captureTick);
      _finishRuntimeCapture(sink.src, captureResolvers);
    };
    reader.onerror = () => _finishRuntimeCapture(null, captureResolvers);
    reader.readAsDataURL(blob);
  }, 'image/png');
}

window.captureRealmFrame = () => {
  if (!runtimeCaptureMode) return Promise.resolve(null);
  _runtimeCaptureRequested = true;
  return new Promise((resolve) => _runtimeCaptureResolvers.push(resolve));
};

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
    if (daysPassed < 1) return;  // sub-day absences aren't worth a summary ("0 days" read broken)
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
initSpriteLab();
if (spriteMusterMode) {
  try {
    initSpriteMuster(canvas);
  } catch (error) {
    console.error('Actor Muster failed to start:', error);
  }
}

window.openSpriteMuster = () => {
  const url = new URL(location.href);
  url.searchParams.delete('spritelab');
  url.searchParams.delete('role');
  url.searchParams.delete('action');
  url.searchParams.delete('dir');
  url.searchParams.delete('ambient');
  url.searchParams.set('spritemuster', '1');
  location.href = url.toString();
};

function syncAudioButtons() {
  const ambientBtn = document.getElementById('btn-ambient');
  if (ambientBtn) ambientBtn.textContent = isMasterMuted() ? '🔇' : '🔊';
}
syncAudioButtons();

// Only a fully valid save from the current Engine v2 epoch is visible.
const currentSaveSummary = getSaveSummary();
if (currentSaveSummary) {
  const loadBtn = document.getElementById('title-load');
  if (loadBtn) {
    const kName = currentSaveSummary.kingdomName !== 'Realm' ? currentSaveSummary.kingdomName : null;
    const day = currentSaveSummary.day;
    const pop = currentSaveSummary.population;
    const year = Math.floor((day - 1) / 28) + 1;
    const dayInYear = ((day - 1) % 28) + 1;
    const label = kName
      ? `Continue ${kName} · Year ${year} Day ${dayInYear} · Pop ${pop}`
      : `Continue · Year ${year} Day ${dayInYear} · Pop ${pop}`;
    loadBtn.textContent = label;
    loadBtn.style.display = 'inline-block';
  }
}

// Mark completed scenarios on title screen
if (currentSaveSummary) {
  const won = currentSaveSummary.scenariosWon;
  document.querySelectorAll('.scen-btn').forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    const match = onclick.match(/setScenario\(['"]([^'"]+)['"]\)/);
    if (match && won.includes(match[1])) {
      b.innerHTML = '✓ ' + b.innerHTML;
    }
  });
}

function beginGame({ resume = false } = {}) {
  document.body.classList.remove('title-active');
  const titleEl = document.getElementById('title-screen');
  titleEl.style.transition = 'opacity 0.5s';
  titleEl.style.opacity = '0';
  setTimeout(() => { titleEl.style.display = 'none'; }, 500);

  setupInput(canvas);
  initChronicle();
  resetCitizenTransitionLedger();
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
  // Responsive: on narrow viewports the missions panel starts collapsed —
  // it otherwise covers a third of the play area (the world canvas itself
  // is fully responsive; panels are the constraint).
  if (window.innerWidth < 900) {
    const mc = document.getElementById('missions-content');
    const mt = document.getElementById('missions-toggle');
    if (mc && mc.style.display !== 'none') {
      mc.style.display = 'none';
      if (mt) mt.textContent = '▶';
    }
  }
  gameLoop();

  // Continue preserves the saved camera. The founding zoom is presentation for
  // a new realm, not a mutation that should happen as part of loading one.
  if (resume) return;

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
  if (!Object.hasOwn(DIFFICULTY, d)) return;
  G.difficulty = d;
  document.querySelectorAll('.diff-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.diff === d);
  });
};

window.setScenario = (id) => {
  if (!SCENARIOS.some(scenario => scenario.id === id)) return;
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

function seedFromKingdomName(kingdomName) {
  let kh = 0;
  for (let i = 0; i < kingdomName.length; i++) {
    kh = ((kh << 5) - kh + kingdomName.charCodeAt(i)) | 0;
  }
  return Math.abs(kh) || 1;
}

// The sole fresh-realm initializer. Title-screen starts, in-game restarts, and
// tests all need the same authoritative defaults so newly added state cannot
// leak simply because one reset path forgot it.
function resetRealmForNewGame({ kingdomName = G.kingdomName } = {}) {
  const normalizedName = String(kingdomName || '').trim().slice(0, 20) || 'Realm';
  const scen = getActiveScenario();
  const debug = G.debug;

  resetRuntimeTransientState(G);
  resetCitizenOwnershipRuntime();
  resetCitizenRenderCache();

  Object.assign(G, {
    map: [],
    fog: [],
    buildingGrid: [],
    buildings: [],
    citizens: [],
    nextActorId: 1,
    avatar: null,
    caravans: [],
    walkers: [],
    soldiers: [],
    enemies: [],
    projectiles: [],
    chronicle: [],
    storyFlags: {},
    namedCharacters: {},
    deathMarkers: [],
    storyState: { lastProverbSeason: null, raid: null },
    notificationLog: [],
    resources: createResourceStock(scen.startResources),
    population: 3,
    maxPop: 3,
    happiness: 50,
    defense: 0,
    day: 1,
    dayPhase: Math.floor(G.dayLength * 0.22),
    gameTick: 0,
    speed: 1,
    obstacleEpoch: 0,
    totalResourcesGathered: 0,
    camera: { x: 0, y: (MAP_W / 2 + MAP_H / 2) * TH / 2, zoom: 1.3 },
    nextRaidDay: scen.raidStart,
    raidInterval: 8,
    lastRaidDay: null,
    lastDeathDay: null,
    lastUnderpopDay: null,
    realmEnded: false,
    researchedTechs: new Set(['agriculture', 'forestry']),
    currentResearch: null,
    activeEvent: null,
    eventModifiers: { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 },
    weather: 'clear',
    season: 'spring',
    rallyPoint: null,
    armyStance: 'defend',
    won: false,
    era: 1,
    eraStartDay: { 1: 1 },
    wonder: null,
    tileWear: null,
    kingdomName: normalizedName,
    stats: {
      buildingsBuilt: 0,
      buildingsLost: 0,
      raidsFaced: 0,
      citizensBorn: 0,
      citizensDied: 0,
      raidsSurvived: 0,
      enemiesKilled: 0,
      goldEarned: 0,
      daysLived: 0,
      housesEvolved: 0,
      scenariosWon: [],
      everHadBuilding: {},
    },
    _dailyFoodConsumed: 0,
    _lastDevolveNotice: null,
    _lastRaidFireDay: null,
    _milestone10: false,
    _milestone25: false,
    _milestone50: false,
    _milestone75: false,
    _moodDelta: 0,
    _patrolEmptyNotified: false,
    _patrolPosts: null,
    _patrolPostsBuildingCount: -1,
    _raidSide: null,
    _raidSpawnCount: 0,
    _raidStolen: null,
    _raidWarningGiven: false,
    _scenarioWon: false,
    _undoStack: [],
  });
  G.debug = debug;
  if (G.debug) G.debug.disableEvents = false;

  setSeed(seedFromKingdomName(G.kingdomName));
  generateWorld();
  resetCitizenTransitionLedger();
}

window.startNewGame = () => {
  const nameInput = document.getElementById('kingdom-name-input');
  resetRealmForNewGame({
    kingdomName: nameInput ? nameInput.value : 'Realm',
  });
  beginGame();
};

window.loadAndStart = () => {
  // Loading prepares and validates a detached candidate before touching the
  // live realm. A failed Continue stays on the title screen and does not
  // generate or partially initialize a replacement world.
  if (!loadGame()) return;
  renderBuildBar();
  updateUI();
  // Cross-session welcome-back. savedAt is shell metadata and never injected
  // into deterministic G state.
  try {
    const ch = G.chronicle;
    if (ch && ch.length > 0) {
      const last = ch[ch.length - 1];
      let prefix = '';
      const savedAt = getLastLoadedSavedAt();
      if (savedAt) {
        const waitMs = Date.now() - savedAt;
        const waitDays = Math.floor(waitMs / (24 * 60 * 60 * 1000));
        if (waitDays >= 1) {
          prefix = `Your realm has been waiting ${waitDays} day${waitDays === 1 ? '' : 's'}. `;
        } else if (waitMs >= 60 * 60 * 1000) {
          prefix = 'Your realm has been waiting a few hours. ';
        }
      }
      notifyTransient(`${prefix}Where we left off (day ${last.day}): ${last.text}`, 'info');
    }
  } catch (_e) {}
  beginGame({ resume: true });
};

// Expose for inline onclick handlers and console debugging
window.G = G;
G.debug = G.debug || {};
G.debug.lightCurve = lightCurve;
G.debug.tintCurve = tintCurve;
G.debug.dreamLens = realWorldDreamLens;
G.debug.renderBuildingIsolated = renderBuildingIsolated;
G.debug.fastForward = fastForward;  // 081: synchronous N-day advance
G.debug.disableEvents = false;
G.debug.pauseRendering = false;
// probe-harness: programmatic placement for chain/e2e tests — now routed
// through the command funnel so probe placements land in G._commandLog too.
G.debug.placeBuilding = (type, x, y) => dispatch({ type: 'PLACE_BUILDING', building: type, x, y }).ok;
G.debug.dispatch = dispatch;  // probe/console access to the full command surface
// probe-harness: advance exactly n core+shell ticks synchronously (no rAF
// dependency — background tabs throttle rAF, which starves frame-based probes).
G.debug.step = (n = 1) => { for (let i = 0; i < n; i++) { coreTick(); shellTick(); } return G.gameTick; };       // 356: probe-harness knob; suppresses drought/plague random-event rolls (active events still expire normally) — closes 355 pessimist finding
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
  resetRealmForNewGame();
  renderBuildBar(); renderMissions(); updateUI();
  notify('New game started!');
};
window.togglePopPanel = togglePopPanel;
window.toggleStats = toggleStatsPanel;
window.toggleTrade = toggleTradePanel;
window.doTrade = (partnerId, resource, amount) => {
  const res = dispatch({ type: 'TRADE', partner: partnerId, resource, amount });
  if (res.ok) {
    const r = res.result;
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

// ── Game Loop ──────────────────────────────────────────────
// The deterministic tick lives in sim.js (coreTick). What remains here
// is SHELL work: ambient/visual systems that tick alongside the core
// (per-client, Math.random allowed, excluded from the determinism
// hash) and throttled UI/meta gates.

// Ambient tick — runs once per core tick, shell-side (ENGINE.md
// two-tier sim). Two multiplayer clients may see different birds;
// they must never see different granaries.
function shellTick() {
  updatePresentationCues();
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
  updateParticles();
  updateSmokeEmitters();
  // Bird spawning — screen-space birds fly across sky during daytime.
  if (!G.birds) G.birds = [];
  if (G.gameTick % 400 === 0 && G.birds.length < 3 && getDaylight() > 0.6) {
    G.birds.push({
      x: -80 - Math.random() * 60,
      y: 80 + Math.random() * 120,
      vx: 0.8 + Math.random() * 0.5,
      vy: 0,
    });
  }
  emitCaravanDust();
}

let caravanDustTicks = new WeakMap();
function emitCaravanDust() {
  if (G.gameTick % 8 !== 0) return;
  for (const caravan of G.caravans) {
    if (caravanDustTicks.get(caravan) === G.gameTick) continue;
    caravanDustTicks.set(caravan, G.gameTick);
    G.particles.push({
      tx: caravan.x,
      ty: caravan.y,
      offsetY: -2,
      text: null,
      alpha: 0.4,
      vy: 0,
      decay: 0.02,
      type: 'dust',
      size: 2,
      vx: 0,
    });
  }
}

// Throttled UI/meta gates — run after each frame's tick batch. Authoritative
// story checks are a core system; this shell cadence only renders/presents.
let _gate30 = 0, _gate60 = 0, _gate120 = 0, _lastAutosave = 0;
function shellGates() {
  const t = G.gameTick;
  if (t - _gate30 >= 30) {
    _gate30 = t;
    // updateUI() already calls updateBuildBarAffordability() for in-place
    // cost/lock updates; full build-bar rebuilds happen on structural
    // events only (placement, research, undo, Escape) so clicks are
    // never eaten by an innerHTML wipe.
    updateUI();
    updateTutorialTip();
  }
  if (t - _gate60 >= 60) {
    _gate60 = t;
    renderMissions();
    renderResearchPanel();
    updateAmbient();
    checkAchievements();
  }
  if (t - _gate120 >= 120) {
    _gate120 = t;
    tickMusic();
    checkAdvisor();
  }
  if (t - _lastAutosave >= 3600) {
    _lastAutosave = t;
    if (t > 0) saveGame({ silent: true });
  }
}

// Fixed-timestep accumulator: 1× speed = 60 ticks per wall-clock second,
// independent of display refresh rate (ProMotion 120 Hz used to run the
// game twice as fast) and of tab visibility. Visible-frame catch-up stays
// tight for responsiveness; hidden tabs may recover up to four elapsed
// seconds per timer pass. Longer stalls are dropped instead of freezing UI.
const TICK_MS = 1000 / 60;
const MAX_TICKS_PER_FRAME = 30;
let _tickAccum = 0;
let _lastTickTime = 0;

function runPendingTicks(nowMs, {
  maxFrameMs = 500,
  maxTicks = MAX_TICKS_PER_FRAME,
} = {}) {
  if (_lastTickTime === 0) _lastTickTime = nowMs;
  let frameMs = nowMs - _lastTickTime;
  _lastTickTime = nowMs;
  if (frameMs < 0) frameMs = 0;
  if (frameMs > maxFrameMs) frameMs = maxFrameMs;
  if (G.speed <= 0) { _tickAccum = 0; return 0; }
  _tickAccum += (frameMs / TICK_MS) * G.speed;
  let n = Math.floor(_tickAccum);
  if (n > maxTicks) {
    n = maxTicks;
    _tickAccum = 0;
  } else {
    _tickAccum -= n;
  }
  for (let i = 0; i < n; i++) {
    stashPrevPositions();
    coreTick();
    shellTick();
  }
  if (n > 0) shellGates();
  // Interpolation alpha: fraction of the way to the NEXT tick. The
  // renderer draws every mover at lerp(prev, current, alpha), which is
  // what makes motion smooth at any refresh rate — frames that run 0 or
  // 2 ticks (accumulator remainder) otherwise strobe walkers (measured
  // step-size CV 0.47 before interpolation).
  G._renderAlpha = Math.max(0, Math.min(1, _tickAccum));
  return n;
}

// Snapshot pre-tick positions of everything the renderer draws in
// motion. Underscore fields: runtime-only, excluded from save + hash.
function stashPrevPositions() {
  const arrays = [G.citizens, G.soldiers, G.enemies, G.walkers, G.caravans, G.animals];
  for (const arr of arrays) {
    if (!arr) continue;
    for (const e of arr) { e._px = e.x; e._py = e.y; }
  }
  if (G.avatar) { G.avatar._px = G.avatar.x; G.avatar._py = G.avatar.y; }
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
  // Phase 0 rewrite: coreTick() is exactly one tick, so fast-forward is a
  // plain tick loop — no speed tricks. dayPhase advances 1/tick, so every
  // dayPhase-window story beats are sampled naturally by coreTick's
  // deterministic story@60 system.
  const maxIters = days * G.dayLength * 2 + 100;
  let iters = 0;
  while (G.day < targetDay && iters < maxIters) {
    coreTick();
    // Fast-forward intentionally skips the browser shell. Core systems may
    // emit presentation descriptors, so discard that resettable queue instead
    // of retaining days of invisible effects until render/save.
    if ((iters & 255) === 255 && G.particles.length) G.particles.length = 0;
    if (G.gameTick % 60 === 0) checkAchievements();
    iters++;
  }
  G.particles.length = 0;
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

// Loop 261 (the-fixer, 192 also-filed + 260 sibling): render subtle desaturation
// when G.realmEnded. The 192 commit added G.realmEnded and named two
// consumers: "chronicle stop" (closed at 260) + "render desat" (closed
// here). Together they complete the realm-end visual+textual story —
// chronicle stops writing AND world gets a muted fallen-realm grade. CSS filter on
// both the game canvas + postfx overlay covers the post-process layer.
// Tracked variable avoids every-frame DOM writes (only flips on
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
  const filterStr = G.realmEnded ? 'grayscale(0.18) saturate(0.82) brightness(0.94)' : '';
  canvas.style.filter = filterStr;
  const post = document.getElementById('postfx');
  if (post) post.style.filter = filterStr;
}

let _loopFrame = 0;
let _lastMinimapFrame = -Infinity;
let _perfAvgMs = 16.7;
let _rafAvgMs = 16.7;
let _lastLoopStart = 0;
let _postFxSuspendedUntil = 0;
let _postFxWasSuspended = false;
const _MINIMAP_FRAME_INTERVAL = 6;
const _POSTFX_SUSPEND_MS = 5000;
// rAF follows the display refresh rate, but painting above roughly 60 fps
// only repeats expensive canvas/post-processing work. Simulation still runs
// on every rAF; this gate skips presentation work only.
const _PAINT_INTERVAL_MS = 15.5;
let _lastPaintMs = 0;

function _setPostFxSuspended(suspended) {
  if (suspended === _postFxWasSuspended) return;
  _postFxWasSuspended = suspended;
  const post = document.getElementById('postfx');
  if (post) post.style.display = suspended ? 'none' : '';
}

function advanceFramePresentation(deltaMs) {
  const frameScale = Math.max(0, Math.min(6, deltaMs / (1000 / 60)));

  if (G._followAvatar && G.avatar && !G.dragging) {
    const target = toScreen(G.avatar.x, G.avatar.y);
    const follow = 1 - Math.pow(0.9, frameScale);
    G.camera.x += (target.x - G.camera.x) * follow;
    G.camera.y += (target.y - G.camera.y) * follow;
  }

  if (!G.clouds) {
    G.clouds = [
      { x: 100, y: 100, r: 180, vx: 0.15, alpha: 0.18 },
      { x: 400, y: 300, r: 220, vx: 0.12, alpha: 0.15 },
      { x: 700, y: 500, r: 160, vx: 0.18, alpha: 0.22 },
      { x: 1000, y: 800, r: 200, vx: 0.14, alpha: 0.16 },
    ];
  }
  for (const cloud of G.clouds) {
    cloud.x += cloud.vx * G.speed * frameScale;
    if (cloud.x > 3000) cloud.x = -500;
  }

  for (let i = G.birds.length - 1; i >= 0; i--) {
    const bird = G.birds[i];
    bird.x += bird.vx * frameScale;
    bird.y += (bird.vy || 0) * frameScale;
    if (bird.x > window.innerWidth + 50) G.birds.splice(i, 1);
  }

  if (G.weather === 'rain' || G.weather === 'storm') {
    if (!G._lightningTimer) G._lightningTimer = 300 + Math.random() * 600;
    G._lightningTimer -= frameScale;
    if (G._lightningTimer <= 0) {
      G._lightningFlash = 3;
      G._lightningTimer = 300 + Math.random() * 600;
    }
  } else {
    G._lightningTimer = null;
    G._lightningFlash = 0;
  }
  G._lightningFlash = Math.max(0, G._lightningFlash - frameScale);
  G.cameraShake = Math.max(0, G.cameraShake - 0.5 * frameScale);
  G.raidFlash = Math.max(0, G.raidFlash - 0.018 * frameScale);
}

function _renderFrame({ allowPostFx = true } = {}) {
  const frameStart = performance.now();
  advanceFramePresentation(G._renderDeltaMs || (1000 / 60));
  render();
  const now = performance.now();
  const postFxSuspended = now < _postFxSuspendedUntil;
  _setPostFxSuspended(postFxSuspended);
  if (allowPostFx && !postFxSuspended) {
    applyPostFX(canvas, G.gameTick, getDaylight(), getSeasonIndex());
  }
  if (_loopFrame - _lastMinimapFrame >= _MINIMAP_FRAME_INTERVAL) {
    renderMinimap();
    _lastMinimapFrame = _loopFrame;
  }
  _applyRealmEndFilter();
  _publishRuntimeCapture();

  const frameMs = performance.now() - frameStart;
  _perfAvgMs = _perfAvgMs * 0.92 + frameMs * 0.08;
  if (allowPostFx && _perfAvgMs > 34) {
    _postFxSuspendedUntil = performance.now() + _POSTFX_SUSPEND_MS;
  }
  G.debug.perf = {
    avgFrameMs: Math.round(_perfAvgMs * 10) / 10,
    avgRafMs: Math.round(_rafAvgMs * 10) / 10,
    postFxSuspended: performance.now() < _postFxSuspendedUntil,
    minimapInterval: _MINIMAP_FRAME_INTERVAL,
  };
}

function gameLoop() {
  try {
    if (document.visibilityState === 'visible') {
      const loopStart = performance.now();
      if (_lastLoopStart > 0) {
        const rafMs = loopStart - _lastLoopStart;
        G._renderDeltaMs = Math.max(1, Math.min(100, rafMs));
        _rafAvgMs = _rafAvgMs * 0.90 + rafMs * 0.10;
        if (_rafAvgMs > 34) {
          _postFxSuspendedUntil = loopStart + _POSTFX_SUSPEND_MS;
        }
      } else {
        G._renderDeltaMs = 1000 / 60;
      }
      _lastLoopStart = loopStart;
      runPendingTicks(loopStart);
      const sincePaint = loopStart - _lastPaintMs;
      if (sincePaint >= _PAINT_INTERVAL_MS) {
        const presentationDelta = _lastPaintMs > 0 ? sincePaint : (1000 / 60);
        _lastPaintMs = loopStart - (sincePaint % _PAINT_INTERVAL_MS);
        // Presentation state advances at paint cadence, not rAF cadence. On a
        // 120 Hz display this is about two rAF intervals per painted frame.
        G._renderDeltaMs = Math.max(1, Math.min(100, presentationDelta));
        _loopFrame++;
        if (!G.debug?.pauseRendering) _renderFrame();
      }
      requestAnimationFrame(gameLoop);
    } else {
      // Hidden tab: rAF is throttled off, so drive the same accumulator on a
      // timer with a larger bounded catch-up window.
      runPendingTicks(performance.now(), {
        maxFrameMs: 4000,
        maxTicks: 240 * Math.max(1, G.speed),
      });
      // Always paint at the hidden-tab cadence (timer-clamped to ~1-4fps):
      // embedded/preview contexts report 'hidden' while still being watched,
      // and returning to a never-painted canvas reads as frozen citizens.
      G._renderDeltaMs = 250;
      _loopFrame++;
      if (!G.debug?.pauseRendering) _renderFrame();
      setTimeout(gameLoop, 250);
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
