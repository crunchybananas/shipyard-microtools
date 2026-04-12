// ════════════════════════════════════════════════════════════
// Notifications — toast display + persistent scrollable log
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

let toastTimer = null;

export function notify(text, type = 'info') {
  // Toast
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = text;
    el.style.color = type === 'danger' ? 'var(--danger)' : 'var(--gold)';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  // Log (cap at 50 entries)
  G.notificationLog.push({ text, type, day: G.day });
  if (G.notificationLog.length > 50) G.notificationLog.shift();

  // Update badge
  updateLogBadge();
}

function updateLogBadge() {
  const badge = document.getElementById('log-badge');
  if (badge) {
    badge.style.display = 'inline-block';
    setTimeout(() => { badge.style.display = 'none'; }, 5000);
  }
}

export function renderNotificationLog() {
  const el = document.getElementById('log-content');
  if (!el) return;
  el.innerHTML = '';
  // Newest first
  for (let i = G.notificationLog.length - 1; i >= 0; i--) {
    const n = G.notificationLog[i];
    const div = document.createElement('div');
    div.className = `log-entry log-${n.type}`;
    div.innerHTML = `<span class="log-day">Day ${n.day}</span><span class="log-text">${n.text}</span>`;
    el.appendChild(div);
  }
  if (G.notificationLog.length === 0) {
    el.innerHTML = '<div class="log-empty">No events yet.</div>';
  }
}

export function toggleNotificationLog() {
  const p = document.getElementById('log-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderNotificationLog();
}
