// ════════════════════════════════════════════════════════════
// Achievements — persistent milestones with toast notifications
// ════════════════════════════════════════════════════════════

import { G } from './state.js';
import { playSound } from './audio.js';

const STORAGE_KEY = 'realm-achievements';

export const ACHIEVEMENTS = [
  { id:'first_house',     icon:'🏠', name:'First Shelter',     desc:'Build your first house',                check:()=>G.buildings.some(b=>b.type==='house') },
  { id:'first_farm',      icon:'🌾', name:'Sowing Seeds',      desc:'Build your first farm',                 check:()=>G.buildings.some(b=>b.type==='farm') },
  { id:'pop10',           icon:'👥', name:'Small Village',      desc:'Reach 10 population',                   check:()=>G.population>=10 },
  { id:'pop25',           icon:'🏘️', name:'Growing Town',       desc:'Reach 25 population',                   check:()=>G.population>=25 },
  { id:'pop50',           icon:'🏙️', name:'Thriving City',      desc:'Reach 50 population',                   check:()=>G.population>=50 },
  { id:'survived_winter', icon:'❄️', name:'Winter Survivor',    desc:'Survive your first winter',             check:()=>G.day>=8 && G.season!=='winter' && G.day>7 },
  { id:'first_research',  icon:'🔬', name:'Knowledge Seeker',   desc:'Complete your first research',          check:()=>G.researchedTechs.size>2 },
  { id:'all_techs',       icon:'🎓', name:'Renaissance',        desc:'Research all technologies',             check:()=>G.researchedTechs.size>=8 },
  { id:'iron_age',        icon:'⚒️', name:'Iron Age',           desc:'Build an iron mine',                    check:()=>G.buildings.some(b=>b.type==='mine') },
  { id:'fortified',       icon:'🛡️', name:'Fortified',          desc:'Build 3+ defense buildings',            check:()=>G.buildings.filter(b=>b.type==='barracks'||b.type==='tower'||b.type==='wall').length>=3 },
  { id:'merchant',        icon:'⛵', name:'Merchant Prince',    desc:'Build a trading post',                  check:()=>G.buildings.some(b=>b.type==='tradingpost') },
  { id:'happy90',         icon:'😊', name:'Utopia',             desc:'Reach 90% happiness',                   check:()=>G.happiness>=90 },
  { id:'builder10',       icon:'🔨', name:'Master Builder',     desc:'Place 10 buildings',                    check:()=>G.buildings.length>=10 },
  { id:'builder25',       icon:'🏗️', name:'Urban Planner',      desc:'Place 25 buildings',                    check:()=>G.buildings.length>=25 },
  { id:'day30',           icon:'📅', name:'First Month',        desc:'Survive 30 days',                       check:()=>G.day>=30 },
  { id:'day100',          icon:'📆', name:'Centurion',          desc:'Survive 100 days',                      check:()=>G.day>=100 },
  { id:'rich',            icon:'💰', name:'Golden Treasury',    desc:'Accumulate 100 gold',                   check:()=>G.resources.gold>=100 },
  { id:'scholar',         icon:'📚', name:'Scholar',            desc:'Build a school',                        check:()=>G.buildings.some(b=>b.type==='school') },
  { id:'faithful',        icon:'⛪', name:'Faithful',           desc:'Build a church',                        check:()=>G.buildings.some(b=>b.type==='church') },
  { id:'prepared',        icon:'🏺', name:'Prepared',           desc:'Build a granary before winter',         check:()=>G.buildings.some(b=>b.type==='granary') },
  { id:'victory',         icon:'👑', name:'Realm Complete',     desc:'Build a Castle and claim your realm',   check:()=>G.won },
];

let unlocked = new Set();

export function loadAchievements() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) unlocked = new Set(JSON.parse(raw));
  } catch {}
}

function saveAchievements() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  } catch {}
}

export function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    try {
      if (a.check()) {
        unlocked.add(a.id);
        saveAchievements();
        playSound('mission');
        showAchievementToast(a);
      }
    } catch {}
  }
}

export function getUnlockedCount() { return unlocked.size; }
export function isUnlocked(id) { return unlocked.has(id); }

function showAchievementToast(a) {
  const el = document.getElementById('achievement-toast');
  if (!el) return;
  el.innerHTML = `<span class="at-icon">${a.icon}</span><div><div class="at-title">Achievement Unlocked!</div><div class="at-name">${a.name}</div><div class="at-desc">${a.desc}</div></div>`;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 4000);
}

// Progress helpers: compute 0–1 progress for partially-checkable achievements
function getProgress(a) {
  try {
    if (unlocked.has(a.id)) return 1;
    // Population milestones
    if (a.id === 'pop10') return Math.min(1, G.population / 10);
    if (a.id === 'pop25') return Math.min(1, G.population / 25);
    if (a.id === 'pop50') return Math.min(1, G.population / 50);
    // Day milestones
    if (a.id === 'day30') return Math.min(1, G.day / 30);
    if (a.id === 'day100') return Math.min(1, G.day / 100);
    // Builder milestones
    if (a.id === 'builder10') return Math.min(1, G.buildings.length / 10);
    if (a.id === 'builder25') return Math.min(1, G.buildings.length / 25);
    // Research
    if (a.id === 'first_research') return Math.min(1, G.researchedTechs.size / 3);
    if (a.id === 'all_techs') return Math.min(1, G.researchedTechs.size / 8);
    // Gold
    if (a.id === 'rich') return Math.min(1, G.resources.gold / 100);
    // Happiness
    if (a.id === 'happy90') return Math.min(1, G.happiness / 90);
    // Fortified
    if (a.id === 'fortified') {
      const cnt = G.buildings.filter(b => b.type === 'barracks' || b.type === 'tower' || b.type === 'wall').length;
      return Math.min(1, cnt / 3);
    }
  } catch {}
  return 0;
}

export function renderAchievementsPanel() {
  const el = document.getElementById('achievements-content');
  if (!el) return;
  el.innerHTML = '';

  const doneCount = unlocked.size;
  const totalCount = ACHIEVEMENTS.length;

  // Panel summary
  const summary = document.createElement('div');
  summary.className = 'ach-summary';
  const pct = Math.round((doneCount / totalCount) * 100);
  summary.innerHTML = `
    <div class="ach-sum-row">
      <span class="ach-sum-label">${doneCount} / ${totalCount} Unlocked</span>
      <span class="ach-sum-pct">${pct}%</span>
    </div>
    <div class="ach-sum-bar"><div class="ach-sum-fill" style="width:${pct}%"></div></div>`;
  el.appendChild(summary);

  // Unlocked first, then locked
  const sortedAchs = [...ACHIEVEMENTS].sort((a, b) => {
    const da = unlocked.has(a.id) ? 0 : 1;
    const db = unlocked.has(b.id) ? 0 : 1;
    return da - db;
  });

  for (const a of sortedAchs) {
    const done = unlocked.has(a.id);
    const progress = getProgress(a);
    const hasProgress = !done && progress > 0;

    const div = document.createElement('div');
    div.className = 'ach-item' + (done ? ' done' : '');
    if (done) div.title = a.desc;

    let progressHtml = '';
    if (hasProgress) {
      const pctBar = Math.round(progress * 100);
      progressHtml = `<div class="ach-progress"><div class="ach-progress-fill" style="width:${pctBar}%"></div><span class="ach-progress-label">${pctBar}%</span></div>`;
    }

    div.innerHTML = `
      <span class="ach-icon${done ? '' : ' ach-icon-locked'}">${done ? a.icon : '🔒'}</span>
      <div class="ach-info">
        <div class="ach-name">${done ? a.name : (hasProgress ? a.name : '???')}</div>
        <div class="ach-desc">${a.desc}</div>
        ${progressHtml}
      </div>
      ${done ? '<span class="ach-check">✓</span>' : ''}`;
    el.appendChild(div);
  }
}
