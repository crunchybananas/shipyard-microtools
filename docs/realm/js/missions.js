// ════════════════════════════════════════════════════════════
// Missions — goals and progression
// ════════════════════════════════════════════════════════════

import { G } from './state.js';
import { playSound } from './audio.js';

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
  for (const m of missions) {
    const div = document.createElement('div');
    div.className = 'mission' + (m.done ? ' done' : '');
    div.innerHTML = `<span class="check">${m.done?'✓':''}</span><span>${m.text}</span>`;
    list.appendChild(div);
  }
}
