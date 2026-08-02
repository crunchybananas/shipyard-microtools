#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const realmRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  ['runtime URL revision', 'runtime-revision.mjs', '--check'],
  ['runtime module graph', 'verify-module-graph.mjs'],
  ['render sharpness', 'verify-render-sharpness.mjs'],
  ['actor-row candidate isolation', 'verify-actor-row-manifest-v2.mjs'],
  ['A6 resource cargo attachments', 'verify-a6-cargo-payloads.mjs'],
  ['A7 modular farmer family', 'verify-a7-farmer-actions.mjs'],
  ['A8 modular lumber family', 'verify-a8-lumber-actions.mjs'],
  ['A9 modular builder family', 'verify-a9-builder-actions.mjs'],
  ['A10 modular blacksmith family', 'verify-a10-blacksmith-actions.mjs'],
  ['A11 modular miner family', 'verify-a11-miner-actions.mjs'],
  ['A12 modular stonecutter family', 'verify-a12-stonecutter-actions.mjs'],
  ['A13 modular fisher family', 'verify-a13-fisher-actions.mjs'],
  ['A14 modular settler family', 'verify-a14-settler-actions.mjs'],
  ['sprite source contract', 'verify-sprite-source-contract.mjs'],
  ['sprite frame structure and quality', 'audit-sprite-frames.mjs'],
  ['sprite walk gait', 'audit-walk-gait.mjs'],
  ['sprite direction phase', 'audit-sprite-direction-phase.mjs'],
  ['all sprite map coverage', 'verify-all-sprite-maps.mjs'],
  ['sprite animation contract', 'verify-anim.mjs'],
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
  ['responsive phone build mode', 'verify-responsive-build-mode.mjs'],
  ['browser citizen work orders', 'verify-citizen-work-orders-browser.mjs'],
  ['browser citizen lifecycle', 'verify-engine-v2-citizen-lifecycle-browser.mjs'],
  ['browser citizen ownership', 'verify-engine-v2-ownership-browser.mjs'],
  ['browser road rendering', 'verify-road-rendering.mjs'],
  ['browser actor-row candidate isolation', 'verify-actor-row-candidate-browser.mjs'],
  ['browser actor vertical slice', 'verify-actor-vertical-slice.mjs'],
  ['browser farmer vertical slice', 'verify-farmer-vertical-slice.mjs'],
  ['browser lumber vertical slice', 'verify-lumber-vertical-slice.mjs'],
  ['browser builder vertical slice', 'verify-builder-vertical-slice.mjs'],
  ['browser blacksmith vertical slice', 'verify-blacksmith-vertical-slice.mjs'],
  ['browser miner vertical slice', 'verify-miner-vertical-slice.mjs'],
  ['browser stonecutter vertical slice', 'verify-stonecutter-vertical-slice.mjs'],
  ['browser fisher vertical slice', 'verify-fisher-vertical-slice.mjs'],
  ['browser settler vertical slice', 'verify-settler-vertical-slice.mjs'],
  ['browser modular cargo and transitions', 'verify-guard-cargo-browser.mjs'],
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
