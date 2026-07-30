// Cross-direction temporal-phase gate for painted actor rows.
//
// The runtime deliberately preserves an actor's frame index when its facing
// changes. Row-local continuity can therefore be perfect while a turn still
// pops from one gait/tool beat to another. This audit compares the temporal
// signature of down/up/left/right as a family. It compares change *within*
// each view rather than requiring different perspectives to share a
// silhouette.

import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS,
  ACTOR_COMPILED_DIRNAME,
  DIRS,
  FRAME_H,
  FRAME_W,
  FRAMES,
  ROLES,
} from '../js/sprite-source-contract.js?realm=182';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ACTOR_DIR = join(ROOT, 'assets', 'sprites', ACTOR_COMPILED_DIRNAME);
const REPORT_PATH = join(ROOT, 'scripts', 'screenshots', 'sprite-direction-phase-report.json');
const ACTOR_ROW_MANIFEST_PATH = join(ROOT, 'assets', 'sprites', 'actor-rows', 'manifest.json');
const MODULAR_SEMANTIC_SOURCES = [
  ['guard', 'a5-guard-actions'],
  ['farmer', 'a7-farmer-actions'],
  ['lumber', 'a8-lumber-actions'],
  ['builder', 'a9-builder-actions'],
  ['blacksmith', 'a10-blacksmith-actions'],
  ['miner', 'a11-miner-actions'],
  ['stonecutter', 'a12-stonecutter-actions'],
  ['fisher', 'a13-fisher-actions'],
];

// A finding must be both large and unambiguous. These thresholds were
// calibrated against the warning-free locked painted families. Low-motion
// idle rows and perspective-specific poses remain auditable in the report,
// but cannot create a false release failure without a decisive alternative
// phase.
const MIN_CHANNELS = 3;
const MIN_IMPROVEMENT = 0.42;
const MIN_COST_DROP = 0.52;
const MAX_ALIGNED_COST = 1.35;
const MIN_VIEW_SUPPORT = 2;

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function sameSequence(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isCrossProjectionPair(reference, candidate) {
  const cardinal = new Set(['down', 'up']);
  const side = new Set(['left', 'right']);
  return (cardinal.has(reference) && side.has(candidate))
    || (side.has(reference) && cardinal.has(candidate));
}

// A generated modular landmark row names the logical near/far foot and its
// beat. The visual signals below intentionally do not: a side projection can
// put the same logical foot on the opposite screen side, creating a strong
// but false half-cycle match. We use these reports only after both files are
// hash-pinned and the flattened source row is the accepted production row.
async function loadProductionSemantics() {
  const actorRows = JSON.parse(await readFile(ACTOR_ROW_MANIFEST_PATH, 'utf8')).rows;
  const semanticRows = new Map();
  for (const [role, source] of MODULAR_SEMANTIC_SOURCES) {
    const sourceDir = join(ROOT, 'assets', 'sprites', 'prototypes', 'actor-pose', 'output', source);
    let manifest;
    try {
      manifest = JSON.parse(await readFile(join(sourceDir, 'manifest.json'), 'utf8'));
    } catch {
      continue;
    }
    for (const [key, record] of Object.entries(manifest.rows || {})) {
      const [action, dir] = key.split('/');
      if (!ACTIONS.includes(action) || !DIRS.includes(dir) || !record.row || !record.landmarks) continue;
      const production = actorRows[`${role}/${action}/${dir}`]?.production;
      const rowOutput = manifest.outputs?.[record.row];
      const landmarksOutput = manifest.outputs?.[record.landmarks];
      if (!production || !rowOutput?.sha256 || !landmarksOutput?.sha256) continue;
      try {
        const [row, landmarkFile] = await Promise.all([
          readFile(join(sourceDir, record.row)),
          readFile(join(sourceDir, record.landmarks)),
        ]);
        if (sha256(row) !== rowOutput.sha256 || production.sha256 !== rowOutput.sha256) continue;
        if (sha256(landmarkFile) !== landmarksOutput.sha256) continue;
        const landmarks = JSON.parse(landmarkFile);
        const frames = landmarks.frames;
        if (!Array.isArray(frames) || frames.length !== FRAMES) continue;
        if (!frames.every((frame, index) => (
          frame.frame === index
          && typeof frame.phase === 'string'
          && frame.phase.length > 0
          && Array.isArray(frame.contacts)
          && frame.contacts.every((contact) => typeof contact === 'string')
        ))) continue;
        semanticRows.set(`${role}/${action}/${dir}`, {
          source,
          landmark: record.landmarks,
          row: record.row,
          phases: frames.map((frame) => frame.phase),
          contacts: frames.map((frame) => frame.contacts.join('|')),
        });
      } catch {
        // A missing or malformed proof is not a waiver; it simply supplies no
        // semantic evidence to this image-based release gate.
      }
    }
  }
  return semanticRows;
}

function semanticHalfCycleProjection(comparison, semanticRows) {
  if (comparison.bestShift !== FRAMES / 2
    || !isCrossProjectionPair(comparison.reference, comparison.candidate)) return null;
  const reference = semanticRows.get(comparison.reference);
  const candidate = semanticRows.get(comparison.candidate);
  if (!reference || !candidate
    || new Set(reference.phases).size !== FRAMES
    || !sameSequence(reference.phases, candidate.phases)
    || !sameSequence(reference.contacts, candidate.contacts)) return null;
  return {
    reason: 'hash-pinned semantic phase/contact agreement across a half-cycle cross-projection',
    reference: {
      source: reference.source,
      landmark: reference.landmark,
      row: reference.row,
    },
    candidate: {
      source: candidate.source,
      landmark: candidate.landmark,
      row: candidate.row,
    },
  };
}

function rotate(values, shift) {
  return values.map((_, frame) => values[(frame + shift + FRAMES) % FRAMES]);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function standardize(values, minimumRange) {
  const range = Math.max(...values) - Math.min(...values);
  if (range < minimumRange) return null;
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  if (variance < 1e-8) return null;
  const deviation = Math.sqrt(variance);
  return values.map((value) => (value - average) / deviation);
}

const CHANNELS = {
  transition: { minimumRange: 0.018, weight: 3 },
  lowerTransition: { minimumRange: 0.024, weight: 4 },
  upperTransition: { minimumRange: 0.024, weight: 2 },
  twoStepTransition: { minimumRange: 0.018, weight: 2 },
  novelty: { minimumRange: 0.012, weight: 1.5 },
  alphaMass: { minimumRange: 45, weight: 1 },
  lowerMass: { minimumRange: 25, weight: 1.5 },
  width: { minimumRange: 3, weight: 1 },
  height: { minimumRange: 2, weight: 0.75 },
  lowerSpread: { minimumRange: 1.6, weight: 1.5 },
};

function normalizedSignals(row) {
  const out = {};
  for (const [key, config] of Object.entries(CHANNELS)) {
    const normalized = standardize(row.signals[key], config.minimumRange);
    if (normalized) out[key] = normalized;
  }
  return out;
}

function compareRows(reference, candidate) {
  const a = normalizedSignals(reference);
  const b = normalizedSignals(candidate);
  const channels = Object.keys(CHANNELS).filter((key) => a[key] && b[key]);
  if (!channels.length) {
    return {
      reference: reference.dir,
      candidate: candidate.dir,
      channels,
      bestShift: 0,
      bestCost: 0,
      zeroCost: 0,
      improvement: 0,
      costDrop: 0,
      decisive: false,
      frameEvidence: null,
    };
  }

  const costs = [];
  const frameCostsByShift = [];
  for (let shift = 0; shift < FRAMES; shift++) {
    let weightedTotal = 0;
    let totalWeight = 0;
    const frameCosts = Array(FRAMES).fill(0);
    const frameWeights = Array(FRAMES).fill(0);
    for (const key of channels) {
      const weight = CHANNELS[key].weight;
      const shifted = rotate(b[key], shift);
      for (let frame = 0; frame < FRAMES; frame++) {
        const delta = a[key][frame] - shifted[frame];
        frameCosts[frame] += delta * delta * weight;
        frameWeights[frame] += weight;
        weightedTotal += delta * delta * weight;
        totalWeight += weight;
      }
    }
    frameCostsByShift.push(frameCosts.map((cost, frame) => cost / Math.max(1, frameWeights[frame])));
    costs.push(weightedTotal / Math.max(1, totalWeight));
  }

  let bestShift = 0;
  for (let shift = 1; shift < FRAMES; shift++) {
    if (costs[shift] < costs[bestShift] - 1e-9) bestShift = shift;
  }
  const zeroCost = costs[0];
  const bestCost = costs[bestShift];
  const costDrop = zeroCost - bestCost;
  const improvement = zeroCost > 1e-9 ? costDrop / zeroCost : 0;
  let evidenceFrame = 0;
  let evidenceGain = -Infinity;
  for (let frame = 0; frame < FRAMES; frame++) {
    const gain = frameCostsByShift[0][frame] - frameCostsByShift[bestShift][frame];
    if (gain > evidenceGain) {
      evidenceGain = gain;
      evidenceFrame = frame;
    }
  }

  return {
    reference: reference.dir,
    candidate: candidate.dir,
    channels,
    costs: costs.map((value) => +value.toFixed(4)),
    bestShift,
    bestCost: +bestCost.toFixed(4),
    zeroCost: +zeroCost.toFixed(4),
    improvement: +improvement.toFixed(4),
    costDrop: +costDrop.toFixed(4),
    decisive: channels.length >= MIN_CHANNELS
      && bestShift !== 0
      && improvement >= MIN_IMPROVEMENT
      && costDrop >= MIN_COST_DROP
      && bestCost <= MAX_ALIGNED_COST,
    frameEvidence: {
      referenceFrame: evidenceFrame,
      candidateRuntimeFrame: evidenceFrame,
      candidateMatchedFrame: (evidenceFrame + bestShift) % FRAMES,
      zeroCost: +frameCostsByShift[0][evidenceFrame].toFixed(4),
      alignedCost: +frameCostsByShift[bestShift][evidenceFrame].toFixed(4),
    },
  };
}

function shiftedRow(row, shift) {
  return {
    ...row,
    signals: Object.fromEntries(
      Object.entries(row.signals).map(([key, values]) => [key, rotate(values, shift)]),
    ),
    alphaFrameSignatures: rotate(row.alphaFrameSignatures, shift),
    mirroredAlphaFrameSignatures: rotate(row.mirroredAlphaFrameSignatures, shift),
  };
}

function reversedChronologyRow(row) {
  const transitionOffsets = {
    transition: 2,
    lowerTransition: 2,
    upperTransition: 2,
    twoStepTransition: 3,
  };
  return {
    ...row,
    signals: Object.fromEntries(
      Object.entries(row.signals).map(([key, values]) => {
        // A value measured from frame N to N+1 belongs to the preceding
        // source frame after a strip reversal. Per-frame measurements simply
        // reverse; one- and two-step transitions rotate by one and two cells.
        const offset = transitionOffsets[key] || 1;
        return [key, values.map((_, frame) => (
          values[(FRAMES - offset - frame + FRAMES) % FRAMES]
        ))];
      }),
    ),
    alphaFrameSignatures: [...row.alphaFrameSignatures].reverse(),
    mirroredAlphaFrameSignatures: [...row.mirroredAlphaFrameSignatures].reverse(),
  };
}

function reversedSideChronology(left, right) {
  const forward = compareRows(left, right);
  const reversed = compareRows(left, reversedChronologyRow(right));
  const costDrop = forward.bestCost - reversed.bestCost;
  const improvement = forward.bestCost > 1e-9 ? costDrop / forward.bestCost : 0;
  return {
    comparison: 'left-vs-right temporal signals with right frame order reversed',
    forward,
    reversed,
    costDrop: +costDrop.toFixed(4),
    improvement: +improvement.toFixed(4),
    reversedChronology: reversed.channels.length >= MIN_CHANNELS
      && improvement >= MIN_IMPROVEMENT
      && costDrop >= MIN_COST_DROP
      && reversed.bestCost <= MAX_ALIGNED_COST,
  };
}

function exactSideChronology(left, right) {
  const forwardShifts = [];
  const reversedShifts = [];
  for (let shift = 0; shift < FRAMES; shift++) {
    const forward = left.alphaFrameSignatures.every((signature, frame) => (
      signature === right.mirroredAlphaFrameSignatures[(frame + shift) % FRAMES]
    ));
    if (forward) forwardShifts.push(shift);
    const reversed = left.alphaFrameSignatures.every((signature, frame) => (
      signature === right.mirroredAlphaFrameSignatures[
        (FRAMES - 1 - frame + shift + FRAMES) % FRAMES
      ]
    ));
    if (reversed) reversedShifts.push(shift);
  }
  const zeroShiftForward = forwardShifts.includes(0);
  return {
    comparison: 'left-vs-horizontally-mirrored-right',
    evidence: 'two independent alpha signatures plus exact mass/count',
    forwardShifts,
    reversedShifts,
    zeroShiftForward,
    reversedChronology: !zeroShiftForward && reversedShifts.length > 0,
  };
}

function auditFamily(rows, semanticRows = new Map()) {
  const comparisons = [];
  for (let a = 0; a < DIRS.length; a++) {
    for (let b = a + 1; b < DIRS.length; b++) {
      comparisons.push(compareRows(rows.get(DIRS[a]), rows.get(DIRS[b])));
    }
  }
  for (const comparison of comparisons) {
    const semanticEvidence = semanticHalfCycleProjection(comparison, semanticRows);
    if (semanticEvidence) comparison.suppressed = semanticEvidence;
  }

  // One cross-view comparison can be perspective noise. Left/right are also
  // usually mirrored peers, so up->left and up->right do not count as two
  // independent perspectives. A cross-view finding needs agreement from two
  // of front/rear/side. The same-perspective left/right pair is independently
  // strong enough to fail when its mirrored cadence has a decisive offset.
  const viewGroup = (dir) => (dir === 'left' || dir === 'right' ? 'side' : dir);
  const support = new Map(DIRS.map((dir) => [dir, new Map()]));
  for (const item of comparisons.filter((comparison) => comparison.decisive && !comparison.suppressed)) {
    const candidateOffsets = support.get(item.candidate);
    if (!candidateOffsets.has(item.bestShift)) {
      candidateOffsets.set(item.bestShift, { evidence: [], otherViews: new Set() });
    }
    candidateOffsets.get(item.bestShift).evidence.push(item);
    candidateOffsets.get(item.bestShift).otherViews.add(viewGroup(item.reference));

    const referenceOffsets = support.get(item.reference);
    const inverse = (FRAMES - item.bestShift) % FRAMES;
    if (!referenceOffsets.has(inverse)) {
      referenceOffsets.set(inverse, { evidence: [], otherViews: new Set() });
    }
    referenceOffsets.get(inverse).evidence.push(item);
    referenceOffsets.get(inverse).otherViews.add(viewGroup(item.candidate));
  }

  const findings = [];
  const sidePair = comparisons.find((item) => item.reference === 'left' && item.candidate === 'right');
  const sideChronology = exactSideChronology(rows.get('left'), rows.get('right'));
  const sideSignalChronology = reversedSideChronology(rows.get('left'), rows.get('right'));
  if (sideChronology.reversedChronology || sideSignalChronology.reversedChronology) {
    const evidence = sideChronology.reversedChronology ? sideChronology : sideSignalChronology;
    findings.push({
      kind: 'reversed-chronology',
      dir: 'left↔right',
      shift: sideChronology.reversedChronology
        ? sideChronology.reversedShifts[0]
        : sideSignalChronology.reversed.bestShift,
      support: 1,
      supportingViews: ['side'],
      evidence: [evidence],
    });
  }
  if (sidePair?.decisive) {
    findings.push({
      kind: 'cyclic-offset',
      dir: 'left↔right',
      shift: sidePair.bestShift,
      support: 1,
      supportingViews: ['side'],
      evidence: [sidePair],
    });
  }

  for (const dir of DIRS) {
    const offsets = [...support.get(dir).entries()]
      .filter(([shift]) => shift !== 0)
      .sort((a, b) => b[1].otherViews.size - a[1].otherViews.size || a[0] - b[0]);
    const [best] = offsets;
    if (!best || best[1].otherViews.size < MIN_VIEW_SUPPORT) continue;
    const [shift, detail] = best;
    findings.push({
      kind: 'cyclic-offset',
      dir,
      shift,
      support: detail.otherViews.size,
      supportingViews: [...detail.otherViews].sort(),
      evidence: detail.evidence,
    });
  }
  return { comparisons, sideChronology, findings };
}

await mkdir(dirname(REPORT_PATH), { recursive: true });

const sheets = {};
for (const role of ROLES) {
  sheets[role] = `data:image/png;base64,${(await readFile(join(ACTOR_DIR, `${role}.png`))).toString('base64')}`;
}

const browser = await chromium.launch({ headless: true });
let rows;
try {
  const page = await browser.newPage();
  rows = await page.evaluate(async ({
    sheets: encodedSheets,
    roles,
    actions,
    dirs,
    frameW,
    frameH,
    frames,
  }) => {
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    function alphaDistance(a, b, yStart = 0, yEnd = frameH) {
      let difference = 0;
      let union = 0;
      for (let y = yStart; y < yEnd; y++) {
        for (let x = 0; x < frameW; x++) {
          const index = y * frameW + x;
          difference += Math.abs(a[index] - b[index]);
          union += Math.max(a[index], b[index]);
        }
      }
      return difference / Math.max(1, union);
    }

    function analyzeRow(frameData) {
      const transition = [];
      const lowerTransition = [];
      const upperTransition = [];
      const twoStepTransition = [];
      const novelty = [];
      for (let frame = 0; frame < frames; frame++) {
        transition.push(alphaDistance(frameData[frame].alpha, frameData[(frame + 1) % frames].alpha));
        lowerTransition.push(alphaDistance(
          frameData[frame].alpha,
          frameData[(frame + 1) % frames].alpha,
          50,
          frameH,
        ));
        upperTransition.push(alphaDistance(
          frameData[frame].alpha,
          frameData[(frame + 1) % frames].alpha,
          0,
          55,
        ));
        twoStepTransition.push(alphaDistance(frameData[frame].alpha, frameData[(frame + 2) % frames].alpha));
        novelty.push(mean(frameData.map((other) => alphaDistance(frameData[frame].alpha, other.alpha))));
      }
      return {
        transition,
        lowerTransition,
        upperTransition,
        twoStepTransition,
        novelty,
        alphaMass: frameData.map((frame) => frame.alphaMass),
        lowerMass: frameData.map((frame) => frame.lowerMass),
        width: frameData.map((frame) => frame.width),
        height: frameData.map((frame) => frame.height),
        lowerSpread: frameData.map((frame) => frame.lowerSpread),
      };
    }

    function alphaSignature(alpha, mirrored = false) {
      let first = 0x811c9dc5;
      let second = 0x9e3779b9;
      let mass = 0;
      let visible = 0;
      let minX = frameW;
      let minY = frameH;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < frameH; y++) {
        for (let x = 0; x < frameW; x++) {
          const sourceX = mirrored ? frameW - 1 - x : x;
          const value = alpha[y * frameW + sourceX];
          if (value <= 18) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < minX || maxY < minY) return 'blank';
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const sourceX = mirrored ? frameW - 1 - x : x;
          const value = alpha[y * frameW + sourceX];
          first = Math.imul(first ^ value, 0x01000193) >>> 0;
          second = Math.imul(
            second ^ ((value + (x - minX) * 17 + (y - minY) * 31) >>> 0),
            0x85ebca6b,
          ) >>> 0;
          mass += value;
          if (value > 18) visible++;
        }
      }
      return [
        first.toString(16).padStart(8, '0'),
        second.toString(16).padStart(8, '0'),
        maxX - minX + 1,
        maxY - minY + 1,
        mass,
        visible,
      ].join(':');
    }

    function mean(values) {
      return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    }

    const out = [];
    for (const role of roles) {
      const image = await loadImage(encodedSheets[role]);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
        for (let dirIndex = 0; dirIndex < dirs.length; dirIndex++) {
          const rowIndex = actionIndex * dirs.length + dirIndex;
          const frameData = [];
          for (let frame = 0; frame < frames; frame++) {
            const pixels = context.getImageData(
              frame * frameW,
              rowIndex * frameH,
              frameW,
              frameH,
            ).data;
            const alpha = new Uint8Array(frameW * frameH);
            let alphaMass = 0;
            let lowerMass = 0;
            let minX = frameW;
            let minY = frameH;
            let maxX = -1;
            let maxY = -1;
            let lowerSum = 0;
            let lowerSumX = 0;
            let lowerSumX2 = 0;
            for (let y = 0; y < frameH; y++) {
              for (let x = 0; x < frameW; x++) {
                const value = pixels[(y * frameW + x) * 4 + 3];
                alpha[y * frameW + x] = value;
                if (value <= 18) continue;
                const weight = value / 255;
                alphaMass += weight;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                if (y >= 50) {
                  lowerMass += weight;
                  lowerSum += weight;
                  lowerSumX += x * weight;
                  lowerSumX2 += x * x * weight;
                }
              }
            }
            const lowerMeanX = lowerSum ? lowerSumX / lowerSum : frameW / 2;
            frameData.push({
              alpha,
              alphaMass,
              lowerMass,
              width: maxX >= minX ? maxX - minX + 1 : 0,
              height: maxY >= minY ? maxY - minY + 1 : 0,
              lowerSpread: lowerSum
                ? Math.sqrt(Math.max(0, lowerSumX2 / lowerSum - lowerMeanX ** 2))
                : 0,
            });
          }
          out.push({
            role,
            action: actions[actionIndex],
            dir: dirs[dirIndex],
            rowIndex,
            signals: analyzeRow(frameData),
            alphaFrameSignatures: frameData.map((frame) => alphaSignature(frame.alpha)),
            mirroredAlphaFrameSignatures: frameData.map(
              (frame) => alphaSignature(frame.alpha, true),
            ),
          });
        }
      }
    }
    return out;
  }, {
    sheets,
    roles: ROLES,
    actions: ACTIONS,
    dirs: DIRS,
    frameW: FRAME_W,
    frameH: FRAME_H,
    frames: FRAMES,
  });
} finally {
  await browser.close();
}

const rowByKey = new Map(rows.map((row) => [`${row.role}/${row.action}/${row.dir}`, row]));
const productionSemantics = await loadProductionSemantics();

// Mutation proof: rotate each direction of one coherent, accepted painted
// family in memory. The detector must reject all four forms of that exact
// failure before it is trusted on the repository. No PNG or atlas is changed.
const selfTestSource = 'guard/work';
const selfTestShift = 2;
const selfTestRows = new Map(DIRS.map((dir) => [
  dir,
  rowByKey.get(`${selfTestSource}/${dir}`),
]));
const selfTests = [];
for (const mutatedDir of DIRS) {
  const mutatedRows = new Map(selfTestRows);
  mutatedRows.set(mutatedDir, shiftedRow(mutatedRows.get(mutatedDir), selfTestShift));
  const result = auditFamily(mutatedRows);
  const detected = result.findings.some((finding) => (
    finding.dir === mutatedDir
    || (finding.dir === 'left↔right' && (mutatedDir === 'left' || mutatedDir === 'right'))
  ));
  selfTests.push({ mutatedDir, shift: selfTestShift, detected, findings: result.findings });
  if (!detected) {
    throw new Error(
      `direction-phase self-test failed: ${selfTestSource}/${mutatedDir} `
      + `cyclic shift ${selfTestShift} was not rejected`,
    );
  }
}

// A cyclic-only detector misses the common failure where an entire mirrored
// 512px strip is flipped, which also reverses its eight cell positions. The
// exact side-pair mutation proves that full reverse chronology is rejected.
const reversalSelfTestSource = 'builder/work';
const reversalSelfTestRows = new Map(DIRS.map((dir) => [
  dir,
  rowByKey.get(`${reversalSelfTestSource}/${dir}`),
]));
reversalSelfTestRows.set(
  'right',
  reversedChronologyRow(reversalSelfTestRows.get('right')),
);
const reversalSelfTestResult = auditFamily(reversalSelfTestRows);
const reversalSelfTestDetected = reversalSelfTestResult.findings.some(
  (finding) => finding.kind === 'reversed-chronology',
);
if (!reversalSelfTestDetected) {
  throw new Error(
    `direction-phase self-test failed: ${reversalSelfTestSource}/right `
    + 'full frame-order reversal was not rejected',
  );
}

const families = [];
const failures = [];
for (const role of ROLES) {
  for (const action of ACTIONS) {
    const familyRows = new Map(DIRS.map((dir) => [
      dir,
      rowByKey.get(`${role}/${action}/${dir}`),
    ]));
    const familySemantics = new Map(DIRS.map((dir) => [
      dir,
      productionSemantics.get(`${role}/${action}/${dir}`),
    ]).filter(([, semantic]) => semantic));
    const result = auditFamily(familyRows, familySemantics);
    families.push({ role, action, ...result });
    for (const finding of result.findings) failures.push({ role, action, ...finding });
  }
}

await writeFile(REPORT_PATH, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  contract: {
    frameCount: FRAMES,
    directions: DIRS,
    minChannels: MIN_CHANNELS,
    minImprovement: MIN_IMPROVEMENT,
    minCostDrop: MIN_COST_DROP,
    maxAlignedCost: MAX_ALIGNED_COST,
    minViewSupport: MIN_VIEW_SUPPORT,
  },
  selfTest: {
    source: selfTestSource,
    mutation: `each direction independently shifted ${selfTestShift} frames`,
    results: selfTests,
    reversedChronology: {
      source: reversalSelfTestSource,
      mutation: 'right direction frame order reversed 7..0',
      detected: reversalSelfTestDetected,
      findings: reversalSelfTestResult.findings,
    },
  },
  failures,
  families,
}, null, 2)}\n`);

console.log(
  `[direction-phase] self-test OK — deliberate ${selfTestSource} +${selfTestShift} mutations `
  + `rejected independently for ${DIRS.join('/')}`,
);
console.log(
  `[direction-phase] self-test OK — deliberate ${reversalSelfTestSource}/right `
  + 'full frame-order reversal rejected',
);
console.log(
  `[direction-phase] audited ${ROLES.length * ACTIONS.length} actor families / `
  + `${ROLES.length * ACTIONS.length * DIRS.length} rows`,
);
for (const failure of failures) {
  if (failure.kind === 'reversed-chronology') {
    console.log(
      `[direction-phase] GATE FAILURE: ${failure.role}/${failure.action}/${failure.dir} `
      + `stores mirrored side frames in reverse chronology `
      + `(reversed shift ${failure.shift}); runtime frame N is not the same beat`,
    );
    continue;
  }
  const example = failure.evidence[0];
  const frame = example.frameEvidence;
  console.log(
    `[direction-phase] GATE FAILURE: ${failure.role}/${failure.action}/${failure.dir} `
    + `has a supported ${failure.shift}-frame offset `
    + `(${failure.supportingViews.join('+')} evidence); `
    + `${example.reference}->${example.candidate} runtime frame ${frame.candidateRuntimeFrame} `
    + `aligns with frame ${frame.candidateMatchedFrame} `
    + `(cost ${frame.zeroCost}->${frame.alignedCost}, channels ${example.channels.join(',')})`,
  );
}
console.log('[direction-phase] wrote scripts/screenshots/sprite-direction-phase-report.json');

if (failures.length) {
  console.error(
    `[direction-phase] FAILED — ${failures.length} cross-direction phase finding(s); `
    + 'there is no release waiver path',
  );
  process.exit(1);
}
console.log('[direction-phase] OK — every decisive cross-direction comparison keeps runtime frame N in phase');
