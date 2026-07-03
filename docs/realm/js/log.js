// ════════════════════════════════════════════════════════════
// Log — core-safe announcements, chronicle data-writes, and sfx
// requests (ENGINE.md rule 4).
//
// G.notificationLog and G.chronicle are SAVED state, so their writes
// live core-side here. Everything visible/audible about them (toasts,
// activity feed, panels, actual audio) happens in shell subscribers
// (notifications.js, audio.js, main.js).
//
// Core files import these as drop-in aliases:
//   import { announce as notify } from './log.js?realm=130';
//   import { sfx as playSound } from './log.js?realm=130';
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS } from './state.js?realm=130';
import { emit } from './bus.js?realm=130';

// ── Chronicle (moved verbatim from story.js — pure data logic) ──────
const _EVICTION_IMMUNE_TAGS = new Set(['nightmare', 'stone', 'victory', 'requiem', 'era']);

export function initChronicle() {
  if (!G.chronicle) G.chronicle = [];
  if (!G.storyFlags) G.storyFlags = {};
  if (!G.namedCharacters) G.namedCharacters = {};
}

export function chronicle(text, tag = 'misc') {
  initChronicle();
  // Loop 260 (the-player [play]): once the realm has fallen, no more
  // beats. Gate at the chronicle() write itself so ALL call sites
  // (NARRATIVE_BEATS / season-changes / dreams / nightmares / echoes /
  // raids / events) benefit from a single check. The realm_fell beat
  // itself still writes its requiem because `after: G => {
  // G.realmEnded = true; }` runs AFTER chronicle.
  if (G.realmEnded) return;
  G.chronicle.push({
    day: G.day,
    season: G.season,
    tick: G.gameTick,
    text, tag,
  });
  // Cap to last 300 entries, preserving eviction-immune tags
  if (G.chronicle.length > 300) {
    const excess = G.chronicle.length - 300;
    const toRemove = [];
    for (let i = 0; i < G.chronicle.length && toRemove.length < excess; i++) {
      if (!_EVICTION_IMMUNE_TAGS.has(G.chronicle[i].tag)) {
        toRemove.push(i);
      }
    }
    for (let j = toRemove.length - 1; j >= 0; j--) {
      G.chronicle.splice(toRemove[j], 1);
    }
  }
}

// ── Announcements (data half of the old notifications.notify) ───────
export function announce(text, type = 'info', meta = {}) {
  const entry = { text, type, day: G.day, tick: G.gameTick, meta };
  G.notificationLog.push(entry);
  if (G.notificationLog.length > 50) G.notificationLog.shift();

  // Chronicle bridging: notable event/danger/mission announcements write
  // story history unless the caller opts out (meta.chronicle === false —
  // UI warnings and duplicate beats use that).
  if (meta.chronicle !== false && (type === 'event' || type === 'danger' || type === 'mission')) {
    const tagMap = { event: 'event', danger: 'raid', mission: 'milestone' };
    chronicle(text, tagMap[type] || 'misc');
  }

  emit('notify', { text, type, meta });
}

export function announceBuild(buildingType) {
  const def = BUILDINGS[buildingType];
  if (!def) return;
  announce(`${def.name} built!`, 'info', { buildingIcon: def.icon });
}

// ── Sound requests ──────────────────────────────────────────────────
export function sfx(name) { emit('sfx', name); }
export function sfxBuild(buildingType) { emit('sfx-build', buildingType); }
