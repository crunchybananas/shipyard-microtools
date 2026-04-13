// ══════════���══════════════════��══════════════════════════════
// Citizen AI — state machine with A* pathfinding
// ══════════════���═══════════════════════════���═════════════════

import { G, BUILDINGS, MAP_W, MAP_H, rng, rngInt, rngRange, getSeasonData } from './state.js';
import { findPath } from './pathfinding.js';

function dist2(ax, ay, bx, by) {
  return Math.abs(ax-bx) + Math.abs(ay-by);
}

function pathTo(c, tx, ty) {
  c.path = findPath(Math.round(c.x), Math.round(c.y), tx, ty);
  c.pathIdx = 0;
  if (!c.path) {
    c.tx = tx + rngRange(-0.3, 0.3);
    c.ty = ty + rngRange(-0.3, 0.3);
  }
}

export function updateCitizens() {
  for (const c of G.citizens) {
    // Follow path if we have one
    if (c.path && c.pathIdx < c.path.length) {
      const wp = c.path[c.pathIdx];
      const dx = wp.x - c.x, dy = wp.y - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < 0.15) {
        c.pathIdx++;
      } else {
        let spd = c.speed * G.speed * getSeasonData().speedMult;
        // Road speed bonus
        const gx = Math.round(c.x), gy = Math.round(c.y);
        if (gx >= 0 && gx < MAP_W && gy >= 0 && gy < MAP_H) {
          const b = G.buildingGrid[gy]?.[gx];
          if (b && b.type === 'road') spd *= 2;
        }
        c.x += (dx/d) * Math.min(spd, d);
        c.y += (dy/d) * Math.min(spd, d);
      }
      continue; // still moving — next citizen
    }

    // No path or path complete — fallback straight-line for non-pathfound movement
    if (!c.path) {
      const dx = c.tx - c.x, dy = c.ty - c.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 0.1) {
        const spd = c.speed * G.speed;
        c.x += (dx/d) * Math.min(spd, d);
        c.y += (dy/d) * Math.min(spd, d);
        continue;
      }
    }

    // Arrived or no movement needed — run state machine
    c.stateTimer -= G.speed;
    if (c.stateTimer > 0) continue;
    runStateMachine(c);
  }
}

function runStateMachine(c) {
  switch (c.state) {
    case 'idle':
    case 'find_job':
      // Hungry? Eat first.
      if (c.hunger > 70 && G.resources.food > 0) {
        G.resources.food--;
        c.hunger = Math.max(0, c.hunger - 50);
        c.state = 'eating';
        c.stateTimer = 30;
        c.path = null;
        return;
      }

      // Find nearest building that needs workers
      if (!c.jobBuilding || !G.buildings.includes(c.jobBuilding)) {
        c.jobBuilding = null;
        let bestDist = Infinity, bestB = null;
        for (const b of G.buildings) {
          const def = BUILDINGS[b.type];
          if (!def.prod && !def.workers) continue;
          const needed = def.workers || 0;
          if (b.workers.length >= needed) continue;
          if (b.workers.includes(c)) continue;
          const d = dist2(c.x, c.y, b.x, b.y);
          if (d < bestDist) { bestDist = d; bestB = b; }
        }
        if (bestB) {
          c.jobBuilding = bestB;
          bestB.workers.push(c);
        }
      }

      if (c.jobBuilding) {
        c.state = 'walk_to_work';
        pathTo(c, c.jobBuilding.x, c.jobBuilding.y);
      } else {
        // No building job — forage from nearby resource tiles
        const gx = Math.round(c.x), gy = Math.round(c.y);
        let forageTarget = null;
        let forageDist = Infinity;
        const searchR = 6;
        for (let dy = -searchR; dy <= searchR; dy++) {
          for (let dx = -searchR; dx <= searchR; dx++) {
            const nx = gx+dx, ny = gy+dy;
            if (nx<0||nx>=MAP_W||ny<0||ny>=MAP_H) continue;
            if (!G.fog[ny][nx]) continue;
            const tile = G.map[ny][nx];
            // Forage from forest, stone, or sand (berries)
            if (tile === 3 || tile === 4 || tile === 1) {
              const d = Math.abs(dx)+Math.abs(dy);
              if (d < forageDist && !G.buildingGrid[ny]?.[nx]) {
                forageDist = d;
                forageTarget = { x: nx, y: ny, tile };
              }
            }
          }
        }

        if (forageTarget && rng() < 0.6) {
          c.state = 'foraging';
          c.forageTarget = forageTarget;
          pathTo(c, forageTarget.x, forageTarget.y);
        } else {
          // Truly idle — wander near center
          const cx = MAP_W/2, cy = MAP_H/2;
          pathTo(c, Math.round(cx + rngRange(-4, 4)), Math.round(cy + rngRange(-4, 4)));
          c.state = 'idle';
          c.stateTimer = 60 + rngInt(0, 60);
        }
      }
      break;

    case 'walk_to_work':
      // Arrived at workplace
      c.state = 'working';
      c.stateTimer = 60 + rngInt(0, 30);
      c.path = null;
      break;

    case 'working':
      // Done working — check if building produced something
      if (c.jobBuilding) {
        const def = BUILDINGS[c.jobBuilding.type];
        if (def.prod && c.jobBuilding.produced) {
          // Pick up the goods
          const [resKey, amount] = Object.entries(c.jobBuilding.produced)[0] || [];
          if (resKey) {
            c.carrying = resKey;
            c.carryAmount = amount;
            c.jobBuilding.produced = null;
            c.state = 'walk_to_deliver';
            // Deliver to town center
            pathTo(c, Math.round(MAP_W/2), Math.round(MAP_H/2));
            return;
          }
        }
      }
      // Nothing to carry — cycle back to working
      c.state = 'find_job';
      c.stateTimer = 10;
      c.path = null;
      break;

    case 'walk_to_deliver':
      // Arrived at delivery point
      c.state = 'deliver';
      c.stateTimer = 0;
      c.path = null;
      break;

    case 'deliver':
      if (c.carrying && c.carryAmount > 0) {
        G.resources[c.carrying] = (G.resources[c.carrying] || 0) + c.carryAmount;
        // Resource number float
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: 0,
          text: `+${c.carryAmount} ${resEmoji(c.carrying)}`,
          alpha: 1.5, vy: -0.3, type: 'text',
        });
        // Speech bubble
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -28,
          text: 'Delivered!',
          alpha: 1.2, vy: -0.12, decay: 0.018, type: 'speech',
        });
      }
      c.carrying = null;
      c.carryAmount = 0;
      c.state = 'find_job';
      c.stateTimer = 5;
      break;

    case 'foraging':
      // Arrived at forage tile — gather a small amount
      if (c.forageTarget) {
        const t = c.forageTarget.tile;
        const res = t === 3 ? 'wood' : t === 4 ? 'stone' : 'food';
        const amount = 1;
        G.resources[res] = (G.resources[res] || 0) + amount;
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: 0,
          text: `+${amount} ${resEmoji(res)}`,
          alpha: 1.2, vy: -0.3, type: 'text',
        });
        G.particles.push({
          tx: c.x, ty: c.y, offsetY: -25,
          text: 'Found!',
          alpha: 0.9, vy: -0.1, decay: 0.02, type: 'speech',
        });
        c.carrying = res;
        c.carryAmount = 0;
      }
      c.forageTarget = null;
      c.state = 'find_job';
      c.stateTimer = 0; // immediately look for building jobs
      c.path = null;
      break;

    case 'eating':
      c.state = 'find_job';
      c.stateTimer = 5;
      c.path = null;
      break;

    default:
      c.state = 'idle';
      c.stateTimer = 10;
      c.path = null;
  }
}

function resEmoji(k) {
  return {wood:'🪵',stone:'🪨',food:'🍎',gold:'🪙',iron:'⚙️'}[k] || k;
}
