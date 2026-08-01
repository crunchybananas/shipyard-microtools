// ════════════════════════════════════════════════════════════
// UI — HUD, build bar, info panels, tooltips
// ════════════════════════════════════════════════════════════

import { resourceEmoji, G, BUILDINGS, getSeasonData, DIFFICULTY, HOUSE_TIERS } from './state.js?realm=184';
import { canAfford, getRaidCountdown, getHouseTierReport, computePrestige } from './economy.js?realm=184';
import { getWonderReport } from './wonder.js?realm=184';
import { panCameraTo } from './render.js?realm=184';
import { dispatch } from './commands.js?realm=184';
import { missions } from './missions.js?realm=184';
import { getActiveScenario } from './scenarios.js?realm=184';
import { saveGame, loadGame } from './save.js?realm=184';
import { isBuildingUnlocked, TECHS, canResearch, getResearchProgress, ERAS, getEraProgress } from './tech.js?realm=184';
import { notify } from './notifications.js?realm=184';
import { TRADE_PARTNERS } from './trade.js?realm=184';
import {
  citizenStaffingCapacity,
  staffingCount,
} from './citizen-ownership.js?realm=184';
import { buildCurrentCitizenPresentations } from './citizen-presentation.js?realm=184';

const escapeHtml = value => String(value).replace(
  /[&<>"']/g,
  character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character],
);

const BUILDING_ATLAS_TYPES = [
  'granary', 'castle', 'church', 'windmill',
  'tower', 'house', 'tavern', 'blacksmith',
  'market', 'bakery', 'barracks', 'townhall',
  'well',
];
const SUPPORT_ATLAS_TYPES = [
  'farm', 'lumber', 'quarry', 'mine',
  'fisherman', 'tradingpost', 'school', 'archery',
  'wall', 'road', 'chickencoop', 'cowpen',
  'palisade', 'campfire', 'orchard', 'hay',
];

function buildAtlasIcon(type) {
  const supportIdx = SUPPORT_ATLAS_TYPES.indexOf(type);
  const coreIdx = BUILDING_ATLAS_TYPES.indexOf(type);
  const idx = supportIdx >= 0 ? supportIdx : coreIdx;
  if (idx < 0) return null;
  const atlas = supportIdx >= 0 ? 'assets/sprites/support-atlas.png' : 'assets/sprites/buildings-atlas-painted.png';
  const col = idx % 4;
  const row = Math.floor(idx / 4);
  return `<span class="build-sprite" style="--atlas:url('${atlas}');--atlas-col:${col};--atlas-row:${row}" aria-hidden="true"></span>`;
}

function _triggerFoodWarning() {
  // Loop 077: {chronicle:false} (076 MEDIUM) — live UI prompt, not realm memory
  notify('⚠️ Food running low! Build more farms!', 'danger', { chronicle: false });
}

function rateStr(val, tooltip) {
  if (val === 0) return '';
  const arrow = val > 0 ? '▲' : '▼';
  const abs = Math.abs(val);
  const tt = tooltip ? ` title="${tooltip}"` : '';
  return ` <span class="rate ${val>0?'pos':'neg'}"${tt}>${arrow}${abs}/day</span>`;
}

if (typeof window !== 'undefined') {
  window.garrisonTower = () => {
    const b = G.selectedBuilding;
    if (!b || b.type !== 'tower') return;
    const res = dispatch({ type: 'GARRISON', x: b.x, y: b.y });
    if (res.ok) notify(`${res.count} soldier${res.count > 1 ? 's' : ''} garrisoned the tower.`, 'info');
    showInfoPanel(b);
  };
  window.ejectGarrison = () => {
    const b = G.selectedBuilding;
    if (!b) return;
    dispatch({ type: 'EJECT_GARRISON', x: b.x, y: b.y });
    notify('Garrison ejected.', 'info');
    showInfoPanel(b);
  };
  window.setArmyStance = (stance) => {
    if (stance === 'rally' && !G.rallyPoint) {
      notify('Plant a rally flag first: shift + right-click on the map.', 'warn');
      return;
    }
    dispatch({ type: 'SET_STANCE', stance });
    notify(`Army stance: ${stance === 'defend' ? '🛡️ Defend' : stance === 'rally' ? '🚩 Rally' : '🧱 Patrol'}`, 'info');
    updateUI();
  };
}

export function updateUI() {
  if (G._refreshPanelFor && G.selectedBuilding === G._refreshPanelFor) {
    const bb = G._refreshPanelFor; G._refreshPanelFor = null;
    showInfoPanel(bb);
  }
  const $ = id => document.getElementById(id);
  const citizenPanel = $('info-panel');
  const panelActorId = Number(citizenPanel?.dataset.citizenActorId);
  if (
    Number.isSafeInteger(panelActorId)
    && panelActorId > 0
    && !buildCurrentCitizenPresentations().some(citizen => citizen.actorId === panelActorId)
  ) {
    hideInfoPanel();
  }

  // Wonder HUD chip: stage + fill percent; click pans to the site.
  const wc = $('wonder-chip');
  if (wc) {
    const wr = G.wonder ? getWonderReport() : null;
    if (!wr || !wr.placed) {
      wc.style.display = 'none';
    } else {
      wc.style.display = 'block';
      if (wr.complete) {
        wc.textContent = '🕍 The Hall of Ages · Eternal';
      } else {
        const totalNeed = wr.bill.reduce((a, x) => a + x.need, 0);
        const totalHave = wr.bill.reduce((a, x) => a + x.have, 0);
        const pct = totalNeed ? Math.round((totalHave / totalNeed) * 100) : 0;
        wc.textContent = `🕍 ${wr.stageName} · ${pct}%`;
      }
    }
  }

  // Compute rates: compare resources to snapshot taken half a day ago
  const interval = Math.floor(G.dayLength / 2);
  if (G.gameTick % interval === 0 && G.gameTick > 0) {
    if (G.lastResources) {
      for (const k of ['wood','stone','food','gold','iron','wheat','flour','planks','tools']) {
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

  const whEl = $('r-wheat'), flEl = $('r-flour');
  if (whEl) {
    whEl.innerHTML = Math.floor(G.resources.wheat || 0) + rateStr(G.resourceRates.wheat || 0);
    const el = whEl.closest('.res');
    if (el) el.style.display = (G.resources.wheat || 0) > 0 || (G.resourceRates.wheat || 0) !== 0 ? '' : 'none';
  }
  if (flEl) {
    flEl.innerHTML = Math.floor(G.resources.flour || 0) + rateStr(G.resourceRates.flour || 0);
    const el = flEl.closest('.res');
    if (el) el.style.display = (G.resources.flour || 0) > 0 || (G.resourceRates.flour || 0) !== 0 ? '' : 'none';
  }

  for (const [key, elId] of [['planks','r-planks'],['tools','r-tools']]) {
    const el = $(elId);
    if (!el) continue;
    el.innerHTML = Math.floor(G.resources[key] || 0) + rateStr(G.resourceRates[key] || 0);
    const chip = el.closest('.res');
    if (chip) chip.style.display = (G.resources[key] || 0) > 0 || (G.resourceRates[key] || 0) !== 0 ? '' : 'none';
  }

  // Hide empty categories that would otherwise show "0" with no meaning on Day 1
  const ironRes = iEl.closest('.res');
  if (ironRes) ironRes.style.display = (G.resources.iron > 0 || (G.resourceRates.iron || 0) !== 0) ? '' : 'none';
  const goldRes = gEl.closest('.res');
  if (goldRes) goldRes.style.display = (G.resources.gold > 0 || (G.resourceRates.gold || 0) !== 0) ? '' : 'none';

  // Dynamic tooltips: show context, not just "what is this resource"
  const foodResEl = fEl.closest('.res');
  if (foodResEl) {
    const daysLeft = G.population > 0 ? Math.floor(G.resources.food / G.population) : 999;
    foodResEl.title = `Food: ${Math.floor(G.resources.food)} — feeds ${G.population} settlers for ~${daysLeft} days`;
  }
  const woodResEl = wEl.closest('.res');
  if (woodResEl) {
    const houses = Math.floor(G.resources.wood / 15);
    woodResEl.title = `Wood: ${Math.floor(G.resources.wood)} — enough for ~${houses} house${houses!==1?'s':''} (15W each)`;
  }
  const stoneResEl = sEl.closest('.res');
  if (stoneResEl) {
    stoneResEl.title = `Stone: ${Math.floor(G.resources.stone)} — unlocks defensive buildings (wall, tower, quarry)`;
  }

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
  const popEl = $('pop-display');
  if (popEl) {
    popEl.innerHTML = `<span class="res-img res-pop" aria-label="Population"></span>${G.population}/${G.maxPop}`;
    if (G.population >= G.maxPop && G.population > 3) popEl.classList.add('pop-full');
    else popEl.classList.remove('pop-full');
    // Explain the denominator. Fresh-eyes readers parse "3/3" as "at cap",
    // which collides with the scenario mission "Reach 10 population (3/10)"
    // — two denominators for the same number. Spell it out live so hover
    // reveals that 3/3 means "3 settlers filling all 3 housing slots",
    // and at cap the tooltip prompts the next step.
    const atCap = G.population >= G.maxPop;
    popEl.title = atCap
      ? `${G.population} settlers filling all ${G.maxPop} housing slots — build a House (+4) to grow. Click to view citizens.`
      : `${G.population} settlers · ${G.maxPop} housing slot${G.maxPop === 1 ? '' : 's'} (room for ${G.maxPop - G.population} more). Click to view citizens.`;
  }
  const maxSoldiers = G.buildings.filter(b => b.type === 'barracks').length * 4 + G.buildings.filter(b => b.type === 'archery').length * 3;
  const soldierEl = $('soldier-count');
  const armyVisible = maxSoldiers > 0 || (G.soldiers || []).length > 0;
  if (soldierEl) {
    soldierEl.textContent = `${(G.soldiers || []).length}/${maxSoldiers}`;
    // Hide soldier counter when no barracks exist and no soldiers — dead UI weight on Day 1
    const soldierRes = soldierEl.closest('.res');
    if (soldierRes) soldierRes.style.display = armyVisible ? '' : 'none';
  }
  const stanceEl = document.getElementById('army-stance');
  if (stanceEl) {
    stanceEl.style.display = armyVisible ? 'flex' : 'none';
    for (const btn of stanceEl.querySelectorAll('.stance-btn')) {
      btn.classList.toggle('active', btn.dataset.stance === G.armyStance);
      btn.classList.toggle('dimmed', btn.dataset.stance === 'rally' && !G.rallyPoint);
    }
  }
  const threatEl = $('threat-display');
  const enemyEl = $('enemy-count');
  if (threatEl && enemyEl) {
    const enemies = (G.enemies || []).length;
    threatEl.style.display = enemies > 0 ? 'flex' : 'none';
    enemyEl.textContent = enemies;
  }
  const season = getSeasonData();
  // DIFFICULTY labels are "🟢 Easy" / "🟡 Normal" / "🔴 Hard" — only the colored
  // dot is shown in the HUD to save space. Wrap it in a title tooltip so a
  // fresh player hovering the orphan dot sees what it actually means; without
  // this it reads as a stray icon dangling after the happiness percent.
  const diffDef = DIFFICULTY[G.difficulty];
  const diffDot = diffDef?.label?.split(' ')[0] || '';
  const diffName = diffDef?.label?.split(' ').slice(1).join(' ') || '';
  const diffLabel = diffDot
    ? `<span title="Difficulty: ${diffName}" aria-label="Difficulty: ${diffName}">${diffDot}</span>`
    : '';
  const raidDays = getRaidCountdown();
  let raidWarn = '';
  if (raidDays) {
    const urgent = raidDays <= 2;
    raidWarn = ` · <span class="${urgent ? 'raid-warn-urgent' : 'raid-warn'}">⚔️${raidDays}d</span>`;
  }
  // Loop 233 (HUD sustained-state display per 211/228/230 filings):
  // when no raid is imminent and the realm has earned a peaceful
  // streak, show ☮️ Nd. Threshold 20 days avoids flicker. Same shape
  // for ‍🕯️ days-since-last-death (threshold 30) — earned via at
  // least one prior raid/death so brand-new realms don't trigger
  // either indicator. Hidden in photo-mode via existing #hud rule.
  let streakHTML = '';
  if (!raidDays && G.stats?.raidsSurvived >= 1 && G.lastRaidDay !== null) {
    const peaceD = G.day - G.lastRaidDay;
    if (peaceD >= 20) streakHTML += ` · <span title="Days since last raid" style="color:#9bcfa9">☮️${peaceD}d</span>`;
  }
  if (G.stats?.citizensDied >= 1 && G.lastDeathDay !== null) {
    const lifeD = G.day - G.lastDeathDay;
    if (lifeD >= 30) streakHTML += ` · <span title="Days since last death" style="color:#bdb09a">🕯️${lifeD}d</span>`;
  }
  const weatherEmoji = G.weather === 'rain' ? ' 🌧️' : G.weather === 'snow' ? ' ❄️' : '';
  const year = Math.floor((G.day - 1) / 28) + 1;
  const dayInYear = ((G.day - 1) % 28) + 1;
  const happyPct = Math.round(G.happiness);
  // Thresholds slightly below the display boundaries so a displayed "50%" shows
  // the 🙂 face (G.happiness often sits at 49.x but rounds to 50% — felt inconsistent)
  const happyEmoji = happyPct >= 70 ? '😊' : happyPct >= 45 ? '🙂' : happyPct >= 20 ? '😐' : '😟';
  const eraInfo = ERAS[(G.era || 1) - 1] || ERAS[0];
  $('day-display').innerHTML = `Year ${year}, Day ${dayInYear} · <span title="The realm's age — grow the town to advance">${eraInfo.icon} ${eraInfo.name}</span> · ${season.name} ${weatherEmoji}· <span title="Settler happiness — affects tax income and population growth">${happyEmoji} ${happyPct}%</span>${raidWarn}${streakHTML} ${diffLabel}`;
  const kd = $('kingdom-display');
  if (kd) kd.textContent = G.kingdomName ? `👑 ${G.kingdomName}` : '';

  // Update affordability classes in place — avoids re-rendering the whole
  // bar every 30 ticks (which was destroying hover tooltips, tearing down
  // the lifted selected-state CSS, and feeling flaky to click)
  if (G.gameTick % 30 === 0) updateBuildBarAffordability();
}

// In-place update: toggles .disabled class + .cost-short spans without
// rebuilding DOM, so hover/selected state stays intact.
function updateBuildBarAffordability() {
  const bar = document.getElementById('build-bar');
  if (!bar) return;
  bar.querySelectorAll('.build-btn').forEach(btn => {
    const key = btn.dataset.buildKey;
    if (!key) return;
    const def = BUILDINGS[key];
    if (!def) return;
    const affordable = canAfford(key);
    btn.classList.toggle('disabled', !affordable);
    // Update each cost span's short class without rewriting the button text
    const spans = btn.querySelectorAll('.cost > span');
    let i = 0;
    for (const [k, v] of Object.entries(def.cost)) {
      const span = spans[i++];
      if (!span) continue;
      const have = G.resources[k] || 0;
      const short = have < v;
      const close = short && have >= v * 0.6;
      span.classList.toggle('cost-short', short && !close);
      span.classList.toggle('cost-close', close);
    }
    // Toggle lock badge visibility
    const lock = btn.querySelector('.build-lock');
    if (!affordable && !lock) {
      const lockEl = document.createElement('span');
      lockEl.className = 'build-lock';
      lockEl.setAttribute('aria-label', 'Cannot afford');
      lockEl.textContent = '🔒';
      btn.insertBefore(lockEl, btn.firstChild);
    } else if (affordable && lock) {
      lock.remove();
    }
  });
}

const CATEGORIES = [
  { name: 'Housing',        keys: ['house'] },
  { name: 'Production',     keys: ['farm', 'lumber', 'quarry', 'mine', 'windmill', 'bakery', 'chickencoop', 'cowpen', 'fisherman'] },
  { name: 'Economy',        keys: ['market', 'tradingpost', 'school'] },
  { name: 'Defense',        keys: ['barracks', 'archery', 'tower', 'wall', 'blacksmith'] },
  { name: 'Infrastructure', keys: ['road', 'well', 'granary', 'storehouse'] },
  { name: 'Culture',        keys: ['tavern', 'church', 'townhall'] },  // 243: townhall in Culture; gated by mayor presence in isBuildingUnlocked
  { name: 'Victory',        keys: ['castle', 'wonder'] },
];

// Tracks the 1-indexed order of buttons the player actually sees in the build
// bar (category-grouped, unlocked-filtered). Rebuilt on each renderBuildBar.
// Used both to stamp the "N" shortcut badge and by the keydown handler below
// so pressing "4" selects the 4th visible button — not BUILDINGS[3], which on
// Day 1 is `quarry` (locked, not on the bar). Keeping this in module scope
// lets one source of truth drive both the badge and the hotkey.
let _visibleBuildKeys = [];

export function renderBuildBar() {
  const bar = document.getElementById('build-bar');
  if (!bar) return;
  bar.innerHTML = '';
  _visibleBuildKeys = [];
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
      btn.dataset.buildKey = key;
      // Affordance gradient: red when short, amber when close (have >= 60% of cost
      // but below), normal when flush. Gives the player at-a-glance "close to
      // affording" tension rather than a binary can/can't.
      const costStr = Object.entries(def.cost).map(([k,v]) => {
        const have = G.resources[k] || 0;
        let cls = '';
        if (have < v) cls = have >= v * 0.6 ? 'cost-close' : 'cost-short';
        return `<span class="${cls}">${v}${k[0].toUpperCase()}</span>`;
      }).join(' ');
      // Show terrain requirement if applicable
      const terrainReq = def.on ? def.on.map(t => terrainNames[t] || '?').join('/') : null;
      const terrainTag = terrainReq ? `<span class="cost terrain">⬡ ${terrainReq}</span>` : '';
      // Keyboard shortcut number = position in the visible build bar, not the
      // BUILDINGS declaration index. Previously badges used declaration order,
      // which left Fisherman's Hut (index 21) and Granary (index 14) with no
      // badge at all on Day 1, and made pressing "4" select `quarry` (locked).
      _visibleBuildKeys.push(key);
      const shortcutNum = _visibleBuildKeys.length;
      const shortcutBadge = shortcutNum <= 9 ? `<span class="build-btn-shortcut">${shortcutNum}</span>` : '';
      // Count of existing buildings of this type
      const count = G.buildings.filter(b => b.type === key).length;
      const countBadge = count > 0 ? `<span class="build-count">${count}</span>` : '';
      // Lock badge on unaffordable buildings — secondary signal for colorblind players
      const lockBadge = !affordable ? `<span class="build-lock" aria-label="Cannot afford">🔒</span>` : '';
      const iconHtml = buildAtlasIcon(key) || `<span class="build-emoji">${def.icon}</span>`;
      btn.innerHTML = `${shortcutBadge}${lockBadge}${iconHtml}<span class="build-name">${def.name}</span>${countBadge}<span class="cost">${costStr}</span>${terrainTag}`;
      btn.onclick = () => {
        // Always select on click — don't toggle off when clicking the same
        // button again (that was causing "House button doesn't work" confusion
        // after placing a building, since selectedBuild was still 'house').
        // Deselect via Escape key or by clicking the build bar category label.
        G.selectedBuild = key;
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

// Capture-phase hotkey handler for number keys 1-9 — preempts input.js's
// declaration-order handler so digits map to the buttons the player actually
// sees. input.js still handles every other key; we only intercept 1-9 and
// stopPropagation so the declaration-order fallback doesn't also fire.
// Attach once at module load.
if (typeof window !== 'undefined' && !window._buildBarHotkeyBound) {
  window._buildBarHotkeyBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.key < '1' || e.key > '9') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Ignore when the user is typing in a text field (kingdom name input etc.)
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const idx = parseInt(e.key, 10) - 1;
    if (idx >= _visibleBuildKeys.length) return;
    e.stopPropagation();
    const pick = _visibleBuildKeys[idx];
    G.selectedBuild = G.selectedBuild === pick ? null : pick;
    G.selectedBuilding = null;
    renderBuildBar();
  }, { capture: true });
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

  // ── Cost icons: shared map covers planks/tools; gold keeps its coin glyph ──
  const resEmoji = (k) => k === 'gold' ? '<span class="gold-coin" aria-label="gold">◉</span>' : resourceEmoji(k);

  // ── Era progress: where the realm stands, what advances it ──
  const eraInfo = ERAS[(G.era || 1) - 1] || ERAS[0];
  const nextEra = ERAS[G.era];  // era ids are 1-based, so ERAS[G.era] is the NEXT age
  const checklist = getEraProgress();
  const eraDiv = document.createElement('div');
  eraDiv.className = 'era-progress';
  if (checklist && nextEra) {
    eraDiv.innerHTML = `
      <div class="era-progress-head">
        <span>${eraInfo.icon} ${eraInfo.name}</span>
        <span class="era-next">next: ${nextEra.icon} ${nextEra.name}</span>
      </div>
      <div class="era-chips">${checklist.map(g =>
        `<span class="era-chip ${g.done ? 'done' : ''}">${g.done ? '✓' : '○'} ${g.label}${g.goal > 1 ? ` ${g.cur}/${g.goal}` : ''}</span>`
      ).join('')}</div>`;
  } else {
    eraDiv.innerHTML = `
      <div class="era-progress-head">
        <span>${eraInfo.icon} ${eraInfo.name}</span>
        <span class="era-next">the final age</span>
      </div>`;
  }
  content.appendChild(eraDiv);

  // ── Organise techs into the three ages (tech.era) ────────
  const allIds = Object.keys(TECHS);
  const NUMERALS = ['I', 'II', 'III'];
  const groups = ERAS.map((era, i) => ({
    era,
    label: `${NUMERALS[i]} · ${era.name}`,
    ids: allIds.filter(id => (TECHS[id].era || 1) === era.id),
  })).filter(g => g.ids.length > 0);

  // ── Render each age group ────────────────────────────────
  for (let t = 0; t < groups.length; t++) {
    const tierIds = groups[t].ids;

    // Connector lines between tiers (not before first)
    if (t > 0) {
      const conn = document.createElement('div');
      conn.className = 'tech-connector';
      content.appendChild(conn);
    }

    const tierSection = document.createElement('div');
    tierSection.className = 'tech-tier';

    const reached = groups[t].era.id <= (G.era || 1);
    const tierLabel = document.createElement('div');
    tierLabel.className = 'tech-tier-label' + (reached ? '' : ' era-locked');
    tierLabel.textContent = groups[t].label + (reached ? '' : ' 🔒');
    tierSection.appendChild(tierLabel);

    const row = document.createElement('div');
    row.className = 'tech-row';

    for (const id of tierIds) {
      const tech = TECHS[id];
      const researched = G.researchedTechs.has(id);
      const available = canResearch(id);
      const prereqMet = !tech.prereq || G.researchedTechs.has(tech.prereq);
      const eraLocked = (tech.era || 1) > (G.era || 1);
      const isActive = G.currentResearch?.techId === id;

      // Card state classes
      let cardClass = 'tech-card';
      if (researched)    cardClass += ' done';
      else if (isActive) cardClass += ' active';
      else if (!prereqMet || eraLocked) cardClass += ' locked';
      else if (available)  cardClass += ' available';

      // Cost string
      const costEntries = Object.entries(tech.cost).filter(([,v]) => v > 0);
      const costStr = costEntries.length
        ? costEntries.map(([k, v]) => `${resEmoji(k)} ${v}`).join('  ')
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
          : eraLocked && !researched
            ? `<div class="tc-prereq-note">⏳ Requires the ${ERAS[(tech.era || 1) - 1].icon} ${ERAS[(tech.era || 1) - 1].name}</div>`
            : ''}`;

      // Research button
      if (available && !isActive) {
        const btn = document.createElement('button');
        btn.className = 'tech-btn';
        btn.textContent = 'Research';
        btn.onclick = () => { dispatch({ type: 'START_RESEARCH', tech: id }); renderResearchPanel(); renderBuildBar(); };
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
  // 'flex' preserves the CSS display:flex column so .research-content's
  // flex:1 + min-height:0 can actually constrain and scroll the list.
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) {
    renderResearchPanel();
    // Loop 042 (the-fixer, closing 040 HIGH): wire the scroll-cue so a
    // late-game player with 13 researched techs sees a "more below"
    // gradient at the bottom of the panel. Without this, 5 of 13 techs
    // clip off-screen at 1280×627 with no indicator.
    _wireScrollCue(panel);
  }
}

// Loop 042: toggles body.has-more-below class on a panel element based
// on the scroll state of its inner .research-content child. Re-runs on
// scroll (to clear when user reaches bottom) and on initial open.
function _wireScrollCue(panel) {
  const c = panel.querySelector('.research-content');
  if (!c) return;
  const update = () => {
    const atBottom = c.scrollTop + c.clientHeight >= c.scrollHeight - 4;
    const canScroll = c.scrollHeight > c.clientHeight;
    panel.classList.toggle('has-more-below', canScroll && !atBottom);
  };
  if (!c._scrollCueWired) {
    c.addEventListener('scroll', update, { passive: true });
    c._scrollCueWired = true;
  }
  // Initial check — use rAF so layout has settled after renderResearchPanel.
  requestAnimationFrame(update);
}

export function showInfoPanel(b) {
  const def = BUILDINGS[b.type];
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  delete panel.dataset.citizenActorId;

  const workerCount = def.workers || 0;
  const level = b.level;

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
  const buildProgress = Math.max(0, Math.min(1, b.buildProgress));

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

  // Under construction: show the site as a PROJECT — progress, crew,
  // and a nudge when nobody has picked up the job yet.
  if (buildProgress < 1) {
    const capacity = citizenStaffingCapacity(b);
    const crew = capacity > 0
      ? buildCurrentCitizenPresentations().filter(citizen => (
          citizen.assignment?.building.x === b.x
          && citizen.assignment.building.y === b.y
        ))
      : [];
    const crewNames = crew.map(worker => escapeHtml(worker.identity.name)).join(', ');
    html += `
      <div class="ip-desc">🔨 Under construction</div>
      <div class="ip-row"><span class="ip-label">Progress</span><span class="ip-val">${Math.round(buildProgress * 100)}%</span></div>
      ${capacity > 0
        ? `<div class="ip-row"><span class="ip-label">Crew</span><span class="ip-val">${crew.length}/${capacity}${crewNames ? ' — ' + crewNames : ''}</span></div>`
        : '<div class="ip-row"><span class="ip-label">Crew</span><span class="ip-val">Realm-laid infrastructure</span></div>'}
      ${capacity > 0 && crew.length === 0 ? '<div class="ip-hint">Idle site — free citizens will take the builder job soon.</div>' : ''}
    `;
    panel.innerHTML = html + `<div class="ip-hint">Right-click to cancel and refund half.</div>`;
    panel.style.display = 'block';
    requestAnimationFrame(() => panel.classList.add('ip-visible'));
    return;
  }

  // Description
  if (def.desc) {
    html += `<div class="ip-desc">${def.desc}</div>`;
  }
  // Lore tooltip (flavor text)
  const LORE = {
    house: '"Four walls and a fire make a world of difference to the weary traveler."',
    farm: '"Tend the land and it will tend you. Forget it, and the winter is unforgiving."',
    lumber: '"Every great realm was first built from timber."',
    quarry: '"Stone remembers. Each block carries the mountain\'s patience."',
    mine: '"Iron is the backbone of empire — and the bane of those who delve too deep."',
    market: '"Where coin flows, people follow. Where people gather, history happens."',
    barracks: '"The peace of the realm is kept by those who practice for war."',
    tower: '"From here, the watchmen see what others cannot: the future."',
    well: '"Sweet water is worth more than gold to parched lips."',
    tavern: '"More treaties are signed in taverns than in throne rooms."',
    wall: '"A wall is not just stone. It is the line between our world and theirs."',
    road: '"All roads lead somewhere worth going, or we wouldn\'t have built them."',
    tradingpost: '"The sea remembers every ship, and rewards the bold."',
    castle: '"When the castle stands, the realm is eternal."',
    granary: '"A full granary is the difference between a bad season and a dead one."',
    church: '"The bells call to something older than any kingdom."',
    school: '"Knowledge doubles every generation — if we bother to teach it."',
    windmill: '"It catches the invisible and turns it into bread."',
    bakery: '"The smell of fresh bread has ended more arguments than any sword."',
    chickencoop: '"Humble creatures, but their eggs have fed kings."',
    cowpen: '"Patient beasts who turn grass into sustenance."',
    fisherman: '"The sea gives freely to those patient enough to ask."',
    blacksmith: '"Every sword begins as a lump of ore and a question: who will wield it?"',
    sawmill: '"The saw sings all day, and the realm rises plank by plank."',
    archery: '"The arrow knows no rank. It finds the careless and the brave alike."',
    wonder: '"Ages end. The Hall does not."',
  };
  if (LORE[b.type]) {
    html += `<div class="ip-lore">${LORE[b.type]}</div>`;
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
  if (buildProgress < 1) {
    const pct = Math.round(buildProgress * 100);
    html += `
    <div class="ip-row">
      <span class="ip-label">Status</span>
      <span class="ip-hpbar">
        <span class="ip-hpfill" style="width:${pct}%;background:#d6a864"></span>
      </span>
      <span class="ip-hpval">${pct}%</span>
    </div>`;
  }

  if (workerCount > 0) {
    const staffed = staffingCount(b);
    const workerDots = '●'.repeat(staffed) + '○'.repeat(workerCount - staffed);
    html += `<div class="ip-row"><span class="ip-label">Workers</span><span class="ip-val">${workerDots} ${staffed}/${workerCount}</span></div>`;
  }

  // Wonder stage card: bill bars, delivery pace, next housing gate (wonder.js)
  if (b.type === 'wonder') {
    const wr = getWonderReport();
    if (wr && wr.complete) {
      html += `<div class="ip-row"><span class="ip-label">Wonder</span><span class="ip-val" style="color:var(--gold)">✦ Eternal — crowned day ${G.wonder?.completeDay ?? '—'}</span></div>`;
    } else if (wr) {
      html += `<div class="ip-row"><span class="ip-label">Stage</span><span class="ip-val">${wr.stage + 1}/3 · ${wr.stageName}</span></div>`;
      for (const item of wr.bill) {
        const pct = Math.round((item.have / item.need) * 100);
        html += `
    <div class="ip-row">
      <span class="ip-label">${resourceEmoji(item.res)}</span>
      <span class="ip-hpbar"><span class="ip-hpfill" style="width:${pct}%;background:#d6a864"></span></span>
      <span class="ip-hpval">${item.have}/${item.need}</span>
    </div>`;
      }
      if (wr.gate) {
        html += `<div class="ip-row"><span class="ip-label">Gate</span><span class="ip-val" style="color:#f0b429">⏳ ${wr.gate}</span></div>`;
      }
    }
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
    if (levelMult > 1) {
      html += `<div class="ip-row"><span class="ip-label">Upgrade</span><span class="ip-val ip-happy">×${levelMult} production</span></div>`;
    }
  }

  // Production chain status (converters: windmill, bakery, sawmill, blacksmith)
  if (def.convert) {
    const from = def.convert.from, to = def.convert.to;
    const inStock = Math.floor(G.resources[from] || 0);
    const outStock = Math.floor(G.resources[to] || 0);
    const outAtCap = def.convert.cap && outStock >= def.convert.cap;
    const understaffed = (def.workers || 0) > 0 && staffingCount(b) < def.workers;
    let status, cls;
    if (buildProgress < 1) { status = 'Under construction'; cls = ''; }
    else if (understaffed) { status = 'Needs a worker to run'; cls = 'ip-defense'; }
    else if (outAtCap) { status = `${to} store full — build something that uses it`; cls = 'ip-defense'; }
    else if (inStock <= 0) { status = `No ${from} in store — build upstream supply`; cls = 'ip-defense'; }
    else { status = `Converting ${from} into ${to}`; cls = 'ip-happy'; }
    html += `<div class="ip-row"><span class="ip-label">Chain</span><span class="ip-val">${resourceEmoji(from)} ${inStock} → ${resourceEmoji(to)} ${outStock}${def.convert.cap ? '/' + def.convert.cap : ''}</span></div>`;
    html += `<div class="ip-row"><span class="ip-label">Status</span><span class="ip-val ${cls}">${status}</span></div>`;
  }

  // Tool boost indicator for producing buildings
  if (def.prod && Object.keys(def.prod).length && !def.convert && (def.workers || 0) > 0) {
    const toolStock = Math.floor(G.resources.tools || 0);
    if (toolStock > 0) {
      html += `<div class="ip-row"><span class="ip-label">Tools</span><span class="ip-val ip-happy">🛠️ +50% output every 4th cycle (${toolStock} in store)</span></div>`;
    } else if (G.buildings.some(bb => bb.type === 'blacksmith' && bb.active)) {
      html += `<div class="ip-row"><span class="ip-label">Tools</span><span class="ip-val">No tools in store — give the blacksmith iron</span></div>`;
    }
  }

  // Defense
  if (def.defense) {
    html += `<div class="ip-row"><span class="ip-label">Defense</span><span class="ip-val ip-defense">🛡 +${def.defense}</span></div>`;
  }

  // Tower garrison — selection-free military depth: a manned tower shoots
  // roughly twice as fast and a third further.
  if (b.type === 'tower' && buildProgress >= 1) {
    const occ = G.soldiers.filter(s => s.garrison === b);
    const idle = G.soldiers.filter(s => !s.garrison).length;
    html += `<div class="ip-row"><span class="ip-label">Garrison</span><span class="ip-val">${occ.length ? '🛡️'.repeat(occ.length) + ` ${occ.length}/2 — +3 range, faster volleys` : 'Unmanned'}</span></div>`;
    if (occ.length < 2 && idle > 0) {
      html += `<button class="upgrade-btn" onclick="window.garrisonTower&&window.garrisonTower()">🛡️ Garrison ${Math.min(2 - occ.length, idle)} nearest soldier${Math.min(2 - occ.length, idle) > 1 ? 's' : ''}</button>`;
    }
    if (occ.length > 0) {
      html += `<button class="upgrade-btn" style="background:#5a4632;border-color:#7a5f42" onclick="window.ejectGarrison&&window.ejectGarrison()">↩ Eject garrison</button>`;
    }
  }

  // Housing
  if (b.type === 'house') {
    const report = getHouseTierReport(b);
    html += `<div class="ip-row"><span class="ip-label">Tier</span><span class="ip-val">🏠 ${report.tier.name} — ${report.tierIdx + 1}/${HOUSE_TIERS.length} · houses ${report.tier.cap} · tax ×${report.tier.taxMult}</span></div>`;
    if (report.next) {
      const checks = report.nextReport.checks
        .map(c => `${c.ok ? '✓' : '✗'} ${c.label}`)
        .join(' · ');
      const cost = report.next.evolveCost
        ? ' · needs ' + Object.entries(report.next.evolveCost).map(([k, v]) => `${v} ${k}`).join(', ')
        : '';
      const cls = report.nextReport.pass && report.costOk ? 'ip-happy' : '';
      html += `<div class="ip-row"><span class="ip-label">Next</span><span class="ip-val ${cls}">${report.next.name}: ${checks}${cost}</span></div>`;
    } else {
      html += `<div class="ip-row"><span class="ip-label">Next</span><span class="ip-val ip-happy">Fully evolved — the pride of the realm</span></div>`;
    }
  } else if (def.pop) {
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
      if (dispatch({ type: 'UPGRADE', x: b.x, y: b.y }).ok) showInfoPanel(b);
    };
    panel.appendChild(btn);
  }
}

export function hideInfoPanel() {
  const panel = document.getElementById('info-panel');
  if (panel) {
    delete panel.dataset.citizenActorId;
    panel.style.display = 'none';
    panel.classList.remove('ip-visible');
  }
}

function showTooltip(anchor, key, def) {
  const tt = document.getElementById('tooltip');
  if (!tt) return;

  tt.querySelector('.tt-title').textContent = `${def.icon} ${def.name}`;

  const lines = [];

  // Keyboard shortcut
  const allKeys = Object.keys(BUILDINGS);
  const shortcutIdx = allKeys.indexOf(key) + 1;
  if (shortcutIdx >= 1 && shortcutIdx <= 9) {
    lines.push(`<span class="tt-row tt-shortcut"><span class="tt-lbl">Hotkey</span> <kbd>${shortcutIdx}</kbd></span>`);
  }

  // Description
  if (def.desc) lines.push(`<span class="tt-desc">${def.desc}</span>`);

  // Cost breakdown with emoji icons
  const resEmoji = { wood:'🪵', stone:'🪨', food:'🍎', gold:'<span class="gold-coin" aria-label="gold">◉</span>', iron:'⚙️' };
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

  // Building bonuses — service buildings with radius only cover nearby houses
  const houses = G.buildings.filter(b => BUILDINGS[b.type].pop);
  const totalHouses = houses.length;
  const bContribs = {}; // type -> total happiness contribution
  for (const b of G.buildings) {
    const def = BUILDINGS[b.type];
    if (!def.happiness) continue;
    let bonus;
    if (def.radius && totalHouses > 0) {
      // Count houses within radius; scale bonus by coverage fraction
      const covered = houses.filter(h => Math.hypot(h.x - b.x, h.y - b.y) <= def.radius).length;
      bonus = def.happiness * (covered / totalHouses);
    } else {
      bonus = def.happiness;
    }
    bContribs[b.type] = (bContribs[b.type] || 0) + bonus;
  }
  for (const [type, contrib] of Object.entries(bContribs)) {
    const def = BUILDINGS[type];
    const count = G.buildings.filter(b => b.type === type).length;
    const rounded = Math.round(contrib * 10) / 10;
    factors.push({ label: `${def.icon} ${def.name} ×${count}`, val: rounded, category: 'building' });
  }

  // Negative modifiers
  const excess = Math.max(0, G.population - G.maxPop);
  if (excess > 0) factors.push({ label: `😰 Overcrowding (${excess} homeless)`, val: -excess * 5, category: 'penalty' });
  if (G.resources.food <= 0) factors.push({ label: '💀 Starvation (no food)', val: -10, category: 'penalty' });
  if (G.resources.food > 0 && G.resources.food < G.population) {
    factors.push({ label: '🍎 Food shortage', val: -3, category: 'penalty' });
  }

  // Citizen mood (Phase 3b) — bounded aggregate of needs/rest/hunger
  if (G._moodDelta !== undefined && G._moodDelta !== 0) {
    const face = G._moodDelta > 0 ? '😊' : '😞';
    factors.push({ label: `${face} Citizen mood`, val: G._moodDelta, category: G._moodDelta > 0 ? 'building' : 'penalty' });
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

  // Housing tier census — the growth ladder at a glance
  {
    const census = [0, 0, 0, 0];
    for (const b of G.buildings) if (b.type === 'house') census[Math.min(4, b.level) - 1]++;
    if (census.some(n => n > 0)) {
      const line = HOUSE_TIERS.map((t, i) => census[i] ? `${census[i]} ${t.name}` : null).filter(Boolean).join(' · ');
      html += `<div class="hp-row"><span class="hp-label">🏘️ Housing</span><span class="hp-val">${line}</span></div>`;
    }
  }

  // Roadmap: show buildings with happiness bonuses that the player hasn't built yet
  // Gives the player a concrete path from 50% → 80%
  const builtTypes = new Set(G.buildings.map(b => b.type));
  const happinessBuildings = Object.entries(BUILDINGS)
    .filter(([k, def]) => def.happiness && def.happiness > 0 && !builtTypes.has(k))
    .sort((a, b) => b[1].happiness - a[1].happiness)
    .slice(0, 5);
  if (happinessBuildings.length > 0) {
    html += `<div class="hp-section-title hp-section-roadmap">Ways to Raise Happiness</div>`;
    html += happinessBuildings.map(([, def]) =>
      `<div class="hp-row hp-row-muted"><span class="hp-label">${def.icon} Build a ${def.name}</span><span class="hp-val pot">+${def.happiness}</span></div>`
    ).join('');
  }

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
    // Target the specific building by data-build-key — `.build-btn` alone matches
    // all build buttons and querySelector returns the first (House), so the
    // pulsing tutorial highlight was landing on the wrong card and actively
    // misdirecting new players ("select Farm" with the House button glowing).
    highlight: '[data-build-key="farm"]',
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
    highlight: '[data-build-key="lumber"]',
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
    id: 'build_house',
    text: '🏠 Build a House to grow your population! More citizens = more workers for buildings.',
    action: 'Select House and place on grass',
    check: () => G.buildings.some(b => b.type === 'house'),
    highlight: '[data-build-key="house"]',
  },
  {
    id: 'tip_hotkeys',
    text: '⌨️ Tip: Press 1-9 to quick-select buildings. Ctrl+Z to undo. Space to cycle speed. ? for all hotkeys.',
    action: '',
    check: () => G.day >= 2,
  },
  {
    id: 'done',
    text: '🎉 You\'re on your own now! Build, research, trade, and survive. Raids come on Day 8. Open the 📖 Chronicle to read your story!',
    action: '',
    check: () => G.gameTick > 99999, // stays until dismissed
  },
];

let tutorialStep = 0;
let tutorialDismissed = false;

export function updateTutorialTip() {
  // Auto-dismiss if player is already past the tutorial.
  // Loop 49 (render S4): added day and population thresholds. Earlier
  // dismissal was ONLY buildings>=4, so a player with 11 citizens,
  // a barracks, and a house on Day 7 still saw "Select Farm from the
  // build bar ↓" — absurd.
  if (!tutorialDismissed) {
    if (G.buildings.length >= 4) { dismissTutorial(); return; }
    if (G.day >= 6 && G.buildings.length >= 2) { dismissTutorial(); return; }
    if (G.population >= 8) { dismissTutorial(); return; }
  }

  const tipEl = document.getElementById('tutorial-tip');
  if (!tipEl) return;
  if (tutorialDismissed || tutorialStep >= TUTORIAL_STEPS.length) {
    tipEl.style.display = 'none';
    return;
  }

  // Loop 22 (render S3): skip-ahead logic. The prior check advanced exactly
  // one step per tick, so if a player built a farm via hotkey faster than the
  // check could observe selectedBuild='farm', the tutorial would stall on
  // "Select Farm" even though a farm was visibly placed. Now walk forward
  // while any later step's check is already satisfied.
  try {
    while (tutorialStep < TUTORIAL_STEPS.length) {
      const s = TUTORIAL_STEPS[tutorialStep];
      if (!s.check()) break;
      if (s.id === 'done') { dismissTutorial(); return; }
      tutorialStep++;
    }
    if (tutorialStep >= TUTORIAL_STEPS.length) { tipEl.style.display = 'none'; return; }
  } catch {}

  const current = TUTORIAL_STEPS[Math.min(tutorialStep, TUTORIAL_STEPS.length - 1)];
  tipEl.innerHTML = `
    <div class="tut-text">${current.text}</div>
    ${current.action ? `<div class="tut-action">${current.action}</div>` : ''}
    <div class="tut-progress">Step ${tutorialStep + 1} of ${TUTORIAL_STEPS.length}</div>
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
    needs_delivery:'Waiting for storage', foraging:'Foraging', eating:'Eating',
    go_home:'Going home', sleep:'Sleeping', leisure:'At leisure' };
  const snapshots = buildCurrentCitizenPresentations();

  // Classify citizens
  const isHungry = c => c.hunger >= 70;
  const isWorking = c => c.assignment && !isHungry(c) &&
    ['working','walk_to_work','walk_to_deliver','deliver'].includes(c.activity.kind);
  const getGroup = c => isHungry(c) ? 2 : isWorking(c) ? 0 : 1;

  // Sort: working first (0), idle (1), hungry (2); within group alphabetically
  const sorted = [...snapshots].sort((a, b) => {
    const ga = getGroup(a), gb = getGroup(b);
    return ga !== gb ? ga - gb : a.identity.name.localeCompare(b.identity.name) || a.actorId - b.actorId;
  });

  // Summary counts
  const workingCount = snapshots.filter(isWorking).length;
  const hungryCount = snapshots.filter(isHungry).length;
  const idleCount = snapshots.length - workingCount - hungryCount;

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
  hdr.innerHTML = `<span>Name</span><span>Vocation</span><span>Current task</span><span>Hunger</span><span></span>`;
  el.appendChild(hdr);

  const understaffed = G.buildings.filter(b => {
    const def = BUILDINGS[b.type];
    const capacity = citizenStaffingCapacity(b);
    return def && capacity > 0 && staffingCount(b) < capacity;
  });
  const hasUnderstaffed = understaffed.length > 0;

  let lastGroup = -1;
  for (const c of sorted) {
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

    const profession = c.profession.kind[0].toUpperCase() + c.profession.kind.slice(1);
    const assignment = c.assignment;
    const buildingDef = assignment ? BUILDINGS[assignment.building.type] : null;
    const buildingName = assignment ? (buildingDef?.name || assignment.building.type) : null;
    const state = stateLabel[c.activity.kind] || c.activity.kind;
    const task = assignment
      ? `${assignment.purpose === 'temporary' ? 'Helping' : 'Assigned'}: ${assignment.building.complete ? buildingName : `build ${buildingName}`} · ${state}`
      : state;
    const activityTitle = assignment
      ? `${assignment.purpose} · ${assignment.duty} · ${assignment.reason}`
      : c.activity.reason;
    const hungerBar = Math.round(c.hunger);
    const stateColor = group === 0 ? 'var(--food)' : group === 2 ? 'var(--danger)' : 'var(--gold)';
    const div = document.createElement('div');
    div.className = 'pop-row';
    div.style.borderLeft = `3px solid ${stateColor}`;
    div.innerHTML = `
      <span class="pop-name">${escapeHtml(c.identity.name)}</span>
      <span class="pop-job">${escapeHtml(profession)}</span>
      <span class="pop-state" style="color:${stateColor}" title="${escapeHtml(activityTitle)}">${escapeHtml(task)}</span>
      <span class="pop-hunger" title="Hunger ${hungerBar}%">
        <span class="pop-hunger-bar" style="width:${hungerBar}%;background:${hungerBar>70?'var(--danger)':hungerBar>40?'var(--gold)':'var(--food)'}"></span>
      </span>
      ${assignment ? `<button class="pop-unassign" title="Release assignment" data-actor-id="${c.actorId}">✕</button>` : '<span></span>'}
      ${!assignment && hasUnderstaffed ? `<select class="pop-assign" data-actor-id="${c.actorId}"><option value="">Assign to...</option></select>` : ''}`;
    el.appendChild(div);
  }

  // Unassign buttons
  el.querySelectorAll('.pop-unassign').forEach(btn => {
    btn.onclick = () => {
      const actorId = Number(btn.dataset.actorId);
      const result = dispatch({ type: 'RELEASE_CITIZEN', actorId });
      if (!result.ok) notify('That citizen assignment could not be released.', 'danger', { chronicle: false });
      renderPopPanel();
    };
  });

  // Assignment dropdowns — populate with understaffed buildings
  el.querySelectorAll('.pop-assign').forEach(sel => {
    for (const b of understaffed) {
      const def = BUILDINGS[b.type];
      const opt = document.createElement('option');
      opt.value = `${b.x},${b.y}`;
      const capacity = citizenStaffingCapacity(b);
      opt.textContent = `${def.icon} ${b.buildProgress < 1 ? `Help build ${def.name}` : def.name} (${staffingCount(b)}/${capacity})`;
      sel.appendChild(opt);
    }
    sel.onchange = () => {
      if (!sel.value) return;
      const actorId = Number(sel.dataset.actorId);
      const [x, y] = sel.value.split(',').map(Number);
      const result = dispatch({ type: 'ASSIGN_CITIZEN', actorId, x, y });
      if (!result.ok) notify('That work assignment is no longer available.', 'danger', { chronicle: false });
      renderPopPanel();
    };
  });

  // Understaffed buildings list
  if (understaffed.length > 0) {
    const sec = document.createElement('div');
    sec.className = 'pop-section';
    sec.innerHTML = `<div class="pop-section-title">⚠️ Understaffed Buildings</div>`;
    for (const b of understaffed) {
      const def = BUILDINGS[b.type];
      const capacity = citizenStaffingCapacity(b);
      const div = document.createElement('div');
      div.className = 'pop-understaffed';
      div.innerHTML = `<span>${def.icon} ${def.name} — ${staffingCount(b)}/${capacity} workers</span>`;
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

// ── Stats panel ───────────────────────────────────────────
export function renderStatsPanel() {
  const c = document.getElementById('stats-content');
  if (!c) return;
  const s = G.stats || {};
  // Days Lived should reflect the current in-game day, not a separately tracked counter that starts at 0
  const daysLived = Math.max(s.daysLived || 0, G.day || 1);
  const pop = G.population || 0;
  const buildingsStanding = G.buildings?.length || 0;
  c.innerHTML = `
    <div class="stat-group-label">Current</div>
    <div class="stat-row"><span>Day</span><span>${daysLived}</span></div>
    <div class="stat-row"><span>Population</span><span>${pop}</span></div>
    <div class="stat-row"><span>Buildings Standing</span><span>${buildingsStanding}</span></div>
    <div class="stat-group-label">Totals</div>
    <div class="stat-row"><span>Buildings Built</span><span>${s.buildingsBuilt || 0}</span></div>
    <div class="stat-row"><span>Buildings Lost</span><span>${s.buildingsLost || 0}</span></div>
    <div class="stat-row"><span>Citizens Born</span><span>${s.citizensBorn || 0}</span></div>
    <div class="stat-row"><span>Raids Survived</span><span>${s.raidsSurvived || 0}</span></div>
    <div class="stat-row"><span>Enemies Defeated</span><span>${s.enemiesKilled || 0}</span></div>
    <div class="stat-row"><span>Gold Earned</span><span>${s.goldEarned || 0} <span class="gold-coin" aria-hidden="true">◉</span></span></div>
    <div class="stat-group-label">Legacy</div>
    <div class="stat-row"><span>Prestige</span><span>👑 ${computePrestige()}</span></div>
    <div class="stat-row"><span>Best Across Realms</span><span>${Math.max(prestigeBest(), 0)}</span></div>
  `;
}

export function toggleStatsPanel() {
  const p = document.getElementById('stats-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderStatsPanel();
}

// Wonder HUD chip click target (index.html onclick).
window.panToWonder = () => {
  const site = G.buildings.find(b => b.type === 'wonder');
  if (site) panCameraTo(site.x, site.y);
};

// ── Trade panel ───────────────────────────────────────────
export function renderTradePanel() {
  const c = document.getElementById('trade-content');
  if (!c) return;
  c.innerHTML = '';
  const hasTP = G.buildings.some(b => b.type === 'tradingpost');
  if (!hasTP) {
    const hasCommerce = G.researchedTechs && G.researchedTechs.has('commerce');
    const nextStep = hasCommerce
      ? 'Build a <strong>Trading Post</strong> to unlock trade partners.'
      : 'Research <strong>Commerce</strong>, then build a Trading Post to unlock trade partners.';
    c.innerHTML = `<div class="trade-empty">
      <div class="trade-empty-title">🛒 Merchant Caravans</div>
      <div class="trade-empty-pitch">Trade wood, stone, food, or iron for gold — and gold for any resource you lack. Essential for building an economy that isn't bottlenecked on raw materials.</div>
      <div class="trade-empty-step">${nextStep}</div>
    </div>`;
    return;
  }
  const emojis = { wood:'🪵', stone:'🪨', food:'🍎', gold:'🪙', iron:'⚙️' };
  for (const p of TRADE_PARTNERS) {
    const card = document.createElement('div');
    card.className = 'trade-card';
    card.innerHTML = `
      <div class="trade-name">${p.name}</div>
      <div class="trade-offer">Give 10 ${emojis[p.import]} → Get ${Math.round(10 * p.rate)} ${emojis[p.export]}</div>
      <button class="trade-btn" onclick="doTrade('${p.id}','${p.import}',10)">Trade</button>
    `;
    c.appendChild(card);
  }
}

export function toggleTradePanel() {
  const p = document.getElementById('trade-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderTradePanel();
}

// ════════════════════════════════════════════════════════════
// Shell-side render functions moved out of core files (ENGINE.md
// Phase 2): victory screen + confetti (was economy.js), event
// banner (was events.js), missions panel (was missions.js), era
// banner (was tech.js). Core emits bus events; main.js subscribes
// and calls these.
// ════════════════════════════════════════════════════════════

export function prestigeBest() {
  try { return parseInt(localStorage.getItem('realm-prestige-best') || '0', 10) || 0; } catch (_e) { return 0; }
}

export function showVictoryScreen() {
  const el = document.getElementById('victory-screen');
  if (!el) return;
  el.style.display = 'flex';
  const title = el.querySelector('.vic-title');
  const sub = el.querySelector('.vic-subtitle');
  if (title && sub) {
    title.textContent = 'The Hall of Ages Stands Eternal';
    sub.textContent = `Raised across the Three Ages and crowned on day ${G.wonder.completeDay}. The realm is remembered forever.`;
  }
  const prestige = computePrestige();
  const prestigeEl = el.querySelector('.vic-prestige');
  if (prestigeEl) {
    let best = prestigeBest();
    const isBest = prestige >= best;
    if (isBest) { best = prestige; try { localStorage.setItem('realm-prestige-best', String(best)); } catch (_e) {} }
    prestigeEl.textContent = isBest ? `${prestige} ★ new best` : `${prestige} (best ${best})`;
  }
  // Era timeline: when each age began (only shown once the realm advanced).
  const erasEl = el.querySelector('.vic-eras');
  if (erasEl) {
    const names = { 1: '🏕️ Hearth', 2: '📜 Charter', 3: '👑 Crown' };
    const starts = G.eraStartDay || { 1: 1 };
    const parts = Object.keys(starts).sort((a, b) => a - b).map(id => `${names[id] || `Age ${id}`} · day ${starts[id]}`);
    erasEl.style.display = parts.length > 1 ? 'block' : 'none';
    erasEl.textContent = parts.join('  →  ');
  }
  el.querySelector('.vic-day').textContent = `Day ${G.day}`;
  el.querySelector('.vic-pop').textContent = `${G.population} citizens`;
  el.querySelector('.vic-buildings').textContent = `${G.buildings.length} buildings`;
  el.querySelector('.vic-resources').textContent = `${G.totalResourcesGathered || 0} total`;
  el.querySelector('.vic-techs').textContent = `${G.researchedTechs.size} technologies`;
  const ach = document.querySelectorAll ? document.querySelectorAll('.ach-item.done').length : 0;
  el.querySelector('.vic-achievements').textContent = `${ach} achievements`;
  // Spawn canvas confetti
  spawnVictoryConfetti();
}

function spawnVictoryConfetti() {
  const canvas = document.getElementById('vic-confetti');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const COLORS = ['#FFD166','#EF476F','#06D6A0','#118AB2','#FFB347','#A8DADC','#FF6B6B','#FFF3B0'];
  const pieces = [];
  for (let i = 0; i < 80; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      vrot: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    });
  }
  let frame = 0;
  function drawConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.07; // gravity
      p.rot += p.vrot;
      if (p.y > canvas.height * 0.85) p.alpha -= 0.03;
    }
    frame++;
    if (frame < 240 && pieces.some(p => p.alpha > 0)) {
      requestAnimationFrame(drawConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }
  drawConfetti();
}


export function updateEventBanner() {
  const banner = document.getElementById('event-banner');
  if (!banner) return;

  if (G.activeEvent && G.activeEvent.endDay > G.day) {
    const remaining = G.activeEvent.endDay - G.day;
    const isPositive = G.activeEvent.positive ?? true;
    const borderColor = isPositive ? '#4ade80' : '#f87171';
    const bgColor = isPositive
      ? 'rgba(74,222,128,0.08)'
      : 'rgba(248,113,113,0.08)';

    banner.style.display = 'flex';
    banner.style.borderColor = borderColor;
    banner.style.borderWidth = '2px';
    banner.style.background = bgColor;
    banner.style.padding = '0.5rem 1.1rem';
    banner.style.fontSize = '0.82rem';
    banner.innerHTML = `
      <span style="color:${G.activeEvent.color};font-weight:800;font-size:0.88rem">${G.activeEvent.name}</span>
      <span style="opacity:0.85">${G.activeEvent.desc}</span>
      ${remaining > 0
        ? `<span class="eb-days" style="background:${bgColor};border:1px solid ${borderColor};color:${borderColor};font-weight:700">${remaining}d left</span>`
        : ''}`;
  } else if (G.activeEvent && G.activeEvent.endDay <= G.day) {
    // Instant events (duration 0): hide immediately
    banner.style.display = 'none';
  } else {
    banner.style.display = 'none';
  }
}


export function renderMissions() {
  const list = document.getElementById('mission-list');
  if (!list) return;
  list.innerHTML = '';

  // Prepend scenario objectives at the top
  const scen = getActiveScenario();
  let firstActiveAssigned = false;
  if (scen) {
    const header = document.createElement('div');
    header.className = 'scenario-header';
    const progress = scen.objectives.filter(o => o.check()).length;
    header.innerHTML = `<div class="scen-name">${scen.name} <span class="scen-progress">${progress}/${scen.objectives.length}</span></div><div class="scen-desc">${scen.desc}</div>`;
    list.appendChild(header);
    for (const obj of scen.objectives) {
      const done = obj.check();
      const row = document.createElement('div');
      let cls = 'mission' + (done ? ' done' : '');
      if (!done && !firstActiveAssigned) { cls += ' mission-next'; firstActiveAssigned = true; }
      else if (!done) cls += ' mission-later';
      row.className = cls;
      // Show progress like "3/10" when the objective has a numeric target and isn't done yet
      let progressText = '';
      if (!done && typeof obj.progress === 'function') {
        try {
          const [cur, target] = obj.progress();
          if (typeof cur === 'number' && typeof target === 'number') {
            progressText = ` <span class="mission-progress">(${cur}/${target})</span>`;
          }
        } catch (_e) { /* progress is optional; ignore errors */ }
      }
      row.innerHTML = `<span class="check">${done ? '✓' : ''}</span>${obj.text}${progressText}`;
      list.appendChild(row);
    }
  }

  // Divider so the global "Side Goals" list is visibly separate from the
  // scenario's tracked objectives. Without this, the 15 global missions get
  // appended in the same list with no break and make the scenario counter
  // ("0/3") look wrong — fresh-eyes reviewers read the full panel as one
  // mission group and wonder why only 3 count.
  if (scen && missions.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'mission-side-divider';
    divider.style.cssText = 'margin-top:0.9rem;padding:0.4rem 0 0.25rem;border-top:1px solid rgba(255,255,255,0.08);font-size:0.65rem;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.38);font-weight:600';
    divider.textContent = 'Side Goals';
    list.appendChild(divider);
    // After the divider, don't treat the first incomplete global mission as
    // the "next" pulsing/gold row — the scenario's active objective is the
    // real next step; keeping them all 'mission-later' preserves hierarchy.
    firstActiveAssigned = true;
  }

  for (const m of missions) {
    const div = document.createElement('div');
    let cls = 'mission' + (m.done ? ' done' : '');
    if (!m.done && !firstActiveAssigned) { cls += ' mission-next'; firstActiveAssigned = true; }
    else if (!m.done) cls += ' mission-later';
    // Loop 78: recent completions pulse the row gold for ~2.2s so the
    // eye catches which mission just finished (rather than just a toast
    // + line-through with no origin cue).
    if (m._celebratedTick && G.gameTick - m._celebratedTick < 132) { // ~2.2s at 1×
      cls += ' mission-celebrate';
    }
    div.className = cls;
    div.innerHTML = `<span class="check">${m.done?'✓':''}</span><span>${m.text}</span>`;
    list.appendChild(div);
  }
}


export function showEraBanner(era) {
  const el = document.getElementById('era-banner');
  if (!el) return;
  el.innerHTML = `<div class="era-banner-inner">
    <div class="era-banner-icon">${era.icon}</div>
    <div class="era-banner-title">${era.name}</div>
    <div class="era-banner-sub">A new age dawns upon the realm</div>
  </div>`;
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth;  // restart the CSS animation when ages land back-to-back
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 3500);
}
