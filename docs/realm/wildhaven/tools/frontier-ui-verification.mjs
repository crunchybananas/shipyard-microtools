/** Reconcile the unchanged-source UI run and its corrected earned outpost fixture. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const review = new URL('../review/', import.meta.url);
const digest = data => createHash('sha256').update(data).digest('hex');
const names = {
  controls: 'frontier-ui-all-report.json',
  outpost: 'frontier-ui-outpost-report.json',
  component: 'frontier-ui-component-report.json',
};
const reports = {}, evidence = {};
for (const [kind, name] of Object.entries(names)) {
  const raw = await readFile(new URL(name, review));
  reports[kind] = JSON.parse(raw);
  evidence[kind] = { file: name, sha256: digest(raw) };
}
const { controls, outpost, component } = reports;
const failures = controls.checks.filter(check => !check.passed);
assert.equal(failures.length, 1, 'Only the documented outpost fixture rejection may be superseded');
assert.match(failures[0].name, /^An earned outpost can be removed and rebuilt/);
assert.match(failures[0].error, /Clear hostile troops from this region first/);
assert.equal(outpost.mode, 'outpost');
assert.equal(outpost.passed, true, 'The replacement outpost scenario must pass');
assert.equal(component.passed, true);
for (const report of [controls, outpost]) {
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.sourceChanges, []);
  assert.deepEqual(report.sourcesAtStart, report.sourcesAtEnd);
}
assert.deepEqual(controls.sourcesAtEnd, outpost.sourcesAtStart, 'Both browser runs must exercise identical runtime files');
const currentSources = {};
for (const [path, expected] of Object.entries(controls.sourcesAtEnd)) {
  currentSources[path] = digest(await readFile(new URL(path, root)));
  assert.equal(currentSources[path], expected, `${path} changed after verification`);
}
for (const [path, expected] of Object.entries(component.sources)) {
  assert.equal(currentSources[path], expected, `Component source ${path} differs from the real UI run`);
}
const replacement = outpost.checks.find(check => check.name === failures[0].name);
assert.ok(replacement?.passed);
const checks = controls.checks.filter(check => check.passed).map(check => ({ ...check, evidence: names.controls }));
checks.push({ ...replacement, evidence: names.outpost });
assert.equal(checks.length, 13);
assert.equal(new Set(checks.map(check => check.name)).size, checks.length);
const manifest = {
  verifiedAt: new Date().toISOString(),
  passed: true,
  scope: '13 unique real UI checks against one unchanged runtime, reconciled from 12 passing controls checks and one focused outpost rerun. Both used isolated Chromium contexts and previously earned saves; clock skips and public actions prepare the scenarios. This is not a physical-device test or a browser-played earned combat campaign.',
  evidence,
  currentSources,
  checks,
  supersededFixtureFailure: {
    report: names.controls,
    checkpoint: controls.fixture.claimCheckpoint,
    check: failures[0],
    explanation: 'The expansion checkpoint contains two living raiders in Highmeadow. Salvage correctly revoked the claim and preserved existing buildings, then reclaim correctly refused while hostiles remained. The focused rerun uses the later earned complete checkpoint after those hostiles were defeated. The raw failing report is preserved unchanged.',
    replacementCheckpoint: outpost.fixture.claimCheckpoint,
  },
  componentEvidence: {
    report: names.component,
    passed: component.checks.filter(check => check.passed).length,
    scope: component.scope,
  },
  worldPointerEvidence: { report: names.controls, events: controls.worldClicks.length, pointerKinds: [...new Set(controls.worldClicks.map(click => click.actual.pointer))] },
  visualReview: ['frontier-ui-01-island-chart.png', 'frontier-ui-touch-company.png', 'frontier-ui-07-touch-fortifications.png', 'frontier-ui-06-mobile-chart.png', 'frontier-ui-08-outpost-consequences.png', 'frontier-ui-09-claim-restored.png'],
};
await writeFile(new URL('frontier-ui-verification.json', review), JSON.stringify(manifest, null, 2) + '\n');
console.log(`PASS ${checks.length} unique real UI checks on ${Object.keys(currentSources).length} unchanged runtime files; ${component.checks.length} component checks remain separate evidence.`);
