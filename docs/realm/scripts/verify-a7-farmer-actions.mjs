#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  'python3',
  [
    join(
      root,
      'scripts',
      'actor-pose-prototype',
      'verify_a7_farmer_actions.py',
    ),
  ],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
