// ════════════════════════════════════════════════════════════
// The Hall of Ages — staged Wonder delivery and the win (Phase D)
//
// The wonder is a demand sink on the whole economy: each stage's
// bill draws a different chain's goods out of the realm stores on
// a slow pulse (main.js crossed(720)), gated by housing tiers so
// the city itself must mature between stages. Stage 3 complete IS
// the victory. Stage progress lives on G.wonder (never on the
// building) so raiders can level the site without erasing the work.
// ════════════════════════════════════════════════════════════

import { G } from './state.js?realm=122';
import { chronicle } from './story.js?realm=122';
import { notify } from './notifications.js?realm=122';
import { playSound } from './audio.js?realm=122';
import { showVictoryScreen } from './economy.js?realm=122';

export const WONDER_STAGES = [
  { name: 'The Foundations',  bill: { stone: 200, wood: 100 } },
  { name: 'The Vaults',       bill: { planks: 150, stone: 100, gold: 80 }, homesteads: 3 },
  { name: 'The Gilded Spire', bill: { tools: 40, gold: 150, food: 120 }, manors: 2 },
];

// Deliveries never draw the stores below these floors — the town keeps
// living (house evolveCosts, winter food) while the Wonder feeds.
const RESERVE = { wood: 20, stone: 10, planks: 10, tools: 5, gold: 25, food: 40 };

const STAGE_BEATS = [
  'The Foundations are laid true. Stone remembers the weight it was promised.',
  'The Vaults close over their own echo. Gold and grain alike now sleep beneath the Hall.',
];

function houseCount(minTier) {
  let n = 0;
  for (const b of G.buildings) if (b.type === 'house' && (b.level || 1) >= minTier) n++;
  return n;
}

// Structured status for the info panel / HUD (D5) and probes.
export function getWonderReport() {
  const w = G.wonder;
  if (!w) return null;
  const stage = WONDER_STAGES[w.stage] || null;
  const delivered = w.delivered || {};
  return {
    placed: !!w.placed,
    stage: w.stage,
    stageName: stage ? stage.name : 'Complete',
    complete: w.stage >= WONDER_STAGES.length,
    bill: stage
      ? Object.entries(stage.bill).map(([res, need]) => ({ res, have: Math.min(delivered[res] || 0, need), need }))
      : [],
    gate: !stage ? null
      : stage.homesteads && houseCount(3) < stage.homesteads ? `Needs ${stage.homesteads} Homesteads (${houseCount(3)})`
      : stage.manors && houseCount(4) < stage.manors ? `Needs ${stage.manors} Manors (${houseCount(4)})`
      : null,
  };
}

export function updateWonder() {
  const w = G.wonder;
  if (!w || !w.placed || G.realmEnded || w.stage >= WONDER_STAGES.length) return;
  const site = G.buildings.find(b => b.type === 'wonder');
  if (!site || (site.buildProgress !== undefined && site.buildProgress < 1)) return;

  const stage = WONDER_STAGES[w.stage];
  if (stage.homesteads && houseCount(3) < stage.homesteads) return;
  if (stage.manors && houseCount(4) < stage.manors) return;

  const staffed = Math.min(site.workers.length, 4);
  if (!staffed) return;

  const manors = houseCount(4), homesteads = houseCount(3);
  const guilds = G.researchedTechs.has('guilds') ? 1.25 : 1;
  let budget = Math.round(8 * (staffed / 4) * (1 + 0.25 * Math.min(4, manors) + 0.1 * Math.min(6, homesteads)) * guilds);

  w.delivered = w.delivered || {};
  let moved = 0;
  for (const [res, need] of Object.entries(stage.bill)) {
    if (budget <= 0) break;
    const remaining = need - (w.delivered[res] || 0);
    if (remaining <= 0) continue;
    const spare = Math.floor((G.resources[res] || 0) - (RESERVE[res] || 0));
    const take = Math.max(0, Math.min(budget, remaining, spare));
    if (take > 0) {
      G.resources[res] -= take;
      w.delivered[res] = (w.delivered[res] || 0) + take;
      budget -= take;
      moved += take;
    }
  }
  if (moved > 0 && G.particles && G.particles.length < 280) {
    G.particles.push({ tx: site.x, ty: site.y, offsetY: -20, text: `+${moved}`, alpha: 1.2, vy: -0.15, decay: 0.012, type: 'text' });
  }

  const done = Object.entries(stage.bill).every(([res, need]) => (w.delivered[res] || 0) >= need);
  if (!done) return;

  w.stage += 1;
  w.delivered = {};
  playSound('mission');
  if (w.stage < WONDER_STAGES.length) {
    notify(`🕍 ${stage.name} complete — the ${WONDER_STAGES[w.stage].name} begins`, 'mission', { chronicle: false });
    chronicle(STAGE_BEATS[w.stage - 1] || `${stage.name} of the Hall of Ages stands complete.`, 'milestone');
  } else {
    w.completeDay = G.day;
    notify('🕍 The Hall of Ages stands eternal!', 'mission', { chronicle: false });
    chronicle('The Gilded Spire takes the light. The Hall of Ages stands eternal, and the realm with it.', 'victory');
    if (!G.won) {
      G.won = true;
      setTimeout(() => showVictoryScreen(), 700);
    }
  }
}
