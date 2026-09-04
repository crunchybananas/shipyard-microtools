import { wordDiff, makePatch, MAX_BYTES } from './engine.mjs';
const $ = id => document.getElementById(id);
let result = null;
let worker = null;
let timeout;
let revision = 0;
let view = matchMedia('(max-width: 760px)').matches ? 'unified' : 'split';
let groupIndex = 0;
let pageStart = 0;
let visibleRows = [];
let revealed = new Set();
const PAGE_SIZE = 400;
const EXAMPLE_A = `# Night watch\nStation: North Atlantic\n\nSampling interval: 60 seconds\nHydrophone depth: 240 m\nCurrent meter: offline\n\nKeep raw recordings for 7 days.\nSend a daily digest at 08:00.\n\nOn a sensor failure:\n  Retry once.\n  Notify the keeper.\n`;
const EXAMPLE_B = `# Night watch\nStation: North Atlantic\n\nSampling interval: 15 seconds\nHydrophone depth: 240 m\nCurrent meter: online\n\nKeep raw recordings for 30 days.\nSend a daily digest at 08:00.\nInclude the overnight temperature range.\n\nOn a sensor failure:\n  Retry three times.\n  Notify the keeper.\n`;
function el(tag, cls, text) { const node = document.createElement(tag); node.className = cls; if (text !== undefined) node.textContent = text; return node; }
function status(text, error = false) { $('status').textContent = text; $('status').className = `status${error ? ' error' : ''}`; }
function stop() { worker?.terminate(); worker = null; clearTimeout(timeout); $('cancelBtn').hidden = true; $('diffBtn').disabled = false; $('results').removeAttribute('aria-busy'); }
function invalidate(message = 'Inputs changed. Compare again to update the review.') {
  revision++; stop(); result = null;
  for (const id of ['downloadBtn', 'prevBtn', 'nextBtn']) $(id).disabled = true;
  $('moreBtn').hidden = true; $('previousLines').hidden = true;
  $('addedCount').textContent = '+0 added'; $('removedCount').textContent = '−0 removed'; $('unchangedCount').textContent = '0 unchanged';
  $('changePosition').textContent = 'No comparison';
  $('reviewNote').textContent = 'Compare up to 20,000 lines per document.';
  $('diffOutput').replaceChildren(el('div', 'empty', message)); status(message);
}
function allRows() {
  const rows = [];
  let group = 0;
  for (let i = 0; i < result.ops.length;) {
    const op = result.ops[i];
    if (op.type === 'unchanged') { rows.push({ left: op, right: op, key: i }); i++; continue; }
    const start = i;
    const old = [], updated = [];
    while (i < result.ops.length && result.ops[i].type !== 'unchanged') {
      const change = result.ops[i++]; (change.type === 'removed' ? old : updated).push(change);
    }
    for (let p = 0; p < Math.max(old.length, updated.length); p++) {
      const segments = old[p] && updated[p] ? wordDiff(old[p].old, updated[p].new) : null;
      if (view === 'split') rows.push({ left: old[p], right: updated[p], key: `${start}-${p}`, group, segments });
      else {
        if (old[p]) rows.push({ left: old[p], key: `${start}-${p}-old`, group, segments });
        if (updated[p]) rows.push({ right: updated[p], key: `${start}-${p}-new`, group, segments });
      }
    }
    group++;
  }
  return rows;
}
function filterRows(rows) {
  if (!$('contextOnly').checked) return rows;
  const shown = new Set();
  rows.forEach((row, index) => { if (row.group !== undefined) for (let i = Math.max(0, index - 3); i <= Math.min(rows.length - 1, index + 3); i++) shown.add(i); });
  const filtered = [];
  for (let i = 0; i < rows.length;) {
    if (shown.has(i)) { filtered.push(rows[i++]); continue; }
    const start = i;
    while (i < rows.length && !shown.has(i)) i++;
    const key = `${start}-${i}`;
    if (revealed.has(key)) filtered.push(...rows.slice(start, i));
    else filtered.push({ gap: i - start, key });
  }
  return filtered;
}
function cell(op, side, segments) {
  if (!op) return el('div', 'diff-cell empty');
  const node = el('div', `diff-cell ${op.type}`);
  const prefix = op.type === 'added' ? '+' : op.type === 'removed' ? '−' : ' ';
  const number = side === 'old' ? op.oldNum : op.newNum;
  const content = el('div', 'line-content');
  content.append(el('span', 'diff-prefix', `${prefix} `));
  const parts = segments?.[side];
  if (parts) parts.forEach(part => content.append(el(part.changed ? 'mark' : 'span', '', part.text)));
  else content.append(document.createTextNode(side === 'old' ? op.old : op.new));
  if (side === 'old' ? op.oldNoNewline : op.newNoNewline) content.append(el('span', 'no-newline', 'No newline at end of file'));
  node.append(el('span', 'line-number', number), content);
  return node;
}
function render() {
  $('unifiedViewBtn').setAttribute('aria-pressed', String(view === 'unified'));
  $('splitViewBtn').setAttribute('aria-pressed', String(view === 'split'));
  if (!result) return;
  const output = $('diffOutput');
  if (!result.groups.length) {
    const empty = el('div', 'empty'); empty.append(el('strong', '', 'No changes to review.'), document.createTextNode(result.ignoreWhitespace ? 'The texts match when edge whitespace is ignored.' : 'The texts are identical, including the final newline.'));
    output.replaceChildren(empty); visibleRows = [];
  } else {
    visibleRows = filterRows(allRows());
    const fragment = document.createDocumentFragment();
    visibleRows.slice(pageStart, pageStart + PAGE_SIZE).forEach(row => {
      if (row.gap) {
        const gap = el('button', 'context-gap', `Show ${row.gap} unchanged lines`);
        gap.onclick = () => { revealed.add(row.key); render(); }; fragment.append(gap); return;
      }
      const line = el('div', `diff-row ${view}`);
      if (row.group !== undefined) { line.dataset.group = row.group; line.tabIndex = -1; }
      if (view === 'split') line.append(cell(row.left, 'old', row.segments), cell(row.right, 'new', row.segments));
      else line.append(row.left ? cell(row.left, 'old', row.segments) : cell(row.right, 'new', row.segments));
      fragment.append(line);
    });
    output.replaceChildren(fragment);
  }
  $('changePosition').textContent = result.groups.length ? `${groupIndex + 1} of ${result.groups.length} changes` : 'No changes';
  $('prevBtn').disabled = !result.groups.length; $('nextBtn').disabled = !result.groups.length;
  $('downloadBtn').disabled = !result.groups.length || result.ignoreWhitespace;
  $('downloadBtn').title = result.ignoreWhitespace ? 'Turn off Ignore edge whitespace to export an exact patch.' : 'Download a unified patch';
  $('moreBtn').hidden = pageStart + PAGE_SIZE >= visibleRows.length;
  $('moreBtn').textContent = 'Next lines';
  $('previousLines').hidden = !pageStart;
  $('reviewNote').textContent = result.ignoreWhitespace ? 'Edge whitespace ignored. Turn this off for exact patch export.' : visibleRows.length > PAGE_SIZE ? `Showing rows ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, visibleRows.length)} of ${visibleRows.length}. The saved patch includes every change.` : 'Word changes highlighted. + added, − removed. Patch includes every change.';
}
function goToGroup(index) {
  if (!result?.groups.length) return;
  groupIndex = (index + result.groups.length) % result.groups.length;
  const rowIndex = visibleRows.findIndex(row => row.group === groupIndex);
  pageStart = Math.floor(Math.max(0, rowIndex) / PAGE_SIZE) * PAGE_SIZE;
  render();
  const row = $('diffOutput').querySelector(`[data-group="${groupIndex}"]`);
  row?.classList.add('current-change'); row?.focus({ preventScroll: true });
  if (row) $('diffOutput').scrollTop = row.offsetTop - $('diffOutput').offsetTop;
}
function compare() {
  stop(); const current = ++revision;
  result = null; $('downloadBtn').disabled = true; $('prevBtn').disabled = true; $('nextBtn').disabled = true;
  status('Comparing…'); $('cancelBtn').hidden = false; $('diffBtn').disabled = true; $('results').setAttribute('aria-busy', 'true');
  $('diffOutput').replaceChildren(el('div', 'empty', 'Finding changes…'));
  try { worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' }); }
  catch { invalidate('This browser could not start the comparison worker. Try reloading the page.'); return; }
  worker.onmessage = ({ data }) => {
    if (current !== revision) return;
    stop();
    if (data.error) { invalidate(data.error); status(data.error, true); return; }
    result = data.result; groupIndex = 0; pageStart = 0; revealed = new Set();
    $('addedCount').textContent = `+${result.added} added`; $('removedCount').textContent = `−${result.removed} removed`; $('unchangedCount').textContent = `${result.unchanged} unchanged`;
    status(`${result.groups.length} change ${result.groups.length === 1 ? 'group' : 'groups'} · ${result.ignoreWhitespace ? 'edge whitespace ignored' : 'exact comparison'}.`);
    render();
  };
  worker.onerror = () => { invalidate('The comparison could not finish. Reload the page and try a smaller selection.'); };
  timeout = setTimeout(() => invalidate('Comparison stopped after 8 seconds. Try smaller sections.'), 8000);
  worker.postMessage({ before: $('textA').value, after: $('textB').value, ignoreWhitespace: $('ignoreWhitespace').checked });
}
const previousLines = el('button', '', 'Previous lines'); previousLines.id = 'previousLines'; previousLines.hidden = true; $('moreBtn').before(previousLines);
previousLines.onclick = () => { pageStart = Math.max(0, pageStart - PAGE_SIZE); render(); $('diffOutput').scrollTop = 0; };
$('moreBtn').onclick = () => { pageStart += PAGE_SIZE; render(); $('diffOutput').scrollTop = 0; };
for (const side of ['A', 'B']) {
  $(`text${side}`).oninput = () => invalidate();
  $(`open${side}`).onclick = () => $(`file${side}`).click();
  $(`file${side}`).onchange = async event => {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) { status('Use a text file smaller than 2 MiB.', true); return; }
    invalidate('Reading file…'); const current = revision;
    try {
      const content = await file.text(); if (revision !== current) return;
      if (content.includes('\0')) { status('This looks like a binary file. Choose a text file.', true); return; }
      $(`text${side}`).value = content; $(`name${side}`).textContent = file.name; status('File loaded. Compare when both revisions are ready.');
    } catch { status('This file could not be read. Try opening it again.', true); }
  };
}
$('diffBtn').onclick = compare;
$('cancelBtn').onclick = () => invalidate('Comparison cancelled. Your text is still here.');
$('ignoreWhitespace').onchange = () => invalidate();
$('contextOnly').onchange = () => { pageStart = 0; render(); };
$('sampleBtn').onclick = () => { $('textA').value = EXAMPLE_A; $('textB').value = EXAMPLE_B; $('nameA').textContent = 'original.txt'; $('nameB').textContent = 'modified.txt'; compare(); };
$('swapBtn').onclick = () => {
  [$('textA').value, $('textB').value] = [$('textB').value, $('textA').value];
  [$('nameA').textContent, $('nameB').textContent] = [$('nameB').textContent, $('nameA').textContent]; compare();
};
$('clearBtn').onclick = () => { $('textA').value = ''; $('textB').value = ''; $('nameA').textContent = 'original.txt'; $('nameB').textContent = 'modified.txt'; invalidate('Paste two revisions, or load the example to begin.'); $('textA').focus(); };
$('unifiedViewBtn').onclick = () => { view = 'unified'; pageStart = 0; render(); };
$('splitViewBtn').onclick = () => { view = 'split'; pageStart = 0; render(); };
$('prevBtn').onclick = () => goToGroup(groupIndex - 1); $('nextBtn').onclick = () => goToGroup(groupIndex + 1);
$('downloadBtn').onclick = () => {
  if (!result) return;
  try {
    const patch = makePatch(result, $('nameA').textContent);
    const url = URL.createObjectURL(new Blob([patch], { type: 'text/x-diff' }));
    const link = el('a', ''); link.href = url; link.download = 'changes.patch'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { status(error.message, true); }
};
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); compare(); } });
render();
