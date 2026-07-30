#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.REALM_SPRITE_PYTHON,
  'python3',
  join(
    homedir(),
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'bin',
    'python3',
  ),
].filter(Boolean);

const python = candidates.find((candidate) => {
  const check = spawnSync(candidate, ['-c', 'from PIL import Image'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  return check.status === 0;
});
if (!python) {
  throw new Error(
    'actor-row manifest verification requires Python with Pillow; '
    + 'set REALM_SPRITE_PYTHON to a compatible interpreter',
  );
}

const result = spawnSync(
  python,
  [join(ROOT, 'scripts', 'verify-actor-row-manifest-v2.py')],
  { cwd: ROOT, stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const manifest = spawnSync(
  python,
  [join(ROOT, 'scripts', 'sprite-row-workbench.py'), 'verify'],
  { cwd: ROOT, stdio: 'inherit' },
);
if (manifest.error) throw manifest.error;
process.exit(manifest.status ?? 1);
