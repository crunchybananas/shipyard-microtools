import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDocument, formatDocument, searchNodes } from '../docs/json-formatter/engine.mjs';
import { diffDocuments, makePatch, wordDiff } from '../docs/text-diff/engine.mjs';

test('JSON formatting retains number lexemes, duplicate keys, escapes and primitive roots', () => {
  const input = '{"large":90071992547409931234,"exponent":1e400,"negative":-0,"same":1,"same":2,"text":"\\u0061"}';
  assert.equal(formatDocument(parseDocument(input), 0), input);
  assert.deepEqual(parseDocument(input).duplicates, ['/same']);
  for (const source of ['null', 'false', '0', '[]', '{}', '"hello"', ' [true, null, {"a":1}] ']) {
    assert.deepEqual(JSON.parse(formatDocument(parseDocument(source), 4)), JSON.parse(source));
  }
});
test('JSON Pointers escape reserved characters and search finds nested values', () => {
  const doc = parseDocument('{"a/b":{"~key":"ocean"},"":"empty key","__proto__":42}');
  assert.equal(searchNodes(doc, 'ocean')[0].path, '/a~1b/~0key');
  assert.equal(doc.nodes.find(node => node.value === 'empty key').path, '/');
  assert.equal(formatDocument(doc, 0), '{"a/b":{"~key":"ocean"},"":"empty key","__proto__":42}');
});
test('JSON errors carry useful positions; bounded inputs fail explicitly', () => {
  for (const source of ['{"a":1,}', '[1,]', '01', '"bad\\x"', '{', 'true false', '[1 2]', '"a\nb"', '{"a" 1}']) assert.throws(() => parseDocument(source), SyntaxError);
  assert.throws(() => parseDocument('{\n  "a": 1,\n}'), error => error.line === 3 && error.column === 1);
  assert.throws(() => parseDocument('['.repeat(130) + '0' + ']'.repeat(130)), /nesting limit/);
  assert.throws(() => parseDocument(' '.repeat(2 * 1024 * 1024 + 1)), /2 MiB/);
});
test('diff reconstructs both documents across randomized edits and final newlines', () => {
  let seed = 7193;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let trial = 0; trial < 600; trial++) {
    const make = () => Array.from({ length: Math.floor(random() * 20) }, () => ['alpha', 'beta', '', 'gamma'][Math.floor(random() * 4)]).join('\n') + (random() > .5 ? '\n' : '');
    const a = make(), b = make(), { ops } = diffDocuments(a, b);
    const rebuild = (side, exclude, noNewline) => {
      const relevant = ops.filter(op => op.type !== exclude);
      return relevant.map(op => op[side]).join('\n') + (relevant.length && !relevant.at(-1)[noNewline] ? '\n' : '');
    };
    assert.equal(rebuild('old', 'added', 'oldNoNewline'), a);
    assert.equal(rebuild('new', 'removed', 'newNoNewline'), b);
  }
});
test('saved patches apply with Git to reproduce exact modified content', () => {
  const folder = mkdtempSync(join(tmpdir(), 'workbench-patch-'));
  const env = { ...process.env }; delete env.GIT_DIR; delete env.GIT_WORK_TREE;
  try {
    const cases = [ ['', 'hello\n'], ['hello\n', ''], ['hello', 'hello\n'], ['a\nb\n', 'a\nc\n'], ['a\nb', 'a\nc'], ['\n', ''], ['', '\n'], ['a\nb\nc\n', 'x\na\nc\ny\n'], ['a\n\nend', 'a\n\nend\n'] ];
    const many = Array.from({ length: 90 }, (_, i) => `line ${i}`).join('\n');
    cases.push([many, many.replace('line 10\n', 'ten\n').replace('line 80\n', 'eighty\n')]);
    for (const [before, after] of cases) {
      writeFileSync(join(folder, 'document.txt'), before);
      const patch = makePatch(diffDocuments(before, after), 'document.txt');
      execFileSync('git', ['apply', '--no-index', '--whitespace=nowarn', '-'], { cwd: folder, env, input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal(readFileSync(join(folder, 'document.txt'), 'utf8'), after);
    }
    for (const filename of ['original.txt', 'my report 😀.txt']) {
      writeFileSync(join(folder, filename), 'before\n');
      const patch = makePatch(diffDocuments('before\n', 'after\n'), filename);
      execFileSync('git', ['apply', '--no-index', '--whitespace=nowarn', '-'], { cwd: folder, env, input: patch, stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal(readFileSync(join(folder, filename), 'utf8'), 'after\n');
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('large localized diffs stay fast; excessive work fails without approximate results', () => {
  const source = Array.from({ length: 20000 }, (_, i) => `line ${i}`).join('\n');
  const start = performance.now();
  const result = diffDocuments(source, source.replace('line 10000\n', 'changed line\n'));
  assert.equal(result.added, 1); assert.equal(result.removed, 1);
  assert.ok(performance.now() - start < 1500);
  assert.throws(() => diffDocuments('a\n'.repeat(3000), 'b\n'.repeat(3000)), /too different/);
  assert.throws(() => diffDocuments('a\n'.repeat(20001), ''), /20,000 lines/);
  assert.equal(diffDocuments('a', 'a\n').groups.length, 1);
});
test('whitespace filtering is explicit and cannot export a misleading patch', () => {
  assert.equal(diffDocuments(' a \n', 'a\n', true).groups.length, 0);
  assert.equal(diffDocuments('a b\n', 'a  b\n', true).groups.length, 1);
  assert.throws(() => makePatch(diffDocuments(' x\n', 'x\n', true)), /Turn off/);
  const segments = wordDiff('depth: 240 m', 'depth: 80 m');
  assert.equal(segments.old.filter(part => part.changed).map(part => part.text).join(''), '240');
  assert.equal(segments.new.filter(part => part.changed).map(part => part.text).join(''), '80');
});
