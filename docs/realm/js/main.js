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
import { updateUI, renderBuildBar, setSpeed, setupSaveButtons, renderResearchPanel, toggleResearchPanel, toggleHappinessPanel } from './ui.js';
import { updateResearch } from './tech.js';
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

// Expose for inline onclick handlers
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
  }
}

// ── Game Loop ──────────────────────────────────────────────
function gameLoop() {
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
        renderResearchPanel(); // refresh progress bar
      }
    }
    if (G.gameTick % 30 === 0) {
      updateUI();
      renderBuildBar(); // refresh affordability
    }
    // Auto-save every ~60s at speed 1
    if (G.gameTick % 3600 === 0) saveGame();
  }
  render();
  requestAnimationFrame(gameLoop);
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
