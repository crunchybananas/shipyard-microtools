// Chronicle presentation and optional real-world dream preview helpers.
// Authoritative story progression lives in story.js and runs in coreTick();
// this shell module may use the DOM and wall clock but cannot mutate story
// cadence or gameplay state.

import { G } from './state.js?realm=184';
import { initChronicle } from './log.js?realm=184';

const TAG_ICONS = {
  milestone:'🏛️', event:'✨', character:'👤', raid:'⚔️',
  season:'🍃', death:'🪦', birth:'👶', victory:'🏆', misc:'📜',
  dream:'🌙', nightmare:'🌑', stone:'🗿', echo:'🔁', research:'📚',
  requiem:'🕯️', era:'🌅',
};

let chronicleFilter = null;

export function setChronicleFilter(tag) {
  chronicleFilter = (tag === chronicleFilter || tag == null) ? null : tag;
  renderChroniclePanel();
}

function appendFilterChip(container, tag, label, count) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `chron-chip${tag === chronicleFilter ? ' active' : ''}`;
  chip.textContent = `${label} · ${count}`;
  chip.addEventListener('click', () => setChronicleFilter(tag));
  container.appendChild(chip);
}

function buildFilterRow() {
  const row = document.createElement('div');
  row.className = 'chron-filters';
  appendFilterChip(row, null, 'All', G.chronicle.length);

  const counts = new Map();
  for (const entry of G.chronicle) {
    counts.set(entry.tag, (counts.get(entry.tag) || 0) + 1);
  }
  for (const [tag, icon] of Object.entries(TAG_ICONS)) {
    const count = counts.get(tag);
    if (count) appendFilterChip(row, tag, icon, count);
  }
  return row;
}

function appendEmptyState(container, text) {
  const empty = document.createElement('div');
  empty.className = 'chron-empty';
  empty.textContent = text;
  container.appendChild(empty);
}

export function renderChroniclePanel() {
  initChronicle();
  const container = document.getElementById('chronicle-content');
  if (!container) return;
  container.replaceChildren();
  if (G.chronicle.length === 0) {
    appendEmptyState(container, 'Your chronicle is blank. Shape the realm and it will record your deeds.');
    return;
  }

  const seasonIcons = { spring:'🌱', summer:'☀️', autumn:'🍂', winter:'❄️' };
  container.appendChild(buildFilterRow());

  const entries = chronicleFilter == null
    ? G.chronicle
    : G.chronicle.filter(entry => entry.tag === chronicleFilter);
  if (entries.length === 0) {
    appendEmptyState(container, 'No entries match this filter.');
    return;
  }

  const byDay = {};
  for (const entry of entries) (byDay[entry.day] ||= []).push(entry);
  const days = Object.keys(byDay).map(Number).sort((a, b) => b - a);
  for (const day of days) {
    const season = byDay[day][0].season;
    const daySection = document.createElement('div');
    daySection.className = 'chron-day';
    const heading = document.createElement('div');
    heading.className = 'chron-day-h';
    heading.textContent = `${seasonIcons[season] || ''} Day ${day}`;
    daySection.appendChild(heading);

    for (const entry of byDay[day]) {
      const row = document.createElement('div');
      row.className = 'chron-row';
      const tag = document.createElement('span');
      tag.className = 'chron-tag';
      tag.textContent = TAG_ICONS[entry.tag] || '📜';
      const text = document.createElement('span');
      text.className = 'chron-text';
      text.textContent = entry.text;
      row.append(tag, text);
      daySection.appendChild(row);
    }
    container.appendChild(daySection);
  }
}

export function toggleChroniclePanel() {
  const panel = document.getElementById('chronicle-panel');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}

// Debug-only wall-clock lens retained for the console. Story progression no
// longer calls it: loading the same realm in another month cannot alter saves.
export function realWorldDreamLens(now = new Date()) {
  const month = now.getMonth();
  const date = now.getDate();
  const hour = now.getHours();
  const boost = month === 11 || month === 0 || month === 1
    ? ['hearth', 'warning']
    : month >= 2 && month <= 4
      ? ['harvest', 'water']
      : month >= 5 && month <= 7
        ? ['water', 'market']
        : ['warning', 'forge'];

  let special = null;
  if (month === 9 && date === 31) {
    special = { intro: 'On the thinnest night of the year the realm wakes to dreams:', closer: 'Tomorrow the veil thickens again.' };
  } else if (month === 11 && date >= 20 && date <= 22) {
    special = { intro: 'On the longest night the realm wakes to dreams:', closer: 'The dark will turn now.' };
  } else if (month === 5 && date >= 20 && date <= 22) {
    special = { intro: 'On the shortest night the realm wakes to dreams:', closer: 'The light will turn now.' };
  } else if (month === 2 && date >= 19 && date <= 21) {
    special = { intro: 'On the balanced night the realm wakes to dreams:', closer: 'The seasons change hands.' };
  } else if (hour === 0) {
    special = { intro: 'At the witching hour the realm wakes to dreams:', closer: 'No one speaks of them, but everyone remembers.' };
  }
  return { boost, special };
}
