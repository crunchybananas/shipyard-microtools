// ════════════════════════════════════════════════════════════
// UI — HUD, build bar, info panels, tooltips
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS } from './state.js';
import { canAfford } from './economy.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { isBuildingUnlocked, TECHS, canResearch, startResearch, getResearchProgress } from './tech.js';

export function updateUI() {
  const $ = id => document.getElementById(id);
  $('r-wood').textContent = Math.floor(G.resources.wood);
  $('r-stone').textContent = Math.floor(G.resources.stone);
  $('r-food').textContent = Math.floor(G.resources.food);
  $('r-gold').textContent = Math.floor(G.resources.gold);
  $('r-iron').textContent = Math.floor(G.resources.iron);
  $('pop-display').textContent = `👤 ${G.population}/${G.maxPop}`;
  $('day-display').textContent = `Day ${G.day} · ☀️${Math.round(G.happiness)}%`;
}

export function renderBuildBar() {
  const bar = document.getElementById('build-bar');
  if (!bar) return;
  bar.innerHTML = '';
  for (const [key, def] of Object.entries(BUILDINGS)) {
    if (!isBuildingUnlocked(key)) continue; // hide locked buildings
    const affordable = canAfford(key);
    const btn = document.createElement('button');
    btn.className = 'build-btn' + (G.selectedBuild === key ? ' active' : '') + (!affordable ? ' disabled' : '');
    const costStr = Object.entries(def.cost).map(([k,v]) => `${v}${k[0].toUpperCase()}`).join(' ');
    btn.innerHTML = `<span class="icon">${def.icon}</span><span>${def.name}</span><span class="cost">${costStr}</span>`;
    btn.onclick = () => {
      G.selectedBuild = G.selectedBuild === key ? null : key;
      G.selectedBuilding = null;
      hideInfoPanel();
      renderBuildBar();
    };
    btn.onmouseenter = () => showTooltip(btn, def.name, def.desc);
    btn.onmouseleave = hideTooltip;
    bar.appendChild(btn);
  }
}

export function renderResearchPanel() {
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  const content = panel.querySelector('.research-content');
  if (!content) return;
  content.innerHTML = '';

  // Current research progress bar
  const prog = getResearchProgress();
  if (prog) {
    const progDiv = document.createElement('div');
    progDiv.className = 'research-progress';
    progDiv.innerHTML = `
      <div class="rp-label">Researching: <strong>${prog.name}</strong></div>
      <div class="rp-bar"><div class="rp-fill" style="width:${Math.round(prog.fraction*100)}%"></div></div>
      <div class="rp-pct">${Math.round(prog.fraction*100)}%</div>`;
    content.appendChild(progDiv);
  }

  // Tech list
  for (const [id, tech] of Object.entries(TECHS)) {
    const researched = G.researchedTechs.has(id);
    const available = canResearch(id);
    const prereqMet = !tech.prereq || G.researchedTechs.has(tech.prereq);
    const isActive = G.currentResearch?.techId === id;

    const div = document.createElement('div');
    div.className = 'tech-item' + (researched ? ' done' : '') + (isActive ? ' active' : '') + (!prereqMet ? ' locked' : '');
    const costStr = Object.entries(tech.cost).filter(([,v])=>v>0).map(([k,v])=>`${v} ${k}`).join(', ') || 'Free';
    div.innerHTML = `
      <span class="tech-icon">${tech.icon}</span>
      <div class="tech-info">
        <div class="tech-name">${tech.name}</div>
        <div class="tech-desc">${tech.desc}</div>
        <div class="tech-cost">${researched ? '✓ Researched' : isActive ? '🔬 In progress...' : costStr}${tech.prereq && !prereqMet ? ' · Requires ' + TECHS[tech.prereq].name : ''}</div>
      </div>`;
    if (available && !isActive) {
      const btn = document.createElement('button');
      btn.className = 'tech-btn';
      btn.textContent = 'Research';
      btn.onclick = () => { startResearch(id); renderResearchPanel(); renderBuildBar(); };
      div.appendChild(btn);
    }
    content.appendChild(div);
  }
}

export function toggleResearchPanel() {
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderResearchPanel();
}

export function showInfoPanel(b) {
  const def = BUILDINGS[b.type];
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  panel.style.display = 'block';
  const workerCount = def.workers || 0;
  const lines = [`<strong>${def.icon} ${def.name}</strong>`];
  lines.push(`HP: ${b.hp}/100`);
  if (workerCount > 0) lines.push(`Workers: ${b.workers.length}/${workerCount}`);
  if (def.prod) lines.push('Produces: ' + Object.entries(def.prod).map(([k,v]) => `${v} ${k}`).join(', '));
  if (def.defense) lines.push(`Defense: +${def.defense}`);
  if (def.pop) lines.push(`Housing: +${def.pop}`);
  if (def.happiness) lines.push(`Happiness: +${def.happiness}`);
  lines.push('<small style="opacity:0.5">Right-click to demolish (50% refund)</small>');
  panel.innerHTML = lines.join('<br>');
}

export function hideInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) panel.style.display = 'none';
}

function showTooltip(anchor, title, body) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;
  const rect = anchor.getBoundingClientRect();
  tt.querySelector('.tt-title').textContent = title;
  tt.querySelector('.tt-body').textContent = body;
  tt.style.display = 'block';
  tt.style.left = rect.left + 'px';
  tt.style.top = (rect.top - tt.offsetHeight - 8) + 'px';
}

function hideTooltip() {
  const tt = document.getElementById('tooltip');
  if (tt) tt.style.display = 'none';
}

export function setSpeed(s) {
  G.speed = s;
  document.querySelectorAll('#speed button').forEach((b, i) => {
    b.classList.toggle('active', [0, 1, 2, 4][i] === s);
  });
}

export function toggleHappinessPanel() {
  const panel = document.getElementById('happiness-panel');
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) renderHappinessPanel();
}

export function renderHappinessPanel() {
  const el = document.getElementById('happiness-content');
  if (!el) return;
  const factors = [];
  factors.push({ label: 'Base happiness', val: 50 });

  // Building bonuses
  const bCounts = {};
  for (const b of G.buildings) {
    const def = BUILDINGS[b.type];
    if (def.happiness) {
      bCounts[b.type] = (bCounts[b.type] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(bCounts)) {
    const def = BUILDINGS[type];
    factors.push({ label: `${def.icon} ${def.name} ×${count}`, val: def.happiness * count });
  }

  // Overcrowding
  const excess = Math.max(0, G.population - G.maxPop);
  if (excess > 0) factors.push({ label: `Overcrowding (${excess} homeless)`, val: -excess * 5 });

  // Starvation
  if (G.resources.food <= 0) factors.push({ label: 'Starvation (no food)', val: -10 });

  // Low food warning
  if (G.resources.food > 0 && G.resources.food < G.population) {
    factors.push({ label: 'Food shortage', val: -3 });
  }

  const total = Math.min(100, Math.max(0, factors.reduce((s, f) => s + f.val, 0)));

  el.innerHTML = factors.map(f =>
    `<div class="hp-row"><span class="hp-label">${f.label}</span><span class="hp-val ${f.val >= 0 ? 'pos' : 'neg'}">${f.val >= 0 ? '+' : ''}${f.val}</span></div>`
  ).join('') +
    `<div class="hp-row hp-total"><span class="hp-label">Total</span><span class="hp-val">${total}%</span></div>`;
}

// ── Tutorial tips ──────────────────────────────────────────
let lastTipId = '';
const TIPS = [
  { id:'start', check:()=>G.buildings.length===0, text:'👋 Welcome! Press 1 or click House to build shelter for your settlers.' },
  { id:'house', check:()=>G.buildings.some(b=>b.type==='house') && !G.buildings.some(b=>b.type==='farm'), text:'🌾 Great! Now build a Farm (press 2) to produce food before your settlers starve.' },
  { id:'farm', check:()=>G.buildings.some(b=>b.type==='farm') && G.resources.food<30 && G.day>5, text:'⚠️ Food is running low! Build more farms or your settlers will leave.' },
  { id:'research', check:()=>G.buildings.length>=3 && G.researchedTechs.size<=2, text:'🔬 Open Research (top bar) to unlock new building types like Quarry and Market.' },
  { id:'lumber', check:()=>G.researchedTechs.has('forestry') && !G.buildings.some(b=>b.type==='lumber') && G.resources.wood<20, text:'🪓 Wood is low! Build a Lumber Mill on a forest tile to produce wood.' },
  { id:'raid', check:()=>G.day>=6 && G.defense===0, text:'⚔️ Raiders are coming! Research Military tech and build defenses.' },
];

export function updateTutorialTip() {
  const tipEl = document.getElementById('tutorial-tip');
  if (!tipEl) return;
  for (const tip of TIPS) {
    if (tip.id === lastTipId) continue;
    try { if (tip.check()) { lastTipId = tip.id; tipEl.textContent = tip.text; tipEl.style.display = 'block'; return; } } catch {}
  }
  tipEl.style.display = 'none';
}

export function setupSaveButtons() {
  document.getElementById('btn-save')?.addEventListener('click', saveGame);
  document.getElementById('btn-load')?.addEventListener('click', () => {
    if (loadGame()) {
      renderBuildBar();
      updateUI();
    }
  });
}
