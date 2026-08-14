// Registration audit — the "sprite-map jitter" gate.
//
// Measures per-frame CONTENT REGISTRATION inside each 64x84 cell of the
// compiled actor sheets: feet baseline (bottom-most opaque row), alpha
// centroid X, and bbox. When registration drifts frame-to-frame within a
// row, the character visibly hops/slides while animating even though the
// entity moves smoothly — this is the jitter distinct from motion stutter.
//
// Reports, per row: max |baseline - row median| and max |centroidX - row
// median|, plus cross-direction baseline spread within each role+action
// group (turning/stopping pops). Exit 1 when any row exceeds tolerance.
//
// Usage:
//   node docs/realm/scripts/audit-sprite-registration.mjs           # audit
//   node docs/realm/scripts/audit-sprite-registration.mjs --json    # data dump
//   node docs/realm/scripts/audit-sprite-registration.mjs --write   # regenerate
//       js/actor-registration.js (runtime per-row/per-frame feet offsets;
//       rerun after any sheet repaint)

import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors-compiled');

const FRAME_W = 64, FRAME_H = 84, FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];
const ROLES = [
  'settler', 'farmer', 'rancher', 'lumber', 'miner', 'stonecutter',
  'fisher', 'trader', 'innkeeper', 'builder', 'blacksmith', 'guard',
  'scholar', 'forager',
];
const ALPHA_T = 24;          // opacity threshold for "content"
const BASELINE_TOL = 2.0;    // px of within-row feet drift allowed
const CENTROID_TOL = 3.5;    // walk/idle horizontal drift (whole-body registration)
const CENTROID_TOL_TOOL = 8; // work/carry rows swing tools — sway is the animation
const GROUP_BASELINE_TOL = 2.5; // px of cross-direction baseline spread per role+action
const ABSOLUTE_BASELINE_TOL = 1; // effective feet must stay on the cast-wide ground row

const asJson = process.argv.includes('--json');
const asWrite = process.argv.includes('--write');
const REF_BASELINE = 79; // the cast-wide feet line (mode across all 224 rows)

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

const results = [];
for (const role of ROLES) {
  const buf = await readFile(join(ACTOR_DIR, `${role}.png`));
  const rows = await page.evaluate(async ({ b64, FRAME_W, FRAME_H, FRAMES, DIRS, ACTIONS, ALPHA_T }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const out = [];
    for (let a = 0; a < ACTIONS.length; a++) {
      for (let d = 0; d < DIRS.length; d++) {
        const rowIdx = a * DIRS.length + d;
        const frames = [];
        for (let f = 0; f < FRAMES; f++) {
          const data = cx.getImageData(f * FRAME_W, rowIdx * FRAME_H, FRAME_W, FRAME_H).data;
          let minX = FRAME_W, maxX = -1, minY = FRAME_H, maxY = -1, sumX = 0, n = 0;
          for (let y = 0; y < FRAME_H; y++) {
            for (let x = 0; x < FRAME_W; x++) {
              const alpha = data[(y * FRAME_W + x) * 4 + 3];
              if (alpha < ALPHA_T) continue;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              sumX += x; n++;
            }
          }
          frames.push(n === 0
            ? { empty: true }
            : { baseline: maxY, top: minY, cx: sumX / n, w: maxX - minX + 1, h: maxY - minY + 1, area: n });
        }
        out.push({ action: ACTIONS[a], dir: DIRS[d], frames });
      }
    }
    return out;
  }, { b64: buf.toString('base64'), FRAME_W, FRAME_H, FRAMES, DIRS, ACTIONS, ALPHA_T });

  for (const row of rows) {
    const fs = row.frames.filter(f => !f.empty);
    if (fs.length < 2) { results.push({ role, ...row, empty: true }); continue; }
    const med = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const mBase = med(fs.map(f => f.baseline));
    const mCx = med(fs.map(f => f.cx));
    const baseDrift = Math.max(...fs.map(f => Math.abs(f.baseline - mBase)));
    const cxDrift = Math.max(...fs.map(f => Math.abs(f.cx - mCx)));
    const hWobble = Math.max(...fs.map(f => f.baseline - f.top)) - Math.min(...fs.map(f => f.baseline - f.top));
    results.push({
      role, action: row.action, dir: row.dir,
      medBaseline: mBase, baseDrift: +baseDrift.toFixed(1),
      cxDrift: +cxDrift.toFixed(1), hWobble,
      medH: med(fs.map(f => f.h)), medArea: med(fs.map(f => f.area)),
      perFrame: row.frames.map(f => f.empty ? null : { b: f.baseline, cx: +f.cx.toFixed(1), h: f.h, area: f.area }),
    });
  }
}
await browser.close();

// Cross-direction baseline spread per role+action (the turn/stop pop)
const groups = {};
for (const r of results) {
  if (r.empty) continue;
  const k = `${r.role}/${r.action}`;
  (groups[k] = groups[k] || []).push(r.medBaseline);
}
const groupSpread = Object.entries(groups).map(([k, v]) => ({ k, spread: Math.max(...v) - Math.min(...v) }));

if (asJson) {
  console.log(JSON.stringify({ results, groupSpread }));
  process.exit(0);
}

if (asWrite) {
  // Emit runtime registration: per-row dy to bring the row's median feet
  // line to REF_BASELINE, plus per-frame extra dy where a frame's feet
  // deviate >2px from the row median (e.g. farmer/work/down bounce).
  // Horizontal sway is NOT corrected — tool swings are intentional.
  const { writeFile } = await import('node:fs/promises');
  const reg = {};
  let rowFixes = 0, frameFixes = 0;

  for (const r of results) {
    if (r.empty) continue;
    const rowDy = REF_BASELINE - r.medBaseline;
    const perFrame = r.perFrame.map(f => {
      if (!f) return 0;
      const dev = r.medBaseline - f.b;
      return Math.abs(dev) >= 2 ? dev : 0;
    });
    const hasFrame = perFrame.some(v => v !== 0);
    if (rowDy === 0 && !hasFrame) continue;
    const entry = {};
    if (rowDy !== 0) { entry.dy = rowDy; rowFixes++; }
    if (hasFrame) { entry.f = perFrame; frameFixes += perFrame.filter(v => v !== 0).length; }
    reg[`${r.role}/${r.action}/${r.dir}`] = entry;
  }
  const banner = `// GENERATED by scripts/audit-sprite-registration.mjs --write — do not hand-edit.
// Per-row/per-frame registration for the actor atlas (64x84 cells):
//   dy  — row feet-line shift onto the cast baseline (${REF_BASELINE})
//   f   — per-frame feet corrections (>=2px deviants)
// Applied at draw time in render.drawActorAtlasFrame; sheets untouched.
// Runtime scales are deliberately absent: opaque area includes tools and
// cargo, so area-derived scaling makes bodies pop between actions. Repaint a
// changing body instead. Rerun --write after any repaint.
`;
  await writeFile(join(ROOT, 'js', 'actor-registration.js'),
    banner + 'export const ACTOR_REGISTRATION = ' + JSON.stringify(reg, null, 2) + ';\n');
  console.log(`[registration] wrote js/actor-registration.js — ${rowFixes} row dy, ${frameFixes} frame dy`);
  // Post-correction check: recompute spreads with offsets applied
  let residualRows = 0;
  for (const r of results) {
    if (r.empty) continue;
    const e = reg[`${r.role}/${r.action}/${r.dir}`] || {};
    const corrected = r.perFrame.filter(Boolean).map((f, i) => f.b + (e.dy || 0) + (e.f?.[i] || 0));
    const spread = Math.max(...corrected) - Math.min(...corrected);
    const off = Math.abs((corrected.sort((a, b) => a - b)[Math.floor(corrected.length / 2)]) - REF_BASELINE);
    if (spread > 2 || off > 1) residualRows++;
  }
  console.log(`[registration] post-correction residual rows over tolerance: ${residualRows}`);
  process.exit(residualRows ? 1 : 0);
}

// Default gate measures EFFECTIVE registration: raw sheet metrics with the
// generated runtime offsets applied (js/actor-registration.js). Use --raw
// to see the uncorrected sheet numbers.
let REG = {};
if (!process.argv.includes('--raw')) {
  try { REG = (await import('../js/actor-registration.js?realm=195')).ACTOR_REGISTRATION; } catch (_e) {}
}
for (const r of results) {
  if (r.empty) continue;
  const e = REG[`${r.role}/${r.action}/${r.dir}`];
  if (!e) continue;
  const corrected = r.perFrame.map((f, i) => f ? f.b + (e.dy || 0) + (e.f?.[i] || 0) : null).filter(v => v != null);
  const med = corrected.sort((a, b) => a - b)[Math.floor(corrected.length / 2)];
  r.medBaseline = med;
  r.baseDrift = +Math.max(...corrected.map(v => Math.abs(v - med))).toFixed(1);
}
// rebuild group spreads from (possibly corrected) medians
for (const g of groupSpread) g.spread = 0;
{
  const g2 = {};
  for (const r of results) { if (r.empty) continue; const k = `${r.role}/${r.action}`; (g2[k] = g2[k] || []).push(r.medBaseline); }
  groupSpread.length = 0;
  for (const [k, v] of Object.entries(g2)) groupSpread.push({ k, spread: Math.max(...v) - Math.min(...v) });
}

const swayTol = (r) => (r.action === 'work' || r.action === 'carry') ? CENTROID_TOL_TOOL : CENTROID_TOL;
const badRows = results.filter(r => !r.empty && (r.baseDrift > BASELINE_TOL || r.cxDrift > swayTol(r)));
const badGroups = groupSpread.filter(g => g.spread > GROUP_BASELINE_TOL);
const badAbsolute = results.filter(r => !r.empty && Math.abs(r.medBaseline - REF_BASELINE) > ABSOLUTE_BASELINE_TOL);

badRows.sort((a, b) => (b.baseDrift + b.cxDrift) - (a.baseDrift + a.cxDrift));
console.log(`[registration] ${results.length} rows measured`);
console.log(`  rows over tolerance (baseline>${BASELINE_TOL} or centroid>${CENTROID_TOL}): ${badRows.length}`);
for (const r of badRows.slice(0, 20)) {
  console.log(`    ✗ ${r.role}/${r.action}/${r.dir} — feet drift ${r.baseDrift}px, sway ${r.cxDrift}px`);
}
if (badRows.length > 20) console.log(`    … and ${badRows.length - 20} more`);
console.log(`  role+action groups with cross-direction feet spread >${GROUP_BASELINE_TOL}px: ${badGroups.length}`);
for (const g of badGroups.slice(0, 12)) console.log(`    ✗ ${g.k} — ${g.spread}px between directions`);
console.log(`  rows off absolute ground baseline ${REF_BASELINE}±${ABSOLUTE_BASELINE_TOL}px: ${badAbsolute.length}`);
for (const r of badAbsolute.slice(0, 20)) {
  console.log(`    ✗ ${r.role}/${r.action}/${r.dir} — effective baseline ${r.medBaseline}`);
}

if (badRows.length || badGroups.length || badAbsolute.length) {
  console.error('[registration] FAILED — sprite cells are not consistently registered');
  process.exit(1);
}
console.log('[registration] OK — all rows registered within tolerance');
