// ════════════════════════════════════════════════════════════
// Minimap — renderer-independent map overview
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js';

let minimapC = null;
let minimapCtx = null;
let viewportResolver = null;

const MINI_COLORS = {
  0:'#356f7f', 1:'#d3b06d', 2:'#6ea95a', 3:'#3d7240',
  4:'#918a7a', 5:'#638aa2', 6:'#7e7c78',
};

const MINI_BUILD = {
  house:'#c99655', farm:'#8caf54', lumber:'#8b5f36',
  quarry:'#a0a29d', mine:'#6f95ac', market:'#d49445',
  barracks:'#75818a', tower:'#aaa8a0', church:'#d8c79a',
  castle:'#e0bd66', tavern:'#b76342', wall:'#8a8174',
  road:'#a38b5f', well:'#76a8ba', granary:'#b9874a',
  tradingpost:'#d19b55', school:'#c9a46e',
  fisherman:'#5e9bad', archery:'#8a5d44', blacksmith:'#9b5839',
  bakery:'#d2a25c', windmill:'#d7c085', chickencoop:'#d0b45a',
  cowpen:'#9a744a',
};

function shadeColor(hex, amt) {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(c.length === 3 ? c.split('').map(ch => ch + ch).join('') : c, 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function initMinimap(minimap) {
  minimapC = minimap;
  minimapCtx = minimap?.getContext('2d') || null;
}

export function setMinimapViewportResolver(resolver) {
  viewportResolver = typeof resolver === 'function' ? resolver : null;
}

function drawViewport(mc, sx, sy) {
  if (!viewportResolver) return;
  const insetTop = 50;
  const insetBottom = 50;
  const points = [
    viewportResolver(0, insetTop),
    viewportResolver(window.innerWidth, insetTop),
    viewportResolver(0, window.innerHeight - insetBottom),
    viewportResolver(window.innerWidth, window.innerHeight - insetBottom),
  ].filter(Boolean);
  if (points.length < 2) return;

  const xs = points.map(p => clamp(p.x, 0, MAP_W - 1));
  const ys = points.map(p => clamp(p.y, 0, MAP_H - 1));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const vx = minX * sx;
  const vy = minY * sy;
  const vw = Math.max(2, (maxX - minX + 1) * sx);
  const vh = Math.max(2, (maxY - minY + 1) * sy);

  mc.fillStyle = 'rgba(250,215,126,0.08)';
  mc.fillRect(vx, vy, vw, vh);
  mc.strokeStyle = 'rgba(22,18,12,0.58)';
  mc.lineWidth = 3.5;
  mc.strokeRect(vx, vy, vw, vh);
  mc.strokeStyle = 'rgba(250,215,126,0.88)';
  mc.lineWidth = 1.5;
  mc.strokeRect(vx, vy, vw, vh);
}

export function renderMinimap() {
  if (!minimapC || !minimapCtx || !G.map?.length) return;
  const mc = minimapCtx;
  const mw = minimapC.width, mh = minimapC.height;
  const sx = mw / MAP_W, sy = mh / MAP_H;

  mc.fillStyle = '#15231c';
  mc.fillRect(0, 0, mw, mh);
  const paper = mc.createRadialGradient(mw * 0.48, mh * 0.45, mw * 0.12, mw * 0.48, mh * 0.45, mw * 0.76);
  paper.addColorStop(0, 'rgba(218,184,112,0.17)');
  paper.addColorStop(0.62, 'rgba(70,104,64,0.08)');
  paper.addColorStop(1, 'rgba(0,0,0,0.20)');
  mc.fillStyle = paper;
  mc.fillRect(0, 0, mw, mh);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const n = ((x * 17 + y * 31 + (x ^ y) * 7) & 15) - 7;
      if (G.fog[y][x]) {
        mc.globalAlpha = 1;
        mc.fillStyle = shadeColor(MINI_COLORS[G.map[y][x]] || '#111', n * 0.85);
      } else {
        mc.globalAlpha = G.map[y][x] === TILE.WATER ? 0.20 : 0.30;
        mc.fillStyle = shadeColor(MINI_COLORS[G.map[y][x]] || '#111', -10 + n * 0.6);
      }
      mc.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
  }
  mc.globalAlpha = 1;

  const wash = mc.createLinearGradient(0, 0, mw, mh);
  wash.addColorStop(0, 'rgba(255,238,170,0.07)');
  wash.addColorStop(0.45, 'rgba(255,255,255,0.00)');
  wash.addColorStop(1, 'rgba(4,7,9,0.16)');
  mc.fillStyle = wash;
  mc.fillRect(0, 0, mw, mh);

  mc.strokeStyle = 'rgba(128,94,48,0.74)';
  mc.lineWidth = 1.2;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!G.fog[y][x] || G.map[y][x] !== TILE.IRON) continue;
      const cx = (x + 0.5) * sx;
      const cy = (y + 0.5) * sy;
      if (x + 1 < MAP_W && G.fog[y][x+1] && G.map[y][x+1] === TILE.IRON) {
        mc.beginPath();
        mc.moveTo(cx, cy);
        mc.lineTo((x + 1.5) * sx, cy);
        mc.stroke();
      }
      if (y + 1 < MAP_H && G.fog[y+1][x] && G.map[y+1][x] === TILE.IRON) {
        mc.beginPath();
        mc.moveTo(cx, cy);
        mc.lineTo(cx, (y + 1.5) * sy);
        mc.stroke();
      }
    }
  }

  for (const b of G.buildings) {
    if (!G.fog[b.y]?.[b.x]) continue;
    const bx = (b.x + 0.5) * sx;
    const by = (b.y + 0.5) * sy;
    const r = b.type === 'castle' ? 4.4 : b.type === 'tower' || b.type === 'church' ? 3.6 : b.type === 'road' || b.type === 'wall' ? 1.8 : 3.0;
    mc.beginPath();
    mc.ellipse(bx, by + 0.6, r + 1.4, r * 0.62 + 1, 0, 0, Math.PI * 2);
    mc.fillStyle = 'rgba(0,0,0,0.34)';
    mc.fill();
    mc.beginPath();
    mc.moveTo(bx, by - r);
    mc.lineTo(bx + r, by);
    mc.lineTo(bx, by + r);
    mc.lineTo(bx - r, by);
    mc.closePath();
    mc.fillStyle = MINI_BUILD[b.type] || '#fff';
    mc.fill();
    mc.strokeStyle = 'rgba(255,236,180,0.35)';
    mc.lineWidth = 0.75;
    mc.stroke();
  }

  for (const c of G.citizens) {
    const cx = Math.round(c.x * sx);
    const cy = Math.round(c.y * sy);
    mc.fillStyle = 'rgba(40,24,10,0.42)';
    mc.fillRect(cx - 1, cy, 3, 2);
    mc.fillStyle = '#e7c36d';
    mc.fillRect(cx, cy - 1, 2, 2);
  }

  for (const e of G.enemies) {
    const mx = (e.x / MAP_W) * minimapC.width;
    const my = (e.y / MAP_H) * minimapC.height;
    mc.fillStyle = '#ef4444';
    mc.beginPath();
    mc.arc(mx, my, 2, 0, Math.PI * 2);
    mc.fill();
  }

  for (const s of G.soldiers) {
    const mx = (s.x / MAP_W) * minimapC.width;
    const my = (s.y / MAP_H) * minimapC.height;
    mc.fillStyle = s.type === 'archer' ? '#22c55e' : '#3b82f6';
    mc.beginPath();
    mc.arc(mx, my, 1.5, 0, Math.PI * 2);
    mc.fill();
  }

  drawViewport(mc, sx, sy);

  mc.strokeStyle = 'rgba(220,184,112,0.48)';
  mc.lineWidth = 1;
  mc.strokeRect(0.5, 0.5, mw - 1, mh - 1);

  const vign = mc.createRadialGradient(mw / 2, mh / 2, mw * 0.3, mw / 2, mh / 2, mw * 0.72);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.26)');
  mc.fillStyle = vign;
  mc.fillRect(0, 0, mw, mh);
}
