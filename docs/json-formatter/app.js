// JSON Formatter
// Format, validate, and minify JSON

const jsonInput = document.getElementById('jsonInput');
const output = document.getElementById('output');
const treeOutput = document.getElementById('treeOutput');
const status = document.getElementById('status');
const stats = document.getElementById('stats');

const formatBtn = document.getElementById('formatBtn');
const minifyBtn = document.getElementById('minifyBtn');
const validateBtn = document.getElementById('validateBtn');
const copyBtn = document.getElementById('copyBtn');
const textViewBtn = document.getElementById('textViewBtn');
const treeViewBtn = document.getElementById('treeViewBtn');

let lastParsed = null;
let hasParsed = false;
let currentView = 'text';

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}

function syntaxHighlight(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

function updateStats(json) {
  try {
    const parsed = JSON.parse(json);
    const keys = JSON.stringify(parsed).match(/"[^"]+"\s*:/g) || [];
    const chars = json.length;
    stats.textContent = `${keys.length} keys · ${chars.toLocaleString()} chars`;
  } catch {
    stats.textContent = '';
  }
}

// --- Error position navigation ---

// Extract the character offset of a parse error from the engine's message.
// Some engines report "... at position N", Firefox reports "... at line L column C",
// and many messages (e.g. V8's "Unexpected token") carry no position at all.
function locateParseError(message, text) {
  // Anchor both patterns to the end of the message: V8's snippet-quoting
  // errors ("Unexpected token 'x', \"...\" is not valid JSON") embed user
  // content, so an unanchored match could pick up "position 5" written
  // inside the user's own JSON. Positioned messages always END with the
  // location, so anchoring makes false matches impossible.
  const posMatch = message.match(/at position (\d+)(?: \(line \d+ column \d+\))?$/i);
  if (posMatch) {
    return Math.min(parseInt(posMatch[1], 10), Math.max(text.length - 1, 0));
  }

  const lineColMatch = message.match(/at line (\d+) column (\d+) of the JSON data$/i);
  if (lineColMatch) {
    const line = parseInt(lineColMatch[1], 10);
    const col = parseInt(lineColMatch[2], 10);
    const lines = text.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    pos += col - 1;
    return Math.min(pos, Math.max(text.length - 1, 0));
  }

  return null;
}

// Minimal position-tracking JSON scanner, used when the engine's error
// message carries no character position. Returns the offset of the first
// invalid character, or null if the text scans clean.
function scanJsonError(text) {
  const n = text.length;
  let i = 0;
  let failed = null;

  function fail(at) {
    if (failed === null) {
      failed = Math.min(at, Math.max(n - 1, 0));
    }
    return false;
  }

  function skipWs() {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++;
  }

  function isDigit(c) {
    return c >= '0' && c <= '9';
  }

  function parseString() {
    i++; // opening quote
    while (i < n) {
      const c = text[i];
      if (c === '"') {
        i++;
        return true;
      }
      if (c === '\\') {
        i++;
        if (i >= n) return fail(n);
        const esc = text[i];
        if (esc === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) return fail(i);
          i += 5;
        } else if ('"\\/bfnrt'.includes(esc)) {
          i++;
        } else {
          return fail(i);
        }
      } else if (c.charCodeAt(0) < 0x20) {
        return fail(i);
      } else {
        i++;
      }
    }
    return fail(n);
  }

  function parseNumber() {
    if (text[i] === '-') i++;
    if (text[i] === '0') {
      i++;
    } else if (isDigit(text[i])) {
      while (i < n && isDigit(text[i])) i++;
    } else {
      return fail(i);
    }
    if (text[i] === '.') {
      i++;
      if (!isDigit(text[i])) return fail(i);
      while (i < n && isDigit(text[i])) i++;
    }
    if (text[i] === 'e' || text[i] === 'E') {
      i++;
      if (text[i] === '+' || text[i] === '-') i++;
      if (!isDigit(text[i])) return fail(i);
      while (i < n && isDigit(text[i])) i++;
    }
    return true;
  }

  function parseObject() {
    i++; // {
    skipWs();
    if (text[i] === '}') {
      i++;
      return true;
    }
    while (true) {
      skipWs();
      if (text[i] !== '"') return fail(i);
      if (!parseString()) return false;
      skipWs();
      if (text[i] !== ':') return fail(i);
      i++;
      if (!parseValue()) return false;
      skipWs();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return true;
      }
      return fail(i);
    }
  }

  function parseArray() {
    i++; // [
    skipWs();
    if (text[i] === ']') {
      i++;
      return true;
    }
    while (true) {
      if (!parseValue()) return false;
      skipWs();
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ']') {
        i++;
        return true;
      }
      return fail(i);
    }
  }

  function parseValue() {
    skipWs();
    if (i >= n) return fail(n);
    const c = text[i];
    if (c === '{') return parseObject();
    if (c === '[') return parseArray();
    if (c === '"') return parseString();
    if (c === '-' || isDigit(c)) return parseNumber();
    if (text.startsWith('true', i)) {
      i += 4;
      return true;
    }
    if (text.startsWith('false', i)) {
      i += 5;
      return true;
    }
    if (text.startsWith('null', i)) {
      i += 4;
      return true;
    }
    return fail(i);
  }

  try {
    if (!parseValue()) return failed;
    skipWs();
    if (i < n) return Math.min(i, n - 1);
    return null;
  } catch {
    // e.g. stack overflow on pathologically deep nesting
    return failed;
  }
}

function showParseError(e) {
  const full = jsonInput.value;
  const trimmed = full.trim();
  let relPos = locateParseError(e.message, trimmed);
  if (relPos === null) {
    relPos = scanJsonError(trimmed);
  }

  if (relPos === null) {
    showStatus(`✗ Invalid JSON: ${e.message}`, 'error');
    return;
  }

  // Parse positions are relative to the trimmed input; shift back to the
  // textarea's coordinates so the highlight lands on the right character.
  const lead = full.length - full.trimStart().length;
  const pos = relPos + lead;
  const before = full.slice(0, pos);
  const line = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');

  showStatus(`✗ Invalid JSON at line ${line}, col ${col}: ${e.message}`, 'error');

  jsonInput.focus();
  jsonInput.setSelectionRange(pos, Math.min(pos + 1, full.length));

  const lineHeight = parseFloat(getComputedStyle(jsonInput).lineHeight) || 20;
  jsonInput.scrollTop = Math.max(0, (line - 1) * lineHeight - jsonInput.clientHeight / 2);

  jsonInput.classList.add('error-flash');
  setTimeout(() => {
    jsonInput.classList.remove('error-flash');
  }, 1500);
}

// --- Collapsible tree view ---

const MAX_TREE_CHILDREN = 500;

function createValueSpan(value) {
  const span = document.createElement('span');
  if (typeof value === 'string') {
    span.className = 'string';
  } else if (typeof value === 'number') {
    span.className = 'number';
  } else if (typeof value === 'boolean') {
    span.className = 'boolean';
  } else {
    span.className = 'null';
  }
  span.textContent = JSON.stringify(value);
  return span;
}

function createKeySpan(key, isIndex) {
  const span = document.createElement('span');
  span.className = isIndex ? 'tree-index' : 'key';
  span.textContent = (isIndex ? key : JSON.stringify(key)) + ': ';
  return span;
}

function createTreeNode(key, value, isIndex) {
  const node = document.createElement('div');
  node.className = 'tree-node';

  const row = document.createElement('div');
  row.className = 'tree-row';
  node.appendChild(row);

  const isComposite = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const entries = isComposite
    ? (isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value))
    : [];

  const caret = document.createElement('span');
  caret.className = 'tree-caret';
  if (isComposite && entries.length > 0) {
    caret.textContent = '▾';
  }
  row.appendChild(caret);

  if (key !== null) {
    row.appendChild(createKeySpan(key, isIndex));
  }

  if (!isComposite) {
    row.appendChild(createValueSpan(value));
    return node;
  }

  const open = document.createElement('span');
  open.className = 'tree-bracket';
  row.appendChild(open);

  if (entries.length === 0) {
    open.textContent = isArray ? '[]' : '{}';
    return node;
  }

  open.textContent = isArray ? '[' : '{';

  const count = entries.length;
  const noun = isArray ? (count === 1 ? 'item' : 'items') : (count === 1 ? 'key' : 'keys');
  const summary = document.createElement('span');
  summary.className = 'tree-summary';
  summary.textContent = ` … ${count} ${noun} ${isArray ? ']' : '}'}`;
  row.appendChild(summary);

  const children = document.createElement('div');
  children.className = 'tree-children';
  entries.slice(0, MAX_TREE_CHILDREN).forEach(([childKey, childValue]) => {
    children.appendChild(createTreeNode(childKey, childValue, isArray));
  });
  if (entries.length > MAX_TREE_CHILDREN) {
    const more = document.createElement('div');
    more.className = 'tree-more';
    more.textContent = `… ${entries.length - MAX_TREE_CHILDREN} more (switch to text view for full output)`;
    children.appendChild(more);
  }
  node.appendChild(children);

  const close = document.createElement('div');
  close.className = 'tree-close tree-bracket';
  close.textContent = isArray ? ']' : '}';
  node.appendChild(close);

  row.classList.add('toggleable');
  row.addEventListener('click', () => {
    node.classList.toggle('collapsed');
  });

  return node;
}

function renderTree() {
  treeOutput.textContent = '';
  if (!hasParsed) {
    const empty = document.createElement('div');
    empty.className = 'tree-empty';
    empty.textContent = 'Format or minify some JSON to see the tree view.';
    treeOutput.appendChild(empty);
    return;
  }
  treeOutput.appendChild(createTreeNode(null, lastParsed, false));
}

function setView(view) {
  currentView = view;
  textViewBtn.classList.toggle('active', view === 'text');
  treeViewBtn.classList.toggle('active', view === 'tree');
  output.classList.toggle('hidden', view !== 'text');
  treeOutput.classList.toggle('hidden', view !== 'tree');
  if (view === 'tree') {
    renderTree();
  }
}

textViewBtn.addEventListener('click', () => setView('text'));
treeViewBtn.addEventListener('click', () => setView('tree'));

formatBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showStatus('Please enter some JSON', 'error');
    return;
  }

  try {
    const parsed = JSON.parse(input);
    const formatted = JSON.stringify(parsed, null, 2);
    output.innerHTML = syntaxHighlight(formatted);
    lastParsed = parsed;
    hasParsed = true;
    if (currentView === 'tree') {
      renderTree();
    }
    updateStats(formatted);
    showStatus('✓ Formatted successfully', 'success');
  } catch (e) {
    output.textContent = '';
    lastParsed = null;
    hasParsed = false;
    if (currentView === 'tree') {
      renderTree();
    }
    showParseError(e);
  }
});

minifyBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showStatus('Please enter some JSON', 'error');
    return;
  }

  try {
    const parsed = JSON.parse(input);
    const minified = JSON.stringify(parsed);
    output.innerHTML = syntaxHighlight(minified);
    lastParsed = parsed;
    hasParsed = true;
    if (currentView === 'tree') {
      renderTree();
    }
    updateStats(minified);
    showStatus(`✓ Minified: ${input.length} → ${minified.length} chars`, 'success');
  } catch (e) {
    output.textContent = '';
    lastParsed = null;
    hasParsed = false;
    if (currentView === 'tree') {
      renderTree();
    }
    showParseError(e);
  }
});

validateBtn.addEventListener('click', () => {
  const input = jsonInput.value.trim();
  if (!input) {
    showStatus('Please enter some JSON', 'error');
    return;
  }

  try {
    JSON.parse(input);
    showStatus('✓ Valid JSON!', 'success');
  } catch (e) {
    showParseError(e);
  }
});

copyBtn.addEventListener('click', () => {
  const text = output.textContent;
  if (!text) {
    showStatus('Nothing to copy', 'error');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    showStatus('✓ Copied to clipboard', 'success');
  }).catch(() => {
    showStatus('Failed to copy', 'error');
  });
});

// Auto-format on paste
jsonInput.addEventListener('paste', () => {
  setTimeout(() => {
    formatBtn.click();
  }, 100);
});
