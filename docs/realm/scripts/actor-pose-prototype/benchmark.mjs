// Machine-specific Canvas2D output experiment for RFC 0002.
//
// This does not exercise the live Realm renderer or establish a release gate.
// It isolates one flattened actor draw from synchronized rear/body/front draws
// using the exact Candidate A prototype rows. Each output mode runs in its own
// fresh Chromium process, context, and minimal same-origin page.

import { chromium } from '@playwright/test';
import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureServer } from '../_serve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const PROTOTYPE = join(ROOT, 'assets', 'sprites', 'prototypes', 'actor-pose');
const CANDIDATE = join(PROTOTYPE, 'output', 'a-layered2d');
const REPORT_DIR = join(PROTOTYPE, 'reports');
const JSON_OUT = join(REPORT_DIR, 'runtime-profile.json');
const MD_OUT = join(REPORT_DIR, 'runtime-profile.md');
const TARGETS = [
  ['guard', 'walk'],
  ['guard', 'carry'],
  ['builder', 'walk'],
  ['builder', 'work'],
];
const DIRECTIONS = ['down', 'up', 'left', 'right'];
const LAYERS = ['rear', 'body', 'front'];
const ACTOR_COUNTS = [100, 250];
const WARMUP_FRAMES = 80;
const SAMPLES_PER_SCENARIO = 300;
const FRAMES_PER_SAMPLE = 10;
const COMPLETION_INTERVAL = 30;
const CANVAS_SIZE = [1280, 720];
const FRAME_SIZE = [64, 84];

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(
    ordered.length - 1,
    Math.floor((ordered.length - 1) * fraction),
  )];
}

function summarize(values) {
  return {
    samples: values.length,
    minMs: Math.min(...values),
    medianMs: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: Math.max(...values),
    meanMs: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

function delta(before, after, field) {
  return before[field] != null && after[field] != null
    ? after[field] - before[field]
    : null;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function rowRelative(role, action, direction) {
  return join('rows', role, action, `${direction}.png`);
}

function layerRelative(layer, role, action, direction) {
  return join('layers', layer, role, `${action}-${direction}.png`);
}

async function encodedBytes(files) {
  let total = 0;
  for (const file of files) total += (await stat(join(CANDIDATE, file))).size;
  return total;
}

const flattenedFiles = [];
const layerFiles = [];
for (const [role, action] of TARGETS) {
  for (const direction of DIRECTIONS) {
    flattenedFiles.push(rowRelative(role, action, direction));
    for (const layer of LAYERS) {
      layerFiles.push(layerRelative(layer, role, action, direction));
    }
  }
}

const MODE_CONFIGS = [
  {
    mode: 'flattened',
    files: flattenedFiles,
    drawsPerActor: 1,
  },
  {
    mode: 'layered',
    files: layerFiles,
    drawsPerActor: 3,
  },
];

for (const config of MODE_CONFIGS) {
  const missing = [];
  for (const file of config.files) {
    if (!await exists(join(CANDIDATE, file))) missing.push(file);
  }
  if (missing.length) {
    throw new Error(
      `Candidate A ${config.mode} assets are incomplete: ${missing.join(', ')}`,
    );
  }
}

async function profileMode(config, baseUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
    ],
  });
  const browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];
  const profileUrl = `${baseUrl}__actor-pose-profile-${config.mode}.html`;

  page.on('pageerror', error => {
    errors.push({ type: 'pageerror', message: error.message });
  });
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push({ type: 'console', message: message.text() });
    }
  });
  page.on('requestfailed', request => {
    errors.push({
      type: 'requestfailed',
      message: request.failure()?.errorText ?? 'request failed',
      url: request.url(),
    });
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      errors.push({
        type: 'http',
        message: `HTTP ${response.status()}`,
        url: response.url(),
      });
    }
  });
  page.on('crash', () => {
    errors.push({ type: 'crash', message: 'Chromium page crashed' });
  });

  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');

  async function memorySnapshot(label) {
    await cdp.send('HeapProfiler.collectGarbage');
    const [metrics, counters] = await Promise.all([
      cdp.send('Performance.getMetrics'),
      cdp.send('Memory.getDOMCounters'),
    ]);
    const values = Object.fromEntries(
      metrics.metrics.map(metric => [metric.name, metric.value]),
    );
    return {
      label,
      forcedGc: true,
      jsHeapUsedBytes: values.JSHeapUsedSize ?? null,
      jsHeapTotalBytes: values.JSHeapTotalSize ?? null,
      documents: counters.documents ?? values.Documents ?? null,
      domNodes: counters.nodes ?? values.Nodes ?? null,
      listeners: counters.jsEventListeners ?? values.JSEventListeners ?? null,
    };
  }

  try {
    await page.route(profileUrl, route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: (
        '<!doctype html><html><head><meta charset="utf-8">' +
        '<title>Actor pose output profile</title></head>' +
        '<body><main id="profile-root"></main></body></html>'
      ),
    }));
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    const before = await memorySnapshot('before-mode-assets');
    const urls = config.files.map((file, index) => (
      `${baseUrl}assets/sprites/prototypes/actor-pose/output/` +
      `a-layered2d/${file}?profile=${config.mode}-${index}`
    ));
    const browserResult = await page.evaluate(async ({
      mode,
      imageUrls,
      counts,
      warmupFrames,
      samplesPerScenario,
      framesPerSample,
      completionInterval,
      canvasSize,
      frameSize,
    }) => {
      const images = await Promise.all(imageUrls.map(async url => {
        const image = new Image();
        image.decoding = 'async';
        image.src = url;
        await image.decode();
        if (image.naturalWidth !== frameSize[0] * 8 ||
            image.naturalHeight !== frameSize[1]) {
          throw new Error(
            `Unexpected row dimensions for ${url}: ` +
            `${image.naturalWidth}x${image.naturalHeight}`,
          );
        }
        return image;
      }));
      const canvas = document.createElement('canvas');
      canvas.width = canvasSize[0];
      canvas.height = canvasSize[1];
      canvas.setAttribute('aria-label', `${mode} benchmark surface`);
      document.querySelector('#profile-root').append(canvas);
      const context2d = canvas.getContext('2d', { alpha: true });
      if (!context2d) throw new Error('Canvas2D is unavailable');
      context2d.imageSmoothingEnabled = false;

      const makeActors = count => Array.from({ length: count }, (_, index) => ({
        x: (index * 83 + Math.floor(index / 13) * 17) %
          (canvas.width - frameSize[0]),
        y: (index * 47 + Math.floor(index / 17) * 31) %
          (canvas.height - frameSize[1]),
        row: index % 16,
        phase: (index * 3) % 8,
      }));

      const drawFrame = (actors, tick) => {
        context2d.clearRect(0, 0, canvas.width, canvas.height);
        for (const actor of actors) {
          const frame = (actor.phase + tick) % 8;
          const sourceX = frame * frameSize[0];
          if (mode === 'flattened') {
            context2d.drawImage(
              images[actor.row],
              sourceX, 0, frameSize[0], frameSize[1],
              actor.x, actor.y, frameSize[0], frameSize[1],
            );
          } else {
            for (let layer = 0; layer < 3; layer++) {
              context2d.drawImage(
                images[actor.row * 3 + layer],
                sourceX, 0, frameSize[0], frameSize[1],
                actor.x, actor.y, frameSize[0], frameSize[1],
              );
            }
          }
        }
      };

      // createImageBitmap snapshots the complete surface and gives us a
      // bounded async completion point without putting the copy in the timed
      // draw-command interval. It is a queue-drain probe, not a gameplay cost.
      const forceCompletion = async () => {
        const started = performance.now();
        const bitmap = await createImageBitmap(canvas);
        bitmap.close();
        return performance.now() - started;
      };

      const scenarios = [];
      for (const count of counts) {
        const actors = makeActors(count);
        for (let warmup = 0; warmup < warmupFrames; warmup++) {
          drawFrame(actors, warmup);
        }
        await forceCompletion();

        const durations = [];
        const completionDurations = [];
        for (let sample = 0; sample < samplesPerScenario; sample++) {
          const started = performance.now();
          for (let frame = 0; frame < framesPerSample; frame++) {
            drawFrame(actors, sample * framesPerSample + frame);
          }
          durations.push((performance.now() - started) / framesPerSample);
          if ((sample + 1) % completionInterval === 0) {
            completionDurations.push(await forceCompletion());
          }
        }
        scenarios.push({
          actors: count,
          durations,
          completionDurations,
        });
      }

      // Retain exactly this mode's decoded images and drawing surface until the
      // post-profile forced-GC snapshot has been taken.
      window.__realmActorPoseProfile = { images, canvas, context2d };
      return {
        decodedBytes: images.reduce(
          (sum, image) => (
            sum + image.naturalWidth * image.naturalHeight * 4
          ),
          0,
        ),
        decodedImages: images.length,
        scenarios,
      };
    }, {
      mode: config.mode,
      imageUrls: urls,
      counts: ACTOR_COUNTS,
      warmupFrames: WARMUP_FRAMES,
      samplesPerScenario: SAMPLES_PER_SCENARIO,
      framesPerSample: FRAMES_PER_SAMPLE,
      completionInterval: COMPLETION_INTERVAL,
      canvasSize: CANVAS_SIZE,
      frameSize: FRAME_SIZE,
    });
    const after = await memorySnapshot('after-mode-profile');

    return {
      mode: config.mode,
      isolation: {
        freshBrowserProcess: true,
        freshBrowserContext: true,
        freshMinimalPage: true,
        loadedOutputModes: [config.mode],
      },
      browserVersion,
      encoded: {
        bytes: await encodedBytes(config.files),
        files: config.files.length,
      },
      decoded: {
        bytes: browserResult.decodedBytes,
        images: browserResult.decodedImages,
        estimate: 'naturalWidth * naturalHeight * 4 RGBA bytes',
      },
      memory: {
        before,
        after,
        delta: {
          jsHeapUsedBytes: delta(before, after, 'jsHeapUsedBytes'),
          jsHeapTotalBytes: delta(before, after, 'jsHeapTotalBytes'),
          documents: delta(before, after, 'documents'),
          domNodes: delta(before, after, 'domNodes'),
          listeners: delta(before, after, 'listeners'),
        },
        caveat: (
          'Forced-GC JS heap excludes browser-managed decoded texture and ' +
          'graphics memory; decoded RGBA bytes are reported separately.'
        ),
      },
      scenarios: browserResult.scenarios.map(scenario => ({
        actors: scenario.actors,
        drawsPerActor: config.drawsPerActor,
        drawsPerFrame: scenario.actors * config.drawsPerActor,
        commandSubmissionTiming: summarize(scenario.durations),
        completionDrainTiming: summarize(scenario.completionDurations),
      })),
      browserErrors: errors,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

const server = await ensureServer();
try {
  if (server.mode !== 'http') {
    throw new Error(
      'The isolated runtime profile requires a local HTTP server, not file mode.',
    );
  }
  const baseUrl = server.gameUrl.replace(/index\.html.*$/, '');
  const profiles = [];
  for (const config of MODE_CONFIGS) {
    profiles.push(await profileMode(config, baseUrl));
  }

  const profileByMode = Object.fromEntries(
    profiles.map(profile => [profile.mode, profile]),
  );
  const safeRatio = (numerator, denominator) => (
    Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
      ? numerator / denominator
      : null
  );
  const comparisons = ACTOR_COUNTS.map(actors => {
    const flattened = profileByMode.flattened.scenarios.find(
      scenario => scenario.actors === actors,
    );
    const layered = profileByMode.layered.scenarios.find(
      scenario => scenario.actors === actors,
    );
    return {
      actors,
      layeredToFlattenedMedianCommandRatio: safeRatio(
        layered.commandSubmissionTiming.medianMs,
        flattened.commandSubmissionTiming.medianMs,
      ),
      layeredToFlattenedP95CommandRatio: safeRatio(
        layered.commandSubmissionTiming.p95Ms,
        flattened.commandSubmissionTiming.p95Ms,
      ),
      layeredToFlattenedMeanCommandRatio: safeRatio(
        layered.commandSubmissionTiming.meanMs,
        flattened.commandSubmissionTiming.meanMs,
      ),
    };
  });
  const allErrors = profiles.flatMap(profile => (
    profile.browserErrors.map(error => ({ mode: profile.mode, ...error }))
  ));
  const report = {
    schema: 'realm.actor-pose-prototype.runtime-profile/v2',
    candidate: 'a-layered2d',
    machine: {
      platform: platform(),
      release: release(),
      cpu: cpus()[0]?.model ?? 'unknown',
      logicalCpus: cpus().length,
      chromium: profiles[0]?.browserVersion ?? 'unknown',
    },
    workload: {
      viewport: CANVAS_SIZE,
      frameSize: FRAME_SIZE,
      warmupFrames: WARMUP_FRAMES,
      samplesPerScenario: SAMPLES_PER_SCENARIO,
      framesPerTimingSample: FRAMES_PER_SAMPLE,
      timedFramesPerScenario: SAMPLES_PER_SCENARIO * FRAMES_PER_SAMPLE,
      actorCounts: ACTOR_COUNTS,
      completionDrain: {
        method: 'createImageBitmap(full canvas), then close ImageBitmap',
        everySamples: COMPLETION_INTERVAL,
        includedInCommandSubmissionTiming: false,
        note: (
          'This bounds deferred canvas work between sample groups. The async ' +
          'surface snapshot is reported separately because including its copy ' +
          'would distort the game-like draw-command comparison.'
        ),
      },
    },
    profiles,
    comparisons,
    validation: {
      passed: (
        allErrors.length === 0 &&
        profiles.every(profile => (
          profile.scenarios.length === ACTOR_COUNTS.length &&
          profile.scenarios.every(scenario => (
            scenario.commandSubmissionTiming.samples === SAMPLES_PER_SCENARIO &&
            scenario.completionDrainTiming.samples ===
              SAMPLES_PER_SCENARIO / COMPLETION_INTERVAL
          ))
        ))
      ),
      browserErrors: allErrors,
    },
    caveats: [
      (
        'This is a machine-specific isolated Canvas2D microprofile of ' +
        'draw-loop command/raster workload, not the full Realm renderer.'
      ),
      (
        'It excludes Realm simulation, culling, sorting, camera work, atlas ' +
        'selection, effects, compositing, UI, and browser presentation.'
      ),
      (
        'The flattened asset count represents only the tested fixed rows; it ' +
        'does not include the storage or build cost of combinatorial flattened ' +
        'identity, garment, equipment, and action variants.'
      ),
      (
        'Fresh browser processes make per-mode page heap deltas attributable, ' +
        'but process caches, GPU memory, and decoded textures remain outside ' +
        'the forced-GC JS heap metric.'
      ),
    ],
  };

  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);

  const timingRows = profiles.flatMap(profile => (
    profile.scenarios.map(scenario => (
      `| ${profile.mode} | ${scenario.actors} | ${scenario.drawsPerFrame} | ` +
      `${scenario.commandSubmissionTiming.medianMs.toFixed(3)} | ` +
      `${scenario.commandSubmissionTiming.p95Ms.toFixed(3)} | ` +
      `${scenario.completionDrainTiming.medianMs.toFixed(3)} |`
    ))
  ));
  const assetRows = profiles.map(profile => (
    `| ${profile.mode} | ${profile.encoded.files} | ` +
    `${profile.encoded.bytes} | ${profile.decoded.images} | ` +
    `${profile.decoded.bytes} |`
  ));
  const memoryRows = profiles.map(profile => (
    `| ${profile.mode} | ${profile.memory.before.jsHeapUsedBytes} | ` +
    `${profile.memory.after.jsHeapUsedBytes} | ` +
    `${profile.memory.delta.jsHeapUsedBytes} | ` +
    `${profile.memory.delta.domNodes} | ${profile.memory.delta.listeners} |`
  ));
  const comparisonRows = comparisons.map(comparison => (
    `| ${comparison.actors} | ` +
    `${comparison.layeredToFlattenedMedianCommandRatio?.toFixed(2) ?? 'n/a'}x | ` +
    `${comparison.layeredToFlattenedP95CommandRatio?.toFixed(2) ?? 'n/a'}x | ` +
    `${comparison.layeredToFlattenedMeanCommandRatio?.toFixed(2) ?? 'n/a'}x |`
  ));
  const errorLines = allErrors.length
    ? allErrors.map(error => (
      `- ${error.mode} ${error.type}: ${error.message}` +
      `${error.url ? ` (${error.url})` : ''}`
    ))
    : ['- None.'];
  const markdown = [
    '# Actor Pose Runtime Output Profile',
    '',
    `Machine: ${report.machine.cpu}, ${report.machine.platform} ` +
      `${report.machine.release}; Chromium ${report.machine.chromium}.`,
    '',
    'Each output mode ran in a fresh Chromium process, fresh browser context, ' +
      'and minimal same-origin page that loaded only that mode’s assets.',
    '',
    '## Draw workload',
    '',
    '| Output | Actors | Draws/frame | Median submit ms | p95 submit ms | Median drain ms |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...timingRows,
    '',
    '| Actors | Layered/flat median | Layered/flat p95 | Layered/flat mean |',
    '| ---: | ---: | ---: | ---: |',
    ...comparisonRows,
    '',
    `Each timing sample draws ${FRAMES_PER_SAMPLE} frames and is normalized to ` +
      'per-frame cost, reducing sub-millisecond timer quantization. The timed ' +
      'interval covers `clearRect` plus `drawImage` command submission. ' +
      `Every ${COMPLETION_INTERVAL} samples, a full-canvas ` +
      '`createImageBitmap` snapshot is awaited and closed outside the timed ' +
      'interval. Its duration is reported as “drain”; this bounds deferred ' +
      'work without pretending the snapshot copy is a normal Realm frame cost. ' +
      'The browser still controls exact GPU scheduling.',
    '',
    '## Asset footprint',
    '',
    '| Output | Encoded files | Encoded bytes | Decoded images | Estimated RGBA bytes |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...assetRows,
    '',
    '## Forced-GC page memory',
    '',
    '| Output | Heap before | Heap after | Heap delta | DOM-node delta | Listener delta |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...memoryRows,
    '',
    'The forced-GC heap delta is attributable to that isolated mode’s retained ' +
      'page objects, but it does not include browser-managed decoded textures ' +
      'or GPU memory. The RGBA estimate above reports decoded image footprint ' +
      'separately.',
    '',
    '## Browser errors',
    '',
    ...errorLines,
    '',
    '## Interpretation limits',
    '',
    ...report.caveats.map(caveat => `- ${caveat}`),
    '',
    `Validation: ${report.validation.passed ? 'PASS' : 'FAIL'}.`,
    '',
  ].join('\n');
  await writeFile(MD_OUT, markdown);
  console.log(`[actor-pose:profile] wrote ${relative(ROOT, JSON_OUT)}`);
  console.log(`[actor-pose:profile] wrote ${relative(ROOT, MD_OUT)}`);
  if (!report.validation.passed) {
    throw new Error(
      `Runtime profile validation failed with ${allErrors.length} browser errors.`,
    );
  }
} finally {
  await server.stop();
}
