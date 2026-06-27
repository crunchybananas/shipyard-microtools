import {
  FRAME_W,
  FRAME_H,
  FRAMES,
  DIRS,
  ACTIONS,
  ROLES,
  AMBIENT,
  AMBIENT_SHEET_W,
  AMBIENT_SHEET_H,
} from '../scripts/sprite-source-contract.mjs';

const STORE_KEY = 'realm-sprite-lab-review-v1';
const QUERY = new URLSearchParams(location.search);
const ASSET_REV = QUERY.get('assetrev') || (QUERY.has('spritelab') ? String(Date.now()) : '');
const ISSUE_TAGS = [
  ['silhouette', 'Silhouette jump'],
  ['scale', 'Scale drift'],
  ['gait', 'Gait / footfall'],
  ['edge', 'Cell edge clip'],
  ['debris', 'Loose pixels'],
  ['style', 'Style mismatch'],
  ['prop', 'Baked prop conflict'],
  ['blank', 'Blank / flash'],
];

const state = {
  open: false,
  kind: 'actor',
  role: 'miner',
  action: 'work',
  dir: 'left',
  ambient: AMBIENT[0],
  frame: 0,
  playing: true,
  fps: 6,
  zoom: 5,
  grid: true,
  onion: true,
  mask: false,
  scope: 'row',
  severity: 'needs-repaint',
  query: '',
  statusFilter: 'all',
};

let els = null;
let raf = 0;
let lastAnimAt = 0;
let imageCache = new Map();
let reviews = new Map();
let currentMetrics = null;
let rowManifest = { version: 1, rows: {} };

export function initSpriteLab() {
  const root = document.getElementById('sprite-lab');
  if (!root) return;
  els = {
    root,
    role: document.getElementById('sl-role'),
    action: document.getElementById('sl-action'),
    dir: document.getElementById('sl-dir'),
    search: document.getElementById('sl-search'),
    statusFilter: document.getElementById('sl-status-filter'),
    list: document.getElementById('sl-list'),
    rowLabel: document.getElementById('sl-row-label'),
    preview: document.getElementById('sl-preview'),
    strip: document.getElementById('sl-strip'),
    metrics: document.getElementById('sl-metrics'),
    provenance: document.getElementById('sl-provenance'),
    frameLabel: document.getElementById('sl-frame-label'),
    play: document.getElementById('sl-play'),
    prev: document.getElementById('sl-prev'),
    next: document.getElementById('sl-next'),
    fps: document.getElementById('sl-fps'),
    zoom: document.getElementById('sl-zoom'),
    grid: document.getElementById('sl-grid'),
    onion: document.getElementById('sl-onion'),
    mask: document.getElementById('sl-mask'),
    scope: document.getElementById('sl-scope'),
    severity: document.getElementById('sl-severity'),
    tags: document.getElementById('sl-tags'),
    note: document.getElementById('sl-note'),
    save: document.getElementById('sl-save'),
    clear: document.getElementById('sl-clear'),
    queue: document.getElementById('sl-queue'),
    exportBox: document.getElementById('sl-export-box'),
    ambientControls: document.getElementById('sl-actor-controls'),
  };

  loadReviews();
  hydrateControls();
  bindEvents();
  applyQuerySelection();
  renderAll();
  loadRowManifest();

  window.toggleSpriteLab = (force) => setOpen(force == null ? !state.open : !!force);
  window.openSpriteLab = () => setOpen(true);

  const params = new URLSearchParams(location.search);
  if (params.has('spritelab') || params.has('rolesheet')) setOpen(true);
}

function hydrateControls() {
  fillSelect(els.role, ROLES, state.role);
  fillSelect(els.action, ACTIONS, state.action);
  fillSelect(els.dir, DIRS, state.dir);
  els.fps.value = String(state.fps);
  els.zoom.value = String(state.zoom);
  els.grid.checked = state.grid;
  els.onion.checked = state.onion;
  els.mask.checked = state.mask;
  els.scope.value = state.scope;
  els.severity.value = state.severity;
  els.tags.innerHTML = '';
  for (const [id, label] of ISSUE_TAGS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sl-chip';
    btn.dataset.tag = id;
    btn.textContent = label;
    els.tags.appendChild(btn);
  }
}

function fillSelect(select, values, selected) {
  select.innerHTML = '';
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = titleCase(value);
    option.selected = value === selected;
    select.appendChild(option);
  }
}

function bindEvents() {
  document.getElementById('sl-close')?.addEventListener('click', () => setOpen(false));
  document.querySelectorAll('[data-sl-kind]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.kind = btn.dataset.slKind;
      state.frame = 0;
      state.playing = false;
      updateLocationForSelection();
      renderAll();
    });
  });
  els.role.addEventListener('change', () => { state.role = els.role.value; state.frame = 0; state.playing = false; updateLocationForSelection(); renderAll(); });
  els.action.addEventListener('change', () => { state.action = els.action.value; state.frame = 0; state.playing = false; updateLocationForSelection(); renderAll(); });
  els.dir.addEventListener('change', () => { state.dir = els.dir.value; state.frame = 0; state.playing = false; updateLocationForSelection(); renderAll(); });
  els.search.addEventListener('input', () => { state.query = els.search.value.trim().toLowerCase(); renderList(); });
  els.statusFilter.addEventListener('change', () => { state.statusFilter = els.statusFilter.value; renderList(); });
  els.play.addEventListener('click', () => { state.playing = !state.playing; renderTransport(); });
  els.prev.addEventListener('click', () => { stepFrame(-1); });
  els.next.addEventListener('click', () => { stepFrame(1); });
  els.fps.addEventListener('input', () => { state.fps = Number(els.fps.value) || 6; renderTransport(); });
  els.zoom.addEventListener('input', () => { state.zoom = Number(els.zoom.value) || 5; drawCurrent(); });
  els.grid.addEventListener('change', () => { state.grid = els.grid.checked; drawCurrent(); });
  els.onion.addEventListener('change', () => { state.onion = els.onion.checked; drawCurrent(); });
  els.mask.addEventListener('change', () => { state.mask = els.mask.checked; drawCurrent(); });
  els.scope.addEventListener('change', () => { state.scope = els.scope.value; loadCurrentReviewIntoForm(); });
  els.severity.addEventListener('change', () => { state.severity = els.severity.value; });
  els.tags.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tag]');
    if (!chip) return;
    chip.classList.toggle('active');
  });
  els.save.addEventListener('click', saveCurrentReview);
  els.clear.addEventListener('click', clearCurrentReview);
  document.getElementById('sl-copy-md')?.addEventListener('click', copyMarkdownReport);
  document.getElementById('sl-export-json')?.addEventListener('click', downloadJsonReport);
  document.getElementById('sl-copy-work-order')?.addEventListener('click', copyWorkOrder);
  document.getElementById('sl-download-row')?.addEventListener('click', downloadCurrentRow);
  document.getElementById('sl-open-muster')?.addEventListener('click', () => window.openSpriteMuster?.());
  els.list.addEventListener('click', (e) => {
    const row = e.target.closest('[data-row-key]');
    if (!row) return;
    selectKey(row.dataset.rowKey);
  });
  els.queue.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-review-nav]');
    if (nav) {
      const review = reviews.get(nav.dataset.reviewNav);
      if (review) {
        selectKey(review.key);
        state.scope = review.scope || 'row';
        state.frame = Number.isFinite(review.frame) ? review.frame : state.frame;
        els.scope.value = state.scope;
        loadCurrentReviewIntoForm();
        drawCurrent();
      }
      return;
    }
    const del = e.target.closest('[data-review-delete]');
    if (del) {
      reviews.delete(del.dataset.reviewDelete);
      persistReviews();
      renderAll();
    }
  });
  els.strip.addEventListener('click', (e) => {
    if (state.kind !== 'actor') return;
    const rect = els.strip.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (els.strip.width / rect.width);
    const cell = FRAME_W * 2;
    const gap = 8;
    const frame = Math.floor(x / (cell + gap));
    if (frame >= 0 && frame < FRAMES) {
      state.frame = frame;
      state.playing = false;
      loadCurrentReviewIntoForm();
      drawCurrent();
      renderTransport();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (!state.open) return;
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepFrame(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepFrame(1); }
    if (e.key === ' ') { e.preventDefault(); state.playing = !state.playing; renderTransport(); }
  });
}

function applyQuerySelection() {
  const params = new URLSearchParams(location.search);
  const role = params.get('role');
  const action = params.get('action');
  const dir = params.get('dir');
  const ambient = params.get('ambient');
  if (ROLES.includes(role)) state.role = role;
  if (ACTIONS.includes(action)) state.action = action;
  if (DIRS.includes(dir)) state.dir = dir;
  if (AMBIENT.includes(ambient)) {
    state.kind = 'ambient';
    state.ambient = ambient;
  }
  const roleSheet = params.get('rolesheet') || '';
  if (roleSheet) {
    const foundRole = ROLES.find((r) => roleSheet.includes(r));
    const foundAction = ACTIONS.find((a) => roleSheet.includes(a));
    const foundDir = DIRS.find((d) => roleSheet.includes(d));
    if (foundRole) state.role = foundRole;
    if (foundAction) state.action = foundAction;
    if (foundDir) state.dir = foundDir;
  }
}

function setOpen(next) {
  state.open = next;
  els.root.classList.toggle('open', next);
  els.root.setAttribute('aria-hidden', next ? 'false' : 'true');
  document.body.classList.toggle('sprite-lab-open', next);
  if (next) {
    lastAnimAt = performance.now();
    renderAll();
    tick(lastAnimAt);
  } else if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

function tick(now) {
  if (!state.open) return;
  if (state.kind === 'actor' && state.playing && now - lastAnimAt >= 1000 / state.fps) {
    state.frame = (state.frame + 1) % FRAMES;
    lastAnimAt = now;
    drawCurrent();
    renderTransport();
  }
  raf = requestAnimationFrame(tick);
}

function renderAll() {
  document.querySelectorAll('[data-sl-kind]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.slKind === state.kind);
  });
  els.role.value = state.role;
  els.action.value = state.action;
  els.dir.value = state.dir;
  els.ambientControls.classList.toggle('muted', state.kind !== 'actor');
  renderList();
  renderTransport();
  renderProvenance();
  loadCurrentReviewIntoForm();
  drawCurrent();
  renderQueue();
}

function renderList() {
  els.list.innerHTML = '';
  const rows = state.kind === 'actor' ? actorRows() : ambientRows();
  for (const row of rows) {
    if (state.query && !row.label.toLowerCase().includes(state.query)) continue;
    if (state.statusFilter !== 'all' && row.sourceStatus !== state.statusFilter) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sl-row';
    btn.dataset.rowKey = row.key;
    btn.classList.toggle('active', row.key === currentKey());
    const count = reviewCountForKey(row.key);
    btn.innerHTML = `
      <span class="sl-row-name">${escapeHtml(row.label)}</span>
      <span class="sl-row-badges">
        <span class="sl-source-badge ${escapeAttr(row.sourceStatus)}">${escapeHtml(row.sourceLabel)}</span>
        ${count ? `<span class="sl-review-count">${count}</span>` : ''}
      </span>
    `;
    els.list.appendChild(btn);
  }
  const active = els.list.querySelector('.sl-row.active');
  if (active && !state.query) {
    const activeTop = active.offsetTop - els.list.offsetTop;
    els.list.scrollTop = Math.max(0, activeTop - (els.list.clientHeight - active.clientHeight) / 2);
  }
}

function actorRows() {
  const rows = [];
  for (const role of ROLES) {
    for (const action of ACTIONS) {
      for (const dir of DIRS) {
        const source = sourceForRow(role, action, dir);
        rows.push({
          key: keyFor({ kind: 'actor', role, action, dir }),
          label: `${titleCase(role)} / ${action} / ${dir}`,
          sourceStatus: source.status,
          sourceLabel: source.label,
        });
      }
    }
  }
  return rows;
}

function ambientRows() {
  return AMBIENT.map((name) => ({
    key: keyFor({ kind: 'ambient', ambient: name }),
    label: `Ambient / ${titleCase(name)}`,
    sourceStatus: 'accepted',
    sourceLabel: 'PROP',
  }));
}

function selectKey(key) {
  const parts = key.split(':');
  state.kind = parts[0] || state.kind;
  if (state.kind === 'actor') {
    state.role = parts[1] || state.role;
    state.action = parts[2] || state.action;
    state.dir = parts[3] || state.dir;
  } else {
    state.ambient = parts[1] || state.ambient;
  }
  state.frame = 0;
  state.playing = false;
  updateLocationForSelection();
  renderAll();
}

function drawCurrent() {
  const record = getCurrentImage();
  const dims = currentDims();
  if (!record.ready) {
    drawLoading(els.preview, dims.w * state.zoom, dims.h * state.zoom, record.failed ? 'Image failed' : 'Loading image');
    drawLoading(els.strip, Math.max(360, dims.w * 2), dims.h * 2, record.failed ? 'Image failed' : 'Loading image');
    return;
  }
  currentMetrics = state.kind === 'actor'
    ? analyzeActorRow(record.img)
    : analyzeAmbient(record.img);
  if (state.kind === 'actor') {
    drawActorPreview(record.img);
    drawActorStrip(record.img);
  } else {
    drawAmbientPreview(record.img);
    drawAmbientStrip(record.img);
  }
  renderMetrics();
  renderTransport();
}

function drawActorPreview(img) {
  const scale = state.zoom;
  const w = FRAME_W * scale;
  const h = FRAME_H * scale;
  const canvas = els.preview;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawChecker(ctx, w, h, 10);
  const sy = actorSourceRowY();
  if (state.onion) {
    drawCell(ctx, img, ((state.frame + FRAMES - 1) % FRAMES) * FRAME_W, sy, FRAME_W, FRAME_H, scale, 0.24);
    drawCell(ctx, img, ((state.frame + 1) % FRAMES) * FRAME_W, sy, FRAME_W, FRAME_H, scale, 0.24);
  }
  drawCell(ctx, img, state.frame * FRAME_W, sy, FRAME_W, FRAME_H, scale, 1);
  if (state.mask) drawAlphaMask(ctx, img, state.frame * FRAME_W, sy, FRAME_W, FRAME_H, scale);
  if (state.grid) drawGrid(ctx, w, h, scale);
  drawRowGuides(ctx, w, h, scale);
  els.rowLabel.textContent = `${state.role} / ${state.action} / ${state.dir}`;
}

function drawActorStrip(img) {
  const scale = 2;
  const gap = 8;
  const w = FRAMES * FRAME_W * scale + (FRAMES - 1) * gap;
  const h = FRAME_H * scale;
  const canvas = els.strip;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawChecker(ctx, w, h, 8);
  const sy = actorSourceRowY();
  for (let frame = 0; frame < FRAMES; frame++) {
    const x = frame * (FRAME_W * scale + gap);
    ctx.save();
    ctx.translate(x, 0);
    drawCell(ctx, img, frame * FRAME_W, sy, FRAME_W, FRAME_H, scale, 1);
    ctx.strokeStyle = frame === state.frame ? '#f5c84c' : 'rgba(255,255,255,0.18)';
    ctx.lineWidth = frame === state.frame ? 3 : 1;
    ctx.strokeRect(1.5, 1.5, FRAME_W * scale - 3, FRAME_H * scale - 3);
    drawRowGuides(ctx, FRAME_W * scale, FRAME_H * scale, scale);
    ctx.restore();
  }
}

function drawAmbientPreview(img) {
  const scale = state.zoom + 1;
  const w = AMBIENT_SHEET_W * scale;
  const h = AMBIENT_SHEET_H * scale;
  const canvas = els.preview;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawChecker(ctx, w, h, 10);
  drawCell(ctx, img, 0, 0, AMBIENT_SHEET_W, AMBIENT_SHEET_H, scale, 1);
  if (state.mask) drawAlphaMask(ctx, img, 0, 0, AMBIENT_SHEET_W, AMBIENT_SHEET_H, scale);
  if (state.grid) drawGrid(ctx, w, h, scale);
  els.rowLabel.textContent = `ambient / ${state.ambient}`;
}

function drawAmbientStrip(img) {
  const scale = 3;
  const w = AMBIENT_SHEET_W * scale;
  const h = AMBIENT_SHEET_H * scale;
  const canvas = els.strip;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  drawChecker(ctx, w, h, 8);
  drawCell(ctx, img, 0, 0, AMBIENT_SHEET_W, AMBIENT_SHEET_H, scale, 1);
  ctx.strokeStyle = '#f5c84c';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
}

function drawCell(ctx, img, sx, sy, sw, sh, scale, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
  ctx.restore();
}

function drawAlphaMask(ctx, img, sx, sy, sw, sh, scale) {
  const off = document.createElement('canvas');
  off.width = sw;
  off.height = sh;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = offCtx.getImageData(0, 0, sw, sh).data;
  ctx.save();
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const a = data[(y * sw + x) * 4 + 3];
      if (a <= 20) continue;
      const edge = x === 0 || y === 0 || x === sw - 1 || y === sh - 1;
      ctx.fillStyle = edge ? 'rgba(245,96,84,0.58)' : 'rgba(109,212,184,0.26)';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.restore();
}

function drawChecker(ctx, w, h, size) {
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      ctx.fillStyle = ((x / size + y / size) % 2) ? '#24313a' : '#162129';
      ctx.fillRect(x, y, size, size);
    }
  }
}

function drawGrid(ctx, w, h, scale) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += scale * 8) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += scale * 8) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(245,200,76,0.72)';
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawRowGuides(ctx, w, h, scale) {
  if (state.kind !== 'actor' || !currentMetrics?.row) return;
  const top = Number(currentMetrics.row.medianTop);
  const bottom = Number(currentMetrics.row.medianBottom);
  if (!Number.isFinite(top) || !Number.isFinite(bottom)) return;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(109,212,184,0.76)';
  ctx.beginPath();
  ctx.moveTo(0, Math.round(top * scale) + 0.5);
  ctx.lineTo(w, Math.round(top * scale) + 0.5);
  ctx.stroke();
  ctx.setLineDash([5, 3]);
  ctx.strokeStyle = 'rgba(245,200,76,0.78)';
  ctx.beginPath();
  ctx.moveTo(0, Math.round(bottom * scale) + 0.5);
  ctx.lineTo(w, Math.round(bottom * scale) + 0.5);
  ctx.stroke();
  ctx.restore();
}

function drawLoading(canvas, w, h, label) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawChecker(ctx, w, h, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, w / 2, h / 2);
}

function renderTransport() {
  els.play.textContent = state.playing ? 'Pause' : 'Play';
  els.frameLabel.textContent = state.kind === 'actor'
    ? `${titleCase(state.role)} / ${state.action} / ${state.dir} - Frame ${state.frame + 1} / ${FRAMES} at ${state.fps} fps`
    : `Ambient / ${titleCase(state.ambient)} - Single sprite`;
  els.fps.disabled = state.kind !== 'actor';
}

function renderMetrics() {
  if (!currentMetrics) return;
  const frame = currentMetrics.frames?.[state.frame] || currentMetrics.frames?.[0] || currentMetrics;
  const row = currentMetrics.row || currentMetrics;
  const bodyHeightDelta = Number(row.maxBodyHeightDelta) || 0;
  els.metrics.innerHTML = `
    <div><span>Alpha px</span><b>${frame.pixels}</b></div>
    <div><span>Bounds</span><b>${frame.bounds}</b></div>
    <div><span>Center</span><b>${frame.center}</b></div>
    <div><span>Edge px</span><b>${frame.edgePixels}</b></div>
    <div><span>Body center jump</span><b>${row.maxBodyCenterJump}</b></div>
    <div><span>Max size jump</span><b>${row.maxSizeJump}</b></div>
    <div><span>Body height</span><b>${row.bodyHeightRange}</b></div>
    <div class="${bodyHeightDelta > 10 ? 'sl-metric-warn' : ''}"><span>Body delta</span><b>${row.maxBodyHeightDelta}</b></div>
    <div><span>Row index</span><b>${state.kind === 'actor' ? actorRowIndex() : 0}</b></div>
    <div><span>Atlas target</span><b>${atlasRectLabel()}</b></div>
  `;
}

function renderProvenance() {
  if (!els.provenance) return;
  if (state.kind !== 'actor') {
    els.provenance.innerHTML = `
      <div class="sl-provenance-head">
        <strong>${escapeHtml(titleCase(state.ambient))}</strong>
        <span class="sl-source-badge accepted">PROP</span>
      </div>
      <div class="sl-provenance-note">Editable ambient source sprite. Runtime atlas is generated.</div>
    `;
    return;
  }
  const source = sourceForRow(state.role, state.action, state.dir);
  const item = source.item;
  if (!item) {
    els.provenance.innerHTML = `
      <div class="sl-provenance-head">
        <strong>${escapeHtml(state.role)} / ${escapeHtml(state.action)} / ${escapeHtml(state.dir)}</strong>
        <span class="sl-source-badge base">BASE</span>
      </div>
      <div class="sl-provenance-note">Inherited from the base role sheet. This row is not hash-locked and may still contain legacy or placeholder art.</div>
    `;
    return;
  }
  const quality = item.quality || {};
  const warnings = quality.warnings?.length ? quality.warnings.join(', ') : 'none';
  els.provenance.innerHTML = `
    <div class="sl-provenance-head">
      <strong>${escapeHtml(state.role)} / ${escapeHtml(state.action)} / ${escapeHtml(state.dir)}</strong>
      <span class="sl-source-badge ${escapeAttr(source.status)}">${escapeHtml(source.label)}</span>
    </div>
    <dl>
      <dt>Source</dt><dd>${escapeHtml(item.provenance || 'unknown')}</dd>
      <dt>Flicker</dt><dd>${escapeHtml(quality.flickerScore ?? 'n/a')}</dd>
      <dt>Warnings</dt><dd title="${escapeAttr(warnings)}">${escapeHtml(warnings)}</dd>
      <dt>Accepted</dt><dd>${escapeHtml(item.acceptedAt || 'unknown')}</dd>
      <dt>Hash</dt><dd title="${escapeAttr(item.sha256 || '')}">${escapeHtml((item.sha256 || '').slice(0, 12))}</dd>
    </dl>
    ${item.note ? `<div class="sl-provenance-note">${escapeHtml(item.note)}</div>` : ''}
  `;
}

function analyzeActorRow(img) {
  const frames = [];
  const sy = actorSourceRowY();
  for (let frame = 0; frame < FRAMES; frame++) {
    frames.push(analyzeCell(img, frame * FRAME_W, sy, FRAME_W, FRAME_H));
  }
  let maxCenterJump = 0;
  let maxBodyCenterJump = 0;
  let maxSizeJump = 0;
  for (let i = 1; i < frames.length; i++) {
    maxCenterJump = Math.max(maxCenterJump, distance(frames[i - 1], frames[i]));
    maxBodyCenterJump = Math.max(maxBodyCenterJump, distance(frames[i - 1].body, frames[i].body));
    maxSizeJump = Math.max(maxSizeJump, Math.abs(frames[i].w - frames[i - 1].w) + Math.abs(frames[i].h - frames[i - 1].h));
  }
  const populated = frames.filter((f) => f.pixels);
  const heights = populated.map((f) => f.h);
  const bodyHeights = populated.map((f) => f.body.h);
  const tops = populated.map((f) => f.minY);
  const bottoms = populated.map((f) => f.maxY);
  const minH = heights.length ? Math.min(...heights) : 0;
  const maxH = heights.length ? Math.max(...heights) : 0;
  const minBodyH = bodyHeights.length ? Math.min(...bodyHeights) : 0;
  const maxBodyH = bodyHeights.length ? Math.max(...bodyHeights) : 0;
  return {
    frames,
    row: {
      maxCenterJump: maxCenterJump.toFixed(1),
      maxBodyCenterJump: maxBodyCenterJump.toFixed(1),
      maxSizeJump: maxSizeJump.toFixed(0),
      heightRange: `${minH}-${maxH}`,
      maxHeightDelta: String(maxH - minH),
      bodyHeightRange: `${minBodyH}-${maxBodyH}`,
      maxBodyHeightDelta: String(maxBodyH - minBodyH),
      medianTop: median(tops).toFixed(1),
      medianBottom: median(bottoms).toFixed(1),
    },
  };
}

function analyzeAmbient(img) {
  const cell = analyzeCell(img, 0, 0, AMBIENT_SHEET_W, AMBIENT_SHEET_H);
  return {
    ...cell,
    row: {
      maxCenterJump: '0.0',
      maxBodyCenterJump: '0.0',
      maxSizeJump: '0',
      heightRange: `${cell.h}-${cell.h}`,
      maxHeightDelta: '0',
      bodyHeightRange: `${cell.body.h}-${cell.body.h}`,
      maxBodyHeightDelta: '0',
      medianTop: String(cell.minY || 0),
      medianBottom: String(cell.maxY || 0),
    },
    frames: [cell],
  };
}

function analyzeCell(img, sx, sy, sw, sh) {
  const off = document.createElement('canvas');
  off.width = sw;
  off.height = sh;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = ctx.getImageData(0, 0, sw, sh).data;
  let minX = sw, minY = sh, maxX = -1, maxY = -1, pixels = 0, edgePixels = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const a = data[(y * sw + x) * 4 + 3];
      if (a <= 20) continue;
      pixels++;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || y === 0 || x === sw - 1 || y === sh - 1) edgePixels++;
    }
  }
  const empty = pixels === 0;
  const w = empty ? 0 : maxX - minX + 1;
  const h = empty ? 0 : maxY - minY + 1;
  const cx = empty ? 0 : sumX / pixels;
  const cy = empty ? 0 : sumY / pixels;
  const body = analyzeDenseBody(data, sw, sh);
  return {
    pixels,
    edgePixels,
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx,
    cy,
    bounds: empty ? 'empty' : `${w}x${h} @ ${minX},${minY}`,
    center: empty ? 'empty' : `${cx.toFixed(1)},${cy.toFixed(1)}`,
    body,
  };
}

function analyzeDenseBody(data, width, height) {
  let mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) mask[y * width + x] = 1;
    }
  }
  for (let iteration = 0; iteration < 2; iteration++) {
    const next = new Uint8Array(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let solid = true;
        for (let ny = y - 1; ny <= y + 1 && solid; ny++) {
          for (let nx = x - 1; nx <= x + 1; nx++) {
            if (!mask[ny * width + nx]) {
              solid = false;
              break;
            }
          }
        }
        if (solid) next[y * width + x] = 1;
      }
    }
    mask = next;
  }

  const visited = new Uint8Array(width * height);
  let largest = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    const points = [];
    visited[start] = 1;
    for (let index = 0; index < queue.length; index++) {
      const value = queue[index];
      points.push(value);
      const x = value % width;
      const y = Math.floor(value / width);
      const neighbors = [
        x > 0 ? value - 1 : -1,
        x < width - 1 ? value + 1 : -1,
        y > 0 ? value - width : -1,
        y < height - 1 ? value + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || !mask[next] || visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    if (points.length > largest.length) largest = points;
  }
  if (!largest.length) return { pixels: 0, w: 0, h: 0, cx: 0, cy: 0 };

  let minX = width, minY = height, maxX = -1, maxY = -1, sumX = 0, sumY = 0;
  for (const value of largest) {
    const x = value % width;
    const y = Math.floor(value / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    sumX += x;
    sumY += y;
  }
  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  return {
    pixels: largest.length,
    minX,
    minY,
    maxX,
    maxY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: sumX / largest.length,
    cy: sumY / largest.length,
  };
}

function distance(a, b) {
  if (!a.pixels || !b.pixels) return 0;
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadCurrentReviewIntoForm() {
  const review = reviews.get(currentReviewId());
  els.scope.value = state.scope;
  els.severity.value = review?.severity || state.severity;
  els.note.value = review?.note || '';
  document.querySelectorAll('#sl-tags [data-tag]').forEach((chip) => {
    chip.classList.toggle('active', !!review?.tags?.includes(chip.dataset.tag));
  });
}

function saveCurrentReview() {
  const tags = [...document.querySelectorAll('#sl-tags [data-tag].active')].map((chip) => chip.dataset.tag);
  const note = els.note.value.trim();
  const review = {
    id: currentReviewId(),
    key: currentKey(),
    kind: state.kind,
    role: state.kind === 'actor' ? state.role : null,
    action: state.kind === 'actor' ? state.action : null,
    dir: state.kind === 'actor' ? state.dir : null,
    ambient: state.kind === 'ambient' ? state.ambient : null,
    frame: state.scope === 'frame' ? state.frame : null,
    scope: state.scope,
    severity: els.severity.value,
    tags,
    note,
    metrics: metricSnapshot(),
    updatedAt: new Date().toISOString(),
  };
  reviews.set(review.id, review);
  persistReviews();
  renderAll();
}

function clearCurrentReview() {
  reviews.delete(currentReviewId());
  persistReviews();
  loadCurrentReviewIntoForm();
  renderList();
  renderQueue();
}

function metricSnapshot() {
  if (!currentMetrics) return null;
  const frame = currentMetrics.frames?.[state.frame] || currentMetrics.frames?.[0] || null;
  const row = currentMetrics.row || null;
  return frame ? {
    pixels: frame.pixels,
    edgePixels: frame.edgePixels,
    bounds: frame.bounds,
    center: frame.center,
    maxCenterJump: row?.maxCenterJump,
    maxBodyCenterJump: row?.maxBodyCenterJump,
    maxSizeJump: row?.maxSizeJump,
    heightRange: row?.heightRange,
    maxHeightDelta: row?.maxHeightDelta,
    bodyHeightRange: row?.bodyHeightRange,
    maxBodyHeightDelta: row?.maxBodyHeightDelta,
  } : null;
}

function renderQueue() {
  els.queue.innerHTML = '';
  const items = [...reviews.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sl-empty';
    empty.textContent = 'No marked rows yet.';
    els.queue.appendChild(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'sl-queue-row';
    const title = item.kind === 'actor'
      ? `${item.role} / ${item.action} / ${item.dir}${item.scope === 'frame' ? ` / frame ${item.frame + 1}` : ''}`
      : `ambient / ${item.ambient}`;
    row.innerHTML = `
      <button type="button" data-review-nav="${escapeAttr(item.id)}">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(item.severity)}${item.tags.length ? ` - ${escapeHtml(item.tags.join(', '))}` : ''}</span>
      </button>
      <button type="button" class="sl-delete" data-review-delete="${escapeAttr(item.id)}">Clear</button>
    `;
    els.queue.appendChild(row);
  }
}

function copyMarkdownReport() {
  const text = buildMarkdownReport();
  navigator.clipboard?.writeText(text).then(() => {
    els.exportBox.value = 'Copied report to clipboard.';
  }).catch(() => {
    els.exportBox.value = text;
    els.exportBox.focus();
    els.exportBox.select();
  });
}

function downloadJsonReport() {
  const data = JSON.stringify([...reviews.values()], null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'realm-sprite-review.json';
  a.click();
  URL.revokeObjectURL(url);
  els.exportBox.value = data;
}

function buildMarkdownReport() {
  const items = [...reviews.values()];
  if (items.length === 0) return 'No sprite issues flagged.';
  return items.map((item) => {
    const subject = item.kind === 'actor'
      ? `${item.role}/${item.action}/${item.dir}${item.scope === 'frame' ? `/frame-${item.frame + 1}` : ''}`
      : `ambient/${item.ambient}`;
    const tags = item.tags.length ? ` [${item.tags.join(', ')}]` : '';
    const note = item.note ? `: ${item.note}` : '';
    const metrics = item.metrics ? ` (${item.metrics.bounds}, edge ${item.metrics.edgePixels}, center jump ${item.metrics.maxCenterJump})` : '';
    return `- ${subject} - ${item.severity}${tags}${metrics}${note}`;
  }).join('\n');
}

function getCurrentImage() {
  const source = state.kind === 'actor' ? sourceForRow(state.role, state.action, state.dir) : null;
  const url = state.kind === 'actor'
    ? source?.status === 'candidate' && source.item?.file
      ? `assets/sprites/actor-rows/${source.item.file}`
      : `assets/sprites/actors-compiled/${state.role}.png`
    : `assets/sprites/ambient/${state.ambient}.png`;
  const src = cacheBustAsset(url);
  if (imageCache.has(src)) return imageCache.get(src);
  const rec = { img: new Image(), ready: false, failed: false };
  rec.img.onload = () => { rec.ready = true; drawCurrent(); };
  rec.img.onerror = () => { rec.failed = true; drawCurrent(); };
  rec.img.src = src;
  imageCache.set(src, rec);
  return rec;
}

function actorSourceRowY() {
  const source = sourceForRow(state.role, state.action, state.dir);
  return source.status === 'candidate' ? 0 : actorRowIndex() * FRAME_H;
}

async function loadRowManifest() {
  try {
    const response = await fetch(cacheBustAsset('assets/sprites/actor-rows/manifest.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`manifest ${response.status}`);
    const data = await response.json();
    if (data?.version === 1 && data.rows) rowManifest = data;
  } catch (_err) {
    rowManifest = { version: 1, rows: {} };
  }
  renderList();
  renderProvenance();
}

function sourceForRow(role, action, dir) {
  const item = rowManifest.rows?.[`${role}/${action}/${dir}`] || null;
  if (!item) return { status: 'base', label: 'BASE', item: null };
  if (item.status === 'accepted') return { status: 'accepted', label: 'LOCKED', item };
  if (item.status === 'accepted-with-waiver') return { status: 'waived', label: 'WAIVED', item };
  if (item.status === 'candidate') return { status: 'candidate', label: 'CANDIDATE', item };
  return { status: 'base', label: 'BASE', item: null };
}

function copyWorkOrder() {
  if (state.kind !== 'actor') return;
  const source = sourceForRow(state.role, state.action, state.dir);
  const row = currentMetrics?.row || {};
  const text = [
    `Use $realm-sprite-factory to improve ${state.role}/${state.action}/${state.dir}.`,
    `Deep link: ${location.origin}${location.pathname}?spritelab=1&role=${state.role}&action=${state.action}&dir=${state.dir}`,
    `Source state: ${source.label}.`,
    `Current diagnostics: height ${row.heightRange || 'n/a'}, height delta ${row.maxHeightDelta || 'n/a'}, center jump ${row.maxCenterJump || 'n/a'}, size jump ${row.maxSizeJump || 'n/a'}.`,
    `Create the work order with: scripts/sprite-row work-order --role ${state.role} --action ${state.action} --dir ${state.dir}`,
    'Generate one eight-pose chroma-key strip, pack it, run the row-quality gate, and do not accept it if the actor identity or body scale flickers.',
  ].join('\n');
  navigator.clipboard?.writeText(text).then(() => {
    els.exportBox.value = 'Copied sprite work order.';
  }).catch(() => {
    els.exportBox.value = text;
    els.exportBox.focus();
    els.exportBox.select();
  });
}

function downloadCurrentRow() {
  if (state.kind !== 'actor') return;
  const record = getCurrentImage();
  if (!record.ready) return;
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_W * FRAMES;
  canvas.height = FRAME_H;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(record.img, 0, actorSourceRowY(), canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.role}-${state.action}-${state.dir}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function cacheBustAsset(url) {
  if (!ASSET_REV) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}slv=${encodeURIComponent(ASSET_REV)}`;
}

function currentDims() {
  return state.kind === 'actor'
    ? { w: FRAME_W, h: FRAME_H }
    : { w: AMBIENT_SHEET_W, h: AMBIENT_SHEET_H };
}

function actorRowIndex() {
  return ACTIONS.indexOf(state.action) * DIRS.length + DIRS.indexOf(state.dir);
}

function atlasRectLabel() {
  if (state.kind !== 'actor') return `0,0 ${AMBIENT_SHEET_W}x${AMBIENT_SHEET_H}`;
  const roleY = ROLES.indexOf(state.role) * FRAME_H * ACTIONS.length * DIRS.length;
  const y = roleY + actorRowIndex() * FRAME_H;
  return `${state.frame * FRAME_W},${y} ${FRAME_W}x${FRAME_H}`;
}

function stepFrame(delta) {
  if (state.kind !== 'actor') return;
  state.playing = false;
  state.frame = (state.frame + FRAMES + delta) % FRAMES;
  loadCurrentReviewIntoForm();
  drawCurrent();
  renderTransport();
}

function currentKey() {
  return state.kind === 'actor'
    ? keyFor({ kind: 'actor', role: state.role, action: state.action, dir: state.dir })
    : keyFor({ kind: 'ambient', ambient: state.ambient });
}

function updateLocationForSelection() {
  const url = new URL(location.href);
  url.searchParams.set('spritelab', '1');
  if (state.kind === 'actor') {
    url.searchParams.set('role', state.role);
    url.searchParams.set('action', state.action);
    url.searchParams.set('dir', state.dir);
    url.searchParams.delete('ambient');
  } else {
    url.searchParams.set('ambient', state.ambient);
    url.searchParams.delete('role');
    url.searchParams.delete('action');
    url.searchParams.delete('dir');
  }
  history.replaceState(null, '', url);
}

function currentReviewId() {
  const suffix = state.scope === 'frame' ? `frame:${state.frame}` : 'row';
  return `${currentKey()}|${suffix}`;
}

function keyFor(item) {
  return item.kind === 'actor'
    ? `actor:${item.role}:${item.action}:${item.dir}`
    : `ambient:${item.ambient}`;
}

function reviewCountForKey(key) {
  let count = 0;
  for (const review of reviews.values()) {
    if (review.key === key) count++;
  }
  return count;
}

function loadReviews() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    reviews = new Map(items.map((item) => [item.id, item]));
  } catch (_e) {
    reviews = new Map();
  }
}

function persistReviews() {
  localStorage.setItem(STORE_KEY, JSON.stringify([...reviews.values()]));
}

function titleCase(value) {
  return String(value).replace(/(^|-)([a-z])/g, (_m, sep, ch) => `${sep ? ' ' : ''}${ch.toUpperCase()}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
