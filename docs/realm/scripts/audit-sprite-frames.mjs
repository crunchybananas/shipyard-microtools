// Audits per-role actor sprite rows for animation continuity, alpha
// artifacts, style-era consistency, and cross-action body scale. This is the
// content gate of the sprite chain: a role sheet that mixes the legacy blocky
// era with the painted art direction, or whose body scale jumps between
// actions, fails this audit with a non-zero exit instead of compiling
// silently into the runtime atlas.
//
// Flags:
//   --allow-mixed   downgrade era/scale gate failures to loud warnings
//                   (transition escape hatch while legacy rows are repainted)

import { chromium } from '/Users/cloken/code/peel/admin/node_modules/playwright/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', 'actors-compiled');
const ROW_MANIFEST = join(ROOT, 'assets', 'sprites', 'actor-rows', 'manifest.json');
const SHOTS = join(ROOT, 'scripts', 'screenshots');

const ALLOW_MIXED = process.argv.includes('--allow-mixed');

const FRAME_W = 64;
const FRAME_H = 84;
const FRAMES = 8;
const DIRS = ['down', 'up', 'left', 'right'];
const ACTIONS = ['idle', 'walk', 'work', 'carry'];
const ROLES = [
  'settler', 'farmer', 'rancher', 'lumber', 'miner', 'stonecutter',
  'fisher', 'trader', 'innkeeper', 'builder', 'blacksmith', 'guard',
  'scholar', 'forager',
];

// Style-era classifier thresholds, calibrated 2026-07-01 against visually
// confirmed rows across all 224 compiled rows: blocky rows measured
// colorCount 80-160 with shadingRatio 0.19-0.23; painted rows measured
// colorCount 315-706 with shadingRatio 0.61-0.67. Painted art carries many
// more distinct colors and continuous shading; blocky art is flat fills with
// hard region borders. Thresholds sit in the empty margin between clusters.
const ERA = {
  colorCountPainted: 250, // median distinct quantized colors per frame >= this -> painted vote
  colorCountBlocky: 180, // <= this -> blocky vote
  shadingPainted: 0.45, // median shaded-neighbor ratio >= this -> painted vote
  shadingBlocky: 0.3, // <= this -> blocky vote
};
// Cross-action body scale gate: per role+dir, the median dense-body height of
// every action must stay within this band of the role's walk-row median.
const SCALE_TOLERANCE_PX = 10;
const PALETTE_CLUSTER_DISTANCE = 36;

function scoreRow(frames) {
  const nonBlank = frames.filter((f) => f.pixels > 0);
  const widths = nonBlank.map((f) => f.w);
  const heights = nonBlank.map((f) => f.h);
  const pixels = nonBlank.map((f) => f.pixels);
  const centerJumps = [];
  const widthJumps = [];
  const heightJumps = [];
  const pixelRatios = [];

  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i];
    const b = frames[i + 1];
    if (!a.pixels || !b.pixels) continue;
    centerJumps.push(Math.hypot(a.cx - b.cx, a.cy - b.cy));
    widthJumps.push(Math.abs(a.w - b.w));
    heightJumps.push(Math.abs(a.h - b.h));
    pixelRatios.push(Math.max(a.pixels, b.pixels) / Math.max(1, Math.min(a.pixels, b.pixels)));
  }

  const blankCount = frames.length - nonBlank.length;
  const maxCenterJump = Math.max(0, ...centerJumps);
  const maxWidthJump = Math.max(0, ...widthJumps);
  const maxHeightJump = Math.max(0, ...heightJumps);
  const maxPixelRatio = Math.max(1, ...pixelRatios);
  const fragmentPixels = Math.max(0, ...frames.map((f) => f.fragmentPixels));
  const fragmentCount = Math.max(0, ...frames.map((f) => f.fragmentCount));
  const edgePixels = Math.max(0, ...frames.map((f) => f.edgePixels));
  const widthRange = widths.length ? Math.max(...widths) - Math.min(...widths) : 0;
  const heightRange = heights.length ? Math.max(...heights) - Math.min(...heights) : 0;
  const pixelRangeRatio = pixels.length ? Math.max(...pixels) / Math.max(1, Math.min(...pixels)) : 1;

  let score = 0;
  score += blankCount * 100;
  score += Math.max(0, maxCenterJump - 9) * 5;
  score += Math.max(0, maxWidthJump - 10) * 3;
  score += Math.max(0, maxHeightJump - 10) * 3;
  score += Math.max(0, widthRange - 14) * 2;
  score += Math.max(0, heightRange - 14) * 2;
  score += Math.max(0, maxPixelRatio - 1.35) * 40;
  score += Math.max(0, pixelRangeRatio - 1.55) * 20;
  score += Math.max(0, fragmentPixels - 70) * 0.35;
  score += Math.max(0, fragmentCount - 5) * 5;
  score += Math.max(0, edgePixels - 220) * 0.04;

  return {
    score,
    blankCount,
    maxCenterJump,
    maxWidthJump,
    maxHeightJump,
    widthRange,
    heightRange,
    maxPixelRatio,
    pixelRangeRatio,
    fragmentPixels,
    fragmentCount,
    edgePixels,
  };
}

await mkdir(SHOTS, { recursive: true });

const sheets = {};
for (const role of ROLES) {
  const bytes = await readFile(join(ACTOR_DIR, `${role}.png`));
  sheets[role] = `data:image/png;base64,${bytes.toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const audit = await page.evaluate(async ({ sheets, roles, actions, dirs, frameW, frameH, frames }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function erode(mask, iterations) {
    let current = mask;
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(frameW * frameH);
      for (let y = 1; y < frameH - 1; y++) {
        for (let x = 1; x < frameW - 1; x++) {
          let all = 1;
          for (let ny = y - 1; ny <= y + 1 && all; ny++) {
            for (let nx = x - 1; nx <= x + 1; nx++) {
              if (!current[ny * frameW + nx]) { all = 0; break; }
            }
          }
          if (all) next[y * frameW + x] = 1;
        }
      }
      current = next;
    }
    return current;
  }

  function largestComponentBounds(mask, pad) {
    const visited = new Uint8Array(frameW * frameH);
    const queue = [];
    let best = null;
    for (let start = 0; start < mask.length; start++) {
      if (!mask[start] || visited[start]) continue;
      visited[start] = 1;
      queue.length = 0;
      queue.push(start);
      let size = 0;
      let minX = frameW, minY = frameH, maxX = -1, maxY = -1;
      for (let q = 0; q < queue.length; q++) {
        const idx = queue[q];
        size++;
        const x = idx % frameW;
        const y = Math.floor(idx / frameW);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < frameW - 1 ? idx + 1 : -1,
          y > 0 ? idx - frameW : -1,
          y < frameH - 1 ? idx + frameW : -1,
        ];
        for (const next of neighbors) {
          if (next < 0 || !mask[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      if (!best || size > best.size) best = { size, minX, minY, maxX, maxY };
    }
    if (!best) return { w: 0, h: 0, maxY: 0 };
    const minX = Math.max(0, best.minX - pad);
    const minY = Math.max(0, best.minY - pad);
    const maxX = Math.min(frameW - 1, best.maxX + pad);
    const maxY = Math.min(frameH - 1, best.maxY + pad);
    return { w: maxX - minX + 1, h: maxY - minY + 1, maxY };
  }

  function frameStats(ctx, sx, sy) {
    const image = ctx.getImageData(sx, sy, frameW, frameH);
    const data = image.data;
    const opaque = new Uint8Array(frameW * frameH);
    let minX = frameW;
    let minY = frameH;
    let maxX = -1;
    let maxY = -1;
    let pixels = 0;
    let sumX = 0;
    let sumY = 0;
    let edgePixels = 0;
    let softPixels = 0;
    let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
    const quantized = new Set();

    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const i = (y * frameW + x) * 4;
        const a = data[i + 3];
        if (a <= 18) continue;
        opaque[y * frameW + x] = 1;
        pixels++;
        sumX += x;
        sumY += y;
        if (a < 230) softPixels++;
        const weight = a / 255;
        sumR += data[i] * weight;
        sumG += data[i + 1] * weight;
        sumB += data[i + 2] * weight;
        sumA += weight;
        quantized.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
        if (x <= 1 || x >= frameW - 2 || y <= 1 || y >= frameH - 2) edgePixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // Shading ratio: fraction of adjacent opaque pixel pairs whose color
    // difference sits in the continuous-shading band. Flat blocky fills score
    // near zero (most pairs identical, region borders exceed the band).
    let pairTotal = 0;
    let pairShaded = 0;
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const idx = y * frameW + x;
        if (!opaque[idx]) continue;
        const i = idx * 4;
        for (const nIdx of [x < frameW - 1 ? idx + 1 : -1, y < frameH - 1 ? idx + frameW : -1]) {
          if (nIdx < 0 || !opaque[nIdx]) continue;
          const j = nIdx * 4;
          const delta = Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
          pairTotal++;
          if (delta >= 12 && delta <= 96) pairShaded++;
        }
      }
    }

    if (!pixels) {
      return {
        pixels: 0, minX: 0, minY: 0, maxX: 0, maxY: 0,
        w: 0, h: 0, cx: 0, cy: 0, edgePixels: 0,
        fragmentPixels: 0, fragmentCount: 0,
        bodyW: 0, bodyH: 0, bodyBottom: 0,
        colorCount: 0, softRatio: 0, shadingRatio: 0,
        meanColor: [0, 0, 0],
      };
    }

    const eroded = erode(opaque, 2);
    let body = largestComponentBounds(eroded, 2);
    if (!body.w) body = largestComponentBounds(opaque, 2);

    const visited = new Uint8Array(frameW * frameH);
    const sizes = [];
    const queue = [];
    for (let start = 0; start < opaque.length; start++) {
      if (!opaque[start] || visited[start]) continue;
      visited[start] = 1;
      queue.length = 0;
      queue.push(start);
      let size = 0;
      for (let q = 0; q < queue.length; q++) {
        const idx = queue[q];
        size++;
        const x = idx % frameW;
        const y = Math.floor(idx / frameW);
        const neighbors = [
          x > 0 ? idx - 1 : -1,
          x < frameW - 1 ? idx + 1 : -1,
          y > 0 ? idx - frameW : -1,
          y < frameH - 1 ? idx + frameW : -1,
        ];
        for (const next of neighbors) {
          if (next < 0 || !opaque[next] || visited[next]) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }
      sizes.push(size);
    }
    sizes.sort((a, b) => b - a);
    const fragmentPixels = sizes.slice(1).reduce((sum, n) => sum + n, 0);
    const fragmentCount = sizes.slice(1).filter((n) => n >= 4).length;

    return {
      pixels,
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      cx: sumX / pixels,
      cy: sumY / pixels,
      edgePixels,
      fragmentPixels,
      fragmentCount,
      bodyW: body.w,
      bodyH: body.h,
      bodyBottom: body.maxY,
      colorCount: quantized.size,
      softRatio: pixels ? softPixels / pixels : 0,
      shadingRatio: pairTotal ? pairShaded / pairTotal : 0,
      meanColor: [sumR / Math.max(1, sumA), sumG / Math.max(1, sumA), sumB / Math.max(1, sumA)],
    };
  }

  const rows = [];
  const rowCanvas = document.createElement('canvas');
  rowCanvas.width = frameW * frames;
  rowCanvas.height = frameH;
  const rowCtx = rowCanvas.getContext('2d', { willReadFrequently: true });

  for (const role of roles) {
    const img = await loadImage(sheets[role]);
    const sheet = document.createElement('canvas');
    sheet.width = img.naturalWidth;
    sheet.height = img.naturalHeight;
    const ctx = sheet.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
      for (let dirIndex = 0; dirIndex < dirs.length; dirIndex++) {
        const rowIndex = actionIndex * dirs.length + dirIndex;
        const y = rowIndex * frameH;
        const framesOut = [];
        for (let frame = 0; frame < frames; frame++) {
          framesOut.push(frameStats(ctx, frame * frameW, y));
        }
        rowCtx.clearRect(0, 0, rowCanvas.width, rowCanvas.height);
        rowCtx.drawImage(img, 0, y, rowCanvas.width, frameH, 0, 0, rowCanvas.width, frameH);
        rows.push({
          role,
          action: actions[actionIndex],
          dir: dirs[dirIndex],
          rowIndex,
          frames: framesOut,
          dataUrl: rowCanvas.toDataURL('image/png'),
        });
      }
    }
  }
  return rows;
}, { sheets, roles: ROLES, actions: ACTIONS, dirs: DIRS, frameW: FRAME_W, frameH: FRAME_H, frames: FRAMES });

function median(values) {
  const v = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function styleRow(frames) {
  const populated = frames.filter((f) => f.pixels > 0);
  const medianBodyH = median(populated.map((f) => f.bodyH));
  const medianBodyW = median(populated.map((f) => f.bodyW));
  const medianColorCount = median(populated.map((f) => f.colorCount));
  const medianShadingRatio = median(populated.map((f) => f.shadingRatio));
  const medianSoftRatio = median(populated.map((f) => f.softRatio));
  const medianColor = [0, 1, 2].map((c) => median(populated.map((f) => f.meanColor[c])));

  const paintedVotes = (medianColorCount >= ERA.colorCountPainted ? 1 : 0)
    + (medianShadingRatio >= ERA.shadingPainted ? 1 : 0);
  const blockyVotes = (medianColorCount <= ERA.colorCountBlocky ? 1 : 0)
    + (medianShadingRatio <= ERA.shadingBlocky ? 1 : 0);
  let era = 'ambiguous';
  if (paintedVotes >= 1 && !blockyVotes) era = 'painted';
  else if (blockyVotes >= 1 && !paintedVotes) era = 'blocky';

  return {
    era,
    medianBodyH,
    medianBodyW,
    medianColorCount,
    medianShadingRatio: Math.round(medianShadingRatio * 1000) / 1000,
    medianSoftRatio: Math.round(medianSoftRatio * 1000) / 1000,
    medianColor: medianColor.map((v) => Math.round(v * 10) / 10),
  };
}

const reports = audit.map((row) => ({
  role: row.role,
  action: row.action,
  dir: row.dir,
  rowIndex: row.rowIndex,
  ...scoreRow(row.frames),
  ...styleRow(row.frames),
}));

// Contract-ordered copy for the style table; `reports` itself is re-sorted by
// continuity score below for the worst-rows proof sheet.
const tableRows = reports.slice();
reports.sort((a, b) => b.score - a.score);

const worst = reports.slice(0, 18);
const rowByKey = new Map(audit.map((row) => [`${row.role}/${row.action}/${row.dir}`, row]));

const proofDataUrl = await page.evaluate(async ({ worst, rows }) => {
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  const scale = 2;
  const labelW = 236;
  const rowW = 512 * scale;
  const rowH = 84 * scale;
  const canvas = document.createElement('canvas');
  canvas.width = labelW + rowW;
  canvas.height = worst.length * rowH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#181511';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '16px sans-serif';
  ctx.textBaseline = 'top';
  for (let i = 0; i < worst.length; i++) {
    const item = worst[i];
    const key = `${item.role}/${item.action}/${item.dir}`;
    const row = rows[key];
    const img = await loadImage(row.dataUrl);
    const y = i * rowH;
    ctx.fillStyle = i % 2 ? '#201b15' : '#181511';
    ctx.fillRect(0, y, canvas.width, rowH);
    ctx.fillStyle = '#f3ead7';
    ctx.fillText(`${i + 1}. ${key}`, 10, y + 12);
    ctx.fillStyle = '#c7bda8';
    ctx.fillText(`score ${item.score.toFixed(1)}`, 10, y + 34);
    ctx.fillText(`jump ${item.maxCenterJump.toFixed(1)}  size ${item.widthRange}/${item.heightRange}`, 10, y + 56);
    ctx.fillText(`frag ${item.fragmentPixels}/${item.fragmentCount}`, 10, y + 78);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, labelW, y, rowW, rowH);
  }
  return canvas.toDataURL('image/png');
}, {
  worst,
  rows: Object.fromEntries([...rowByKey.entries()].map(([key, row]) => [key, { dataUrl: row.dataUrl }])),
});

const proofBytes = Buffer.from(proofDataUrl.split(',')[1], 'base64');
await writeFile(join(SHOTS, 'sprite-audit-worst-rows.png'), proofBytes);

// ---- style-era + scale gate -------------------------------------------------

let manifestRows = {};
try {
  manifestRows = JSON.parse(await readFile(ROW_MANIFEST, 'utf8')).rows || {};
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

function manifestStatus(row) {
  const item = manifestRows[`${row.role}/${row.action}/${row.dir}`];
  if (!item) return { label: 'base', waivedScale: false };
  if (item.status === 'accepted-with-waiver') {
    return {
      label: 'waived',
      waivedScale: (item.allowedWarnings || []).includes('direction-scale-mismatch'),
    };
  }
  if (item.status === 'accepted') return { label: 'locked', waivedScale: false };
  return { label: item.status, waivedScale: false };
}

const failures = [];
const waived = [];
const byRole = new Map(ROLES.map((role) => [role, tableRows.filter((r) => r.role === role)]));

for (const [role, rows] of byRole) {
  // Palette clusters: greedy grouping of row median colors.
  const clusters = [];
  for (const row of rows) {
    let assigned = null;
    for (const cluster of clusters) {
      const d = Math.hypot(
        row.medianColor[0] - cluster.centroid[0],
        row.medianColor[1] - cluster.centroid[1],
        row.medianColor[2] - cluster.centroid[2],
      );
      if (d < PALETTE_CLUSTER_DISTANCE) { assigned = cluster; break; }
    }
    if (!assigned) {
      assigned = { id: String.fromCharCode(65 + clusters.length), centroid: row.medianColor.slice(), n: 0 };
      clusters.push(assigned);
    }
    for (let c = 0; c < 3; c++) {
      assigned.centroid[c] = (assigned.centroid[c] * assigned.n + row.medianColor[c]) / (assigned.n + 1);
    }
    assigned.n++;
    row.paletteCluster = assigned.id;
  }

  // Era mix: the painted direction is the target; any blocky row is repaint debt.
  const eras = new Set(rows.map((r) => r.era));
  if (eras.has('blocky') && (eras.has('painted') || eras.has('ambiguous'))) {
    const blockyRows = rows.filter((r) => r.era === 'blocky').map((r) => `${r.action}/${r.dir}`);
    failures.push(`${role}: mixed style eras — blocky rows [${blockyRows.join(', ')}] vs painted art direction`);
  } else if (eras.has('blocky')) {
    failures.push(`${role}: entire sheet is legacy blocky era`);
  }

  // Cross-action scale: every action row must stay near the same-direction
  // walk row's dense-body height.
  for (const dir of DIRS) {
    const walkRow = rows.find((r) => r.action === 'walk' && r.dir === dir);
    if (!walkRow || !walkRow.medianBodyH) continue;
    for (const row of rows) {
      if (row.dir !== dir || row.action === 'walk' || !row.medianBodyH) continue;
      const delta = Math.abs(row.medianBodyH - walkRow.medianBodyH);
      if (delta <= SCALE_TOLERANCE_PX) continue;
      const status = manifestStatus(row);
      const line = `${role}/${row.action}/${row.dir}: body ${row.medianBodyH}px vs walk ${walkRow.medianBodyH}px (Δ${delta}px > ${SCALE_TOLERANCE_PX}px)`;
      if (status.waivedScale) waived.push(`${line} [manifest waiver]`);
      else failures.push(line);
    }
  }

  for (const row of rows) {
    row.manifestStatus = manifestStatus(row).label;
    row.looseFragments = row.fragmentPixels > 160 || row.fragmentCount > 8;
  }
}

console.log('[sprite-audit] role/action -> era, dense-body height px, palette cluster, debris (d=down u=up l=left r=right)');
for (const [role, rows] of byRole) {
  console.log(`[sprite-audit] ${role}`);
  for (const action of ACTIONS) {
    const cells = DIRS.map((dir) => {
      const row = rows.find((r) => r.action === action && r.dir === dir);
      const era = row.era === 'painted' ? 'paint' : row.era === 'blocky' ? 'BLOCK' : 'ambig';
      const frag = row.looseFragments ? '!frag' : '';
      const status = row.manifestStatus === 'base' ? '' : `[${row.manifestStatus}]`;
      return `${dir[0]}:${era} ${String(row.medianBodyH).padStart(2)}px ${row.paletteCluster}${frag}${status}`;
    });
    console.log(`[sprite-audit]   ${action.padEnd(5)} ${cells.join('  ')}`);
  }
}

for (const item of worst.slice(0, 12)) {
  console.log(`[sprite-audit] worst: ${item.role}/${item.action}/${item.dir} score=${item.score.toFixed(1)} blank=${item.blankCount} center=${item.maxCenterJump.toFixed(1)} size=${item.widthRange}/${item.heightRange} pixelRatio=${item.pixelRangeRatio.toFixed(2)} fragments=${item.fragmentPixels}/${item.fragmentCount}`);
}

await writeFile(join(SHOTS, 'sprite-audit-report.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  gate: { failures, waived, allowMixed: ALLOW_MIXED },
  styleTable: tableRows,
  worst,
  reports,
}, null, 2)}\n`);
console.log('[sprite-audit] wrote scripts/screenshots/sprite-audit-report.json');
console.log('[sprite-audit] wrote scripts/screenshots/sprite-audit-worst-rows.png');

for (const line of waived) console.log(`[sprite-audit] WAIVED: ${line}`);
if (failures.length) {
  const level = ALLOW_MIXED ? 'GATE (allowed by --allow-mixed)' : 'GATE FAILURE';
  for (const line of failures) console.log(`[sprite-audit] ${level}: ${line}`);
  console.log(`[sprite-audit] ${failures.length} era/scale gate finding(s); painted era at stable body scale is the contract`);
}

await browser.close();
if (failures.length && !ALLOW_MIXED) process.exit(1);
