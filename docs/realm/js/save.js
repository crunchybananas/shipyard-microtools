// ════════════════════════════════════════════════════════════
// Save/Load — localStorage serialization
// ════════════════════════════════════════════════════════════

import { G, getSeed, setSeed } from './state.js';
import { rebuildBuildingGrid } from './world.js';
import { missions } from './missions.js';

const SAVE_KEY = 'realm-save-v2';

export function saveGame() {
  try {
    const state = {
      v: 2,
      map: G.map,
      fog: G.fog,
      buildings: G.buildings.map(b => ({
        type: b.type, x: b.x, y: b.y, hp: b.hp, prodTimer: b.prodTimer,
        workerIdxs: b.workers.map(w => G.citizens.indexOf(w)),
      })),
      citizens: G.citizens.map(c => ({
        x:c.x, y:c.y, tx:c.tx, ty:c.ty, speed:c.speed,
        name:c.name, hunger:c.hunger, rest:c.rest,
        state:c.state, stateTimer:c.stateTimer,
        carrying:c.carrying, carryAmount:c.carryAmount,
        jobBuildingIdx: c.jobBuilding ? G.buildings.indexOf(c.jobBuilding) : -1,
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    showToast('Game saved.');
  } catch (e) {
    console.error('Save failed:', e);
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { showToast('No save found.', true); return false; }
    const s = JSON.parse(raw);
    if (s.v !== 2) { showToast('Incompatible save.', true); return false; }

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
    setSeed(s.seed);

    // Rebuild citizens (without jobBuilding refs yet)
    G.citizens = s.citizens.map(c => ({
      ...c, jobBuilding: null, path: null, pathIdx: 0,
    }));

    // Rebuild buildings with worker refs
    G.buildings = s.buildings.map(b => ({
      type: b.type, x: b.x, y: b.y, hp: b.hp, prodTimer: b.prodTimer,
      active: true, produced: null,
      workers: (b.workerIdxs || []).map(i => G.citizens[i]).filter(Boolean),
    }));

    // Relink citizen jobBuilding
    s.citizens.forEach((c, i) => {
      if (c.jobBuildingIdx >= 0 && c.jobBuildingIdx < G.buildings.length) {
        G.citizens[i].jobBuilding = G.buildings[c.jobBuildingIdx];
      }
    });

    rebuildBuildingGrid();

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
    G.eventModifiers = s.eventModifiers || { foodProd: 1, goldProd: 1, happinessOffset: 0 };

    // Restore caravans
    G.caravans = (s.caravans || []).map(c => ({
      ...c,
      building: c.buildingIdx >= 0 ? G.buildings[c.buildingIdx] : null,
    }));

    G.particles = [];
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

function showToast(msg, danger = false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}
