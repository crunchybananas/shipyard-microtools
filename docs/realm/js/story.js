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

// Loop 034 (the-fixer, closing 021 audit): three more NPCs tied to
// first-build beats. The pattern mirrors mayor/bard/rival — a name-pool
// pick, a `namedCharacters.X` entry, and a chronicle line in the
// 'character' category. 021 observed that blacksmith/market/school were
// meaningful buildings without named inhabitants; these ensure the
// realm *feels* inhabited by specific people, not just anonymous
// workers.
const SMITH_NAMES    = ['Harald Ironhand','Mira the Forger','Gunnar Blackanvil','Yara Sparkwright','Tobias Hammerfell','Vela Coalwright','Bren Sootmark'];
const MERCHANT_NAMES = ['Osric the Coin','Dame Lisbet Saltwater','Yusuf of the Three Ports','Marlene Goldvein','Pietro Silkwake','Ada Longroad'];
const TEACHER_NAMES  = ['Master Kellan','Dame Ysolt the Wise','Brother Orlan','Sister Tannis','Scribe Devin','Reader Mira'];

export function ensureSmith() {
  initChronicle();
  if (G.namedCharacters.smith) return G.namedCharacters.smith;
  const name = pick(SMITH_NAMES);
  G.namedCharacters.smith = { name, arrivedDay: G.day };
  chronicle(`${name} takes up the hammer at the new forge. "Steel remembers every strike," they say.`, 'character');
  return G.namedCharacters.smith;
}

export function ensureMerchant() {
  initChronicle();
  if (G.namedCharacters.merchant) return G.namedCharacters.merchant;
  const name = pick(MERCHANT_NAMES);
  G.namedCharacters.merchant = { name, arrivedDay: G.day };
  chronicle(`${name} sets up stall at the market. Their caravans travel as far as the coast.`, 'character');
  return G.namedCharacters.merchant;
}

export function ensureTeacher() {
  initChronicle();
  if (G.namedCharacters.teacher) return G.namedCharacters.teacher;
  const name = pick(TEACHER_NAMES);
  G.namedCharacters.teacher = { name, arrivedDay: G.day };
  chronicle(`${name} opens the schoolhouse doors. The first lesson: "Know thy realm."`, 'character');
  return G.namedCharacters.teacher;
}

// Loop 026 (refactor-only): 13 first-build beats data-driven into one
// table + loop. Before this, each beat was a 4-line hand-written block
// and the 12 existing + 5 added-by-022 lived in one ever-growing wall of
// near-identical code. Extracting to data makes adding a new beat (or
// editing one) a single-line change, and makes the "the chronicle knows
// about these N buildings" fact visible at a glance.
//
// Side-effect beats (tavern → ensureMayor, barracks → ensureRival,
// church → ensureBard) stay inline below — they aren't repetitive text;
// they're distinct moments that do extra work. Special-shape beats
// (firstBirth, castleBuilt, firstRaidSurvived) also stay inline — they
// key on stats/gameState, not `buildings.some(b => b.type === X)`.
// Loop 034: added optional `after` field. When a beat fires, after()
// runs once right after the chronicle line — used to introduce a named
// character tied to the building (smith/merchant/teacher). The `fragile`
// concern from 026 (mixing function refs into data) is real, but for
// pure character-setup side-effects it's the lighter option vs. moving
// these 3 beats back inline.
const BUILDING_FIRST_BEATS = [
  { type: 'house',      flag: 'firstHouse',      text: 'The first house is raised. Smoke rises from a new hearth tonight.' },
  { type: 'farm',       flag: 'firstFarm',       text: 'A farm is established. The earth will feed us now.' },
  { type: 'lumber',     flag: 'firstLumber',     text: 'The lumber mill hums to life. Timber stacks grow at its side.' },
  { type: 'fisherman',  flag: 'firstFisherman',  text: "A fisherman's hut rises on the sand. Nets hang out to dry in the sea breeze." },
  { type: 'granary',    flag: 'firstGranary',    text: 'The granary is sealed against the weather. Winter will find us ready.' },
  { type: 'mine',       flag: 'firstMine',       text: 'Picks ring in the iron mine. Ore carts clatter up from the dark.' },
  { type: 'quarry',     flag: 'firstQuarry',     text: 'The quarry is opened. Dust hangs in the air as the first blocks are cut.' },
  { type: 'market',     flag: 'firstMarket',     text: 'Merchants unpack their wares at the new market. Trade has come to the realm.',            after: ensureMerchant },
  { type: 'blacksmith', flag: 'firstBlacksmith', text: 'Hammer rings on anvil. The first blade is quenched — sparks, steam, and a promise.',       after: ensureSmith },
  { type: 'school',     flag: 'firstSchool',     text: "The schoolhouse opens. Children's voices rise from the yard; letters are learned.",        after: ensureTeacher },
  { type: 'windmill',   flag: 'firstWindmill',   text: "Sails turn above the fields. Grain will become flour now, without the miller's back." },
  { type: 'bakery',     flag: 'firstBakery',     text: "The first loaves cool on the baker's rack. The realm smells like home tonight." },
  { type: 'archery',    flag: 'firstArchery',    text: 'The butts are set, the strings drawn. Arrows find their mark — or fly far into the heather.' },
];

// Run each tick/day to detect milestones and fire beats once.
export function checkStoryBeats() {
  initChronicle();

  // Simple first-build beats — one pattern, one table. See BUILDING_FIRST_BEATS.
  // The optional `after` field runs once when a beat fires; used to introduce
  // a named character tied to the building (added in 034).
  for (const beat of BUILDING_FIRST_BEATS) {
    if (!hasFlag(beat.flag) && G.buildings.some(b => b.type === beat.type)) {
      setFlag(beat.flag);
      chronicle(beat.text, 'milestone');
      if (beat.after) beat.after();
    }
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

  // Loop 039 (the-dream, surprise challenge): collective dreams.
  // Every 14 days at dawn, the realm wakes to a shared dream composed
  // deterministically from the kingdom name + day + what's present in
  // the realm. Content is seeded (same kingdom + day → same dream) and
  // uses named characters when they exist. Three threads are chosen
  // from the pool; each thread contributes one image. Feels like
  // someone unseen is writing the realm's subconscious.
  checkDreamBeat();
  // Loop 043 (a-scene-that-happens-once, surprise challenge):
  // at most one NIGHTMARE per realm, ever. See checkNightmareBeat.
  checkNightmareBeat();
}

// ── Loop 039: the-dream — collective dreams ─────────────────
// Pure deterministic string hash; no crypto needed.
function _dreamHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Thread = a seed of images. Triggered by realm state. Each image is a
// fragment the dreamer "saw." The prose joins them with "; then " so
// the chronicle reads as a sequence of visions.
const _DREAM_THREADS = {
  founding: {
    always: true,
    images: [
      'a boat of pale wood arriving at a shore that was not there yesterday',
      'nets of starlight pulled in empty',
      'a drowned crown resting on sea-washed stones',
      'three settlers at a fire that will not go out',
      'footprints in sand that the tide refuses',
    ],
  },
  forge: {
    requires: () => !!G.namedCharacters?.smith,
    images: (G) => [
      `${G.namedCharacters.smith.name}'s anvil singing without a hammer`,
      'steel poured like water, cooling into names no one remembers',
      'a sword that weeps when no one holds it',
      'the forge lit by a fire the smith did not kindle',
    ],
  },
  harvest: {
    requires: () => G.buildings.some(b => b.type === 'farm'),
    images: [
      'wheat fields stretching into the sky, harvested by hands from above',
      'grain that speaks the old tongues when threshed',
      'bread baked by a mother no one remembers',
      'the first loaf each citizen ever tasted, warm again in their hands',
      'ears of corn with the kingdom\'s name hidden in their rows',
    ],
  },
  market: {
    requires: () => !!G.namedCharacters?.merchant,
    images: (G) => [
      `coins bearing ${G.namedCharacters.merchant.name}'s face on both sides`,
      'a scale weighing mercy against regret, tipping slowly',
      'a merchant who trades only questions, all of them the same',
      'caravans arriving from the edge of the map',
    ],
  },
  warning: {
    requires: () => G.day > 20 || (G.enemies && G.enemies.length > 0),
    images: [
      'a wolf at the borders speaking the kingdom\'s founding words',
      'a banner torn by no wind',
      'a child who knows the ending',
      'shadows on the walls that move against the torchlight',
      'the year\'s end seen from both sides',
    ],
  },
  hearth: {
    requires: () => G.buildings.some(b => b.type === 'house'),
    images: [
      'every house lit at once, though no one struck a light',
      'the first hearth-smoke of the realm, visible again in the air',
      'a door that opens on a room the owner has never entered',
      'a window looking out on the realm as it will be in a hundred years',
    ],
  },
  water: {
    requires: () => G.buildings.some(b => b.type === 'well' || b.type === 'fisherman'),
    images: [
      'the well filled with stars instead of water',
      'fish that swim upstream into the sky',
      'a tide that returns what it took',
      'rain falling upward from the lake',
    ],
  },
  learning: {
    requires: () => !!G.namedCharacters?.teacher,
    images: (G) => [
      `${G.namedCharacters.teacher.name} teaching a lesson in a language the children already know`,
      'a library of books that rewrite themselves when closed',
      'a schoolhouse where the walls listen',
      'the alphabet of a tongue no one has yet spoken',
    ],
  },
};

export function checkDreamBeat() {
  // Require some history; don't dream on day 1-13
  if (G.day < 14) return;
  if (G.day % 14 !== 0) return;
  // Only at dawn (dayPhase < 120 ≈ first ~3% of the day)
  if (G.dayPhase > 120) return;
  const flag = `dream_${G.day}`;
  if (hasFlag(flag)) return;
  setFlag(flag);

  // Build available thread list
  const avail = [];
  for (const [name, t] of Object.entries(_DREAM_THREADS)) {
    if (t.always || (t.requires && t.requires())) avail.push(name);
  }
  if (avail.length === 0) return;

  // Seed base from kingdom + day — same kingdom + day → same dream
  const kname = G.kingdomName || 'Realm';
  const baseKey = `${kname}_${G.day}`;

  // Pick 3 threads. Each thread-pick uses its own hash so two kingdoms
  // whose base seeds happen to collide mod avail.length still diverge.
  const picked = [];
  for (let i = 0; i < 3; i++) {
    const idx = _dreamHash(`${baseKey}_thread_${i}`) % avail.length;
    picked.push(avail[idx]);
  }

  // One image per pick, derived from a per-image hash so the entropy
  // scales with pool.length regardless of pick ordering. Dedup by
  // image text (not thread) — early-game realms with only 1 thread
  // still get distinct images from that thread's pool.
  const rawImages = picked.map((threadName, i) => {
    const t = _DREAM_THREADS[threadName];
    const pool = typeof t.images === 'function' ? t.images(G) : t.images;
    const idx = _dreamHash(`${baseKey}_img_${threadName}_${i}`) % pool.length;
    return pool[idx];
  });
  const images = [];
  for (const img of rawImages) if (!images.includes(img)) images.push(img);

  const dreamText = `At dawn the realm wakes to shared dreams: ${images.join('; then ')}. No one speaks of them, but everyone remembers.`;
  chronicle(dreamText, 'dream');
}

// ── Loop 043: a-scene-that-happens-once — the NIGHTMARE ─────────
//
// Each realm dreams ONE nightmare in its entire lifetime, and only
// one. The day it fires is seeded from the kingdom name, landing
// somewhere in the mid-game (day 50–250). It supersedes the regular
// dream for that one day. Different framing. Darker imagery. A
// permanent flag ensures it never re-fires within a save, even
// across reloads.
//
// Unlike the collective dreams (039), the nightmare ALSO fires a
// toast — this is the rarest chronicle beat in realm and deserves
// to be noticed in the moment. Players can read the full prose in
// the chronicle afterward.
//
// Cross-refs the named-character system (034): the mayor / smith /
// merchant / teacher appear in a few images if present.

const _NIGHTMARE_IMAGES_STATIC = [
  'a bell that tolls itself, counting losses not yet suffered',
  'every candle in the realm blown out at once, then relit by hands no one owns',
  'a child\'s drawing of the castle, on fire',
  'the sea receding past where the fishermen have ever gone',
  'a door locked from the outside, with the key on the inside',
  'every dog in the realm barking at the same star',
  'wheat fields harvested by hands no one recognizes',
  'a winter come early, glimpsed through a window that looks out on summer',
  'a mirror that shows the realm as it will be after everyone has left',
  'the founders standing at the walls, weeping',
  'a road leading away from the kingdom that was not there yesterday',
];

function _nightmareImagesForState(G) {
  // Base pool + character-conditional fragments. No more than 3 are
  // picked for any single nightmare.
  const pool = [..._NIGHTMARE_IMAGES_STATIC];
  if (G.namedCharacters?.mayor) {
    pool.push(`${G.namedCharacters.mayor.name}'s voice heard from an empty room`);
  }
  if (G.namedCharacters?.smith) {
    pool.push(`${G.namedCharacters.smith.name}'s forge cold for the first time in memory`);
  }
  if (G.namedCharacters?.bard) {
    pool.push(`${G.namedCharacters.bard.name} singing a song no one in the realm has taught`);
  }
  if (G.namedCharacters?.teacher) {
    pool.push(`${G.namedCharacters.teacher.name} writing the same word on every wall`);
  }
  return pool;
}

export function checkNightmareBeat() {
  if (hasFlag('nightmare_fired')) return;
  // Nightmare day seeded from kingdom name; fires in [50, 250]
  const kname = G.kingdomName || 'Realm';
  const targetDay = _dreamHash(`${kname}_nightmare_day`) % 200 + 50;
  if (G.day !== targetDay) return;
  // Only at dawn — same gate as the regular dream so they don't stomp each other
  if (G.dayPhase > 120) return;
  setFlag('nightmare_fired');

  const pool = _nightmareImagesForState(G);
  const seed = _dreamHash(`${kname}_nightmare_content`);
  // Pick 3 distinct images by per-slot hash
  const rawImages = [];
  for (let i = 0; i < 3; i++) {
    const idx = _dreamHash(`${kname}_nightmare_img_${i}`) % pool.length;
    rawImages.push(pool[idx]);
  }
  const images = [];
  for (const img of rawImages) if (!images.includes(img)) images.push(img);

  const prose = `The realm does not wake — it is woken. ${images.join('; and behind it, ')}. The day begins with the feel of something ended.`;
  chronicle(prose, 'nightmare');

  // Toast the beat so it doesn't pass unnoticed. Chronicle already
  // written above, so chronicle:false suppresses re-chronicling in notify.
  try {
    const notif = _NIGHTMARE_NOTIFY;
    if (notif) notif(`🌑 The realm did not wake well.`, 'danger', { chronicle: false });
  } catch (_e) {}
}

// Late-bound notify import to avoid load-order coupling with story.js's
// position in the module graph. Set on module-load below.
let _NIGHTMARE_NOTIFY = null;
import('./notifications.js').then(m => { _NIGHTMARE_NOTIFY = m.notify; }).catch(() => {});

export function toggleChroniclePanel() {
  const p = document.getElementById('chronicle-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}
