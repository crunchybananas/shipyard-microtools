// ════════════════════════════════════════════════════════════
// Missions — goals and progression
// ════════════════════════════════════════════════════════════

import { G, MAP_W, MAP_H, rng } from './state.js?realm=128';
import { sfx as playSound, announce } from './log.js?realm=128';

export const missions = [
  { id:'farm1',   text:'Build a farm',                  check:()=>G.buildings.some(b=>b.type==='farm'),      done:false, reward:{wood:20} },
  { id:'lumber1', text:'Build a lumber mill',            check:()=>G.buildings.some(b=>b.type==='lumber'),    done:false, reward:{stone:15} },
  { id:'house1',  text:'Build a house to grow population', check:()=>G.buildings.some(b=>b.type==='house'),  done:false, reward:{food:20} },
  { id:'pop10',   text:'Reach 10 population',           check:()=>G.population>=10,                          done:false, reward:{gold:15} },
  { id:'market1', text:'Build a market',                 check:()=>G.buildings.some(b=>b.type==='market'),    done:false, reward:{gold:25} },
  { id:'defense', text:'Build barracks or tower',        check:()=>G.buildings.some(b=>b.type==='barracks'||b.type==='tower'), done:false, reward:{iron:5} },
  { id:'pop25',   text:'Reach 25 population',           check:()=>G.population>=25,                          done:false, reward:{iron:10,gold:20} },
  { id:'survive', text:'Survive the first raid',         check:()=> (G.stats?.raidsFaced || 0) >= 1 && G.enemies.length === 0, done:false, reward:{gold:30} },
  { id:'tavern1', text:'Build a tavern',                 check:()=>G.buildings.some(b=>b.type==='tavern'),    done:false, reward:{gold:15} },
  { id:'pop50',   text:'Reach 50 population',           check:()=>G.population>=50,                          done:false, reward:{gold:50} },
  { id:'iron1',   text:'Build an iron mine',             check:()=>G.buildings.some(b=>b.type==='mine'),      done:false, reward:{gold:20} },
  { id:'walls5',  text:'Build 5 wall segments',          check:()=>G.buildings.filter(b=>b.type==='wall').length>=5, done:false, reward:{stone:30} },
  { id:'roads10', text:'Build 10 roads',                 check:()=>G.buildings.filter(b=>b.type==='road').length>=10, done:false, reward:{gold:20} },
  { id:'pop75',   text:'Reach 75 population',           check:()=>G.population>=75,                          done:false, reward:{gold:100} },
  { id:'happy90', text:'Reach 90% happiness',            check:()=>G.happiness>=90,                           done:false, reward:{gold:40} },
];

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
    const ang = (i / 12) * Math.PI * 2 + rng() * 0.5;
    const radialPush = 0.55 + rng() * 0.25;
    G.particles.push({
      tx: x + Math.cos(ang) * radialPush,
      ty: y + Math.sin(ang) * radialPush * 0.6, // squashed for iso
      offsetY: -8 + rng() * 4,
      vy: -0.5 - rng() * 0.35,
      alpha: 1.9, decay: 0.012, type: 'text',
      text: glyphs[i % glyphs.length],
      color: confettiColors[i % confettiColors.length],
      _driftX: (rng() - 0.5) * 1.6, // per-particle horizontal spread
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
      m._celebratedTick = G.gameTick; // tick-based (core file — no Date.now)
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
      announce(`✨ Mission complete: ${m.text}`, 'mission', { chronicle: false });
    }
  }
}

