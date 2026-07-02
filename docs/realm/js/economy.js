// ════════════════════════════════════════════════════════════
// Economy — resources, production, buildings, raids
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, MAP_W, MAP_H, TILE, rng, rngInt, rngRange, randomName, resourceEmoji, getSeasonData, getDifficulty, HOUSE_TIERS } from './state.js?realm=122';
import { getProductionMultiplier, getHappinessOffset } from './events.js?realm=122';
import { nearestWalkableTile, stepEntityToward } from './pathfinding.js?realm=122';
import { revealAround, makeCitizen, rebuildBuildingGrid } from './world.js?realm=122';
import { playSound, playBuildingSound } from './audio.js?realm=122';
import { spawnDust } from './particles.js?realm=122';
import { panCameraTo } from './render.js?realm=122';
import { chronicle } from './story.js?realm=122';
import { notify, notifyBuild } from './notifications.js?realm=122';
import { isBuildingUnlocked } from './tech.js?realm=122';

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
  sawmill: 260,
  townhall: 460,
  granary: 340,
  castle: 600,
  wonder: 600,
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
  G.obstacleEpoch = (G.obstacleEpoch || 0) + 1;
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
  // Phase D: the castle is no longer the instant win — it anchors the
  // realm's defense and is the Wonder's prerequisite (tech.js gate).
  if (type === 'castle' && !G.storyFlags?.castleStands) {
    G.storyFlags = G.storyFlags || {};
    G.storyFlags.castleStands = true;
    notify('🏰 The Castle stands — the realm may now raise a Wonder', 'mission', { chronicle: false });
  }
  if (type === 'wonder') {
    const first = !G.wonder;
    G.wonder = G.wonder || { stage: 0, delivered: {}, completeDay: null };
    G.wonder.placed = true;
    notify('🕍 The Hall of Ages rises — deliver its bill of works', 'mission', first ? {} : { chronicle: false });
  }
  return true;
}

export function demolishBuilding(b, byEnemy = false) {
  // Orphaned soldiers re-home on their next wander re-roll (armyAnchor
  // falls back through homeBuilding -> null gracefully); garrisoned
  // soldiers are ejected beside the rubble.
  for (const s of G.soldiers || []) {
    if (s.homeBuilding === b) s.homeBuilding = null;
    if (s.garrison === b) {
      s.garrison = null;
      const spot = nearestWalkableTile(b.x, b.y, 3);
      if (spot) { s.x = spot.x; s.y = spot.y; s.tx = spot.x; s.ty = spot.y; }
    }
  }
  // Wonder rubble keeps its ledger: stage/delivered persist on G.wonder,
  // so re-placing costs only the site down-payment (wonder.js).
  if (b.type === 'wonder' && G.wonder) {
    G.wonder.placed = false;
    if (byEnemy) chronicle('The Hall of Ages is thrown down. Its foundations remember what was owed.', 'raid');
  }
  const def = BUILDINGS[b.type];
  G.buildings = G.buildings.filter(x => x !== b);
  G.buildingGrid[b.y][b.x] = null;
  G.obstacleEpoch = (G.obstacleEpoch || 0) + 1;
  if (def.pop) G.maxPop = Math.max(0, G.maxPop - houseCap(b));
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
  G.obstacleEpoch = (G.obstacleEpoch || 0) + 1;
  if (def.pop) { G.maxPop -= houseCap(b); if (G.maxPop < 0) { console.warn('[housing] maxPop drifted below zero'); G.maxPop = 0; } }
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
    const spawnTile = nearestWalkableTile(Math.round(cx), Math.round(cy), 6) || { x: cx, y: cy };
    G.citizens.push(makeCitizen(spawnTile.x, spawnTile.y));
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
        const muster = nearestWalkableTile(b.x, b.y, 3) || { x: b.x, y: b.y };
        G.soldiers.push({
          x: muster.x, y: muster.y,
          tx: muster.x, ty: muster.y,
          homeBuilding: b,
          name: randomName(),
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
        const muster = nearestWalkableTile(b.x, b.y, 3) || { x: b.x, y: b.y };
        G.soldiers.push({
          x: muster.x, y: muster.y,
          tx: muster.x, ty: muster.y,
          homeBuilding: b,
          name: randomName(),
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
    if (!def.prod && !def.convert) continue;
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
      for (const [k,v] of Object.entries(def.prod || {})) {
        let mult = getProductionMultiplier(k) * levelMult;
        if (k === 'food' || k === 'wheat') mult *= season.foodMult; // wheat is the crop
        adjustedProd[k] = Math.round(v * mult);
      }
      // Production-chain converters (windmill, bakery): draw the input good
      // from the realm stores and emit the output. A converter with no input
      // this cycle produces nothing — build the upstream chain.
      if (def.convert) {
        // Guilds (Era III tech): chartered converters draw half again more input.
        const guildMult = G.researchedTechs.has('guilds') ? 1.5 : 1;
        const room = def.convert.cap ? Math.max(0, def.convert.cap - Math.floor(G.resources[def.convert.to] || 0)) : Infinity;
        const take = Math.min(Math.round(def.convert.amount * guildMult), Math.floor(G.resources[def.convert.from] || 0), room);
        if (take > 0) {
          G.resources[def.convert.from] -= take;
          adjustedProd[def.convert.to] = (adjustedProd[def.convert.to] || 0) + take * (def.convert.yield || 1);
        }
      }
      // Tools from the blacksmith speed real production: every 4th cycle a
      // producing building consumes one tool for a half-again output boost.
      if (def.prod && Object.keys(def.prod).length && !def.convert) {
        b.toolCycle = (b.toolCycle || 0) + 1;
        if (b.toolCycle % 4 === 0 && (G.resources.tools || 0) > 0) {
          G.resources.tools -= 1;
          for (const k of Object.keys(adjustedProd)) adjustedProd[k] = Math.round(adjustedProd[k] * 1.5);
        }
      }
      if (!Object.values(adjustedProd).some(v => v > 0)) continue;
      // If a worker is available to carry, set produced flag
      const carrier = b.workers.find(w => w.state === 'working');
      if (carrier) {
        // Merge instead of overwrite: a frozen or slow carrier no longer
        // wipes the previous unpicked batch every production cycle.
        if (b.produced) {
          for (const [pk, pv] of Object.entries(adjustedProd)) b.produced[pk] = (b.produced[pk] || 0) + pv;
        } else {
          b.produced = { ...adjustedProd };
        }
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

    // ── Housing evolution (Caesar-style tier ladder) ─────────────────
    // Signed streak with asymmetric hysteresis: +2 checks to evolve,
    // -3 to devolve (with a warning at -2). Runtime-only; reset-on-load
    // doubles as post-load grace alongside G._tierGraceUntil.
    for (const b of houses) {
      if (b.type !== 'house') continue;
      if ((b.construction || 0) > 0 && !b.active) continue;
      const report = getHouseTierReport(b);
      const graceActive = G._tierGraceUntil && G.gameTick < G._tierGraceUntil;
      if (report.next && report.nextReport.pass) {
        b.tierStreak = Math.max(1, (b.tierStreak || 0) + 1);
        if (b.tierStreak >= 2) {
          if (report.costOk) {
            for (const [k, v] of Object.entries(report.next.evolveCost || {})) G.resources[k] -= v;
            const capDelta = report.next.cap - report.tier.cap;
            b.level = (b.level || 1) + 1;
            G.maxPop += capDelta;
            b.upgradeTick = G.gameTick;
            b.tierStreak = 0;
            if (G.stats) G.stats.housesEvolved = (G.stats.housesEvolved || 0) + 1;
            trySpawnSettlers(1);
            G._refreshPanelFor = b;
            if (b.level === 4 && !(G.storyFlags && G.storyFlags.first_manor)) {
              G.storyFlags = G.storyFlags || {};
              G.storyFlags.first_manor = true;
              try { chronicle('The first manor rises — a family of standing now calls this realm home.', 'milestone'); } catch (_e) {}
            }
            G.particles.push({ tx: b.x, ty: b.y, offsetY: -14, text: `⬆ ${report.next.name}`, alpha: 1.5, vy: -0.2, decay: 0.012, type: 'text' });
            notify(`A ${report.tier.name.toLowerCase()} grew into a ${report.next.name.toLowerCase()}!`, 'success');
          }
          // Unaffordable evolve cost: hold the streak at threshold so saved-up
          // planks/tools trigger the upgrade on the next check.
        }
      } else if ((b.level || 1) > 1 && !report.current.pass && !graceActive) {
        b.tierStreak = Math.min(-1, (b.tierStreak || 0) - 1);
        if (b.tierStreak === -2) {
          G.particles.push({ tx: b.x, ty: b.y, offsetY: -14, text: '❗', alpha: 1.4, vy: -0.15, decay: 0.012, type: 'text' });
        } else if (b.tierStreak <= -3) {
          const fromTier = HOUSE_TIERS[(b.level || 1) - 1];
          b.level -= 1;
          const toTier = HOUSE_TIERS[(b.level || 1) - 1];
          G.maxPop = Math.max(0, G.maxPop - (fromTier.cap - toTier.cap));
          b.tierStreak = 0;
          const now = Date.now();
          if (!G._lastDevolveNotice || now - G._lastDevolveNotice > 8000) {
            G._lastDevolveNotice = now;
            notify(`A ${fromTier.name.toLowerCase()} declined into a ${toTier.name.toLowerCase()} — services lapsed.`, 'warn');
          }
        }
      } else {
        b.tierStreak = 0;
      }
    }
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
    let unfed = foodNeeded;
    const eatBread = Math.min(G.resources.food, unfed);
    G.resources.food -= eatBread; unfed -= eatBread;
    // No bread left: the realm eats raw wheat, then flour porridge, 1:1.
    if (unfed > 0 && (G.resources.wheat || 0) > 0) {
      const w = Math.min(G.resources.wheat, unfed);
      G.resources.wheat -= w; unfed -= w;
    }
    if (unfed > 0 && (G.resources.flour || 0) > 0) {
      const f = Math.min(G.resources.flour, unfed);
      G.resources.flour -= f; unfed -= f;
    }
    if (unfed > 0 && G.population > 1) {
      G.happiness = Math.max(0, G.happiness - 10);
      if (G.happiness < 20 && G.citizens.length > 1) {
        // Pick the hungriest citizen to die from starvation
        const sorted = [...G.citizens].sort((a, b) => b.hunger - a.hunger);
        const c = sorted[0];
        if (c.hunger >= 90) {
          if (c.carrying && c.carryAmount > 0) G.resources[c.carrying] = (G.resources[c.carrying] || 0) + c.carryAmount;
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
    const stanceLabel = G.armyStance === 'rally' ? '🚩 Rally' : G.armyStance === 'patrol' ? '🧱 Patrol' : '🛡️ Defend';
    notify(`⚠️ Raiders approach from the darkness! Army stance: ${stanceLabel} (g to change).`, 'danger', { chronicle: false });
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
    // Phase D: later ages draw stronger raids — the wonder race has stakes.
    const eraMult = 1 + 0.25 * ((G.era || 1) - 1);
    const raiders = Math.max(1, Math.floor(baseCount * getDifficulty().raidMult * rivalMult * eraMult));
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

    G._raidSpawnCount = raiders; // morale-break baseline (combat.js)
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
      // Caravans respect building footprints (terrain stays unrestricted so
      // existing edge routes keep working); if boxed in, skirt sideways.
      const caravanOpen = (x, y) => { const bb = G.buildingGrid[y]?.[x]; return !bb || bb.type === 'road'; };
      const moved = stepEntityToward(c, c.tx, c.ty, c.speed * G.speed, caravanOpen);
      if (!moved) { c.tx += rngRange(-3, 3); c.ty += rngRange(-3, 3); }
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

// Prestige — display-only realm score (Phase D). A weighted census of what
// the four pillars produce; wonder stages dominate late. No currency, no
// spend — it exists to be compared across runs ('realm-prestige-best').
export function computePrestige() {
  let p = 0;
  for (const b of G.buildings) {
    if (b.type === 'house') p += [0, 0, 1, 3, 6][Math.min(4, b.level || 1)];
    else if (b.type === 'townhall') p += 10;
    else if (b.type === 'church') p += 4;
    else if (b.type === 'school' || b.type === 'tavern' || b.type === 'market') p += 2;
  }
  p += Math.min(20, Math.floor((G.resources.gold || 0) / 25));
  p += Math.min(15, (G.soldiers || []).length);
  p += (G.researchedTechs?.size || 0) * 10;
  p += (G.stats?.raidsSurvived || 0) * 15;
  p += (G.wonder?.stage || 0) * 100;
  return p;
}

export function prestigeBest() {
  try { return parseInt(localStorage.getItem('realm-prestige-best') || '0', 10) || 0; } catch (_e) { return 0; }
}

export function showVictoryScreen() {
  const el = document.getElementById('victory-screen');
  if (!el) return;
  el.style.display = 'flex';
  // Wonder win vs legacy castle win (pre-D4 saves can load with G.won set).
  // Stage 3 is the Gilded Spire — WONDER_STAGES lives in wonder.js, which
  // imports this module, so the stage count is a literal here.
  const wonderWin = !!(G.wonder && G.wonder.stage >= 3);
  const title = el.querySelector('.vic-title');
  const sub = el.querySelector('.vic-subtitle');
  if (title && sub) {
    if (wonderWin) {
      title.textContent = 'The Hall of Ages Stands Eternal';
      sub.textContent = `Raised across the Three Ages and crowned on day ${G.wonder.completeDay || G.day}. The realm is remembered forever.`;
    } else {
      title.textContent = 'Victory!';
      sub.textContent = 'Your castle stands tall. The realm is yours.';
    }
  }
  const prestige = computePrestige();
  const prestigeEl = el.querySelector('.vic-prestige');
  if (prestigeEl) {
    let best = prestigeBest();
    const isBest = prestige >= best;
    if (isBest) { best = prestige; try { localStorage.setItem('realm-prestige-best', String(best)); } catch (_e) {} }
    prestigeEl.textContent = isBest ? `${prestige} ★ new best` : `${prestige} (best ${best})`;
  }
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
  G.obstacleEpoch = (G.obstacleEpoch || 0) + 1;
      if (b.workers) for (const w of b.workers) { w.jobBuilding = null; w.state = 'idle'; w.path = null; }
      G.stats.buildingsLost = (G.stats.buildingsLost || 0) + 1;
    }
  }
}

// Housing tier capacity: houses grow with their tier; everything else uses
// its static def.pop. The single source for every maxPop mutation site.
export function houseCap(b) {
  if (b.type === 'house') return HOUSE_TIERS[Math.min(HOUSE_TIERS.length, b.level || 1) - 1].cap;
  return BUILDINGS[b.type]?.pop || 0;
}

// Single-source tier requirement predicates, used by BOTH the evolution
// simulation and the info-panel checklist so they can never disagree.
export function getHouseTierReport(b) {
  const VISIT_WINDOW = Math.floor(G.dayLength * 1.25);
  const visited = (s) => b.visits?.[s] !== undefined && G.gameTick - b.visits[s] <= VISIT_WINDOW;
  const tierIdx = Math.min(HOUSE_TIERS.length, b.level || 1) - 1;
  const evalReqs = (reqs) => {
    const out = { pass: true, checks: [] };
    for (const s of (reqs.services || [])) {
      const ok = visited(s);
      out.checks.push({ label: `${BUILDINGS[s]?.name || s} access`, ok });
      if (!ok) out.pass = false;
    }
    if (reqs.anyOf) {
      const ok = reqs.anyOf.some(visited);
      out.checks.push({ label: reqs.anyOf.map(s => BUILDINGS[s]?.name || s).join(' or '), ok });
      if (!ok) out.pass = false;
    }
    if (reqs.food) {
      const ok = (G.resources.food + (G.resources.wheat || 0) + (G.resources.flour || 0)) > 0;
      out.checks.push({ label: 'Food in store', ok });
      if (!ok) out.pass = false;
    }
    if (reqs.foodVariety) {
      const kinds = ['farm', 'fisherman', 'chickencoop', 'cowpen', 'bakery']
        .filter(t => G.buildings.some(bb => bb.type === t && bb.active && (bb.workers?.length || 0) >= (BUILDINGS[t].workers || 0)));
      const ok = kinds.length >= reqs.foodVariety;
      out.checks.push({ label: `${reqs.foodVariety} food sources (${kinds.length})`, ok });
      if (!ok) out.pass = false;
    }
    return out;
  };
  const current = evalReqs(HOUSE_TIERS[tierIdx].reqs);
  const next = tierIdx + 1 < HOUSE_TIERS.length ? HOUSE_TIERS[tierIdx + 1] : null;
  const nextReport = next ? evalReqs(next.reqs) : null;
  let costOk = true;
  if (next?.evolveCost) {
    for (const [k, v] of Object.entries(next.evolveCost)) {
      if ((G.resources[k] || 0) < v) { costOk = false; break; }
    }
  }
  return { tierIdx, tier: HOUSE_TIERS[tierIdx], next, current, nextReport, costOk };
}

export function collectTaxes() {
  // Capacity-weighted taxes: each house contributes its tier capacity at its
  // tier's tax multiplier; vagrants beyond total housing pay nothing.
  let housedCap = 0, weighted = 0;
  for (const b of G.buildings) {
    if (b.type !== 'house') continue;
    const t = HOUSE_TIERS[Math.min(HOUSE_TIERS.length, b.level || 1) - 1];
    housedCap += t.cap;
    weighted += t.cap * t.taxMult;
  }
  const occupancy = housedCap > 0 ? Math.min(1, G.population / housedCap) : 0;
  const effectivePop = weighted * occupancy;
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
