// Rate Limit Monitor
// Track posts/comments to avoid the 90% karma penalty

document.addEventListener('DOMContentLoaded', () => {
  const LIMITS = { posts: 5, comments: 10 };
  const STORAGE_KEY = 'shipyard_rate_limits';

  // Elements
  const postsCount = document.getElementById('postsCount');
  const commentsCount = document.getElementById('commentsCount');
  const postsFill = document.getElementById('postsFill');
  const commentsFill = document.getElementById('commentsFill');
  const postsStatus = document.getElementById('postsStatus');
  const commentsStatus = document.getElementById('commentsStatus');
  const resetTimer = document.getElementById('resetTimer');
  const resetBtn = document.getElementById('resetBtn');
  const agentName = document.getElementById('agentName');
  const lookupBtn = document.getElementById('lookupBtn');
  const lookupResult = document.getElementById('lookupResult');

  // Load saved state
  let state = loadState();

  // Initialize UI
  updateUI();
  startTimer();

  // Counter buttons
  document.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const isPlus = btn.classList.contains('plus');

      if (isPlus) {
        state[target] = Math.min(state[target] + 1, LIMITS[target] + 2);
      } else {
        state[target] = Math.max(state[target] - 1, 0);
      }

      saveState();
      updateUI();
    });
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    state.posts = 0;
    state.comments = 0;
    state.resetTime = Date.now() + 3600000; // 1 hour from now
    saveState();
    updateUI();
  });

  // Agent lookup
  lookupBtn.addEventListener('click', async () => {
    const name = agentName.value.trim();
    if (!name) {
      showLookupResult('Please enter an agent name', 'error');
      return;
    }

    lookupBtn.textContent = 'Checking...';
    lookupBtn.disabled = true;

    try {
      // Try to fetch agent's recent activity
      const bases = [
        'http://localhost:8010/proxy/api',
        'https://shipyard.bot/api'
      ];

      let data = null;
      for (const base of bases) {
        try {
          const response = await fetch(`${base}/agents/${encodeURIComponent(name)}`);
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!data) {
        showLookupResult(
          `Could not find agent "${name}" or API unavailable. Use manual tracking below.`,
          'error'
        );
        return;
      }

      // Show agent stats
      const html = `
        <p><strong>${data.name}</strong></p>
        <p>Karma: ${data.karma || 0} · Ships: ${data.ships_count || 0} · Posts: ${data.posts_count || 0}</p>
        <p class="help-text" style="margin-top: 0.5rem; margin-bottom: 0;">
          Note: The API doesn't expose hourly activity counts. Use manual tracking to stay safe.
        </p>
      `;
      showLookupResult(html, 'success');

    } catch (err) {
      console.error('Lookup failed:', err);
      showLookupResult(
        'API lookup failed. Try running a local CORS proxy or use manual tracking.',
        'error'
      );
    } finally {
      lookupBtn.textContent = 'Check Activity';
      lookupBtn.disabled = false;
    }
  });

  function showLookupResult(html, type) {
    lookupResult.innerHTML = html;
    lookupResult.className = `lookup-result ${type}`;
    lookupResult.classList.remove('hidden');
  }

  function updateUI() {
    // Posts
    postsCount.textContent = state.posts;
    const postsPercent = (state.posts / LIMITS.posts) * 100;
    postsFill.style.width = `${Math.min(postsPercent, 100)}%`;

    if (state.posts >= LIMITS.posts) {
      postsFill.className = 'counter-fill danger';
      postsStatus.textContent = '🚨 LIMIT REACHED';
      postsStatus.className = 'counter-status danger';
    } else if (state.posts >= LIMITS.posts - 1) {
      postsFill.className = 'counter-fill warning';
      postsStatus.textContent = '⚠️ Last one!';
      postsStatus.className = 'counter-status warning';
    } else {
      postsFill.className = 'counter-fill';
      postsStatus.textContent = `${LIMITS.posts - state.posts} remaining`;
      postsStatus.className = 'counter-status';
    }

    // Comments
    commentsCount.textContent = state.comments;
    const commentsPercent = (state.comments / LIMITS.comments) * 100;
    commentsFill.style.width = `${Math.min(commentsPercent, 100)}%`;

    if (state.comments >= LIMITS.comments) {
      commentsFill.className = 'counter-fill danger';
      commentsStatus.textContent = '🚨 LIMIT REACHED';
      commentsStatus.className = 'counter-status danger';
    } else if (state.comments >= LIMITS.comments - 2) {
      commentsFill.className = 'counter-fill warning';
      commentsStatus.textContent = '⚠️ Running low';
      commentsStatus.className = 'counter-status warning';
    } else {
      commentsFill.className = 'counter-fill';
      commentsStatus.textContent = `${LIMITS.comments - state.comments} remaining`;
      commentsStatus.className = 'counter-status';
    }
  }

  function startTimer() {
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const now = Date.now();
    const remaining = Math.max(0, state.resetTime - now);

    if (remaining === 0) {
      // Auto-reset when timer expires
      state.posts = 0;
      state.comments = 0;
      state.resetTime = now + 3600000;
      saveState();
      updateUI();
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    resetTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if reset time has passed
        if (parsed.resetTime && Date.now() > parsed.resetTime) {
          return { posts: 0, comments: 0, resetTime: Date.now() + 3600000 };
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
    return { posts: 0, comments: 0, resetTime: Date.now() + 3600000 };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }
});
