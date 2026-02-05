// Challenge Arena - Community Proof Challenges

// Sample Data
const sampleChallenges = [
  {
    id: 'w1',
    title: 'Ship a CLI Tool',
    description: 'Build and publish a command-line tool that solves a real problem. Must have a README and be installable via npm or similar.',
    category: 'Backend',
    type: 'weekly',
    pointsReward: 100,
    bonusPoints: 25,
    submissions: 12,
    verifiedSubmissions: 8,
    startDate: new Date('2024-01-29'),
    endDate: new Date('2024-02-05'),
    active: true
  },
  {
    id: 'w2',
    title: 'Document Your Code',
    description: 'Add comprehensive documentation to an existing project. Include JSDoc comments, README updates, and usage examples.',
    category: 'Documentation',
    type: 'weekly',
    pointsReward: 75,
    bonusPoints: 15,
    submissions: 8,
    verifiedSubmissions: 5,
    startDate: new Date('2024-01-29'),
    endDate: new Date('2024-02-05'),
    active: true
  },
  {
    id: 'm1',
    title: 'Full-Stack Feature',
    description: 'Build a complete feature from frontend to backend. Must include UI, API, database changes, and tests.',
    category: 'Full Stack',
    type: 'monthly',
    pointsReward: 500,
    bonusPoints: 100,
    submissions: 24,
    verifiedSubmissions: 15,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    active: true
  },
  {
    id: 'm2',
    title: 'Open Source Contribution',
    description: 'Make a meaningful contribution to an open source project. PRs must be merged to count.',
    category: 'Open Source',
    type: 'monthly',
    pointsReward: 300,
    bonusPoints: 75,
    submissions: 18,
    verifiedSubmissions: 10,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31'),
    active: true
  }
];

const sampleLeaderboard = [
  { id: 'u1', name: 'Sarah Chen', points: 1250, verified: 15, rank: 1 },
  { id: 'u2', name: 'Alex Rivera', points: 980, verified: 12, rank: 2 },
  { id: 'u3', name: 'Jordan Kim', points: 875, verified: 10, rank: 3 },
  { id: 'u4', name: 'Taylor Swift', points: 720, verified: 9, rank: 4 },
  { id: 'u5', name: 'Morgan Lee', points: 650, verified: 8, rank: 5 },
  { id: 'u6', name: 'Casey Park', points: 540, verified: 7, rank: 6 },
  { id: 'u7', name: 'Jamie Wu', points: 480, verified: 6, rank: 7 },
  { id: 'u8', name: 'Riley Johnson', points: 420, verified: 5, rank: 8 },
];

const sampleArchive = [
  { id: 'a1', title: 'Holiday Hackathon', type: 'monthly', winner: 'Sarah Chen', points: 500, date: 'Dec 2023' },
  { id: 'a2', title: 'Bug Bash Week', type: 'weekly', winner: 'Alex Rivera', points: 150, date: 'Dec 2023' },
  { id: 'a3', title: 'UI Polish Sprint', type: 'weekly', winner: 'Jordan Kim', points: 100, date: 'Nov 2023' },
];

// State
let challenges = [...sampleChallenges];
let leaderboard = [...sampleLeaderboard];
let archive = [...sampleArchive];
let submissions = [];
let selectedChallengeId = null;

// DOM Elements
const tabs = document.getElementById('tabs');

// Tab switching
tabs.addEventListener('click', (e) => {
  if (e.target.classList.contains('tab')) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    const tabId = e.target.dataset.tab;
    document.getElementById(`tab-${tabId}`).classList.add('active');
  }
});

// Event Listeners
document.getElementById('submitBtn').addEventListener('click', handleSubmit);

// Update functions
function updateAll() {
  updateStats();
  updateChallenges();
  updateLeaderboard();
  updateChallengeSelect();
  updateUserSubmissions();
  updateArchive();
}

function updateStats() {
  const activeChallenges = challenges.filter(c => c.active).length;
  const totalSubs = submissions.length + challenges.reduce((sum, c) => sum + c.submissions, 0);
  const pendingSubs = submissions.filter(s => s.status === 'pending').length;
  const verifiedSubs = submissions.filter(s => s.status === 'verified').length + 
    challenges.reduce((sum, c) => sum + c.verifiedSubmissions, 0);
  
  document.getElementById('activeChallenges').textContent = activeChallenges;
  document.getElementById('totalSubmissions').textContent = totalSubs;
  document.getElementById('pendingSubmissions').textContent = pendingSubs;
  document.getElementById('verifiedSubmissions').textContent = verifiedSubs;
}

function updateChallenges() {
  const weekly = challenges.filter(c => c.type === 'weekly' && c.active);
  const monthly = challenges.filter(c => c.type === 'monthly' && c.active);
  
  document.getElementById('weeklyChallenges').innerHTML = weekly.length > 0
    ? weekly.map(renderChallengeCard).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><p>No weekly challenges</p></div>';
  
  document.getElementById('monthlyChallenges').innerHTML = monthly.length > 0
    ? monthly.map(renderChallengeCard).join('')
    : '<div class="empty-state"><div class="empty-icon">📭</div><p>No monthly challenges</p></div>';
  
  // Add click handlers
  document.querySelectorAll('.challenge-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedChallengeId = card.dataset.id;
      document.querySelectorAll('.challenge-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
    });
  });
  
  document.querySelectorAll('.submit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedChallengeId = btn.dataset.id;
      document.getElementById('challengeSelect').value = selectedChallengeId;
      document.querySelector('[data-tab="submit"]').click();
    });
  });
}

function renderChallengeCard(challenge) {
  return `
    <div class="challenge-card ${challenge.type} ${selectedChallengeId === challenge.id ? 'selected' : ''}" data-id="${challenge.id}">
      <div class="challenge-header">
        <div>
          <div class="challenge-title">${challenge.title}</div>
          <div class="challenge-category">${challenge.category}</div>
        </div>
        <span class="challenge-badge ${challenge.type}">${challenge.type}</span>
      </div>
      <p class="challenge-description">${challenge.description}</p>
      <div class="challenge-meta">
        <span class="challenge-stat">🎁 <span class="challenge-stat-value">${challenge.pointsReward}</span> pts</span>
        <span class="challenge-stat">⚡ <span class="challenge-stat-value">+${challenge.bonusPoints}</span> early bonus</span>
        <span class="challenge-stat">📝 <span class="challenge-stat-value">${challenge.submissions}</span> submissions</span>
        <span class="challenge-stat">✅ <span class="challenge-stat-value">${challenge.verifiedSubmissions}</span> verified</span>
      </div>
      <div class="challenge-actions">
        <button type="button" class="btn btn-primary btn-small submit-btn" data-id="${challenge.id}">Submit Proof</button>
      </div>
    </div>
  `;
}

function updateLeaderboard() {
  const leaderboardEl = document.getElementById('leaderboard');
  
  leaderboardEl.innerHTML = leaderboard.map(entry => {
    const rankClass = entry.rank === 1 ? 'gold' : entry.rank === 2 ? 'silver' : entry.rank === 3 ? 'bronze' : '';
    const rankDisplay = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    
    return `
      <div class="leaderboard-entry ${rankClass}">
        <div class="leaderboard-rank">${rankDisplay}</div>
        <div class="leaderboard-user">
          <div class="leaderboard-name">${entry.name}</div>
          <div class="leaderboard-stats">${entry.verified} verified proofs</div>
        </div>
        <div class="leaderboard-points">${entry.points} pts</div>
      </div>
    `;
  }).join('');
}

function updateChallengeSelect() {
  const selectEl = document.getElementById('challengeSelect');
  const activeChallenges = challenges.filter(c => c.active);
  
  selectEl.innerHTML = activeChallenges.map(c => 
    `<option value="${c.id}" ${selectedChallengeId === c.id ? 'selected' : ''}>${c.title} (${c.type})</option>`
  ).join('');
}

function updateUserSubmissions() {
  const listEl = document.getElementById('userSubmissions');
  
  if (submissions.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><p>No submissions yet. Submit a proof to get started!</p></div>';
    return;
  }
  
  const icons = { github: '🔗', url: '🌐', screenshot: '📸', demo: '🎮', video: '🎬' };
  
  listEl.innerHTML = submissions.map(sub => {
    const challenge = challenges.find(c => c.id === sub.challengeId);
    return `
      <div class="submission-item">
        <div class="submission-icon">${icons[sub.proofType]}</div>
        <div class="submission-info">
          <div class="submission-challenge">${challenge?.title || 'Unknown Challenge'}</div>
          <div class="submission-date">${formatDate(sub.date)}</div>
        </div>
        <span class="submission-status ${sub.status}">${sub.status}</span>
        ${sub.points ? `<span class="submission-points">+${sub.points}</span>` : ''}
      </div>
    `;
  }).join('');
}

function updateArchive() {
  const listEl = document.getElementById('archiveList');
  
  listEl.innerHTML = archive.map(item => `
    <div class="archive-item">
      <div>
        <div class="archive-title">${item.title}</div>
        <div class="archive-meta">${item.type} • ${item.date}</div>
      </div>
      <div class="archive-winner">
        🏆 ${item.winner} (+${item.points})
      </div>
    </div>
  `).join('');
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function handleSubmit() {
  const challengeId = document.getElementById('challengeSelect').value;
  const proofType = document.getElementById('proofType').value;
  const proofUrl = document.getElementById('proofUrl').value.trim();
  const description = document.getElementById('description').value.trim();
  
  const resultEl = document.getElementById('submitResult');
  
  // Validation
  if (!proofUrl) {
    showResult(resultEl, 'error', '❌ Please enter a proof URL');
    return;
  }
  
  if (description.length < 10) {
    showResult(resultEl, 'error', '❌ Description must be at least 10 characters');
    return;
  }
  
  // Simulate verification (in real app, this would call an API)
  const verificationResult = simulateVerification(proofType, proofUrl);
  
  const submission = {
    id: Date.now().toString(),
    challengeId,
    proofType,
    proofUrl,
    description,
    date: new Date(),
    status: verificationResult.status,
    points: verificationResult.points,
    message: verificationResult.message
  };
  
  submissions.unshift(submission);
  
  // Update challenge stats
  const challenge = challenges.find(c => c.id === challengeId);
  if (challenge) {
    challenge.submissions++;
    if (verificationResult.status === 'verified') {
      challenge.verifiedSubmissions++;
    }
  }
  
  // Show result
  const statusClass = verificationResult.status === 'verified' ? 'success' : 
                      verificationResult.status === 'pending' ? 'pending' : 'error';
  const statusText = verificationResult.status === 'verified' 
    ? `✅ Verified! You earned ${verificationResult.points} points!`
    : verificationResult.status === 'pending'
    ? '⏳ Submitted! Queued for review.'
    : '❌ Verification failed.';
  
  showResult(resultEl, statusClass, `${statusText} ${verificationResult.message}`);
  
  // Clear form
  document.getElementById('proofUrl').value = '';
  document.getElementById('description').value = '';
  
  // Update UI
  updateAll();
}

function simulateVerification(proofType, proofUrl) {
  // Simulate different verification outcomes based on proof type
  const random = Math.random();
  
  if (proofType === 'github' && proofUrl.includes('github.com')) {
    if (random > 0.3) {
      return { status: 'verified', points: 100, message: 'GitHub repo verified!' };
    }
  }
  
  if (proofType === 'url' && (proofUrl.startsWith('http://') || proofUrl.startsWith('https://'))) {
    if (random > 0.4) {
      return { status: 'verified', points: 75, message: 'URL is accessible.' };
    }
  }
  
  if (proofType === 'demo') {
    if (random > 0.5) {
      return { status: 'verified', points: 125, message: 'Demo link verified!' };
    }
  }
  
  if (random > 0.6) {
    return { status: 'pending', points: 0, message: 'Manual review required.' };
  }
  
  return { status: 'rejected', points: 0, message: 'Could not verify proof automatically.' };
}

function showResult(element, type, message) {
  element.style.display = 'block';
  element.className = `submit-result ${type}`;
  element.textContent = message;
  
  setTimeout(() => {
    element.style.display = 'none';
  }, 5000);
}

// Initialize
updateAll();
