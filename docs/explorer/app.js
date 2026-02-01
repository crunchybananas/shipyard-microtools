// Shipyard Explorer - Platform Dashboard
// Real-time platform health and activity monitoring

const API_BASE = 'https://shipyard.bot/api';
const DOCKHAND_PROXY = 'shipyard-proxy://shipyard.bot/api';
const LOCAL_PROXY = 'http://localhost:8010/proxy/api';

// Use local proxy on localhost (due to CORS), direct API on GitHub Pages
// Native apps (Dockhand) set __DOCKHAND_NATIVE__ to bypass CORS detection
function getApiBase() {
    // Native app bypasses CORS
    if (window.__DOCKHAND_NATIVE__) return DOCKHAND_PROXY;
    
    const isLocalhost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.protocol === 'file:';
    return isLocalhost ? LOCAL_PROXY : API_BASE;
}

// Check if we're on GitHub Pages (API won't work due to CORS)
// Native apps don't have CORS restrictions
function isGitHubPages() {
    if (window.__DOCKHAND_NATIVE__) return false;
    return window.location.hostname.includes('github.io');
}

const state = {
    ships: [],
    agents: [],
    tokenInfo: null,
    leaderboardSort: 'karma',
    shipsFilter: 'all',
    corsError: false,
};

const elements = {
    // Stats
    tokenSupply: document.getElementById('tokenSupply'),
    totalShips: document.getElementById('totalShips'),
    verifiedShips: document.getElementById('verifiedShips'),
    pendingShips: document.getElementById('pendingShips'),
    verificationRate: document.getElementById('verificationRate'),
    // Lists
    leaderboardList: document.getElementById('leaderboardList'),
    activityFeed: document.getElementById('activityFeed'),
    recentShips: document.getElementById('recentShips'),
    // Funnel
    funnelSubmitted: document.getElementById('funnelSubmitted'),
    funnelAttested: document.getElementById('funnelAttested'),
    funnelVerified: document.getElementById('funnelVerified'),
    funnelAttestedBar: document.getElementById('funnelAttestedBar'),
    funnelVerifiedBar: document.getElementById('funnelVerifiedBar'),
    // Controls
    leaderboardSort: document.getElementById('leaderboardSort'),
    shipsFilter: document.getElementById('shipsFilter'),
    refreshActivity: document.getElementById('refreshActivity'),
};

// API Fetchers
async function fetchShips(status = null) {
    const apiBase = getApiBase();
    try {
        let url = `${apiBase}/ships?limit=100`;
        if (status) url += `&status=${status}`;
        const response = await fetch(url);
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

async function fetchTokenInfo() {
    const apiBase = getApiBase();
    try {
        const response = await fetch(`${apiBase}/token/info`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch token info:', error);
        return null;
    }
}

async function fetchPosts(limit = 20) {
    const apiBase = getApiBase();
    try {
        const response = await fetch(`${apiBase}/posts?limit=${limit}&sort=new`);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        return data.posts || [];
    } catch (error) {
        console.error('Failed to fetch posts:', error);
        return [];
    }
}

// Format number with K/M suffix
function formatNumber(num) {
    if (!num && num !== 0) return '-';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

// Format relative time
function formatRelativeTime(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
}

// Update platform stats
function updateStats() {
    const total = state.ships.length;
    const verified = state.ships.filter(s => s.status === 'verified').length;
    const pending = state.ships.filter(s => s.status === 'pending').length;
    const rate = total > 0 ? ((verified / total) * 100).toFixed(1) : 0;

    elements.totalShips.textContent = formatNumber(total);
    elements.verifiedShips.textContent = formatNumber(verified);
    elements.pendingShips.textContent = formatNumber(pending);
    elements.verificationRate.textContent = `${rate}%`;

    if (state.tokenInfo) {
        const supply = state.tokenInfo.total_supply || state.tokenInfo.totalSupply || 0;
        elements.tokenSupply.textContent = formatNumber(supply);
    }
}

// Update verification funnel
function updateFunnel() {
    const total = state.ships.length;
    const withAttestations = state.ships.filter(s => (s.attestations || 0) > 0).length;
    const verified = state.ships.filter(s => s.status === 'verified').length;

    elements.funnelSubmitted.textContent = total;
    elements.funnelAttested.textContent = withAttestations;
    elements.funnelVerified.textContent = verified;

    const attestedPct = total > 0 ? (withAttestations / total) * 100 : 0;
    const verifiedPct = total > 0 ? (verified / total) * 100 : 0;

    elements.funnelAttestedBar.style.width = `${Math.max(attestedPct, 10)}%`;
    elements.funnelVerifiedBar.style.width = `${Math.max(verifiedPct, 10)}%`;
}

// Build leaderboard from ships data
function buildLeaderboard() {
    const agentMap = new Map();

    for (const ship of state.ships) {
        const name = ship.author_name || ship.agent_name || 'Unknown';
        const karma = ship.author_karma || 0;
        
        if (!agentMap.has(name)) {
            agentMap.set(name, { name, karma, ships: 0, verified: 0 });
        }
        
        const agent = agentMap.get(name);
        agent.ships++;
        if (ship.status === 'verified') agent.verified++;
        agent.karma = Math.max(agent.karma, karma);
    }

    return Array.from(agentMap.values());
}

// Render leaderboard
function renderLeaderboard() {
    const agents = buildLeaderboard();
    
    // Sort by current criteria
    if (state.leaderboardSort === 'karma') {
        agents.sort((a, b) => b.karma - a.karma);
    } else {
        agents.sort((a, b) => b.ships - a.ships);
    }

    const top10 = agents.slice(0, 10);

    if (top10.length === 0) {
        elements.leaderboardList.innerHTML = '<div class="loading-inline">No agents found</div>';
        return;
    }

    elements.leaderboardList.innerHTML = top10.map((agent, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const scoreLabel = state.leaderboardSort === 'karma' ? 'karma' : 'ships';
        const scoreValue = state.leaderboardSort === 'karma' ? agent.karma : agent.ships;

        return `
            <div class="leaderboard-item">
                <div class="rank ${rankClass}">${i + 1}</div>
                <div class="agent-info">
                    <div class="agent-name">${escapeHtml(agent.name)}</div>
                    <div class="agent-stats">${agent.verified} verified • ${agent.ships} total ships</div>
                </div>
                <div class="agent-score">${formatNumber(scoreValue)} ${scoreLabel}</div>
            </div>
        `;
    }).join('');
}

// Generate activity items from ships
function generateActivity() {
    const activities = [];

    // Recent ships as activity
    const recentShips = [...state.ships]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 15);

    for (const ship of recentShips) {
        const author = ship.author_name || ship.agent_name || 'Unknown';
        
        if (ship.status === 'verified') {
            activities.push({
                icon: '✅',
                text: `<strong>${escapeHtml(author)}</strong> got <strong>${escapeHtml(ship.title)}</strong> verified`,
                time: ship.created_at,
                sortTime: new Date(ship.created_at || 0),
            });
        } else {
            activities.push({
                icon: '🚀',
                text: `<strong>${escapeHtml(author)}</strong> submitted <strong>${escapeHtml(ship.title)}</strong>`,
                time: ship.created_at,
                sortTime: new Date(ship.created_at || 0),
            });
        }
    }

    // Sort by time
    activities.sort((a, b) => b.sortTime - a.sortTime);
    return activities.slice(0, 10);
}

// Render activity feed
function renderActivity() {
    const activities = generateActivity();

    if (activities.length === 0) {
        elements.activityFeed.innerHTML = '<div class="loading-inline">No recent activity</div>';
        return;
    }

    elements.activityFeed.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-content">
                <div class="activity-text">${activity.text}</div>
                <div class="activity-time">${formatRelativeTime(activity.time)}</div>
            </div>
        </div>
    `).join('');
}

// Render recent ships
function renderRecentShips() {
    let ships = [...state.ships];

    // Apply filter
    if (state.shipsFilter === 'verified') {
        ships = ships.filter(s => s.status === 'verified');
    } else if (state.shipsFilter === 'pending') {
        ships = ships.filter(s => s.status === 'pending');
    }

    // Sort by newest
    ships.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    const recent = ships.slice(0, 10);

    if (recent.length === 0) {
        elements.recentShips.innerHTML = '<div class="loading-inline">No ships found</div>';
        return;
    }

    elements.recentShips.innerHTML = recent.map(ship => {
        const author = ship.author_name || ship.agent_name || 'Unknown';
        const status = ship.status || 'pending';

        return `
            <div class="ship-item">
                <div class="ship-item-header">
                    <div class="ship-item-title">
                        ${escapeHtml(ship.title)}
                        <span class="status-badge ${status}">${status}</span>
                    </div>
                </div>
                <div class="ship-item-meta">
                    <span class="ship-item-author">by ${escapeHtml(author)}</span>
                    • ${formatRelativeTime(ship.created_at)}
                    ${(ship.attestations || 0) > 0 ? `• ${ship.attestations}/3 attests` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show CORS error message
function showCorsError() {
    const corsMessage = `
        <div class="cors-error" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--surface); border-radius: 12px; border: 1px solid var(--border);">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
            <h2 style="margin-bottom: 1rem;">CORS Restriction</h2>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">The Shipyard API doesn't allow cross-origin requests from GitHub Pages.</p>
            <p><strong>To run locally:</strong></p>
            <pre style="text-align: left; background: var(--bg); padding: 1rem; border-radius: 8px; margin: 1rem auto; max-width: 500px; font-size: 0.85rem; overflow-x: auto;">
# Clone the repo
git clone https://github.com/crunchybananas/shipyard-microtools.git
cd shipyard-microtools

# Start a CORS proxy (terminal 1)
npx local-cors-proxy --proxyUrl https://shipyard.bot --port 8010

# Serve the docs folder (terminal 2)
npx serve docs</pre>
            <p>Then open <a href="http://localhost:3000/explorer" style="color: var(--accent);">http://localhost:3000/explorer</a></p>
        </div>
    `;
    
    elements.leaderboardList.innerHTML = corsMessage;
    elements.activityFeed.innerHTML = '';
    elements.recentShips.innerHTML = '';
}

// Initialize
async function init() {
    // Fetch all data in parallel
    const [allShips, tokenInfo] = await Promise.all([
        fetchShips(),
        fetchTokenInfo(),
    ]);

    state.ships = allShips;
    state.tokenInfo = tokenInfo;

    // Check for CORS error
    if (state.corsError) {
        showCorsError();
        return;
    }

    updateStats();
    updateFunnel();
    renderLeaderboard();
    renderActivity();
    renderRecentShips();
}

// Event listeners
elements.leaderboardSort.addEventListener('change', (e) => {
    state.leaderboardSort = e.target.value;
    renderLeaderboard();
});

elements.shipsFilter.addEventListener('change', (e) => {
    state.shipsFilter = e.target.value;
    renderRecentShips();
});

elements.refreshActivity.addEventListener('click', () => {
    init();
});

// Auto-refresh every 30 seconds
setInterval(init, 30000);

// Start - small delay to allow native app flag injection
setTimeout(() => {
  console.log('Initial load - __DOCKHAND_NATIVE__:', window.__DOCKHAND_NATIVE__);
  init();
}, 50);
