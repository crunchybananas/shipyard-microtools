// Proof URL Health Checker
// Batch validate proof URLs with various checks

const urlsInput = document.getElementById('urlsInput');
const checkSsl = document.getElementById('checkSsl');
const checkSpeed = document.getElementById('checkSpeed');
const checkBtn = document.getElementById('checkBtn');
const resultsDiv = document.getElementById('results');
const resultsList = document.getElementById('resultsList');

checkBtn.addEventListener('click', checkAllUrls);

async function checkAllUrls() {
  const urlsText = urlsInput.value.trim();
  if (!urlsText) {
    alert('Please enter at least one URL');
    return;
  }

  const urls = urlsText
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0);

  if (urls.length === 0) {
    alert('Please enter valid URLs');
    return;
  }

  // Show loading state
  checkBtn.disabled = true;
  checkBtn.querySelector('.btn-text').style.display = 'none';
  checkBtn.querySelector('.btn-loading').style.display = 'inline';

  // Show results section
  resultsDiv.classList.remove('hidden');
  resultsList.innerHTML = '';

  // Initialize counters
  let healthy = 0;
  let warnings = 0;
  let errors = 0;

  document.getElementById('totalCount').textContent = urls.length;
  document.getElementById('healthyCount').textContent = '0';
  document.getElementById('warningCount').textContent = '0';
  document.getElementById('errorCount').textContent = '0';

  // Create placeholder cards
  urls.forEach((url, index) => {
    const card = createResultCard(url, index, 'checking');
    resultsList.appendChild(card);
  });

  // Check each URL
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await checkUrl(url);
    
    // Update the card
    const card = resultsList.children[i];
    updateResultCard(card, result);

    // Update counters
    if (result.status === 'healthy') healthy++;
    else if (result.status === 'warning') warnings++;
    else errors++;

    document.getElementById('healthyCount').textContent = healthy;
    document.getElementById('warningCount').textContent = warnings;
    document.getElementById('errorCount').textContent = errors;

    // Small delay between checks to avoid overwhelming
    if (i < urls.length - 1) {
      await sleep(200);
    }
  }

  // Reset button
  checkBtn.disabled = false;
  checkBtn.querySelector('.btn-text').style.display = 'inline';
  checkBtn.querySelector('.btn-loading').style.display = 'none';
}

async function checkUrl(url) {
  const result = {
    url: url,
    status: 'healthy',
    statusCode: null,
    loadTime: null,
    ssl: null,
    issues: [],
    details: {}
  };

  // Normalize URL
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url;
  }

  try {
    const urlObj = new URL(normalizedUrl);
    result.details.protocol = urlObj.protocol.replace(':', '');
    result.details.host = urlObj.host;

    // Check for common issues
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      result.status = 'error';
      result.issues.push({ text: 'Localhost URL - not publicly accessible', type: 'error' });
      return result;
    }

    // SSL check
    if (checkSsl.checked) {
      if (urlObj.protocol === 'https:') {
        result.ssl = true;
        result.details.ssl = 'Valid';
      } else {
        result.ssl = false;
        result.details.ssl = 'No HTTPS';
        result.issues.push({ text: 'No SSL/HTTPS - security risk', type: 'warn' });
        if (result.status === 'healthy') result.status = 'warning';
      }
    }

    // Try to fetch the URL
    const startTime = performance.now();
    
    try {
      // Use fetch with no-cors as fallback for CORS-blocked resources
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(normalizedUrl, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal
      }).catch(async () => {
        // CORS blocked - try no-cors (we won't get status but can detect if resource exists)
        return fetch(normalizedUrl, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        });
      });

      clearTimeout(timeout);
      
      const endTime = performance.now();
      const loadTime = Math.round(endTime - startTime);

      if (checkSpeed.checked) {
        result.loadTime = loadTime;
        result.details.loadTime = `${loadTime}ms`;
        
        if (loadTime > 5000) {
          result.issues.push({ text: 'Very slow response (>5s)', type: 'warn' });
          if (result.status === 'healthy') result.status = 'warning';
        } else if (loadTime > 2000) {
          result.issues.push({ text: 'Slow response (>2s)', type: 'warn' });
        }
      }

      // Check response status if available
      if (response.type !== 'opaque') {
        result.statusCode = response.status;
        result.details.statusCode = response.status;

        if (response.status >= 200 && response.status < 300) {
          result.details.statusText = 'OK';
        } else if (response.status >= 300 && response.status < 400) {
          result.details.statusText = 'Redirect';
          result.issues.push({ text: `Redirects (${response.status})`, type: 'warn' });
        } else if (response.status >= 400 && response.status < 500) {
          result.details.statusText = 'Client Error';
          result.issues.push({ text: `Client error (${response.status})`, type: 'error' });
          result.status = 'error';
        } else if (response.status >= 500) {
          result.details.statusText = 'Server Error';
          result.issues.push({ text: `Server error (${response.status})`, type: 'error' });
          result.status = 'error';
        }
      } else {
        // Opaque response from no-cors - something responded, but the browser
        // hides the status code, so we cannot actually verify health
        result.details.opaque = true;
        result.details.statusCode = 'unknown (opaque)';
        result.details.statusText = 'Unknown';
        result.issues.push({ text: 'Opaque response (CORS) - reachability only, health not verified', type: 'warn' });
        if (result.status === 'healthy') result.status = 'warning';
      }

    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        result.status = 'error';
        result.issues.push({ text: 'Request timeout (>10s)', type: 'error' });
        result.details.statusText = 'Timeout';
      } else {
        // Network error - could be CORS, could be unreachable
        result.status = 'warning';
        result.issues.push({ text: 'Could not verify (CORS/network issue)', type: 'warn' });
        result.details.statusText = 'Unknown';
      }
    }

    // GitHub-specific checks
    if (urlObj.hostname === 'github.com') {
      const pathParts = urlObj.pathname.split('/').filter(p => p);
      if (pathParts.length >= 2) {
        result.details.repo = `${pathParts[0]}/${pathParts[1]}`;
      }
      if (pathParts.length < 2) {
        result.issues.push({ text: 'Not a valid repo URL', type: 'warn' });
        if (result.status === 'healthy') result.status = 'warning';
      }
    }

    // Check for common deployment platforms
    if (urlObj.hostname.includes('vercel.app') ||
        urlObj.hostname.includes('netlify.app') ||
        urlObj.hostname.includes('github.io')) {
      result.details.platform = 'Hosted demo ✓';
    }

  } catch (e) {
    result.status = 'error';
    result.issues.push({ text: 'Invalid URL format', type: 'error' });
  }

  // Determine final status based on issues
  if (result.issues.some(i => i.type === 'error')) {
    result.status = 'error';
  } else if (result.issues.some(i => i.type === 'warn') && result.status === 'healthy') {
    result.status = 'warning';
  }

  return result;
}

function createResultCard(url, index, status) {
  // Built with DOM nodes (not innerHTML) so untrusted URLs can never break
  // out of an attribute context
  const card = document.createElement('div');
  card.className = `result-card ${status}`;

  const header = document.createElement('div');
  header.className = 'result-header';

  const icon = document.createElement('span');
  icon.className = 'status-icon';
  icon.textContent = getStatusIcon(status);
  header.appendChild(icon);

  const urlSpan = document.createElement('span');
  urlSpan.className = 'result-url';
  const href = safeHref(url);
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = url;
    urlSpan.appendChild(link);
  } else {
    // Not a valid http(s) URL - show as plain text, never as a link
    urlSpan.textContent = url;
  }
  header.appendChild(urlSpan);

  const badge = document.createElement('span');
  badge.className = `status-badge ${status}`;
  badge.textContent = status;
  header.appendChild(badge);

  const details = document.createElement('div');
  details.className = 'result-details';
  const checking = document.createElement('span');
  checking.className = 'detail-item';
  checking.textContent = 'Checking...';
  details.appendChild(checking);

  card.appendChild(header);
  card.appendChild(details);
  return card;
}

// Returns a normalized http(s) href for a user-entered URL, or null if it
// does not parse as a safe web URL (blocks javascript: and friends)
function safeHref(url) {
  let normalized = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalized = 'https://' + url;
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch (e) {
    // fall through
  }
  return null;
}

function updateResultCard(card, result) {
  card.className = `result-card ${result.status}`;
  
  const header = card.querySelector('.result-header');
  header.querySelector('.status-icon').textContent = getStatusIcon(result.status);
  header.querySelector('.status-badge').className = `status-badge ${result.status}`;
  header.querySelector('.status-badge').textContent = result.status;

  // Build details
  const detailsDiv = card.querySelector('.result-details');
  let detailsHtml = '';

  if (result.details.statusCode !== undefined) {
    const statusClass = result.statusCode >= 200 && result.statusCode < 400 ? 'good' :
                        result.statusCode >= 400 ? 'bad' : '';
    const opaqueTitle = result.details.opaque
      ? ' title="The server responded, but browser CORS policy hides the status code (opaque no-cors response). The URL is reachable, but its health could not be verified."'
      : '';
    detailsHtml += `<span class="detail-item ${statusClass}"${opaqueTitle}>Status: <span>${escapeHtml(result.details.statusCode)}</span></span>`;
  }

  if (result.details.ssl !== undefined) {
    const sslClass = result.ssl ? 'good' : 'warn';
    detailsHtml += `<span class="detail-item ${sslClass}">SSL: <span>${escapeHtml(result.details.ssl)}</span></span>`;
  }

  if (result.details.loadTime !== undefined) {
    const speedClass = result.loadTime < 1000 ? 'good' : result.loadTime < 3000 ? '' : 'warn';
    detailsHtml += `<span class="detail-item ${speedClass}">Load: <span>${escapeHtml(result.details.loadTime)}</span></span>`;
  }

  if (result.details.platform) {
    detailsHtml += `<span class="detail-item good">${escapeHtml(result.details.platform)}</span>`;
  }

  if (result.details.repo) {
    detailsHtml += `<span class="detail-item">Repo: <span>${escapeHtml(result.details.repo)}</span></span>`;
  }

  detailsDiv.innerHTML = detailsHtml || '<span class="detail-item">No details available</span>';

  // Add issues if any
  if (result.issues.length > 0) {
    let issuesHtml = '<ul class="issues-list">';
    result.issues.forEach(issue => {
      issuesHtml += `<li class="${issue.type}">${escapeHtml(issue.text)}</li>`;
    });
    issuesHtml += '</ul>';
    detailsDiv.insertAdjacentHTML('afterend', issuesHtml);
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'healthy': return '✅';
    case 'warning': return '⚠️';
    case 'error': return '❌';
    case 'checking': return '🔄';
    default: return '❓';
  }
}

function escapeHtml(text) {
  // Explicit replacement (not the div/innerHTML trick, which misses quotes)
  // so the output is safe in both text and attribute contexts
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
