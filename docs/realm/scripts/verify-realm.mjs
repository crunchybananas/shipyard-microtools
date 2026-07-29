#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const realmRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  ['runtime URL revision', 'runtime-revision.mjs', '--check'],
  ['runtime module graph', 'verify-module-graph.mjs'],
  ['deterministic-core purity', 'verify-core-purity.mjs'],
  ['core/FX isolation', 'verify-core-fx-isolation.mjs'],
  ['determinism', 'verify-determinism.mjs'],
  ['save schema', 'verify-engine-v2-save.mjs'],
  ['save continuity', 'verify-save-continuity.mjs'],
  ['building lifecycle', 'verify-building-lifecycle.mjs'],
  ['citizen transitions', 'verify-citizen-transition-ledger.mjs'],
  ['citizen ownership', 'verify-engine-v2-citizen-ownership.mjs'],
  ['citizen presentation', 'verify-engine-v2-citizen-presentation.mjs'],
  ['navigation and crowding', 'verify-navigation-crowd-baseline.mjs', '--require-correct'],
  ['mixed ground traffic', 'verify-phase0c-traffic-baseline.mjs', '--require-correct'],
  ['shell isolation', 'verify-shell-isolation.mjs'],
  ['browser save shell', 'verify-browser-save-shell.mjs'],
  ['browser citizen lifecycle', 'verify-engine-v2-citizen-lifecycle-browser.mjs'],
  ['browser citizen ownership', 'verify-engine-v2-ownership-browser.mjs'],
  ['browser road rendering', 'verify-road-rendering.mjs'],
  ['browser logic', 'verify-logic.mjs'],
];

for (const [label, script, ...args] of checks) {
  console.log(`\n[realm:check] ${label}`);
  const result = spawnSync(
    process.execPath,
    [join(realmRoot, 'scripts', script), ...args],
    { cwd: realmRoot, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\n[realm:check] FAILED: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\n[realm:check] PASS — ${checks.length} checks completed`);
