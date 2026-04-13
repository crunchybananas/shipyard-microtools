// ════════════════════════════════════════════════════════════
// Input — mouse, keyboard, touch, camera
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TW, TH } from './state.js';
import { screenToWorld, toScreen } from './render.js';
import { placeBuilding, demolishBuilding } from './economy.js';
import { initAudio, playSound } from './audio.js';
import { renderBuildBar, updateUI, showInfoPanel, hideInfoPanel } from './ui.js';
import { renderMissions } from './missions.js';

// Standard isometric hit test: screen-space bounding box, depth-sorted (front wins)
function findBuildingAtClick(clientX, clientY) {
  const C = document.getElementById('game');
  const rect = C.getBoundingClientRect();
  // Convert click to canvas pixels, then to world iso-screen coords
  const cpx = (clientX - rect.left) * (C.width / rect.width);
  const cpy = (clientY - rect.top) * (C.height / rect.height);
  const wx = (cpx - C.width/2) / G.camera.zoom + G.camera.x;
  const wy = (cpy - C.height/2) / G.camera.zoom + G.camera.y;

  // Test all buildings, keep the frontmost (highest screen Y = closest to camera) hit
  let best = null, bestY = -Infinity;
  for (const b of G.buildings) {
    const bs = toScreen(b.x, b.y);
    // Screen-space bounding box of the building sprite (with 1.3x scale)
    // Buildings render from ~45px above tile center to ~10px below
    const hitLeft   = bs.x - 22;
    const hitRight  = bs.x + 22;
    const hitTop    = bs.y - 48;
    const hitBottom = bs.y + 10;

    if (wx >= hitLeft && wx <= hitRight && wy >= hitTop && wy <= hitBottom) {
      // Depth sort: higher bs.y = rendered later = in front
      if (bs.y > bestY) {
        bestY = bs.y;
        best = b;
      }
    }
  }
  return best;
}

// Find citizen at screen position — small radius around citizen sprite
function findCitizenAtClick(clientX, clientY) {
  const C = document.getElementById('game');
  const rect = C.getBoundingClientRect();
  const cpx = (clientX - rect.left) * (C.width / rect.width);
  const cpy = (clientY - rect.top) * (C.height / rect.height);
  const wx = (cpx - C.width/2) / G.camera.zoom + G.camera.x;
  const wy = (cpy - C.height/2) / G.camera.zoom + G.camera.y;

  let best = null, bestDist = Infinity;
  for (const c of G.citizens) {
    const cs = toScreen(c.x, c.y);
    const dx = wx - cs.x;
    const dy = wy - (cs.y - 8); // citizen visual center is ~8px above tile
    const dist = dx*dx + dy*dy;
    if (dist < 15*15 && dist < bestDist) { // 15px radius
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function showCitizenPanel(c) {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  const stateLabels = {
    idle:'Idle', find_job:'Looking for work', walk_to_work:'Walking to work',
    working:'Working', walk_to_deliver:'Delivering', deliver:'Delivering',
    foraging:'Foraging', eating:'Eating',
  };
  const state = stateLabels[c.state] || c.state;
  const job = c.jobBuilding ? BUILDINGS[c.jobBuilding.type]?.name : 'Unemployed';
  const carrying = c.carrying ? `${c.carryAmount} ${c.carrying}` : 'Nothing';

  panel.innerHTML = `
    <div class="ip-header">
      <span class="ip-title">👤 ${c.name}</span>
      <button class="ip-close" onclick="hideInfoPanel()">✕</button>
    </div>
    <div class="ip-desc">${state}</div>
    <div class="ip-row"><span class="ip-label">Job</span><span class="ip-val">${job}</span></div>
    <div class="ip-row"><span class="ip-label">Carrying</span><span class="ip-val">${carrying}</span></div>
    <div class="ip-row"><span class="ip-label">Hunger</span><span class="ip-val">${Math.round(c.hunger)}%</span></div>
    <div class="ip-hint">Citizens auto-assign to buildings that need workers.</div>
  `;
  panel.style.display = 'block';
  requestAnimationFrame(() => panel.classList.add('ip-visible'));
}

function tryPlaceAt(tx, ty) {
  if (placeBuilding(G.selectedBuild, tx, ty)) {
    renderBuildBar();
    renderMissions();
    updateUI();
    return true;
  }
  return false;
}

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
      const b = findBuildingAtClick(e.clientX, e.clientY);
      if (b) {
        demolishBuilding(b);
        G.selectedBuilding = null;
        hideInfoPanel();
        updateUI(); renderBuildBar();
      }
      return;
    }

    // Left-click build (+ drag-to-paint for roads/walls)
    if (e.button === 0 && G.selectedBuild) {
      const t = screenToWorld(e.clientX, e.clientY);
      tryPlaceAt(t.x, t.y);
      // Enable drag-painting for cheap repeatable buildings
      const paintable = G.selectedBuild === 'road' || G.selectedBuild === 'wall';
      if (paintable) {
        G._paintMode = true;
        G._lastPaintTile = { x: t.x, y: t.y };
      }
      return;
    }

    // Left-click select citizen or building
    if (e.button === 0 && !G.selectedBuild) {
      // Check citizens first (they render in front of buildings)
      const cit = findCitizenAtClick(e.clientX, e.clientY);
      if (cit) {
        G.selectedBuilding = null;
        G.selectedCitizen = cit;
        showCitizenPanel(cit);
        return;
      }
      const b = findBuildingAtClick(e.clientX, e.clientY);
      if (b) {
        G.selectedBuilding = b;
        G.selectedCitizen = null;
        showInfoPanel(b);
        return;
      } else {
        G.selectedBuilding = null;
        G.selectedCitizen = null;
        hideInfoPanel();
      }
    }

    // Pan
    G.dragging = true;
    G.dragStart = { x: e.clientX, y: e.clientY };
    G.camStart = { x: G.camera.x, y: G.camera.y };
  });

  C.addEventListener('mousemove', e => {
    // Drag-to-paint roads/walls
    if (G._paintMode && G.selectedBuild && e.buttons === 1) {
      const t = screenToWorld(e.clientX, e.clientY);
      if (!G._lastPaintTile || t.x !== G._lastPaintTile.x || t.y !== G._lastPaintTile.y) {
        tryPlaceAt(t.x, t.y);
        G._lastPaintTile = { x: t.x, y: t.y };
      }
    }
    if (G.dragging) {
      // Safety: if no mouse button is held (e.g. mouseup missed by automation), stop dragging
      if (e.buttons === 0) { G.dragging = false; G._paintMode = false; return; }
      G.camera.x = G.camStart.x - (e.clientX - G.dragStart.x) / G.camera.zoom;
      G.camera.y = G.camStart.y - (e.clientY - G.dragStart.y) / G.camera.zoom;
    }
    G.hoveredTile = screenToWorld(e.clientX, e.clientY);
  });

  C.addEventListener('mouseup', () => { G.dragging = false; G._paintMode = false; });
  C.addEventListener('mouseleave', () => { G.dragging = false; G._paintMode = false; });
  window.addEventListener('mouseup', () => { G.dragging = false; G._paintMode = false; });

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
      G.camera.zoom = 1.3;
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

  // WASD + arrow key camera movement
  const heldKeys = new Set();
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    heldKeys.add(e.key.toLowerCase());
  });
  document.addEventListener('keyup', e => {
    heldKeys.delete(e.key.toLowerCase());
  });

  function keyPanTick() {
    if (G.speed >= 0) { // even when paused, allow camera movement
      const panSpeed = 6 / G.camera.zoom;
      let dx = 0, dy = 0;
      if (heldKeys.has('w') || heldKeys.has('arrowup')) dy = -panSpeed;
      if (heldKeys.has('s') || heldKeys.has('arrowdown')) dy = panSpeed;
      if (heldKeys.has('a') || heldKeys.has('arrowleft')) dx = -panSpeed;
      if (heldKeys.has('d') || heldKeys.has('arrowright')) dx = panSpeed;
      if (dx || dy) {
        G.camera.x += dx;
        G.camera.y += dy;
      }
    }
    requestAnimationFrame(keyPanTick);
  }
  keyPanTick();

}
