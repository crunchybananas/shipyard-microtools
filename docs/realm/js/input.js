// ════════════════════════════════════════════════════════════
// Input — mouse, keyboard, touch, camera
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TW, TH } from './state.js?realm=186';
import { screenToWorld, toScreen, toggleFPS } from './render.js?realm=186';
import { canAfford } from './economy.js?realm=186';
import { dispatch } from './commands.js?realm=186';
import { notify } from './notifications.js?realm=186';
import { initAudio } from './audio.js?realm=186';
import { renderBuildBar, updateUI, showInfoPanel, hideInfoPanel, setSpeed, renderMissions } from './ui.js?realm=186';
import { buildCurrentCitizenPresentations } from './citizen-presentation.js?realm=186';

const escapeHtml = value => String(value).replace(
  /[&<>"']/g,
  character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character],
);

function pickTile(clientX, clientY) {
  return screenToWorld(clientX, clientY);
}

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
    // Screen-space bounding box of the building sprite. Buildings render with
    // a 1.3x scale around (bs.x, bs.y); box widened to cover the visible sprite
    // so clicks near the roof or base don't fall through to the grass tile.
    const hitLeft   = bs.x - 28;
    const hitRight  = bs.x + 28;
    const hitTop    = bs.y - 56;
    const hitBottom = bs.y + 16;

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
  for (const c of buildCurrentCitizenPresentations()) {
    const cs = toScreen(c.x, c.y);
    const dx = wx - cs.x;
    const dy = wy - (cs.y - 8); // citizen visual center is ~8px above tile
    const dist = dx*dx + dy*dy;
    // Loop 031 (the-fixer, closing 027 finding): bumped hit radius from
    // 15px to 22px. The sprite visual extent at 1.3× zoom is roughly
    // 22px tall by 14px wide; the old 15px hit-box missed many clicks
    // that visually landed on the citizen's head/shoulders. 22px gives
    // a generous circle that matches the visual footprint without
    // overlapping neighboring citizens at typical spacing.
    if (dist < 22*22 && dist < bestDist) { // 22px radius
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
    go_home:'Heading home', sleep:'Sleeping', leisure:'Off to unwind',
  };
  const state = stateLabels[c.activity.kind] || c.activity.kind;
  const assigned = c.assignment;
  const jobName = assigned ? BUILDINGS[assigned.building.type]?.name || assigned.building.type : null;
  const job = assigned
    ? `${assigned.purpose === 'temporary' ? 'Helping' : 'Assigned'}: ${assigned.building.complete ? jobName : `build ${jobName}`}`
    : 'Unassigned';
  const carrying = c.carrying ? `${c.carryAmount} ${c.carrying}` : 'Nothing';
  const safe = {
    name: escapeHtml(c.identity.name),
    state: escapeHtml(state),
    profession: escapeHtml(c.profession.kind),
    job: escapeHtml(job),
    reason: escapeHtml(c.activity.reason),
    carrying: escapeHtml(carrying),
  };

  panel.innerHTML = `
    <div class="ip-header">
      <span class="ip-title">👤 ${safe.name}</span>
      <button class="ip-close" onclick="hideInfoPanel()">✕</button>
    </div>
    <div class="ip-desc">${safe.state}</div>
    <div class="ip-row"><span class="ip-label">Vocation</span><span class="ip-val">${safe.profession}</span></div>
    <div class="ip-row"><span class="ip-label">Assignment</span><span class="ip-val">${safe.job}</span></div>
    <div class="ip-row"><span class="ip-label">Activity</span><span class="ip-val">${safe.state} · ${safe.reason}</span></div>
    <div class="ip-row"><span class="ip-label">Carrying</span><span class="ip-val">${safe.carrying}</span></div>
    <div class="ip-row"><span class="ip-label">Hunger</span><span class="ip-val">${Math.round(c.hunger)}%</span></div>
    <div class="ip-row"><span class="ip-label">Energy</span><span class="ip-val">${Math.round(c.rest ?? 100)}%</span></div>
    <div class="ip-row"><span class="ip-label">Joy</span><span class="ip-val">${Math.round(c.needs.joy)}%</span></div>
    <div class="ip-row"><span class="ip-label">Faith</span><span class="ip-val">${Math.round(c.needs.faith)}%</span></div>
    <div class="ip-hint">Citizens auto-assign to buildings that need workers.</div>
  `;
  panel.dataset.citizenActorId = String(c.actorId);
  panel.style.display = 'block';
  requestAnimationFrame(() => panel.classList.add('ip-visible'));
}

function tryPlaceAt(tx, ty) {
  if (dispatch({ type: 'PLACE_BUILDING', building: G.selectedBuild, x: tx, y: ty }).ok) {
    renderBuildBar();
    renderMissions();
    updateUI();
    return true;
  }
  // Placement failed — surface the reason (throttled so we don't spam)
  const now = Date.now();
  if (!G._lastPlaceFailMsg || now - G._lastPlaceFailMsg > 1500) {
    G._lastPlaceFailMsg = now;
    const type = G.selectedBuild;
    const def = BUILDINGS[type];
    let reason = 'Cannot build here.';
    if (!def) reason = 'Unknown building type.';
    else if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) reason = 'Out of map bounds.';
    else if (!G.fog[ty][tx]) reason = 'Tile not yet explored.';
    else if (G.map[ty][tx] === 0) reason = 'Cannot build on water.';
    else if (G.map[ty][tx] === 6) reason = 'Cannot build on mountain.';
    else if (G.buildingGrid[ty]?.[tx]) reason = 'Tile already occupied.';
    else if (def.on && !def.on.includes(G.map[ty][tx])) {
      const terrain = ['water','sand','grass','forest','stone','road','mountain'];
      const need = def.on.map(t => terrain[t]).join(' or ');
      reason = `${def.name} must be built on ${need}.`;
    }
    else if (type === 'fisherman') reason = 'Fisherman\'s Hut must be adjacent to water.';
    else if (!canAfford(type)) {
      const short = Object.entries(def.cost).filter(([k,v]) => (G.resources[k]||0) < v).map(([k]) => k);
      reason = `Not enough ${short.join(', ')}.`;
    }
    notify(`⚠️ ${reason}`, 'danger', { chronicle: false });
  }
  return false;
}

// setArmyTargets moved to commands.js — it mutates sim state, so it lives
// behind the command funnel (SET_RALLY / SET_STANCE handlers call it).

export function setupInput(canvas) {
  const C = canvas;
  let touchDist = 0;
  let touchStart = null;
  let touchMoved = false;
  const TOUCH_DRAG_THRESHOLD = 8;

  C.addEventListener('contextmenu', e => e.preventDefault());

  function handlePrimaryTap(clientX, clientY) {
    if (G.selectedBuild) {
      const t = pickTile(clientX, clientY);
      if (!t) return true;
      tryPlaceAt(t.x, t.y);
      G._lastPaintTile = { x: t.x, y: t.y };
      return true;
    }

    // Citizens render in front of buildings, so they win overlapping taps.
    const cit = findCitizenAtClick(clientX, clientY);
    if (cit) {
      G.selectedBuilding = null;
      G.selectedCitizenId = cit.actorId;
      showCitizenPanel(cit);
      return true;
    }
    const b = findBuildingAtClick(clientX, clientY);
    if (b) {
      G.selectedBuilding = b;
      G.selectedCitizenId = null;
      showInfoPanel(b);
      return true;
    }

    G.selectedBuilding = null;
    G.selectedCitizenId = null;
    hideInfoPanel();
    // Follow mode (Phase 3d): a ground tap walks the founder there.
    if (G._followAvatar && G.avatar) {
      const t = pickTile(clientX, clientY);
      if (t) {
        dispatch({ type: 'AVATAR_GOTO', x: t.x, y: t.y });
        return true;
      }
    }
    return false;
  }

  function onMouseDown(e) {
    if (e.target !== C) return;
    initAudio();

    // Shift + right-click sets rally point for all soldiers
    if (e.button === 2 && e.shiftKey) {
      e.preventDefault();
      const t = screenToWorld(e.clientX, e.clientY);
      // Clicking on (or near) the existing flag removes it and drops the
      // army back to defend — one gesture places, the same gesture clears.
      if (G.rallyPoint && Math.hypot(t.x - G.rallyPoint.x, t.y - G.rallyPoint.y) <= 1.5) {
        dispatch({ type: 'SET_RALLY', x: null, y: null });
        G.particles.push({ tx: t.x, ty: t.y, offsetY: -10, text: '🚩 removed', alpha: 1.4, vy: -0.15, decay: 0.012, type: 'text' });
        return;
      }
      dispatch({ type: 'SET_RALLY', x: t.x, y: t.y });
      G.particles.push({
        tx: t.x, ty: t.y, offsetY: -10,
        text: '🚩 Rally', alpha: 1.5, vy: -0.15, decay: 0.01, type: 'text',
      });
      return;
    }

    // Right-click demolish
    if (e.button === 2) {
      e.preventDefault();
      const b = findBuildingAtClick(e.clientX, e.clientY);
      if (b) {
        dispatch({ type: 'DEMOLISH', x: b.x, y: b.y });
        G.selectedBuilding = null;
        hideInfoPanel();
        updateUI(); renderBuildBar();
      }
      return;
    }

    // Left-click build, select, or issue a founder follow command.
    if (e.button === 0 && handlePrimaryTap(e.clientX, e.clientY)) return;

    // Pan
    G.dragging = true;
    G.dragStart = { x: e.clientX, y: e.clientY };
    G.camStart = { x: G.camera.x, y: G.camera.y };
  }
  C.addEventListener('mousedown', onMouseDown);

  function onMouseMove(e) {
    // Drag-to-paint: hold mouse and drag to place roads/walls continuously
    if (G.selectedBuild && e.buttons === 1 && (G.selectedBuild === 'road' || G.selectedBuild === 'wall')) {
      const t = screenToWorld(e.clientX, e.clientY);
      if (!G._lastPaintTile || t.x !== G._lastPaintTile.x || t.y !== G._lastPaintTile.y) {
        tryPlaceAt(t.x, t.y);
        G._lastPaintTile = { x: t.x, y: t.y };
      }
    }
    if (G.dragging) {
      // Safety: if no mouse button is held (e.g. mouseup missed by automation), stop dragging
      if (e.buttons === 0) { G.dragging = false; return; }
      G.camera.x = G.camStart.x - (e.clientX - G.dragStart.x) / G.camera.zoom;
      G.camera.y = G.camStart.y - (e.clientY - G.dragStart.y) / G.camera.zoom;
    }
    G.hoveredTile = pickTile(e.clientX, e.clientY);
    G.mouseX = e.clientX; G.mouseY = e.clientY;
  }
  C.addEventListener('mousemove', onMouseMove);

  const stopDrag = () => { G.dragging = false; };
  C.addEventListener('mouseup', stopDrag);
  C.addEventListener('mouseleave', stopDrag);
  window.addEventListener('mouseup', stopDrag);

  const onWheel = e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * delta));
  };
  C.addEventListener('wheel', onWheel, { passive: false });

  // 'g' cycles army stance (defend -> rally -> patrol); rally is skipped
  // when no flag is planted.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'g' && e.key !== 'G') return;
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const order = ['defend', 'rally', 'patrol'];
    let idx = order.indexOf(G.armyStance);
    for (let hop = 0; hop < order.length; hop++) {
      idx = (idx + 1) % order.length;
      if (order[idx] === 'rally' && !G.rallyPoint) continue;
      break;
    }
    dispatch({ type: 'SET_STANCE', stance: order[idx] });
    updateUI();
  });

  // Touch
  C.addEventListener('touchstart', e => {
    if (e.target !== C) return;
    e.preventDefault();
    initAudio();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      // Do not place on touchstart: that makes a build-selected drag place a
      // second building before the player has a chance to pan. Defer the tap
      // action until touchend and promote it to a camera drag after a small
      // movement threshold.
      touchStart = { x: t.clientX, y: t.clientY };
      touchMoved = false;
      G.dragging = false;
      G.dragStart = { x: t.clientX, y: t.clientY };
      G.camStart = { x: G.camera.x, y: G.camera.y };
    }
    if (e.touches.length === 2) {
      touchStart = null;
      touchMoved = true;
      G.dragging = false;
      touchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  }, { passive: false });

  C.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1 && touchStart) {
      const t = e.touches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      if (!touchMoved && Math.hypot(dx, dy) >= TOUCH_DRAG_THRESHOLD) {
        touchMoved = true;
        G.dragging = true;
      }
      if (touchMoved) {
        G.camera.x = G.camStart.x - (t.clientX - G.dragStart.x) / G.camera.zoom;
        G.camera.y = G.camStart.y - (t.clientY - G.dragStart.y) / G.camera.zoom;
        G.hoveredTile = pickTile(t.clientX, t.clientY);
      }
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

  C.addEventListener('touchend', e => {
    e.preventDefault();
    if (e.touches.length === 0 && touchStart && !touchMoved) {
      handlePrimaryTap(touchStart.x, touchStart.y);
    }
    if (e.touches.length === 0) {
      touchStart = null;
      touchMoved = false;
      G.dragging = false;
    }
  }, { passive: false });
  C.addEventListener('touchcancel', () => {
    touchStart = null;
    touchMoved = false;
    G.dragging = false;
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { G.selectedBuild = null; G.selectedBuilding = null; hideInfoPanel(); renderBuildBar(); }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (dispatch({ type: 'UNDO' }).ok) { renderBuildBar(); updateUI(); }
      return;
    }
    if (e.key === 'Home') {
      // Recenter camera on island center. Loop 108 (the-fixer, 107
      // HIGH): dropped `|| e.key === 'h'` — it shadowed the photo-
      // mode handler below, which had been dead since 035 (~72 ticks).
      // Badge said "press H to exit" but H was recentering the camera
      // every time. Home-only keeps the standard OS convention.
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
    if (e.key === '+' || e.key === '=') {
      G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * 1.2));
      return;
    }
    if (e.key === '-') {
      G.camera.zoom = Math.max(0.3, Math.min(3, G.camera.zoom * 0.9));
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const panels = ['research-panel','stats-panel','achievements-panel','chronicle-panel','trade-panel'];
      const open = panels.find(id => { const el = document.getElementById(id); return el && el.style.display !== 'none'; });
      if (open) {
        document.getElementById(open).style.display = 'none';
        const idx = panels.indexOf(open);
        const next = panels[(idx + 1) % panels.length];
        document.getElementById(next).style.display = 'block';
      }
      return;
    }
    if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
      if (window.toggleChronicle) window.toggleChronicle();
      return;
    }
    if (e.key === 'b' && !e.ctrlKey && !e.metaKey) {
      // Cycle through building types
      const keys = Object.keys(BUILDINGS);
      if (!G.selectedBuild) {
        G.selectedBuild = keys[0];
      } else {
        const idx = keys.indexOf(G.selectedBuild);
        G.selectedBuild = keys[(idx + 1) % keys.length];
      }
      renderBuildBar();
      return;
    }
    if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
      const mm = document.getElementById('minimap');
      if (mm) mm.style.display = mm.style.display === 'none' ? 'block' : 'none';
      return;
    }
    if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
      if (window.toggleLog) window.toggleLog();
      return;
    }
    // Loop 035 (the-fixer): H = photo mode (hide all HUD chrome). Pairs
    // with CSS rules on body.photo-mode in index.html + the G.photoMode
    // check in enhancements.js:renderPauseOverlay.
    if (e.key === 'h' && !e.ctrlKey && !e.metaKey) {
      if (window.togglePhotoMode) window.togglePhotoMode();
      return;
    }
    // Phase 3d: F follows the founder — WASD then steers THEM, not the
    // camera; click-to-walk on open ground; F again to release.
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      G._followAvatar = !G._followAvatar;
      if (!G._followAvatar) dispatch({ type: 'AVATAR_MOVE', dx: 0, dy: 0 });
      notify(G._followAvatar
        ? '🚶 Following the Founder — WASD to walk, click ground to travel, F to release.'
        : 'Camera released.', 'info', { chronicle: false });
      return;
    }
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) {
      const rp = document.getElementById('research-panel');
      if (rp) rp.style.display = rp.style.display === 'none' ? 'flex' : 'none';
      return;
    }
    if (e.key === 'p') {
      G.speed = G.speed > 0 ? 0 : 1;
      renderBuildBar(); updateUI();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      const speeds = [0, 1, 2, 4];
      const idx = speeds.indexOf(G.speed);
      G.speed = speeds[(idx + 1) % speeds.length];
      setSpeed(G.speed);
      return;
    }
    if (e.key === 'F3') {
      e.preventDefault();
      toggleFPS();
      return;
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

  let _lastAvatarDir = '0,0';
  function keyPanTick() {
    if (G.speed >= 0) { // even when paused, allow camera movement
      let ux = 0, uy = 0;
      if (heldKeys.has('w') || heldKeys.has('arrowup')) uy = -1;
      if (heldKeys.has('s') || heldKeys.has('arrowdown')) uy = 1;
      if (heldKeys.has('a') || heldKeys.has('arrowleft')) ux = -1;
      if (heldKeys.has('d') || heldKeys.has('arrowright')) ux = 1;
      if (G._followAvatar && G.avatar) {
        // Screen-relative intent → iso world axes: screen-up must read as
        // walking toward the top of the SCREEN, not tile-north.
        const wx = (ux + uy) * 0.7071, wy = (uy - ux) * 0.7071;
        const key = `${wx.toFixed(2)},${wy.toFixed(2)}`;
        if (key !== _lastAvatarDir) {
          _lastAvatarDir = key;
          dispatch({ type: 'AVATAR_MOVE', dx: wx, dy: wy });
        }
      } else {
        if (_lastAvatarDir !== '0,0') {
          _lastAvatarDir = '0,0';
          dispatch({ type: 'AVATAR_MOVE', dx: 0, dy: 0 });
        }
        const panSpeed = 6 / G.camera.zoom;
        if (ux || uy) {
          G.camera.x += ux * panSpeed;
          G.camera.y += uy * panSpeed;
        }
      }
    }
    requestAnimationFrame(keyPanTick);
  }
  keyPanTick();

}
