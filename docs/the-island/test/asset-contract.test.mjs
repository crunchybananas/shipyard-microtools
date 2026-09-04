import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = join(ROOT, 'assets');
const manifestSource = readFileSync(join(ROOT, 'js/assets.js'), 'utf8');
const assetContract = readFileSync(join(ROOT, 'ASSETS.md'), 'utf8');
const styleSource = readFileSync(join(ROOT, 'style.css'), 'utf8');

const manifestBody = manifestSource.match(/export const MANIFEST = \{([\s\S]*?)\n\};/)?.[1];
assert.ok(manifestBody, 'assets.js must expose one statically auditable MANIFEST');

const manifestRows = [...manifestBody.matchAll(
  /^\s{2}([a-z0-9_]+):\s*\{\s*\n\s*kind:\s*'texture',\s*file:\s*'([^']+)',\s*bytes:\s*(\d+),/gm,
)].map(([, id, file, bytes]) => ({ id, file, bytes: Number(bytes) }));

function filesBelow(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesBelow(path) : [relative(ASSET_DIR, path)];
  });
}

function sourcesBelow(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesBelow(path);
    return entry.name.endsWith('.js') && entry.name !== 'assets.js'
      ? [readFileSync(path, 'utf8')]
      : [];
  });
}

const runtimeJs = sourcesBelow(join(ROOT, 'js'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
const cssAssets = [...styleSource.matchAll(/url\(\s*['"]?assets\/([^'"\)]+)['"]?\s*\)/g)]
  .map((match) => match[1]);

test('every WebGL manifest row is consumed and matches its file', () => {
  assert.equal(manifestRows.length, 12, 'update the documented WebGL texture count with deliberate additions');
  for (const { id, file, bytes } of manifestRows) {
    assert.match(runtimeJs, new RegExp(`['"]${id}['"]`), `${id} has no JavaScript consumer`);
    assert.equal(statSync(join(ASSET_DIR, file)).size, bytes, `${file} byte count is stale`);
  }
});

test('asset directory contains only WebGL-owned or CSS-owned files', () => {
  const webglFiles = manifestRows.map(({ file }) => file);
  assert.deepEqual([...new Set(cssAssets)].sort(), ['note_paper.jpg', 'sand.jpg']);
  assert.deepEqual(webglFiles.filter((file) => cssAssets.includes(file)), [], 'one file must not have two owners');
  assert.deepEqual(filesBelow(ASSET_DIR).sort(), [...webglFiles, ...cssAssets].sort());
});

test('CSS-native exceptions remain explicit and byte-accurate', () => {
  for (const file of cssAssets) {
    const bytes = statSync(join(ASSET_DIR, file)).size.toLocaleString('en-US');
    const row = assetContract.split('\n').find((line) => line.includes(`\`${file}\``));
    assert.ok(row, `${file} is missing from the CSS-native asset inventory`);
    assert.match(row, new RegExp(`\\| ${bytes.replace(',', '\\,?')} \\|`), `${file} inventory byte count is stale`);
    assert.match(row, /MFLUX 0\.18\.0, FLUX\.1-schnell, seed 0/, `${file} provenance is incomplete`);
  }
});
