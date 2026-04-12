// ══════════════════════════════════════════════════════���═════
// REALM — Main entry point, game loop, initialization
// ════════════════════════════════════════════════════════════

import { G } from './state.js';
import { generateWorld } from './world.js';
import { initRenderer, resizeCanvas, render } from './render.js';
import { updateCitizens } from './citizens.js';
import { updateProduction, checkRaids } from './economy.js';
import { checkMissions, renderMissions } from './missions.js';
import { updateParticles, updateSmokeEmitters } from './particles.js';
import { setupInput } from './input.js';
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel, updateTutorialTip } from './ui.js';
import { updateResearch } from './tech.js';
import { checkRandomEvents, updateEventBanner } from './events.js';
import { saveGame } from './save.js';

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

// Expose for inline onclick handlers and console debugging
window.G = G;
window.setSpeed = setSpeed;
window.toggleResearch = toggleResearchPanel;
window.toggleHappiness = toggleHappinessPanel;

showToast('Welcome to Realm. Build your settlement!');

// ── Day/Night ──────────────────────────────────────────────
function updateTime() {
  G.dayPhase += G.speed;
  if (G.dayPhase >= G.dayLength) {
    G.dayPhase = 0;
    G.day++;
    checkRaids();
    checkRandomEvents();
  }
}

// ── Game Loop ──────────────────────────────────────────────
function gameLoop() {
  try {
    if (G.speed > 0) {
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
      if (G.gameTick % 3600 === 0) saveGame();
    }
    render();
  } catch (e) {
    console.error('Game loop error:', e);
  }
  // Use rAF when visible, setTimeout when hidden (Chrome pauses rAF for hidden tabs)
  if (document.visibilityState === 'visible') {
    requestAnimationFrame(gameLoop);
  } else {
    setTimeout(gameLoop, 1000 / 60);
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
