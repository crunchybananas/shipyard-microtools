// Build animated raster atlases for citizens and ambient traffic.
// The actor atlas is role + action + direction aware:
//   row = role * actions * dirs + action * dirs + dir

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const OUT_ACTORS = join(ROOT, 'assets', 'sprites', 'actors-atlas.png');
const OUT_AMBIENT = join(ROOT, 'assets', 'sprites', 'ambient-atlas.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 768, height: 768 }, deviceScaleFactor: 1 });

try {
  const { actors, ambient } = await page.evaluate(() => {
    const actorBaseW = 32;
    const actorBaseH = 42;
    const actorScale = 2;
    const actorW = actorBaseW * actorScale;
    const actorH = actorBaseH * actorScale;
    const frames = 4;
    const dirs = ['down', 'up', 'left', 'right'];
    const actions = ['idle', 'walk', 'work', 'carry'];
    const roles = [
      { key: 'settler', tunic: '#3f668d', trim: '#c7a95e', hair: '#4a2c19', tool: null },
      { key: 'farmer', tunic: '#4f7b38', trim: '#c9b15d', hair: '#8a582a', tool: 'hoe', hat: 'straw' },
      { key: 'rancher', tunic: '#657a37', trim: '#d0b263', hair: '#704827', tool: 'pail', hat: 'kerchief' },
      { key: 'lumber', tunic: '#8f562b', trim: '#c9a166', hair: '#3e2618', tool: 'axe', hat: 'cap' },
      { key: 'miner', tunic: '#536f7e', trim: '#aeb8be', hair: '#2b241f', tool: 'pick', hat: 'helmet' },
      { key: 'stonecutter', tunic: '#656b6f', trim: '#b6bdc2', hair: '#342a24', tool: 'chisel', hat: 'cloth' },
      { key: 'fisher', tunic: '#367b88', trim: '#bed0c5', hair: '#624528', tool: 'rod', hat: 'brim' },
      { key: 'trader', tunic: '#a9772b', trim: '#d6bb69', hair: '#5a321e', tool: 'ledger', satchel: true },
      { key: 'innkeeper', tunic: '#914533', trim: '#d2a35c', hair: '#4a2c1b', tool: 'mug', apron: '#d4bd91' },
      { key: 'builder', tunic: '#8b6738', trim: '#d1b676', hair: '#35271c', tool: 'hammer', hat: 'cap' },
      { key: 'blacksmith', tunic: '#3f4851', trim: '#c27a22', hair: '#221d19', tool: 'tongs', apron: '#20262b' },
      { key: 'guard', tunic: '#344f80', trim: '#b7bec8', hair: '#29231e', tool: 'spear', shield: true },
      { key: 'scholar', tunic: '#65528b', trim: '#c8b6df', hair: '#3e281c', tool: 'book' },
      { key: 'forager', tunic: '#5c7d3f', trim: '#b9ad5e', hair: '#553a23', tool: 'bundle', hat: 'leaf' },
    ];

    const actorCanvas = document.createElement('canvas');
    actorCanvas.width = actorW * frames;
    actorCanvas.height = actorH * dirs.length * actions.length * roles.length;
    const a = actorCanvas.getContext('2d');
    a.clearRect(0, 0, actorCanvas.width, actorCanvas.height);
    a.imageSmoothingEnabled = true;
    a.imageSmoothingQuality = 'high';

    function ellipse(ctx, x, y, rx, ry, fill, alpha = 1, rot = 0, stroke = null) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      ctx.restore();
    }

    function line(ctx, x1, y1, x2, y2, color, width = 1.2, alpha = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }

    function rounded(ctx, x, y, w, h, r, fill, alpha = 1) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }

    function actorHash(x, y) {
      let h = (Math.floor(x) * 374761393) ^ (Math.floor(y) * 668265263);
      h = (h ^ (h >>> 13)) * 1274126177;
      return (h ^ (h >>> 16)) >>> 0;
    }

    function shadeHex(hex, amt) {
      const raw = hex.replace('#', '');
      const r = parseInt(raw.slice(0, 2), 16);
      const g = parseInt(raw.slice(2, 4), 16);
      const b = parseInt(raw.slice(4, 6), 16);
      const mix = amt < 0 ? 0 : 255;
      const t = Math.abs(amt);
      const rr = Math.round(r + (mix - r) * t);
      const gg = Math.round(g + (mix - g) * t);
      const bb = Math.round(b + (mix - b) * t);
      return `rgb(${rr},${gg},${bb})`;
    }

    function bodyPath(ctx, x, y) {
      ctx.beginPath();
      ctx.moveTo(x - 5.8, y - 7.0);
      ctx.quadraticCurveTo(x, y - 10.4, x + 5.8, y - 7.0);
      ctx.lineTo(x + 5.0, y + 5.8);
      ctx.quadraticCurveTo(x + 3.8, y + 8.8, x, y + 8.5);
      ctx.quadraticCurveTo(x - 3.8, y + 8.8, x - 5.0, y + 5.8);
      ctx.closePath();
    }

    function drawTool(ctx, role, action, dir, frame, cx, torsoY, handX, handY, sx) {
      const work = action === 'work';
      const walk = action === 'walk' || action === 'carry';
      const t = frame / frames * Math.PI * 2;
      const swing = Math.sin(t);
      const front = dir === 'down';
      const away = dir === 'up';
      const side = dir === 'left' ? -1 : dir === 'right' ? 1 : sx;
      ctx.save();
      ctx.translate(handX, handY);

      if (role.tool === 'hoe') {
        ctx.rotate(work ? -0.65 + swing * 0.55 : walk ? -0.25 : 0.1);
        line(ctx, 0, -7, 0, 7, '#7b512c', 1.35);
        line(ctx, -4, 7, 3, 7, '#c8d2c8', 1.2);
      } else if (role.tool === 'axe') {
        ctx.rotate(work ? -0.8 + swing * 0.9 : 0.2);
        line(ctx, 0, -7, 0, 7, '#7b512c', 1.45);
        ctx.fillStyle = '#c8d3dd';
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, -9);
        ctx.lineTo(4, -4);
        ctx.lineTo(0, -3);
        ctx.closePath();
        ctx.fill();
      } else if (role.tool === 'pick') {
        ctx.rotate(work ? -0.55 + swing * 0.75 : -0.1);
        line(ctx, 0, -7, 0, 7, '#76502f', 1.35);
        line(ctx, -6, -7, 6, -7, '#cbd3db', 1.35);
      } else if (role.tool === 'rod') {
        ctx.rotate(work ? -0.35 + swing * 0.22 : -0.15);
        line(ctx, 0, 8, 3, -13, '#6f4528', 1.05);
        line(ctx, 3, -13, 8, -2, 'rgba(220,230,230,0.75)', 0.45);
        if (work && front) ellipse(ctx, 8, -1 + Math.sin(t * 2), 1.2, 1.2, '#d7e3e6', 0.9);
      } else if (role.tool === 'ledger') {
        rounded(ctx, -3.5, -2, 7, 6, 1.5, '#7a4d2a', 0.95);
        line(ctx, -2, 0, 2, 0, '#e9d09a', 0.8, 0.8);
        if (work && !away) line(ctx, -6, -5, -2, -2, '#e4b886', 1.2, 0.9);
      } else if (role.tool === 'hammer') {
        ctx.rotate(work ? 0.7 - swing * 0.9 : 0.2);
        line(ctx, 0, -1, 0, 7, '#7a4d2a', 1.25);
        rounded(ctx, -4, -4, 8, 3, 1, '#8f969c', 0.95);
        if (action === 'carry') rounded(ctx, -9 * side, 0, 12, 4, 1, '#a66d32', 0.9);
      } else if (role.tool === 'spear') {
        ctx.rotate(walk ? -0.18 * side : 0);
        line(ctx, 0, 9, 0, -13, '#6b482e', 1.1);
        ctx.fillStyle = '#cdd5dd';
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(3, -11);
        ctx.lineTo(-3, -11);
        ctx.closePath();
        ctx.fill();
      } else if (role.tool === 'bundle') {
        ellipse(ctx, 0, 1, 4.2, 3.0, '#7d5732', 0.95);
        ellipse(ctx, 1.5, -1, 3.0, 2.0, '#6b9b43', 0.85);
      } else if (role.tool === 'pail') {
        ctx.rotate(work ? swing * 0.12 : walk ? swing * 0.08 : 0);
        rounded(ctx, -3.5, -1, 7, 7, 2, '#8b97a3', 0.95);
        line(ctx, -3, -1, 3, -1, '#d6dde3', 0.8, 0.85);
        if (work) ellipse(ctx, 1, 8, 3.2, 0.9, '#d9c28a', 0.35);
      } else if (role.tool === 'chisel') {
        ctx.rotate(work ? -0.2 + swing * 0.35 : -0.55);
        line(ctx, -4, 4, 5, -5, '#bec8d0', 1.35);
        line(ctx, -7, -4, -2, -8, '#7a4d2a', 1.35);
        if (work) ellipse(ctx, 7, -7, 1.4, 1.4, '#d7dde2', 0.75);
      } else if (role.tool === 'mug') {
        rounded(ctx, -3.5, -2, 7, 6, 1.5, '#d6a24f', 0.95);
        line(ctx, 3, 0, 6, 1, '#f3d17b', 1.1, 0.9);
        if (work) line(ctx, -6, -5, -1, -2, '#f3d17b', 1.2, 0.85);
      } else if (role.tool === 'tongs') {
        ctx.rotate(work ? -0.35 + swing * 0.5 : -0.15);
        line(ctx, -2, 7, 2, -6, '#8f969c', 1.0);
        line(ctx, 2, 7, -2, -6, '#8f969c', 1.0);
        if (work) ellipse(ctx, -3, -8, 2.4, 1.5, '#f97316', 0.9);
      } else if (role.tool === 'book') {
        ctx.rotate(work ? swing * 0.08 : 0);
        rounded(ctx, -5, -3, 10, 7, 1.5, '#8b5cf6', 0.95);
        line(ctx, 0, -3, 0, 4, '#f4e7c8', 0.75, 0.9);
      } else if (action === 'carry') {
        ellipse(ctx, 0, 0, 3.2, 3.8, '#a8743f', 0.95);
      }
      ctx.restore();
    }

    function drawPayload(ctx, action, cx, torsoY, side) {
      if (action !== 'carry') return;
      rounded(ctx, cx - 9 * side - 3, torsoY - 1, 8, 7, 2, '#a46b35', 0.96);
      line(ctx, cx - 9 * side - 1, torsoY + 1, cx - 4 * side, torsoY - 5, '#6b4125', 1.0, 0.85);
      ellipse(ctx, cx - 9 * side + 1, torsoY - 4, 3.5, 1.4, '#e2bb72', 0.55);
    }

    function drawActor(ctx, ox, oy, role, dir, action, frame) {
      const t = frame / frames * Math.PI * 2;
      const moving = action === 'walk' || action === 'carry';
      const working = action === 'work';
      const profile = dir === 'left' || dir === 'right';
      const away = dir === 'up';
      const sx = dir === 'left' ? -1 : 1;
      const side = profile ? sx : 1;
      const cx = ox + 16;
      const footY = oy + 35;
      const torsoY = oy + 25;
      const skin = '#d6a06f';
      const skinHi = '#e2b887';
      const skinShade = '#8d5d43';
      const pants = role.key === 'guard' ? '#1d2637' : '#2d2630';
      const stride = moving ? Math.cos(t) * 2.2 : 0;
      const workLean = working ? Math.sin(t) * 1.0 : 0;
      const headBob = moving ? Math.sin(t * 2) * 0.45 : working ? Math.abs(Math.sin(t)) * 0.55 : Math.sin(t) * 0.12;
      const headY = oy + 13 + headBob;
      const legSep = profile ? 1.7 : 2.7;

      const liftA = moving ? Math.max(0, Math.cos(t)) * 1.8 : 0;
      const liftB = moving ? Math.max(0, -Math.cos(t)) * 1.8 : 0;
      const legAx = cx - legSep + (profile ? stride * sx : stride * 0.38);
      const legBx = cx + legSep - (profile ? stride * sx : stride * 0.38);
      line(ctx, legAx, torsoY + 5, legAx, footY - liftA, '#17100d', 3.4, 0.62);
      line(ctx, legBx, torsoY + 5, legBx, footY - liftB, '#17100d', 3.4, 0.62);
      line(ctx, legAx, torsoY + 5, legAx, footY - liftA, pants, 2.25);
      line(ctx, legBx, torsoY + 5, legBx, footY - liftB, pants, 2.25);
      ellipse(ctx, legAx + (profile ? sx * 1.0 : 0), footY + 0.6 - liftA, 3.2, 1.65, '#120d0b', 0.8);
      ellipse(ctx, legBx + (profile ? -sx * 1.0 : 0), footY + 0.6 - liftB, 3.2, 1.65, '#120d0b', 0.8);
      ellipse(ctx, legAx + (profile ? sx * 1.0 : 0), footY + 0.2 - liftA, 2.55, 1.25, '#2a1b14');
      ellipse(ctx, legBx + (profile ? -sx * 1.0 : 0), footY + 0.2 - liftB, 2.55, 1.25, '#2a1b14');

      const bodyX = cx + (profile ? sx * workLean * 0.45 : workLean * 0.25);
      ctx.fillStyle = 'rgba(25,17,12,0.68)';
      bodyPath(ctx, bodyX, torsoY + 0.5);
      ctx.fill();
      const grad = ctx.createLinearGradient(bodyX - 6, torsoY - 9, bodyX + 6, torsoY + 8);
      grad.addColorStop(0, shadeHex(role.tunic, 0.24));
      grad.addColorStop(0.38, role.tunic);
      grad.addColorStop(1, shadeHex(role.tunic, -0.48));
      ctx.fillStyle = grad;
      bodyPath(ctx, bodyX, torsoY);
      ctx.fill();
      ctx.save();
      ctx.fillStyle = 'rgba(255,244,210,0.16)';
      bodyPath(ctx, bodyX - 1.8, torsoY - 1.2);
      ctx.clip();
      ellipse(ctx, bodyX - 3.3, torsoY - 4.8, 2.0, 6.8, '#fff6d5', 0.13, -0.18);
      ctx.restore();
      line(ctx, bodyX - 3.7, torsoY - 3, bodyX + 3.7, torsoY - 2, role.trim, 0.9, 0.62);

      if (role.apron) {
        ctx.save();
        ctx.fillStyle = role.apron;
        ctx.globalAlpha *= 0.9;
        ctx.beginPath();
        ctx.moveTo(bodyX - 3.4, torsoY - 4);
        ctx.lineTo(bodyX + 3.4, torsoY - 4);
        ctx.lineTo(bodyX + 3.0, torsoY + 6.5);
        ctx.lineTo(bodyX - 3.0, torsoY + 6.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        line(ctx, bodyX - 4.2, torsoY - 1, bodyX + 4.2, torsoY - 1, role.trim, 0.85, 0.75);
      }
      if (role.satchel) {
        rounded(ctx, bodyX - 8.1, torsoY + 1.2, 5.4, 6.4, 1.4, '#6f4224', 0.95);
        line(ctx, bodyX - 4.6, torsoY - 6, bodyX + 4.6, torsoY + 6, '#ffe1a0', 0.9, 0.7);
      }
      if (role.key === 'guard') {
        rounded(ctx, bodyX - 4.6, torsoY - 7, 9.2, 12, 2, 'rgba(180,188,196,0.28)', 0.8);
      }

      const armSwing = moving ? Math.sin(t) * 2.2 : working ? Math.sin(t) * 3.0 : 0;
      const leftHandX = bodyX - 7.3;
      const rightHandX = bodyX + 7.3;
      const leftHandY = torsoY + 4 + armSwing;
      const rightHandY = torsoY + 4 - armSwing;
      line(ctx, bodyX - 5.3, torsoY - 3, leftHandX, leftHandY, '#17100d', 3.2, 0.45);
      line(ctx, bodyX + 5.3, torsoY - 3, rightHandX, rightHandY, '#17100d', 3.2, 0.45);
      line(ctx, bodyX - 5.3, torsoY - 3, leftHandX, leftHandY, shadeHex(role.tunic, -0.10), 2.25);
      line(ctx, bodyX + 5.3, torsoY - 3, rightHandX, rightHandY, shadeHex(role.tunic, -0.10), 2.25);
      ellipse(ctx, leftHandX, leftHandY, 1.45, 1.2, '#3b2418', 0.38);
      ellipse(ctx, rightHandX, rightHandY, 1.45, 1.2, '#3b2418', 0.38);
      ellipse(ctx, leftHandX - 0.2, leftHandY - 0.2, 1.25, 1.05, skin);
      ellipse(ctx, rightHandX - 0.2, rightHandY - 0.2, 1.25, 1.05, skin);

      if (role.shield && !away) {
        const shieldX = profile ? bodyX - sx * 7.4 : bodyX - 7.4;
        ctx.fillStyle = '#2c477e';
        ctx.beginPath();
        ctx.moveTo(shieldX, torsoY - 5.5);
        ctx.quadraticCurveTo(shieldX + 4.3, torsoY - 4.2, shieldX + 3.2, torsoY + 2.4);
        ctx.quadraticCurveTo(shieldX, torsoY + 6.0, shieldX - 3.2, torsoY + 2.4);
        ctx.quadraticCurveTo(shieldX - 4.3, torsoY - 4.2, shieldX, torsoY - 5.5);
        ctx.fill();
        line(ctx, shieldX - 2.2, torsoY - 1, shieldX + 2.2, torsoY - 1, '#d8dce4', 0.9, 0.8);
      }

      const toolHandX = profile && sx < 0 ? leftHandX : rightHandX;
      const toolHandY = profile && sx < 0 ? leftHandY : rightHandY;
      drawPayload(ctx, action, bodyX, torsoY, -side);
      drawTool(ctx, role, action, dir, frame, bodyX, torsoY, toolHandX, toolHandY, side);

      ellipse(ctx, cx, headY + 0.35, 5.45, 5.75, '#2a1b14', 0.54);
      const faceGrad = ctx.createRadialGradient(cx - 2.1, headY - 2.3, 0.6, cx + 1.5, headY + 1.5, 6.45);
      faceGrad.addColorStop(0, skinHi);
      faceGrad.addColorStop(0.55, skin);
      faceGrad.addColorStop(1, skinShade);
      ellipse(ctx, cx - 0.2, headY, 5.2, 5.45, faceGrad);
      ellipse(ctx, cx + 1.7, headY + 0.9, 3.0, 3.4, skinShade, 0.14);

      if (role.key === 'guard') {
        ctx.fillStyle = '#bac4cd';
        ctx.beginPath();
        ctx.ellipse(cx, headY - 2.8, 5.5, 4.3, 0, Math.PI * 0.82, Math.PI * 2.18);
        ctx.closePath();
        ctx.fill();
        line(ctx, cx - 4.0, headY - 1.9, cx + 4.0, headY - 1.9, '#d8b95f', 0.9, 0.85);
      } else if (role.hat === 'helmet') {
        ctx.fillStyle = '#aeb8c2';
        ctx.beginPath();
        ctx.ellipse(cx, headY - 2.9, 5.7, 4.1, 0, Math.PI * 0.86, Math.PI * 2.14);
        ctx.closePath();
        ctx.fill();
        ellipse(ctx, cx + (profile ? sx * 0.8 : 0), headY - 4.9, 1.25, 1.0, '#d6b957', 0.95);
      } else if (role.hat === 'straw') {
        ellipse(ctx, cx, headY - 3.9, 6.8, 1.3, '#cdb052', 0.95);
        rounded(ctx, cx - 3.6, headY - 7.4, 7.2, 3.8, 1.2, '#b98e36', 0.95);
        line(ctx, cx - 3.0, headY - 5.4, cx + 3.0, headY - 5.4, '#7b5d2d', 0.75, 0.7);
      } else if (role.hat === 'brim') {
        ellipse(ctx, cx, headY - 3.8, 6.4, 1.25, '#607c6a', 0.95);
        rounded(ctx, cx - 3.4, headY - 7.2, 6.8, 3.4, 1.1, '#496654', 0.95);
      } else if (role.hat === 'cap') {
        ctx.fillStyle = role.trim;
        ctx.beginPath();
        ctx.ellipse(cx, headY - 4.0, 5.2, 2.7, 0, Math.PI * 0.88, Math.PI * 2.12);
        ctx.closePath();
        ctx.fill();
        line(ctx, cx + (profile ? sx * 2.1 : 2.7), headY - 3.7, cx + (profile ? sx * 5.4 : 5.4), headY - 3.3, role.trim, 1.3, 0.95);
      } else if (role.hat === 'kerchief') {
        ctx.fillStyle = '#b64634';
        ctx.beginPath();
        ctx.ellipse(cx, headY - 3.9, 5.3, 2.8, 0, Math.PI * 0.82, Math.PI * 2.18);
        ctx.closePath();
        ctx.fill();
        line(ctx, cx + 4.0, headY - 2.9, cx + 6.2, headY - 1.1, '#b64634', 0.95, 0.85);
      } else if (role.hat === 'cloth') {
        ctx.fillStyle = '#bfb7aa';
        ctx.beginPath();
        ctx.ellipse(cx, headY - 4.0, 5.3, 2.7, 0, Math.PI * 0.84, Math.PI * 2.16);
        ctx.closePath();
        ctx.fill();
      } else if (role.hat === 'leaf') {
        ellipse(ctx, cx - 1.4, headY - 5.1, 3.4, 1.35, '#536f34', 0.95, -0.5);
        ellipse(ctx, cx + 1.9, headY - 5.1, 2.9, 1.2, '#6d8e43', 0.9, 0.45);
      } else {
        ctx.fillStyle = role.hair;
        ctx.beginPath();
        if (away) {
          ctx.ellipse(cx, headY - 1.9, 5.4, 4.5, 0, Math.PI * 0.92, Math.PI * 2.08);
        } else if (profile) {
          ctx.ellipse(cx - sx * 1.1, headY - 2.6, 5.2, 4.1, 0, Math.PI * 0.78, Math.PI * 2.12);
        } else {
          ctx.ellipse(cx, headY - 2.5, 5.5, 4.1, 0, Math.PI * 0.82, Math.PI * 2.18);
        }
        ctx.closePath();
        ctx.fill();
        ellipse(ctx, cx - 2.0, headY - 5.0, 1.8, 1.15, '#ffffff', 0.08);
      }

      if (!away) {
        if (profile) {
          ellipse(ctx, cx + sx * 1.55, headY + 0.2, 0.95, 0.95, '#211512');
          line(ctx, cx + sx * 0.8, headY + 2.8, cx + sx * 2.1, headY + 3.0, '#6f432c', 0.7);
        } else {
          ellipse(ctx, cx - 1.8, headY + 0.25, 0.9, 0.95, '#211512');
          ellipse(ctx, cx + 1.8, headY + 0.25, 0.9, 0.95, '#211512');
          if (working) line(ctx, cx - 1.3, headY + 2.7, cx + 1.3, headY + 2.7, '#6f432c', 0.7);
          else line(ctx, cx - 1.1, headY + 2.55, cx + 1.1, headY + 2.9, '#6f432c', 0.7);
        }
      }

      if (role.key === 'farmer' && working && dir === 'down') {
        ellipse(ctx, cx + Math.sin(t) * 2, oy + 37.5, 4.5, 1.2, '#59462c', 0.36);
      }
      if (role.key === 'lumber' && working) {
        rounded(ctx, cx - 8, oy + 34, 14, 3, 1, '#7b4b25', 0.7);
      }
      if (role.key === 'miner' && working) {
        ellipse(ctx, cx + 7, oy + 34, 3.5, 2.4, '#81868a', 0.75);
      }
    }

    for (let ri = 0; ri < roles.length; ri++) {
      for (let ai = 0; ai < actions.length; ai++) {
        for (let di = 0; di < dirs.length; di++) {
          for (let f = 0; f < frames; f++) {
            const row = (ri * actions.length + ai) * dirs.length + di;
            a.save();
            a.translate(f * actorW, row * actorH);
            a.scale(actorScale, actorScale);
            drawActor(a, 0, 0, roles[ri], dirs[di], actions[ai], f);
            a.restore();
          }
        }
      }
    }

    function applyPaintGrain(ctx, canvas, cellW, cellH) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = image.data;
      const src = new Uint8ClampedArray(data);
      const w = canvas.width;
      const h = canvas.height;
      for (let y = 1; y < h - 1; y++) {
        const localY = (y % cellH) / cellH;
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          const alpha = src[i + 3];
          if (alpha < 8) continue;

          const n =
            (src[i - 4 + 3] < 24 ? 1 : 0) +
            (src[i + 4 + 3] < 24 ? 1 : 0) +
            (src[i - w * 4 + 3] < 24 ? 1 : 0) +
            (src[i + w * 4 + 3] < 24 ? 1 : 0);
          const edgeShade = n > 0 ? 0.16 : 0;
          const lowerShade = Math.max(0, localY - 0.54) * 0.10;
          const grain = ((actorHash(x, y) & 255) - 128) / 128;
          const fleck = ((actorHash(x + 19, y + 37) & 1023) === 0) ? 12 : 0;
          const shade = 1 - edgeShade - lowerShade;
          data[i] = Math.max(0, Math.min(255, data[i] * shade + grain * 5 + fleck));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * shade + grain * 4 + fleck));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * shade + grain * 3 + fleck * 0.6));
        }
      }
      ctx.putImageData(image, 0, 0);
    }

    applyPaintGrain(a, actorCanvas, actorW, actorH);

    const ambientCanvas = document.createElement('canvas');
    ambientCanvas.width = 48 * 4;
    ambientCanvas.height = 48;
    const m = ambientCanvas.getContext('2d');
    m.clearRect(0, 0, ambientCanvas.width, ambientCanvas.height);
    m.imageSmoothingEnabled = true;
    m.imageSmoothingQuality = 'high';

    function drawCart(ctx, x, y) {
      ellipse(ctx, x + 24, y + 38, 17, 4.5, '#000', 0.23);
      ellipse(ctx, x + 10, y + 32, 6.2, 4.2, '#8b5a2b');
      ellipse(ctx, x + 7, y + 27, 4.2, 3.2, '#9a6a38');
      line(ctx, x + 13, y + 31, x + 19, y + 31, '#6b3e20', 2.2);
      rounded(ctx, x + 18, y + 23, 21, 12, 3, '#9c6a2f');
      ctx.fillStyle = '#c08b43';
      ctx.fillRect(x + 20, y + 21, 17, 5);
      line(ctx, x + 20, y + 24, x + 36, y + 24, '#e0b260', 1.2, 0.7);
      for (const wx of [22, 35]) {
        ellipse(ctx, x + wx, y + 35, 4.4, 4.4, '#332016');
        ellipse(ctx, x + wx, y + 35, 2.4, 2.4, '#b98a4c');
        line(ctx, x + wx - 3, y + 35, x + wx + 3, y + 35, '#2b1911', 0.8);
      }
    }

    function drawFishboat(ctx, x, y) {
      ellipse(ctx, x + 24, y + 36, 17, 4, '#000', 0.18);
      ctx.fillStyle = '#7b4a25';
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 28);
      ctx.quadraticCurveTo(x + 24, y + 39, x + 42, y + 28);
      ctx.quadraticCurveTo(x + 35, y + 35, x + 14, y + 35);
      ctx.closePath();
      ctx.fill();
      line(ctx, x + 11, y + 29, x + 38, y + 29, '#d2a052', 1.6);
      line(ctx, x + 17, y + 22, x + 37, y + 33, '#d8c7a6', 1.4, 0.8);
      line(ctx, x + 34, y + 23, x + 14, y + 34, '#d8c7a6', 1.4, 0.8);
      ellipse(ctx, x + 23, y + 25, 3.8, 3.2, '#d6ae74');
    }

    function drawSailboat(ctx, x, y) {
      ellipse(ctx, x + 25, y + 38, 18, 4, '#000', 0.17);
      line(ctx, x + 24, y + 12, x + 24, y + 33, '#5f3a22', 1.5);
      ctx.fillStyle = '#f5ead1';
      ctx.beginPath();
      ctx.moveTo(x + 25, y + 13);
      ctx.lineTo(x + 40, y + 31);
      ctx.lineTo(x + 25, y + 31);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e9d39c';
      ctx.beginPath();
      ctx.moveTo(x + 23, y + 16);
      ctx.lineTo(x + 12, y + 32);
      ctx.lineTo(x + 23, y + 32);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8d552b';
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 31);
      ctx.quadraticCurveTo(x + 24, y + 39, x + 42, y + 31);
      ctx.lineTo(x + 36, y + 36);
      ctx.lineTo(x + 14, y + 36);
      ctx.closePath();
      ctx.fill();
      line(ctx, x + 11, y + 31, x + 39, y + 31, '#d4a353', 1.4);
    }

    function drawPack(ctx, x, y) {
      ellipse(ctx, x + 24, y + 38, 10, 3, '#000', 0.18);
      rounded(ctx, x + 15, y + 16, 18, 22, 4, '#b7894c');
      ctx.fillStyle = '#e0bd78';
      ctx.fillRect(x + 17, y + 18, 14, 6);
      line(ctx, x + 17, y + 27, x + 31, y + 27, '#6d4425', 1.2);
      line(ctx, x + 20, y + 15, x + 16, y + 8, '#7a4f2d', 1.3);
      line(ctx, x + 29, y + 15, x + 33, y + 8, '#7a4f2d', 1.3);
    }

    drawCart(m, 0, 0);
    drawFishboat(m, 48, 0);
    drawSailboat(m, 96, 0);
    drawPack(m, 144, 0);

    return {
      actors: actorCanvas.toDataURL('image/png'),
      ambient: ambientCanvas.toDataURL('image/png'),
    };
  });

  await writeFile(OUT_ACTORS, Buffer.from(actors.split(',')[1], 'base64'));
  await writeFile(OUT_AMBIENT, Buffer.from(ambient.split(',')[1], 'base64'));
  console.log(`[motion-atlases] wrote ${OUT_ACTORS}`);
  console.log(`[motion-atlases] wrote ${OUT_AMBIENT}`);
} finally {
  await browser.close();
}
