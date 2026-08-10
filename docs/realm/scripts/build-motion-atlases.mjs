// Compile editable PNG source sheets into the runtime actor and ambient atlases.
// This file intentionally does not paint actors. Edit files under
// assets/sprites/actors/ and assets/sprites/ambient/, then run this compiler.
//
// Actor atlas contract used by js/render.js:
//   row = role * actions * dirs + action * dirs + dir

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { normalizeActorRowManifest } from './actor-row-manifest.mjs';
import {
  CARGO_DIRECTIONS,
  CARGO_FRAMES,
  CARGO_RESOURCES,
  CARGO_RUNTIME_ATLASES,
} from '../js/cargo-source-contract.js?realm=192';
import {
  ACTIONS,
  ACTOR_BASE_DIRNAME,
  ACTOR_COMPILED_DIRNAME,
  ACTOR_ROW_DIRNAME,
  ACTOR_ROW_MANIFEST,
  ACTOR_ATLAS_H,
  ACTOR_ATLAS_W,
  ACTOR_RUNTIME_ATLASES,
  AMBIENT,
  AMBIENT_ATLAS_H,
  AMBIENT_ATLAS_W,
  AMBIENT_SHEET_H,
  AMBIENT_SHEET_W,
  DIRS,
  FRAME_H,
  FRAME_W,
  FRAMES,
  ROLE_SHEET_H,
  ROLE_SHEET_W,
  ROLES,
} from '../js/sprite-source-contract.js?realm=192';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SPRITES_DIR = join(ROOT, 'assets', 'sprites');
const ACTOR_DIR = join(SPRITES_DIR, ACTOR_BASE_DIRNAME);
const ACTOR_ROW_DIR = join(SPRITES_DIR, ACTOR_ROW_DIRNAME);
const ACTOR_COMPILED_DIR = join(SPRITES_DIR, ACTOR_COMPILED_DIRNAME);
const ACTOR_ROW_MANIFEST_PATH = join(ACTOR_ROW_DIR, ACTOR_ROW_MANIFEST);
const AMBIENT_DIR = join(ROOT, 'assets', 'sprites', 'ambient');
const OUT_ACTORS = join(ROOT, 'assets', 'sprites', 'actors-atlas.png');
const OUT_ACTOR_RUNTIME_MANIFEST = join(ROOT, 'assets', 'sprites', 'actors-runtime-atlases.json');
const OUT_CARGO_RUNTIME_MANIFEST = join(ROOT, 'assets', 'sprites', 'cargo-payloads-runtime-atlases.json');
const OUT_AMBIENT = join(ROOT, 'assets', 'sprites', 'ambient-atlas.png');
const OUT_PROOF = join(ROOT, 'scripts', 'screenshots', 'actors-compiled-proof.png');
const ACTOR_DOWNSAMPLE = Object.freeze({
  filter: 'Box',
  unsharp: '0x0.7+0.8+0.02',
  transparentRgb: '#000000',
});
const A6_CARGO_DIR = join(
  SPRITES_DIR,
  'prototypes',
  'actor-pose',
  'output',
  'a6-cargo-payloads',
);
const A6_CARGO_MANIFEST_PATH = join(A6_CARGO_DIR, 'manifest.json');

async function magick(args) {
  try {
    const { stdout, stderr } = await execFileAsync('magick', args, {
      cwd: ROOT,
      maxBuffer: 8 * 1024 * 1024,
    });
    return { stdout, stderr };
  } catch (err) {
    const detail = [err.stdout, err.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`magick ${args.join(' ')} failed${detail ? `:\n${detail}` : ''}`);
  }
}

async function dimensions(path) {
  const { stdout } = await magick(['identify', '-format', '%w %h', path]);
  const [w, h] = stdout.trim().split(/\s+/).map(Number);
  return { w, h };
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function assertDimensions(path, expectedW, expectedH) {
  const { w, h } = await dimensions(path);
  if (w !== expectedW || h !== expectedH) {
    throw new Error(`${path} must be ${expectedW}x${expectedH}; got ${w}x${h}`);
  }
}

async function assertExactPngSet(dir, expectedKeys, label) {
  const entries = await readdir(dir, { withFileTypes: true });
  const pngFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.png'))
    .map((entry) => entry.name)
    .sort();
  const expected = expectedKeys.map((key) => `${key}.png`).sort();
  const extras = pngFiles.filter((name) => !expected.includes(name));
  const missing = expected.filter((name) => !pngFiles.includes(name));
  if (extras.length || missing.length) {
    const parts = [];
    if (missing.length) parts.push(`missing ${missing.join(', ')}`);
    if (extras.length) parts.push(`unexpected ${extras.join(', ')}`);
    throw new Error(`${label} must contain exactly one PNG per declared sprite type: ${parts.join('; ')}`);
  }
}

async function assertNoRetiredCombinedSources() {
  const entries = await readdir(join(ROOT, 'assets', 'sprites'), { withFileTypes: true });
  const forbidden = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => [
      'actors.png',
      'actor-sheet.png',
      'actor-sprites.png',
      'ambient.png',
      'motion-atlas.png',
    ].includes(name));
  if (forbidden.length) {
    throw new Error(`retired combined source sheet(s) are not allowed in assets/sprites/: ${forbidden.join(', ')}`);
  }
}

async function loadRowOverrides() {
  let rawManifest;
  try {
    rawManifest = JSON.parse(await readFile(ACTOR_ROW_MANIFEST_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return new Map();
    throw err;
  }
  const manifest = normalizeActorRowManifest(
    rawManifest,
    relative(ROOT, ACTOR_ROW_MANIFEST_PATH),
  );

  const rowRoot = `${resolve(ACTOR_ROW_DIR)}${sep}`;
  const byRole = new Map(ROLES.map((role) => [role, []]));
  for (const [key, slots] of Object.entries(manifest.rows)) {
    const item = slots.production;
    if (!item) continue;
    const [role, action, dir, ...rest] = key.split('/');
    if (rest.length || !ROLES.includes(role) || !ACTIONS.includes(action) || !DIRS.includes(dir)) {
      throw new Error(`invalid accepted actor row key: ${key}`);
    }
    const path = resolve(ACTOR_ROW_DIR, item.file || '');
    if (!path.startsWith(rowRoot)) {
      throw new Error(`${key} row file must stay under ${relative(ROOT, ACTOR_ROW_DIR)}`);
    }
    await assertDimensions(path, ROLE_SHEET_W, FRAME_H);
    const digest = createHash('sha256').update(await readFile(path)).digest('hex');
    if (digest !== item.sha256) {
      throw new Error(`${key} row hash differs from ${relative(ROOT, ACTOR_ROW_MANIFEST_PATH)}; re-accept it intentionally`);
    }
    byRole.get(role).push({
      key,
      action,
      dir,
      path,
      row: ACTIONS.indexOf(action) * DIRS.length + DIRS.indexOf(dir),
    });
  }
  return byRole;
}

async function publishCargoRuntimeAtlases() {
  const manifest = JSON.parse(await readFile(A6_CARGO_MANIFEST_PATH, 'utf8'));
  if (manifest.schema !== 'realm.actor-pose.a6-cargo-payloads-manifest.v1') {
    throw new Error('A6 cargo manifest schema changed');
  }
  if (
    JSON.stringify(manifest.scope.resources) !== JSON.stringify(CARGO_RESOURCES)
    || JSON.stringify(manifest.scope.directions) !== JSON.stringify(CARGO_DIRECTIONS)
    || manifest.scope.framesPerRow !== CARGO_FRAMES
  ) {
    throw new Error('A6 cargo source and runtime contracts disagree');
  }

  const runtimeManifest = {
    schema: 'realm.cargo-runtime-atlases.v1',
    sourceManifest: relative(ROOT, A6_CARGO_MANIFEST_PATH),
    resources: CARGO_RESOURCES,
    directions: CARGO_DIRECTIONS,
    frames: CARGO_FRAMES,
    atlases: [],
  };
  for (const tier of CARGO_RUNTIME_ATLASES) {
    const record = manifest.atlases.find((item) => item.key === tier.key);
    if (
      !record
      || record.file !== tier.file
      || record.frameWidth !== tier.frameW
      || record.frameHeight !== tier.frameH
    ) {
      throw new Error(`A6 cargo ${tier.key} tier contract changed`);
    }
    const source = join(A6_CARGO_DIR, record.path);
    const expectedW = tier.frameW * CARGO_FRAMES;
    const expectedH = tier.frameH * CARGO_RESOURCES.length * CARGO_DIRECTIONS.length;
    await assertDimensions(source, expectedW, expectedH);
    if (await sha256(source) !== record.sha256) {
      throw new Error(`A6 cargo ${tier.key} atlas hash differs from its manifest`);
    }
    const destination = join(SPRITES_DIR, tier.file);
    await copyFile(source, destination);
    runtimeManifest.atlases.push({
      key: tier.key,
      file: tier.file,
      frameWidth: tier.frameW,
      frameHeight: tier.frameH,
      width: expectedW,
      height: expectedH,
      sha256: await sha256(destination),
    });
  }
  await writeFile(
    OUT_CARGO_RUNTIME_MANIFEST,
    `${JSON.stringify(runtimeManifest, null, 2)}\n`,
    'utf8',
  );
}

async function compileActorRole(role, overrides) {
  const source = join(ACTOR_DIR, `${role}.png`);
  const out = join(ACTOR_COMPILED_DIR, `${role}.png`);
  if (!overrides.length) {
    await copyFile(source, out);
    return;
  }
  const args = [source];
  for (const override of overrides.sort((a, b) => a.row - b.row)) {
    args.push(
      override.path,
      '-geometry',
      `+0+${override.row * FRAME_H}`,
      '-compose',
      'Copy',
      '-composite',
      '-compose',
      'Over',
    );
  }
  args.push('-strip', out);
  await magick(args);
}

async function buildRuntimeActorAtlas(tier, actorFiles, tempDir) {
  const out = join(SPRITES_DIR, tier.file);
  if (tier.frameW === FRAME_W && tier.frameH === FRAME_H) return out;

  // Resize each action/direction row independently. Resizing the combined
  // sheet could sample across transparent row boundaries and leak a
  // neighboring animation into the first/last pixels of a row. Box is a
  // deliberate no-negative-lobes area downsample: LanczosSharp produced
  // isolated chroma speckles around transparent edges at 27x35 and 35x46.
  // A bounded post-resize unsharp pass restores local contrast without
  // reviving those ringing lobes. Fully transparent RGB is normalized first
  // so discarded chroma-key color cannot bleed back into visible pixels.
  const resizedRoles = [];
  for (let index = 0; index < actorFiles.length; index++) {
    const resized = join(tempDir, `${ROLES[index]}-${tier.key}.png`);
    await magick([
      actorFiles[index],
      '-crop', `${ROLE_SHEET_W}x${FRAME_H}`,
      '+repage',
      '-background', ACTOR_DOWNSAMPLE.transparentRgb,
      '-alpha', 'background',
      '-filter', ACTOR_DOWNSAMPLE.filter,
      '-resize', `${tier.frameW * FRAMES}x${tier.frameH}!`,
      '-unsharp', ACTOR_DOWNSAMPLE.unsharp,
      '-append',
      '-strip',
      resized,
    ]);
    resizedRoles.push(resized);
  }
  await magick([...resizedRoles, '-append', '-strip', out]);
  await assertDimensions(
    out,
    tier.frameW * FRAMES,
    tier.frameH * DIRS.length * ACTIONS.length * ROLES.length,
  );
  return out;
}

const ambientFiles = AMBIENT.map((key) => join(AMBIENT_DIR, `${key}.png`));

await assertExactPngSet(ACTOR_DIR, ROLES, 'assets/sprites/actors/');
await assertExactPngSet(AMBIENT_DIR, AMBIENT, 'assets/sprites/ambient/');
await assertNoRetiredCombinedSources();
for (const role of ROLES) await assertDimensions(join(ACTOR_DIR, `${role}.png`), ROLE_SHEET_W, ROLE_SHEET_H);
for (const path of ambientFiles) await assertDimensions(path, AMBIENT_SHEET_W, AMBIENT_SHEET_H);

await mkdir(dirname(OUT_PROOF), { recursive: true });
await mkdir(ACTOR_COMPILED_DIR, { recursive: true });

const overridesByRole = await loadRowOverrides();
for (const role of ROLES) await compileActorRole(role, overridesByRole.get(role) || []);
await assertExactPngSet(ACTOR_COMPILED_DIR, ROLES, 'assets/sprites/actors-compiled/');
const actorFiles = ROLES.map((role) => join(ACTOR_COMPILED_DIR, `${role}.png`));
for (const path of actorFiles) await assertDimensions(path, ROLE_SHEET_W, ROLE_SHEET_H);

await magick([...actorFiles, '-append', '-strip', OUT_ACTORS]);
const runtimeTempDir = await mkdtemp(join(tmpdir(), 'realm-motion-atlases-'));
try {
  for (const tier of ACTOR_RUNTIME_ATLASES) {
    await buildRuntimeActorAtlas(tier, actorFiles, runtimeTempDir);
  }
} finally {
  await rm(runtimeTempDir, { recursive: true, force: true });
}
await magick([...ambientFiles, '+append', '-strip', OUT_AMBIENT]);
await publishCargoRuntimeAtlases();
await assertDimensions(OUT_ACTORS, ACTOR_ATLAS_W, ACTOR_ATLAS_H);
await assertDimensions(OUT_AMBIENT, AMBIENT_ATLAS_W, AMBIENT_ATLAS_H);

const runtimeAtlasManifest = {
  schema: 'realm.actor-runtime-atlases.v1',
  canonicalReviewUnit: {
    width: ROLE_SHEET_W,
    rowHeight: FRAME_H,
    frameWidth: FRAME_W,
    frames: FRAMES,
    actions: ACTIONS,
    directions: DIRS,
  },
  derivation: {
    compiler: 'scripts/build-motion-atlases.mjs',
    filter: ACTOR_DOWNSAMPLE.filter,
    unsharp: ACTOR_DOWNSAMPLE.unsharp,
    transparentRgb: ACTOR_DOWNSAMPLE.transparentRgb,
    negativeFilterLobes: false,
    rowsResizedIndependently: true,
    metadataStripped: true,
  },
  atlases: [],
};
for (const tier of ACTOR_RUNTIME_ATLASES) {
  const path = join(SPRITES_DIR, tier.file);
  runtimeAtlasManifest.atlases.push({
    key: tier.key,
    file: tier.file,
    frameWidth: tier.frameW,
    frameHeight: tier.frameH,
    width: tier.frameW * FRAMES,
    height: tier.frameH * DIRS.length * ACTIONS.length * ROLES.length,
    sha256: await sha256(path),
  });
}
await writeFile(
  OUT_ACTOR_RUNTIME_MANIFEST,
  `${JSON.stringify(runtimeAtlasManifest, null, 2)}\n`,
  'utf8',
);

const proofRows = [
  { role: 'settler', action: 'walk', dir: 'down' },
  { role: 'farmer', action: 'work', dir: 'right' },
  { role: 'lumber', action: 'work', dir: 'left' },
  { role: 'miner', action: 'carry', dir: 'right' },
  { role: 'trader', action: 'carry', dir: 'left' },
  { role: 'guard', action: 'walk', dir: 'up' },
  { role: 'forager', action: 'work', dir: 'right' },
];
const proofArgs = ['-size', '900x690', 'xc:#2a211a'];
for (let i = 0; i < proofRows.length; i++) {
  const item = proofRows[i];
  const actionIdx = ACTIONS.indexOf(item.action);
  const dirIdx = DIRS.indexOf(item.dir);
  const row = actionIdx * DIRS.length + dirIdx;
  proofArgs.push(
    '(',
    join(ACTOR_COMPILED_DIR, `${item.role}.png`),
    '-crop',
    `${ROLE_SHEET_W}x${FRAME_H}+0+${row * FRAME_H}`,
    '+repage',
    '-resize',
    '464x76',
    ')',
    '-geometry',
    `+220+${100 + i * 75}`,
    '-composite',
  );
}
proofArgs.push(
  '(',
  OUT_AMBIENT,
  '-resize',
  '256x64',
  ')',
  '-geometry',
  '+220+610',
  '-composite',
  '-strip',
  OUT_PROOF,
);
await magick(proofArgs);

console.log(`[motion-atlases] compiled ${ROLES.length} actor source sheets into ${OUT_ACTORS}`);
console.log(`[motion-atlases] compiled ${ACTOR_RUNTIME_ATLASES.length} deterministic actor runtime scale(s)`);
console.log(`[motion-atlases] wrote ${OUT_ACTOR_RUNTIME_MANIFEST}`);
console.log(`[motion-atlases] wrote ${OUT_CARGO_RUNTIME_MANIFEST}`);
console.log(`[motion-atlases] applied ${[...overridesByRole.values()].reduce((sum, rows) => sum + rows.length, 0)} accepted row override(s)`);
console.log(`[motion-atlases] compiled ${AMBIENT.length} ambient source sprites into ${OUT_AMBIENT}`);
console.log(`[motion-atlases] wrote ${OUT_PROOF}`);
