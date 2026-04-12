// ════════════════════════════════════════════════════════════
// UI — HUD, build bar, info panels, tooltips
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, getSeasonData } from './state.js';
import { canAfford } from './economy.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { isBuildingUnlocked, TECHS, canResearch, startResearch, getResearchProgress } from './tech.js';

function rateStr(val) {
  if (val === 0) return '';
  const sign = val > 0 ? '+' : '';
  return ` <span class="rate ${val>0?'pos':'neg'}">${sign}${val}/d</span>`;
}

export function updateUI() {
  const $ = id => document.getElementById(id);

  // Compute rates: compare resources to snapshot taken half a day ago
  const interval = Math.floor(G.dayLength / 2);
  if (G.gameTick % interval === 0 && G.gameTick > 0) {
    if (G.lastResources) {
      for (const k of ['wood','stone','food','gold','iron']) {
        // Scale to per-day: measured over half a day, so multiply by 2
        G.resourceRates[k] = Math.round((G.resources[k] - G.lastResources[k]) * 2);
      }
    }
    G.lastResources = { ...G.resources };
  }

  $('r-wood').innerHTML = Math.floor(G.resources.wood) + rateStr(G.resourceRates.wood);
  $('r-stone').innerHTML = Math.floor(G.resources.stone) + rateStr(G.resourceRates.stone);
  $('r-food').innerHTML = Math.floor(G.resources.food) + rateStr(G.resourceRates.food);
  $('r-gold').innerHTML = Math.floor(G.resources.gold) + rateStr(G.resourceRates.gold);
  $('r-iron').innerHTML = Math.floor(G.resources.iron) + rateStr(G.resourceRates.iron);
  $('pop-display').textContent = `👤 ${G.population}/${G.maxPop}`;
  const season = getSeasonData();
  $('day-display').textContent = `Day ${G.day} · ${season.name} · ☀️${Math.round(G.happiness)}%`;
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

// ── Tutorial system ────────────────────────────────────────
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    text: '👋 Welcome to Realm! You have 3 settlers on an island. Let\'s build a settlement.',
    action: 'Click anywhere to continue',
    check: () => G.gameTick > 30,
  },
  {
    id: 'build_house',
    text: '🏠 First, build a House for shelter. Click the House button below (or press 1).',
    action: 'Select House from the build bar ↓',
    check: () => G.selectedBuild === 'house',
    highlight: '.build-btn',
  },
  {
    id: 'place_house',
    text: '🏠 Now click on a green tile to place your house.',
    action: 'Click a grass tile on the island',
    check: () => G.buildings.some(b => b.type === 'house'),
  },
  {
    id: 'build_farm',
    text: '🌾 Settlers need food! Build a Farm to produce it. Click Farm (or press 2).',
    action: 'Select Farm from the build bar ↓',
    check: () => G.selectedBuild === 'farm' || G.buildings.some(b => b.type === 'farm'),
    highlight: '.build-btn',
  },
  {
    id: 'place_farm',
    text: '🌾 Place the farm on any grass tile. Build 2 farms to keep up with food demand!',
    action: 'Click grass tiles to place farms',
    check: () => G.buildings.filter(b => b.type === 'farm').length >= 2,
  },
  {
    id: 'speed',
    text: '⏩ Nice! Use the speed controls (top-left) or try 4× speed to watch your settlement grow.',
    action: 'Try pressing the ▶▶▶ button',
    check: () => G.speed >= 2 || G.day >= 2,
  },
  {
    id: 'research',
    text: '🔬 Click Research in the top bar to unlock new buildings like Quarry, Market, and more!',
    action: 'Open the Research panel',
    check: () => G.researchedTechs.size > 2,
    highlight: '.hud-btn',
  },
  {
    id: 'done',
    text: '🎉 You\'re on your own now! Build, research, trade, and survive the seasons. Watch out for raiders!',
    action: '',
    check: () => G.gameTick > 99999, // stays until dismissed
  },
];

let tutorialStep = 0;
let tutorialDismissed = false;

export function updateTutorialTip() {
  const tipEl = document.getElementById('tutorial-tip');
  if (!tipEl) return;
  if (tutorialDismissed || tutorialStep >= TUTORIAL_STEPS.length) {
    tipEl.style.display = 'none';
    return;
  }

  const step = TUTORIAL_STEPS[tutorialStep];

  // Auto-advance if check passes
  try {
    if (step.check()) {
      tutorialStep++;
      if (tutorialStep >= TUTORIAL_STEPS.length) { tipEl.style.display = 'none'; return; }
    }
  } catch {}

  const current = TUTORIAL_STEPS[Math.min(tutorialStep, TUTORIAL_STEPS.length - 1)];
  tipEl.innerHTML = `
    <div class="tut-text">${current.text}</div>
    ${current.action ? `<div class="tut-action">${current.action}</div>` : ''}
    <div class="tut-progress">${tutorialStep + 1} / ${TUTORIAL_STEPS.length}</div>
    <button class="tut-skip" onclick="dismissTutorial()">Skip tutorial</button>
  `;
  tipEl.style.display = 'block';

  // Highlight relevant UI element
  document.querySelectorAll('.tut-highlight').forEach(e => e.classList.remove('tut-highlight'));
  if (current.highlight) {
    const el = document.querySelector(current.highlight);
    if (el) el.classList.add('tut-highlight');
  }
}

export function dismissTutorial() {
  tutorialDismissed = true;
  document.querySelectorAll('.tut-highlight').forEach(e => e.classList.remove('tut-highlight'));
  const tipEl = document.getElementById('tutorial-tip');
  if (tipEl) tipEl.style.display = 'none';
}

// ── Population panel ──────────────────────────────────────
export function togglePopPanel() {
  const p = document.getElementById('pop-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderPopPanel();
}

function renderPopPanel() {
  const el = document.getElementById('pop-content');
  if (!el) return;
  el.innerHTML = '';
  const stateLabel = { idle:'Idle', find_job:'Seeking work', walk_to_work:'Going to work',
    working:'Working', walk_to_deliver:'Delivering', deliver:'Delivering',
    foraging:'Foraging', eating:'Eating' };
  for (const c of G.citizens) {
    const job = c.jobBuilding ? BUILDINGS[c.jobBuilding.type]?.name : 'None';
    const state = stateLabel[c.state] || c.state;
    const hungerBar = Math.round(c.hunger);
    const div = document.createElement('div');
    div.className = 'pop-row';
    div.innerHTML = `
      <span class="pop-name">${c.name}</span>
      <span class="pop-job">${job}</span>
      <span class="pop-state">${state}</span>
      <span class="pop-hunger" title="Hunger ${hungerBar}%">
        <span class="pop-hunger-bar" style="width:${hungerBar}%;background:${hungerBar>70?'var(--danger)':hungerBar>40?'var(--gold)':'var(--food)'}"></span>
      </span>`;
    el.appendChild(div);
  }
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
