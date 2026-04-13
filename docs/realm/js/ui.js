// ════════════════════════════════════════════════════════════
// UI — HUD, build bar, info panels, tooltips
// ════════════════════════════════════════════════════════════

import { G, BUILDINGS, getSeasonData, DIFFICULTY } from './state.js';
import { canAfford, getRaidCountdown, upgradeBuilding } from './economy.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { isBuildingUnlocked, TECHS, canResearch, startResearch, getResearchProgress } from './tech.js';
import { notify } from './notifications.js';

function _triggerFoodWarning() {
  notify('⚠️ Food running low! Build more farms!', 'danger');
}

function rateStr(val, tooltip) {
  if (val === 0) return '';
  const arrow = val > 0 ? '▲' : '▼';
  const abs = Math.abs(val);
  const tt = tooltip ? ` title="${tooltip}"` : '';
  return ` <span class="rate ${val>0?'pos':'neg'}"${tt}>${arrow}${abs}/day</span>`;
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

  const warn = (el, val, threshold) => {
    if (!el) return;
    if (val <= threshold && val >= 0) { el.closest('.res')?.classList.add('res-warn'); }
    else { el.closest('.res')?.classList.remove('res-warn'); }
  };
  const wEl = $('r-wood'), sEl = $('r-stone'), fEl = $('r-food'), gEl = $('r-gold'), iEl = $('r-iron');

  // Food rate tooltip: show consumption vs production context
  const foodRate = G.resourceRates.food;
  const foodConsumption = G.population; // ~1 per citizen per day (economy.js: pop * 1.0)
  const foodTooltip = foodRate < 0
    ? `Consuming ~${foodConsumption}/day. Build more farms!`
    : foodRate > 0
      ? `Net +${foodRate}/day. ${Math.floor(G.resources.food / Math.abs(foodRate || 1))} days of surplus.`
      : `Food is balanced. Consider more farms for safety.`;

  wEl.innerHTML = Math.floor(G.resources.wood) + rateStr(G.resourceRates.wood, G.resourceRates.wood < 0 ? 'Wood declining — build more lumber mills!' : null);
  sEl.innerHTML = Math.floor(G.resources.stone) + rateStr(G.resourceRates.stone);
  fEl.innerHTML = Math.floor(G.resources.food) + rateStr(foodRate, foodTooltip);
  gEl.innerHTML = Math.floor(G.resources.gold) + rateStr(G.resourceRates.gold);
  iEl.innerHTML = Math.floor(G.resources.iron) + rateStr(G.resourceRates.iron);

  // Warn thresholds: food warns when below 2x daily consumption or negative rate
  const foodWarnThreshold = Math.max(20, G.population * 2);
  warn(wEl, G.resources.wood, 5);
  warn(fEl, G.resources.food, foodWarnThreshold);
  warn(gEl, G.resources.gold, 0);

  // Food emoji tint: add red class when food is critically low or rate is negative
  const foodRes = $('r-food')?.closest('.res');
  const foodEmoji = foodRes?.querySelector('.res-emoji');
  if (foodEmoji) {
    if (G.resources.food < foodWarnThreshold || foodRate < 0) {
      foodEmoji.classList.add('food-warn-emoji');
    } else {
      foodEmoji.classList.remove('food-warn-emoji');
    }
  }

  // Persistent food warning toast (throttled: at most once per day-cycle)
  if (!G._lastFoodWarnDay) G._lastFoodWarnDay = 0;
  const foodCritical = G.resources.food < foodWarnThreshold && foodRate < 0;
  if (foodCritical && G.day > G._lastFoodWarnDay) {
    G._lastFoodWarnDay = G.day;
    // Import notify lazily via the notifications module pattern — use window or deferred
    if (typeof notifyFood === 'function') {
      notifyFood();
    } else {
      // We'll handle this via the imported notify in a dedicated exported function
      _triggerFoodWarning();
    }
  }
  $('pop-display').textContent = `👤 ${G.population}/${G.maxPop}`;
  const season = getSeasonData();
  const diffLabel = DIFFICULTY[G.difficulty]?.label?.split(' ')[0] || '';
  const raidDays = getRaidCountdown();
  let raidWarn = '';
  if (raidDays) {
    const urgent = raidDays <= 2;
    raidWarn = ` · <span class="${urgent ? 'raid-warn-urgent' : 'raid-warn'}">⚔️${raidDays}d</span>`;
  }
  $('day-display').innerHTML = `Day ${G.day} · ${season.name} · ☀️${Math.round(G.happiness)}%${raidWarn} ${diffLabel}`;
}

const CATEGORIES = [
  { name: 'Housing',        keys: ['house'] },
  { name: 'Production',     keys: ['farm', 'lumber', 'quarry', 'mine'] },
  { name: 'Economy',        keys: ['market', 'tradingpost', 'school'] },
  { name: 'Defense',        keys: ['barracks', 'tower', 'wall'] },
  { name: 'Infrastructure', keys: ['road', 'well', 'granary'] },
  { name: 'Culture',        keys: ['tavern', 'church'] },
  { name: 'Victory',        keys: ['castle'] },
];

export function renderBuildBar() {
  const bar = document.getElementById('build-bar');
  if (!bar) return;
  bar.innerHTML = '';
  const allKeys = Object.keys(BUILDINGS);
  const terrainNames = { 1:'Sand', 3:'Forest', 4:'Stone', 5:'Iron' };

  for (const cat of CATEGORIES) {
    const unlockedKeys = cat.keys.filter(key => BUILDINGS[key] && isBuildingUnlocked(key));
    if (unlockedKeys.length === 0) continue;

    // Category label divider
    const divider = document.createElement('div');
    divider.className = 'build-cat';
    divider.textContent = cat.name;
    bar.appendChild(divider);

    for (const key of unlockedKeys) {
      const def = BUILDINGS[key];
      const affordable = canAfford(key);
      const btn = document.createElement('button');
      btn.className = 'build-btn' + (G.selectedBuild === key ? ' active' : '') + (!affordable ? ' disabled' : '');
      const costStr = Object.entries(def.cost).map(([k,v]) => `${v}${k[0].toUpperCase()}`).join(' ');
      // Show terrain requirement if applicable
      const terrainReq = def.on ? def.on.map(t => terrainNames[t] || '?').join('/') : null;
      const terrainTag = terrainReq ? `<span class="cost terrain">⬡ ${terrainReq}</span>` : '';
      // Keyboard shortcut number (1-based index in BUILDINGS declaration order)
      const shortcutNum = allKeys.indexOf(key) + 1;
      const shortcutBadge = shortcutNum <= 9 ? `<span class="build-btn-shortcut">${shortcutNum}</span>` : '';
      btn.innerHTML = `${shortcutBadge}<span class="icon">${def.icon}</span><span>${def.name}</span><span class="cost">${costStr}</span>${terrainTag}`;
      btn.onclick = () => {
        G.selectedBuild = G.selectedBuild === key ? null : key;
        G.selectedBuilding = null;
        hideInfoPanel();
        renderBuildBar();
      };
      btn.onmouseenter = () => showTooltip(btn, key, def);
      btn.onmouseleave = hideTooltip;
      bar.appendChild(btn);
    }
  }
}

export function renderResearchPanel() {
  const panel = document.getElementById('research-panel');
  if (!panel) return;
  const content = panel.querySelector('.research-content');
  if (!content) return;
  content.innerHTML = '';

  // ── Prominent active-research progress bar ──────────────
  const prog = getResearchProgress();
  if (prog) {
    const pct = Math.round(prog.fraction * 100);
    const techData = TECHS[prog.techId];
    const progDiv = document.createElement('div');
    progDiv.className = 'research-progress-hero';
    progDiv.innerHTML = `
      <div class="rp-hero-label">
        <span>🔬 Researching</span>
        <span class="rp-hero-tech">${techData.icon} ${prog.name}</span>
        <span class="rp-hero-pct">${pct}%</span>
      </div>
      <div class="rp-bar"><div class="rp-fill" style="width:${pct}%"></div></div>
      <div class="rp-sublabel">Schools speed up research by 50% each</div>`;
    content.appendChild(progDiv);
  }

  // ── Build a building-icon lookup from BUILDINGS ──────────
  const resEmoji = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };

  // ── Organise techs into tiers by prereq depth ────────────
  // tier0: no prereq
  // tier1: prereq is a tier0 tech
  // tier2: prereq is a tier1 tech
  const allIds = Object.keys(TECHS);
  const tierOf = {};
  // first pass: root nodes
  for (const id of allIds) {
    if (!TECHS[id].prereq) tierOf[id] = 0;
  }
  // subsequent passes until stable
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of allIds) {
      if (tierOf[id] !== undefined) continue;
      const prereq = TECHS[id].prereq;
      if (prereq && tierOf[prereq] !== undefined) {
        tierOf[id] = tierOf[prereq] + 1;
        changed = true;
      }
    }
  }
  // fallback: any unresolved go to tier 3
  for (const id of allIds) {
    if (tierOf[id] === undefined) tierOf[id] = 3;
  }

  const maxTier = Math.max(...Object.values(tierOf));
  const tiers = [];
  for (let t = 0; t <= maxTier; t++) {
    tiers.push(allIds.filter(id => tierOf[id] === t));
  }

  const tierLabels = ['Foundations', 'Advanced', 'Mastery'];

  // ── Render each tier ─────────────────────────────────────
  for (let t = 0; t < tiers.length; t++) {
    const tierIds = tiers[t];
    if (tierIds.length === 0) continue;

    // Connector lines between tiers (not before first)
    if (t > 0) {
      const conn = document.createElement('div');
      conn.className = 'tech-connector';
      content.appendChild(conn);
    }

    const tierSection = document.createElement('div');
    tierSection.className = 'tech-tier';

    const tierLabel = document.createElement('div');
    tierLabel.className = 'tech-tier-label';
    tierLabel.textContent = tierLabels[t] || `Tier ${t}`;
    tierSection.appendChild(tierLabel);

    const row = document.createElement('div');
    row.className = 'tech-row';

    for (const id of tierIds) {
      const tech = TECHS[id];
      const researched = G.researchedTechs.has(id);
      const available = canResearch(id);
      const prereqMet = !tech.prereq || G.researchedTechs.has(tech.prereq);
      const isActive = G.currentResearch?.techId === id;

      // Card state classes
      let cardClass = 'tech-card';
      if (researched)    cardClass += ' done';
      else if (isActive) cardClass += ' active';
      else if (!prereqMet) cardClass += ' locked';
      else if (available)  cardClass += ' available';

      // Cost string
      const costEntries = Object.entries(tech.cost).filter(([,v]) => v > 0);
      const costStr = costEntries.length
        ? costEntries.map(([k, v]) => `${resEmoji[k] || k} ${v}`).join('  ')
        : 'Free';
      const isFree = costEntries.length === 0;

      // Unlocks row — show building icons + names
      const unlockItems = tech.unlocks.map(bKey => {
        const bDef = BUILDINGS[bKey];
        return bDef ? `<span class="tc-unlock-item">${bDef.icon} ${bDef.name}</span>` : '';
      }).filter(Boolean).join('');

      const card = document.createElement('div');
      card.className = cardClass;
      card.innerHTML = `
        <div class="tc-top">
          <span class="tc-icon">${tech.icon}</span>
          <span class="tc-name">${tech.name}</span>
          ${researched ? '<span class="tc-check">✓</span>' : ''}
        </div>
        <div class="tc-desc">${tech.desc}</div>
        ${unlockItems ? `<div class="tc-unlocks"><span class="tc-unlock-label">Unlocks:</span>${unlockItems}</div>` : ''}
        <div class="tc-cost ${isFree ? 'free' : ''}">
          ${researched
            ? '<span style="color:#4ade80">✓ Researched</span>'
            : isActive
              ? '<span style="color:var(--accent)">🔬 In progress…</span>'
              : costStr}
        </div>
        ${tech.prereq && !prereqMet
          ? `<div class="tc-prereq-note">⚠ Requires ${TECHS[tech.prereq].icon} ${TECHS[tech.prereq].name}</div>`
          : ''}`;

      // Research button
      if (available && !isActive) {
        const btn = document.createElement('button');
        btn.className = 'tech-btn';
        btn.textContent = 'Research';
        btn.onclick = () => { startResearch(id); renderResearchPanel(); renderBuildBar(); };
        card.appendChild(btn);
      }

      row.appendChild(card);
    }

    tierSection.appendChild(row);
    content.appendChild(tierSection);
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

  const workerCount = def.workers || 0;
  const level = b.level || 1;

  // Level stars: ★★☆ for level 2 of 3
  const maxLevel = def.upgrades ? def.upgrades.length + 1 : 1;
  const levelStars = def.upgrades
    ? '★'.repeat(level) + '☆'.repeat(maxLevel - level)
    : '';
  const levelLabel = def.upgrades
    ? `<span class="ip-stars" title="Level ${level}/${maxLevel}">${levelStars}</span>`
    : '';

  // Effective production multiplier for current level
  const upgrades = def.upgrades || [];
  const levelMult = level >= 2 ? (upgrades[level - 2]?.prodMult ?? 1) : 1;

  // HP bar
  const hp = Math.max(0, Math.min(100, b.hp ?? 100));
  const hpPct = hp;
  const hpColor = hp > 60 ? '#4ade80' : hp > 30 ? '#facc15' : '#f87171';

  // Build header
  let html = `
    <div class="ip-header">
      <span class="ip-title">${def.icon} ${def.name}${levelLabel ? ' ' + levelLabel : ''}</span>
      <button class="ip-close" onclick="hideInfoPanel()" title="Close">✕</button>
    </div>`;

  // Description
  if (def.desc) {
    html += `<div class="ip-desc">${def.desc}</div>`;
  }

  // HP bar
  html += `
    <div class="ip-row">
      <span class="ip-label">HP</span>
      <span class="ip-hpbar">
        <span class="ip-hpfill" style="width:${hpPct}%;background:${hpColor}"></span>
      </span>
      <span class="ip-hpval">${hp}/100</span>
    </div>`;

  // Workers
  if (workerCount > 0) {
    const staffed = b.workers.length;
    const workerDots = '●'.repeat(staffed) + '○'.repeat(workerCount - staffed);
    html += `<div class="ip-row"><span class="ip-label">Workers</span><span class="ip-val">${workerDots} ${staffed}/${workerCount}</span></div>`;
  }

  // Production (per cycle and per day)
  if (def.prod) {
    const effectiveProd = Object.entries(def.prod)
      .map(([k, v]) => {
        const perCycle = Math.round(v * levelMult * 10) / 10;
        const perDay = Math.round(perCycle * 4 * 10) / 10; // ~4 cycles per day
        return `${perCycle} ${k}<span class="ip-perday"> (${perDay}/day)</span>`;
      }).join(', ');
    html += `<div class="ip-row"><span class="ip-label">Produces</span><span class="ip-val">${effectiveProd}</span></div>`;
  }

  // Defense
  if (def.defense) {
    html += `<div class="ip-row"><span class="ip-label">Defense</span><span class="ip-val ip-defense">🛡 +${def.defense}</span></div>`;
  }

  // Housing
  if (def.pop) {
    html += `<div class="ip-row"><span class="ip-label">Housing</span><span class="ip-val">🏠 +${def.pop} pop</span></div>`;
  }

  // Happiness
  if (def.happiness) {
    html += `<div class="ip-row"><span class="ip-label">Happiness</span><span class="ip-val ip-happy">😊 +${def.happiness}</span></div>`;
  }

  html += `<div class="ip-hint">Right-click to demolish (50% refund)</div>`;

  panel.innerHTML = html;

  // Position below missions panel to avoid overlap
  const missions = document.getElementById('missions');
  if (missions) {
    const mRect = missions.getBoundingClientRect();
    panel.style.top = (mRect.bottom + 8) + 'px';
  }

  panel.style.display = 'block';
  // Trigger slide-in animation
  panel.classList.remove('ip-visible');
  requestAnimationFrame(() => panel.classList.add('ip-visible'));

  // Upgrade button — show if upgrades exist and not at max level
  const nextUpgrade = def.upgrades?.[level - 1];
  if (nextUpgrade) {
    const costStr = Object.entries(nextUpgrade.cost).map(([k,v]) => `${v} ${k[0].toUpperCase()}`).join(' ');
    const canAffordUpgrade = Object.entries(nextUpgrade.cost).every(([k,v]) => (G.resources[k] || 0) >= v);
    const btn = document.createElement('button');
    btn.className = 'upgrade-btn' + (canAffordUpgrade ? '' : ' disabled');
    btn.innerHTML = `⬆ Upgrade → ${nextUpgrade.name} <small style="opacity:0.75">(×${nextUpgrade.prodMult} prod)</small><br><small class="ip-hint" style="opacity:0.8">${costStr}</small>`;
    btn.onclick = () => {
      if (upgradeBuilding(b)) showInfoPanel(b);
    };
    panel.appendChild(btn);
  }
}

export function hideInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) { panel.style.display = 'none'; panel.classList.remove('ip-visible'); }
}

function showTooltip(anchor, key, def) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;

  tt.querySelector('.tt-title').textContent = `${def.icon} ${def.name}`;

  const lines = [];

  // Description
  if (def.desc) lines.push(`<span class="tt-desc">${def.desc}</span>`);

  // Cost breakdown with emoji icons
  const resEmoji = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };
  const costParts = Object.entries(def.cost).map(([k,v]) => `${resEmoji[k]||k} ${v}`).join('  ');
  lines.push(`<span class="tt-row"><span class="tt-lbl">Cost</span> ${costParts}</span>`);

  // Worker requirements
  if (def.workers) {
    lines.push(`<span class="tt-row"><span class="tt-lbl">Workers</span> 👷 ${def.workers}</span>`);
  }

  // Production output
  if (def.prod) {
    const prodStr = Object.entries(def.prod).map(([k,v]) => `${resEmoji[k]||k} ${v}/cycle`).join('  ');
    lines.push(`<span class="tt-row"><span class="tt-lbl">Produces</span> ${prodStr}</span>`);
  }

  // Housing
  if (def.pop) {
    lines.push(`<span class="tt-row"><span class="tt-lbl">Housing</span> 🏠 +${def.pop} pop</span>`);
  }

  // Defense bonus
  if (def.defense) {
    lines.push(`<span class="tt-row"><span class="tt-lbl">Defense</span> 🛡 +${def.defense}</span>`);
  }

  // Happiness bonus
  if (def.happiness) {
    lines.push(`<span class="tt-row"><span class="tt-lbl">Happiness</span> 😊 +${def.happiness}</span>`);
  }

  // Terrain requirement
  if (def.on) {
    const terrainNames = { 1:'Sand', 3:'Forest', 4:'Stone', 5:'Iron' };
    const terrainStr = def.on.map(t => terrainNames[t] || '?').join(' or ');
    lines.push(`<span class="tt-row tt-terrain">⬡ Requires ${terrainStr} tile</span>`);
  }

  tt.querySelector('.tt-body').innerHTML = lines.join('');

  tt.style.display = 'block';
  const rect = anchor.getBoundingClientRect();
  // Position above the button, clamp to viewport
  const ttH = tt.offsetHeight;
  const ttW = tt.offsetWidth;
  let left = rect.left;
  let top = rect.top - ttH - 8;
  if (left + ttW > window.innerWidth - 8) left = window.innerWidth - ttW - 8;
  if (top < 8) top = rect.bottom + 8;
  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
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
  factors.push({ label: '🏡 Base happiness', val: 50, category: 'base' });

  // Building bonuses — group by type
  const bCounts = {};
  for (const b of G.buildings) {
    const def = BUILDINGS[b.type];
    if (def.happiness) {
      bCounts[b.type] = (bCounts[b.type] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(bCounts)) {
    const def = BUILDINGS[type];
    factors.push({ label: `${def.icon} ${def.name} ×${count}`, val: def.happiness * count, category: 'building' });
  }

  // Negative modifiers
  const excess = Math.max(0, G.population - G.maxPop);
  if (excess > 0) factors.push({ label: `😰 Overcrowding (${excess} homeless)`, val: -excess * 5, category: 'penalty' });
  if (G.resources.food <= 0) factors.push({ label: '💀 Starvation (no food)', val: -10, category: 'penalty' });
  if (G.resources.food > 0 && G.resources.food < G.population) {
    factors.push({ label: '🍎 Food shortage', val: -3, category: 'penalty' });
  }

  // Event modifiers
  if (G.eventModifiers.happinessOffset && G.eventModifiers.happinessOffset !== 0) {
    factors.push({ label: '✨ Event modifier', val: G.eventModifiers.happinessOffset, category: 'event' });
  }

  const rawTotal = factors.reduce((s, f) => s + f.val, 0);
  const total = Math.min(100, Math.max(0, rawTotal));

  // Happiness score color
  const barColor = total >= 70 ? '#4ade80' : total >= 40 ? '#ffd166' : '#f87171';
  const scoreLabel = total >= 75 ? '😄 Happy' : total >= 50 ? '😐 Content' : total >= 25 ? '😟 Unhappy' : '😡 Miserable';

  // Net change: compare to previous day target
  const prevHappiness = G.happiness;
  const netChange = total - prevHappiness;
  const netStr = netChange > 0.5 ? `▲ +${Math.round(netChange)}/day`
    : netChange < -0.5 ? `▼ ${Math.round(netChange)}/day`
    : '— Stable';
  const netColor = netChange > 0.5 ? '#4ade80' : netChange < -0.5 ? '#f87171' : 'rgba(255,255,255,0.4)';

  // Separate bonuses from penalties
  const bonuses = factors.filter(f => f.val > 0);
  const penalties = factors.filter(f => f.val < 0);

  let html = `
    <div class="hp-score-bar">
      <div class="hp-score-fill" style="width:${total}%;background:${barColor}"></div>
    </div>
    <div class="hp-score-row">
      <span class="hp-score-label">${scoreLabel}</span>
      <span class="hp-score-val" style="color:${barColor}">${total}%</span>
    </div>
    <div class="hp-net" style="color:${netColor}">${netStr}</div>
    <div class="hp-section-title">Happiness Sources</div>`;

  html += bonuses.map(f =>
    `<div class="hp-row"><span class="hp-label">${f.label}</span><span class="hp-val pos">+${f.val}</span></div>`
  ).join('');

  if (penalties.length > 0) {
    html += `<div class="hp-section-title hp-section-penalty">Penalties</div>`;
    html += penalties.map(f =>
      `<div class="hp-row"><span class="hp-label">${f.label}</span><span class="hp-val neg">${f.val}</span></div>`
    ).join('');
  }

  html += `<div class="hp-row hp-total"><span class="hp-label">Net Happiness</span><span class="hp-val">${total}%</span></div>`;

  el.innerHTML = html;
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
    id: 'build_farm',
    text: '🌾 Your settlers need food! Build a Farm first. Click Farm below (or press 2).',
    action: 'Select Farm from the build bar ↓',
    check: () => G.selectedBuild === 'farm',
    highlight: '.build-btn',
  },
  {
    id: 'place_farm',
    text: '🌾 Click on a green grass tile to place your farm. Workers will auto-assign!',
    action: 'Click a grass tile on the island',
    check: () => G.buildings.some(b => b.type === 'farm'),
  },
  {
    id: 'build_lumber',
    text: '🪓 Now build a Lumber Mill on a forest tile for wood. Click Lumber Mill (or press 3).',
    action: 'Select Lumber Mill from the build bar ↓',
    check: () => G.selectedBuild === 'lumber' || G.buildings.some(b => b.type === 'lumber'),
    highlight: '.build-btn',
  },
  {
    id: 'place_lumber',
    text: '🪓 Place the Lumber Mill on a dark green forest tile. You need wood to build more!',
    action: 'Click a forest tile',
    check: () => G.buildings.some(b => b.type === 'lumber'),
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
      // Auto-dismiss after the player places their first building
      if (step.id === 'place_farm') {
        dismissTutorial();
        return;
      }
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

  // Classify citizens
  const isHungry = c => c.hunger >= 70;
  const isWorking = c => c.jobBuilding && !isHungry(c) &&
    ['working','walk_to_work','walk_to_deliver','deliver'].includes(c.state);
  const getGroup = c => isHungry(c) ? 2 : isWorking(c) ? 0 : 1;

  // Sort: working first (0), idle (1), hungry (2); within group alphabetically
  const sorted = [...G.citizens].map((c, i) => ({ c, i })).sort((a, b) => {
    const ga = getGroup(a.c), gb = getGroup(b.c);
    return ga !== gb ? ga - gb : a.c.name.localeCompare(b.c.name);
  });

  // Summary counts
  const workingCount = G.citizens.filter(isWorking).length;
  const hungryCount = G.citizens.filter(isHungry).length;
  const idleCount = G.citizens.length - workingCount - hungryCount;

  // Summary bar
  const summary = document.createElement('div');
  summary.className = 'pop-summary';
  summary.innerHTML = `
    <span class="pop-sum-item pop-sum-work">🟢 ${workingCount} Working</span>
    <span class="pop-sum-item pop-sum-idle">🟡 ${idleCount} Idle</span>
    <span class="pop-sum-item pop-sum-hungry${hungryCount > 0 ? ' pop-sum-warn' : ''}">🔴 ${hungryCount} Hungry</span>`;
  el.appendChild(summary);

  // Column header
  const hdr = document.createElement('div');
  hdr.className = 'pop-row pop-header';
  hdr.innerHTML = `<span>Name</span><span>Job</span><span>State</span><span>Hunger</span><span></span>`;
  el.appendChild(hdr);

  let lastGroup = -1;
  for (const { c, i } of sorted) {
    const group = getGroup(c);

    // Group divider labels
    if (group !== lastGroup) {
      lastGroup = group;
      const groupNames = ['Working', 'Idle', 'Hungry'];
      const groupColors = ['var(--food)', 'var(--gold)', 'var(--danger)'];
      const div = document.createElement('div');
      div.className = 'pop-group-label';
      div.style.color = groupColors[group];
      div.textContent = groupNames[group];
      el.appendChild(div);
    }

    const job = c.jobBuilding ? (BUILDINGS[c.jobBuilding.type]?.icon || '') + ' ' + (BUILDINGS[c.jobBuilding.type]?.name || '') : '—';
    const state = stateLabel[c.state] || c.state;
    const hungerBar = Math.round(c.hunger);
    const stateColor = group === 0 ? 'var(--food)' : group === 2 ? 'var(--danger)' : 'var(--gold)';
    const div = document.createElement('div');
    div.className = 'pop-row';
    div.style.borderLeft = `3px solid ${stateColor}`;
    div.innerHTML = `
      <span class="pop-name">${c.name}</span>
      <span class="pop-job">${job}</span>
      <span class="pop-state" style="color:${stateColor}">${state}</span>
      <span class="pop-hunger" title="Hunger ${hungerBar}%">
        <span class="pop-hunger-bar" style="width:${hungerBar}%;background:${hungerBar>70?'var(--danger)':hungerBar>40?'var(--gold)':'var(--food)'}"></span>
      </span>
      <button class="pop-unassign" title="Unassign from job" data-idx="${i}">✕</button>
      ${!c.jobBuilding ? `<select class="pop-assign" data-idx="${i}"><option value="">Assign to...</option></select>` : ''}`;
    el.appendChild(div);
  }

  // Unassign buttons
  el.querySelectorAll('.pop-unassign').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx);
      const c = G.citizens[idx];
      if (c && c.jobBuilding) {
        c.jobBuilding.workers = c.jobBuilding.workers.filter(w => w !== c);
        c.jobBuilding = null;
        c.state = 'idle';
        c.path = null;
        renderPopPanel();
      }
    };
  });

  // Assignment dropdowns — populate with understaffed buildings
  const understaffed = G.buildings.filter(b => {
    const def = BUILDINGS[b.type];
    return def.workers && b.workers.length < def.workers;
  });
  el.querySelectorAll('.pop-assign').forEach(sel => {
    for (const b of understaffed) {
      const def = BUILDINGS[b.type];
      const opt = document.createElement('option');
      opt.value = G.buildings.indexOf(b);
      opt.textContent = `${def.icon} ${def.name} (${b.workers.length}/${def.workers})`;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      const cIdx = parseInt(sel.dataset.idx);
      const bIdx = parseInt(sel.value);
      const c = G.citizens[cIdx];
      const b = G.buildings[bIdx];
      if (c && b) {
        // Unassign from old job if any
        if (c.jobBuilding) {
          c.jobBuilding.workers = c.jobBuilding.workers.filter(w => w !== c);
        }
        c.jobBuilding = b;
        b.workers.push(c);
        c.state = 'walk_to_work';
        c.path = null;
        c.stateTimer = 0;
        renderPopPanel();
      }
    };
  });

  // Understaffed buildings list
  if (understaffed.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'pop-section';
    sec.innerHTML = `<div class="pop-section-title">⚠️ Understaffed Buildings</div>`;
    for (const b of understaffed) {
      const def = BUILDINGS[b.type];
      const div = document.createElement('div');
      div.className = 'pop-understaffed';
      div.innerHTML = `<span>${def.icon} ${def.name} — ${b.workers.length}/${def.workers} workers</span>`;
      sec.appendChild(div);
    }
    el.appendChild(sec);
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
  document.getElementById('btn-newgame')?.addEventListener('click', () => window.newGame?.());
}
