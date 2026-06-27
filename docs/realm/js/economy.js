// ════════════════════════════════════════════════════════════
// Economy — resources, production, buildings, raids
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TILE, rng, rngInt, rngRange, randomName, resourceEmoji, getSeasonData, getDifficulty } from './state.js';
import { getProductionMultiplier, getHappinessOffset } from './events.js';
import { revealAround, makeCitizen, rebuildBuildingGrid } from './world.js';
import { playSound, playBuildingSound } from './audio.js';
import { spawnDust } from './particles.js';
import { panCameraTo } from './render.js?realm=110e';
import { chronicle } from './story.js';
import { notify, notifyBuild } from './notifications.js';
import { isBuildingUnlocked } from './tech.js';

const CONSTRUCTION_TICKS = {
  road: 45,
  wall: 90,
  well: 120,
  farm: 150,
  chickencoop: 150,
  cowpen: 170,
  house: 220,
  lumber: 240,
  quarry: 260,
  mine: 270,
  fisherman: 240,
  bakery: 280,
  blacksmith: 320,
  market: 320,
  tavern: 340,
  school: 340,
  tradingpost: 340,
  archery: 360,
  barracks: 380,
  tower: 400,
  church: 420,
  windmill: 420,
  townhall: 460,
  granary: 340,
  castle: 600,
};

function constructionTicks(type) {
  return CONSTRUCTION_TICKS[type] || 300;
}

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
  const b = {
    type, x:tx, y:ty, hp:100, workers:[], active:true, prodTimer:0,
    produced:null, prodShowCount:0, level:1,
    buildProgress: 0,
    buildTotal: constructionTicks(type),
    buildStartedAt: G.gameTick || 0,
  };
  G.buildings.push(b);
  G.buildingGrid[ty][tx] = b;
  if (def.pop) { G.maxPop += def.pop; trySpawnSettlers(def.pop); }
  if (def.reveal) revealAround(tx, ty, def.reveal);
  if (def.defense) G.defense += def.defense;
  if (def.happiness) G.happiness = Math.min(100, G.happiness + def.happiness);
  if (G.stats) G.stats.buildingsBuilt++;
  if (G.stats) {
    G.stats.everHadBuilding = G.stats.everHadBuilding || {};
    G.stats.everHadBuilding[type] = true;
  }
  // Record for undo. Loop 025 (the-fixer, closing 024 pessimist bug):
  // snapshot storyFlags and chronicle length at push-time. Without this,
  // pressing undo on a first-build leaves the chronicle entry AND the
  // `firstX` flag in place — the chronicle narrates an event that didn't
  // persistently happen, and a later rebuild gets no new beat (flag blocks
  // re-fire). Shallow clone of storyFlags is sufficient; it's a flat
  // object keyed by flag name. Chronicle length is truncated on undo.
  G._undoStack = G._undoStack || [];
  G._undoStack.push({
    b,
    flagsSnapshot: { ...(G.storyFlags || {}) },
    chronicleLen: (G.chronicle || []).length,
  });
  if (G._undoStack.length > 10) G._undoStack.shift();
  playBuildingSound(type);
  spawnDust(tx, ty);
  notifyBuild(type);
  // Build ripple effect
  if (!G._buildRipples) G._buildRipples = [];
  G._buildRipples.push({ x: tx, y: ty, radius: 3, alpha: 0.8 });
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
  if (def.pop) G.maxPop = Math.max(0, G.maxPop - def.pop);
  if (def.defense) G.defense = Math.max(0, G.defense - def.defense);
  // Refund half the cost only on voluntary demolish — enemies don't give back materials!
  if (!byEnemy) {
    for (const [k,v] of Object.entries(def.cost)) G.resources[k] = (G.resources[k]||0) + Math.floor(v/2);
  }
  for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
  if (byEnemy && G.stats) G.stats.buildingsLost++;
  playSound('demolish');
}

export function undoLastBuild() {
  if (!G._undoStack || G._undoStack.length === 0) return false;
  const entry = G._undoStack.pop();
  // Loop 025 (the-fixer, closing 024): entries are now `{b, flagsSnapshot,
  // chronicleLen}` wrappers. Raw-building entries are not expected in the
  // current codebase (undo stack is in-memory only) but a defensive unwrap
  // keeps older shapes from crashing this path.
  const b = entry && entry.b ? entry.b : entry;
  if (!G.buildings.includes(b)) return false;
  const def = BUILDINGS[b.type];
  G.buildings = G.buildings.filter(x => x !== b);
  G.buildingGrid[b.y][b.x] = null;
  if (def.pop) G.maxPop -= def.pop;
  if (def.defense) G.defense -= def.defense;
  // Full refund on undo
  for (const [k,v] of Object.entries(def.cost)) G.resources[k] = (G.resources[k]||0) + v;
  for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
  // Restore storyFlags + truncate chronicle to pre-place state so a
  // first-build beat that already fired is reverted. A later rebuild will
  // now correctly re-narrate.
  if (entry && entry.flagsSnapshot) G.storyFlags = entry.flagsSnapshot;
  if (entry && typeof entry.chronicleLen === 'number' && G.chronicle) {
    G.chronicle.length = entry.chronicleLen;
  }
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
      // Loop 077: {chronicle:false} — story.js popCheck already writes
      // the canonical 'milestone' entry ("Ten souls now call this land
      // home." etc). 076 HIGH: duplicate at pop 10/25/50/75.
      notify(`🎉 Population reached ${m.label}!`, 'event', { chronicle: false });
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
    // Construction animation: every placed structure now spends a short,
    // readable time in a scaffold/foundation phase before fully appearing.
    if (b.buildProgress !== undefined && b.buildProgress < 1) {
      const total = b.buildTotal || constructionTicks(b.type);
      const before = b.buildProgress;
      b.buildProgress = Math.min(1, b.buildProgress + (G.speed || 1) / total);
      if ((G.gameTick || 0) % 18 === 0 && G.particles.length < 280) {
        spawnDust(b.x, b.y);
      }
      if (before < 1 && b.buildProgress >= 1) {
        b.completeTick = G.gameTick || 0;
        G.particles.push({
          tx: b.x, ty: b.y, offsetY: -18,
          text: 'Complete', alpha: 1.4, vy: -0.18,
          decay: 0.012, type: 'text',
        });
      }
      if (b.buildProgress < 1) continue;
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
    if (!def) continue; // guard against unknown building types
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
      // Grounded production glint every 3rd cycle. Keep passive production
      // feedback in the painted world instead of floating UI text.
      b.prodShowCount = (b.prodShowCount || 0) + 1;
      if (b.prodShowCount % 3 === 0) {
        for (const [k,v] of Object.entries(adjustedProd)) {
          if (v > 0) G.particles.push({
            tx: b.x + (Math.random() - 0.5) * 0.16,
            ty: b.y + (Math.random() - 0.5) * 0.16,
            offsetY: -3,
            text: null,
            alpha: 0.95,
            vy: -0.012,
            decay: 0.014,
            type: 'resource-glint',
            resource: k,
            value: v,
            size: 1.1 + Math.min(2, v) * 0.15,
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
    // Loop 201 (the-fixer, 101 filed 100 ticks): named bard adds a
    // flat +5 happiness baseline. Fourth named-character mechanic
    // (101 teacher / 102 merchant / 105+153 smith / 201 bard).
    // Additive (not multiplicative) — bards raise spirits, they don't
    // amplify existing systems. Stacks before the min-100 / max-10
    // clamp; visible in mid-range realms (10 < base < 95) where it
    // moves the needle without saturating. No chronicle beat (034
    // bard-arrival already announces the character). Pattern: when
    // the bonus is a flat baseline, prefer additive `+= N` over
    // multiplicative `*= 1.N`. 5 of 6 named-cast now have mechanics;
    // mayor (civic-unlock filed 101) + rival (raid-difficulty filed
    // 105) remain. Closes 101 filed bard idea.
    const bardBonus = G.namedCharacters?.bard ? 5 : 0;
    G.happiness = Math.min(100, Math.max(10, 50 + bardBonus + hBonus + getHappinessOffset() - Math.max(0, G.population - G.maxPop) * 5));
  }

  // Food consumption (once per day)
  if (G.gameTick % G.dayLength === 0) {
    // Loop 230 (sustained-state #3 infrastructure): track whenever the
    // realm is below its maximum population. The next full-pop beat
    // (`full_pop_known`) gates on G.day - G.lastUnderpopDay >= 60.
    if (G.population < G.maxPop) G.lastUnderpopDay = G.day;
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
          if (G.stats) G.stats.citizensDied = (G.stats.citizensDied || 0) + 1;  // Loop 242 (241 parity-check discipline applied): starvation was missing the partner stat that lastDeathDay tracks against
          G.lastDeathDay = G.day;  // Loop 228 (sustained-state #2 infrastructure)
          // Death particle
          G.particles.push({
            tx: c.x, ty: c.y, offsetY: -20,
            text: '💀 Starved',
            alpha: 2.0, vy: -0.25, decay: 0.012, type: 'text',
          });
          // Loop 077: {chronicle:false} so direct 'death' write is canonical (076 HIGH)
          notify(`${c.name} has died of starvation!`, 'danger', { chronicle: false });
          try { chronicle(`${c.name} perished from hunger. The realm mourns.`, 'death'); } catch(_e){}
        } else {
          // Citizen flees
          const c2 = G.citizens.pop();
          if (c2.jobBuilding) c2.jobBuilding.workers = c2.jobBuilding.workers.filter(w => w !== c2);
          G.population--;
          // Loop 077: {chronicle:false} (076 MEDIUM) — UI warning, not a raid event
          notify('A settler has left — they could not find food!', 'danger', { chronicle: false });
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
    if (G.population > 3) {
      notify('A new settler arrives!');
      try { chronicle(`A new settler joins the realm. Population: ${G.population}.`, 'birth'); } catch(_e){}
    }
  }
}

export function checkRaids() {
  // Warning: 2 days before raid
  // Loop 083 (the-fixer, 082 HIGH): {chronicle:false} on all pre-
  // raid and raid-spawn notifies. 082's fastForward audit found
  // each raid cycle produces 5 tag:raid chronicle entries — 4 of
  // them are these UI warnings. Real raid MEMORY lives in the
  // enhancements.js:4632-4640 resolution beats. The toast + sound
  // are the live UX; chronicle is the retrospective.
  const daysUntilRaid = G.nextRaidDay - G.day;
  if (daysUntilRaid === 2 && G.dayPhase < 5) {
    notify('⚠️ Scouts report raiders approaching! Raid expected in 2 days.', 'danger', { chronicle: false });
    playSound('raid');
  }
  // Pre-raid warning (1 day before)
  if (G.day === G.nextRaidDay - 1 && !G._raidWarningGiven) {
    G._raidWarningGiven = true;
    notify('⚠️ Raiders approach from the darkness! Prepare your defenses.', 'danger', { chronicle: false });
    playSound('raidWarning');
  }

  // Raid happens — spawn enemies that will walk in and fight soldiers/towers.
  // No more instant-damage abstract calc: let the battle play out visibly.
  if (G.day >= G.nextRaidDay && G.dayPhase < 5) {
    G._raidWarningGiven = false;
    // Loop 16 + 20 + 26 (render S3): raid scaling adapts to the player's
    // defensive posture. Without walls/barracks/towers the game can't
    // realistically scale up wave size — each raid is a wipe.
    // - First raid: small warning raid.
    // - Defenseless towns get nuisance plunderers, not wipe waves.
    // - Defended towns ramp slowly enough that rebuilding is possible.
    const raidsFaced = G.stats?.raidsFaced || (G.lastRaidDay !== undefined ? 1 : 0);
    const isFirstRaid = raidsFaced === 0;
    const hasDefense = G.buildings.some(b =>
      b.type === 'wall' || b.type === 'barracks' || b.type === 'tower' || b.type === 'archery' || b.type === 'castle'
    );
    let baseCount;
    if (isFirstRaid) baseCount = 2;
    else if (!hasDefense) baseCount = raidsFaced < 3 ? 2 : 3;
    else if (G.day < 28) baseCount = Math.min(4, 2 + G.day/12);
    else baseCount = Math.min(9, 2 + G.day/9);
    // Loop 206 (the-fixer, 105 filed 101 ticks): named rival adds +10%
    // raider count when present. Adversarial inverse of the cooperative
    // named-character mechanic pattern (101 teacher / 102 merchant /
    // 105+153 smith / 201 bard). Sixth shipped mechanic; only mayor
    // structural-unlock now remains (101 filed). The realm becomes
    // aware of an external rival when barracks is built (story.js:257
    // → ensureRival); that rival sending more raiders makes narrative
    // sense. Floor() rounding means the +10% only adds whole raiders
    // at baseCount ≥ ~10 — soft difficulty curve that rises with
    // realm age (early raids unaffected; deep-realm raids meaner).
    const rivalMult = G.namedCharacters?.rival ? 1.1 : 1;
    const raiders = Math.max(1, Math.floor(baseCount * getDifficulty().raidMult * rivalMult));
    playSound('raid');

    const report = [`⚔️ RAID: ${raiders} raiders approach!`];
    if (G.defense > 0 || (G.soldiers && G.soldiers.length > 0)) {
      report.push('Your defenders move to intercept.');
    } else {
      // Loop 015 (the-fixer, closing 010 #1): the "No defenders!" toast
      // used to name walls/barracks/towers regardless of whether they
      // were actually available to the player. On Military scenario with
      // zero techs, the toast pointed at buildings the player couldn't
      // see in the build bar. Now we rephrase by what's actually unlocked.
      const wallOK = isBuildingUnlocked('wall');
      const barrackOK = isBuildingUnlocked('barracks'); // towers share the same tech
      let hint;
      if (!wallOK && !barrackOK) {
        hint = '⚠️ No defenders! Research Masonry to unlock walls.';
      } else if (wallOK && !barrackOK) {
        hint = '⚠️ No defenders! Build walls. Research Military for barracks/towers.';
      } else if (!wallOK && barrackOK) {
        hint = '⚠️ No defenders! Build barracks or towers.';
      } else {
        hint = '⚠️ No defenders! Build walls, barracks, or towers.';
      }
      report.push(hint);
    }
    // Loop 083: {chronicle:false} on the per-raid report toasts
    // (spawn + intercept + no-defenders hint). See 082 HIGH.
    for (const line of report) notify(line, 'danger', { chronicle: false });

    // Pan camera to an attacked-area preview
    const firstBuilding = G.buildings.find(b => b.type !== 'road' && b.type !== 'wall');
    if (firstBuilding) {
      try { panCameraTo(firstBuilding.x, firstBuilding.y, 800); } catch (_e) {}
    }

    // Spawn enemy raiders that visibly approach the settlement
    for (let i = 0; i < raiders; i++) {
      const side = Math.floor(Math.random() * 4);
      let ex, ey;
      if (side === 0) { ex = Math.random() * MAP_W; ey = 0; }
      else if (side === 1) { ex = MAP_W - 1; ey = Math.random() * MAP_H; }
      else if (side === 2) { ex = Math.random() * MAP_W; ey = MAP_H - 1; }
      else { ex = 0; ey = Math.random() * MAP_H; }
      G.enemies.push({
        x: ex, y: ey, tx: MAP_W/2, ty: MAP_H/2,
        hp: isFirstRaid ? 24 : 30,
        maxHp: isFirstRaid ? 24 : 30,
        damage: isFirstRaid ? 5 : 7,
        plunderGoal: isFirstRaid ? 20 : (hasDefense ? 42 : 30),
        type: 'raider',
        state: 'approach',
        variant: Math.floor(Math.random() * 3), // 0=swordsman 1=spearman 2=berserker
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

    const recoveryWindow = hasDefense ? 8 : 10;
    const interval = Math.max(recoveryWindow, G.raidInterval || recoveryWindow);
    G.nextRaidDay = G.day + interval + rngInt(0,3);
    G.raidInterval = Math.max(recoveryWindow, (G.raidInterval || interval) - (hasDefense && G.day > 40 ? 1 : 0));
    // Loop 211 (surprise, closes 060 filed ~150 ticks): track the day
    // each raid happened. Enables the sustained-peace beat (story.js
    // sustained_peace_known) which fires when raidsSurvived ≥ 1 AND
    // G.day - G.lastRaidDay ≥ 50. Persisted via save.js for cross-
    // reload integrity. ~1 LoC infrastructure for an entirely new
    // beat shape (sustained-state).
    G.lastRaidDay = G.day;
    // Loop 014 (the-fixer): only count the raid toward "Survive N raids"
    // if the player had actual defenses when it spawned. Previously this
    // incremented unconditionally in main.js, so 5/5 was achievable by
    // standing still through five raids with zero military buildings.
    // hasDefense is computed above (line ~371) for raid-scaling; reuse.
    if (G.stats) {
      G.stats.raidsFaced = (G.stats.raidsFaced || 0) + 1;
      if (hasDefense) G.stats.raidsSurvived++;
    }
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
      // Loop 077: {chronicle:false} (076 MEDIUM) — UI-only failure message
      notify(`Not enough resources to upgrade! Need: ${costStr}`, 'danger', { chronicle: false });
      return false;
    }
  }

  // Deduct cost
  for (const [k, v] of Object.entries(nextUpgrade.cost)) G.resources[k] -= v;

  b.level++;
  b.upgradeTick = G.gameTick || 0;
  playSound('upgrade');
  spawnDust(b.x, b.y);
  G.particles.push({
    tx: b.x, ty: b.y, offsetY: -22,
    text: `Level ${b.level}`, alpha: 1.6, vy: -0.2,
    decay: 0.011, type: 'text',
  });
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
      // Loop 077: {chronicle:false} (076 MEDIUM) — was writing tag:raid, wrong tag for fire
      notify(`🔥 ${BUILDINGS[b.type]?.name || b.type} burned down!`, 'danger', { chronicle: false });
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
