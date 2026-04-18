// ════════════════════════════════════════════════════════════
// Missions — goals and progression
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H } from './state.js';
import { playSound } from './audio.js';
import { getActiveScenario } from './scenarios.js';

export const missions = [
  { id:'farm1',   text:'Build a farm',                  check:()=>G.buildings.some(b=>b.type==='farm'),      done:false, reward:{wood:20} },
  { id:'lumber1', text:'Build a lumber mill',            check:()=>G.buildings.some(b=>b.type==='lumber'),    done:false, reward:{stone:15} },
  { id:'house1',  text:'Build a house to grow population', check:()=>G.buildings.some(b=>b.type==='house'),  done:false, reward:{food:20} },
  { id:'pop10',   text:'Reach 10 population',           check:()=>G.population>=10,                          done:false, reward:{gold:15} },
  { id:'market1', text:'Build a market',                 check:()=>G.buildings.some(b=>b.type==='market'),    done:false, reward:{gold:25} },
  { id:'defense', text:'Build barracks or tower',        check:()=>G.buildings.some(b=>b.type==='barracks'||b.type==='tower'), done:false, reward:{iron:5} },
  { id:'pop25',   text:'Reach 25 population',           check:()=>G.population>=25,                          done:false, reward:{iron:10,gold:20} },
  { id:'survive', text:'Survive the first raid',         check:()=>G.day>G.nextRaidDay,                      done:false, reward:{gold:30} },
  { id:'tavern1', text:'Build a tavern',                 check:()=>G.buildings.some(b=>b.type==='tavern'),    done:false, reward:{gold:15} },
  { id:'pop50',   text:'Reach 50 population',           check:()=>G.population>=50,                          done:false, reward:{gold:50} },
  { id:'iron1',   text:'Build an iron mine',             check:()=>G.buildings.some(b=>b.type==='mine'),      done:false, reward:{gold:20} },
  { id:'walls5',  text:'Build 5 wall segments',          check:()=>G.buildings.filter(b=>b.type==='wall').length>=5, done:false, reward:{stone:30} },
  { id:'roads10', text:'Build 10 roads',                 check:()=>G.buildings.filter(b=>b.type==='road').length>=10, done:false, reward:{gold:20} },
  { id:'pop75',   text:'Reach 75 population',           check:()=>G.population>=75,                          done:false, reward:{gold:100} },
  { id:'happy90', text:'Reach 90% happiness',            check:()=>G.happiness>=90,                           done:false, reward:{gold:40} },
];

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.color = 'var(--gold)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(()=>el.classList.remove('show'), 2500);
}

// Loop 78 (render S4): mission-completion celebration.
// Pick a location meaningful to the mission (building match → town center
// → map center) then spawn a radial spark ring + rising confetti emojis
// + a "Mission Complete" ribbon. The DOM-side row pulses via the
// `mission-celebrate` class for ~2.2s (keyed off m._celebratedAt).
const MISSION_BUILDING = {
  farm1: 'farm', lumber1: 'lumber', house1: 'house',
  market1: 'market', tavern1: 'tavern', iron1: 'mine',
};
function missionFocalPoint(m) {
  // Prefer a matching building
  const t = MISSION_BUILDING[m.id];
  if (t) {
    const b = G.buildings.find(x => x.type === t);
    if (b) return { x: b.x, y: b.y };
  }
  if (m.id === 'defense') {
    const b = G.buildings.find(x => x.type === 'barracks' || x.type === 'tower');
    if (b) return { x: b.x, y: b.y };
  }
  // Town center = average of houses (falls back to all buildings, then map centre)
  const houses = G.buildings.filter(b => b.type === 'house');
  const pool = houses.length ? houses : G.buildings;
  if (pool.length) {
    let sx = 0, sy = 0;
    for (const b of pool) { sx += b.x; sy += b.y; }
    return { x: sx / pool.length, y: sy / pool.length };
  }
  return { x: MAP_W / 2, y: MAP_H / 2 };
}
function celebrateMission(x, y) {
  // Double spark ring — inner tight + outer wide — for a firework feel.
  // The existing spark renderer applies drift = vx * (gameTick % 60) * 0.08,
  // so cos(ang)*K gives a radial sweep over the 2s decay window. Tripled
  // size versus single sparks from L67/L69 combat-impact bursts because
  // this is a headline celebration, not a sub-second hit flash.
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    G.particles.push({
      tx: x, ty: y, offsetY: -6,
      vx: Math.cos(ang) * 0.32,
      vy: Math.sin(ang) * 0.22 - 0.18,
      alpha: 1.8, decay: 0.02, type: 'spark',
      size: 3.0, color: '#ffd87a',
    });
  }
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + 0.2;
    G.particles.push({
      tx: x, ty: y, offsetY: -10,
      vx: Math.cos(ang) * 0.55,
      vy: Math.sin(ang) * 0.35 - 0.22,
      alpha: 1.6, decay: 0.022, type: 'spark',
      size: 2.4, color: i % 2 === 0 ? '#ffcc40' : '#ffe89c',
    });
  }
  // Confetti — varied colors/glyphs with explicit per-particle _driftX so
  // the renderer's deterministic drift (seeded by text charcode) doesn't
  // collapse same-emoji particles into a shared column. Spread tx too so
  // multiple glyphs don't stack on the same pixel at launch.
  const confettiColors = ['#ff4d6d','#ffd87a','#4da6ff','#7afca0','#ff9c1c','#c07aff'];
  const glyphs = ['🎉','🎊','🌟','✨'];
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
    const radialPush = 0.55 + Math.random() * 0.25;
    G.particles.push({
      tx: x + Math.cos(ang) * radialPush,
      ty: y + Math.sin(ang) * radialPush * 0.6, // squashed for iso
      offsetY: -8 + Math.random() * 4,
      vy: -0.5 - Math.random() * 0.35,
      alpha: 1.9, decay: 0.012, type: 'text',
      text: glyphs[i % glyphs.length],
      color: confettiColors[i % confettiColors.length],
      _driftX: (Math.random() - 0.5) * 1.6, // per-particle horizontal spread
    });
  }
  // Headline ribbon — rises centered over the focal point
  G.particles.push({
    tx: x, ty: y, offsetY: -34,
    text: '★ Mission Complete ★',
    alpha: 2.4, vy: -0.12, decay: 0.0085, type: 'text',
    color: '#ffd87a',
    _driftX: 0,
  });
}

export function checkMissions() {
  for (const m of missions) {
    if (!m.done && m.check()) {
      m.done = true;
      m._celebratedAt = Date.now();
      const focal = missionFocalPoint(m);
      celebrateMission(focal.x, focal.y);
      if (m.reward) {
        for (const [k,v] of Object.entries(m.reward)) {
          G.resources[k] = (G.resources[k]||0) + v;
        }
        const parts = Object.entries(m.reward).map(([k,v]) => `+${v} ${k}`).join(' ');
        // Rewards text rides the ribbon — anchored to the same focal point
        G.particles.push({
          tx: focal.x, ty: focal.y, offsetY: -22,
          text: parts, alpha: 2, vy: -0.14, decay: 0.009, type: 'text',
          color: '#ffe08a',
        });
      }
      playSound('mission');
      showToast(`✨ Mission complete: ${m.text}`);
    }
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
    if (m._celebratedAt && Date.now() - m._celebratedAt < 2200) {
      cls += ' mission-celebrate';
    }
    div.className = cls;
    div.innerHTML = `<span class="check">${m.done?'✓':''}</span><span>${m.text}</span>`;
    list.appendChild(div);
  }
}
