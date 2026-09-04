export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_LINES = 20000;
export function splitDocument(text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  const newline = normalized.endsWith('\n');
  const lines = normalized ? normalized.split('\n') : [];
  if (newline) lines.pop();
  return { lines, newline };
}
// Myers' shortest edit path. The trace is bounded to ~16 MiB; expensive,
// unrelated inputs return a useful limit message rather than an approximate diff.
export function diffDocuments(before, after, ignoreWhitespace = false) {
  if ([before, after].some(text => new TextEncoder().encode(text).length > MAX_BYTES)) throw new Error('Use documents smaller than 2 MiB each.');
  const a = splitDocument(before), b = splitDocument(after);
  const m = a.lines.length, n = b.lines.length;
  if (Math.max(m, n) > MAX_LINES) throw new Error('Compare up to 20,000 lines per document. Split this file into smaller sections.');
  const key = (doc, i) => `${ignoreWhitespace ? doc.lines[i].trim() : doc.lines[i]}\0${i < doc.lines.length - 1 || doc.newline}`;
  const left = a.lines.map((_, i) => key(a, i)), right = b.lines.map((_, i) => key(b, i));
  const max = Math.min(m + n, 1400);
  const offset = max + 1;
  let frontier = new Int32Array(2 * max + 3).fill(-1);
  frontier[offset + 1] = 0;
  const trace = [];
  let work = 0;
  let finalDepth = -1;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(frontier.slice());
    for (let k = -d; k <= d; k += 2) {
      if (++work > 4000000) break outer;
      let x = k === -d || (k !== d && frontier[offset + k - 1] < frontier[offset + k + 1]) ? frontier[offset + k + 1] : frontier[offset + k - 1] + 1;
      let y = x - k;
      while (x < m && y < n && left[x] === right[y]) { x++; y++; work++; }
      frontier[offset + k] = x;
      if (x >= m && y >= n) { finalDepth = d; break outer; }
    }
  }
  if (finalDepth < 0) throw new Error('These documents are too different for a bounded browser comparison. Compare smaller sections.');
  const ops = [];
  const add = (type, i, j) => {
    const old = type !== 'added', updated = type !== 'removed';
    ops.push({ type, oldNum: old ? i + 1 : null, newNum: updated ? j + 1 : null,
      old: old ? a.lines[i] : null, new: updated ? b.lines[j] : null,
      oldNoNewline: old && i === m - 1 && !a.newline, newNoNewline: updated && j === n - 1 && !b.newline });
  };
  let x = m, y = n;
  for (let d = finalDepth; d >= 0; d--) {
    const previous = trace[d], k = x - y;
    const previousK = k === -d || (k !== d && previous[offset + k - 1] < previous[offset + k + 1]) ? k + 1 : k - 1;
    const previousX = d ? previous[offset + previousK] : 0;
    const previousY = d ? previousX - previousK : 0;
    while (x > previousX && y > previousY) { x--; y--; add('unchanged', x, y); }
    if (!d) break;
    if (x === previousX) { y--; add('added', x, y); }
    else { x--; add('removed', x, y); }
  }
  ops.reverse();
  const groups = [];
  for (let i = 0; i < ops.length;) {
    if (ops[i].type === 'unchanged') { i++; continue; }
    const start = i;
    while (i < ops.length && ops[i].type !== 'unchanged') i++;
    groups.push({ start, end: i, oldLine: ops[start].oldNum, newLine: ops[start].newNum });
  }
  return { ops, groups, added: ops.filter(op => op.type === 'added').length,
    removed: ops.filter(op => op.type === 'removed').length,
    unchanged: ops.filter(op => op.type === 'unchanged').length, ignoreWhitespace };
}
export function wordDiff(before, after) {
  const a = before.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  const b = after.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) || [];
  // Intraline emphasis is optional; don't make huge lines expensive to render.
  if (a.length * b.length > 40000) return null;
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const old = [], updated = [];
  let i = a.length, j = b.length;
  while (i || j) {
    if (i && j && a[i - 1] === b[j - 1]) { old.push({ text: a[--i], changed: false }); updated.push({ text: b[--j], changed: false }); }
    else if (j && (!i || dp[i][j - 1] >= dp[i - 1][j])) updated.push({ text: b[--j], changed: true });
    else old.push({ text: a[--i], changed: true });
  }
  return { old: old.reverse(), new: updated.reverse() };
}
export function makePatch(result, filename = 'original.txt') {
  if (result.ignoreWhitespace) throw new Error('Turn off Ignore edge whitespace to export an exact patch.');
  if (!result.groups.length) return '';
  // This is an edit to the original file, not a rename to the second input's
  // filename. Git expects both headers to identify that same target.
  const basename = String(filename).split(/[\\/]/).at(-1) || 'original.txt';
  const quote = path => '"' + path.replace(/[\x00-\x1f\x7f"\\]/g, char => char === '"' ? '\\"' : char === '\\' ? '\\\\' : '\\' + char.charCodeAt(0).toString(8).padStart(3, '0')) + '"';
  const output = [`--- ${quote(`a/${basename}`)}`, `+++ ${quote(`b/${basename}`)}`];
  const hunks = [];
  for (const group of result.groups) {
    const start = Math.max(0, group.start - 3), end = Math.min(result.ops.length, group.end + 3);
    const last = hunks.at(-1);
    if (last && start <= last.end) last.end = end;
    else hunks.push({ start, end });
  }
  let oldCount = 0, newCount = 0, cursor = 0;
  for (const hunk of hunks) {
    while (cursor < hunk.start) { const op = result.ops[cursor++]; if (op.type !== 'added') oldCount++; if (op.type !== 'removed') newCount++; }
    const ops = result.ops.slice(hunk.start, hunk.end);
    const oldLength = ops.filter(op => op.type !== 'added').length, newLength = ops.filter(op => op.type !== 'removed').length;
    output.push(`@@ -${oldCount + (oldLength ? 1 : 0)},${oldLength} +${newCount + (newLength ? 1 : 0)},${newLength} @@`);
    for (const op of ops) {
      output.push(`${op.type === 'added' ? '+' : op.type === 'removed' ? '-' : ' '}${op.type === 'added' ? op.new : op.old}`);
      if (op.type === 'added' ? op.newNoNewline : op.oldNoNewline) output.push('\\ No newline at end of file');
      if (op.type !== 'added') oldCount++; if (op.type !== 'removed') newCount++; cursor++;
    }
  }
  return output.join('\n') + '\n';
}
