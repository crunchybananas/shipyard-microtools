import { G, BUILDINGS } from './state.js';

const TIPS = [
  { id: 'lowfood', check: () => G.resources.food < 20, text: "Food is running low. Build more farms or fisherman huts!", cooldown: 600 },
  { id: 'nohouses', check: () => G.day > 3 && G.buildings.filter(b=>b.type==='house').length === 0, text: "Your settlers have no homes. Build a House!", cooldown: 600 },
  { id: 'noworkers', check: () => {
    const jobsNeeded = G.buildings.reduce((sum, b) => sum + (BUILDINGS[b.type]?.workers || 0) - b.workers.length, 0);
    return jobsNeeded > 3 && G.population < G.maxPop;
  }, text: "More houses needed — jobs are waiting for workers.", cooldown: 600 },
  { id: 'noirongame', check: () => G.day > 15 && !G.buildings.some(b=>b.type==='mine'), text: "Iron mines are crucial for advanced buildings. Find iron tiles!", cooldown: 1200 },
  { id: 'raid_coming', check: () => G.day >= G.nextRaidDay - 2 && G.buildings.filter(b=>b.type==='tower'||b.type==='barracks').length === 0, text: "A raid approaches — build defenses now!", cooldown: 400, danger: true },
  { id: 'stockpile_food', check: () => G.season === 'autumn' && G.resources.food < 100, text: "Winter is coming. Stock up on food before production drops.", cooldown: 800 },
  { id: 'tech_idle', check: () => G.day > 5 && G.buildings.some(b => b.type === 'library' || b.type === 'school') && !G.currentResearch && G.researchedTechs.size < 12, text: "Your scholars are idle. Visit Research to unlock new buildings.", cooldown: 1500 },
];

const lastShown = {};

export function checkAdvisor() {
  for (const tip of TIPS) {
    if ((lastShown[tip.id] || 0) + tip.cooldown > G.gameTick) continue;
    if (tip.check()) {
      lastShown[tip.id] = G.gameTick;
      showAdvisorTip(tip);
      break; // one tip at a time
    }
  }
}

function showAdvisorTip(tip) {
  // Reuse the event banner for simplicity
  const el = document.getElementById('advisor-tip');
  if (!el) {
    // Create it
    const d = document.createElement('div');
    d.id = 'advisor-tip';
    d.style.cssText = 'position:fixed;top:5rem;left:50%;transform:translateX(-50%);padding:0.5rem 1rem;background:rgba(15,15,40,0.95);border:1px solid var(--accent);border-radius:8px;color:var(--text);font-size:0.8rem;z-index:12;max-width:400px;text-align:center;opacity:0;transition:opacity 0.3s';
    document.body.appendChild(d);
  }
  const el2 = document.getElementById('advisor-tip');
  el2.textContent = '💡 ' + tip.text;
  el2.style.borderColor = tip.danger ? 'var(--danger)' : 'var(--accent)';
  el2.style.opacity = '1';
  setTimeout(() => { el2.style.opacity = '0'; }, 5000);
}
