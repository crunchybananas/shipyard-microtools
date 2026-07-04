import { G, BUILDINGS, MAP_W, MAP_H, rngRange, resourceEmoji, getDayPeriod } from './state.js?realm=131';
import { stepEntityToward, nearestWalkableTile } from './pathfinding.js?realm=131';
import { getWonderReport } from './wonder.js?realm=131';

export function updateWalkers() {
  // Spawn walkers from service buildings periodically — but not at night
  // (Phase 3a): the streets empty out while the town sleeps; walkers
  // already in flight finish their rounds and expire naturally.
  if (G.gameTick % 200 === 0 && getDayPeriod() !== 'night') {
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
        wonder: { emoji: '🕍', color: '#ffd166' },
      };
      const wt = walkerTypes[b.type];
      if (!wt) continue;
      // Wonder hauler: purely cosmetic goods run between the nearest store
      // and the site while a stage is actively deliverable (wonder.js owns
      // the real deduction on its own pulse). No spawn while gated/complete.
      let hauler = null;
      if (b.type === 'wonder') {
        const wr = getWonderReport();
        if (!wr || !wr.placed || wr.complete || wr.gate) continue;
        if (b.buildProgress !== undefined && b.buildProgress < 1) continue;
        let best = null, bestD = Infinity;
        for (const s of G.buildings) {
          if (s.type !== 'storehouse' && s.type !== 'granary' && s.type !== 'market') continue;
          const d = Math.abs(s.x - b.x) + Math.abs(s.y - b.y);
          if (d < bestD) { best = s; bestD = d; }
        }
        const owed = wr.bill.find(i => i.have < i.need);
        hauler = { src: best || b, carry: owed ? owed.res : 'stone' };
      }
      const spawnAt = nearestWalkableTile(b.x, b.y, 3) || { x: b.x, y: b.y };
      G.walkers.push({
        x: spawnAt.x, y: spawnAt.y,
        home: b,
        color: wt.color,
        emoji: hauler ? resourceEmoji(hauler.carry) : wt.emoji,
        life: 400, // ticks before returning home
        visitedHouses: new Set(),
        ...(hauler ? { hauler: true, src: hauler.src, leg: 'to-source' } : {}),
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
    const moved = arrived ? false : stepEntityToward(w, w.tx, w.ty, 0.03);
    if (arrived || !moved) {
      if (w.hauler) {
        // Shuttle: store -> site -> store. Retire early if the wonder is
        // gone/complete; refresh the goods badge from the live bill.
        w.leg = w.leg === 'to-site' ? 'to-source' : 'to-site';
        const dest = w.leg === 'to-site' ? w.home : (w.src || w.home);
        const t = nearestWalkableTile(Math.round(dest.x), Math.round(dest.y), 3);
        if (t) { w.tx = t.x; w.ty = t.y; }
        const wr = getWonderReport();
        if (!wr || !wr.placed || wr.complete || wr.gate) { w.life = 0; }
        else {
          const owed = wr.bill.find(i => i.have < i.need);
          if (owed) w.emoji = resourceEmoji(owed.res);
        }
      } else {
        // Pick a new reachable patrol target near home (blocked = repick too)
        const t = nearestWalkableTile(Math.round(w.home.x + rngRange(-5, 5)), Math.round(w.home.y + rngRange(-5, 5)), 4);
        if (t) { w.tx = t.x; w.ty = t.y; }
      }
    }
    // Check nearby houses and mark visited
    for (const b of G.buildings) {
      if (b.type !== 'house') continue;
      const hd = Math.abs(b.x - w.x) + Math.abs(b.y - w.y);
      if (hd < 2 && !w.visitedHouses.has(b)) {
        w.visitedHouses.add(b);
        b.visits = b.visits || {};
        b.visits[w.home.type] = G.gameTick;
        // Phase 3b: the visit is REAL — residents' needs are satisfied.
        // (Pre-3b, b.visits only fed the housing-tier checklist.)
        const kind = w.home.type;
        for (const c of G.citizens) {
          if (c.home !== b) continue;
          if (!c.needs) c.needs = { joy: 55, faith: 55 };
          if (kind === 'tavern') c.needs.joy = Math.min(100, c.needs.joy + 25);
          else if (kind === 'church') c.needs.faith = Math.min(100, c.needs.faith + 30);
          else if (kind === 'market') c.needs.joy = Math.min(100, c.needs.joy + 8);
          else if (kind === 'well') c.needs.joy = Math.min(100, c.needs.joy + 5);
        }
      }
    }
    // Expire walker
    w.life -= 1;
    if (w.life <= 0) G.walkers.splice(i, 1);
  }
}
