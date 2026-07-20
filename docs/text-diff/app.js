// Text Diff
// Compare two text snippets line by line

const textA = document.getElementById('textA');
const textB = document.getElementById('textB');
const diffBtn = document.getElementById('diffBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');
const results = document.getElementById('results');
const diffOutput = document.getElementById('diffOutput');
const addedCount = document.getElementById('addedCount');
const removedCount = document.getElementById('removedCount');
const unchangedCount = document.getElementById('unchangedCount');
const unifiedViewBtn = document.getElementById('unifiedViewBtn');
const splitViewBtn = document.getElementById('splitViewBtn');

let currentDiff = null;
let viewMode = 'unified';

// Simple LCS-based diff
function computeDiff(a, b) {
  const linesA = a.split('\n');
  const linesB = b.split('\n');

  // Build LCS table
  const m = linesA.length;
  const n = linesB.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const diff = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diff.unshift({ type: 'unchanged', line: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', line: linesB[j - 1] });
      j--;
    } else {
      diff.unshift({ type: 'removed', line: linesA[i - 1] });
      i--;
    }
  }

  return diff;
}

// Word-level LCS diff within a changed line pair.
// Returns { oldSegs, newSegs } or null when the lines share too little.
function computeWordDiff(oldLine, newLine) {
  const wordsA = oldLine.match(/\S+|\s+/g) || [];
  const wordsB = newLine.match(/\S+|\s+/g) || [];
  const m = wordsA.length;
  const n = wordsB.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (wordsA[i - 1] === wordsB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const oldSegs = [];
  const newSegs = [];
  let i = m, j = n;
  let sameChars = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      oldSegs.unshift({ changed: false, text: wordsA[i - 1] });
      newSegs.unshift({ changed: false, text: wordsB[j - 1] });
      sameChars += wordsA[i - 1].length;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newSegs.unshift({ changed: true, text: wordsB[j - 1] });
      j--;
    } else {
      oldSegs.unshift({ changed: true, text: wordsA[i - 1] });
      i--;
    }
  }

  // Mostly different lines read better as plain removed/added
  const longest = Math.max(oldLine.length, newLine.length);
  if (longest > 0 && sameChars / longest < 0.3) return null;

  return { oldSegs: mergeSegments(oldSegs), newSegs: mergeSegments(newSegs) };
}

function mergeSegments(segs) {
  const merged = [];
  for (const seg of segs) {
    const last = merged[merged.length - 1];
    if (last && last.changed === seg.changed) {
      last.text += seg.text;
    } else {
      merged.push({ changed: seg.changed, text: seg.text });
    }
  }
  return merged;
}

// Assign old/new line numbers, then pair adjacent removed/added runs
// and attach word-level segments to each pair
function annotateDiff(diff) {
  let oldNum = 0;
  let newNum = 0;

  for (const item of diff) {
    if (item.type !== 'added') item.oldNum = ++oldNum;
    if (item.type !== 'removed') item.newNum = ++newNum;
  }

  let k = 0;
  while (k < diff.length) {
    if (diff[k].type !== 'removed') {
      k++;
      continue;
    }
    let removedEnd = k;
    while (removedEnd < diff.length && diff[removedEnd].type === 'removed') removedEnd++;
    let addedEnd = removedEnd;
    while (addedEnd < diff.length && diff[addedEnd].type === 'added') addedEnd++;

    const pairs = Math.min(removedEnd - k, addedEnd - removedEnd);
    for (let p = 0; p < pairs; p++) {
      const removed = diff[k + p];
      const added = diff[removedEnd + p];
      const wordDiff = computeWordDiff(removed.line, added.line);
      if (wordDiff) {
        removed.segments = wordDiff.oldSegs;
        added.segments = wordDiff.newSegs;
      }
    }
    k = addedEnd;
  }

  return diff;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function lineNumberCell(num) {
  const numStr = num ? String(num).padStart(3, ' ') : '   ';
  return `<span class="line-number">${numStr}</span>`;
}

function renderLineContent(item, side) {
  if (!item.segments) return escapeHtml(item.line);
  const cls = side === 'old' ? 'word-removed' : 'word-added';
  return item.segments.map(seg => {
    const text = escapeHtml(seg.text);
    return seg.changed ? `<span class="${cls}">${text}</span>` : text;
  }).join('');
}

function renderUnified(diff) {
  return diff.map(item => {
    const prefix = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
    const side = item.type === 'removed' ? 'old' : 'new';
    const content = renderLineContent(item, side);
    return `<div class="diff-line ${item.type}">${lineNumberCell(item.oldNum)}${lineNumberCell(item.newNum)}${prefix} ${content}</div>`;
  }).join('');
}

function renderSplitCell(item, side) {
  if (!item) return '<div class="split-cell empty"></div>';
  const type = item.type === 'unchanged' ? 'unchanged' : side === 'old' ? 'removed' : 'added';
  const num = side === 'old' ? item.oldNum : item.newNum;
  return `<div class="split-cell ${type}">${lineNumberCell(num)}${renderLineContent(item, side)}</div>`;
}

function renderSplit(diff) {
  // Zip removed/added runs into aligned rows
  const rows = [];
  let k = 0;

  while (k < diff.length) {
    if (diff[k].type === 'unchanged') {
      rows.push([diff[k], diff[k]]);
      k++;
    } else {
      const removed = [];
      while (k < diff.length && diff[k].type === 'removed') removed.push(diff[k++]);
      const added = [];
      while (k < diff.length && diff[k].type === 'added') added.push(diff[k++]);
      const len = Math.max(removed.length, added.length);
      for (let p = 0; p < len; p++) {
        rows.push([removed[p] || null, added[p] || null]);
      }
    }
  }

  return rows.map(([left, right]) =>
    `<div class="split-row">${renderSplitCell(left, 'old')}${renderSplitCell(right, 'new')}</div>`
  ).join('');
}

function renderDiff(diff) {
  let added = 0, removed = 0, unchanged = 0;

  for (const item of diff) {
    if (item.type === 'added') added++;
    else if (item.type === 'removed') removed++;
    else unchanged++;
  }

  diffOutput.innerHTML = viewMode === 'split' ? renderSplit(diff) : renderUnified(diff);
  diffOutput.classList.toggle('split', viewMode === 'split');
  addedCount.textContent = `+${added} added`;
  removedCount.textContent = `-${removed} removed`;
  unchangedCount.textContent = `${unchanged} unchanged`;
  results.classList.remove('hidden');
}

function setViewMode(mode) {
  viewMode = mode;
  unifiedViewBtn.classList.toggle('active', mode === 'unified');
  splitViewBtn.classList.toggle('active', mode === 'split');
  if (currentDiff) renderDiff(currentDiff);
}

diffBtn.addEventListener('click', () => {
  const a = textA.value;
  const b = textB.value;

  if (!a && !b) {
    alert('Enter text in both fields to compare');
    return;
  }

  currentDiff = annotateDiff(computeDiff(a, b));
  renderDiff(currentDiff);
});

unifiedViewBtn.addEventListener('click', () => setViewMode('unified'));
splitViewBtn.addEventListener('click', () => setViewMode('split'));

swapBtn.addEventListener('click', () => {
  const temp = textA.value;
  textA.value = textB.value;
  textB.value = temp;
});

clearBtn.addEventListener('click', () => {
  textA.value = '';
  textB.value = '';
  currentDiff = null;
  results.classList.add('hidden');
});
