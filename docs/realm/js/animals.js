// ════════════════════════════════════════════════════════════
// Animals — authored wildlife and building-grounded livestock
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js?realm=177';
import { stepEntityToward } from './pathfinding.js?realm=177';
import { resolveGroundTraffic } from './ground-traffic.js?realm=177';

const SPECIES = {
  deer: {
    speed: 0.02,
    restState: 'graze',
    habitat: new Set([TILE.FOREST]),
    wanderRadius: 6,
    maxWild: 5,
  },
  cow: {
    speed: 0.012,
    restState: 'graze',
    habitat: new Set([TILE.GRASS]),
    wanderRadius: 4,
    homeType: 'cowpen',
    perHome: 2,
  },
  chicken: {
    speed: 0.024,
    restState: 'peck',
    habitat: new Set([TILE.GRASS]),
    wanderRadius: 3,
    homeType: 'chickencoop',
    perHome: 3,
  },
};

function isCompleteBuilding(b, type) {
  return b?.type === type && b.buildProgress >= 1;
}

function animalTileOpen(type, x, y) {
  const spec = SPECIES[type];
  if (!spec || x < 1 || x >= MAP_W - 1 || y < 1 || y >= MAP_H - 1) return false;
  if (!spec.habitat.has(G.map[y]?.[x])) return false;
  const building = G.buildingGrid[y]?.[x];
  return !building || building.type === 'road';
}

function animalNear(x, y, radius = 0.7) {
  const r2 = radius * radius;
  return (G.animals || []).some((a) => {
    const dx = a.x - x, dy = a.y - y;
    return dx * dx + dy * dy < r2;
  });
}

function chooseLocalHabitat(type, cx, cy, radius) {
  const candidates = [];
  const x0 = Math.max(1, Math.floor(cx - radius));
  const x1 = Math.min(MAP_W - 2, Math.ceil(cx + radius));
  const y0 = Math.max(1, Math.floor(cy - radius));
  const y1 = Math.min(MAP_H - 2, Math.ceil(cy + radius));
  const r2 = radius * radius;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r2 || !animalTileOpen(type, x, y) || animalNear(x, y)) continue;
      candidates.push({ x, y });
    }
  }
  return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
}

function chooseWildHabitat(type) {
  // Sample the full island before the deterministic scan fallback. The old
  // top-left scan made every deer materialize in the same first forest.
  for (let i = 0; i < 96; i++) {
    const x = 1 + Math.floor(Math.random() * (MAP_W - 2));
    const y = 1 + Math.floor(Math.random() * (MAP_H - 2));
    if (animalTileOpen(type, x, y) && !animalNear(x, y, 1.5)) return { x, y };
  }
  const total = MAP_W * MAP_H;
  const start = Math.floor(Math.random() * total);
  for (let i = 0; i < total; i++) {
    const idx = (start + i) % total;
    const x = idx % MAP_W, y = Math.floor(idx / MAP_W);
    if (animalTileOpen(type, x, y) && !animalNear(x, y, 1.5)) return { x, y };
  }
  return null;
}

function makeAnimal(type, tile, home = null) {
  const spec = SPECIES[type];
  return {
    type,
    x: tile.x,
    y: tile.y,
    tx: tile.x,
    ty: tile.y,
    home,
    anchorX: home?.x ?? tile.x,
    anchorY: home?.y ?? tile.y,
    state: spec.restState,
    stateTimer: 90 + Math.random() * 150,
    phase: Math.random() * Math.PI * 2,
    facing: 1,
  };
}

function readyHomes(type) {
  const homeType = SPECIES[type]?.homeType;
  if (!homeType) return [];
  return (G.buildings || []).filter((b) => isCompleteBuilding(b, homeType));
}

function reconcileDomesticSpecies(type) {
  const spec = SPECIES[type];
  const homes = readyHomes(type);
  const homeSet = new Set(homes);

  // Livestock is a visible consequence of a completed building. Demolishing
  // the pen/coop removes its animals rather than leaving context-free props.
  G.animals = G.animals.filter((a) => a.type !== type || homeSet.has(a.home));

  for (const home of homes) {
    let count = G.animals.filter((a) => a.type === type && a.home === home).length;
    while (count < spec.perHome) {
      const tile = chooseLocalHabitat(type, home.x, home.y, spec.wanderRadius + 1);
      if (!tile) break;
      G.animals.push(makeAnimal(type, tile, home));
      count++;
    }
  }
}

export function spawnAnimals() {
  if (!G.animals) G.animals = [];

  reconcileDomesticSpecies('cow');
  reconcileDomesticSpecies('chicken');

  // Wildlife enters gradually so starting a realm never produces a sudden
  // herd pop. Deer remain independent of settlement infrastructure.
  const deerCount = G.animals.filter((a) => a.type === 'deer').length;
  if (deerCount < SPECIES.deer.maxWild) {
    const tile = chooseWildHabitat('deer');
    if (tile) G.animals.push(makeAnimal('deer', tile));
  }
}

function settleAnimal(a, spec) {
  a.x = a.tx;
  a.y = a.ty;
  a.state = spec.restState;
  a.stateTimer = 75 + Math.random() * 150;
  a._walkTimeout = 0;
  a._stuckTicks = 0;
}

function chooseWanderTarget(a, spec) {
  const cx = a.home?.x ?? a.anchorX ?? a.x;
  const cy = a.home?.y ?? a.anchorY ?? a.y;
  const target = chooseLocalHabitat(a.type, cx, cy, spec.wanderRadius);
  if (!target || Math.hypot(target.x - a.x, target.y - a.y) < 0.2) {
    a.state = spec.restState;
    a.stateTimer = 45 + Math.random() * 90;
    return;
  }
  a.tx = target.x;
  a.ty = target.y;
  a.state = 'walk';
  a._walkTimeout = Math.max(180, Math.ceil(Math.hypot(a.tx - a.x, a.ty - a.y) / spec.speed) * 2);
}

export function updateAnimals() {
  if (!G.animals) G.animals = [];
  // Building reconciliation is cheap and deliberately periodic. It makes a
  // completed pen populate promptly without coupling animals to economy.js.
  if (G.gameTick % 120 === 0) spawnAnimals();

  for (const a of G.animals) {
    const spec = SPECIES[a.type];

    if (a.state !== 'walk') {
      a.stateTimer = (a.stateTimer || 0) - 1;
      if (a.stateTimer <= 0) {
        if (Math.random() < 0.62) chooseWanderTarget(a, spec);
        else a.stateTimer = 60 + Math.random() * 120;
      }
      continue;
    }

    const dx = a.tx - a.x, dy = a.ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d <= Math.max(0.015, spec.speed * 1.1)) {
      settleAnimal(a, spec);
      continue;
    }

    // The source is a three-quarter side pose, so mirror from horizontal
    // screen travel (iso X = world X - world Y), not world-X alone.
    const screenDx = dx - dy;
    if (Math.abs(screenDx) > 0.002) a.facing = screenDx < 0 ? -1 : 1;
    const moved = stepEntityToward(a, a.tx, a.ty, spec.speed);
    a._walkTimeout = (a._walkTimeout || 1) - 1;
    if (moved) {
      a._stuckTicks = 0;
      a._movedAt = G.gameTick;
      if (Math.hypot(a.tx - a.x, a.ty - a.y) <= Math.max(0.015, spec.speed * 1.1)) {
        settleAnimal(a, spec);
      }
    } else {
      a._stuckTicks = (a._stuckTicks || 0) + 1;
    }
    if (!moved && (a._stuckTicks >= 18 || a._walkTimeout <= 0)) {
      a.tx = a.x;
      a.ty = a.y;
      a.state = spec.restState;
      a.stateTimer = 45 + Math.random() * 90;
      a._stuckTicks = 0;
    }

    a.x = Math.max(1, Math.min(MAP_W - 2, a.x));
    a.y = Math.max(1, Math.min(MAP_H - 2, a.y));
  }
  resolveGroundTraffic({
    movers: G.animals,
    blockers: [...G.citizens, ...G.soldiers, ...G.walkers, ...G.animals],
  });
}
