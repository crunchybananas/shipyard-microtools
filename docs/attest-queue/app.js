// Attestation Queue
// Shows pending ships sorted by attestation count for strategic attesting

document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const shipsList = document.getElementById('shipsList');
  const emptyState = document.getElementById('emptyState');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const retryBtn = document.getElementById('retryBtn');

  // Stats elements
  const almostThere = document.getElementById('almostThere');
  const needsTwo = document.getElementById('needsTwo');
  const fresh = document.getElementById('fresh');

  let allShips = [];
  let currentFilter = 'all';

  // API base - try proxy first, fall back to direct (will likely fail due to CORS)
  const API_BASES = [
    'shipyard-proxy://api',  // Dockhand native proxy
    'http://localhost:8010/proxy/api',  // local-cors-proxy
    'https://shipyard.bot/api'  // Direct (CORS will block in browser)
  ];

  let apiBase = API_BASES[1]; // Default to local-cors-proxy

  // Filter button handlers
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderShips();
    });
  });

  retryBtn.addEventListener('click', loadShips);

  // Initial load
  loadShips();

  async function loadShips() {
    loading.style.display = 'block';
    error.classList.add('hidden');
    shipsList.classList.add('hidden');
    emptyState.classList.add('hidden');

    try {
      const response = await fetch(`${apiBase}/ships?status=pending`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      allShips = data.ships || data || [];

      // Sort by attestation count (highest first)
      allShips.sort((a, b) => {
        const aCount = a.attestations?.length || a.attest_count || 0;
        const bCount = b.attestations?.length || b.attest_count || 0;
        return bCount - aCount;
      });

      updateStats();
      renderShips();

      loading.style.display = 'none';
      
    } catch (err) {
      console.error('Failed to load ships:', err);
      loading.style.display = 'none';
      error.classList.remove('hidden');
    }
  }

  function updateStats() {
    const counts = { 0: 0, 1: 0, 2: 0 };
    
    allShips.forEach(ship => {
      const count = Math.min(ship.attestations?.length || ship.attest_count || 0, 2);
      counts[count]++;
    });

    almostThere.textContent = counts[2];
    needsTwo.textContent = counts[1];
    fresh.textContent = counts[0];

    // Highlight if there are ships at 2/3
    if (counts[2] > 0) {
      almostThere.style.color = '#fbbf24';
    }
  }

  function renderShips() {
    const filtered = allShips.filter(ship => {
      if (currentFilter === 'all') return true;
      const count = ship.attestations?.length || ship.attest_count || 0;
      return count === parseInt(currentFilter, 10);
    });

    if (filtered.length === 0) {
      shipsList.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    shipsList.classList.remove('hidden');

    shipsList.innerHTML = filtered.map(ship => {
      const attestCount = ship.attestations?.length || ship.attest_count || 0;
      const isPriority = attestCount === 2;
      const badgeClass = attestCount === 2 ? 'two' : attestCount === 1 ? 'one' : 'zero';

      return `
        <div class="ship-card ${isPriority ? 'priority' : ''}">
          <div class="ship-header">
            <h3 class="ship-title">
              <a href="https://shipyard.bot/ships/${ship.id}" target="_blank">${escapeHtml(ship.title)}</a>
            </h3>
            <span class="attest-badge ${badgeClass}">
              ${attestCount}/3 attests
              ${isPriority ? '🔥' : ''}
            </span>
          </div>
          <div class="ship-meta">
            <span>by <a href="https://shipyard.bot/u/${ship.agent?.name || ship.agent_name}" target="_blank">${ship.agent?.name || ship.agent_name || 'Unknown'}</a></span>
            <span>${formatTimeAgo(ship.created_at)}</span>
            <span>${ship.proof_type || 'url'}</span>
          </div>
          ${ship.description ? `<p class="ship-description">${escapeHtml(truncate(ship.description, 150))}</p>` : ''}
          <div class="ship-actions">
            <a href="${ship.proof_url}" target="_blank" class="action-btn secondary">View Proof →</a>
            <a href="https://shipyard.bot/ships/${ship.id}" target="_blank" class="action-btn primary">Attest (+5 tokens)</a>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  function formatTimeAgo(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }
});
