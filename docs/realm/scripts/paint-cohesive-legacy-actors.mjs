// Repaints legacy separated-limb actor rows with cohesive raster walk/work/carry
// rows. This is intentionally conservative: it leaves newer imagegen-heavy
// role sheets alone and targets the old CC0-port rows flagged by the sprite
// artifact audit.

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors');
const SHOTS = join(ROOT, 'scripts', 'screenshots');
const OUT_DIR = join(ROOT, 'tmp', 'realm-graphics-round-106');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];

const ROLE_CONFIG = {
  settler: { cloth: '#4f83a8', trim: '#263d54', skin: '#f0c58b', hair: '#223344', prop: 'satchel' },
  farmer: { cloth: '#5c9a43', trim: '#2d5429', skin: '#f0c58b', hair: '#59691d', prop: 'hoe' },
  rancher: { cloth: '#8f7938', trim: '#4e3c1e', skin: '#edc083', hair: '#7b6d2c', prop: 'pail' },
  miner: { cloth: '#5e7f93', trim: '#263f50', skin: '#eec284', hair: '#253946', prop: 'pick' },
  stonecutter: { cloth: '#7a7b78', trim: '#3d4347', skin: '#efc486', hair: '#4e565b', prop: 'chisel' },
  fisher: { cloth: '#4f7f90', trim: '#29464e', skin: '#efc486', hair: '#47585e', prop: 'rod' },
  trader: { cloth: '#9b7b41', trim: '#5b3c1e', skin: '#efc486', hair: '#5c4227', prop: 'pack' },
  innkeeper: { cloth: '#a45d3f', trim: '#63311f', skin: '#efc486', hair: '#8a4d34', prop: 'mug' },
  guard: { cloth: '#426ca0', trim: '#2d3545', skin: '#efc486', hair: '#293d5e', prop: 'shield', metal: '#b5bdc3' },
  scholar: { cloth: '#6c627d', trim: '#3d354b', skin: '#efc486', hair: '#55515c', prop: 'book' },
  forager: { cloth: '#70904a', trim: '#384c29', skin: '#efc486', hair: '#617342', prop: 'basket' },
};

const KEEP_SPECIAL = new Set([
  'blacksmith/walk', 'blacksmith/work', 'blacksmith/carry',
  'builder/walk', 'builder/work', 'builder/carry',
  'lumber/walk', 'lumber/work', 'lumber/carry',
  'miner/work',
  'guard/work', 'guard/carry',
]);

const LEGACY_COHORT = [
  'farmer/walk',
  'fisher/carry', 'fisher/walk', 'fisher/work',
  'forager/carry', 'forager/walk', 'forager/work',
  'guard/walk',
  'innkeeper/carry', 'innkeeper/walk', 'innkeeper/work',
  'miner/carry', 'miner/walk',
  'rancher/carry', 'rancher/walk', 'rancher/work',
  'scholar/carry', 'scholar/walk', 'scholar/work',
  'settler/carry', 'settler/walk', 'settler/work',
  'stonecutter/carry', 'stonecutter/walk', 'stonecutter/work',
  'trader/carry', 'trader/walk', 'trader/work',
];

function keyFor(row) {
  return `${row.role}/${row.action}`;
}

function chooseTargets(report) {
  const combos = new Set(LEGACY_COHORT);
  for (const row of report.reports) {
    if (row.action === 'idle') continue;
    if (!ROLE_CONFIG[row.role]) continue;
    if (KEEP_SPECIAL.has(keyFor(row))) continue;
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

  function gait(frame, scale = 1) {
    const p = footPhase(frame);
    const p2 = Math.cos((frame / frames) * Math.PI * 4);
    return {
      p,
      bob: -Math.abs(p2) * 1.2,
      leftStep: p * 5.2 * scale,
      rightStep: -p * 5.2 * scale,
      arm: -p * 4.2 * scale,
    };
  }

  function drawProp(ctx, cfg, action, dir, frame, cx, cy, side) {
    const prop = action === 'carry' ? 'bundle' : cfg.prop;
    const g = gait(frame);
    const handY = cy + 15 + Math.abs(g.p) * 1.5;
    const handX = cx + side * 11;
    ctx.lineCap = 'round';

    if (prop === 'bundle' || prop === 'pack' || prop === 'basket') {
      ctx.fillStyle = prop === 'basket' ? '#8b6731' : '#8d5e31';
      ctx.strokeStyle = '#51351e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(handX + side * 1.5, handY + 2, 7, 8, 0.12 * side, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (prop === 'book') {
      ctx.fillStyle = '#6e3d5f';
      ctx.strokeStyle = '#372336';
      ctx.lineWidth = 1.5;
      ctx.fillRect(handX - 4, handY - 3, 9, 7);
      ctx.strokeRect(handX - 4, handY - 3, 9, 7);
      return;
    }
    if (prop === 'mug' || prop === 'pail') {
      ctx.fillStyle = prop === 'mug' ? '#b08339' : '#8a6f43';
      ctx.strokeStyle = '#4c3920';
      ctx.lineWidth = 1.4;
      ctx.fillRect(handX - 4, handY - 3, 8, 8);
      ctx.strokeRect(handX - 4, handY - 3, 8, 8);
      return;
    }
    if (prop === 'shield') {
      ctx.fillStyle = cfg.metal || '#aeb4ba';
      ctx.strokeStyle = '#4c5660';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(handX - 5, handY - 9, 10, 16, 4);
      ctx.fill();
      ctx.stroke();
      return;
    }
    if (prop === 'hoe' || prop === 'rod' || prop === 'chisel' || prop === 'pick') {
      const len = prop === 'rod' ? 27 : 21;
      ctx.strokeStyle = prop === 'rod' ? '#4c3520' : '#5b3a22';
      ctx.lineWidth = prop === 'rod' ? 1.5 : 2.2;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(handX + side * len, handY - 9);
      ctx.stroke();
      if (prop === 'pick') capsule(ctx, handX + side * (len - 5), handY - 12, handX + side * (len + 6), handY - 7, 2.2, '#b7bcc0');
      if (prop === 'hoe') capsule(ctx, handX + side * (len - 1), handY - 12, handX + side * (len + 2), handY - 4, 2, '#a7aa9e');
    }
  }

  function drawFrontBack(ctx, cfg, action, dir, frame, ox, oy) {
    const up = dir === 'up';
    const g = gait(frame);
    const cx = ox + frameW / 2;
    const ground = oy + 76;
    const cy = oy + 35 + g.bob;
    const cloth = cfg.cloth;
    const dark = cfg.trim;
    const skin = cfg.skin;
    const hair = cfg.hair;
    const metal = cfg.metal || '#d1d4d2';
    const stepL = g.leftStep;
    const stepR = g.rightStep;
    const leftLead = Math.max(0, g.p);
    const rightLead = Math.max(0, -g.p);
    const leftFootX = cx - 8 - leftLead * 4 + rightLead * 1.5;
    const rightFootX = cx + 8 + rightLead * 4 - leftLead * 1.5;
    const leftLegW = 5.5 + leftLead * 4.2;
    const rightLegW = 5.5 + rightLead * 4.2;

    capsule(ctx, cx - 4, cy + 23, leftFootX, ground - 5 - leftLead * 1.2, leftLegW, shade(dark, 8));
    capsule(ctx, cx + 4, cy + 23, rightFootX, ground - 5 - rightLead * 1.2, rightLegW, shade(dark, -2));
    softEllipse(ctx, leftFootX, ground - 3, 4.2 + leftLead * 3.8, 1.8 + leftLead * 1.5, '#26292d');
    softEllipse(ctx, rightFootX, ground - 3, 4.2 + rightLead * 3.8, 1.8 + rightLead * 1.5, '#26292d');

    const bodyGrad = ctx.createLinearGradient(cx - 12, cy + 4, cx + 13, cy + 29);
    bodyGrad.addColorStop(0, shade(cloth, 26));
    bodyGrad.addColorStop(0.55, cloth);
    bodyGrad.addColorStop(1, shade(cloth, -35));
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = shade(dark, -18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 12, cy + 5, 24, 30, 8);
    ctx.fill();
    ctx.stroke();

    capsule(ctx, cx - 10, cy + 12, cx - 15 + g.arm * 0.35, cy + 27, 6, shade(cloth, -20));
    capsule(ctx, cx + 10, cy + 12, cx + 15 - g.arm * 0.35, cy + 27, 6, shade(cloth, -26));
    softEllipse(ctx, cx - 15 + g.arm * 0.35, cy + 28, 3.5, 3.3, skin);
    softEllipse(ctx, cx + 15 - g.arm * 0.35, cy + 28, 3.5, 3.3, skin);

    const headY = cy - 4;
    softEllipse(ctx, cx, headY, 11, 12, up ? shade(hair, 14) : hair);
    softEllipse(ctx, cx, headY + 2, 9.5, 10.3, up ? shade(hair, 8) : skin);
    ctx.fillStyle = shade(hair, 12);
    ctx.beginPath();
    ctx.ellipse(cx, headY - 5, 10, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    if (!up) {
      ctx.fillStyle = '#24313a';
      softEllipse(ctx, cx - 3.3, headY + 1, 1.2, 1.4, '#24313a');
      softEllipse(ctx, cx + 3.3, headY + 1, 1.2, 1.4, '#24313a');
      capsule(ctx, cx - 3, headY + 6, cx + 3, headY + 6, 1.2, '#7c4b3d');
    }
    if (cfg.metal) {
      ctx.strokeStyle = metal;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, headY, 11, Math.PI * 1.07, Math.PI * 1.93);
      ctx.stroke();
    }
    drawProp(ctx, cfg, action, dir, frame, cx, cy, frame % 2 ? -1 : 1);
  }

  function drawSide(ctx, cfg, action, dir, frame, ox, oy) {
    const flip = dir === 'right' ? -1 : 1;
    ctx.save();
    ctx.translate(ox + frameW / 2, oy);
    ctx.scale(flip, 1);
    ctx.translate(-frameW / 2, 0);

    const g = gait(frame, 0.9);
    const cx = frameW / 2;
    const ground = 76;
    const cy = 35 + g.bob;
    const cloth = cfg.cloth;
    const dark = cfg.trim;
    const skin = cfg.skin;
    const hair = cfg.hair;

    const stride = Math.abs(g.p);
    const pass = 1 - stride;
    const rearFootX = cx - 6 - g.p * 9;
    const frontFootX = cx + 8 + g.p * 11;
    const rearKneeX = cx - 2 - g.p * 3;
    const frontKneeX = cx + 5 + g.p * 4;
    capsule(ctx, cx - 1, cy + 23, rearKneeX, cy + 43, 7, shade(dark, 5));
    capsule(ctx, rearKneeX, cy + 43, rearFootX, ground - 5, 6.6, shade(dark, 0));
    capsule(ctx, cx + 4, cy + 23, frontKneeX, cy + 43, 7, shade(dark, -6));
    capsule(ctx, frontKneeX, cy + 43, frontFootX, ground - 5, 6.6, shade(dark, -10));
    softEllipse(ctx, rearFootX, ground - 3, 4.2 + stride * 2.2 + pass * 0.7, 2.0, '#2b2e31');
    softEllipse(ctx, frontFootX, ground - 3, 4.6 + stride * 2.4, 2.1, '#272a2e');

    const bodyGrad = ctx.createLinearGradient(cx - 11, cy + 5, cx + 11, cy + 32);
    bodyGrad.addColorStop(0, shade(cloth, 24));
    bodyGrad.addColorStop(1, shade(cloth, -34));
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = shade(dark, -18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx - 10, cy + 5, 22, 30, 8);
    ctx.fill();
    ctx.stroke();

    capsule(ctx, cx + 8, cy + 13, cx + 17 - g.arm * 0.35, cy + 27, 6, shade(cloth, -22));
    capsule(ctx, cx - 7, cy + 13, cx - 12 + g.arm * 0.2, cy + 25, 5, shade(cloth, -30));
    softEllipse(ctx, cx + 18 - g.arm * 0.35, cy + 28, 3.5, 3.3, skin);

    const headY = cy - 4;
    softEllipse(ctx, cx, headY, 10.4, 12, hair);
    softEllipse(ctx, cx + 3, headY + 1.8, 8.5, 10, skin);
    ctx.fillStyle = shade(hair, 12);
    ctx.beginPath();
    ctx.ellipse(cx - 1, headY - 5, 10, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    softEllipse(ctx, cx + 6, headY + 1, 1.2, 1.4, '#24313a');
    capsule(ctx, cx + 5, headY + 6, cx + 9, headY + 6, 1.1, '#7c4b3d');

    if (cfg.metal) {
      ctx.strokeStyle = cfg.metal;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, headY, 10.6, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();
    }
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
