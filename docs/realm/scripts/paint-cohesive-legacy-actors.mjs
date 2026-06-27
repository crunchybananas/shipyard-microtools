// Repaints legacy separated-limb or blobby actor rows with cohesive raster
// rows. This pass is intentionally broad for the old base-role art, but still
// preserves newer imagegen-heavy role/action blocks.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors');
const SHOTS = join(ROOT, 'scripts', 'screenshots');
const OUT_DIR = join(ROOT, 'tmp', 'realm-graphics-round-112');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];

const ROLE_CONFIG = {
  settler: { cloth: '#4f83a8', trim: '#263d54', skin: '#f0c58b', hair: '#223344', prop: 'satchel', headgear: 'parted' },
  farmer: { cloth: '#5c9a43', trim: '#2d5429', skin: '#f0c58b', hair: '#59691d', prop: 'hoe', headgear: 'straw' },
  rancher: { cloth: '#8f7938', trim: '#4e3c1e', skin: '#edc083', hair: '#7b6d2c', prop: 'pail', headgear: 'wide' },
  lumber: { cloth: '#9f6334', trim: '#4d2e1c', skin: '#efc486', hair: '#7c4a24', prop: 'axe', headgear: 'cap' },
  miner: { cloth: '#5e7f93', trim: '#263f50', skin: '#eec284', hair: '#253946', prop: 'pick', headgear: 'cap' },
  stonecutter: { cloth: '#7a7b78', trim: '#3d4347', skin: '#efc486', hair: '#4e565b', prop: 'chisel', headgear: 'cap' },
  fisher: { cloth: '#4f7f90', trim: '#29464e', skin: '#efc486', hair: '#47585e', prop: 'rod', headgear: 'cap' },
  trader: { cloth: '#9b7b41', trim: '#5b3c1e', skin: '#efc486', hair: '#5c4227', prop: 'pack', headgear: 'parted' },
  innkeeper: { cloth: '#a45d3f', trim: '#63311f', skin: '#efc486', hair: '#8a4d34', prop: 'mug', headgear: 'parted' },
  builder: { cloth: '#9a743e', trim: '#54381e', skin: '#efc486', hair: '#6d4727', prop: 'hammer', headgear: 'cap' },
  blacksmith: { cloth: '#3f4952', trim: '#2b2521', skin: '#efc486', hair: '#2e3032', prop: 'hammer', headgear: 'parted' },
  guard: { cloth: '#426ca0', trim: '#2d3545', skin: '#efc486', hair: '#293d5e', prop: 'shield', metal: '#b5bdc3', headgear: 'helm' },
  scholar: { cloth: '#6c627d', trim: '#3d354b', skin: '#efc486', hair: '#55515c', prop: 'book', headgear: 'parted' },
  forager: { cloth: '#70904a', trim: '#384c29', skin: '#efc486', hair: '#617342', prop: 'basket', headgear: 'cap' },
};

const KEEP_SPECIAL = new Set([
  'blacksmith/walk', 'blacksmith/work', 'blacksmith/carry',
  'builder/walk', 'builder/work', 'builder/carry',
  'lumber/walk', 'lumber/work', 'lumber/carry',
  'miner/work',
  'guard/work', 'guard/carry',
]);

const LEGACY_COHORT = [
  'blacksmith/idle',
  'builder/idle',
  'farmer/idle', 'farmer/walk',
  'fisher/carry', 'fisher/walk', 'fisher/work',
  'fisher/idle',
  'forager/carry', 'forager/walk', 'forager/work',
  'forager/idle',
  'guard/idle', 'guard/walk',
  'innkeeper/carry', 'innkeeper/walk', 'innkeeper/work',
  'innkeeper/idle',
  'miner/carry', 'miner/walk',
  'miner/idle',
  'rancher/carry', 'rancher/walk', 'rancher/work',
  'rancher/idle',
  'scholar/carry', 'scholar/walk', 'scholar/work',
  'scholar/idle',
  'settler/carry', 'settler/work',
  'stonecutter/carry', 'stonecutter/walk', 'stonecutter/work',
  'stonecutter/idle',
  'trader/carry', 'trader/walk', 'trader/work',
  'trader/idle',
];

function keyFor(row) {
  return `${row.role}/${row.action}`;
}

function chooseTargets(report) {
  const combos = new Set(LEGACY_COHORT);
  for (const row of report.reports) {
    if (!ROLE_CONFIG[row.role]) continue;
    if (KEEP_SPECIAL.has(keyFor(row))) continue;
    if (row.action === 'idle' && !combos.has(keyFor(row))) continue;
    if (row.fragmentPixels >= 240 || row.score >= 75) combos.add(keyFor(row));
  }
  return [...combos].map((combo) => {
    const [role, action] = combo.split('/');
    return { role, action };
  }).sort((a, b) => a.role.localeCompare(b.role) || a.action.localeCompare(b.action));
}

function bufferFromDataUrl(dataUrl) {
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(SHOTS, { recursive: true });

const report = JSON.parse(await readFile(join(SHOTS, 'sprite-audit-report.json'), 'utf8'));
const targets = chooseTargets(report);
const targetRoles = [...new Set(targets.map((item) => item.role))];
const sheets = {};
for (const role of targetRoles) {
  const bytes = await readFile(join(ACTOR_DIR, `${role}.png`));
  sheets[role] = `data:image/png;base64,${bytes.toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const result = await page.evaluate(async ({
  actions,
  dirs,
  frameW,
  frameH,
  frames,
  roleConfig,
  sheets,
  targets,
}) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function softEllipse(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function capsule(ctx, x1, y1, x2, y2, width, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function footPhase(frame) {
    return Math.sin((frame / frames) * Math.PI * 4);
  }

  function gait(frame, scale = 1, action = 'walk') {
    const raw = footPhase(frame);
    const cycle = Math.cos((frame / frames) * Math.PI * 4);
    const strideScale = action === 'idle' ? 0.08 : action === 'work' ? 0.22 : action === 'carry' ? 0.68 : 1;
    const p = raw * strideScale * scale;
    const bobScale = action === 'idle' ? 0.35 : action === 'work' ? 0.5 : 1.2;
    return {
      p,
      raw,
      bob: action === 'idle' ? cycle * bobScale : -Math.abs(cycle) * bobScale,
      leftStep: p * 5.2,
      rightStep: -p * 5.2,
      arm: -raw * (action === 'work' ? 7.4 : action === 'idle' ? 1.2 : 4.2) * scale,
      tool: Math.sin((frame / frames) * Math.PI * 2),
    };
  }

  function poly(ctx, points, fill, stroke = null, width = 1.5) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHeadgear(ctx, cfg, cx, headY, side = 0) {
    const hair = cfg.hair;
    const dark = cfg.trim;
    if (cfg.headgear === 'straw' || cfg.headgear === 'wide') {
      const brim = cfg.headgear === 'wide' ? 14 : 12;
      ctx.fillStyle = shade(hair, 24);
      ctx.strokeStyle = shade(dark, -10);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(cx + side * 1.5, headY - 7.5, brim, 3.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = shade(hair, 36);
      ctx.beginPath();
      ctx.roundRect(cx - 5 + side * 1.2, headY - 13, 10, 7, 2.5);
      ctx.fill();
      return;
    }
    if (cfg.headgear === 'cap') {
      poly(ctx, [
        [cx - 8 + side, headY - 8],
        [cx + 4 + side, headY - 11],
        [cx + 9 + side, headY - 6],
        [cx + 4 + side, headY - 3],
        [cx - 8 + side, headY - 4],
      ], shade(hair, 20), shade(dark, -8), 1.1);
      return;
    }
    if (cfg.headgear === 'helm') {
      ctx.fillStyle = cfg.metal || '#b7bec5';
      ctx.strokeStyle = shade(dark, -8);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.ellipse(cx, headY - 4, 9, 6, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      capsule(ctx, cx + side * 2, headY - 6, cx + side * 2, headY + 5, 1.5, shade(dark, 22));
      return;
    }
    ctx.fillStyle = shade(hair, 12);
    ctx.beginPath();
    ctx.ellipse(cx + side, headY - 5, 8.5, 5.2, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    capsule(ctx, cx - 4 + side, headY - 6, cx + 3 + side, headY - 9, 1.2, shade(hair, 32));
  }

  function drawProp(ctx, cfg, action, dir, frame, cx, cy, side) {
    const prop = action === 'carry' ? 'bundle' : cfg.prop;
    const g = gait(frame, 1, action);
    const quiet = action === 'idle';
    const handY = cy + 16 + Math.abs(g.p) * 1.5 + (quiet ? 1.5 : 0);
    const handX = cx + side * (quiet ? 9 : 12);
    const swing = action === 'work' ? g.tool * 5 : quiet ? 0 : g.arm * 0.15;
    ctx.lineCap = 'round';

    if (prop === 'bundle' || prop === 'pack' || prop === 'basket') {
      const w = prop === 'pack' ? 8 : 7;
      const h = prop === 'pack' ? 10 : 8;
      ctx.fillStyle = prop === 'basket' ? '#8b6731' : '#8d5e31';
      ctx.strokeStyle = '#51351e';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(handX + side * 1.5, handY + 2, w, h, 0.12 * side, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      capsule(ctx, handX + side * -4, handY - 2, handX + side * 5, handY - 2, 1.2, '#51351e');
      return;
    }
    if (prop === 'book') {
      ctx.fillStyle = '#6e3d5f';
      ctx.strokeStyle = '#372336';
      ctx.lineWidth = 1.4;
      ctx.fillRect(handX - 4, handY - 4, 9, 7);
      ctx.strokeRect(handX - 4, handY - 4, 9, 7);
      capsule(ctx, handX + 0.5, handY - 3, handX + 0.5, handY + 2, 0.8, '#b58aa6');
      return;
    }
    if (prop === 'mug' || prop === 'pail') {
      ctx.fillStyle = prop === 'mug' ? '#b08339' : '#8a6f43';
      ctx.strokeStyle = '#4c3920';
      ctx.lineWidth = 1.3;
      ctx.fillRect(handX - 4, handY - 4, 8, 8);
      ctx.strokeRect(handX - 4, handY - 4, 8, 8);
      ctx.beginPath();
      ctx.arc(handX + side * 5, handY, 3, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      return;
    }
    if (prop === 'shield') {
      ctx.fillStyle = cfg.metal || '#aeb4ba';
      ctx.strokeStyle = '#4c5660';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(handX - 5, handY - 10, 10, 17, 3);
      ctx.fill();
      ctx.stroke();
      capsule(ctx, handX - 2, handY - 2, handX + 2, handY - 2, 1.2, '#6d7880');
      return;
    }
    if (prop === 'hoe' || prop === 'rod' || prop === 'chisel' || prop === 'pick' || prop === 'axe' || prop === 'hammer') {
      const len = prop === 'rod' ? 30 : prop === 'axe' ? 22 : 20;
      const y2 = handY - 8 - swing;
      ctx.strokeStyle = prop === 'rod' ? '#4c3520' : '#5b3a22';
      ctx.lineWidth = prop === 'rod' ? 1.35 : 2.1;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + side * len, y2);
      ctx.stroke();
      if (prop === 'pick') capsule(ctx, handX + side * (len - 6), y2 - 3, handX + side * (len + 7), y2 + 1, 2.1, '#b7bcc0');
      if (prop === 'hoe') capsule(ctx, handX + side * (len - 1), y2 - 4, handX + side * (len + 2), y2 + 4, 1.9, '#a7aa9e');
      if (prop === 'axe') capsule(ctx, handX + side * (len - 1), y2 - 5, handX + side * (len + 4), y2 + 3, 3.6, '#c0c3c5');
      if (prop === 'hammer') {
        capsule(ctx, handX + side * (len - 3), y2 - 5, handX + side * (len + 5), y2 - 2, 3.3, '#aeb4b8');
        capsule(ctx, handX + side * (len + 1), y2 - 7, handX + side * (len + 1), y2 + 1, 1.4, '#6b7379');
      }
      if (prop === 'chisel') capsule(ctx, handX + side * (len - 3), y2 - 2, handX + side * (len + 3), y2, 1.5, '#bdc4c7');
    }
  }

  function drawFrontBack(ctx, cfg, action, dir, frame, ox, oy) {
    const up = dir === 'up';
    const g = gait(frame, 1, action);
    const cx = ox + frameW / 2;
    const ground = oy + 76;
    const cy = oy + 35 + g.bob;
    const cloth = cfg.cloth;
    const dark = cfg.trim;
    const skin = cfg.skin;
    const hair = cfg.hair;
    const leftLead = Math.max(0, g.p);
    const rightLead = Math.max(0, -g.p);
    const stance = action === 'work' ? 1.8 : action === 'idle' ? 0.6 : 0;
    const leftFootX = cx - 8 - leftLead * 4 + rightLead * 1.4 - stance;
    const rightFootX = cx + 8 + rightLead * 4 - leftLead * 1.4 + stance;
    const leftLegW = 4.8 + leftLead * 3.2;
    const rightLegW = 4.8 + rightLead * 3.2;

    capsule(ctx, cx - 4, cy + 24, leftFootX, ground - 5 - leftLead * 1.1, leftLegW, shade(dark, 6));
    capsule(ctx, cx + 4, cy + 24, rightFootX, ground - 5 - rightLead * 1.1, rightLegW, shade(dark, -4));
    softEllipse(ctx, leftFootX, ground - 3, 4.1 + leftLead * 3.1, 1.8 + leftLead * 1.2, '#26292d');
    softEllipse(ctx, rightFootX, ground - 3, 4.1 + rightLead * 3.1, 1.8 + rightLead * 1.2, '#26292d');

    const bodyGrad = ctx.createLinearGradient(cx - 12, cy + 5, cx + 12, cy + 38);
    bodyGrad.addColorStop(0, shade(cloth, 34));
    bodyGrad.addColorStop(0.55, cloth);
    bodyGrad.addColorStop(1, shade(cloth, -38));
    poly(ctx, [
      [cx - 12.5, cy + 7],
      [cx + 12.5, cy + 7],
      [cx + 10.5, cy + 24],
      [cx + 7.5, cy + 38],
      [cx - 7.5, cy + 38],
      [cx - 10.5, cy + 24],
    ], bodyGrad, shade(dark, -18), 1.8);
    capsule(ctx, cx - 8, cy + 25, cx + 8, cy + 25, 2, shade(dark, -22));
    capsule(ctx, cx, cy + 9, cx, cy + 36, 1, up ? shade(dark, 8) : shade(cloth, 34));
    poly(ctx, [
      [cx - 5, cy + 8],
      [cx, cy + 12],
      [cx + 5, cy + 8],
      [cx + 3, cy + 15],
      [cx - 3, cy + 15],
    ], up ? shade(cloth, -6) : shade(skin, -18));

    capsule(ctx, cx - 10, cy + 13, cx - 15 + g.arm * 0.28, cy + 28, 5.1, shade(cloth, -22));
    capsule(ctx, cx + 10, cy + 13, cx + 15 - g.arm * 0.28, cy + 28, 5.1, shade(cloth, -28));
    softEllipse(ctx, cx - 15 + g.arm * 0.28, cy + 29, 3.1, 3, skin);
    softEllipse(ctx, cx + 15 - g.arm * 0.28, cy + 29, 3.1, 3, skin);

    const headY = cy - 4;
    ctx.fillStyle = up ? shade(hair, 10) : shade(hair, -8);
    ctx.beginPath();
    ctx.ellipse(cx, headY, 9, 10.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!up) {
      softEllipse(ctx, cx, headY + 1.8, 7.5, 9.2, skin);
      softEllipse(ctx, cx - 2.8, headY + 1, 0.95, 1.15, '#24313a');
      softEllipse(ctx, cx + 2.8, headY + 1, 0.95, 1.15, '#24313a');
      capsule(ctx, cx - 2.4, headY + 6, cx + 2.4, headY + 6, 1, '#7c4b3d');
    }
    drawHeadgear(ctx, cfg, cx, headY, 0);
    drawProp(ctx, cfg, action, dir, frame, cx, cy, frame % 2 ? -1 : 1);
  }

  function drawSide(ctx, cfg, action, dir, frame, ox, oy) {
    const flip = dir === 'right' ? -1 : 1;
    ctx.save();
    ctx.translate(ox + frameW / 2, oy);
    ctx.scale(flip, 1);
    ctx.translate(-frameW / 2, 0);

    const g = gait(frame, 0.92, action);
    const cx = frameW / 2;
    const ground = 76;
    const cy = 35 + g.bob;
    const cloth = cfg.cloth;
    const dark = cfg.trim;
    const skin = cfg.skin;
    const hair = cfg.hair;
    const stride = Math.abs(g.p);
    const pass = 1 - Math.min(1, stride);
    const rearFootX = cx - 6 - g.p * 9;
    const frontFootX = cx + 8 + g.p * 11;
    const rearKneeX = cx - 2 - g.p * 3;
    const frontKneeX = cx + 5 + g.p * 4;

    capsule(ctx, cx - 1, cy + 24, rearKneeX, cy + 43, 5.9, shade(dark, 5));
    capsule(ctx, rearKneeX, cy + 43, rearFootX, ground - 5, 5.7, shade(dark, 0));
    capsule(ctx, cx + 4, cy + 24, frontKneeX, cy + 43, 5.9, shade(dark, -6));
    capsule(ctx, frontKneeX, cy + 43, frontFootX, ground - 5, 5.7, shade(dark, -10));
    softEllipse(ctx, rearFootX, ground - 3, 4 + stride * 2 + pass * 0.6, 1.9, '#2b2e31');
    softEllipse(ctx, frontFootX, ground - 3, 4.3 + stride * 2.2, 2, '#272a2e');

    const bodyGrad = ctx.createLinearGradient(cx - 10, cy + 6, cx + 12, cy + 37);
    bodyGrad.addColorStop(0, shade(cloth, 30));
    bodyGrad.addColorStop(1, shade(cloth, -36));
    poly(ctx, [
      [cx - 9.5, cy + 8],
      [cx + 10.5, cy + 7],
      [cx + 12, cy + 23],
      [cx + 8, cy + 38],
      [cx - 6.5, cy + 38],
      [cx - 9.5, cy + 22],
    ], bodyGrad, shade(dark, -18), 1.8);
    capsule(ctx, cx - 7, cy + 25, cx + 9, cy + 25, 2, shade(dark, -22));
    capsule(ctx, cx + 2, cy + 10, cx + 2, cy + 36, 0.9, shade(cloth, 32));

    capsule(ctx, cx + 8, cy + 13, cx + 17 - g.arm * 0.32, cy + 28, 5.1, shade(cloth, -22));
    capsule(ctx, cx - 6, cy + 14, cx - 11 + g.arm * 0.16, cy + 26, 4.4, shade(cloth, -30));
    softEllipse(ctx, cx + 18 - g.arm * 0.32, cy + 29, 3.1, 3, skin);

    const headY = cy - 4;
    softEllipse(ctx, cx - 1, headY, 8.6, 10.5, shade(hair, -6));
    softEllipse(ctx, cx + 3, headY + 1.5, 6.9, 8.8, skin);
    drawHeadgear(ctx, cfg, cx - 1, headY, 1);
    softEllipse(ctx, cx + 6.2, headY + 1, 0.95, 1.15, '#24313a');
    poly(ctx, [
      [cx + 9, headY + 3],
      [cx + 12, headY + 4.2],
      [cx + 8.4, headY + 5.1],
    ], shade(skin, -8));
    capsule(ctx, cx + 5, headY + 6.2, cx + 8.6, headY + 6.2, 1, '#7c4b3d');

    drawProp(ctx, cfg, action, dir, frame, cx, cy, 1);
    ctx.restore();
  }

  function drawRow(ctx, cfg, action, dir, rowIndex) {
    const y = rowIndex * frameH;
    ctx.clearRect(0, y, frameW * frames, frameH);
    for (let frame = 0; frame < frames; frame++) {
      const x = frame * frameW;
      if (dir === 'left' || dir === 'right') drawSide(ctx, cfg, action, dir, frame, x, y);
      else drawFrontBack(ctx, cfg, action, dir, frame, x, y);
    }
  }

  function drawProofRow(ctx, sheet, role, action, before, after, slot) {
    const rowIndex = actions.indexOf(action) * dirs.length + 0;
    const y = slot * 190;
    ctx.fillStyle = slot % 2 ? '#171a17' : '#111411';
    ctx.fillRect(0, y, ctx.canvas.width, 190);
    ctx.fillStyle = '#f0ead8';
    ctx.font = '15px sans-serif';
    ctx.fillText(`${role}/${action}`, 16, y + 24);
    ctx.fillStyle = '#bfb8a6';
    ctx.fillText('before', 16, y + 58);
    ctx.fillText('after', 16, y + 145);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(before, 0, rowIndex * frameH, frameW * frames, frameH, 94, y + 10, frameW * frames, frameH);
    ctx.drawImage(after, 0, rowIndex * frameH, frameW * frames, frameH, 94, y + 102, frameW * frames, frameH);
  }

  const modified = {};
  const proofRows = [];
  for (const role of Object.keys(sheets)) {
    const img = await loadImage(sheets[role]);
    const before = document.createElement('canvas');
    before.width = img.naturalWidth;
    before.height = img.naturalHeight;
    before.getContext('2d').drawImage(img, 0, 0);

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const roleTargets = targets.filter((target) => target.role === role);
    for (const target of roleTargets) {
      for (const dir of dirs) {
        const rowIndex = actions.indexOf(target.action) * dirs.length + dirs.indexOf(dir);
        drawRow(ctx, roleConfig[role], target.action, dir, rowIndex);
      }
      proofRows.push({ role, action: target.action, before, after: canvas });
    }
    modified[role] = canvas.toDataURL('image/png');
  }

  const proofCount = Math.min(24, proofRows.length);
  const proof = document.createElement('canvas');
  proof.width = 640;
  proof.height = proofCount * 190;
  const proofCtx = proof.getContext('2d');
  proofCtx.fillStyle = '#111411';
  proofCtx.fillRect(0, 0, proof.width, proof.height);
  for (let i = 0; i < proofCount; i++) {
    const row = proofRows[i];
    drawProofRow(proofCtx, null, row.role, row.action, row.before, row.after, i);
  }

  return { modified, proof: proof.toDataURL('image/png') };
}, {
  actions: ACTIONS,
  dirs: DIRS,
  frameW: FRAME_W,
  frameH: FRAME_H,
  frames: FRAMES,
  roleConfig: ROLE_CONFIG,
  sheets,
  targets,
});

await browser.close();

for (const [role, dataUrl] of Object.entries(result.modified)) {
  const path = join(ACTOR_DIR, `${role}.png`);
  await writeFile(path, bufferFromDataUrl(dataUrl));
  await writeFile(join(OUT_DIR, `${role}-cohesive.png`), bufferFromDataUrl(dataUrl));
}
await writeFile(join(OUT_DIR, 'cohesive-legacy-proof.png'), bufferFromDataUrl(result.proof));

console.log(`[cohesive-legacy] repainted ${targets.length} role/action blocks across ${targetRoles.length} role sheets`);
for (const target of targets) console.log(`[cohesive-legacy] ${target.role}/${target.action}`);
console.log(`[cohesive-legacy] wrote ${join(OUT_DIR, 'cohesive-legacy-proof.png')}`);
