// ════════════════════════════════════════════════════════════
// Story / Chronicle system — narrative beats, named characters,
// diary of the realm. Persists to save.
// ════════════════════════════════════════════════════════════

import { G } from './state.js';

// G.chronicle: [{ day, season, text, tag }]
// tag in: 'milestone','event','character','raid','season','death','birth','victory','misc'

export function initChronicle() {
  if (!G.chronicle) G.chronicle = [];
  if (!G.storyFlags) G.storyFlags = {};
  if (!G.namedCharacters) G.namedCharacters = {};
}

export function chronicle(text, tag='misc') {
  initChronicle();
  G.chronicle.push({
    day: G.day,
    season: G.season,
    tick: G.gameTick,
    text, tag,
  });
  // Cap to last 300 entries
  if (G.chronicle.length > 300) G.chronicle.splice(0, G.chronicle.length - 300);
}

export function hasFlag(key) { initChronicle(); return !!G.storyFlags[key]; }
export function setFlag(key, val=true) { initChronicle(); G.storyFlags[key] = val; }

// ── Render chronicle panel ─────────────────────────────────
export function renderChroniclePanel() {
  initChronicle();
  const c = document.getElementById('chronicle-content');
  if (!c) return;
  if (G.chronicle.length === 0) {
    c.innerHTML = '<div class="chron-empty">Your chronicle is blank. Shape the realm and it will record your deeds.</div>';
    return;
  }
  const tagIcons = {
    milestone:'🏛️', event:'✨', character:'👤', raid:'⚔️',
    season:'🍃', death:'🪦', birth:'👶', victory:'🏆', misc:'📜',
  };
  const seasonIcons = { spring:'🌱', summer:'☀️', autumn:'🍂', winter:'❄️' };
  const byDay = {};
  for (const e of G.chronicle) {
    if (!byDay[e.day]) byDay[e.day] = [];
    byDay[e.day].push(e);
  }
  const days = Object.keys(byDay).map(Number).sort((a,b)=>b-a);
  let html = '';
  for (const d of days) {
    const seas = byDay[d][0].season;
    html += `<div class="chron-day"><div class="chron-day-h">${seasonIcons[seas]||''} Day ${d}</div>`;
    for (const e of byDay[d]) {
      html += `<div class="chron-row"><span class="chron-tag">${tagIcons[e.tag]||'📜'}</span><span class="chron-text">${e.text}</span></div>`;
    }
    html += '</div>';
  }
  c.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// Story beats — triggered by milestones. Each beat fires once.
// ════════════════════════════════════════════════════════════

const MAYOR_FIRST = ['Aldwin','Brynne','Cedric','Dahlia','Eadric','Ferra','Garrick','Hestia','Ivor','Juna','Kerrin','Liana','Malcolm','Nerys','Osric','Petra','Quillan','Rowen','Sibyl','Thane'];
const MAYOR_LAST  = ['the Steady','the Bold','Ironheart','of the Vale','Fairwind','Oakmoot','Stormward','the Patient','Brightblade','the Just','Silverthorn','Greyhelm'];
const BARD_FIRST  = ['Lilian','Merek','Oriel','Piper','Roderic','Seraphine','Tomas','Wren'];
const RIVAL_NAMES = ['Lord Vorgan of the Ashlands','Baroness Sable of Crowhold','The Iron Earl Draven','Duchess Morrigan of Nightshade'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function ensureMayor() {
  initChronicle();
  if (G.namedCharacters.mayor) return G.namedCharacters.mayor;
  const name = `${pick(MAYOR_FIRST)} ${pick(MAYOR_LAST)}`;
  G.namedCharacters.mayor = { name, appointedDay: G.day };
  chronicle(`${name} is appointed mayor. "I shall serve ${G.kingdomName} with all that I am."`, 'character');
  return G.namedCharacters.mayor;
}

export function ensureBard() {
  initChronicle();
  if (G.namedCharacters.bard) return G.namedCharacters.bard;
  const name = pick(BARD_FIRST);
  G.namedCharacters.bard = { name, arrivedDay: G.day };
  chronicle(`A wandering bard, ${name}, arrives to play at the tavern. Songs of the realm begin.`, 'character');
  return G.namedCharacters.bard;
}

export function ensureRival() {
  initChronicle();
  if (G.namedCharacters.rival) return G.namedCharacters.rival;
  const name = pick(RIVAL_NAMES);
  G.namedCharacters.rival = { name, noticedDay: G.day };
  chronicle(`${name} takes notice of ${G.kingdomName}. Their banners have been seen at the borders.`, 'character');
  return G.namedCharacters.rival;
}

// Run each tick/day to detect milestones and fire beats once.
export function checkStoryBeats() {
  initChronicle();

  // First house
  if (!hasFlag('firstHouse') && G.buildings.some(b => b.type === 'house')) {
    setFlag('firstHouse');
    chronicle('The first house is raised. Smoke rises from a new hearth tonight.', 'milestone');
  }
  // First farm
  if (!hasFlag('firstFarm') && G.buildings.some(b => b.type === 'farm')) {
    setFlag('firstFarm');
    chronicle('A farm is established. The earth will feed us now.', 'milestone');
  }
  // First lumber mill — Day 1 build-bar building; without a beat, placing it
  // on Day 1 alongside House + Farm produced only 2 chronicle entries, making
  // the log read as if the lumber mill wasn't "real".
  if (!hasFlag('firstLumber') && G.buildings.some(b => b.type === 'lumber')) {
    setFlag('firstLumber');
    chronicle('The lumber mill hums to life. Timber stacks grow at its side.', 'milestone');
  }
  // First fisherman's hut — on the Day 1 build bar, also missing acknowledgment.
  if (!hasFlag('firstFisherman') && G.buildings.some(b => b.type === 'fisherman')) {
    setFlag('firstFisherman');
    chronicle("A fisherman's hut rises on the sand. Nets hang out to dry in the sea breeze.", 'milestone');
  }
  // First granary — fills out the Day 1 build bar with a beat.
  if (!hasFlag('firstGranary') && G.buildings.some(b => b.type === 'granary')) {
    setFlag('firstGranary');
    chronicle('The granary is sealed against the weather. Winter will find us ready.', 'milestone');
  }
  // First mine / first quarry — common Day 2–3 placements; without beats the
  // mid-game chronicle goes silent for 4+ days between Day 1 founding and the
  // next seasonal turn.
  if (!hasFlag('firstMine') && G.buildings.some(b => b.type === 'mine')) {
    setFlag('firstMine');
    chronicle('Picks ring in the iron mine. Ore carts clatter up from the dark.', 'milestone');
  }
  if (!hasFlag('firstQuarry') && G.buildings.some(b => b.type === 'quarry')) {
    setFlag('firstQuarry');
    chronicle('The quarry is opened. Dust hangs in the air as the first blocks are cut.', 'milestone');
  }
  // First citizen born — deep-play showed citizensBorn=4 by Day 12 with zero
  // chronicle entries about a single birth. The settlement grew from 3 to 7
  // and the log never mentioned any of the new arrivals.
  if (!hasFlag('firstBirth') && G.stats && (G.stats.citizensBorn || 0) >= 1) {
    setFlag('firstBirth');
    chronicle('A child is born in the realm. The first new life to call this land home.', 'birth');
  }
  // First tavern → mayor appears, bard soon after
  if (!hasFlag('firstTavern') && G.buildings.some(b => b.type === 'tavern')) {
    setFlag('firstTavern');
    chronicle('The tavern opens its doors. Laughter carries into the night.', 'milestone');
    ensureMayor();
  }
  // First market
  if (!hasFlag('firstMarket') && G.buildings.some(b => b.type === 'market')) {
    setFlag('firstMarket');
    chronicle('Merchants unpack their wares at the new market. Trade has come to the realm.', 'milestone');
  }
  // First barracks → rival noticed
  if (!hasFlag('firstBarracks') && G.buildings.some(b => b.type === 'barracks')) {
    setFlag('firstBarracks');
    chronicle('The barracks is built. Recruits drill at dawn.', 'milestone');
    ensureRival();
  }
  // First church
  if (!hasFlag('firstChurch') && G.buildings.some(b => b.type === 'church')) {
    setFlag('firstChurch');
    chronicle('Bells toll from the new church. The faithful gather.', 'milestone');
    ensureBard();
  }
  // Population thresholds
  const popCheck = [
    [10, 'pop10', 'Ten souls now call this land home.'],
    [25, 'pop25', 'Twenty-five citizens — a true town takes shape.'],
    [50, 'pop50', 'Fifty strong! Travelers on the road whisper of the rising realm.'],
    [75, 'pop75', 'Seventy-five subjects. Other lords now watch with envy.'],
    [100, 'pop100', 'One hundred souls. A city is born.'],
  ];
  for (const [thr, flag, text] of popCheck) {
    if (!hasFlag(flag) && G.population >= thr) {
      setFlag(flag);
      chronicle(text, 'milestone');
    }
  }
  // Castle = end-of-act
  if (!hasFlag('castleBuilt') && G.buildings.some(b => b.type === 'castle')) {
    setFlag('castleBuilt');
    const m = G.namedCharacters.mayor;
    chronicle(`The castle stands complete. ${m ? m.name + ' proclaims,' : 'The heralds proclaim,'} "${G.kingdomName} shall endure a thousand years!"`, 'victory');
  }
  // First raid survived
  if (!hasFlag('firstRaidSurvived') && G.stats && G.stats.raidsSurvived >= 1) {
    setFlag('firstRaidSurvived');
    chronicle('The first raid is turned back. The dead are buried; the living drink to the fallen.', 'raid');
  }
}

export function toggleChroniclePanel() {
  const p = document.getElementById('chronicle-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}
