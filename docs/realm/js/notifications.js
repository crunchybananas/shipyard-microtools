// ════════════════════════════════════════════════════════════
// Notifications — toast display + persistent scrollable log
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, resourceEmoji } from './state.js';
import { chronicle } from './story.js';

let toastTimer = null;
let toastShakeTimer = null;

// Icons per notification type
const TYPE_ICONS = {
  info:    'ℹ️',
  danger:  '⚠️',
  event:   '✨',
  mission: '✅',
};

// Label for filter buttons
const FILTER_LABELS = {
  all:     'All',
  info:    'Info',
  event:   'Events',
  danger:  'Danger',
  mission: 'Missions',
};

// Active filter state (persists while panel is open)
let _activeFilter = 'all';

export function notify(text, type = 'info', meta = {}) {
  // ── Toast ─────────────────────────────────────────────────
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = text;

    // Remove all type classes then apply the current one
    el.className = '';
    el.classList.add('show', `toast-${type}`);

    // Danger toast gets a shake animation — restart it cleanly
    if (type === 'danger') {
      clearTimeout(toastShakeTimer);
      el.classList.add('toast-shake');
      toastShakeTimer = setTimeout(() => el.classList.remove('toast-shake'), 600);
    }

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2800);
  }

  // ── Persistent log (cap at 50 entries) ───────────────────
  const entry = { text, type, day: G.day, ts: Date.now(), meta };
  G.notificationLog.push(entry);
  if (G.notificationLog.length > 50) G.notificationLog.shift();

  // ── Chronicle (story log) — only notable event/danger/mission ──
  try {
    if (type === 'event' || type === 'danger' || type === 'mission') {
      const tagMap = { event:'event', danger:'raid', mission:'milestone' };
      chronicle(text, tagMap[type] || 'misc');
    }
  } catch (_e) {}

  // Update badge
  updateLogBadge();

  // ── Activity feed (bottom-left ticker) ───────────────────
  const feed = document.getElementById('activity-feed');
  if (feed) {
    const item = document.createElement('div');
    item.className = `feed-item ${type}`;

    // Build icon: prefer explicit icon from meta, then building icon, then type icon
    let icon = meta.buildingIcon || TYPE_ICONS[type] || 'ℹ️';

    // Resource amounts inline
    let resourceStr = '';
    if (meta.resources) {
      resourceStr = ' ' + Object.entries(meta.resources)
        .map(([k, v]) => `${resourceEmoji(k)}${v > 0 ? '+' : ''}${v}`)
        .join(' ');
    }

    item.innerHTML = `<span class="feed-icon">${icon}</span><span class="feed-day">D${G.day}</span>${text}${resourceStr}`;
    feed.appendChild(item);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);

    // Graceful fade-out: slide + opacity
    setTimeout(() => item.classList.add('feed-fade'), 7000);
    setTimeout(() => item.classList.add('feed-exit'), 8500);
    setTimeout(() => { if (item.parentNode) item.remove(); }, 9200);
  }
}

function updateLogBadge() {
  const badge = document.getElementById('log-badge');
  if (badge) {
    badge.style.display = 'inline-block';
    clearTimeout(badge._hideTimer);
    badge._hideTimer = setTimeout(() => { badge.style.display = 'none'; }, 5000);
  }
}

// ── Relative time helper ──────────────────────────────────
function relativeDay(entryDay) {
  const diff = G.day - entryDay;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

// ── Render log with filter bar ────────────────────────────
export function renderNotificationLog() {
  const el = document.getElementById('log-content');
  if (!el) return;
  el.innerHTML = '';

  // ── Filter bar ───────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'log-filter-bar';

  for (const [key, label] of Object.entries(FILTER_LABELS)) {
    const btn = document.createElement('button');
    btn.className = 'log-filter-btn' + (key === _activeFilter ? ' active' : '');
    btn.textContent = label;
    btn.dataset.filter = key;
    btn.onclick = () => {
      _activeFilter = key;
      renderNotificationLog();
    };
    filterBar.appendChild(btn);
  }
  el.appendChild(filterBar);

  // ── Entries ──────────────────────────────────────────────
  const entries = _activeFilter === 'all'
    ? [...G.notificationLog].reverse()
    : [...G.notificationLog].reverse().filter(n => n.type === _activeFilter);

  if (entries.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-empty';
    empty.textContent = G.notificationLog.length === 0
      ? 'No events yet.'
      : `No ${FILTER_LABELS[_activeFilter].toLowerCase()} events.`;
    el.appendChild(empty);
    return;
  }

  for (const n of entries) {
    const icon = TYPE_ICONS[n.type] || 'ℹ️';
    const div = document.createElement('div');
    div.className = `log-entry log-${n.type}`;
    div.innerHTML =
      `<span class="log-icon">${icon}</span>` +
      `<span class="log-text">${n.text}</span>` +
      `<span class="log-time" title="Day ${n.day}">${relativeDay(n.day)}</span>`;
    el.appendChild(div);
  }
}

export function toggleNotificationLog() {
  const p = document.getElementById('log-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) {
    _activeFilter = 'all';
    renderNotificationLog();
  }
}

// ── Convenience wrappers for building placement ───────────
export function notifyBuild(buildingType) {
  const def = BUILDINGS[buildingType];
  if (!def) return;
  notify(`${def.name} built!`, 'info', { buildingIcon: def.icon });
}

export function notifyResources(label, resources) {
  const parts = Object.entries(resources)
    .map(([k, v]) => `${resourceEmoji(k)}${v > 0 ? '+' : ''}${v}`)
    .join(' ');
  notify(`${label} ${parts}`, 'event', { resources });
}
