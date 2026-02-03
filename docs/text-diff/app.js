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

function renderDiff(diff) {
  let added = 0, removed = 0, unchanged = 0;
  let lineNum = 0;
  
  const html = diff.map(item => {
    lineNum++;
    const prefix = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
    const lineNumStr = String(lineNum).padStart(3, ' ');
    
    if (item.type === 'added') added++;
    else if (item.type === 'removed') removed++;
    else unchanged++;
    
    const escapedLine = item.line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    return `<div class="diff-line ${item.type}"><span class="line-number">${lineNumStr}</span>${prefix} ${escapedLine}</div>`;
  }).join('');
  
  diffOutput.innerHTML = html;
  addedCount.textContent = `+${added} added`;
  removedCount.textContent = `-${removed} removed`;
  unchangedCount.textContent = `${unchanged} unchanged`;
  results.classList.remove('hidden');
}

diffBtn.addEventListener('click', () => {
  const a = textA.value;
  const b = textB.value;
  
  if (!a && !b) {
    alert('Enter text in both fields to compare');
    return;
  }
  
  const diff = computeDiff(a, b);
  renderDiff(diff);
});

swapBtn.addEventListener('click', () => {
  const temp = textA.value;
  textA.value = textB.value;
  textB.value = temp;
});

clearBtn.addEventListener('click', () => {
  textA.value = '';
  textB.value = '';
  results.classList.add('hidden');
});
