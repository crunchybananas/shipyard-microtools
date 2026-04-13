// ════════════════════════════════════════════════════════════
// Input — mouse, keyboard, touch, camera
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TW, TH } from './state.js';
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
    if (e.target !== C) return;
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
        // Build failed — show specific reason
        playSound('click');
        let reason = "Can't build here";
        const def = BUILDINGS[G.selectedBuild];
        if (t.x < 0 || t.x >= MAP_W || t.y < 0 || t.y >= MAP_H) reason = 'Out of bounds';
        else if (!G.fog[t.y]?.[t.x]) reason = 'Unexplored area';
        else if (G.map[t.y]?.[t.x] === 0) reason = 'Can\'t build on water';
        else if (G.map[t.y]?.[t.x] === 6) reason = 'Can\'t build on mountains';
        else if (G.buildingGrid[t.y]?.[t.x]) reason = 'Tile already occupied';
        else if (def?.on && !def.on.includes(G.map[t.y]?.[t.x])) {
          const names = { 1:'Sand', 3:'Forest', 4:'Stone', 5:'Iron' };
          const needed = def.on.map(n => names[n]).join('/');
          reason = `Requires ${needed} tile`;
        }
        G.particles.push({
          tx: t.x, ty: t.y, offsetY: -10,
          text: `❌ ${reason}`,
          alpha: 1.4, vy: -0.25, decay: 0.018, type: 'text',
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
      // Safety: if no mouse button is held (e.g. mouseup missed by automation), stop dragging
      if (e.buttons === 0) { G.dragging = false; return; }
      G.camera.x = G.camStart.x - (e.clientX - G.dragStart.x) / G.camera.zoom;
      G.camera.y = G.camStart.y - (e.clientY - G.dragStart.y) / G.camera.zoom;
    }
    G.hoveredTile = screenToWorld(e.clientX, e.clientY);
  });

  C.addEventListener('mouseup', () => { G.dragging = false; });
  C.addEventListener('mouseleave', () => { G.dragging = false; });
  window.addEventListener('mouseup', () => { G.dragging = false; });

  C.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * delta));
  }, { passive: false });

  // Touch
  C.addEventListener('touchstart', e => {
    if (e.target !== C) return;
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
    if (e.key === 'Home' || e.key === 'h') {
      // Recenter camera on island center
      const cx = MAP_W / 2, cy = MAP_H / 2;
      G.camera.x = (cx - cy) * TW / 2;
      G.camera.y = (cx + cy) * TH / 2;
      G.camera.zoom = 1;
      return;
    }
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      const h = document.getElementById('help-overlay');
      if (h) h.style.display = h.style.display === 'none' ? 'flex' : 'none';
      return;
    }
    if (e.key >= '1' && e.key <= '9') {
      const keys = Object.keys(BUILDINGS);
      const idx = parseInt(e.key) - 1;
      if (idx < keys.length) {
        G.selectedBuild = G.selectedBuild === keys[idx] ? null : keys[idx];
        renderBuildBar();
      }
    }
  });

  // Minimap click — jump camera to clicked position
  const minimap = document.getElementById('minimap');
  if (minimap) {
    minimap.addEventListener('click', e => {
      const rect = minimap.getBoundingClientRect();
      const tileX = (e.clientX - rect.left) / rect.width * MAP_W;
      const tileY = (e.clientY - rect.top) / rect.height * MAP_H;
      // Iso projection: toScreen(tx,ty) = { x:(tx-ty)*TW/2, y:(tx+ty)*TH/2 }
      G.camera.x = (tileX - tileY) * 32;
      G.camera.y = (tileX + tileY) * 16;
    });
  }

}
