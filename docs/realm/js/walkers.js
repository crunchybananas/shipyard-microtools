import { G, BUILDINGS, MAP_W, MAP_H, rngRange } from './state.js?realm=116';
import { stepEntityToward, nearestWalkableTile } from './pathfinding.js?realm=116';

export function updateWalkers() {
  // Spawn walkers from service buildings periodically
  if (G.gameTick % 200 === 0) {
    for (const b of G.buildings) {
      const def = BUILDINGS[b.type];
      if (!def) continue; // guard against unknown building types
      if (!def.radius) continue; // walkerTypes below already limits spawns to church/tavern/well/market
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
      const spawnAt = nearestWalkableTile(b.x, b.y, 3) || { x: b.x, y: b.y };
      G.walkers.push({
        x: spawnAt.x, y: spawnAt.y,
        home: b,
        color: wt.color,
        emoji: wt.emoji,
        life: 400, // ticks before returning home
        visitedHouses: new Set(),
        ...(function () { const t = nearestWalkableTile(Math.round(b.x + rngRange(-4, 4)), Math.round(b.y + rngRange(-4, 4)), 4) || { x: b.x, y: b.y }; return { tx: t.x, ty: t.y }; })(),
      });
    }
  }
  // Update walker movement
  for (let i = G.walkers.length - 1; i >= 0; i--) {
    const w = G.walkers[i];
    const dx = w.tx - w.x, dy = w.ty - w.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    const arrived = d <= 0.15;
    const moved = arrived ? false : stepEntityToward(w, w.tx, w.ty, 0.03 * G.speed);
    if (arrived || !moved) {
      // Pick a new reachable patrol target near home (blocked = repick too)
      const t = nearestWalkableTile(Math.round(w.home.x + rngRange(-5, 5)), Math.round(w.home.y + rngRange(-5, 5)), 4);
      if (t) { w.tx = t.x; w.ty = t.y; }
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
