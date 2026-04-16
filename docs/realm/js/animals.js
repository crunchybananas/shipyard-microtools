// ════════════════════════════════════════════════════════════
// Animals — wandering wildlife that inhabit the world
// ════════════════════════════════════════════════════════════

import { G, TILE, MAP_W, MAP_H } from './state.js';

const SPECIES = {
  deer:    { color: '#8a6a40', speed: 0.02,  size: 4,   prefersForest: true, herdSize: 3 },
  sheep:   { color: '#e8e4d8', speed: 0.015, size: 3.5, prefersGrass: true,  herdSize: 4 },
  chicken: { color: '#d4d0c0', speed: 0.025, size: 2,   herdSize: 2 },
};

export function spawnAnimals() {
  if (!G.animals) G.animals = [];
  // Target population: 2 deer herds, 3 sheep herds, scattered chickens near houses
  const deerCount    = G.animals.filter(a => a.type === 'deer').length;
  const sheepCount   = G.animals.filter(a => a.type === 'sheep').length;
  const chickenCount = G.animals.filter(a => a.type === 'chicken').length;

  if (deerCount < 6 && Math.random() < 0.01) {
    // Spawn deer near forest
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (G.map[y][x] === TILE.FOREST) {
          G.animals.push({
            type: 'deer', x, y, tx: x, ty: y,
            state: 'graze', stateTimer: 100 + Math.random() * 200,
            phase: Math.random() * Math.PI * 2,
          });
          return;
        }
      }
    }
  }

  if (sheepCount < 10 && Math.random() < 0.015) {
    // Spawn sheep near grass
    const x = Math.floor(Math.random() * MAP_W);
    const y = Math.floor(Math.random() * MAP_H);
    if (G.map[y] && G.map[y][x] === TILE.GRASS) {
      G.animals.push({
        type: 'sheep', x, y, tx: x, ty: y,
        state: 'graze', stateTimer: 100 + Math.random() * 200,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  if (chickenCount < 6 && Math.random() < 0.02) {
    // Spawn chickens near houses
    const houses = G.buildings.filter(b => b.type === 'house');
    if (houses.length > 0) {
      const h = houses[Math.floor(Math.random() * houses.length)];
      const dx = Math.random() * 4 - 2, dy = Math.random() * 4 - 2;
      const x = Math.round(h.x + dx), y = Math.round(h.y + dy);
      if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && G.map[y][x] === TILE.GRASS) {
        G.animals.push({
          type: 'chicken', x, y, tx: x, ty: y,
          state: 'peck', stateTimer: 50 + Math.random() * 100,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
  }
}

export function updateAnimals() {
  if (!G.animals) G.animals = [];
  // Spawn logic runs periodically
  if (G.gameTick % 60 === 0) spawnAnimals();

  for (const a of G.animals) {
    const spec = SPECIES[a.type] || SPECIES.deer;

    // State machine
    a.stateTimer -= G.speed;
    if (a.stateTimer <= 0) {
      // Pick new target
      if (Math.random() < 0.3) {
        // Wander to nearby tile
        a.tx = a.x + (Math.random() - 0.5) * 6;
        a.ty = a.y + (Math.random() - 0.5) * 6;
        // Clamp to map bounds
        a.tx = Math.max(1, Math.min(MAP_W - 2, a.tx));
        a.ty = Math.max(1, Math.min(MAP_H - 2, a.ty));
        a.state = 'walk';
        a.stateTimer = 30 + Math.random() * 60;
      } else {
        a.state = 'graze';
        a.stateTimer = 80 + Math.random() * 120;
      }
    }

    // Move toward target when walking
    if (a.state === 'walk') {
      const dx = a.tx - a.x, dy = a.ty - a.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.1) {
        const spd = spec.speed * G.speed;
        a.x += (dx / d) * Math.min(spd, d);
        a.y += (dy / d) * Math.min(spd, d);
      }
      // Clamp position so animals never render in the void outside the map
      a.x = Math.max(1, Math.min(MAP_W - 2, a.x));
      a.y = Math.max(1, Math.min(MAP_H - 2, a.y));
    }
  }
}
