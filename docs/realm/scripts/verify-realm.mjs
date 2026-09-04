#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const realmRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const checks = [
  ['runtime URL revision', 'runtime-revision.mjs', '--check'],
  ['runtime module graph', 'verify-module-graph.mjs'],
  ['render sharpness', 'verify-render-sharpness.mjs'],
  ['painted enemy sprite family', 'verify-enemy-sprites.mjs'],
  ['browser painted enemy combat states', 'verify-enemy-sprites-browser.mjs'],
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
  ['A15 modular rancher family', 'verify-a15-rancher-actions.mjs'],
  ['A16 modular trader family', 'verify-a16-trader-actions.mjs'],
  ['A17 modular innkeeper family', 'verify-a17-innkeeper-actions.mjs'],
  ['A18 modular scholar family', 'verify-a18-scholar-actions.mjs'],
  ['A19 modular forager family', 'verify-a19-forager-actions.mjs'],
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
  ['physical building food inventory and plunder', 'verify-building-inventory.mjs'],
  ['physical wheat and flour inventory', 'verify-physical-grain-inventory.mjs'],
  ['deterministic production delivery broker', 'verify-logistics-broker.mjs'],
  ['live physical production logistics', 'verify-production-logistics.mjs'],
  ['building lifecycle', 'verify-building-lifecycle.mjs'],
  ['grounded building use', 'verify-building-use.mjs'],
  ['deterministic raid target contracts and breach lanes', 'verify-raid-target-contract.mjs'],
  ['bounded raid intent planner', 'verify-raid-planner.mjs'],
  ['live raid routes, breaches, and replanning', 'verify-raid-route-integration.mjs'],
  ['army orders', 'verify-army-orders.mjs'],
  ['company supply rules', 'verify-company-supply.mjs'],
  ['physical company supply and readiness', 'verify-company-supply-integration.mjs'],
  ['lived-in buildings and opening economy', 'verify-lived-in-buildings.mjs'],
  ['physical leisure and sleep arrivals', 'verify-physical-arrivals.mjs'],
  ['citizen physical food routes', 'verify-citizen-food-routes.mjs'],
  ['browser citizen physical food routes', 'verify-citizen-food-routes-browser.mjs'],
  ['browser physical supply ledger', 'verify-supply-ledger-browser.mjs'],
  ['completed House raid shelters', 'verify-raid-shelters.mjs'],
  ['browser completed House raid shelters', 'verify-raid-shelters-browser.mjs'],
  ['player-authored first muster', 'verify-first-muster.mjs'],
  ['outcome-based raid survival', 'verify-raid-resolution.mjs'],
  ['terminal enemy death and first-raid balance', 'verify-combat-terminal-death.mjs'],
  ['sequential First Muster chapter', 'verify-first-muster-chapter.mjs'],
  ['First Muster raid calendar gate', 'verify-first-muster-raid-gate.mjs'],
  ['post-raid recovery doctrine choice', 'verify-post-raid-recovery.mjs'],
  ['browser post-raid recovery choice', 'verify-post-raid-recovery-browser.mjs'],
  ['visible Founder scouting rewards', 'verify-founder-scouting.mjs'],
  ['citizen transitions', 'verify-citizen-transition-ledger.mjs'],
  ['citizen ownership', 'verify-engine-v2-citizen-ownership.mjs'],
  ['building workforce priority', 'verify-building-workforce-priority.mjs'],
  ['citizen presentation', 'verify-engine-v2-citizen-presentation.mjs'],
  ['pathfinding liveness and reachable approaches', 'verify-pathfinding-liveness.mjs'],
  ['deterministic pathfinding service', 'verify-pathfinding-service.mjs'],
  ['browser startup queue and Worker fallback', 'verify-startup-shell-browser.mjs'],
  ['browser native pathfinding Worker', 'verify-pathfinding-worker-browser.mjs'],
  ['citizen congestion and physical service queues', 'verify-citizen-congestion.mjs'],
  ['navigation and crowding', 'verify-navigation-crowd-baseline.mjs', '--require-correct'],
  ['mixed ground traffic', 'verify-phase0c-traffic-baseline.mjs', '--require-correct'],
  ['browser dense settlement congestion', 'verify-dense-settlement-congestion-browser.mjs'],
  ['shell isolation', 'verify-shell-isolation.mjs'],
  ['browser save shell', 'verify-browser-save-shell.mjs'],
  ['opening build tutorial', 'verify-opening-build-tutorial-browser.mjs'],
  ['responsive phone build mode', 'verify-responsive-build-mode.mjs'],
  ['browser citizen work orders', 'verify-citizen-work-orders-browser.mjs'],
  ['browser first muster and Founder controls', 'verify-first-muster-browser.mjs'],
  ['browser full First Muster playthrough', 'verify-first-muster-playthrough.mjs'],
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
  ['browser rancher production world', 'verify-rancher-world-browser.mjs'],
  ['browser trader production world', 'verify-trader-world-browser.mjs'],
  ['browser modular cargo and transitions', 'verify-guard-cargo-browser.mjs'],
  ['browser logic', 'verify-logic.mjs'],
];

const fromFlag = process.argv.indexOf('--from');
const fromLabel = fromFlag >= 0 ? process.argv[fromFlag + 1] : null;
const fromIndex = fromLabel ? checks.findIndex(([label]) => label === fromLabel) : 0;
if (fromLabel && fromIndex < 0) {
  console.error(`[realm:check] Unknown --from label: ${fromLabel}`);
  process.exit(2);
}
const selectedChecks = checks.slice(fromIndex);

for (const [label, script, ...args] of selectedChecks) {
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

console.log(`\n[realm:check] PASS — ${selectedChecks.length} checks completed`);
