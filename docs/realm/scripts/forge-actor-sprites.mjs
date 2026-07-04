// Sprite Forge — procedural painted actor atlas (fresh-start, owner-authorized).
//
// One parametric rig renders the ENTIRE cast: 14 roles x 4 actions x 4 dirs
// x 8 frames of 64x84, drop-in compatible with the existing compiled-atlas
// contract. Consistency is by construction: every row shares the same
// skeleton, feet land on baseline 79, left is a true mirror of right, and
// animation reads coherently because it comes from curves, not per-frame
// generation. Rendered at 2x and downsampled for a soft painted finish.
//
// Usage:
//   node scripts/forge-actor-sprites.mjs --strip farmer     # /tmp preview strip
//   node scripts/forge-actor-sprites.mjs --write            # all roles → actors-forged/
//   node scripts/forge-actor-sprites.mjs --write --deploy   # → actors-compiled/ (live)

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_FORGED = join(ROOT, 'assets', 'sprites', 'actors-forged');
const OUT_LIVE = join(ROOT, 'assets', 'sprites', 'actors-compiled');

const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];

// ── Cast sheet: palettes are 3-stop ramps [shadow, base, light] ─────────
// Identity follows the established roster (farmer green+straw, guard
// steel+red plume, …) with art-directed ramps instead of sampled mud.
const CAST = {
  settler:     { top: ['#3d5a66', '#557a88', '#7ba3b0'], pants: ['#4a3628', '#63493a', '#7d5f4c'], hat: null,        hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'none',   skin: 0 },
  farmer:      { top: ['#2e5a30', '#3f7a42', '#5c9c5e'], pants: ['#4f3a25', '#6b5138', '#87694b'], hat: 'straw',     hair: ['#3a2a1a', '#54402a', '#6d5538'], tool: 'hoe',    skin: 0 },
  rancher:     { top: ['#5f4526', '#7d5d36', '#9c7848'], pants: ['#3e3226', '#574636', '#6f5a46'], hat: 'straw',     hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'gather', skin: 1 },
  lumber:      { build: 1.08, top: ['#6e3d20', '#8f552e', '#b06f3e'], pants: ['#33291f', '#4a3c2d', '#5f4e3a'], hat: null,        hair: ['#1f1710', '#33261a', '#443322'], tool: 'axe',    skin: 1 },
  miner:       { top: ['#5d5348', '#7a6e5f', '#968878'], pants: ['#3a3128', '#524537', '#685846'], hat: 'cap',       hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'pick',   skin: 0 },
  stonecutter: { top: ['#565656', '#727272', '#909090'], pants: ['#3c3c44', '#54545e', '#6c6c78'], hat: null,        hair: ['#4a4a4a', '#666666', '#828282'], tool: 'hammer', skin: 0 },
  fisher:      { top: ['#39586e', '#4e7690', '#6a95ae'], pants: ['#3a4148', '#525b64', '#6a7580'], hat: 'cap',       hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'rod',    skin: 1 },
  trader:      { top: ['#5e2f4f', '#7d4269', '#9c5984'], pants: ['#3e3226', '#574636', '#6f5a46'], hat: null,        hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'gather', skin: 0 },
  innkeeper:   { top: ['#6e2f26', '#8f4434', '#b05c46'], pants: ['#33291f', '#4a3c2d', '#5f4e3a'], hat: null,        hair: ['#3a2a1a', '#54402a', '#6d5538'], tool: 'tend',   skin: 0 },
  builder:     { top: ['#7a5a20', '#9c772e', '#bd943e'], pants: ['#4a3628', '#63493a', '#7d5f4c'], hat: 'cap',       hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'hammer', skin: 1 },
  blacksmith:  { build: 1.12, top: ['#42342c', '#5a483c', '#725c4c'], pants: ['#2e2622', '#423731', '#564840'], hat: null,        hair: ['#1f1710', '#33261a', '#443322'], tool: 'hammer', skin: 1, apron: ['#4f423a', '#68584d', '#816d5f'] },
  guard:       { build: 1.14, top: ['#5a5f6e', '#767c8f', '#959cb0'], pants: ['#3a3128', '#524537', '#685846'], hat: 'helm',      hair: ['#2e2018', '#4a3424', '#5f4630'], tool: 'spear',  skin: 0 },
  scholar:     { build: 0.92, top: ['#4a4a68', '#63638a', '#7f7fab'], pants: ['#3c3c50', '#54546e', '#6c6c8a'], hat: 'hood',      hair: ['#55555f', '#73737f', '#91919f'], tool: 'book',   skin: 0 },
  forager:     { top: ['#4f5f2c', '#6b7f3d', '#879e51'], pants: ['#4a3628', '#63493a', '#7d5f4c'], hat: 'straw',     hair: ['#3a2a1a', '#54402a', '#6d5538'], tool: 'gather', skin: 1 },
};
const SKINS = [
  ['#a5714f', '#c98f66', '#e3ab7f'],
  ['#7d5136', '#9c6a47', '#ba845b'],
];
const OUTLINE = '#241a10';

const args = process.argv.slice(2);
const stripRole = args.includes('--strip') ? (args[args.indexOf('--strip') + 1] || 'farmer') : null;
const doWrite = args.includes('--write');
const doDeploy = args.includes('--deploy');
const ROLES = stripRole ? [stripRole] : Object.keys(CAST);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

// The entire renderer runs in the page; Node only feeds params and saves PNGs.
const FORGE_SRC = `
(() => {
  const S = 3;                       // supersample factor
  const CW = 64 * S, CH = 84 * S;    // cell at 2x
  const GROUND = 79 * S;             // feet baseline by construction
  const OUTLINE = '${OUTLINE}';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ── Pose model ────────────────────────────────────────────────────────
  // A pose is a set of 2D anchor points (in cell space, x centered at CW/2)
  // plus lean/bob values. Curves below produce poses per (action, frame).
  function basePose() {
    return {
      bob: 0, lean: 0,               // px, radians (torso)
      hipX: 0,
      footL: { x: -7 * S, y: 0, lift: 0 }, // offsets around stance; y = forward (down-view) or stride (side)
      footR: { x: 7 * S, y: 0, lift: 0 },
      armL: { swing: 0, raise: 0 },  // radians: swing = fwd/back, raise = out/up
      armR: { swing: 0, raise: 0 },
      tool: null,                    // { angle (rad, 0 = down), reach }
      crouch: 0,                     // px torso drop
      carry: false,
    };
  }

  function walkPose(t, strideMult = 1, bobMult = 1) {
    const p = basePose();
    const ph = t * Math.PI * 2;
    const stride = 10 * S * strideMult;
    p.footL.y = Math.sin(ph) * stride;
    p.footR.y = Math.sin(ph + Math.PI) * stride;
    p.footL.lift = Math.max(0, Math.sin(ph + Math.PI / 2)) * 4.5 * S * strideMult;
    p.footR.lift = Math.max(0, Math.sin(ph + Math.PI * 1.5)) * 4.5 * S * strideMult;
    p.bob = -Math.abs(Math.cos(ph)) * 2.4 * S * bobMult + 1.2 * S * bobMult;
    p.armL.swing = Math.sin(ph + Math.PI) * 0.55 * strideMult;
    p.armR.swing = Math.sin(ph) * 0.55 * strideMult;
    p.lean = 0.04;
    return p;
  }

  function idlePose(t) {
    const p = basePose();
    const ph = t * Math.PI * 2;
    p.bob = Math.sin(ph) * 0.9 * S;
    p.hipX = Math.sin(ph) * 0.6 * S;
    p.armL.swing = Math.sin(ph) * 0.05;
    p.armR.swing = -Math.sin(ph) * 0.05;
    return p;
  }

  // SWING: anticipation → strike → recover. Tool angle: -2.2 (up-back) → 1.1 (ground)
  function swingPose(t) {
    const p = basePose();
    const f = t * 8;
    let a, lean, dip;
    if (f < 3)      { const k = f / 3;       a = lerp(-0.5, -2.2, k); lean = lerp(0.05, -0.12, k); dip = 0; }
    else if (f < 4) { const k = f - 3;       a = lerp(-2.2, 1.05, k); lean = lerp(-0.12, 0.22, k); dip = k * 2.5 * S; }
    else if (f < 5) { const k = f - 4;       a = lerp(1.05, 1.15, k); lean = 0.22;                 dip = 2.5 * S; }
    else            { const k = (f - 5) / 3; a = lerp(1.15, -0.5, k); lean = lerp(0.22, 0.05, k);  dip = (1 - k) * 2.5 * S; }
    p.tool = { angle: a, reach: 1 };
    p.lean = lean;
    p.bob = dip;
    p.footL.y = -3 * S; p.footR.y = 4 * S; // planted work stance
    p.armL.swing = lean * 2; p.armR.swing = lean * 2;
    return p;
  }

  function thrustPose(t) {
    const p = basePose();
    const f = t * 8;
    let reach, lean;
    if (f < 2)      { const k = f / 2;       reach = lerp(0, -0.3, k);  lean = -0.05 * k; }
    else if (f < 4) { const k = (f - 2) / 2; reach = lerp(-0.3, 1, k);  lean = lerp(-0.05, 0.18, k); }
    else if (f < 5) { reach = 1; lean = 0.18; }
    else            { const k = (f - 5) / 3; reach = lerp(1, 0, k);     lean = lerp(0.18, 0, k); }
    p.tool = { angle: Math.PI / 2, reach };  // horizontal spear
    p.lean = lean;
    p.footL.y = -4 * S; p.footR.y = 5 * S;
    return p;
  }

  function gatherPose(t) {
    const p = basePose();
    const ph = t * Math.PI * 2;
    const dip = Math.max(0, Math.sin(ph)) ;
    p.crouch = dip * 7 * S;
    p.lean = dip * 0.35;
    p.armR.swing = dip * 1.1;      // reach down
    p.armL.swing = dip * 0.2;
    p.bob = 0;
    p.footL.y = -4 * S; p.footR.y = 4 * S;
    return p;
  }

  function tendPose(t) {
    const p = basePose();
    const ph = t * Math.PI * 2;
    p.bob = Math.sin(ph) * 0.7 * S;
    p.armL.swing = 0.75; p.armL.raise = 0.35;   // holding item up front
    p.armR.swing = 0.55 + Math.sin(ph) * 0.22;  // fiddling hand
    p.armR.raise = 0.3;
    p.tool = { angle: 0, reach: 0, held: true };
    return p;
  }

  function carryPose(t) {
    const p = walkPose(t, 0.7, 0.8);
    p.lean = -0.06;
    p.armL.swing = 0.85; p.armR.swing = 0.85;   // both arms forward under the load
    p.armL.raise = 0.15; p.armR.raise = 0.15;
    p.carry = true;
    return p;
  }

  function poseFor(action, tool, t) {
    if (action === 'idle') return idlePose(t);
    if (action === 'walk') return walkPose(t);
    if (action === 'carry') return carryPose(t);
    // work by archetype
    if (tool === 'spear') return thrustPose(t);
    if (tool === 'gather' || tool === 'none') return gatherPose(t);
    if (tool === 'tend' || tool === 'book' || tool === 'rod') return tendPose(t);
    return swingPose(t); // hoe/axe/pick/hammer
  }

  // ── Painter ───────────────────────────────────────────────────────────
  function limb(ctx, x0, y0, x1, y1, w, ramp) {
    // rounded 2-tone limb: base stroke + light edge
    ctx.strokeStyle = ramp[1]; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = ramp[2]; ctx.lineWidth = Math.max(1.5, w * 0.42);
    ctx.beginPath(); ctx.moveTo(x0 - 1.2, y0 - 1.2); ctx.lineTo(x1 - 1.2, y1 - 1.2); ctx.stroke();
    ctx.strokeStyle = ramp[0]; ctx.lineWidth = Math.max(1.2, w * 0.3);
    ctx.beginPath(); ctx.moveTo(x0 + 1.4, y0 + 1.4); ctx.lineTo(x1 + 1.4, y1 + 1.4); ctx.stroke();
  }

  function roundedPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function vGrad(ctx, x, y0, y1, ramp) {
    const g = ctx.createLinearGradient(x, y0, x, y1);
    g.addColorStop(0, ramp[2]); g.addColorStop(0.45, ramp[1]); g.addColorStop(1, ramp[0]);
    return g;
  }

  function drawTool(ctx, kind, hx, hy, angle, dir, ramp) {
    // shaft from hands (hx,hy) along angle; head per kind
    const len = kind === 'spear' ? 34 * S : 24 * S;
    const ex = hx + Math.sin(angle) * len;
    const ey = hy + Math.cos(angle) * len;
    ctx.strokeStyle = '#6d4f2f'; ctx.lineWidth = 2.6 * S * 0.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = '#8a8f98';
    const hs = 3.2 * S;
    if (kind === 'hoe') {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-angle);
      ctx.fillRect(-hs, 0, hs * 2, hs * 0.8); ctx.restore();
    } else if (kind === 'axe') {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-angle);
      ctx.beginPath(); ctx.moveTo(0, -hs); ctx.lineTo(hs * 1.4, 0); ctx.lineTo(0, hs); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (kind === 'pick') {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-angle);
      ctx.beginPath(); ctx.moveTo(-hs * 1.6, 0); ctx.quadraticCurveTo(0, -hs * 1.4, hs * 1.6, 0);
      ctx.quadraticCurveTo(0, -hs * 0.4, -hs * 1.6, 0); ctx.fill(); ctx.restore();
    } else if (kind === 'hammer') {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-angle);
      ctx.fillRect(-hs, -hs * 0.7, hs * 2, hs * 1.4); ctx.restore();
    } else if (kind === 'spear') {
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-angle);
      ctx.beginPath(); ctx.moveTo(0, -hs * 1.3); ctx.lineTo(hs * 0.8, 0); ctx.lineTo(-hs * 0.8, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  function drawHat(ctx, kind, cx, cy, r, ramp, hair, dir) {
    if (kind === 'straw') {
      const straw = ['#9a7b34', '#c3a04a', '#e0c26a'];
      ctx.fillStyle = straw[1];
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.45, r * 1.75, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = vGrad(ctx, cx, cy - r * 1.5, cy, straw);
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.62, r * 0.95, r * 0.75, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = straw[0]; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.45, r * 1.75, r * 0.62, 0, 0, Math.PI); ctx.stroke();
      // hat band
      ctx.fillStyle = '#6d4a22';
      ctx.fillRect(cx - r * 0.92, cy - r * 0.72, r * 1.84, r * 0.26);
    } else if (kind === 'cap') {
      ctx.fillStyle = vGrad(ctx, cx, cy - r * 1.4, cy, ramp);
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.35, r * 0.98, Math.PI, 0); ctx.fill();
      if (dir !== 'up') { ctx.fillStyle = ramp[0]; ctx.fillRect(cx - r, cy - r * 0.4, r * 2, r * 0.24); }
    } else if (kind === 'helm') {
      const steel = ['#5c626e', '#8a92a2', '#b9c1d0'];
      ctx.fillStyle = vGrad(ctx, cx, cy - r * 1.5, cy + r * 0.4, steel);
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.2, r * 1.02, Math.PI * 0.95, Math.PI * 0.05); ctx.fill();
      ctx.fillRect(cx - r * 1.02, cy - r * 0.2, r * 2.04, r * 0.5);
      ctx.fillStyle = '#a33131';
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 1.25, r * 0.28, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'hood') {
      ctx.fillStyle = vGrad(ctx, cx, cy - r * 1.4, cy + r * 0.6, ramp);
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.15, r * 1.12, Math.PI * 0.9, Math.PI * 0.1); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.35, r * 1.12, r * 0.5, 0, Math.PI, 0, true); ctx.fill();
    } else {
      // hair
      ctx.fillStyle = vGrad(ctx, cx, cy - r * 1.3, cy, hair);
      ctx.beginPath(); ctx.arc(cx, cy - r * 0.28, r * 0.95, Math.PI * 0.95, Math.PI * 0.05); ctx.fill();
    }
  }

  // ── Figure renderer per direction ────────────────────────────────────
  function drawFigure(ctx, role, dir, pose) {
    const R = role;
    const skin = R.skinRamp, top = R.top, pants = R.pants, hair = R.hair;
    const cx = CW / 2 + (pose.hipX || 0);
    const ground = GROUND;
    const legH = 19 * S, torsoH = 16 * S, headR = 8.0 * S;
    const hipY = ground - legH + pose.crouch;
    const shY = hipY - torsoH + pose.bob + pose.crouch * 0.35;
    const neckY = shY - 1.6 * S;
    const headY = neckY - headR * 0.82;
    const leanX = Math.sin(pose.lean) * torsoH;
    const side = dir === 'left' || dir === 'right';
    const away = dir === 'up';
    const shoulderW = 8.2 * S * (R.build || 1);

    // ── legs ──
    const legW = 4.8 * S;
    function leg(which, frontness) {
      const f = which === 'L' ? pose.footL : pose.footR;
      let fx, fy, hx;
      if (side) {
        fx = cx + f.y * 0.95;
        fy = ground - f.lift;
        hx = cx + f.y * 0.15;
      } else {
        // down/up parallax: forward foot lower + slightly outer, back foot
        // higher + inner — sells the stride without a real Z axis.
        const fwd = (away ? -1 : 1) * f.y / (10 * S); // -1..1 toward camera
        fx = cx + f.x * (0.55 + fwd * 0.10);
        fy = ground - f.lift + fwd * 1.7 * S;
        hx = cx + f.x * 0.4;
      }
      const kneeX = lerp(hx, fx, 0.5) + (side ? (f.lift > 0.5 ? 1.8 * S : 0.4 * S) : 0);
      const kneeY = lerp(hipY, fy, 0.52);
      limb(ctx, hx, hipY + 1 * S, kneeX, kneeY, legW, pants);
      limb(ctx, kneeX, kneeY, fx, fy - 2.0 * S, legW * 0.92, pants);
      // boot
      ctx.fillStyle = '#3a2917';
      ctx.beginPath();
      ctx.ellipse(fx + (side ? 1.3 * S * 0.5 : 0), fy - 1.2 * S, side ? 2.6 * S : 2.2 * S, side ? 1.5 * S : 1.8 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.ellipse(fx - 0.6 * S + (side ? 0.6 * S : 0), fy - 1.9 * S, 1.4 * S, 0.6 * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── arms: shoulder → elbow → grip, sleeve upper + SKIN forearm ──
    function armTo(which, gx, gy, w = 3.6 * S) {
      const sx = cx + (which === 'L' ? -shoulderW * 0.9 : shoulderW * 0.9) * (side ? 0.35 : 1) + leanX * 0.5 + (side ? (which === 'L' ? -2.6 * S : 2.6 * S) : 0);
      const sy = shY + 1.8 * S;
      const mx = lerp(sx, gx, 0.48) + (which === 'L' ? -1.2 * S : 1.2 * S) * (side ? 0.4 : 1);
      const my = lerp(sy, gy, 0.5) + 0.8 * S;
      limb(ctx, sx, sy, mx, my, w, top);          // sleeve
      limb(ctx, mx, my, gx, gy, w * 0.82, skin);  // forearm (skin — arms READ now)
      ctx.fillStyle = skin[2];
      ctx.beginPath(); ctx.arc(gx, gy, 1.7 * S * 0.8, 0, Math.PI * 2); ctx.fill();
      return { x: gx, y: gy };
    }

    function armSwing(which) {
      const a = which === 'L' ? pose.armL : pose.armR;
      const raise = a.raise || 0;
      const reachR = 9.5 * S * (1 - raise * 0.35);
      let gx, gy;
      if (side) {
        gx = cx + Math.sin(a.swing) * (reachR * 1.12) + 2.2 * S;
        gy = shY + 2 * S + Math.cos(a.swing) * reachR * (1 - raise);
      } else {
        // front/back views: arms hang at the sides, swinging subtly in Y
        gx = cx + (which === 'L' ? -1 : 1) * (shoulderW * 1.06) + leanX * 0.4;
        gy = shY + 8.5 * S + Math.sin(a.swing) * 2.2 * S - raise * 5 * S;
      }
      return armTo(which, gx, gy);
    }

    // ── torso: shouldered trapezoid + banded shading ──
    function torso() {
      const wTop = shoulderW * 2, wBot = shoulderW * 1.55;
      ctx.save();
      ctx.translate(cx, hipY); ctx.rotate(pose.lean * 0.5); ctx.translate(-cx, -hipY);
      const x0 = cx - wTop / 2 + leanX * 0.3, x1 = cx + wTop / 2 + leanX * 0.3;
      const b0 = cx - wBot / 2, b1 = cx + wBot / 2;
      ctx.fillStyle = top[1];
      ctx.beginPath();
      ctx.moveTo(x0 + 2 * S, shY - 1 * S);
      ctx.quadraticCurveTo(x0 - 1 * S, shY + 2 * S, b0, hipY + 1.5 * S);
      ctx.lineTo(b1, hipY + 1.5 * S);
      ctx.quadraticCurveTo(x1 + 1 * S, shY + 2 * S, x1 - 2 * S, shY - 1 * S);
      ctx.closePath();
      ctx.fill();
      // banded painterly shading: light band up-left, shadow band right+hem
      ctx.save();
      ctx.clip();
      ctx.fillStyle = top[2];
      ctx.beginPath();
      ctx.moveTo(x0 + 1.5 * S, shY - 1 * S); ctx.lineTo(x0 + 6.5 * S, shY - 1 * S);
      ctx.lineTo(b0 + 4.5 * S, hipY + 1.5 * S); ctx.lineTo(b0, hipY + 1.5 * S);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = top[0];
      ctx.beginPath();
      ctx.moveTo(x1 - 6 * S, shY - 1 * S); ctx.lineTo(x1 - 2 * S, shY - 1 * S);
      ctx.lineTo(b1, hipY + 1.5 * S); ctx.lineTo(b1 - 4.5 * S, hipY + 1.5 * S);
      ctx.closePath(); ctx.fill();
      // hem shadow onto pants
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b0, hipY + 0.2 * S, wBot, 1.6 * S);
      if (R.apron) {
        const g = vGrad(ctx, cx, shY + 3 * S, hipY + 1.5 * S, R.apron);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx - wBot * 0.32, shY + 2.5 * S);
        ctx.lineTo(cx + wBot * 0.32, shY + 2.5 * S);
        ctx.lineTo(cx + wBot * 0.4, hipY + 1.5 * S);
        ctx.lineTo(cx - wBot * 0.4, hipY + 1.5 * S);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      // fabric folds — two soft curved creases catch the light direction
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 0.9 * S;
      ctx.beginPath();
      ctx.moveTo(cx - wBot * 0.22, shY + 4 * S);
      ctx.quadraticCurveTo(cx - wBot * 0.30, shY + (hipY - shY) * 0.62, cx - wBot * 0.14, hipY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + wBot * 0.18, shY + 5.5 * S);
      ctx.quadraticCurveTo(cx + wBot * 0.26, shY + (hipY - shY) * 0.7, cx + wBot * 0.12, hipY);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(cx - wBot * 0.20, shY + 4 * S);
      ctx.quadraticCurveTo(cx - wBot * 0.28, shY + (hipY - shY) * 0.62, cx - wBot * 0.12, hipY);
      ctx.stroke();
      // belt
      ctx.fillStyle = '#3a2917';
      ctx.fillRect(b0 + 0.5 * S, hipY - 1.4 * S, wBot - S, 2.1 * S);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(cx - 1.1 * S, hipY - 1.2 * S, 2.2 * S, 1.7 * S);
      ctx.restore();
    }

    function head() {
      const hx = cx + leanX * 0.7;
      // neck
      ctx.fillStyle = skin[0];
      ctx.fillRect(hx - 1.8 * S, neckY - 1 * S, 3.6 * S, 2.6 * S);
      // head with banded shading
      ctx.fillStyle = skin[1];
      ctx.beginPath(); ctx.arc(hx, headY, headR, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(hx, headY, headR, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = skin[2];
      ctx.beginPath(); ctx.arc(hx - headR * 0.35, headY - headR * 0.35, headR * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin[1];
      ctx.beginPath(); ctx.arc(hx - headR * 0.15, headY - headR * 0.1, headR * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin[0];
      ctx.beginPath(); ctx.arc(hx + headR * 0.5, headY + headR * 0.3, headR * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin[1];
      ctx.beginPath(); ctx.arc(hx + headR * 0.05, headY + headR * 0.02, headR * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (!away) {
        ctx.fillStyle = '#241a10';
        const ey = headY + 1.0 * S;
        if (side) {
          ctx.beginPath(); ctx.arc(hx + headR * 0.48, ey, 0.75 * S, 0, Math.PI * 2); ctx.fill();
          // nose bump
          ctx.fillStyle = skin[0];
          ctx.beginPath(); ctx.arc(hx + headR * 0.95, ey + 0.6 * S, 0.9 * S, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.beginPath(); ctx.arc(hx - headR * 0.36, ey, 0.75 * S, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(hx + headR * 0.36, ey, 0.75 * S, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = vGrad(ctx, hx, headY - headR, headY + headR, hair);
        ctx.beginPath(); ctx.arc(hx, headY + 0.3 * S, headR * 0.94, 0, Math.PI * 2); ctx.fill();
      }
      drawHat(ctx, R.hat, hx, headY - headR * 0.55, headR * 0.88, top, hair, dir);
    }

    // ── two-handed tool: shaft defines the grips; arms reach to it ──
    function toolAndArms() {
      const t = pose.tool;
      const pivotX = cx + (side ? 3.5 * S : 7.0 * S) + leanX * 0.6;
      const pivotY = hipY - (side ? 3 * S : 6 * S);
      const ang = side ? t.angle : t.angle * 0.62;
      const ux = Math.sin(ang), uy = Math.cos(ang);
      const kind = R.tool;
      const shaft = kind === 'spear' ? 30 * S : 22 * S;
      const back = -shaft * 0.35 + (t.reach || 0) * 6 * S;
      const g1 = { x: pivotX + ux * (back + 4 * S), y: pivotY + uy * (back + 4 * S) };
      const g2 = { x: pivotX + ux * (back + 11 * S), y: pivotY + uy * (back + 11 * S) };
      // draw shaft + head
      const tip = { x: pivotX + ux * (back + shaft), y: pivotY + uy * (back + shaft) };
      const buttX = pivotX + ux * back, buttY = pivotY + uy * back;
      ctx.strokeStyle = '#5d4325'; ctx.lineWidth = 1.9 * S; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(buttX, buttY); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.strokeStyle = '#8a6a3f'; ctx.lineWidth = 0.8 * S;
      ctx.beginPath(); ctx.moveTo(buttX - 0.5 * S, buttY - 0.5 * S); ctx.lineTo(tip.x - 0.5 * S, tip.y - 0.5 * S); ctx.stroke();
      const steel = ['#4c525c', '#7c8492', '#c2cad8'];
      const hs = 3.4 * S;
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(Math.atan2(ux, uy) * -1);
      ctx.fillStyle = steel[1];
      if (kind === 'hoe') { ctx.fillRect(-hs, -0.4 * S, hs * 1.8, hs * 0.7); ctx.fillStyle = steel[2]; ctx.fillRect(-hs, -0.4 * S, hs * 1.8, hs * 0.24); }
      else if (kind === 'axe') { ctx.beginPath(); ctx.moveTo(0, -hs); ctx.lineTo(hs * 1.5, -hs * 0.1); ctx.lineTo(hs * 1.2, hs * 0.7); ctx.lineTo(0, hs * 0.3); ctx.closePath(); ctx.fill(); ctx.fillStyle = steel[2]; ctx.fillRect(hs * 1.1, -hs * 0.1, hs * 0.35, hs * 0.8); }
      else if (kind === 'pick') { ctx.beginPath(); ctx.moveTo(-hs * 1.7, hs * 0.2); ctx.quadraticCurveTo(0, -hs * 1.5, hs * 1.7, hs * 0.2); ctx.quadraticCurveTo(0, -hs * 0.5, -hs * 1.7, hs * 0.2); ctx.fill(); }
      else if (kind === 'hammer') { ctx.fillRect(-hs * 0.9, -hs * 0.8, hs * 1.8, hs * 1.5); ctx.fillStyle = steel[2]; ctx.fillRect(-hs * 0.9, -hs * 0.8, hs * 1.8, hs * 0.4); }
      else if (kind === 'spear') { ctx.beginPath(); ctx.moveTo(0, -hs * 1.5); ctx.lineTo(hs * 0.75, hs * 0.1); ctx.lineTo(-hs * 0.75, hs * 0.1); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // arms grip the shaft
      armTo('L', side ? g1.x : g1.x - 1 * S, g1.y);
      armTo('R', side ? g2.x : g2.x + 1 * S, g2.y);
    }

    // ── carry crate held by both hands ──
    function carryAll() {
      const bw = 12.5 * S, bh = 8.5 * S;
      const bx = cx + (side ? 7.5 * S : 0) + leanX * 0.4;
      const by = shY + 4.5 * S;
      const wood = ['#553d1c', '#7a5a2b', '#a3814a'];
      // back arm first
      armTo('L', bx - bw * 0.38, by + bh * 0.55);
      ctx.fillStyle = vGrad(ctx, bx, by, by + bh, wood);
      roundedPath(ctx, bx - bw / 2, by, bw, bh, 1.2 * S); ctx.fill();
      ctx.strokeStyle = wood[0]; ctx.lineWidth = 0.8 * S;
      ctx.strokeRect(bx - bw / 2 + 1.2 * S, by + 1.2 * S, bw - 2.4 * S, bh - 2.4 * S);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(bx - bw / 2 + 1 * S, by + 0.6 * S, bw - 2 * S, 1 * S);
      armTo('R', bx + bw * 0.38, by + bh * 0.55);
    }

    // ── held items (tend/book/rod) ──
    function heldItem() {
      const fa = armSwing('R');
      armSwing('L');
      if (R.tool === 'book') {
        ctx.fillStyle = '#ead9b5'; ctx.fillRect(fa.x - 3.2 * S, fa.y - 2.2 * S, 6.4 * S, 4.2 * S);
        ctx.fillStyle = '#7a2f2a'; ctx.fillRect(fa.x - 3.2 * S, fa.y - 2.2 * S, 1.0 * S, 4.2 * S);
        ctx.strokeStyle = '#b9a67e'; ctx.lineWidth = 0.5 * S;
        ctx.beginPath(); ctx.moveTo(fa.x + 0.2 * S, fa.y - 1.6 * S); ctx.lineTo(fa.x + 0.2 * S, fa.y + 1.4 * S); ctx.stroke();
      } else if (R.tool === 'rod') {
        ctx.strokeStyle = '#5d4325'; ctx.lineWidth = 1.2 * S; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(fa.x, fa.y); ctx.lineTo(fa.x + 9 * S, fa.y - 13 * S); ctx.stroke();
        ctx.strokeStyle = 'rgba(230,240,255,0.6)'; ctx.lineWidth = 0.4 * S;
        ctx.beginPath(); ctx.moveTo(fa.x + 9 * S, fa.y - 13 * S); ctx.lineTo(fa.x + 11 * S, fa.y + 2 * S); ctx.stroke();
      } else {
        ctx.fillStyle = '#d9c08a'; ctx.beginPath(); ctx.arc(fa.x, fa.y - 1 * S, 1.9 * S, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f4ead2'; ctx.beginPath(); ctx.arc(fa.x - 0.5 * S, fa.y - 1.5 * S, 0.8 * S, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── compose by direction ──
    const hasSwingTool = pose.tool && !pose.tool.held;
    if (away) {
      if (pose.carry) { leg('L'); leg('R'); torso(); carryAll(); head(); }
      else if (hasSwingTool) { toolAndArms(); leg('L'); leg('R'); torso(); head(); }
      else if (pose.tool && pose.tool.held) { heldItem(); leg('L'); leg('R'); torso(); head(); }
      else { armSwing('L'); armSwing('R'); leg('L'); leg('R'); torso(); head(); }
    } else {
      if (pose.carry) { leg('L'); leg('R'); torso(); head(); carryAll(); }
      else if (hasSwingTool) { leg('L'); leg('R'); torso(); head(); toolAndArms(); }
      else if (pose.tool && pose.tool.held) { leg('L'); leg('R'); torso(); head(); heldItem(); }
      else if (side) { armSwing('L'); leg('L'); leg('R'); torso(); head(); armSwing('R'); }
      else { leg('L'); leg('R'); torso(); head(); armSwing('L'); armSwing('R'); }
    }
  }

  // ── Frame compositor: figure on offscreen → sticker outline → cell ───
  window.__forgeSheet = (roleName, roleCfg) => {
    const R = { ...roleCfg, skinRamp: ${JSON.stringify(SKINS)}[roleCfg.skin] };
    const sheet = document.createElement('canvas');
    sheet.width = 64 * 8; sheet.height = 84 * 16;
    const sctx = sheet.getContext('2d');
    const cell = document.createElement('canvas'); cell.width = CW; cell.height = CH;
    const cctx = cell.getContext('2d');
    const fig = document.createElement('canvas'); fig.width = CW; fig.height = CH;
    const fctx = fig.getContext('2d');

    const ACTIONS = ['idle', 'walk', 'work', 'carry'];
    const DIRS = ['down', 'up', 'left', 'right'];
    for (let a = 0; a < 4; a++) {
      for (let d = 0; d < 4; d++) {
        for (let f = 0; f < 8; f++) {
          const dir = DIRS[d];
          const renderDir = dir === 'left' ? 'right' : dir;
          const pose = poseFor(ACTIONS[a], R.tool, f / 8);
          fctx.clearRect(0, 0, CW, CH);
          fctx.save();
          if (dir === 'left') { fctx.translate(CW, 0); fctx.scale(-1, 1); }
          drawFigure(fctx, R, renderDir, pose);
          fctx.restore();
          // sticker outline: silhouette stamped at 8 offsets under the figure
          cctx.clearRect(0, 0, CW, CH);
          cctx.save();
          cctx.globalCompositeOperation = 'source-over';
          for (const [ox, oy] of [[1.6,0],[-1.6,0],[0,1.6],[0,-1.6],[1.2,1.2],[-1.2,1.2],[1.2,-1.2],[-1.2,-1.2]]) {
            cctx.drawImage(fig, ox, oy);
          }
          cctx.globalCompositeOperation = 'source-in';
          cctx.fillStyle = OUTLINE;
          cctx.fillRect(0, 0, CW, CH);
          cctx.globalCompositeOperation = 'source-over';
          cctx.drawImage(fig, 0, 0);
          cctx.restore();
          // downsample into the sheet
          sctx.imageSmoothingEnabled = true;
          sctx.imageSmoothingQuality = 'high';
          const row = a * 4 + d;
          sctx.drawImage(cell, 0, 0, CW, CH, f * 64, row * 84, 64, 84);
        }
      }
    }
    return sheet.toDataURL('image/png');
  };
})();
`;

await page.setContent('<html><body></body></html>');
await page.evaluate(FORGE_SRC);

await mkdir(OUT_FORGED, { recursive: true });
for (const role of ROLES) {
  const dataUrl = await page.evaluate(([name, cfg]) => window.__forgeSheet(name, cfg), [role, CAST[role]]);
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  await writeFile(join(OUT_FORGED, `${role}.png`), buf);
  if (doDeploy) await writeFile(join(OUT_LIVE, `${role}.png`), buf);
  console.log(`forged ${role}${doDeploy ? ' → deployed' : ''}`);
}
await browser.close();
console.log(`[forge] done — output in ${doDeploy ? 'actors-compiled (LIVE)' : 'actors-forged (staging)'}`);
