// Attestation Tracker - Shipyard Microtools
// Shows pending ships that need attestations, sorted by urgency

const API_BASE = 'https://shipyard.bot/api';
const LOCAL_PROXY = 'http://localhost:8010/proxy/api';

// Use local proxy on localhost (due to CORS), direct API on GitHub Pages
function getApiBase() {
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.protocol === 'file:';
    return isLocalhost ? LOCAL_PROXY : API_BASE;
}

// Check if we're on GitHub Pages (API won't work due to CORS)
function isGitHubPages() {
    return window.location.hostname.includes('github.io');
}

const state = {
    ships: [],
    sortBy: 'attestations-desc',
    filterBy: 'all',
    corsError: false,
};

const elements = {
    loading: document.getElementById('loading'),
    shipsList: document.getElementById('shipsList'),
    almostThereCount: document.getElementById('almostThereCount'),
    needsOneCount: document.getElementById('needsOneCount'),
    totalPending: document.getElementById('totalPending'),
    potentialReward: document.getElementById('potentialReward'),
    sortBy: document.getElementById('sortBy'),
    filterBy: document.getElementById('filterBy'),
    refreshBtn: document.getElementById('refreshBtn'),
};

// Fetch pending ships from API
async function fetchPendingShips() {
    const apiBase = getApiBase();
    try {
        const response = await fetch(`${apiBase}/ships?status=pending&limit=100`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        state.corsError = false;
        return data.ships || [];
    } catch (error) {
        console.error('Failed to fetch ships:', error);
        if (isGitHubPages()) {
            state.corsError = true;
        }
        return [];
    }
}

// Update statistics display
function updateStats() {
    const almostThere = state.ships.filter(s => (s.attestations || 0) === 2).length;
    const needsOne = state.ships.filter(s => (s.attestations || 0) === 1).length;
    const total = state.ships.length;
    const reward = total * 5; // 5 tokens per attestation

    elements.almostThereCount.textContent = almostThere;
    elements.needsOneCount.textContent = needsOne;
    elements.totalPending.textContent = total;
    elements.potentialReward.textContent = `+${reward}`;
}

// Filter ships based on current filter
function getFilteredShips() {
    let filtered = [...state.ships];

    switch (state.filterBy) {
        case 'almost':
            filtered = filtered.filter(s => (s.attestations || 0) === 2);
            break;
        case 'halfway':
            filtered = filtered.filter(s => (s.attestations || 0) === 1);
            break;
        case 'new':
            filtered = filtered.filter(s => (s.attestations || 0) === 0);
            break;
    }

    return filtered;
}

// Sort ships based on current sort option
function getSortedShips(ships) {
    const sorted = [...ships];

    switch (state.sortBy) {
        case 'attestations-desc':
            sorted.sort((a, b) => (b.attestations || 0) - (a.attestations || 0));
            break;
        case 'attestations-asc':
            sorted.sort((a, b) => (a.attestations || 0) - (b.attestations || 0));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            break;
        case 'newest':
            sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            break;
    }

    return sorted;
}

// Format relative time
function formatRelativeTime(dateString) {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d ago`;
    } else if (diffHours > 0) {
        return `${diffHours}h ago`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes}m ago`;
    }
}

// Get badge class based on attestation count
function getBadgeClass(count) {
    if (count === 2) return 'almost';
    if (count === 1) return 'halfway';
    return 'new';
}

// Render a single ship card
function renderShipCard(ship) {
    const attestations = ship.attestations || 0;
    const badgeClass = getBadgeClass(attestations);
    const isAlmostThere = attestations === 2;

    const proofUrl = ship.proof_url || ship.proofUrl || '';
    const authorName = ship.author_name || ship.authorName || ship.agent_name || 'Unknown';

    return `
        <div class="ship-card ${isAlmostThere ? 'almost-there' : ''}">
            <div class="ship-header">
                <div>
                    <div class="ship-title">${escapeHtml(ship.title)}</div>
                    <div class="ship-meta">
                        by ${escapeHtml(authorName)} • ${formatRelativeTime(ship.created_at)}
                    </div>
                </div>
                <div class="attestation-badge ${badgeClass}">
                    <div class="attestation-dots">
                        ${[0, 1, 2].map(i => `<span class="dot ${i < attestations ? 'filled' : ''}"></span>`).join('')}
                    </div>
                    <span>${attestations}/3</span>
                </div>
            </div>
            ${ship.description ? `<div class="ship-description">${escapeHtml(ship.description)}</div>` : ''}
            <div class="ship-footer">
                <div class="reward-info">
                    <span class="icon">💰</span>
                    <span>+5 tokens for attesting</span>
                </div>
                <div class="ship-actions">
                    ${proofUrl ? `<a href="${escapeHtml(proofUrl)}" target="_blank" rel="noopener" class="btn btn-secondary">View Proof</a>` : ''}
                    <a href="https://shipyard.bot/ships/${ship.id}" target="_blank" rel="noopener" class="btn btn-primary">
                        ${isAlmostThere ? '🎯 Help Verify' : 'Review Ship'}
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Render the ships list
function renderShipsList() {
    // Check for CORS error first
    if (state.corsError) {
        elements.shipsList.innerHTML = `
            <div class="empty-state">
                <div class="icon">🔒</div>
                <h3>CORS Restriction</h3>
                <p>The Shipyard API doesn't allow cross-origin requests from GitHub Pages.</p>
                <p style="margin-top: 1rem;"><strong>To run locally:</strong></p>
                <pre style="text-align: left; background: var(--surface); padding: 1rem; border-radius: 8px; margin-top: 0.5rem; font-size: 0.9rem;">
# Clone the repo
git clone https://github.com/crunchybananas/shipyard-microtools.git
cd shipyard-microtools

# Start a CORS proxy (terminal 1)
npx local-cors-proxy --proxyUrl https://shipyard.bot --port 8010

# Serve the docs folder (terminal 2)
npx serve docs</pre>
                <p style="margin-top: 1rem;">Then open <a href="http://localhost:3000/attestation-tracker">http://localhost:3000/attestation-tracker</a></p>
            </div>
        `;
        return;
    }

    const filtered = getFilteredShips();
    const sorted = getSortedShips(filtered);

    if (sorted.length === 0) {
        elements.shipsList.innerHTML = `
            <div class="empty-state">
                <div class="icon">🎉</div>
                <h3>All caught up!</h3>
                <p>No ships match your current filter. Try adjusting the filters or check back later.</p>
            </div>
        `;
        return;
    }

    elements.shipsList.innerHTML = sorted.map(renderShipCard).join('');
}

// Initialize the app
async function init() {
    elements.loading.style.display = 'block';
    elements.shipsList.innerHTML = '';

    state.ships = await fetchPendingShips();

    elements.loading.style.display = 'none';
    updateStats();
    renderShipsList();
}

// Event listeners
elements.sortBy.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderShipsList();
});

elements.filterBy.addEventListener('change', (e) => {
    state.filterBy = e.target.value;
    renderShipsList();
});

elements.refreshBtn.addEventListener('click', () => {
    init();
});

// Start the app
init();
