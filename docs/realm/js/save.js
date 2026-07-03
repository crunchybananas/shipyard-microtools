// ════════════════════════════════════════════════════════════
// Save/Load — localStorage serialization
// ════════════════════════════════════════════════════════════

import { G, getSeed, setSeed } from './state.js?realm=130';
import { makeAvatar, ensureAvatar } from './avatar.js?realm=130';
import { rebuildBuildingGrid } from './world.js?realm=130';
import { missions } from './missions.js?realm=130';
import { deriveEra } from './tech.js?realm=130';
import { notify } from './notifications.js?realm=130';

const SAVE_KEY = 'realm-save-v2';

export function getSaveSize() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? raw.length : 0;
}

// Pure serialization — core-safe (no DOM, no localStorage, no wall
// clock). The shell wrapper below adds savedAt and persists. This is
// also the multiplayer join-snapshot format.
export function serializeGame() {
  const state = {
      v: 2,
      map: G.map,
      fog: G.fog,
      buildings: G.buildings.map(b => ({
        type: b.type, x: b.x, y: b.y, hp: b.hp, prodTimer: b.prodTimer,
        level: b.level || 1,
        visits: b.visits || undefined,
        trainTimer: b.trainTimer || 0,
        // buildProgress is the live 0-1 construction fraction (economy.js).
        // The old `construction` field was dead weight: nothing wrote it, so
        // in-progress buildings silently insta-completed on load.
        buildProgress: b.buildProgress !== undefined ? b.buildProgress : 1,
        buildTotal: b.buildTotal || 0,
        produced: b.produced || null,
        workerIdxs: b.workers.map(w => G.citizens.indexOf(w)),
      })),
      avatar: G.avatar ? { x: G.avatar.x, y: G.avatar.y, name: G.avatar.name } : null,
      armyStance: G.armyStance || 'defend',
      rallyPoint: G.rallyPoint || null,
      era: G.era || 1,
      eraStartDay: G.eraStartDay || { 1: 1 },
      won: !!G.won,
      wonder: G.wonder || null,
      soldiers: (G.soldiers || []).map(s => ({
        x: s.x, y: s.y, tx: s.tx, ty: s.ty, type: s.type,
        hp: s.hp, maxHp: s.maxHp, name: s.name,
        homeBuildingIdx: G.buildings.indexOf(s.homeBuilding),
        garrisonIdx: s.garrison ? G.buildings.indexOf(s.garrison) : -1,
      })),
      citizens: G.citizens.map(c => ({
        x:c.x, y:c.y, tx:c.tx, ty:c.ty, speed:c.speed,
        name:c.name, hunger:c.hunger, rest:c.rest,
        state:c.state, stateTimer:c.stateTimer,
        carrying:c.carrying, carryAmount:c.carryAmount,
        jobBuildingIdx: c.jobBuilding ? G.buildings.indexOf(c.jobBuilding) : -1,
        homeIdx: c.home ? G.buildings.indexOf(c.home) : -1,
        needs: c.needs ? { joy: c.needs.joy, faith: c.needs.faith } : undefined,
      })),
      resources: { ...G.resources },
      population: G.population,
      maxPop: G.maxPop,
      happiness: G.happiness,
      defense: G.defense,
      day: G.day,
      dayPhase: G.dayPhase,
      gameTick: G.gameTick,
      nextRaidDay: G.nextRaidDay,
      raidInterval: G.raidInterval,
      seed: getSeed(),
      missions: missions.map(m => ({ id: m.id, done: m.done })),
      researchedTechs: [...G.researchedTechs],
      currentResearch: G.currentResearch ? { ...G.currentResearch } : null,
      activeEvent: G.activeEvent ? { ...G.activeEvent } : null,
      eventModifiers: { ...G.eventModifiers },
      caravans: G.caravans.map(c => ({
        x:c.x, y:c.y, tx:c.tx, ty:c.ty,
        homeX:c.homeX, homeY:c.homeY,
        phase:c.phase, gold:c.gold, speed:c.speed,
        buildingIdx: G.buildings.indexOf(c.building),
      })),
  };
    if (G.tileWear) {
      state.tileWear = G.tileWear.map(row => Array.from(row));
    }
    state.chronicle = G.chronicle || [];
    state.storyFlags = G.storyFlags || {};
    state.namedCharacters = G.namedCharacters || {};
    state.kingdomName = G.kingdomName;
    state.scenario = G.scenario;
    state.difficulty = G.difficulty;
    // Loop 31 (render S3): persist run-state fields that weren't being saved.
    // Without G.stats the first-raid probe logic (L16) mistakenly fires on
    // every save reload. Without season/weather, continuing looks weird
    // (always spring). Without notificationLog, recent toasts lost.
    state.season = G.season;
    state.weather = G.weather;
    state.stats = G.stats ? { ...G.stats } : null;
    state.notificationLog = Array.isArray(G.notificationLog)
      ? G.notificationLog.slice(-30) // cap saved log to recent 30
      : [];
    // Loop 77 (render S4): persist gravestones so the settlement's
    // dead carry across save/load. Cap matches the in-memory FIFO (40).
    state.deathMarkers = Array.isArray(G.deathMarkers)
      ? G.deathMarkers.slice(-40)
      : [];
    // Loop 197 (the-fixer, closes 192 filed): persist G.realmEnded so
    // a fallen-realm save preserves post-end mode across reloads.
    // Without this, future consumers of G.realmEnded (render desat /
    // audio fade / UI suppression) would re-derive from
    // storyFlags.realm_fell on load — workable but indirect. Explicit
    // is cleaner.
    state.realmEnded = !!G.realmEnded;
    // Loop 211 (surprise, closes 060 filed): persist lastRaidDay for
    // sustained-peace beat (story.js sustained_peace_known) which
    // gates on G.day - G.lastRaidDay ≥ 50.
    state.lastRaidDay = G.lastRaidDay;
    // Loop 228: persist lastDeathDay for sustained-no-death beat.
    state.lastDeathDay = G.lastDeathDay;
    state.lastUnderpopDay = G.lastUnderpopDay;  // Loop 230 (sustained-state #3)
  return state;
}

export function saveGame({ silent = false } = {}) {
  try {
    const state = serializeGame();
    // Wall-clock stamp lives in the SHELL wrapper (welcome-back feature)
    // so serializeGame stays deterministic.
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (silent) {
      showSaveIndicator();
    } else {
      showToast('Game saved.');
    }
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// Pure state restoration — core-safe. Takes a parsed save object and
// rebuilds G (references re-linked from indices). Shell concerns
// (localStorage, toasts, the legacy castle-law notice) live in the
// loadGame wrapper below.
export function applySave(s) {
    G.map = s.map;
    G.fog = s.fog;
    G.resources = s.resources;
    G.population = s.population;
    G.maxPop = s.maxPop;
    G.happiness = s.happiness;
    G.defense = s.defense;
    G.day = s.day;
    G.dayPhase = s.dayPhase;
    G.gameTick = s.gameTick;
    G.nextRaidDay = s.nextRaidDay;
    G.raidInterval = s.raidInterval;
    // Loop 139: expose savedAt on G so loadAndStart can compute the
    // real-world wait. Legacy saves without this field: stays undefined.
    G._savedAt = s.savedAt;
    setSeed(s.seed);

    // Rebuild citizens (without jobBuilding/home refs yet).
    // v2 saves predate the rest-as-energy semantics (rest was always 0):
    // migrate to full energy so legacy citizens don't wake up exhausted.
    G.citizens = s.citizens.map(c => ({
      ...c, jobBuilding: null, home: null, path: null, pathIdx: 0,
      rest: s.v >= 3 ? (c.rest ?? 100) : 100,
      needs: c.needs || { joy: 55, faith: 55 },
    }));

    // Rebuild buildings with worker refs
    G.buildings = s.buildings.map(b => ({
      type: b.type, x: b.x, y: b.y, hp: b.hp, prodTimer: b.prodTimer,
      level: b.level || 1,
      visits: b.visits || {},
      trainTimer: b.trainTimer || 0,
      // Legacy saves (construction-field era) have no buildProgress —
      // restore as complete, matching their old on-load behavior.
      buildProgress: b.buildProgress !== undefined ? b.buildProgress : 1,
      buildTotal: b.buildTotal || 0,
      active: true, produced: b.produced || null, prodShowCount: 0,
      workers: (b.workerIdxs || []).map(i => G.citizens[i]).filter(Boolean),
    }));
    // Army restoration (additive on v2; legacy saves start fresh at defend)
    G.armyStance = s.armyStance || 'defend';
    G.rallyPoint = s.rallyPoint || null;
    G.soldiers = (s.soldiers || []).map(sd => ({
      x: sd.x, y: sd.y, tx: sd.tx, ty: sd.ty, type: sd.type || 'swordsman',
      hp: sd.hp, maxHp: sd.maxHp || 75, name: sd.name,
      homeBuilding: sd.homeBuildingIdx >= 0 ? G.buildings[sd.homeBuildingIdx] || null : null,
      garrison: sd.garrisonIdx >= 0 ? G.buildings[sd.garrisonIdx] || null : null,
      state: 'patrol', stateTimer: 1, target: null,
    }));

    // Relink citizen jobBuilding + home
    s.citizens.forEach((c, i) => {
      if (c.jobBuildingIdx >= 0 && c.jobBuildingIdx < G.buildings.length) {
        G.citizens[i].jobBuilding = G.buildings[c.jobBuildingIdx];
      }
      if (c.homeIdx >= 0 && c.homeIdx < G.buildings.length) {
        G.citizens[i].home = G.buildings[c.homeIdx];
      }
    });

    rebuildBuildingGrid();

    // The founder (Phase 3d): restore from v3 saves; legacy realms gain
    // one at the settlement center on first load.
    if (s.avatar) {
      G.avatar = makeAvatar(s.avatar.x, s.avatar.y);
      if (s.avatar.name) G.avatar.name = s.avatar.name;
    } else {
      G.avatar = null;
      ensureAvatar();
    }

    // Restore mission done states
    for (const ms of s.missions) {
      const m = missions.find(x => x.id === ms.id);
      if (m) m.done = ms.done;
    }

    // Restore research
    if (Array.isArray(s.researchedTechs)) {
      G.researchedTechs = new Set(s.researchedTechs);
    }
    G.currentResearch = s.currentResearch || null;

    // Restore events
    G.activeEvent = s.activeEvent || null;
    G.eventModifiers = s.eventModifiers
      ? { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1, ...s.eventModifiers }
      : { foodProd: 1, goldProd: 1, happinessOffset: 0, speedMult: 1 };

    // Restore caravans
    G.caravans = (s.caravans || []).map(c => ({
      ...c,
      building: c.buildingIdx >= 0 ? G.buildings[c.buildingIdx] : null,
    }));

    if (s.tileWear) {
      G.tileWear = s.tileWear.map(row => Uint8Array.from(row));
    } else {
      G.tileWear = null;
    }

    G.particles = [];
    G.chronicle = Array.isArray(s.chronicle) ? s.chronicle : [];
    G.storyFlags = s.storyFlags || {};
    G.namedCharacters = s.namedCharacters || {};
    // Loop 197: restore G.realmEnded (192-filed silent-module flag).
    // Falls back to deriving from storyFlags.realm_fell for legacy saves.
    G.realmEnded = !!s.realmEnded || !!(s.storyFlags && s.storyFlags.realm_fell);
    // Loop 211 restore: lastRaidDay (sustained-peace beat infrastructure).
    // Legacy saves without the field default to undefined; the
    // sustained_peace_known beat gate handles this defensively
    // (defaults to G.day so peace-counter starts fresh on legacy load).
    if (s.lastRaidDay !== undefined) G.lastRaidDay = s.lastRaidDay;
    if (s.lastDeathDay !== undefined) G.lastDeathDay = s.lastDeathDay;
    if (s.lastUnderpopDay !== undefined) G.lastUnderpopDay = s.lastUnderpopDay;
    if (s.kingdomName) G.kingdomName = s.kingdomName;
    if (s.scenario) G.scenario = s.scenario;
    if (s.difficulty) G.difficulty = s.difficulty;
    // Loop 31 restore additions
    if (s.season) G.season = s.season;
    if (s.weather) G.weather = s.weather;
    if (s.stats) G.stats = { ...G.stats, ...s.stats };
    // Loop 317 (the-fixer, 316 [code] filing): backfill everHadBuilding
    // from currently-loaded G.buildings. Pre-311 saves do not have this
    // field; spreading s.stats over G.stats leaves the empty {} from
    // initial state, and silent_morning_known (year3 + everHadBuilding.
    // church) would never fire even with church present. Backfill ensures
    // legacy-saved realms can still experience the beat.
    G.stats.everHadBuilding = G.stats.everHadBuilding || {};
    for (const b of G.buildings || []) G.stats.everHadBuilding[b.type] = true;
    // Housing-tier grace: no devolution until walkers have had time to
    // respawn and refresh b.visits after a load (covers legacy saves too).
    G._tierGraceUntil = G.gameTick + 1200;
    // The Three Ages: legacy saves derive their era from what the realm
    // already researched/achieved so nothing is locked out. Must run after
    // researchedTechs, buildings and stats are restored (deriveEra reads all
    // three via the era gates in tech.js).
    G.era = s.era ?? deriveEra();
    if (s.eraStartDay) {
      G.eraStartDay = s.eraStartDay;
    } else {
      G.eraStartDay = { 1: 1 };
      if (G.era > 1) G.eraStartDay[G.era] = G.day;
    }
    G.won = !!s.won;
    G.wonder = s.wonder || null;
    // Pre-D4 saves were played under castle-wins law. If such a realm holds
    // a completed castle un-won, tell the player the law changed — once
    // (the next save writes a wonder key, so this never re-fires).
    if (s.wonder === undefined && !G.won
        && G.buildings.some(b => b.type === 'castle' && (b.buildProgress === undefined || b.buildProgress >= 1))) {
      G.storyFlags = G.storyFlags || {};
      G.storyFlags.castleStands = true;
      G._castleLawChangedNotice = true; // shell wrapper surfaces the toast
    }
    if (Array.isArray(s.notificationLog)) G.notificationLog = s.notificationLog;
    G.deathMarkers = Array.isArray(s.deathMarkers) ? s.deathMarkers : [];
    return true;
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { showToast('No save found.', true); return false; }
    const s = JSON.parse(raw);
    if (s.v !== 2 && s.v !== 3) { showToast('Incompatible save.', true); return false; }
    applySave(s);
    if (G._castleLawChangedNotice) {
      delete G._castleLawChangedNotice;
      setTimeout(() => {
        try { notify('📜 The law of the realm has changed: the Castle anchors your defense — victory is now the Hall of Ages (research Monuments).', 'mission', { chronicle: false }); } catch (_e) {}
      }, 800);
    }
    showToast('Game loaded.');
    return true;
  } catch (e) {
    console.error('Load failed:', e);
    showToast('Load failed.', true);
    return false;
  }
}

export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

function showSaveIndicator() {
  // Remove any existing indicator to reset the animation
  const existing = document.getElementById('save-indicator');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'save-indicator';
  el.textContent = '💾 Saved';
  el.style.cssText = 'position:fixed;top:3.5rem;left:0.8rem;background:rgba(15,15,30,0.9);color:var(--gold);padding:0.3rem 0.6rem;border-radius:6px;font-size:0.7rem;opacity:0;transition:opacity 0.3s;z-index:20;pointer-events:none';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  setTimeout(() => { el.style.opacity = '0'; }, 1500);
  setTimeout(() => { el.remove(); }, 2000);
}

function showToast(msg, danger = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}
