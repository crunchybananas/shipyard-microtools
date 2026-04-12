// ══════════════════════════════════════════════════════���═════
// REALM — Main entry point, game loop, initialization
// ════════════════════════════════════════════════════════════

import { G, updateSeason, getSeasonData } from './state.js';
import { generateWorld } from './world.js';
import { initRenderer, resizeCanvas, render } from './render.js';
import { updateCitizens } from './citizens.js';
import { updateProduction, checkRaids } from './economy.js';
import { checkMissions, renderMissions } from './missions.js';
import { updateParticles, updateSmokeEmitters } from './particles.js';
import { setupInput } from './input.js';
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel, updateTutorialTip, dismissTutorial, togglePopPanel } from './ui.js';
import { updateResearch } from './tech.js';
import { checkRandomEvents, updateEventBanner } from './events.js';
import { saveGame } from './save.js';
import { updateAmbient, toggleAmbient, isAmbientEnabled } from './audio.js';
import { loadAchievements, checkAchievements, getUnlockedCount, renderAchievementsPanel, ACHIEVEMENTS } from './achievements.js';

// ── Init ───────────────────────────────────────────────────
const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');

initRenderer(canvas, minimap);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

generateWorld();
setupInput(canvas);
renderBuildBar();
renderMissions();
updateUI();
setupSaveButtons();
loadAchievements();

// Expose for inline onclick handlers and console debugging
window.G = G;
window.setSpeed = setSpeed;
window.toggleResearch = toggleResearchPanel;
window.toggleHappiness = toggleHappinessPanel;
window.dismissTutorial = dismissTutorial;
window.newGame = () => {
  if (!confirm('Start a new game? Current unsaved progress will be lost.')) return;
  // Reset all state
  G.buildings = []; G.citizens = []; G.caravans = []; G.particles = [];
  G.resources = { wood:60, stone:30, food:80, gold:25, iron:0 };
  G.population = 3; G.maxPop = 3; G.happiness = 50; G.defense = 0;
  G.day = 1; G.dayPhase = 0; G.gameTick = 0; G.speed = 1;
  G.selectedBuild = null; G.selectedBuilding = null;
  G.nextRaidDay = 8; G.raidInterval = 8;
  G.researchedTechs = new Set(['agriculture','forestry']);
  G.currentResearch = null;
  G.activeEvent = null;
  G.eventModifiers = { foodProd:1, goldProd:1, happinessOffset:0 };
  G.season = 'spring'; G.won = false;
  G.resourceRates = { wood:0, stone:0, food:0, gold:0, iron:0 };
  G.lastResources = null;
  generateWorld();
  renderBuildBar(); renderMissions(); updateUI();
  showToast('New game started!');
};
window.togglePopPanel = togglePopPanel;
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

showToast('Welcome to Realm. Build your settlement!');

// ── Day/Night ──────────────────────────────────────────────
function updateTime() {
  G.dayPhase += G.speed;
  if (G.dayPhase >= G.dayLength) {
    G.dayPhase = 0;
    G.day++;
    checkRaids();
    checkRandomEvents();
    if (updateSeason()) {
      const s = getSeasonData();
      showToast(`Season changed: ${s.name}`);
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
    updateProduction();
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
  if (G.gameTick % 60 === 0) { updateAmbient(); checkAchievements(); }
  if (G.gameTick % 3600 === 0) saveGame();
}

function gameLoop() {
  try {
    if (document.visibilityState === 'visible') {
      simTick();
      render();
      requestAnimationFrame(gameLoop);
    } else {
      // Hidden tab: Chrome throttles setTimeout to ~1/sec.
      // Batch 60 sim ticks per call to keep game running at full speed.
      for (let i = 0; i < 60; i++) simTick();
      setTimeout(gameLoop, 16);
    }
  } catch (e) {
    console.error('Game loop error:', e);
    setTimeout(gameLoop, 100); // retry after error
  }
}

gameLoop();

// ── Toast helper (globally accessible) ─────────────────────
function showToast(msg, danger = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}
