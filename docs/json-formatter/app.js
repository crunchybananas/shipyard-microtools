// JSON Formatter
// Format, validate, and minify JSON

const jsonInput = document.getElementById('jsonInput');
const output = document.getElementById('output');
const status = document.getElementById('status');
const stats = document.getElementById('stats');

const formatBtn = document.getElementById('formatBtn');
const minifyBtn = document.getElementById('minifyBtn');
const validateBtn = document.getElementById('validateBtn');
const copyBtn = document.getElementById('copyBtn');

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
    updateStats(formatted);
    showStatus('✓ Formatted successfully', 'success');
  } catch (e) {
    output.textContent = '';
    showStatus(`Invalid JSON: ${e.message}`, 'error');
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
    updateStats(minified);
    showStatus(`✓ Minified: ${input.length} → ${minified.length} chars`, 'success');
  } catch (e) {
    output.textContent = '';
    showStatus(`Invalid JSON: ${e.message}`, 'error');
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
    showStatus(`✗ Invalid: ${e.message}`, 'error');
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
