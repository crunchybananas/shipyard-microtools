// ════════════════════════════════════════════════════════════
// Economy — resources, production, buildings, raids
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TILE, rng, rngInt, rngRange, randomName, resourceEmoji, getSeasonData, getDifficulty } from './state.js';
import { getProductionMultiplier, getHappinessOffset } from './events.js';
import { revealAround, makeCitizen, rebuildBuildingGrid } from './world.js';
import { playSound, playBuildingSound } from './audio.js';
import { spawnDust } from './particles.js';
import { panCameraTo } from './render.js';
import { notify, notifyBuild } from './notifications.js';

export function canPlace(type, tx, ty) {
  if (tx<0||tx>=MAP_W||ty<0||ty>=MAP_H) return false;
  if (!G.fog[ty][tx]) return false;
  const tile = G.map[ty][tx];
  if (tile === 0 || tile === 6) return false; // water, mountain
  if (G.buildingGrid[ty]?.[tx]) return false;
  const def = BUILDINGS[type];
  if (def.on && !def.on.includes(tile)) return false;
  if (type === 'fisherman') {
    const adjacent = [[-1,0],[1,0],[0,-1],[0,1]];
    const hasWater = adjacent.some(([dx,dy]) => {
      const nx = tx+dx, ny = ty+dy;
      return nx>=0 && nx<MAP_W && ny>=0 && ny<MAP_H && G.map[ny][nx] === TILE.WATER;
    });
    if (!hasWater) return false;
  }
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
  const b = { type, x:tx, y:ty, hp:100, workers:[], active:true, prodTimer:0, produced:null, prodShowCount:0, level:1, buildProgress: 0 };
  G.buildings.push(b);
  G.buildingGrid[ty][tx] = b;
  if (def.pop) { G.maxPop += def.pop; trySpawnSettlers(def.pop); }
  if (def.reveal) revealAround(tx, ty, def.reveal);
  if (def.defense) G.defense += def.defense;
  if (def.happiness) G.happiness = Math.min(100, G.happiness + def.happiness);
  if (G.stats) G.stats.buildingsBuilt++;
  // Record for undo
  G._undoStack = G._undoStack || [];
  G._undoStack.push(b);
  if (G._undoStack.length > 10) G._undoStack.shift();
  playBuildingSound(type);
  spawnDust(tx, ty);
  notifyBuild(type);
  // Victory check
  if (type === 'castle' && !G.won) {
    G.won = true;
    setTimeout(() => showVictoryScreen(), 500);
  }
  return true;
}

export function demolishBuilding(b, byEnemy = false) {
  const def = BUILDINGS[b.type];
  G.buildings = G.buildings.filter(x => x !== b);
  G.buildingGrid[b.y][b.x] = null;
  if (def.pop) G.maxPop -= def.pop;
  if (def.defense) G.defense -= def.defense;
  for (const [k,v] of Object.entries(def.cost)) G.resources[k] = (G.resources[k]||0) + Math.floor(v/2);
  for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
  if (byEnemy && G.stats) G.stats.buildingsLost++;
  playSound('demolish');
}

export function undoLastBuild() {
  if (!G._undoStack || G._undoStack.length === 0) return false;
  const b = G._undoStack.pop();
  if (!G.buildings.includes(b)) return false;
  const def = BUILDINGS[b.type];
  G.buildings = G.buildings.filter(x => x !== b);
  G.buildingGrid[b.y][b.x] = null;
  if (def.pop) G.maxPop -= def.pop;
  if (def.defense) G.defense -= def.defense;
  // Full refund on undo
  for (const [k,v] of Object.entries(def.cost)) G.resources[k] = (G.resources[k]||0) + v;
  for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
  playSound('click');
  return true;
}

export function trySpawnSettlers(count) {
  const max = Math.min(count, G.maxPop - G.population);
  for (let i = 0; i < max; i++) {
    const cx = MAP_W/2 + rngRange(-3,3);
    const cy = MAP_H/2 + rngRange(-3,3);
    G.citizens.push(makeCitizen(cx, cy));
    G.population++;
  }
  if (max > 0 && G.stats) G.stats.citizensBorn += max;

  // Check population milestones
  const milestones = [
    { pop: 10, key: '_milestone10', label: '10' },
    { pop: 25, key: '_milestone25', label: '25' },
    { pop: 50, key: '_milestone50', label: '50' },
    { pop: 75, key: '_milestone75', label: '75' },
  ];
  for (const m of milestones) {
    if (G.population >= m.pop && !G[m.key]) {
      G[m.key] = true;
      notify(`🎉 Population reached ${m.label}!`, 'event');
      playSound('mission');
      for (let i = 0; i < 20; i++) {
        G.particles.push({
          tx: MAP_W/2 + (Math.random()-0.5)*6,
          ty: MAP_H/2 + (Math.random()-0.5)*6,
          offsetY: -15 - Math.random()*25,
          text: ['🎉','⭐','✨'][Math.floor(Math.random()*3)],
          alpha: 1.5, vy: -0.15 - Math.random()*0.2,
          decay: 0.008, type: 'text',
        });
      }
    }
  }
}

export function updateProduction() {
  for (const b of G.buildings) {
    // Construction animation: grow from 0 to 1 over ~100 ticks
    if (b.buildProgress !== undefined && b.buildProgress < 1) {
      b.buildProgress = Math.min(1, b.buildProgress + 0.01 * G.speed);
    }

    // Archery range: train archers
    if (b.type === 'archery' && b.workers.length >= 1) {
      b.trainTimer = (b.trainTimer || 0) + 1;
      const cap = 3;
      const current = G.soldiers.filter(s => s.homeBuilding === b).length;
      if (b.trainTimer >= 800 && current < cap && G.resources.wood >= 2) {
        b.trainTimer = 0;
        G.resources.wood -= 2;
        G.soldiers.push({
          x: b.x + 0.5, y: b.y + 0.5,
          tx: b.x, ty: b.y,
          homeBuilding: b,
          type: 'archer',
          hp: 30, maxHp: 30,
          state: 'patrol', stateTimer: 0, target: null,
        });
      }
    }

    // Barracks: train soldiers
    if (b.type === 'barracks' && b.workers.length >= 1) {
      b.trainTimer = (b.trainTimer || 0) + 1;
      const cap = 4; // max 4 soldiers per barracks
      const current = G.soldiers.filter(s => s.homeBuilding === b).length;
      if (b.trainTimer >= 600 && current < cap && G.resources.iron >= 1) {
        b.trainTimer = 0;
        G.resources.iron--;
        G.soldiers.push({
          x: b.x + 0.5, y: b.y + 0.5,
          tx: b.x, ty: b.y,
          homeBuilding: b,
          type: 'swordsman',
          hp: 75, maxHp: 75,
          state: 'patrol',
          stateTimer: 0,
          target: null,
        });
      }
    }

    const def = BUILDINGS[b.type];
    if (!def.prod) continue;
    const needed = def.workers || 0;
    if (b.workers.length < needed) continue;

    b.prodTimer++;
    const interval = Math.floor(G.dayLength / 5); // produce ~5 times per day
    if (b.prodTimer >= interval) {
      b.prodTimer = 0;
      // Apply event + season multipliers
      const season = getSeasonData();
      // Level multiplier: use the prodMult from the upgrade that was applied (level 1 = 1.0, level 2+ = upgrade's prodMult)
      const upgrades = def.upgrades || [];
      const levelMult = b.level >= 2 ? (upgrades[b.level - 2]?.prodMult ?? 1) : 1;
      const adjustedProd = {};
      for (const [k,v] of Object.entries(def.prod)) {
        let mult = getProductionMultiplier(k) * levelMult;
        if (k === 'food') mult *= season.foodMult;
        adjustedProd[k] = Math.round(v * mult);
      }
      // Apply windmill/bakery boosts to farms
      if (b.type === 'farm') {
        let boost = 1;
        for (const other of G.buildings) {
          if (!other.active) continue;
          const odef = BUILDINGS[other.type];
          if (!odef.boost || odef.boost.target !== 'farm') continue;
          const d = Math.abs(other.x - b.x) + Math.abs(other.y - b.y);
          if (d <= odef.boost.radius) boost *= odef.boost.multiplier;
        }
        if (boost > 1) {
          for (const k of Object.keys(adjustedProd)) {
            adjustedProd[k] = Math.round(adjustedProd[k] * boost);
          }
        }
      }
      // If a worker is available to carry, set produced flag
      const carrier = b.workers.find(w => w.state === 'working');
      if (carrier) {
        b.produced = { ...adjustedProd };
      } else {
        for (const [k,v] of Object.entries(adjustedProd)) {
          G.resources[k] = (G.resources[k]||0) + v;
          G.totalResourcesGathered = (G.totalResourcesGathered || 0) + v;
          if (k === 'gold' && G.stats) G.stats.goldEarned += v;
        }
      }
      // Floating particle — show every 3rd production cycle to keep it subtle
      b.prodShowCount = (b.prodShowCount || 0) + 1;
      if (b.prodShowCount % 3 === 0) {
        for (const [k,v] of Object.entries(adjustedProd)) {
          if (v > 0) G.particles.push({
            tx: b.x, ty: b.y, offsetY: 0,
            text: `+${v} ${resourceEmoji(k)}`,
            alpha: 1.5, vy: -0.4, type: 'text',
          });
        }
      }
      playSound('produce');
    }
  }

  // Hunger rises 5 times per day (+6 each time = +30/day total)
  // Citizens eat individually when hunger > 70 (in citizens.js state machine)
  if (G.gameTick % Math.floor(G.dayLength / 5) === 0) {
    for (const c of G.citizens) c.hunger = Math.min(100, c.hunger + 6);
  }

  // Happiness (5 times per day)
  if (G.gameTick % Math.floor(G.dayLength / 5) === 0) {
    const houses = G.buildings.filter(b => BUILDINGS[b.type].pop);
    const totalHouses = houses.length;
    let hBonus = 0;
    for (const b of G.buildings) {
      const def = BUILDINGS[b.type];
      if (!def.happiness) continue;
      if (def.radius && totalHouses > 0) {
        const covered = houses.filter(h => Math.hypot(h.x - b.x, h.y - b.y) <= def.radius).length;
        hBonus += def.happiness * (covered / totalHouses);
      } else {
        hBonus += def.happiness;
      }
    }
    G.happiness = Math.min(100, Math.max(10, 50 + hBonus + getHappinessOffset() - Math.max(0, G.population - G.maxPop) * 5));
  }

  // Food consumption (once per day)
  if (G.gameTick % G.dayLength === 0) {
    let foodNeeded = Math.ceil(G.population * 1.0 * getDifficulty().foodMult);
    // Granaries halve food consumption in winter
    if (G.season === 'winter') {
      const granaries = G.buildings.filter(b => b.type === 'granary').length;
      if (granaries > 0) foodNeeded = Math.ceil(foodNeeded * 0.5);
    }
    G.resources.food = Math.max(0, G.resources.food - foodNeeded);
    if (G.resources.food <= 0 && G.population > 1) {
      G.happiness = Math.max(0, G.happiness - 10);
      if (G.happiness < 20 && G.citizens.length > 1) {
        // Pick the hungriest citizen to die from starvation
        const sorted = [...G.citizens].sort((a, b) => b.hunger - a.hunger);
        const c = sorted[0];
        if (c.hunger >= 90) {
          G.citizens = G.citizens.filter(x => x !== c);
          if (c.jobBuilding) c.jobBuilding.workers = c.jobBuilding.workers.filter(w => w !== c);
          G.population--;
          // Death particle
          G.particles.push({
            tx: c.x, ty: c.y, offsetY: -20,
            text: '💀 Starved',
            alpha: 2.0, vy: -0.25, decay: 0.012, type: 'text',
          });
          notify(`${c.name} has died of starvation!`, 'danger');
        } else {
          // Citizen flees
          const c2 = G.citizens.pop();
          if (c2.jobBuilding) c2.jobBuilding.workers = c2.jobBuilding.workers.filter(w => w !== c2);
          G.population--;
          notify('A settler has left — they could not find food!', 'danger');
        }
      }
    }
    // Track daily food consumption for rate display
    G._dailyFoodConsumed = foodNeeded;
  }

  // ── Caravans ──────────────────────────────────────────────
  updateCaravans();

  // Tax collection is handled by collectTaxes(), called from updateTime() on day change.

  // Immigration (once per day)
  if (G.gameTick % G.dayLength === 0 && G.happiness > 60 && G.population < G.maxPop) {
    trySpawnSettlers(1);
    if (G.population > 3) notify('A new settler arrives!');
  }
}

export function checkRaids() {
  // Warning: 2 days before raid
  const daysUntilRaid = G.nextRaidDay - G.day;
  if (daysUntilRaid === 2 && G.dayPhase < 5) {
    notify('⚠️ Scouts report raiders approaching! Raid expected in 2 days.', 'danger');
    playSound('raid');
  }
  // Pre-raid warning (1 day before)
  if (G.day === G.nextRaidDay - 1 && !G._raidWarningGiven) {
    G._raidWarningGiven = true;
    notify('⚠️ Raiders approach from the darkness! Prepare your defenses.', 'danger');
    playSound('raidWarning');
  }

  // Raid happens
  if (G.day >= G.nextRaidDay && G.dayPhase < 5) {
    G._raidWarningGiven = false;
    const raiders = Math.floor((2 + G.day/5) * getDifficulty().raidMult);
    const totalAttack = raiders * 10;
    const dmg = Math.max(0, totalAttack - G.defense);
    playSound('raid');

    // Detailed raid report
    const report = [`⚔️ RAID: ${raiders} raiders (attack: ${totalAttack}, your defense: ${G.defense})`];

    if (dmg > 0) {
      const damageable = G.buildings.filter(b => b.type !== 'road' && b.type !== 'wall');
      if (damageable.length > 0) {
        const target = damageable[rngInt(0, damageable.length-1)];
        // Cinematic: pan camera to the attacked building
        try { panCameraTo(target.x, target.y, 800); } catch (_e) {}
        target.hp -= dmg;
        if (target.hp <= 0) {
          report.push(`💥 ${BUILDINGS[target.type].name} was destroyed!`);
          G.cameraShake = Math.max(G.cameraShake || 0, 10);
          demolishBuilding(target, true);
        } else {
          report.push(`🔨 ${BUILDINGS[target.type].name} damaged (${target.hp}% HP remaining)`);
        }
      }
      report.push(G.defense > 0 ? 'Defenses absorbed some damage.' : '⚠️ No defenses! Build walls, barracks, or towers.');
    } else {
      report.push('✅ Your defenses held! No damage taken.');
    }

    // Show full report
    for (const line of report) {
      notify(line, dmg > 0 ? 'danger' : 'event');
    }

    // Spawn enemy raiders that visibly approach the settlement
    const raidSize = 3 + Math.floor(G.day / 10);
    for (let i = 0; i < raidSize; i++) {
      const side = Math.floor(Math.random() * 4);
      let ex, ey;
      if (side === 0) { ex = Math.random() * MAP_W; ey = 0; }
      else if (side === 1) { ex = MAP_W - 1; ey = Math.random() * MAP_H; }
      else if (side === 2) { ex = Math.random() * MAP_W; ey = MAP_H - 1; }
      else { ex = 0; ey = Math.random() * MAP_H; }
      G.enemies.push({
        x: ex, y: ey, tx: MAP_W/2, ty: MAP_H/2,
        hp: 30, maxHp: 30,
        type: 'raider',
        state: 'approach',
      });
    }

    // Raid visual effects — dramatic particles at settlement center
    for (let i = 0; i < 15; i++) {
      G.particles.push({
        tx: MAP_W/2 + (Math.random()-0.5)*10,
        ty: MAP_H/2 + (Math.random()-0.5)*10,
        offsetY: -10 - Math.random()*20,
        text: ['⚔️','💥','🔥'][Math.floor(Math.random()*3)],
        alpha: 1.5,
        vy: -0.2 - Math.random()*0.15,
        decay: 0.01,
        type: 'text',
      });
    }
    // Screen flash — add a brief red overlay particle at map center
    G.raidFlash = 1.0;

    G.nextRaidDay = G.day + G.raidInterval + rngInt(-1,2);
    G.raidInterval = Math.max(4, G.raidInterval - 1);
  }
}

// Show raid countdown in HUD
export function getRaidCountdown() {
  const days = G.nextRaidDay - G.day;
  if (days <= 3 && days > 0) return days;
  return null;
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
        if (G.stats) G.stats.goldEarned += c.gold;
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

export function upgradeBuilding(b) {
  const def = BUILDINGS[b.type];
  if (!def.upgrades) return false;
  const nextUpgrade = def.upgrades[b.level - 1];
  if (!nextUpgrade) return false; // already at max level

  // Check affordability
  for (const [k, v] of Object.entries(nextUpgrade.cost)) {
    if ((G.resources[k] || 0) < v) {
      const costStr = Object.entries(nextUpgrade.cost).map(([k,v]) => `${v} ${resourceEmoji(k)}`).join(', ');
      notify(`Not enough resources to upgrade! Need: ${costStr}`, 'danger');
      return false;
    }
  }

  // Deduct cost
  for (const [k, v] of Object.entries(nextUpgrade.cost)) G.resources[k] -= v;

  b.level++;
  playSound('build');
  spawnDust(b.x, b.y);
  const costStr = Object.entries(nextUpgrade.cost).map(([k,v]) => `${v} ${resourceEmoji(k)}`).join(', ');
  notify(`${def.icon} ${def.name} upgraded to ${nextUpgrade.name}! Production ×${nextUpgrade.prodMult}`, 'event');
  return true;
}

function showVictoryScreen() {
  const el = document.getElementById('victory-screen');
  if (!el) return;
  el.style.display = 'flex';
  el.querySelector('.vic-day').textContent = `Day ${G.day}`;
  el.querySelector('.vic-pop').textContent = `${G.population} citizens`;
  el.querySelector('.vic-buildings').textContent = `${G.buildings.length} buildings`;
  el.querySelector('.vic-resources').textContent = `${G.totalResourcesGathered || 0} total`;
  el.querySelector('.vic-techs').textContent = `${G.researchedTechs.size} technologies`;
  const ach = document.querySelectorAll ? document.querySelectorAll('.ach-item.done').length : 0;
  el.querySelector('.vic-achievements').textContent = `${ach} achievements`;
  // Spawn canvas confetti
  spawnVictoryConfetti();
}

function spawnVictoryConfetti() {
  const canvas = document.getElementById('vic-confetti');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const COLORS = ['#FFD166','#EF476F','#06D6A0','#118AB2','#FFB347','#A8DADC','#FF6B6B','#FFF3B0'];
  const pieces = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      vrot: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    });
  }
  let frame = 0;
  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07; // gravity
      p.rot += p.vrot;
      if (p.y > canvas.height * 0.85) p.alpha -= 0.03;
    }
    frame++;
    if (frame < 240 && pieces.some(p => p.alpha > 0)) {
      requestAnimationFrame(drawConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  drawConfetti();
}

export function updateFires() {
  for (const b of [...G.buildings]) {
    if (!b.onFire) continue;
    b._fireTimer = (b._fireTimer || 0) + G.speed;
    b.hp -= 0.5 * G.speed;
    // Spawn fire particles every 4 ticks
    if (G.gameTick % 4 === 0) {
      G.particles.push({
        tx: b.x + (Math.random()-0.5)*0.5, ty: b.y + (Math.random()-0.5)*0.5,
        offsetY: -20 - Math.random()*10,
        text: '🔥', alpha: 1, vy: -0.2, decay: 0.03, type: 'text',
      });
    }
    // Check for wells within radius 4 — auto-douse
    let doused = false;
    for (const w of G.buildings) {
      if (w.type !== 'well') continue;
      const d = Math.abs(w.x - b.x) + Math.abs(w.y - b.y);
      if (d <= 4 && Math.random() < 0.02) {
        b.onFire = false;
        doused = true;
        G.particles.push({
          tx: b.x, ty: b.y, offsetY: -20,
          text: '💧 Doused!', alpha: 1.5, vy: -0.25, decay: 0.012, type: 'text',
        });
        break;
      }
    }
    if (doused) continue;
    // Burn out over time or randomly
    if (b._fireTimer > 300 || Math.random() < 0.005) {
      b.onFire = false;
      continue;
    }
    // Destroy building if HP reaches 0
    if (b.hp <= 0) {
      notify(`🔥 ${BUILDINGS[b.type]?.name || b.type} burned down!`, 'danger');
      G.cameraShake = Math.max(G.cameraShake || 0, 10);
      G.buildings = G.buildings.filter(x => x !== b);
      G.buildingGrid[b.y][b.x] = null;
      if (b.workers) for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
      G.stats.buildingsLost = (G.stats.buildingsLost || 0) + 1;
    }
  }
}

export function collectTaxes() {
  // Only count housed population (not vagrants)
  const housed = G.buildings.filter(b => b.type === 'house').length * 4;
  const effectivePop = Math.min(housed, G.population);
  // Happiness modifier: happy citizens pay more
  const happyMod = G.happiness / 100;
  // Base tax: 0.3 gold per pop per day, scaled by happiness
  const tax = Math.round(effectivePop * 0.3 * happyMod);
  if (tax > 0) {
    G.resources.gold += tax;
    if (G.stats) G.stats.goldEarned += tax;
    // Floating text showing income
    G.particles.push({
      tx: MAP_W/2, ty: MAP_H/2, offsetY: -20,
      text: `+${tax}🪙 taxes`,
      alpha: 1.4, vy: -0.2, decay: 0.01, type: 'text',
    });
  }
}

// notify() is now imported from notifications.js
