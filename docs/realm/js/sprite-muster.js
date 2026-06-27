import {
  ACTIONS,
  DIRS,
  FRAMES,
  ROLES,
  actorRowKey,
} from '../scripts/sprite-source-contract.mjs';
import { drawActorAtlasFrame } from './render.js?realm=112';

const STATUS_STYLE = {
  accepted: { label: 'LOCKED', color: '#6dd4b8' },
  waived: { label: 'WAIVED', color: '#f5c84c' },
  candidate: { label: 'CANDIDATE', color: '#78aee6' },
  base: { label: 'BASE', color: '#d98679' },
};

const DIR_LABEL = { down: 'D', up: 'U', left: 'L', right: 'R' };

let canvas = null;
let ctx = null;
let manifest = { version: 1, rows: {} };
let page = 0;
let playing = true;
let frame = 0;
let raf = 0;
let ready = false;
let manifestReady = false;
let lastFrameAt = 0;
let currentVisibleRows = [];
const renderedRows = new Set();

export function initSpriteMuster(targetCanvas) {
  canvas = targetCanvas;
  ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const root = document.getElementById('sprite-muster-ui');
  document.body.classList.add('sprite-muster-open');
  root?.setAttribute('aria-hidden', 'false');
  if (root) root.dataset.state = 'binding';
  bindControls();
  if (root) root.dataset.state = 'loading-manifest';
  loadManifest();
  if (root) root.dataset.state = 'drawing';
  renderLoop(performance.now());
  if (root) root.dataset.state = 'running';
}

function bindControls() {
  const prev = document.getElementById('sm-prev');
  const next = document.getElementById('sm-next');
  const play = document.getElementById('sm-play');
  const lab = document.getElementById('sm-lab');
  const exit = document.getElementById('sm-exit');
  prev?.addEventListener('click', () => setPage(page - 1));
  next?.addEventListener('click', () => setPage(page + 1));
  play?.addEventListener('click', () => {
    playing = !playing;
    updateControls();
  });
  lab?.addEventListener('click', () => {
    const first = currentVisibleRows[0] || { role: 'miner', action: 'work', dir: 'up' };
    location.href = `index.html?spritelab=1&role=${encodeURIComponent(first.role)}&action=${encodeURIComponent(first.action)}&dir=${encodeURIComponent(first.dir)}`;
  });
  exit?.addEventListener('click', () => {
    const url = new URL(location.href);
    url.searchParams.delete('spritemuster');
    location.href = url.toString();
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', () => {
    page = Math.min(page, pageCount() - 1);
    updateControls();
  });

  window.__realm = window.__realm || {};
  window.__realm.spriteMuster = {
    report: () => ({
      ready,
      page,
      totalPages: pageCount(),
      frame,
      playing,
      expectedRows: ROLES.length * ACTIONS.length * DIRS.length,
      visibleRows: currentVisibleRows.map((row) => ({ ...row })),
      drawnRows: [...renderedRows],
      sourceCounts: sourceCounts(),
    }),
    setPage,
    setPlaying: (next) => {
      playing = !!next;
      updateControls();
    },
    allRows: () => allRows(),
  };
}

function onKeyDown(event) {
  if (!document.body.classList.contains('sprite-muster-open')) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    setPage(page - 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    setPage(page + 1);
  } else if (event.key === ' ') {
    event.preventDefault();
    playing = !playing;
    updateControls();
  }
}

async function loadManifest() {
  try {
    const response = await fetch(`assets/sprites/actor-rows/manifest.json?muster=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.version === 1 && data.rows) manifest = data;
    }
  } catch (_error) {
    manifest = { version: 1, rows: {} };
  }
  manifestReady = true;
  updateControls();
}

function layout() {
  const width = window.innerWidth;
  if (width >= 1050) return { rolesPerPage: 7, actionsPerPage: 4 };
  if (width >= 700) return { rolesPerPage: 5, actionsPerPage: 2 };
  return { rolesPerPage: 4, actionsPerPage: 1 };
}

function pageCount() {
  const { rolesPerPage, actionsPerPage } = layout();
  return Math.ceil(ROLES.length / rolesPerPage) * Math.ceil(ACTIONS.length / actionsPerPage);
}

function pageSlice() {
  const { rolesPerPage, actionsPerPage } = layout();
  const actionPages = Math.ceil(ACTIONS.length / actionsPerPage);
  const rolePage = Math.floor(page / actionPages);
  const actionPage = page % actionPages;
  return {
    roles: ROLES.slice(rolePage * rolesPerPage, (rolePage + 1) * rolesPerPage),
    actions: ACTIONS.slice(actionPage * actionsPerPage, (actionPage + 1) * actionsPerPage),
    rolePage,
    actionPage,
  };
}

function setPage(next) {
  const count = pageCount();
  page = ((Math.floor(next) % count) + count) % count;
  updateControls();
  draw(performance.now());
  return reportSnapshot();
}

function updateControls() {
  const label = document.getElementById('sm-page');
  const play = document.getElementById('sm-play');
  const counts = document.getElementById('sm-counts');
  if (label) label.textContent = `Muster ${page + 1} / ${pageCount()}`;
  if (play) play.textContent = playing ? 'Pause motion' : 'Play motion';
  if (counts) {
    const values = sourceCounts();
    counts.textContent = `${values.locked} locked · ${values.waived} waived · ${values.base} base`;
  }
}

function sourceFor(role, action, dir) {
  const item = manifest.rows?.[actorRowKey(role, action, dir)] || null;
  if (item?.status === 'accepted') return STATUS_STYLE.accepted;
  if (item?.status === 'accepted-with-waiver') return STATUS_STYLE.waived;
  if (item?.status === 'candidate') return STATUS_STYLE.candidate;
  return STATUS_STYLE.base;
}

function sourceCounts() {
  const counts = { locked: 0, waived: 0, candidate: 0, base: 0 };
  for (const { role, action, dir } of allRows()) {
    const source = sourceFor(role, action, dir);
    if (source.label === 'LOCKED') counts.locked++;
    else if (source.label === 'WAIVED') counts.waived++;
    else if (source.label === 'CANDIDATE') counts.candidate++;
    else counts.base++;
  }
  return counts;
}

function allRows() {
  const rows = [];
  for (const role of ROLES) {
    for (const action of ACTIONS) {
      for (const dir of DIRS) rows.push({ role, action, dir, key: actorRowKey(role, action, dir) });
    }
  }
  return rows;
}

function renderLoop(now) {
  if (!document.body.classList.contains('sprite-muster-open')) return;
  if (playing && now - lastFrameAt >= 1000 / 7) {
    frame = (frame + 1) % FRAMES;
    lastFrameAt = now;
  }
  draw(now);
  raf = requestAnimationFrame(renderLoop);
}

function draw(now) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const slice = pageSlice();
  const top = width < 700 ? 132 : 116;
  const bottom = 34;
  const leftRail = width < 700 ? 18 : 126;
  const side = width < 700 ? 12 : 24;
  const colGap = width < 700 ? 0 : 9;
  const rowGap = 7;
  const usableW = width - side * 2 - leftRail;
  const cellW = (usableW - colGap * Math.max(0, slice.actions.length - 1)) / slice.actions.length;
  const cellH = (height - top - bottom - rowGap * Math.max(0, slice.roles.length - 1)) / slice.roles.length;

  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  drawBackdrop(width, height, now);
  drawHeader(ctx, width, slice);
  currentVisibleRows = [];

  for (let roleIndex = 0; roleIndex < slice.roles.length; roleIndex++) {
    const role = slice.roles[roleIndex];
    const y = top + roleIndex * (cellH + rowGap);
    if (width >= 700) drawRoleStandard(ctx, side, y, leftRail - 10, cellH, role, ROLES.indexOf(role));
    for (let actionIndex = 0; actionIndex < slice.actions.length; actionIndex++) {
      const action = slice.actions[actionIndex];
      const x = side + leftRail + actionIndex * (cellW + colGap);
      drawActionCell(ctx, x, y, cellW, cellH, role, action);
    }
  }

  ctx.restore();
  ready = manifestReady && currentVisibleRows.length > 0 && currentVisibleRows.every((row) => row.drawn);
}

function drawBackdrop(width, height, now) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#071218');
  gradient.addColorStop(0.48, '#12242a');
  gradient.addColorStop(1, '#261c18');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(width * 0.5, height * 0.18, 10, width * 0.5, height * 0.18, width * 0.7);
  glow.addColorStop(0, 'rgba(245,200,76,0.09)');
  glow.addColorStop(1, 'rgba(245,200,76,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.14;
  ctx.strokeStyle = '#6dd4b8';
  ctx.lineWidth = 1;
  const sweep = (now * 0.035) % (width + 240) - 120;
  ctx.beginPath();
  ctx.moveTo(sweep, 88);
  ctx.lineTo(sweep - 180, height);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHeader(target, width, slice) {
  target.fillStyle = 'rgba(3,8,11,0.72)';
  target.fillRect(0, 0, width, width < 700 ? 114 : 98);
  target.strokeStyle = 'rgba(245,200,76,0.25)';
  target.beginPath();
  target.moveTo(0, width < 700 ? 113.5 : 97.5);
  target.lineTo(width, width < 700 ? 113.5 : 97.5);
  target.stroke();

  target.textBaseline = 'alphabetic';
  target.fillStyle = '#f5c84c';
  target.font = `800 ${width < 700 ? 19 : 25}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  target.fillText('ACTOR MUSTER', width < 700 ? 14 : 24, width < 700 ? 26 : 34);
  target.fillStyle = 'rgba(232,237,240,0.62)';
  target.font = `600 ${width < 700 ? 9 : 11}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  target.fillText('LIVE GAME CANVAS · RUNTIME ATLAS · 224 ROWS · 1,792 FRAMES', width < 700 ? 14 : 26, width < 700 ? 43 : 54);

  if (width >= 700) {
    const side = 24;
    const leftRail = 126;
    const gap = 9;
    const usableW = width - side * 2 - leftRail;
    const cellW = (usableW - gap * Math.max(0, slice.actions.length - 1)) / slice.actions.length;
    for (let index = 0; index < slice.actions.length; index++) {
      const action = slice.actions[index];
      const x = side + leftRail + index * (cellW + gap);
      target.fillStyle = 'rgba(232,237,240,0.5)';
      target.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      target.textAlign = 'center';
      target.fillText(action.toUpperCase(), x + cellW / 2, 87);
    }
    target.textAlign = 'left';
  }
}

function drawRoleStandard(target, x, y, width, height, role, roleIndex) {
  const accent = ['#d98679', '#d5ad62', '#6dd4b8', '#78aee6'][roleIndex % 4];
  target.fillStyle = 'rgba(5,11,14,0.66)';
  roundedRect(target, x, y, width, height, 7);
  target.fill();
  target.fillStyle = accent;
  target.fillRect(x, y, 3, height);
  target.fillStyle = '#edf1ef';
  target.font = '800 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  target.textAlign = 'left';
  target.fillText(role.toUpperCase(), x + 12, y + height * 0.48);
  target.fillStyle = 'rgba(232,237,240,0.38)';
  target.font = '600 8px ui-monospace, SFMono-Regular, Menlo, monospace';
  target.fillText(`ROLE ${String(roleIndex + 1).padStart(2, '0')}`, x + 12, y + height * 0.48 + 14);
}

function drawActionCell(target, x, y, width, height, role, action) {
  target.fillStyle = 'rgba(7,15,18,0.70)';
  roundedRect(target, x, y, width, height, 8);
  target.fill();
  target.strokeStyle = 'rgba(255,255,255,0.09)';
  target.stroke();

  if (window.innerWidth < 700) {
    target.fillStyle = 'rgba(245,200,76,0.72)';
    target.font = '800 9px ui-monospace, SFMono-Regular, Menlo, monospace';
    target.textAlign = 'left';
    target.fillText(`${role.toUpperCase()} · ${action.toUpperCase()}`, x + 10, y + 15);
  }

  const pad = window.innerWidth < 700 ? 12 : 8;
  const dirW = (width - pad * 2) / DIRS.length;
  const actorH = Math.max(34, Math.min(window.innerWidth < 700 ? 68 : 52, height - (window.innerWidth < 700 ? 42 : 25)));
  const actorW = actorH * (27 / 35);
  const actorY = y + Math.max(window.innerWidth < 700 ? 22 : 4, (height - actorH - 14) / 2);

  for (let index = 0; index < DIRS.length; index++) {
    const dir = DIRS[index];
    const key = actorRowKey(role, action, dir);
    const centerX = x + pad + dirW * (index + 0.5);
    const source = sourceFor(role, action, dir);
    target.fillStyle = 'rgba(0,0,0,0.22)';
    target.beginPath();
    target.ellipse(centerX, actorY + actorH - 1, actorW * 0.34, actorH * 0.055, 0, 0, Math.PI * 2);
    target.fill();
    const drawn = drawActorAtlasFrame(target, {
      role,
      action,
      dir,
      frame,
      x: centerX - actorW / 2,
      y: actorY,
      width: actorW,
      height: actorH,
    });
    currentVisibleRows.push({ role, action, dir, key, drawn, status: source.label });
    if (drawn) renderedRows.add(key);

    const labelY = y + height - 7;
    target.fillStyle = source.color;
    target.beginPath();
    target.arc(centerX - 7, labelY - 2.5, 2.4, 0, Math.PI * 2);
    target.fill();
    target.fillStyle = 'rgba(232,237,240,0.62)';
    target.font = '700 8px ui-monospace, SFMono-Regular, Menlo, monospace';
    target.textAlign = 'left';
    target.fillText(DIR_LABEL[dir], centerX - 2, labelY);
  }
}

function roundedRect(target, x, y, width, height, radius) {
  target.beginPath();
  target.roundRect(x, y, width, height, radius);
}

function reportSnapshot() {
  return window.__realm?.spriteMuster?.report?.() || null;
}
