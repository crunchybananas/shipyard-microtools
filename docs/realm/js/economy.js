// ════════════════════════════════════════════════════════════
// Economy — resources, production, buildings, raids
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng, rngInt, rngRange, randomName, resourceEmoji } from './state.js';
import { revealAround, makeCitizen, rebuildBuildingGrid } from './world.js';
import { playSound } from './audio.js';

export function canPlace(type, tx, ty) {
  if (tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return false;
  if (!G.fog[ty][tx]) return false;
  const tile = G.map[ty][tx];
  if (tile === 0 || tile === 6) return false; // water, mountain
  if (G.buildingGrid[ty]?.[tx]) return false;
  const def = BUILDINGS[type];
  if (def.on && !def.on.includes(tile)) return false;
  return true;
}

export function canAfford(type) {
  const c = BUILDINGS[type].cost;
  for (const [k,v] of Object.entries(c)) if ((G.resources[k]||0) < v) return false;
  return true;
}

export function placeBuilding(type, tx, ty) {
  if (!canPlace(type,tx,ty) || !canAfford(type)) return false;
  const def = BUILDINGS[type];
  for (const [k,v] of Object.entries(def.cost)) G.resources[k] -= v;
  const b = { type, x:tx, y:ty, hp:100, workers:[], active:true, prodTimer:0, produced:null };
  G.buildings.push(b);
  G.buildingGrid[ty][tx] = b;
  if (def.pop) { G.maxPop += def.pop; trySpawnSettlers(def.pop); }
  if (def.reveal) revealAround(tx, ty, def.reveal);
  if (def.defense) G.defense += def.defense;
  if (def.happiness) G.happiness = Math.min(100, G.happiness + def.happiness);
  playSound('build');
  return true;
}

export function demolishBuilding(b) {
  const def = BUILDINGS[b.type];
  G.buildings = G.buildings.filter(x => x !== b);
  G.buildingGrid[b.y][b.x] = null;
  if (def.pop) G.maxPop -= def.pop;
  if (def.defense) G.defense -= def.defense;
  for (const [k,v] of Object.entries(def.cost)) G.resources[k] = (G.resources[k]||0) + Math.floor(v/2);
  for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
  playSound('build');
}

export function trySpawnSettlers(count) {
  const max = Math.min(count, G.maxPop - G.population);
  for (let i = 0; i < max; i++) {
    const cx = MAP_W/2 + rngRange(-3,3);
    const cy = MAP_H/2 + rngRange(-3,3);
    G.citizens.push(makeCitizen(cx, cy));
    G.population++;
  }
}

export function updateProduction() {
  for (const b of G.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.prod) continue;
    const needed = def.workers || 0;
    if (b.workers.length < needed) continue;

    b.prodTimer++;
    const interval = 120;
    if (b.prodTimer >= interval) {
      b.prodTimer = 0;
      // If a worker is available to carry, set produced flag
      const carrier = b.workers.find(w => w.state === 'working');
      if (carrier) {
        b.produced = { ...def.prod };
      } else {
        // No worker at station — auto-collect
        for (const [k,v] of Object.entries(def.prod)) {
          G.resources[k] = (G.resources[k]||0) + v;
        }
      }
      // Floating particle either way
      for (const [k,v] of Object.entries(def.prod)) {
        G.particles.push({
          tx: b.x, ty: b.y, offsetY: 0,
          text: `+${v} ${resourceEmoji(k)}`,
          alpha: 1.5, vy: -0.3,
        });
      }
      playSound('produce');
    }
  }

  // Hunger
  if (G.gameTick % 60 === 0) {
    for (const c of G.citizens) c.hunger = Math.min(100, c.hunger + 3);
  }

  // Happiness
  if (G.gameTick % 120 === 0) {
    let hBonus = 0;
    for (const b of G.buildings) {
      const def = BUILDINGS[b.type];
      if (def.happiness) hBonus += def.happiness;
    }
    G.happiness = Math.min(100, Math.max(10, 50 + hBonus - Math.max(0, G.population - G.maxPop) * 5));
  }

  // Food consumption
  if (G.gameTick % 180 === 0) {
    const foodNeeded = Math.ceil(G.population * 0.5);
    G.resources.food = Math.max(0, G.resources.food - foodNeeded);
    if (G.resources.food <= 0 && G.population > 1) {
      G.happiness = Math.max(0, G.happiness - 10);
      if (G.happiness < 10 && G.citizens.length > 1) {
        const c = G.citizens.pop();
        if (c.jobBuilding) c.jobBuilding.workers = c.jobBuilding.workers.filter(w=>w!==c);
        G.population--;
        showToast('A settler has left due to starvation!', true);
      }
    }
  }

  // ── Caravans ──────────────────────────────────────────────
  updateCaravans();

  // Passive gold income: +1 per 5 population each day cycle
  if (G.gameTick % G.dayLength === 0 && G.population >= 5) {
    const goldIncome = Math.floor(G.population / 5);
    G.resources.gold += goldIncome;
    if (goldIncome > 0) {
      G.particles.push({
        tx: MAP_W / 2, ty: MAP_H / 2, offsetY: 0,
        text: `+${goldIncome} 🪙 taxes`, alpha: 1.8, vy: -0.3, type: 'text',
      });
    }
  }

  // Immigration
  if (G.gameTick % 300 === 0 && G.happiness > 60 && G.population < G.maxPop) {
    trySpawnSettlers(1);
    if (G.population > 3) showToast('A new settler arrives!');
  }
}

export function checkRaids() {
  if (G.day >= G.nextRaidDay && G.dayPhase < 5) {
    const raiders = Math.floor(2 + G.day/5);
    const dmg = Math.max(0, raiders * 10 - G.defense);
    playSound('raid');
    if (dmg > 0) {
      const damageable = G.buildings.filter(b => b.type !== 'road' && b.type !== 'wall');
      if (damageable.length > 0) {
        const target = damageable[rngInt(0, damageable.length-1)];
        target.hp -= dmg;
        if (target.hp <= 0) {
          demolishBuilding(target);
          showToast(`Raiders destroyed the ${BUILDINGS[target.type].name}!`, true);
        } else {
          showToast(`Raiders attacked! ${G.defense>0?'Defenses held partially.':'No defenses!'}`, true);
        }
      }
    } else {
      showToast('Raiders repelled by your defenses!');
    }
    G.nextRaidDay = G.day + G.raidInterval + rngInt(-1,2);
    G.raidInterval = Math.max(4, G.raidInterval - 1);
  }
}

// ── Caravan system ─────────────────────────────────────────
function findMapEdge(bx, by) {
  // Find nearest walkable tile on the map edge
  let bestDist = Infinity, bestX = 0, bestY = 0;
  for (let x = 0; x < MAP_W; x++) {
    for (const y of [1, MAP_H - 2]) {
      if (G.map[y][x] !== 0 && G.map[y][x] !== 6) {
        const d = Math.abs(x - bx) + Math.abs(y - by);
        if (d < bestDist) { bestDist = d; bestX = x; bestY = y; }
      }
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    for (const x of [1, MAP_W - 2]) {
      if (G.map[y][x] !== 0 && G.map[y][x] !== 6) {
        const d = Math.abs(x - bx) + Math.abs(y - by);
        if (d < bestDist) { bestDist = d; bestX = x; bestY = y; }
      }
    }
  }
  return { x: bestX, y: bestY, dist: bestDist };
}

function spawnCaravan(b) {
  const edge = findMapEdge(b.x, b.y);
  const gold = 5 + Math.floor(edge.dist * 0.4) + rngInt(0, 5);
  G.caravans.push({
    x: b.x, y: b.y,
    tx: edge.x, ty: edge.y,
    homeX: b.x, homeY: b.y,
    phase: 'outbound',
    gold,
    building: b,
    speed: 0.03,
  });
  b.caravanOut = true;
}

function updateCaravans() {
  // Spawn caravans from idle trading posts every 2 day cycles
  if (G.gameTick % (G.dayLength * 2) === 0) {
    for (const b of G.buildings) {
      if (b.type !== 'tradingpost') continue;
      if (b.caravanOut) continue;
      if (b.workers.length < 1) continue;
      spawnCaravan(b);
    }
  }

  // Move caravans
  for (let i = G.caravans.length - 1; i >= 0; i--) {
    const c = G.caravans[i];
    const dx = c.tx - c.x, dy = c.ty - c.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.15) {
      const spd = c.speed * G.speed;
      c.x += (dx / dist) * Math.min(spd, dist);
      c.y += (dy / dist) * Math.min(spd, dist);
    } else {
      if (c.phase === 'outbound') {
        // Reached edge — turn around with gold
        c.phase = 'returning';
        c.tx = c.homeX;
        c.ty = c.homeY;
      } else {
        // Returned home — deliver gold
        G.resources.gold += c.gold;
        G.particles.push({
          tx: c.homeX, ty: c.homeY, offsetY: 0,
          text: `+${c.gold} 🪙 trade`, alpha: 1.8, vy: -0.3, type: 'text',
        });
        playSound('produce');
        if (c.building) c.building.caravanOut = false;
        G.caravans.splice(i, 1);
      }
    }
  }
}

// Imported from ui.js to avoid circular — using a simple global
function showToast(msg, danger=false) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = danger ? 'var(--danger)' : 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(()=>el.classList.remove('show'), 2500);
}
