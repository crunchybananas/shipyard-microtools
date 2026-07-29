#!/usr/bin/env node

import {
  analyzeRuntimeGraph,
  commitRevisionTransaction,
  formatGraphSummary,
  prepareRevisionTransaction,
  readRuntimeContract,
} from './module-graph.mjs';

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/runtime-revision.mjs --check');
  console.error('       node scripts/runtime-revision.mjs --write [REVISION]');
  process.exit(2);
}

const args = process.argv.slice(2);
const mode = args.shift();
if (!['--check', '--write'].includes(mode) || args.length > 1) usage();

const contract = readRuntimeContract();
if (!Number.isSafeInteger(contract.moduleRevision) || contract.moduleRevision < 1) {
  throw new Error('runtime-contract.json moduleRevision must be a positive safe integer');
}

if (mode === '--check') {
  if (args.length) usage('--check takes no revision argument');
  const result = analyzeRuntimeGraph({ revision: contract.moduleRevision });
  console.log(formatGraphSummary(result, contract.moduleRevision));
  if (!result.ok) {
    for (const error of result.errors) console.error(`  ✗ ${error}`);
    process.exit(1);
  }
  console.log('[runtime-revision] OK — every runtime edge has one canonical URL identity');
} else {
  const revision = args.length ? Number(args[0]) : contract.moduleRevision;
  if (!Number.isSafeInteger(revision) || revision < 1) usage(`invalid revision '${args[0]}'`);
  const transaction = prepareRevisionTransaction(revision);
  const result = commitRevisionTransaction(transaction);
  console.log(formatGraphSummary(transaction.validation, revision));
  if (result.changedFiles.length) {
    console.log(`[runtime-revision] wrote ${result.changedFiles.length} files:`);
    for (const file of result.changedFiles) console.log(`  ${file}`);
  } else {
    console.log('[runtime-revision] already canonical; no files changed');
  }
}
