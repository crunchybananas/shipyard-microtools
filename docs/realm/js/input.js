// ════════════════════════════════════════════════════════════
// Input — mouse, keyboard, touch, camera
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H } from './state.js';
import { screenToWorld } from './render.js';
import { placeBuilding, demolishBuilding } from './economy.js';
import { initAudio, playSound } from './audio.js';
import { renderBuildBar, updateUI, showInfoPanel, hideInfoPanel } from './ui.js';
import { renderMissions } from './missions.js';

export function setupInput(canvas) {
  const C = canvas;
  let touchDist = 0;

  C.addEventListener('contextmenu', e => e.preventDefault());

  C.addEventListener('mousedown', e => {
    initAudio();

    // Right-click demolish
    if (e.button === 2) {
      e.preventDefault();
      const t = screenToWorld(e.clientX, e.clientY);
      const b = G.buildings.find(b => b.x === t.x && b.y === t.y);
      if (b) {
        demolishBuilding(b);
        G.selectedBuilding = null;
        hideInfoPanel();
        updateUI(); renderBuildBar();
      }
      return;
    }

    // Left-click build
    if (e.button === 0 && G.selectedBuild) {
      const t = screenToWorld(e.clientX, e.clientY);
      if (placeBuilding(G.selectedBuild, t.x, t.y)) {
        renderBuildBar();
        renderMissions();
        updateUI();
      } else {
        // Build failed — show feedback
        playSound('click');
        // Flash the hovered tile red briefly via a temporary particle
        G.particles.push({
          tx: t.x, ty: t.y, offsetY: -10,
          text: '❌ Can\'t build here',
          alpha: 1.2, vy: -0.3, decay: 0.025, type: 'text',
        });
      }
      return;
    }

    // Left-click select building
    if (e.button === 0 && !G.selectedBuild) {
      const t = screenToWorld(e.clientX, e.clientY);
      const b = G.buildings.find(b => b.x === t.x && b.y === t.y);
      if (b) {
        G.selectedBuilding = b;
        showInfoPanel(b);
        return;
      } else {
        G.selectedBuilding = null;
        hideInfoPanel();
      }
    }

    // Pan
    G.dragging = true;
    G.dragStart = { x: e.clientX, y: e.clientY };
    G.camStart = { x: G.camera.x, y: G.camera.y };
  });

  C.addEventListener('mousemove', e => {
    if (G.dragging) {
      G.camera.x = G.camStart.x - (e.clientX - G.dragStart.x) / G.camera.zoom;
      G.camera.y = G.camStart.y - (e.clientY - G.dragStart.y) / G.camera.zoom;
    }
    G.hoveredTile = screenToWorld(e.clientX, e.clientY);
  });

  C.addEventListener('mouseup', () => { G.dragging = false; });

  C.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * delta));
  }, { passive: false });

  // Touch
  C.addEventListener('touchstart', e => {
    initAudio();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      if (G.selectedBuild) {
        const tile = screenToWorld(t.clientX, t.clientY);
        if (placeBuilding(G.selectedBuild, tile.x, tile.y)) {
          renderBuildBar(); renderMissions(); updateUI();
        }
        return;
      }
      G.dragging = true;
      G.dragStart = { x: t.clientX, y: t.clientY };
      G.camStart = { x: G.camera.x, y: G.camera.y };
    }
    if (e.touches.length === 2) {
      touchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  });

  C.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && G.dragging) {
      const t = e.touches[0];
      G.camera.x = G.camStart.x - (t.clientX - G.dragStart.x) / G.camera.zoom;
      G.camera.y = G.camStart.y - (t.clientY - G.dragStart.y) / G.camera.zoom;
      G.hoveredTile = screenToWorld(t.clientX, t.clientY);
    }
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * (d / touchDist)));
      touchDist = d;
    }
  }, { passive: false });

  C.addEventListener('touchend', () => { G.dragging = false; });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { G.selectedBuild = null; G.selectedBuilding = null; hideInfoPanel(); renderBuildBar(); }
    if (e.key >= '1' && e.key <= '9') {
      const keys = Object.keys(BUILDINGS);
      const idx = parseInt(e.key) - 1;
      if (idx < keys.length) {
        G.selectedBuild = G.selectedBuild === keys[idx] ? null : keys[idx];
        renderBuildBar();
      }
    }
  });

  // Minimap click
  const minimap = document.getElementById('minimap');
  if (minimap) {
    minimap.addEventListener('click', e => {
      const rect = minimap.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / 160 * MAP_W;
      const my = (e.clientY - rect.top) / 160 * MAP_H;
      const { toScreen } = import('./render.js').then ? {} : {};
      // Direct import to avoid async
      G.camera.x = (mx - my) * 32;
      G.camera.y = (mx + my) * 16;
    });
  }
}
