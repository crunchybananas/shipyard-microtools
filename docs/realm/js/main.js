// ══════════════════════════════════════════════════════���═════
// REALM — Main entry point, game loop, initialization
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, updateSeason, getSeasonData, getDifficulty, DIFFICULTY, getDaylight, getSeasonIndex } from './state.js';
import { initPostFX, applyPostFX, resizePostFX } from './postfx.js';
import { generateWorld } from './world.js';
import { initRenderer, resizeCanvas, render } from './render.js';
import { updateCitizens } from './citizens.js';
import { updateSoldiers } from './soldiers.js';
import { updateProduction, checkRaids, collectTaxes, updateFires } from './economy.js';
import { checkMissions, renderMissions } from './missions.js';
import { updateParticles, updateSmokeEmitters } from './particles.js';
import { setupInput } from './input.js';
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel, updateTutorialTip, dismissTutorial, togglePopPanel, hideInfoPanel, toggleStatsPanel, toggleTradePanel, renderTradePanel } from './ui.js';
import { updateResearch } from './tech.js';
import { checkRandomEvents, updateEventBanner } from './events.js';
import { saveGame, getSaveSize } from './save.js';
import { updateAmbient, toggleAmbient, isAmbientEnabled, playSound, tickMusic, toggleMusic } from './audio.js';
import { toggleNotificationLog, notify } from './notifications.js';
import { executeTrade } from './trade.js';
import { loadAchievements, checkAchievements, getUnlockedCount, renderAchievementsPanel, ACHIEVEMENTS } from './achievements.js';
import { updateEnemies, updateProjectiles, updateTowers } from './combat.js';
import { getActiveScenario, checkScenarioComplete } from './scenarios.js';
import { updateWalkers } from './walkers.js';
import { updateAnimals } from './animals.js';
import { checkAdvisor } from './advisor.js';
import { initGL3D, buildTerrainMesh, buildBuildingsMesh, render3D, resize3D } from './webgl3d.js';
import { updateBoats, updateFlocks, updateBalloons, updateWolves, updateCarts, updateRainbow, updateHawks, updatePuddles, updateFootprints, updateSnowmen, enhUpdateAll } from './enhancements.js';
import { initChronicle, chronicle, toggleChroniclePanel, checkStoryBeats } from './story.js';

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
setupSaveButtons();
loadAchievements();

// Check for existing save to show Continue button with file size
const hasSaveData = !!localStorage.getItem('realm-save-v2');
if (hasSaveData) {
  const loadBtn = document.getElementById('title-load');
  if (loadBtn) {
    const bytes = getSaveSize();
    const kb = (bytes / 1024).toFixed(1);
    loadBtn.textContent = `📁 Continue (${kb} KB)`;
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

  setupInput(canvas);
  initChronicle();
  if (G.chronicle.length === 0) {
    chronicle(`The realm of ${G.kingdomName} is founded. Three settlers arrive seeking a home.`, 'milestone');
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
};

window.startNewGame = () => {
  // Apply difficulty settings to starting resources
  const diff = getDifficulty();
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
  const nameInput = document.getElementById('kingdom-name-input');
  G.kingdomName = (nameInput && nameInput.value.trim()) || 'Realm';
  beginGame();
};

window.loadAndStart = () => {
  generateWorld();
  if (gl3dReady) buildTerrainMesh(); // pre-build 3D mesh after world gen
  if (loadGame()) {
    renderBuildBar();
    updateUI();
  }
  beginGame();
};

// Expose for inline onclick handlers and console debugging
window.G = G;
window.forceRender = render;
window.setSpeed = setSpeed;
window.toggleResearch = toggleResearchPanel;
window.toggleHappiness = toggleHappinessPanel;
window.dismissTutorial = dismissTutorial;
window.hideInfoPanel = hideInfoPanel;
window.toggleLog = toggleNotificationLog;
window.newGame = () => {
  if (!confirm('Start a new game? Current unsaved progress will be lost.')) return;
  // Reset all state
  G.buildings = []; G.citizens = []; G.caravans = []; G.walkers = []; G.particles = []; G.soldiers = []; G.enemies = []; G.projectiles = []; G.animals = [];
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
  G.stats = { buildingsBuilt:0, buildingsLost:0, citizensBorn:0, citizensDied:0, raidsSurvived:0, enemiesKilled:0, goldEarned:0, daysLived:0 };
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
    notify('Not enough resources for this trade', 'danger');
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
window.toggleMissions = () => {
  const c = document.getElementById('missions-content');
  const t = document.getElementById('missions-toggle');
  if (!c) return;
  const open = c.style.display !== 'none';
  c.style.display = open ? 'none' : 'block';
  if (t) t.textContent = open ? '▶' : '▼';
};

notify('Welcome to Realm. Build your settlement!', 'info');

// ── Day/Night ──────────────────────────────────────────────
function updateTime() {
  G.dayPhase += G.speed;
  if (G.dayPhase >= G.dayLength) {
    G.dayPhase = 0;
    G.day++;
    if (G.stats) G.stats.daysLived++;
    // Bell toll at dawn if church exists
    playSound('bellToll');
    const _raidDayBefore = G.nextRaidDay;
    collectTaxes();
    checkRaids();
    if (G.stats && G.nextRaidDay > _raidDayBefore) G.stats.raidsSurvived++;
    checkRandomEvents();
    if (updateSeason()) {
      const s = getSeasonData();
      const seasonNum = Math.floor((G.day - 1) / 7) + 1;
      notify(`${s.name} begins! (Season ${seasonNum})`, 'event');
      playSound('mission');
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
    updateParticles();
    updateSmokeEmitters();
    updateResearch();
    if (G.gameTick % 60 === 0) {
      checkMissions();
      renderMissions();
      renderResearchPanel();
    }
  }
  if (G.gameTick % 30 === 0) {
    updateUI();
    renderBuildBar();
    updateTutorialTip();
  }
  if (G.gameTick % 60 === 0) { updateAmbient(); checkAchievements(); checkStoryBeats(); }
  if (G.gameTick % 120 === 0) { tickMusic(); checkAdvisor(); }
  if (G.gameTick % 120 === 0 && !G._scenarioWon) {
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
  // Bird spawning — screen-space birds fly across sky during daytime
  if (!G.birds) G.birds = [];
  if (G.gameTick % 400 === 0 && G.birds.length < 3 && getDaylight() > 0.6) {
    G.birds.push({
      x: -50 + Math.random() * 200,
      y: 50 + Math.random() * 100,
      vx: 0.5 + Math.random() * 0.5,
      vy: 0,
    });
  }
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
      requestAnimationFrame(gameLoop);
    } else {
      for (let i = 0; i < 60; i++) simTick();
      render();
      applyPostFX(canvas, G.gameTick, getDaylight(), getSeasonIndex());
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
