// ════════════════════════════════════════════════════════════
// Story / Chronicle system — narrative beats, named characters,
// diary of the realm. Persists to save.
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

// G.chronicle: [{ day, season, text, tag }]
// tag in: 'milestone','event','character','raid','season','death','birth','victory','misc'

export function initChronicle() {
  if (!G.chronicle) G.chronicle = [];
  if (!G.storyFlags) G.storyFlags = {};
  if (!G.namedCharacters) G.namedCharacters = {};
}

export function chronicle(text, tag='misc') {
  initChronicle();
  G.chronicle.push({
    day: G.day,
    season: G.season,
    tick: G.gameTick,
    text, tag,
  });
  // Cap to last 300 entries
  if (G.chronicle.length > 300) G.chronicle.splice(0, G.chronicle.length - 300);
}

export function hasFlag(key) { initChronicle(); return !!G.storyFlags[key]; }
export function setFlag(key, val=true) { initChronicle(); G.storyFlags[key] = val; }

// ── Render chronicle panel ─────────────────────────────────
export function renderChroniclePanel() {
  initChronicle();
  const c = document.getElementById('chronicle-content');
  if (!c) return;
  if (G.chronicle.length === 0) {
    c.innerHTML = '<div class="chron-empty">Your chronicle is blank. Shape the realm and it will record your deeds.</div>';
    return;
  }
  const tagIcons = {
    milestone:'🏛️', event:'✨', character:'👤', raid:'⚔️',
    season:'🍃', death:'🪦', birth:'👶', victory:'🏆', misc:'📜',
  };
  const seasonIcons = { spring:'🌱', summer:'☀️', autumn:'🍂', winter:'❄️' };
  const byDay = {};
  for (const e of G.chronicle) {
    if (!byDay[e.day]) byDay[e.day] = [];
    byDay[e.day].push(e);
  }
  const days = Object.keys(byDay).map(Number).sort((a,b)=>b-a);
  let html = '';
  for (const d of days) {
    const seas = byDay[d][0].season;
    html += `<div class="chron-day"><div class="chron-day-h">${seasonIcons[seas]||''} Day ${d}</div>`;
    for (const e of byDay[d]) {
      html += `<div class="chron-row"><span class="chron-tag">${tagIcons[e.tag]||'📜'}</span><span class="chron-text">${e.text}</span></div>`;
    }
    html += '</div>';
  }
  c.innerHTML = html;
}

export function toggleChroniclePanel() {
  const p = document.getElementById('chronicle-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}
