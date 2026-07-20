// Ship Preflight Checker
// Validates ships before submission to POST /api/ships

document.addEventListener('DOMContentLoaded', () => {
  const shipTitle = document.getElementById('shipTitle');
  const proofUrl = document.getElementById('proofUrl');
  const proofType = document.getElementById('proofType');
  const description = document.getElementById('description');
  const checkBtn = document.getElementById('checkBtn');
  const results = document.getElementById('results');
  const titleCount = document.getElementById('titleCount');
  const descCount = document.getElementById('descCount');

  // Character counters
  shipTitle.addEventListener('input', () => {
    titleCount.textContent = shipTitle.value.length;
    titleCount.style.color = shipTitle.value.length > 200 ? '#ef4444' : '#64748b';
  });

  description.addEventListener('input', () => {
    descCount.textContent = description.value.length;
  });

  // Copy payload button
  document.getElementById('copyPayload').addEventListener('click', async () => {
    const code = document.getElementById('payloadCode').textContent;
    try {
      await navigator.clipboard.writeText(code);
      document.getElementById('copyPayload').textContent = '✓ Copied!';
      setTimeout(() => {
        document.getElementById('copyPayload').textContent = '📋 Copy Payload';
      }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });

  checkBtn.addEventListener('click', runPreflightCheck);

  async function runPreflightCheck() {
    const title = shipTitle.value.trim();
    const url = proofUrl.value.trim();
    const type = proofType.value;
    const desc = description.value.trim();

    // Show loading
    checkBtn.disabled = true;
    checkBtn.querySelector('.btn-text').style.display = 'none';
    checkBtn.querySelector('.btn-loading').style.display = 'inline';

    // Reset all checks
    document.querySelectorAll('.check-item').forEach(item => {
      item.className = 'check-item';
      item.querySelector('.check-icon').textContent = '⏳';
      item.querySelector('.check-message').textContent = 'Checking...';
    });

    results.classList.remove('hidden');

    const checks = {
      title: { pass: false, message: '', icon: '❌' },
      url: { pass: false, message: '', icon: '❌' },
      type: { pass: false, message: '', icon: '❌' },
      desc: { pass: false, message: '', icon: '❌' },
      unique: { pass: false, message: '', icon: '❌' }
    };

    const suggestions = [];

    // Simulate async checks with small delays for UX
    await delay(200);

    // === TITLE CHECK ===
    if (!title) {
      checks.title = { pass: false, message: 'Title is required', icon: '❌' };
      suggestions.push('Add a descriptive title (3-200 characters)');
    } else if (title.length < 3) {
      checks.title = { pass: false, message: 'Too short (min 3 chars)', icon: '❌' };
      suggestions.push('Make your title more descriptive');
    } else if (title.length > 200) {
      checks.title = { pass: false, message: 'Too long (max 200 chars)', icon: '❌' };
      suggestions.push('Shorten your title to under 200 characters');
    } else {
      checks.title = { pass: true, message: `${title.length} chars — looks good!`, icon: '✅' };
    }
    updateCheck('title', checks.title);
    await delay(150);

    // === URL CHECK ===
    if (!url) {
      checks.url = { pass: false, message: 'Proof URL is required', icon: '❌' };
      suggestions.push('Add a proof URL (GitHub repo, demo, etc.)');
    } else if (!isValidUrl(url)) {
      checks.url = { pass: false, message: 'Invalid URL format', icon: '❌' };
      suggestions.push('Enter a valid URL starting with http:// or https://');
    } else if (url.includes('localhost') || url.includes('127.0.0.1')) {
      checks.url = { pass: false, message: 'Localhost URLs are not accessible', icon: '❌' };
      suggestions.push('Deploy your proof to a public URL');
    } else if (!url.startsWith('https://')) {
      checks.url = { pass: 'warn', message: 'Not HTTPS — may be flagged', icon: '⚠️' };
      suggestions.push('Consider using HTTPS for better trust');
    } else {
      checks.url = { pass: true, message: 'Valid HTTPS URL', icon: '✅' };
    }
    updateCheck('url', checks.url);
    await delay(150);

    // === PROOF TYPE MATCH ===
    const urlLower = url.toLowerCase();
    let typeMatch = true;
    let typeMessage = '';

    if (type === 'github' && !urlLower.includes('github.com')) {
      typeMatch = false;
      typeMessage = 'Selected GitHub but URL is not github.com';
      suggestions.push('Change proof type or use a GitHub URL');
    } else if (type === 'demo' && urlLower.includes('github.com') && !urlLower.includes('github.io')) {
      typeMatch = 'warn';
      typeMessage = 'Demo type but URL looks like a repo';
      suggestions.push('If this is a live demo, consider using GitHub Pages URL');
    } else {
      typeMessage = `Type "${type}" matches URL pattern`;
    }

    checks.type = {
      pass: typeMatch === true,
      message: typeMessage,
      icon: typeMatch === true ? '✅' : typeMatch === 'warn' ? '⚠️' : '❌'
    };
    if (typeMatch === 'warn') checks.type.pass = 'warn';
    updateCheck('type', checks.type);
    await delay(150);

    // === DESCRIPTION CHECK ===
    if (!desc) {
      checks.desc = { pass: 'warn', message: 'No description (optional but recommended)', icon: '⚠️' };
      suggestions.push('Add a description to help attestors understand your ship');
    } else if (desc.length < 20) {
      checks.desc = { pass: 'warn', message: 'Very short description', icon: '⚠️' };
      suggestions.push('Expand your description for better attestation chances');
    } else if (desc.length > 50) {
      checks.desc = { pass: true, message: `${desc.length} chars — great detail!`, icon: '✅' };
    } else {
      checks.desc = { pass: true, message: `${desc.length} chars — good`, icon: '✅' };
    }
    updateCheck('desc', checks.desc);
    await delay(150);

    // === UNIQUENESS CHECK (heuristic) ===
    const commonWords = ['test', 'hello', 'example', 'demo', 'sample', 'untitled'];
    const titleLower = title.toLowerCase();
    const hasCommonWord = commonWords.some(word => titleLower.includes(word));

    if (hasCommonWord) {
      checks.unique = { pass: 'warn', message: 'Title may not stand out', icon: '⚠️' };
      suggestions.push('Make your title more unique and descriptive');
    } else {
      checks.unique = { pass: true, message: 'Title looks unique', icon: '✅' };
    }
    updateCheck('unique', checks.unique);

    // Calculate overall status
    const passCount = Object.values(checks).filter(c => c.pass === true).length;
    const warnCount = Object.values(checks).filter(c => c.pass === 'warn').length;
    const failCount = Object.values(checks).filter(c => c.pass === false).length;

    const overallStatus = document.getElementById('overallStatus');
    const suggestionsDiv = document.getElementById('suggestions');
    const apiPayloadDiv = document.getElementById('apiPayload');

    if (failCount > 0) {
      overallStatus.className = 'overall-status fail';
      overallStatus.textContent = `❌ ${failCount} issue(s) must be fixed before submitting`;
      apiPayloadDiv.classList.add('hidden');
    } else if (warnCount > 0) {
      overallStatus.className = 'overall-status warn';
      overallStatus.textContent = `⚠️ Passes with ${warnCount} warning(s) — consider improvements`;
      showPayload(title, url, type, desc);
    } else {
      overallStatus.className = 'overall-status pass';
      overallStatus.textContent = '✅ All checks passed — ready to ship!';
      showPayload(title, url, type, desc);
    }

    // Show suggestions
    if (suggestions.length > 0) {
      suggestionsDiv.classList.remove('hidden');
      document.getElementById('suggestionsList').innerHTML = suggestions
        .map(s => `<li>${s}</li>`)
        .join('');
    } else {
      suggestionsDiv.classList.add('hidden');
    }

    // Reset button
    checkBtn.disabled = false;
    checkBtn.querySelector('.btn-text').style.display = 'inline';
    checkBtn.querySelector('.btn-loading').style.display = 'none';
  }

  function updateCheck(id, check) {
    const item = document.getElementById(`check-${id}`);
    item.className = `check-item ${check.pass === true ? 'pass' : check.pass === 'warn' ? 'warn' : 'fail'}`;
    item.querySelector('.check-icon').textContent = check.icon;
    item.querySelector('.check-message').textContent = check.message;
  }

  function showPayload(title, url, type, desc) {
    const payload = {
      title: title,
      proof_url: url,
      proof_type: type
    };
    if (desc) {
      payload.description = desc;
    }

    document.getElementById('payloadCode').textContent = JSON.stringify(payload, null, 2);
    document.getElementById('apiPayload').classList.remove('hidden');
  }

  function isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
