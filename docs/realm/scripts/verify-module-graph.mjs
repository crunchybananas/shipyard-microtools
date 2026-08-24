// Parser, mutation-fixture, system-order and live module-identity gate.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import runtimeContract from '../runtime-contract.json?realm=197' with { type: 'json' };
import { CORE_SYSTEM_ORDER } from '../js/sim.js?realm=197';
import {
  REALM_ROOT,
  analyzeRuntimeGraph,
  commitRevisionTransaction,
  formatGraphSummary,
  parseModuleSpecifiers,
  prepareRevisionTransaction,
  rewriteRuntimeSpecifiers,
  validateCanonicalRuntimeSpecifier,
} from './module-graph.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures', 'module-graph');
let failures = 0;

function pass(message) { console.log(`  ✓ ${message}`); }
function fail(message, detail = '') {
  failures++;
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ''}`);
}
function assert(condition, message, detail = '') {
  if (condition) pass(message);
  else fail(message, detail);
}

console.log('[module-graph] parser fixtures…');
const supportedFile = join(fixtures, 'supported-forms.js.fixture');
const supportedSource = readFileSync(supportedFile, 'utf8');
const supported = parseModuleSpecifiers(supportedSource, supportedFile);
assert(supported.nonLiteralDynamicImports.length === 0, 'supported forms contain no non-literal imports');
assert(supported.nonLiteralWorkerEntries.length === 0, 'supported forms contain no non-literal Worker entries');
assert(
  supported.records.map(record => record.kind).join(',') === [
    'static-import', 'side-effect-import', 're-export', 're-export',
    'dynamic-import', 'dynamic-import', 'static-import', 'worker-entry',
  ].join(','),
  'recognizes static, side-effect, re-export, literal dynamic, template-expression, JSON, and module Worker entries',
  supported.records.map(record => record.kind).join(','),
);
assert(
  supported.records.length === 8 && supported.records.every(record => !/comment|string|template-text|regexp/.test(record.specifier)),
  'does not treat comments, inert strings, template text, or regexps as imports',
);

const inertFile = join(fixtures, 'inert-only.js.fixture');
const inert = parseModuleSpecifiers(readFileSync(inertFile, 'utf8'), inertFile);
assert(inert.records.length === 0, 'inert-only fixture yields zero module edges');
const nonliteralFile = join(fixtures, 'nonliteral.js.fixture');
const nonliteral = parseModuleSpecifiers(readFileSync(nonliteralFile, 'utf8'), nonliteralFile);
assert(nonliteral.nonLiteralDynamicImports.length === 1, 'non-literal dynamic import fails closed');
assert(nonliteral.nonLiteralWorkerEntries.length === 1, 'non-literal Worker entry fails closed');

const rewriteProbeFile = join(__dirname, 'fixture-browser-probe.mjs');
const rewritten = rewriteRuntimeSpecifiers(supportedSource, rewriteProbeFile, runtimeContract.moduleRevision);
const rewrittenRecords = parseModuleSpecifiers(rewritten, rewriteProbeFile).records;
assert(
  rewrittenRecords.every(record => record.specifier.endsWith(`?realm=${runtimeContract.moduleRevision}`)),
  'revision rewrite canonicalizes every executable fixture edge',
);
assert(
  rewritten.includes("// import './js/comment.js';") &&
    rewritten.includes("import('./js/string.js')") &&
    rewritten.includes("export * from './js/template-text.js'"),
  'revision rewrite leaves comments and inert strings byte-for-byte intact',
);

console.log('[module-graph] deliberate invalid mutations…');
const invalidIdentities = JSON.parse(readFileSync(join(fixtures, 'invalid-identities.json'), 'utf8'));
for (const fixture of invalidIdentities) {
  const error = validateCanonicalRuntimeSpecifier(fixture.value, runtimeContract.moduleRevision);
  assert(
    error?.includes(fixture.error),
    `rejects ${fixture.label}`,
    error || 'accepted invalid identity',
  );
}
pass('non-literal fixture is rejected before graph resolution');

console.log('[module-graph] live graph…');
const graph = analyzeRuntimeGraph({ revision: runtimeContract.moduleRevision });
console.log(formatGraphSummary(graph, runtimeContract.moduleRevision));
if (!graph.ok) {
  for (const error of graph.errors) fail('live graph violation', error);
} else {
  pass('all live runtime edges use one canonical URL identity');
}
assert(graph.counts.htmlEntries === 1, 'index.html has exactly one canonical module entry');
assert(graph.counts.browserEvaluatorRoots >= 80, `all ${graph.counts.browserEvaluatorRoots} browser-evaluated runtime roots are registered`);
assert(graph.counts.nodeRuntimeRoots >= 10, 'Node runtime roots are registered');
assert(graph.counts.workerEntries === 1, 'exactly one native module Worker entry is registered');
assert(graph.counts.contractEdges >= 1, 'runtime-contract JSON import attributes are registered');
assert(graph.counts.alternateIdentityAllowlist === 0, 'no alternate runtime identity allowlist is needed');
const runtimeMutationFile = join(REALM_ROOT, 'js', 'sprite-source-contract.js');
const unsupportedMutation = analyzeRuntimeGraph({
  revision: runtimeContract.moduleRevision,
  overrides: new Map([[
    runtimeMutationFile,
    `${readFileSync(runtimeMutationFile, 'utf8')}\nimport '../scripts/queryless-browser-contract.mjs';\n`,
  ]]),
});
assert(
  !unsupportedMutation.ok && unsupportedMutation.errors.some(error => error.includes('unsupported/out-of-graph local module')),
  'runtime browser sources cannot hide queryless .mjs edges outside the canonical graph',
);
assert(
  JSON.stringify(CORE_SYSTEM_ORDER) === JSON.stringify(runtimeContract.coreSystemOrder),
  'executable core system order matches the authoritative contract',
);
const orderVersion = order => `sha256:${createHash('sha256').update(JSON.stringify(order)).digest('hex')}`;
assert(
  runtimeContract.coreSystemOrderVersion === orderVersion(runtimeContract.coreSystemOrder),
  'core system order version is the content address of the authoritative order',
);
const mutatedOrder = [...runtimeContract.coreSystemOrder];
[mutatedOrder[0], mutatedOrder[1]] = [mutatedOrder[1], mutatedOrder[0]];
assert(
  orderVersion(mutatedOrder) !== runtimeContract.coreSystemOrderVersion,
  'any order mutation necessarily produces a new contract version',
);

const prospective = prepareRevisionTransaction(runtimeContract.moduleRevision + 1);
assert(prospective.validation.ok, 'next-revision transaction validates completely before any write');
assert(
  JSON.parse(prospective.overrides.get(join(REALM_ROOT, 'runtime-contract.json'))).moduleRevision === runtimeContract.moduleRevision + 1,
  'prospective transaction updates the sole runtime contract source',
);
assert(
  JSON.parse(readFileSync(join(REALM_ROOT, 'runtime-contract.json'), 'utf8')).moduleRevision === runtimeContract.moduleRevision,
  'transaction preparation performs no filesystem writes',
);
const indexFile = join(REALM_ROOT, 'index.html');
try {
  commitRevisionTransaction({
    revision: runtimeContract.moduleRevision,
    overrides: new Map(),
    observed: new Map([[indexFile, `${readFileSync(indexFile, 'utf8')}\n<!-- stale transaction -->`]]),
  });
  fail('transaction rejects a source changed after preparation');
} catch (error) {
  assert(error.message.includes('changed after preparation'), 'transaction rejects a source changed after preparation');
}

if (failures) {
  console.error(`[module-graph] FAILED — ${failures} assertion${failures === 1 ? '' : 's'}`);
  process.exit(1);
}
console.log('[module-graph] OK — parser fixtures, negative mutations, graph identity, and transactionality verified');
