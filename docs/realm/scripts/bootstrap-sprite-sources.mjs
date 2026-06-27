// One-time reset helper for actor and ambient sprite source files.
// Normal art iteration should edit the PNGs this creates, then run
// scripts/build-motion-atlases.mjs. Re-running this file overwrites those
// editable source PNGs from the imported CC0 reset material.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors');
const AMBIENT_DIR = join(ROOT, 'assets', 'sprites', 'ambient');
const KNIGHT_DIR = join(ACTOR_DIR, '_sources', 'isometric-painted-game-assets');
const SHIP_PATH = join(AMBIENT_DIR, '_sources', 'simple-generic-ship', 'ship_wood_CC0.png');
const CRATE_PATH = join(AMBIENT_DIR, '_sources', 'isometric-crates', 'crate.png');
const PIXEL_VILLAGE_PATH = join(AMBIENT_DIR, '_sources', 'pixel-village', 'pixel-village.png');
const OUT_PROOF = join(ROOT, 'scripts', 'screenshots', 'actor-source-sheets-bootstrap-round-076.png');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];
const ROLE_SHEET_W = FRAME_W * FRAMES;
const ROLE_SHEET_H = FRAME_H * DIRS.length * ACTIONS.length;

const ROLES = [
  { key: 'settler', tint: '#496f8d', tintAlpha: 0.14, accent: 'satchel', scale: 0.95 },
  { key: 'farmer', tint: '#668b3f', tintAlpha: 0.18, accent: 'hoe', scale: 0.96 },
  { key: 'rancher', tint: '#807842', tintAlpha: 0.17, accent: 'pail', scale: 0.97 },
  { key: 'lumber', tint: '#99603a', tintAlpha: 0.16, accent: 'axe', scale: 1.02 },
  { key: 'miner', tint: '#516b7b', tintAlpha: 0.16, accent: 'pick', scale: 1.00 },
  { key: 'stonecutter', tint: '#6f7474', tintAlpha: 0.15, accent: 'chisel', scale: 0.98 },
  { key: 'fisher', tint: '#2f7c8d', tintAlpha: 0.18, accent: 'rod', scale: 0.95 },
  { key: 'trader', tint: '#a67632', tintAlpha: 0.15, accent: 'pack', scale: 0.96 },
  { key: 'innkeeper', tint: '#984e3a', tintAlpha: 0.15, accent: 'mug', scale: 0.94 },
  { key: 'builder', tint: '#9a743e', tintAlpha: 0.16, accent: 'hammer', scale: 1.00 },
  { key: 'blacksmith', tint: '#3f4952', tintAlpha: 0.17, accent: 'tongs', scale: 1.02 },
  { key: 'guard', tint: '#334f80', tintAlpha: 0.16, accent: 'shield', scale: 1.00 },
  { key: 'scholar', tint: '#66518d', tintAlpha: 0.16, accent: 'book', scale: 0.94 },
  { key: 'forager', tint: '#5f7d3e', tintAlpha: 0.16, accent: 'basket', scale: 0.95 },
];

async function dataUrlFor(path) {
  const bytes = await readFile(path);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function bufferFromDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

await mkdir(ACTOR_DIR, { recursive: true });
await mkdir(AMBIENT_DIR, { recursive: true });
await mkdir(dirname(OUT_PROOF), { recursive: true });

const sources = {
  knight: {
    down: await dataUrlFor(join(KNIGHT_DIR, 'knight_se.png')),
    up: await dataUrlFor(join(KNIGHT_DIR, 'knight_nw.png')),
    left: await dataUrlFor(join(KNIGHT_DIR, 'knight_sw.png')),
    right: await dataUrlFor(join(KNIGHT_DIR, 'knight_ne.png')),
  },
  ship: await dataUrlFor(SHIP_PATH),
  crate: await dataUrlFor(CRATE_PATH),
  pixelVillage: await dataUrlFor(PIXEL_VILLAGE_PATH),
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 940, height: 760 }, deviceScaleFactor: 1 });

try {
  const result = await page.evaluate(async ({
    sources,
    roles,
    frameW,
    frameH,
    frames,
    dirs,
    actions,
    roleSheetW,
    roleSheetH,
  }) => {
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Could not load image ${src.slice(0, 42)}`));
        img.src = src;
      });
    }

    const knight = {};
    for (const dir of dirs) knight[dir] = await loadImage(sources.knight[dir]);
    const ship = await loadImage(sources.ship);
    const crate = await loadImage(sources.crate);
    const pixelVillage = await loadImage(sources.pixelVillage);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = 384;
    cropCanvas.height = 384;
    const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

    function extractTrimmedCrop(img, sx, sy, sw, sh, opts = {}) {
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      cropCtx.clearRect(0, 0, sw, sh);
      cropCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const image = cropCtx.getImageData(0, 0, sw, sh);
      const data = image.data;

      if (opts.clearMagenta) {
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 200 && data[i + 1] < 90 && data[i + 2] > 200) data[i + 3] = 0;
        }
      }

      if (opts.clearWhiteBorder) {
        const seen = new Uint8Array(sw * sh);
        const queue = [];
        const isWhite = (x, y) => {
          const i = (y * sw + x) * 4;
          return data[i + 3] > 0 && data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
        };
        const push = (x, y) => {
          if (x < 0 || y < 0 || x >= sw || y >= sh) return;
          const idx = y * sw + x;
          if (seen[idx] || !isWhite(x, y)) return;
          seen[idx] = 1;
          queue.push([x, y]);
        };
        for (let x = 0; x < sw; x++) {
          push(x, 0);
          push(x, sh - 1);
        }
        for (let y = 0; y < sh; y++) {
          push(0, y);
          push(sw - 1, y);
        }
        while (queue.length) {
          const [x, y] = queue.shift();
          data[(y * sw + x) * 4 + 3] = 0;
          push(x + 1, y);
          push(x - 1, y);
          push(x, y + 1);
          push(x, y - 1);
        }
      }

      let minX = sw;
      let minY = sh;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const alpha = data[(y * sw + x) * 4 + 3];
          if (alpha <= 8) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      cropCtx.putImageData(image, 0, 0);
      if (maxX < minX || maxY < minY) return { canvas: cropCanvas, x: 0, y: 0, w: sw, h: sh };
      const pad = opts.pad ?? 2;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(sw - 1, maxX + pad);
      maxY = Math.min(sh - 1, maxY + pad);
      const out = document.createElement('canvas');
      out.width = sw;
      out.height = sh;
      out.getContext('2d').putImageData(image, 0, 0);
      return { canvas: out, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }

    const knightBoxes = {};
    for (const dir of dirs) {
      knightBoxes[dir] = [];
      for (let f = 0; f < frames; f++) {
        knightBoxes[dir].push(extractTrimmedCrop(knight[dir], f * 128, 0, 128, 128, { pad: 3 }));
      }
    }

    function ellipse(ctx, x, y, rx, ry, fill, alpha = 1, rot = 0, stroke = null, lw = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      ctx.restore();
    }

    function line(ctx, x1, y1, x2, y2, color, width = 1, alpha = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    function poly(ctx, pts, fill, alpha = 1, stroke = null, lw = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      ctx.restore();
    }

    function roundRect(ctx, x, y, w, h, r, fill, alpha = 1, stroke = null) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    function clampColor(v) {
      return Math.max(0, Math.min(255, Math.round(v)));
    }

    function rgbFromHex(hex) {
      const raw = hex.replace('#', '');
      return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
      };
    }

    function repaintOrangeCloth(ctx, x, y, w, h, tintHex) {
      const tint = rgbFromHex(tintHex);
      const image = ctx.getImageData(x, y, w, h);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] <= 8) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const orangeCloth = r > 105 && g > 38 && g < 175 && b < 115 && r > g * 1.08 && g > b * 0.82;
        if (!orangeCloth) continue;
        const lum = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        const shade = 0.48 + lum * 1.05;
        data[i] = clampColor(tint.r * shade);
        data[i + 1] = clampColor(tint.g * shade);
        data[i + 2] = clampColor(tint.b * shade);
      }
      ctx.putImageData(image, x, y);
    }

    function drawRoleAccent(ctx, role, action, dir, frame, cellX, cellY) {
      const t = frame / frames * Math.PI * 2;
      const side = dir === 'left' ? -1 : 1;
      const baseX = cellX + 32;
      const baseY = cellY + 72;
      const handX = baseX + side * (action === 'carry' ? 10 : 8);
      const handY = cellY + 42 + Math.sin(t) * 2;
      const wood = '#5e351f';
      const metal = '#c2c9ca';
      const leather = '#7e512c';
      const rope = '#c59f58';
      if (role.accent === 'hoe') {
        line(ctx, handX, handY - 10, handX + side * 2, handY + 12, wood, 1.3, 0.9);
        line(ctx, handX - side * 4, handY + 11, handX + side * 7, handY + 10, metal, 1.2, 0.85);
      } else if (role.accent === 'pail') {
        ellipse(ctx, handX + side * 2, handY + 8, 4.8, 4.2, '#8a6a43', 0.92, 0, '#3a2718', 0.8);
        line(ctx, handX - side * 1, handY + 5, handX + side * 5, handY + 5, rope, 0.9, 0.75);
      } else if (role.accent === 'axe') {
        line(ctx, handX, handY - 10, handX + side * 3, handY + 12, wood, 1.5, 0.95);
        poly(ctx, [[handX, handY - 12], [handX + side * 8, handY - 11], [handX + side * 5, handY - 5], [handX, handY - 6]], metal, 0.92, '#62696c', 0.7);
      } else if (role.accent === 'pick') {
        line(ctx, handX, handY - 9, handX + side * 2, handY + 12, wood, 1.4, 0.95);
        line(ctx, handX - side * 7, handY - 10, handX + side * 9, handY - 10, metal, 1.4, 0.85);
      } else if (role.accent === 'chisel') {
        line(ctx, handX, handY - 2, handX + side * 8, handY - 8, metal, 1.3, 0.9);
        line(ctx, handX - side * 5, handY + 2, handX + side * 2, handY + 7, wood, 1.2, 0.85);
      } else if (role.accent === 'rod') {
        line(ctx, handX, handY + 10, handX + side * 14, handY - 18, '#674122', 1.0, 0.85);
        line(ctx, handX + side * 14, handY - 18, handX + side * 21, handY - 6, 'rgba(220,232,226,0.72)', 0.5, 0.75);
      } else if (role.accent === 'pack') {
        ellipse(ctx, baseX - side * 11, baseY - 29, 6.2, 7.2, '#89572c', 0.94, -0.15 * side, '#382212', 0.8);
        line(ctx, baseX - side * 4, baseY - 43, baseX - side * 12, baseY - 34, '#3a2517', 1.0, 0.75);
      } else if (role.accent === 'mug') {
        roundRect(ctx, handX - 3, handY + 2, 6, 7, 1.2, '#c38c42', 0.92, '#583019');
        ellipse(ctx, handX + side * 4, handY + 5, 2.0, 2.3, 'transparent', 1, 0, '#c38c42', 0.9);
      } else if (role.accent === 'hammer') {
        line(ctx, handX, handY - 3, handX + side * 2, handY + 10, wood, 1.4, 0.9);
        roundRect(ctx, handX - 5, handY - 6, 10, 4, 0.8, '#939ca1', 0.9, '#4b5154');
      } else if (role.accent === 'tongs') {
        line(ctx, handX, handY - 7, handX + side * 7, handY + 7, '#656b6f', 1.0, 0.9);
        line(ctx, handX + side * 3, handY - 7, handX - side * 2, handY + 7, '#7c8285', 1.0, 0.9);
        if (action === 'work') ellipse(ctx, handX + side * 8, handY + 8, 2.8, 1.5, '#e78b32', 0.65);
      } else if (role.accent === 'shield') {
        ellipse(ctx, baseX - side * 8, baseY - 31, 5.8, 8.5, '#667987', 0.92, 0.15 * side, '#22282d', 0.85);
        line(ctx, handX + side * 1, handY + 11, handX + side * 1, handY - 21, '#6b472c', 1.2, 0.85);
        poly(ctx, [[handX + side, handY - 23], [handX + side * 5, handY - 16], [handX - side * 2, handY - 16]], metal, 0.9, '#6e7578', 0.7);
      } else if (role.accent === 'book') {
        roundRect(ctx, handX - 5, handY - 3, 10, 8, 1.2, '#70402f', 0.9, '#2b1814');
        line(ctx, handX, handY - 2.5, handX, handY + 4.5, '#e6d2a7', 0.8, 0.7);
      } else if (role.accent === 'basket') {
        ellipse(ctx, handX + side * 2, handY + 6, 6.4, 4.8, '#90713d', 0.92, -0.2 * side, '#443018', 0.8);
        ellipse(ctx, handX + side * 1, handY + 2, 5.2, 1.2, '#c0a45b', 0.75, 0);
      } else if (role.accent === 'satchel') {
        ellipse(ctx, baseX - side * 8, baseY - 27, 4.9, 5.8, leather, 0.9, -0.2 * side, '#3b2415', 0.7);
      }

      if (action === 'carry' && !['pack', 'basket', 'shield'].includes(role.accent)) {
        const loadX = baseX - side * 11 + Math.sin(t) * 0.7;
        const loadY = baseY - 29 + Math.cos(t) * 0.8;
        if (['miner', 'stonecutter', 'blacksmith'].includes(role.key)) {
          poly(ctx, [[loadX - 6, loadY + 3], [loadX - 2, loadY - 5], [loadX + 6, loadY - 3], [loadX + 7, loadY + 4], [loadX, loadY + 7]], '#777c7d', 0.9, '#313638', 0.8);
        } else if (['lumber', 'builder'].includes(role.key)) {
          roundRect(ctx, loadX - 8, loadY - 4, 15, 9, 1.4, '#9b6230', 0.92, '#3a2415');
          line(ctx, loadX - 7, loadY - 1, loadX + 7, loadY - 1, '#d0a05d', 1.0, 0.65);
        } else {
          ellipse(ctx, loadX, loadY, 6.6, 5.4, '#9a733f', 0.9, 0.2 * side, '#3d2818', 0.75);
        }
      }
    }

    function drawActorCell(ctx, role, action, dir, frame, x, y) {
      const sourceFrame = action === 'idle' ? 0 : frame;
      const box = knightBoxes[dir][sourceFrame];
      const maxW = 55 * role.scale;
      const maxH = 78 * role.scale;
      const scale = Math.min(maxW / box.w, maxH / box.h);
      const drawW = box.w * scale;
      const drawH = box.h * scale;
      const bob = action === 'idle' ? 0 : Math.abs(Math.sin(frame / frames * Math.PI * 2)) * -0.9;
      const dx = x + (frameW - drawW) / 2;
      const dy = y + 79 - drawH + bob;

      ellipse(ctx, x + 32, y + 77, 14, 3.8, '#000', 0.16);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(box.canvas, box.x, box.y, box.w, box.h, dx, dy, drawW, drawH);
      ctx.restore();

      repaintOrangeCloth(ctx, x, y, frameW, frameH, role.tint);

      drawRoleAccent(ctx, role, action, dir, frame, x, y);
    }

    function sourceSheetForRole(role) {
      const canvas = document.createElement('canvas');
      canvas.width = roleSheetW;
      canvas.height = roleSheetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      for (let actionIdx = 0; actionIdx < actions.length; actionIdx++) {
        for (let dirIdx = 0; dirIdx < dirs.length; dirIdx++) {
          for (let f = 0; f < frames; f++) {
            const row = actionIdx * dirs.length + dirIdx;
            drawActorCell(ctx, role, actions[actionIdx], dirs[dirIdx], f, f * frameW, row * frameH);
          }
        }
      }
      return canvas;
    }

    function drawProcessedSprite(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh, opts = {}) {
      const crop = extractTrimmedCrop(img, sx, sy, sw, sh, opts);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(crop.canvas, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);
      ctx.restore();
    }

    function newAmbientCanvas() {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      return { canvas, ctx };
    }

    const ambient = {};
    {
      const { canvas, ctx } = newAmbientCanvas();
      ellipse(ctx, 24, 40, 17, 4.2, '#000', 0.18);
      drawProcessedSprite(ctx, pixelVillage, 133, 83, 46, 35, 7, 15, 34, 26, { pad: 1 });
      roundRect(ctx, 16, 24, 22, 12, 2, '#a26b34', 0.82, '#3b2415');
      for (const wx of [17, 35]) {
        ellipse(ctx, wx, 36, 4.2, 4.2, '#2b1d16', 0.95);
        ellipse(ctx, wx, 36, 2.2, 2.2, '#b68a4a', 0.85);
      }
      ambient.cart = canvas.toDataURL('image/png');
    }
    {
      const { canvas, ctx } = newAmbientCanvas();
      ellipse(ctx, 24, 40, 16, 3.8, '#000', 0.16);
      drawProcessedSprite(ctx, ship, 0, 0, 128, 128, 8, 18, 34, 24, { clearWhiteBorder: true, pad: 2 });
      ambient.fishboat = canvas.toDataURL('image/png');
    }
    {
      const { canvas, ctx } = newAmbientCanvas();
      ellipse(ctx, 24, 40, 17, 3.8, '#000', 0.16);
      drawProcessedSprite(ctx, ship, 128, 0, 128, 128, 5, 7, 39, 35, { clearWhiteBorder: true, pad: 2 });
      ambient.sailboat = canvas.toDataURL('image/png');
    }
    {
      const { canvas, ctx } = newAmbientCanvas();
      ellipse(ctx, 24, 40, 17, 3.9, '#000', 0.16);
      drawProcessedSprite(ctx, ship, 256, 0, 128, 128, 7, 19, 34, 22, { clearWhiteBorder: true, pad: 2 });
      drawProcessedSprite(ctx, crate, 0, 0, 64, 64, 14, 18, 12, 12, { clearMagenta: true, pad: 1 });
      drawProcessedSprite(ctx, crate, 64, 0, 64, 64, 23, 17, 13, 13, { clearMagenta: true, pad: 1 });
      ambient.cargo = canvas.toDataURL('image/png');
    }

    const roleSheets = {};
    const previewSheets = {};
    for (const role of roles) {
      const sheet = sourceSheetForRole(role);
      roleSheets[role.key] = sheet.toDataURL('image/png');
      previewSheets[role.key] = sheet;
    }

    const proof = document.createElement('canvas');
    proof.width = 920;
    proof.height = 730;
    const p = proof.getContext('2d');
    p.fillStyle = '#15110e';
    p.fillRect(0, 0, proof.width, proof.height);
    p.fillStyle = '#2a211a';
    p.fillRect(12, 12, proof.width - 24, proof.height - 24);
    p.fillStyle = '#e6d3a4';
    p.font = '18px Georgia, serif';
    p.fillText('Round 076 reset: editable actor source sheets bootstrapped from CC0 sprite art', 24, 40);
    p.fillStyle = '#bfa77d';
    p.font = '11px Menlo, monospace';
    p.fillText('Each role is now a separate PNG source file; the atlas compiler only stitches them.', 24, 60);
    for (let f = 0; f < frames; f++) p.fillText(`f${f}`, 224 + f * 70, 86);
    const proofRows = [
      ['settler', 'walk', 'down'],
      ['farmer', 'work', 'right'],
      ['lumber', 'work', 'left'],
      ['miner', 'carry', 'right'],
      ['trader', 'carry', 'left'],
      ['guard', 'walk', 'up'],
      ['forager', 'work', 'right'],
    ];
    for (let i = 0; i < proofRows.length; i++) {
      const [roleKey, action, dir] = proofRows[i];
      const actionIdx = actions.indexOf(action);
      const dirIdx = dirs.indexOf(dir);
      const row = actionIdx * dirs.length + dirIdx;
      const y = 100 + i * 75;
      p.fillStyle = '#d5bd8d';
      p.font = '13px Georgia, serif';
      p.fillText(`${roleKey}.png  ${action} ${dir}`, 24, y + 42);
      for (let f = 0; f < frames; f++) {
        p.drawImage(previewSheets[roleKey], f * frameW, row * frameH, frameW, frameH, 220 + f * 70, y, 58, 76);
      }
    }
    p.fillStyle = '#d5bd8d';
    p.font = '13px Georgia, serif';
    p.fillText('ambient source files', 24, 652);
    const ambientImgs = {};
    for (const [key, dataUrl] of Object.entries(ambient)) ambientImgs[key] = await loadImage(dataUrl);
    ['cart', 'fishboat', 'sailboat', 'cargo'].forEach((key, i) => {
      p.drawImage(ambientImgs[key], 220 + i * 68, 610, 58, 58);
      p.fillText(key, 220 + i * 68, 682);
    });

    return {
      roleSheets,
      ambient,
      proof: proof.toDataURL('image/png'),
    };
  }, {
    sources,
    roles: ROLES,
    frameW: FRAME_W,
    frameH: FRAME_H,
    frames: FRAMES,
    dirs: DIRS,
    actions: ACTIONS,
    roleSheetW: ROLE_SHEET_W,
    roleSheetH: ROLE_SHEET_H,
  });

  for (const [role, dataUrl] of Object.entries(result.roleSheets)) {
    await writeFile(join(ACTOR_DIR, `${role}.png`), bufferFromDataUrl(dataUrl));
  }
  for (const [key, dataUrl] of Object.entries(result.ambient)) {
    await writeFile(join(AMBIENT_DIR, `${key}.png`), bufferFromDataUrl(dataUrl));
  }
  await writeFile(OUT_PROOF, bufferFromDataUrl(result.proof));

  console.log(`[sprite-bootstrap] wrote ${Object.keys(result.roleSheets).length} actor source sheets to ${ACTOR_DIR}`);
  console.log(`[sprite-bootstrap] wrote ${Object.keys(result.ambient).length} ambient source sprites to ${AMBIENT_DIR}`);
  console.log(`[sprite-bootstrap] wrote ${OUT_PROOF}`);
} finally {
  await browser.close();
}
