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
  // Loop 057 (the-fixer, 053 HIGH): 4 beats 053's completionist play found
  // still missing. 021 identified 12 missing, 022 closed 5, 057 closes the
  // last 4 that deserve a beat (road and wall excluded — placed dozens of
  // times, shouldn't each fire).
  { type: 'tower',       flag: 'firstTower',       text: 'A watchtower rises above the treeline. Eyes now reach the horizon in every direction.' },
  { type: 'well',        flag: 'firstWell',        text: 'A new well is dug. Cold sweet water meets the light for the first time in ages.' },
  { type: 'chickencoop', flag: 'firstChickencoop', text: 'Chickens settle into their coop. The realm wakes to a new kind of dawn chorus.' },
  { type: 'cowpen',      flag: 'firstCowpen',      text: 'A cow pen is raised. Milk and hide will flow from patient beasts now.' },
  // Loop 062 (cut-as-you-add): consolidated the inline tavern/barracks/
  // church first-build blocks into the table. Previous code duplicated
  // the table pattern as three 4-line if-blocks below checkStoryBeats;
  // merging here preserves exact beat text + tag and uses the existing
  // `after:` hook for the ensure* named-character triggers.
  { type: 'tavern',      flag: 'firstTavern',      text: 'The tavern opens its doors. Laughter carries into the night.', after: ensureMayor },
  { type: 'barracks',    flag: 'firstBarracks',    text: 'The barracks is built. Recruits drill at dawn.',               after: ensureRival },
  { type: 'church',      flag: 'firstChurch',      text: 'Bells toll from the new church. The faithful gather.',         after: ensureBard },
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

  // Loop 071: happiness-threshold beats. 060 audit found no narrative
  // surface when happiness crosses critical thresholds. Fires once on
  // crossing 80 up (peak) or 20 down (crisis), with a cooldown flag
  // that clears when happiness crosses back to mid-range [35, 65] so
  // the same realm can experience cycles of glory and crisis.
  // Population >= 5 required so early-game fluctuations don't spam.
  if (G.population >= 5) {
    if (G.happiness >= 80 && !hasFlag('happyPeakActive')) {
      setFlag('happyPeakActive');
      setFlag('happyCrisisActive', false);  // reset opposite flag
      chronicle('The realm is glad. Doors stand open; songs carry further than they should.', 'milestone');
    } else if (G.happiness <= 20 && !hasFlag('happyCrisisActive')) {
      setFlag('happyCrisisActive');
      setFlag('happyPeakActive', false);
      chronicle('A grey mood settles over the realm. Doors close earlier; the bards hold their tongues.', 'milestone');
    } else if (G.happiness >= 35 && G.happiness <= 65) {
      // Mid-range — clear both flags so next crossing can re-fire
      if (hasFlag('happyPeakActive')) setFlag('happyPeakActive', false);
      if (hasFlag('happyCrisisActive')) setFlag('happyCrisisActive', false);
    }
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
  // Loop 056 (a-scene-that-happens-once, second take): a standing
  // stone found at dawn, inscribed with the kingdom's own name.
  // Exactly one per realm, seeded day [30, 200]. See checkStoneBeat.
  checkStoneBeat();
  // Loop 059 (surprise, chronicle-echo): at dawn, small chance to
  // resurface a prior memorable beat as a memory-fragment. See
  // checkEchoBeat.
  checkEchoBeat();
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
  // Loop 054 (the-fixer, 053 HIGH): pool expansion. 053's 155-day
  // programmatic play showed dreams started repeating by the 5th-6th
  // fire — the pre-054 pool was 8 threads × ~4 images, and `requires()`
  // gates narrow the surfaced set to 3-4 threads for most mid-game
  // realms. Adding `weather` (always-available) and `children` (pop >=
  // 10 gate) brings the pool above the repeat threshold.
  weather: {
    always: true,
    images: [
      'a rain that falls only inside the houses, warm and remembered',
      'snow arriving on the wrong side of the year, unmelted by morning',
      'a fog that knows every name and refuses to say them',
      'the wind carrying voices from a storm three hundred years past',
      'a single cloud shaped exactly like the realm\'s coastline',
    ],
  },
  children: {
    requires: () => (G.population ?? 0) >= 10,
    images: [
      'children laughing at a game the adults have forgotten how to play',
      'a lullaby sung by a mother whose own mother taught it, and so on',
      'small footprints leading up the wall and onto the ceiling',
      'a toy boat floating on a puddle that reflects a different sky',
      'the first word each child in the realm will speak, all in unison',
    ],
  },
};

// ── Loop 044: time-aware — real-world seasoning ──────────────
// A lens over the dream system: the real-world calendar biases
// which threads are more likely to surface, and a few special
// dates override the dream intro entirely. Same realm, same day,
// different month → different flavor. The game listens to the
// clock on the wall behind the player.
//
// `now` is injectable to keep the function testable.
export function _realWorldDreamLens(now = new Date()) {
  const month = now.getMonth(); // 0-11
  const date = now.getDate();   // 1-31
  const hour = now.getHours();  // 0-23

  // Seasonal weighting. Threads in `boost` are added to the avail
  // pool a second time, doubling their selection weight.
  let boost = [];
  if (month === 11 || month === 0 || month === 1) boost = ['hearth', 'warning'];          // winter
  else if (month >= 2 && month <= 4)              boost = ['harvest', 'water'];           // spring
  else if (month >= 5 && month <= 7)              boost = ['water', 'market'];            // summer
  else                                            boost = ['warning', 'forge'];           // autumn

  // Special-date overrides: intro line + tag tweak. Checked in
  // order; first match wins.
  let special = null;
  if (month === 9 && date === 31) {
    special = { intro: 'On the thinnest night of the year the realm wakes to dreams:', closer: 'Tomorrow the veil thickens again.' };
  } else if (month === 11 && date >= 20 && date <= 22) {
    special = { intro: 'On the longest night the realm wakes to dreams:', closer: 'The dark will turn now.' };
  } else if (month === 5 && date >= 20 && date <= 22) {
    special = { intro: 'On the shortest night the realm wakes to dreams:', closer: 'The light will turn now.' };
  } else if (month === 2 && date >= 19 && date <= 21) {
    special = { intro: 'On the balanced night the realm wakes to dreams:', closer: 'The seasons change hands.' };
  } else if (hour === 0) {
    special = { intro: 'At the witching hour the realm wakes to dreams:', closer: 'No one speaks of them, but everyone remembers.' };
  }

  return { boost, special };
}

// ── Loop 064: the approach — pre-event dream bias ────────────
//
// Looks up the kingdom's seeded nightmare-day and stone-day
// (same hashes 043/056 use), and if the current day is within a
// 10-day approach window of either beat AND the beat hasn't
// fired, returns a list of thread names to boost. Mirrors 044's
// `boost` shape so callers can extend avail[] identically.
//
// The window is exactly one dream-cadence cycle (055 set cadence
// to 10 days). Nightmare day 150 → dream on day 140 is the one
// fire inside the window; it gets the boost. Stone day 176 →
// dream on day 170 gets the boost. This targets the last dream
// before each lifetime event, so the player sees ONE biased dream
// heralding what's coming.
//
// Nightmare approach → 'warning' (cold foreboding in dreams).
// Stone approach → 'founding' + 'hearth' (settlement-memory
// imagery, so the stone feels like something the realm has been
// building toward even though no one raised it).
//
// Once the beat fires, its flag kills the boost — post-event
// dreams revert to normal cadence.
export function _approachingEventBoost() {
  const kname = G.kingdomName || 'Realm';
  const boost = [];

  if (!hasFlag('nightmare_fired')) {
    const nDay = _dreamHash(`${kname}_nightmare_day`) % 200 + 50;
    if (G.day >= nDay - 10 && G.day < nDay) boost.push('warning');
  }

  if (!hasFlag('stone_found')) {
    const sDay = _dreamHash(`${kname}_stone_day`) % 170 + 30;
    if (G.day >= sDay - 10 && G.day < sDay) {
      boost.push('founding');
      boost.push('hearth');
    }
  }

  return boost;
}

export function checkDreamBeat() {
  // Loop 055 (constant-shift): dream cadence 14 → 10 days. 053's
  // completionist play flagged mid-game chronicle-density as low:
  // only 1 beat every 14 days after day 2's build-beat cluster.
  // 054 expanded the thread pool to 10 threads × ~4-5 images, so
  // faster cadence won't immediately re-trigger the repetition
  // 054 just reduced. Expected result: ~50% more dreams in any
  // given mid-game window, still below the pool's repeat ceiling.
  // First 9 days still silent (protects the founding beat window).
  if (G.day < 10) return;
  if (G.day % 10 !== 0) return;
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

  // 044: the real-world calendar doubles-weight certain threads.
  // Only threads that are actually available in this realm get
  // boosted — we don't invent threads that don't apply.
  const lens = _realWorldDreamLens();
  for (const name of lens.boost) {
    if (avail.includes(name)) avail.push(name);
  }

  // Loop 064 (the approach, surprise): in the 5 days before a
  // once-per-realm beat fires, bias the dream pool toward thematic
  // pre-echoes. A nightmare approaches → warning imagery creeps in.
  // A stone is about to be found → dreams of founding/hearth surface.
  // The bias is subtle (one extra copy in the pool); the effect over
  // 3-5 dream fires is a noticeable lean. Attentive players feel
  // "something's coming" without any chronicle announcement.
  for (const name of _approachingEventBoost()) {
    if (avail.includes(name)) avail.push(name);
  }

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

  const intro = lens.special?.intro || 'At dawn the realm wakes to shared dreams:';
  const closer = lens.special?.closer || 'No one speaks of them, but everyone remembers.';
  const dreamText = `${intro} ${images.join('; then ')}. ${closer}`;
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

// ── Loop 056: a-scene-that-happens-once (second take) ────────
//
// Sibling to 043's NIGHTMARE. Once per realm, on a seeded day in
// [30, 200], a standing stone is discovered at dawn. The stone
// bears the kingdom's own name — every realm gets one, always
// inscribed with itself. No one remembers raising it.
//
// Where the nightmare is dark and rare-late-game (day 50-250),
// the stone is earlier (30-200) and quieter — just one chronicle
// line with tag 'stone'. No toast. Filed-then-forgotten-then-
// rediscovered in an old chronicle. Not every player will
// notice; future archivist ticks can surface it as a callback.
//
// Designed so the two once-per-realm beats don't overshadow each
// other: nightmare is a disturbance (danger toast, rare tag,
// character-conditional images), stone is a discovery (no toast,
// persistent tag, kingdom-name only).

const _STONE_DIRECTIONS = ['northern', 'southern', 'eastern', 'western'];
const _STONE_PHRASES = [
  (kname) => `carved into its face is a single word: ${kname}`,
  (kname) => `the kingdom's name is cut shallow into it: ${kname}`,
  (kname) => `a name is pressed into the stone, barely legible — ${kname}`,
  (kname) => `the wind has worn ${kname} into the stone's lean`,
];

export function checkStoneBeat() {
  if (hasFlag('stone_found')) return;
  const kname = G.kingdomName || 'Realm';
  const targetDay = _dreamHash(`${kname}_stone_day`) % 170 + 30;
  if (G.day !== targetDay) return;
  if (G.dayPhase > 120) return;  // dawn-only, same gate as the other beats
  setFlag('stone_found');

  const dir = _STONE_DIRECTIONS[_dreamHash(`${kname}_stone_dir`) % _STONE_DIRECTIONS.length];
  const phrase = _STONE_PHRASES[_dreamHash(`${kname}_stone_phrase`) % _STONE_PHRASES.length](kname);

  // Loop 058: store seeded tile coords so a renderer can draw the
  // stone at the location implied by the direction. Kept in
  // storyFlags (persists with the save) as plain numbers. Renderer
  // lives in enhancements.js and reads stone_x / stone_y on every
  // frame. Range [22, 58] keeps the tile comfortably inside the
  // 80×80 map's grassy interior without touching the shore.
  const offset = _dreamHash(`${kname}_stone_offset`) % 36 + 22;
  let sx, sy;
  if (dir === 'northern')      { sx = offset; sy = 22; }
  else if (dir === 'southern') { sx = offset; sy = 58; }
  else if (dir === 'eastern')  { sx = 58; sy = offset; }
  else                         { sx = 22; sy = offset; }
  setFlag('stone_x', sx);
  setFlag('stone_y', sy);

  chronicle(
    `A standing stone is found at dawn on the ${dir} edge of the fields — ${phrase}. No one remembers raising it.`,
    'stone'
  );
}

// ── Loop 059: chronicle-echo — old beats resurface as memory ─
//
// The realm was origin-heavy (first-build cluster + cycling
// dreams + two once-per-realm beats), but ONCE a chronicle beat
// fires it never resurfaces. 059 adds a loop-back: at dawn, a
// small chance (~2%) to lift a prior memorable beat and wrap it
// in a memory-frame so someone in the realm is "heard" recalling
// it. Tagged 'echo' so UI/future filtering can treat them
// distinctly. The effect is that the realm feels like it has a
// memory of itself — travelers mention the nightmare weeks after
// it was dreamed, bards still sing of the first bell.
//
// Selection rules:
// - dawn only (dayPhase < 120), same gate as the rest
// - G.day >= 30 (need some history)
// - at least 3 memorable entries must exist
// - deterministic per (kingdom, day) so two loads of the same
//   save on the same day always see the same echo (or lack)
// - never echoes misc or other 'echo' entries — only origin-class tags
//
// Loop 063 (the-fixer, closes 060 HIGH): added 'event' + 'season'
// to the pool. 060's audit found 059's original set missed these
// two tags even though both are legitimate origin-class beats —
// cloaked-stranger / plague (events.js) and season-transitions
// (main.js:310) never got echoed. 1-line correctness win.

const _ECHO_SOURCE_TAGS = new Set([
  'milestone', 'victory', 'character', 'birth',
  'dream', 'nightmare', 'stone', 'raid',
  'event', 'season',
  'research',  // added 065 alongside the new tag
]);

const _ECHO_FRAMES = [
  (text) => `An elder is heard telling a child: "${text}"`,
  (text) => `Travelers at the market repeat an old tale — "${text}"`,
  (text) => `The bards still sing of that day: "${text}"`,
  (text) => `Old folk remember. "${text}" they say.`,
];

export function checkEchoBeat() {
  if (G.dayPhase > 120) return;       // dawn only
  if (G.day < 30) return;             // require some history
  if (!G.chronicle || G.chronicle.length < 3) return;

  // Dedupe per day: one echo max per dawn
  if (hasFlag(`echo_${G.day}`)) return;

  const kname = G.kingdomName || 'Realm';
  const roll = _dreamHash(`${kname}_echo_${G.day}`) % 100;
  if (roll >= 2) return;  // ~2% chance

  // Build candidate pool. Source beats should be memorable AND at
  // least ~14 days old so the echo feels like distance, not repetition.
  const candidates = G.chronicle.filter(c =>
    _ECHO_SOURCE_TAGS.has(c.tag) && c.day <= G.day - 14
  );
  if (candidates.length < 1) return;

  setFlag(`echo_${G.day}`);

  const idx = _dreamHash(`${kname}_echo_pick_${G.day}`) % candidates.length;
  const src = candidates[idx];
  // Trim trailing newlines; keep the source prose intact in the quote.
  const quoted = src.text.trim();
  const frameIdx = _dreamHash(`${kname}_echo_frame_${G.day}`) % _ECHO_FRAMES.length;
  chronicle(_ECHO_FRAMES[frameIdx](quoted), 'echo');
}

export function toggleChroniclePanel() {
  const p = document.getElementById('chronicle-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}
