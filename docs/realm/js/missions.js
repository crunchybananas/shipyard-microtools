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

export function checkMissions() {
  for (const m of missions) {
    if (!m.done && m.check()) {
      m.done = true;
      if (m.reward) {
        for (const [k,v] of Object.entries(m.reward)) {
          G.resources[k] = (G.resources[k]||0) + v;
        }
        const parts = Object.entries(m.reward).map(([k,v]) => `+${v} ${k}`).join(' ');
        G.particles.push({
          tx: MAP_W/2, ty: MAP_H/2, offsetY: -30,
          text: parts, alpha: 2, vy: -0.2, decay: 0.008, type: 'text',
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
    div.className = cls;
    div.innerHTML = `<span class="check">${m.done?'✓':''}</span><span>${m.text}</span>`;
    list.appendChild(div);
  }
}
