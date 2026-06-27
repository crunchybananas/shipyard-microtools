// Enforces the editable motion-sprite source contract.
//
// This guard exists because older workflow attempts edited or regenerated a
// single combined actor atlas. That is no longer allowed: source art must stay
// split by sprite type so imagegen and manual paint passes can target one role
// or prop at a time.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  ACTOR_ATLAS_H,
  ACTOR_ATLAS_W,
  ACTIONS,
  ACTOR_BASE_DIRNAME,
  ACTOR_COMPILED_DIRNAME,
  ACTOR_ROW_DIRNAME,
  ACTOR_ROW_MANIFEST,
  AMBIENT,
  AMBIENT_ATLAS_H,
  AMBIENT_ATLAS_W,
  AMBIENT_SHEET_H,
  AMBIENT_SHEET_W,
  DIRS,
  FRAME_H,
  ROLE_SHEET_H,
  ROLE_SHEET_W,
  ROLES,
} from './sprite-source-contract.mjs';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SPRITES_DIR = join(ROOT, 'assets', 'sprites');
const ACTOR_DIR = join(SPRITES_DIR, ACTOR_BASE_DIRNAME);
const ACTOR_COMPILED_DIR = join(SPRITES_DIR, ACTOR_COMPILED_DIRNAME);
const ACTOR_ROW_DIR = join(SPRITES_DIR, ACTOR_ROW_DIRNAME);
const ACTOR_ROW_MANIFEST_PATH = join(ACTOR_ROW_DIR, ACTOR_ROW_MANIFEST);
const AMBIENT_DIR = join(SPRITES_DIR, 'ambient');
const OUT_ACTORS = join(SPRITES_DIR, 'actors-atlas.png');
const OUT_AMBIENT = join(SPRITES_DIR, 'ambient-atlas.png');

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

async function assertDimensions(path, expectedW, expectedH) {
  const { w, h } = await dimensions(path);
  if (w !== expectedW || h !== expectedH) {
    throw new Error(`${relative(ROOT, path)} must be ${expectedW}x${expectedH}; got ${w}x${h}`);
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
  const entries = await readdir(SPRITES_DIR, { withFileTypes: true });
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

async function assertAcceptedRows() {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(ACTOR_ROW_MANIFEST_PATH, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  if (manifest.version !== 1 || !manifest.rows || typeof manifest.rows !== 'object') {
    throw new Error(`${relative(ROOT, ACTOR_ROW_MANIFEST_PATH)} must contain version 1 row metadata`);
  }
  const rowRoot = `${resolve(ACTOR_ROW_DIR)}${sep}`;
  let accepted = 0;
  for (const [key, item] of Object.entries(manifest.rows)) {
    if (!['accepted', 'accepted-with-waiver'].includes(item.status)) continue;
    const [role, action, dir, ...rest] = key.split('/');
    if (rest.length || !ROLES.includes(role) || !ACTIONS.includes(action) || !DIRS.includes(dir)) {
      throw new Error(`invalid accepted actor row key: ${key}`);
    }
    const path = resolve(ACTOR_ROW_DIR, item.file || '');
    if (!path.startsWith(rowRoot)) throw new Error(`${key} row file escapes assets/sprites/actor-rows/`);
    await assertDimensions(path, ROLE_SHEET_W, FRAME_H);
    const digest = createHash('sha256').update(await readFile(path)).digest('hex');
    if (digest !== item.sha256) throw new Error(`${key} row hash differs from the accepted manifest`);
    accepted++;
  }
  return accepted;
}

await assertExactPngSet(ACTOR_DIR, ROLES, 'assets/sprites/actors/');
await assertExactPngSet(ACTOR_COMPILED_DIR, ROLES, 'assets/sprites/actors-compiled/');
await assertExactPngSet(AMBIENT_DIR, AMBIENT, 'assets/sprites/ambient/');
await assertNoRetiredCombinedSources();

for (const role of ROLES) {
  await assertDimensions(join(ACTOR_DIR, `${role}.png`), ROLE_SHEET_W, ROLE_SHEET_H);
  await assertDimensions(join(ACTOR_COMPILED_DIR, `${role}.png`), ROLE_SHEET_W, ROLE_SHEET_H);
}
for (const key of AMBIENT) {
  await assertDimensions(join(AMBIENT_DIR, `${key}.png`), AMBIENT_SHEET_W, AMBIENT_SHEET_H);
}

await assertDimensions(OUT_ACTORS, ACTOR_ATLAS_W, ACTOR_ATLAS_H);
await assertDimensions(OUT_AMBIENT, AMBIENT_ATLAS_W, AMBIENT_ATLAS_H);
const acceptedRows = await assertAcceptedRows();

console.log(`[sprite-source-contract] actors: ${ROLES.length} base + compiled role sheets, ${ROLE_SHEET_W}x${ROLE_SHEET_H} each`);
console.log(`[sprite-source-contract] accepted row overrides: ${acceptedRows}`);
console.log(`[sprite-source-contract] ambient: ${AMBIENT.length} prop sprites, ${AMBIENT_SHEET_W}x${AMBIENT_SHEET_H} each`);
console.log('[sprite-source-contract] compiled atlases are present with expected dimensions');
