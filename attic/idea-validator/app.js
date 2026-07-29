// Ship Idea Validator - Local-only tool for Shipyard API

const API_BASE = 'https://shipyard.bot/api';
const LOCAL_PROXY = 'http://localhost:8010/proxy/api';

function getApiBase() {
  if (window.__DOCKHAND_NATIVE__) return API_BASE;
  const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';
  return isLocalhost ? LOCAL_PROXY : API_BASE;
}

function isGitHubPages() {
  if (window.__DOCKHAND_NATIVE__) return false;
  return window.location.hostname.includes('github.io');
}

const state = {
  ships: [],
  lastSync: null,
  loading: false
};

const stopWords = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'with', 'without', 'to', 'of', 'in', 'on',
  'for', 'from', 'by', 'at', 'as', 'is', 'are', 'was', 'were', 'be', 'this', 'that',
  'it', 'its', 'into', 'your', 'you', 'we', 'our', 'their', 'they', 'them', 'i', 'me',
  'my', 'mine', 'can', 'will', 'just', 'not', 'no', 'yes', 'do', 'does', 'did', 'done'
]);

const elements = {
  shipCount: document.getElementById('shipCount'),
  lastSync: document.getElementById('lastSync'),
  includeVerified: document.getElementById('includeVerified'),
  includePending: document.getElementById('includePending'),
  refreshShips: document.getElementById('refreshShips'),
  runAnalysis: document.getElementById('runAnalysis'),
  ideaTitle: document.getElementById('ideaTitle'),
  ideaDescription: document.getElementById('ideaDescription'),
  ideaFeatures: document.getElementById('ideaFeatures'),
  ideaImprovement: document.getElementById('ideaImprovement'),
  matches: document.getElementById('matches'),
  verdict: document.getElementById('verdict'),
  suggestions: document.getElementById('suggestions'),
  corsWarning: document.getElementById('corsWarning')
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function termFrequency(tokens) {
  const tf = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  return tf;
}

function cosineSimilarity(tf1, tf2) {
  const allTokens = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
  let dot = 0;
  let mag1 = 0;
  let mag2 = 0;

  allTokens.forEach(token => {
    const v1 = tf1[token] || 0;
    const v2 = tf2[token] || 0;
    dot += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });

  if (mag1 === 0 || mag2 === 0) return 0;
  return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

function jaccardSimilarity(tokens1, tokens2) {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter(x => set2.has(x));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function computeSimilarity(idea, ship) {
  const ideaTokens = normalizeText(idea);
  const shipTokens = normalizeText(ship);

  const tf1 = termFrequency(ideaTokens);
  const tf2 = termFrequency(shipTokens);

  const cosine = cosineSimilarity(tf1, tf2);
  const jaccard = jaccardSimilarity(ideaTokens, shipTokens);

  return {
    score: (cosine * 0.7) + (jaccard * 0.3),
    cosine,
    jaccard,
    ideaTokens,
    shipTokens
  };
}

async function fetchAllShips() {
  state.loading = true;
  const apiBase = getApiBase();
  const limit = 100;
  let offset = 0;
  let allShips = [];

  while (offset < 1000) {
    const url = `${apiBase}/ships?limit=${limit}&offset=${offset}`;
    const response = await fetch(url);
    if (!response.ok) break;
    const data = await response.json();
    const batch = data.ships || [];
    allShips = allShips.concat(batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  state.ships = allShips;
  state.lastSync = new Date();
  state.loading = false;

  renderStatus();
}

function renderStatus() {
  elements.shipCount.textContent = state.ships.length.toLocaleString();
  elements.lastSync.textContent = state.lastSync ? state.lastSync.toLocaleTimeString() : 'Never';
}

function getFilteredShips() {
  const includeVerified = elements.includeVerified.checked;
  const includePending = elements.includePending.checked;

  return state.ships.filter(ship => {
    if (ship.status === 'verified' && includeVerified) return true;
    if (ship.status === 'pending' && includePending) return true;
    return ship.status !== 'verified' && ship.status !== 'pending' ? true : false;
  });
}

function renderVerdict(topScore) {
  if (!topScore) {
    elements.verdict.textContent = 'Run analysis to see results.';
    elements.verdict.className = 'verdict';
    return;
  }

  if (topScore >= 0.65) {
    elements.verdict.textContent = 'Likely duplicate — consider a different angle.';
    elements.verdict.className = 'verdict bad';
  } else if (topScore >= 0.4) {
    elements.verdict.textContent = 'Similar ideas exist — highlight improvements.';
    elements.verdict.className = 'verdict warn';
  } else {
    elements.verdict.textContent = 'Looks unique — good to proceed.';
    elements.verdict.className = 'verdict good';
  }
}

function renderMatches(matches) {
  if (!matches.length) {
    elements.matches.innerHTML = '<div class="match-card">No matches found.</div>';
    return;
  }

  elements.matches.innerHTML = matches.map(match => {
    const status = match.ship.status || 'unknown';
    const badgeClass = status === 'verified' ? 'verified' : status === 'pending' ? 'pending' : '';

    return `
      <div class="match-card">
        <div class="match-title">
          <h3>${escapeHtml(match.ship.title || 'Untitled')}</h3>
          <div class="match-score">${Math.round(match.score * 100)}% similar</div>
        </div>
        <div class="match-meta">
          <span class="badge ${badgeClass}">${status}</span>
          <span>Ship ID: ${match.ship.id ?? '—'}</span>
          ${match.ship.proof_url ? `<a href="${match.ship.proof_url}" target="_blank" rel="noopener">Proof</a>` : ''}
        </div>
        <div class="match-desc">${escapeHtml(match.ship.description || 'No description provided.')}</div>
      </div>
    `;
  }).join('');
}

function renderSuggestions(topMatch, ideaTokens) {
  if (!topMatch) {
    elements.suggestions.textContent = 'No suggestions yet.';
    elements.suggestions.className = 'suggestions empty';
    return;
  }

  const uniqueTokens = ideaTokens.filter(token => !topMatch.shipTokens.includes(token));
  const improvementText = elements.ideaImprovement.value.trim();

  elements.suggestions.className = 'suggestions';
  elements.suggestions.innerHTML = `
    <div class="suggestion-card">
      <h4>Unique Differentiators</h4>
      ${uniqueTokens.length ? `
        <div class="tag-list">
          ${uniqueTokens.slice(0, 12).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      ` : '<div class="suggestions empty">No clear differentiators detected. Add more detail.</div>'}
    </div>
    <div class="suggestion-card">
      <h4>Improvement Angle</h4>
      <div>${escapeHtml(improvementText || 'Add an improvement angle to help reviewers understand your edge.')}</div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getIdeaText() {
  const title = elements.ideaTitle.value.trim();
  const description = elements.ideaDescription.value.trim();
  const features = elements.ideaFeatures.value.trim();
  const improvement = elements.ideaImprovement.value.trim();
  return [title, description, features, improvement].filter(Boolean).join(' ');
}

function runAnalysis() {
  const ideaText = getIdeaText();
  if (!ideaText) {
    elements.verdict.textContent = 'Add a title or description to analyze.';
    elements.verdict.className = 'verdict warn';
    return;
  }

  const ships = getFilteredShips();
  const matches = ships.map(ship => {
    const shipText = `${ship.title || ''} ${ship.description || ''}`;
    const similarity = computeSimilarity(ideaText, shipText);
    return {
      ship,
      score: similarity.score,
      shipTokens: similarity.shipTokens,
      ideaTokens: similarity.ideaTokens
    };
  }).sort((a, b) => b.score - a.score);

  const topMatches = matches.slice(0, 5);
  renderMatches(topMatches);
  renderVerdict(topMatches[0]?.score);
  renderSuggestions(topMatches[0], topMatches[0]?.ideaTokens || []);
}

async function initialize() {
  if (isGitHubPages()) {
    elements.corsWarning.classList.remove('hidden');
  }

  elements.refreshShips.addEventListener('click', async () => {
    elements.refreshShips.disabled = true;
    elements.refreshShips.textContent = 'Refreshing...';
    await fetchAllShips();
    elements.refreshShips.disabled = false;
    elements.refreshShips.textContent = 'Refresh Ships';
  });

  elements.runAnalysis.addEventListener('click', runAnalysis);

  elements.includePending.addEventListener('change', runAnalysis);
  elements.includeVerified.addEventListener('change', runAnalysis);

  await fetchAllShips();
}

initialize();
