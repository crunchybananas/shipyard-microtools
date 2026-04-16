import { G, BUILDINGS, MAP_W, MAP_H, rngRange } from './state.js';

export function updateWalkers() {
  // Spawn walkers from service buildings periodically
  if (G.gameTick % 200 === 0) {
    for (const b of G.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) continue; // guard against unknown building types
      if (!def.radius || !def.happiness) continue;
      // Don't spawn if we already have a walker from this building
      if (G.walkers.some(w => w.home === b)) continue;
      const walkerTypes = {
        church: { emoji: '⛪', color: '#f0f0f0' },
        tavern: { emoji: '🍺', color: '#c07040' },
        well: { emoji: '💧', color: '#60a5fa' },
        market: { emoji: '🛒', color: '#ffd166' },
      };
      const wt = walkerTypes[b.type];
      if (!wt) continue;
      G.walkers.push({
        x: b.x, y: b.y,
        home: b,
        color: wt.color,
        emoji: wt.emoji,
        life: 400, // ticks before returning home
        visitedHouses: new Set(),
        tx: b.x + rngRange(-4, 4), ty: b.y + rngRange(-4, 4),
      });
    }
  }
  // Update walker movement
  for (let i = G.walkers.length - 1; i >= 0; i--) {
    const w = G.walkers[i];
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d > 0.15) {
      const spd = 0.03 * G.speed;
      w.x += (dx/d) * Math.min(spd, d);
      w.y += (dy/d) * Math.min(spd, d);
    } else {
      // Pick new random patrol target near home
      w.tx = w.home.x + rngRange(-5, 5);
      w.ty = w.home.y + rngRange(-5, 5);
    }
    // Check nearby houses and mark visited
    for (const b of G.buildings) {
      if (b.type !== 'house') continue;
      const hd = Math.abs(b.x - w.x) + Math.abs(b.y - w.y);
      if (hd < 2 && !w.visitedHouses.has(b)) {
        w.visitedHouses.add(b);
        b.visits = b.visits || {};
        b.visits[w.home.type] = G.gameTick;
      }
    }
    // Expire walker
    w.life -= G.speed;
    if (w.life <= 0) G.walkers.splice(i, 1);
  }
}
