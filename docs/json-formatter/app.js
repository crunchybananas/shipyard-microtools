import { parseDocument, formatDocument, searchNodes, MAX_BYTES } from './engine.mjs';
const $ = id => document.getElementById(id);
const source = $('jsonInput');
const tree = $('treeOutput');
let parsed = null;
let selected = 0;
let expanded = new Set([0]);
let view = 'tree';
let compact = false;
let limit = 200;
let formatted = '';
let timer;
let lastError;
let generation = 0;
const EXAMPLE = {
  observatory: 'North Atlantic',
  station: 'CB-07',
  online: true,
  coordinates: { latitude: 44.65, longitude: -63.57 },
  instruments: [
    { name: 'Hydrophone', depth_m: 240, recording: true },
    { name: 'Current meter', depth_m: 80, recording: false }
  ],
  latest: { temperature_c: 8.4, salinity_psu: 34.7, note: null },
  tags: ['ocean', 'night-watch']
};
function el(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function status(text, kind = '') { $('status').textContent = text; $('status').className = `status ${kind}`; }
function enable(on) { for (const id of ['copyBtn', 'downloadBtn', 'copyPathBtn', 'copyValueBtn']) $(id).disabled = !on; }
function resetOutput() {
  parsed = null; formatted = ''; enable(false);
  $('output').textContent = ''; $('outputMeta').textContent = ''; $('searchCount').textContent = '';
  $('selectedPath').textContent = 'Document root'; $('selectedValue').textContent = 'No selection';
  $('selectedMeta').textContent = 'Select a row to inspect it and copy its JSON Pointer.';
  $('stats').textContent = 'Numbers keep their original precision.';
  $('moreBtn').hidden = true;
  tree.replaceChildren(el('p', 'empty', 'Your document will appear here. Explore its structure, or search for a key or value.'));
}
function highlight(text) {
  // Tokenize before escaping so user strings can never introduce HTML.
  const escape = value => value.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  return text.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b)/g).map((token, i) => {
    if (i % 2 === 0) return escape(token);
    const type = token.startsWith('"') ? token.endsWith(':') ? 'key' : 'string' : /^-?\d/.test(token) ? 'number' : 'literal';
    return `<span class="syntax-${type}">${escape(token)}</span>`;
  }).join('');
}
function renderText() {
  formatted = formatDocument(parsed, compact ? 0 : Number($('indent').value));
  // Large documents retain their full output without creating thousands of spans.
  if (formatted.length > 150000) $('output').textContent = formatted;
  else $('output').innerHTML = highlight(formatted);
  $('outputMeta').textContent = `${new TextEncoder().encode(formatted).length.toLocaleString()} bytes`;
}
function select(id) {
  selected = id;
  const node = parsed.nodes[id];
  const value = formatDocument(parsed, 2, id);
  $('selectedPath').textContent = node.path || 'Document root · pointer is an empty string';
  const line = parsed.source.slice(0, node.start).split('\n').length;
  $('selectedMeta').textContent = `${node.type} · source line ${line}${parsed.duplicates.length ? ' · duplicate keys make some pointers ambiguous' : ''}`;
  $('selectedValue').textContent = value.length > 5000 ? `${value.slice(0, 5000)}\n… Preview shortened; Copy value includes it all.` : value;
  tree.querySelectorAll('.tree-row').forEach(row => {
    const active = Number(row.dataset.id) === selected;
    row.classList.toggle('selected', active);
    row.querySelector('.node-value').setAttribute('aria-pressed', String(active));
  });
}
function renderTree() {
  if (!parsed) return;
  const query = $('search').value.trim();
  const visible = [];
  if (query) visible.push(...searchNodes(parsed, query));
  else {
    const visit = id => { const node = parsed.nodes[id]; visible.push(node); if (expanded.has(id)) node.children.forEach(visit); };
    visit(0);
  }
  $('searchCount').textContent = query ? `${visible.length} found` : '';
  const fragment = document.createDocumentFragment();
  visible.slice(0, limit).forEach(node => {
    const row = el('div', 'tree-row');
    row.dataset.id = node.id;
    row.style.paddingLeft = `${query ? 8 : Math.min(node.depth, 12) * 16 + 8}px`;
    const disclosure = el(node.children.length && !query ? 'button' : 'span', 'disclosure', node.children.length ? expanded.has(node.id) ? '▾' : '▸' : '');
    if (disclosure.tagName === 'BUTTON') {
      disclosure.setAttribute('aria-expanded', String(expanded.has(node.id)));
      disclosure.setAttribute('aria-label', `${expanded.has(node.id) ? 'Collapse' : 'Expand'} ${node.path || 'document'}`);
      disclosure.addEventListener('click', () => {
        expanded.has(node.id) ? expanded.delete(node.id) : expanded.add(node.id);
        renderTree();
        tree.querySelector(`[data-id="${node.id}"] .disclosure`)?.focus();
      });
    }
    const button = el('button', 'node-value');
    const preview = node.children.length ? `${node.children.length} ${node.type === 'array' ? 'items' : 'keys'}` : parsed.source.slice(node.start, node.end);
    button.append(el('span', 'node-key', query ? node.path || '$' : node.key), el('span', `node-preview ${node.type}`, preview.slice(0, 240)), el('span', 'node-type', node.type));
    button.setAttribute('aria-label', `Inspect ${node.path || 'document root'}, ${node.type}`);
    button.addEventListener('click', () => select(node.id));
    row.append(disclosure, button); fragment.append(row);
  });
  if (!visible.length) fragment.append(el('p', 'empty', 'No matching keys, values, or paths. Try a shorter search.'));
  tree.replaceChildren(fragment);
  $('moreBtn').hidden = visible.length <= limit || view !== 'tree';
  $('moreBtn').textContent = `Show ${Math.min(200, visible.length - limit)} more values (${Math.min(limit, visible.length)} of ${visible.length})`;
  select(selected);
}
function process(focusError = false) {
  clearTimeout(timer); lastError = null; $('errorBtn').hidden = true;
  $('sourceMeta').textContent = `${new TextEncoder().encode(source.value).length.toLocaleString()} bytes`;
  if (!source.value.trim()) { resetOutput(); status('Paste a document or load the example to begin.'); return; }
  const previousPath = parsed?.nodes[selected]?.path;
  try {
    parsed = parseDocument(source.value);
    selected = Math.max(0, parsed.nodes.findIndex(node => node.path === previousPath));
    expanded = new Set(parsed.nodes.filter(node => node.depth < 2).map(node => node.id));
    limit = 200; enable(true); renderText(); renderTree();
    $('stats').textContent = `${parsed.nodes.length.toLocaleString()} values · ${Math.max(...parsed.nodes.map(node => node.depth))} levels deep`;
    status(parsed.duplicates.length ? `Valid JSON · ${parsed.duplicates.length} duplicate key(s), preserved. Some JSON Pointers are ambiguous.` : 'Valid JSON · original number precision preserved.', parsed.duplicates.length ? 'warning' : 'success');
  } catch (error) {
    resetOutput(); lastError = error;
    status(`${error.line ? `Line ${error.line}, column ${error.column}: ` : ''}${error.message}`, 'error');
    $('errorBtn').hidden = error.position === undefined;
    if (focusError) jumpToError();
  }
}
function jumpToError() {
  if (lastError?.position === undefined) return;
  source.focus(); source.setSelectionRange(lastError.position, Math.min(lastError.position + 1, source.value.length));
  source.scrollTop = Math.max(0, (lastError.line - 1) * 23.4 - source.clientHeight / 2);
}
function setView(next) {
  view = next; $('output').hidden = next !== 'text'; tree.hidden = next !== 'tree';
  $('textViewBtn').setAttribute('aria-pressed', String(next === 'text')); $('treeViewBtn').setAttribute('aria-pressed', String(next === 'tree'));
  $('search').disabled = next !== 'tree'; if (parsed) renderTree();
}
async function copy(value, label) {
  try { await navigator.clipboard.writeText(value); status(`${label} copied.`, 'success'); }
  catch { status('Clipboard access is unavailable. Use Save JSON, or select and copy the text.', 'error'); }
}
source.addEventListener('input', () => { generation++; resetOutput(); clearTimeout(timer); status('Reading document…'); timer = setTimeout(() => process(), 220); });
$('formatBtn').onclick = () => { compact = false; process(true); };
$('minifyBtn').onclick = () => { compact = true; process(true); setView('text'); };
$('validateBtn').onclick = () => process(true);
$('indent').onchange = () => { compact = false; if (parsed) renderText(); };
$('sampleBtn').onclick = () => { generation++; source.value = JSON.stringify(EXAMPLE, null, 2); $('search').value = ''; compact = false; process(); setView('tree'); };
$('clearBtn').onclick = () => { generation++; source.value = ''; $('search').value = ''; process(); source.focus(); };
$('search').oninput = () => { limit = 200; renderTree(); };
$('moreBtn').onclick = () => { limit += 200; renderTree(); };
$('textViewBtn').onclick = () => setView('text'); $('treeViewBtn').onclick = () => setView('tree');
$('errorBtn').onclick = jumpToError;
$('copyBtn').onclick = () => copy(formatted, 'Document');
$('copyPathBtn').onclick = () => { if (parsed) copy(parsed.nodes[selected].path, 'JSON Pointer'); };
$('copyValueBtn').onclick = () => { if (parsed) copy(formatDocument(parsed, 2, selected), 'Value'); };
$('downloadBtn').onclick = () => {
  if (!parsed) return;
  const url = URL.createObjectURL(new Blob([formatted], { type: 'application/json' }));
  const link = el('a', ''); link.href = url; link.download = 'document.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('openBtn').onclick = () => $('fileInput').click();
$('fileInput').onchange = async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (file.size > MAX_BYTES) { status('Use a JSON file smaller than 2 MiB.', 'error'); return; }
  const revision = ++generation;
  try { const text = await file.text(); if (revision !== generation) return; source.value = text; process(); }
  catch { status('This file could not be read. Try opening it again.', 'error'); }
};
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); compact = false; process(true); } });
resetOutput();
