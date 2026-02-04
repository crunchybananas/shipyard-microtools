// Regex Tester - Pure Vanilla JS
// Test and debug regular expressions with real-time feedback

let pattern = '';
let flags = 'g';
let testString = '';
let savedPatterns = [];

// Load saved patterns from localStorage
function loadSavedPatterns() {
  const saved = localStorage.getItem('regexPatterns');
  savedPatterns = saved ? JSON.parse(saved) : [];
  renderSavedPatterns();
}

// Save pattern
function savePattern() {
  if (!pattern) {
    showToast('Enter a pattern to save', 'error');
    return;
  }

  const name = prompt('Enter a name for this pattern:');
  if (!name) return;

  savedPatterns.push({
    id: Date.now(),
    name,
    pattern,
    flags,
    timestamp: new Date().toISOString()
  });

  localStorage.setItem('regexPatterns', JSON.stringify(savedPatterns));
  renderSavedPatterns();
  showToast('Pattern saved!');
}

// Load pattern
function loadPattern(id) {
  const saved = savedPatterns.find(p => p.id === id);
  if (!saved) return;

  pattern = saved.pattern;
  flags = saved.flags;

  document.getElementById('pattern').value = pattern;
  
  // Update flag checkboxes
  ['g', 'i', 'm', 's', 'u'].forEach(flag => {
    document.getElementById(`flag${flag.toUpperCase()}`).checked = flags.includes(flag);
  });

  updateMatches();
  showToast('Pattern loaded!');
}

// Delete pattern
function deletePattern(id) {
  if (!confirm('Delete this saved pattern?')) return;

  savedPatterns = savedPatterns.filter(p => p.id !== id);
  localStorage.setItem('regexPatterns', JSON.stringify(savedPatterns));
  renderSavedPatterns();
  showToast('Pattern deleted');
}

// Render saved patterns
function renderSavedPatterns() {
  const container = document.getElementById('savedPatterns');

  if (savedPatterns.length === 0) {
    container.innerHTML = '<div class="empty-state">No saved patterns yet. Save your first pattern!</div>';
    return;
  }

  container.innerHTML = savedPatterns.map(p => `
    <div class="saved-pattern">
      <div class="saved-pattern-name">${escapeHtml(p.name)}</div>
      <div class="saved-pattern-regex">/${escapeHtml(p.pattern)}/${p.flags}</div>
      <div class="saved-pattern-actions">
        <button class="saved-pattern-btn load" onclick="loadPattern(${p.id})">Load</button>
        <button class="saved-pattern-btn delete" onclick="deletePattern(${p.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

// Test regex and update UI
function updateMatches() {
  const errorEl = document.getElementById('patternError');
  const highlightedEl = document.getElementById('highlightedText');
  const matchDetailsEl = document.getElementById('matchDetails');
  const matchCountEl = document.getElementById('matchCount');
  const matchInfoEl = document.getElementById('matchInfo');

  errorEl.classList.remove('visible');
  
  if (!pattern) {
    highlightedEl.textContent = testString || 'Enter a pattern and test string...';
    matchDetailsEl.innerHTML = '';
    matchCountEl.textContent = '0 matches';
    matchInfoEl.textContent = '';
    updateSubstitution();
    return;
  }

  let regex;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    errorEl.textContent = `Error: ${e.message}`;
    errorEl.classList.add('visible');
    highlightedEl.textContent = testString || 'Invalid regex pattern';
    matchDetailsEl.innerHTML = '';
    matchCountEl.textContent = '0 matches';
    matchInfoEl.textContent = '';
    return;
  }

  const matches = [...testString.matchAll(regex)];
  matchCountEl.textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;

  // Highlight matches in text
  if (matches.length > 0) {
    let highlighted = '';
    let lastIndex = 0;

    matches.forEach(match => {
      highlighted += escapeHtml(testString.slice(lastIndex, match.index));
      highlighted += `<span class="match-highlight">${escapeHtml(match[0])}</span>`;
      lastIndex = match.index + match[0].length;
    });
    highlighted += escapeHtml(testString.slice(lastIndex));
    
    highlightedEl.innerHTML = highlighted || 'No text to display';
  } else {
    highlightedEl.textContent = testString || 'No matches found';
  }

  // Match details
  if (matches.length > 0) {
    matchDetailsEl.innerHTML = matches.map((match, i) => {
      let groups = '';
      if (match.length > 1) {
        groups = '<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb;">';
        groups += '<div style="font-weight: 600; margin-bottom: 0.5rem; font-size: 0.75rem; color: #6b7280;">GROUPS:</div>';
        for (let j = 1; j < match.length; j++) {
          groups += `<div style="margin-bottom: 0.25rem;"><span style="color: #6366f1; font-weight: 600;">$${j}:</span> <code style="background: #e5e7eb; padding: 0.125rem 0.375rem; border-radius: 0.25rem;">${escapeHtml(match[j] || '')}</code></div>`;
        }
        groups += '</div>';
      }

      return `
        <div class="match-card">
          <div class="match-card-header">Match ${i + 1}</div>
          <div class="match-value">${escapeHtml(match[0])}</div>
          <div class="match-meta">
            <span>Index: ${match.index}</span>
            <span>Length: ${match[0].length}</span>
          </div>
          ${groups}
        </div>
      `;
    }).join('');

    // Summary info
    const avgLength = matches.reduce((sum, m) => sum + m[0].length, 0) / matches.length;
    matchInfoEl.innerHTML = `
      <strong>${matches.length}</strong> matches found • 
      Average length: <strong>${avgLength.toFixed(1)}</strong> characters • 
      Coverage: <strong>${((matches.reduce((sum, m) => sum + m[0].length, 0) / testString.length) * 100).toFixed(1)}%</strong>
    `;
  } else {
    matchDetailsEl.innerHTML = '';
    matchInfoEl.textContent = testString ? 'No matches found in test string' : 'Enter test string to begin';
  }

  updateSubstitution();
}

// Update substitution result
function updateSubstitution() {
  const replacement = document.getElementById('replacement').value;
  const resultEl = document.getElementById('substitutionResult');

  if (!pattern || !testString || !replacement) {
    resultEl.textContent = 'Enter a pattern, test string, and replacement to see result...';
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    const result = testString.replace(regex, replacement);
    resultEl.textContent = result;
  } catch (e) {
    resultEl.textContent = `Error: ${e.message}`;
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!');
  });
}

function showToast(message, type = 'success') {
  const existingToast = document.querySelector('.toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  const bgColor = type === 'error' ? '#dc2626' : '#10b981';
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const patternInput = document.getElementById('pattern');
  const testStringInput = document.getElementById('testString');
  const replacementInput = document.getElementById('replacement');
  const flagCheckboxes = document.querySelectorAll('.flag-label input');
  const clearAllBtn = document.getElementById('clearAll');
  const savePatternBtn = document.getElementById('savePattern');
  const copySubstitutionBtn = document.getElementById('copySubstitution');
  const patternButtons = document.querySelectorAll('.pattern-btn');

  // Load saved patterns
  loadSavedPatterns();

  // Pattern input
  patternInput.addEventListener('input', (e) => {
    pattern = e.target.value;
    updateMatches();
  });

  // Test string input
  testStringInput.addEventListener('input', (e) => {
    testString = e.target.value;
    updateMatches();
  });

  // Replacement input
  replacementInput.addEventListener('input', () => {
    updateSubstitution();
  });

  // Flag changes
  flagCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      flags = Array.from(flagCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value)
        .join('');
      updateMatches();
    });
  });

  // Clear all
  clearAllBtn.addEventListener('click', () => {
    if (!pattern && !testString) return;
    
    if (confirm('Clear pattern and test string?')) {
      pattern = '';
      testString = '';
      patternInput.value = '';
      testStringInput.value = '';
      replacementInput.value = '';
      updateMatches();
      showToast('Cleared!');
    }
  });

  // Save pattern
  savePatternBtn.addEventListener('click', savePattern);

  // Copy substitution
  copySubstitutionBtn.addEventListener('click', () => {
    const result = document.getElementById('substitutionResult').textContent;
    if (result && !result.startsWith('Enter') && !result.startsWith('Error')) {
      copyToClipboard(result);
    } else {
      showToast('Nothing to copy', 'error');
    }
  });

  // Quick pattern buttons
  patternButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      pattern = btn.dataset.pattern;
      patternInput.value = pattern;
      
      const btnFlags = btn.dataset.flags || '';
      flagCheckboxes.forEach(cb => {
        cb.checked = btnFlags.includes(cb.value);
      });
      
      flags = btnFlags;
      updateMatches();
      showToast(`Loaded ${btn.textContent} pattern`);
    });
  });

  // Sample test string
  testString = `Contact us at: support@example.com or admin@shipyard.bot
Visit our website: https://shipyard.bot
Call us: +1-555-123-4567 or (555) 987-6543

Colors: #FF5733, #C70039, #900C3F, #581845
IP Addresses: 192.168.1.1, 10.0.0.1, 172.16.0.1

Strong passwords must have:
- At least 8 characters
- Uppercase and lowercase letters
- Numbers and special characters
Example: MyP@ssw0rd123!`;

  testStringInput.value = testString;
  updateMatches();
});

// Make functions global for inline onclick handlers
window.loadPattern = loadPattern;
window.deletePattern = deletePattern;

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);
