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

export function renderAchievementsPanel() {
  const el = document.getElementById('achievements-content');
  if (!el) return;
  el.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const done = unlocked.has(a.id);
    const div = document.createElement('div');
    div.className = 'ach-item' + (done ? ' done' : '');
    div.innerHTML = `<span class="ach-icon">${done ? a.icon : '🔒'}</span><div class="ach-info"><div class="ach-name">${done ? a.name : '???'}</div><div class="ach-desc">${a.desc}</div></div>`;
    el.appendChild(div);
  }
}
