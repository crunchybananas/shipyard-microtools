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

// Loop 085 (the-fixer, 083 filed): once-per-realm beats are
// eviction-immune at the chronicle cap. 082/083 discovered the
// "noise evicts signal" failure mode — a high-rate chronicle
// writer could push rare lifetime beats (nightmare, stone,
// victory) out of the 300-entry window before the player read
// them. 084 codified this as an invariant in narrative-surfaces.md.
// 085 enforces it in code: when the cap kicks in, oldest
// NON-IMMUNE entries drop first; immune entries are preserved
// even if that means the buffer sits slightly over 300.
const _EVICTION_IMMUNE_TAGS = new Set(['nightmare', 'stone', 'victory', 'requiem']);

export function chronicle(text, tag='misc') {
  initChronicle();
  G.chronicle.push({
    day: G.day,
    season: G.season,
    tick: G.gameTick,
    text, tag,
  });
  // Cap to last 300 entries, preserving eviction-immune tags
  if (G.chronicle.length > 300) {
    const excess = G.chronicle.length - 300;
    const toRemove = [];
    // Collect oldest-first indices of non-immune entries, up to
    // `excess`. If all entries are immune, none are removed and the
    // buffer soft-overflows — acceptable because immune entries are
    // the point of the protection.
    for (let i = 0; i < G.chronicle.length && toRemove.length < excess; i++) {
      if (!_EVICTION_IMMUNE_TAGS.has(G.chronicle[i].tag)) {
        toRemove.push(i);
      }
    }
    // Remove in reverse so earlier indices stay valid
    for (let j = toRemove.length - 1; j >= 0; j--) {
      G.chronicle.splice(toRemove[j], 1);
    }
  }
}

export function hasFlag(key) { initChronicle(); return !!G.storyFlags[key]; }
export function setFlag(key, val=true) { initChronicle(); G.storyFlags[key] = val; }

// ── Render chronicle panel ─────────────────────────────────
// Loop 078: chronicle tag-filter UI. Uses the 14-tag taxonomy 075
// documented in loop/docs/narrative-surfaces.md. Chips above the
// entry list toggle per-tag filtering: click once to show only
// matching entries, click the same chip again (or click the All
// chip) to clear. Active chip gets accent border.
const TAG_ICONS = {
  milestone:'🏛️', event:'✨', character:'👤', raid:'⚔️',
  season:'🍃', death:'🪦', birth:'👶', victory:'🏆', misc:'📜',
  dream:'🌙', nightmare:'🌑', stone:'🗿', echo:'🔁', research:'📚',
  requiem:'🕯️',  // Loop 103: realm-end beat. 1 tag, 1 beat (so far).
};

// Module-local filter state (not persisted to save — this is a
// viewing preference, not realm state).
let _chronicleFilter = null;

export function setChronicleFilter(tag) {
  _chronicleFilter = (tag === _chronicleFilter || tag == null) ? null : tag;
  renderChroniclePanel();
}

export function renderChroniclePanel() {
  initChronicle();
  const c = document.getElementById('chronicle-content');
  if (!c) return;
  if (G.chronicle.length === 0) {
    c.innerHTML = '<div class="chron-empty">Your chronicle is blank. Shape the realm and it will record your deeds.</div>';
    return;
  }
  const seasonIcons = { spring:'🌱', summer:'☀️', autumn:'🍂', winter:'❄️' };

  // Figure out which tags actually appear in this realm's chronicle —
  // only show chips for present tags, so empty categories don't
  // clutter the filter row.
  const presentTags = new Set(G.chronicle.map(e => e.tag));

  // Build filter chip row: "All" + one chip per present tag
  let filterRow = '<div class="chron-filters">';
  filterRow += `<span class="chron-chip${_chronicleFilter == null ? ' active' : ''}" onclick="window.setChronicleFilter(null)">All · ${G.chronicle.length}</span>`;
  for (const [tag, icon] of Object.entries(TAG_ICONS)) {
    if (!presentTags.has(tag)) continue;
    const count = G.chronicle.filter(e => e.tag === tag).length;
    const active = _chronicleFilter === tag;
    filterRow += `<span class="chron-chip${active ? ' active' : ''}" onclick="window.setChronicleFilter('${tag}')">${icon} ${count}</span>`;
  }
  filterRow += '</div>';

  // Apply filter to entries
  const entries = _chronicleFilter == null
    ? G.chronicle
    : G.chronicle.filter(e => e.tag === _chronicleFilter);

  if (entries.length === 0) {
    c.innerHTML = filterRow + '<div class="chron-empty">No entries match this filter.</div>';
    return;
  }

  const byDay = {};
  for (const e of entries) {
    if (!byDay[e.day]) byDay[e.day] = [];
    byDay[e.day].push(e);
  }
  const days = Object.keys(byDay).map(Number).sort((a,b)=>b-a);
  let html = filterRow;
  for (const d of days) {
    const seas = byDay[d][0].season;
    html += `<div class="chron-day"><div class="chron-day-h">${seasonIcons[seas]||''} Day ${d}</div>`;
    for (const e of byDay[d]) {
      html += `<div class="chron-row"><span class="chron-tag">${TAG_ICONS[e.tag]||'📜'}</span><span class="chron-text">${e.text}</span></div>`;
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

// Loop 090 (refactor-only, closes 062 filed 28 ticks): state-triggered
// one-shot beats. Each entry: { flag, trigger(G)→bool, text(string or
// (G)→string), tag }. Fires once per realm when trigger first returns
// true. Text may be a function for dynamic prose (castle references
// mayor name + kingdom name). Checked in checkStoryBeats.
const NARRATIVE_BEATS = [
  { flag: 'firstBirth',        tag: 'birth',     trigger: G => G.stats && (G.stats.citizensBorn || 0) >= 1, text: 'A child is born in the realm. The first new life to call this land home.' },
  { flag: 'pop10',             tag: 'milestone', trigger: G => G.population >= 10,  text: 'Ten souls now call this land home.' },
  { flag: 'pop25',             tag: 'milestone', trigger: G => G.population >= 25,  text: 'Twenty-five citizens — a true town takes shape.' },
  { flag: 'pop50',             tag: 'milestone', trigger: G => G.population >= 50,  text: 'Fifty strong. Travelers on the road whisper of the rising realm.' },
  { flag: 'pop75',             tag: 'milestone', trigger: G => G.population >= 75,  text: 'Seventy-five subjects. Other lords now watch with envy.' },
  { flag: 'pop100',            tag: 'milestone', trigger: G => G.population >= 100, text: 'One hundred souls. A city is born.' },
  // Loop 119 (the-fixer, closes 118 HIGH): rewrote castleBuilt to drop
  // quoted direct speech + exclamation — 118 found this was the ONLY
  // beat with dialogue and only beat with "!" inside prose. Replaced
  // with "names it to endure a thousand years; the realm takes the
  // name" — the trailing clause is a deliberate callback to 116's
  // constellation beat ("The realm takes the name"), threading the
  // naming-ceremony voice across castle + constellation surfaces.
  { flag: 'castleBuilt',       tag: 'victory',   trigger: G => G.buildings.some(b => b.type === 'castle'),
    text: G => { const m = G.namedCharacters.mayor; return `The castle stands complete. ${m ? m.name : 'The heralds'} name it to endure a thousand years; the realm takes the name.`; } },
  { flag: 'firstRaidSurvived', tag: 'raid',      trigger: G => G.stats && G.stats.raidsSurvived >= 1, text: 'The first raid is turned back. The dead are buried; the living drink to the fallen.' },
  // Loop 092: year-milestones migrated from enhancements.js:5082
  // (first cross-file use of NARRATIVE_BEATS). 082 filed the grammar
  // bug: year2 text rendered "1 souls" when population=1. Fixed here
  // via text-as-function + conditional pluralization. Year N starts
  // at day (N-1)*28 + 1 in realm calendar; trigger uses G.day directly
  // so no year-math needed in the predicate.
  { flag: 'year2', tag: 'milestone', trigger: G => G.day >= 29,
    text: G => `One full year has passed. The realm enters its second year with ${G.population} soul${G.population === 1 ? '' : 's'}.` },
  { flag: 'year3', tag: 'milestone', trigger: G => G.day >= 57,
    text: G => `The third year dawns. ${G.kingdomName} has grown beyond its humble beginnings.` },
  { flag: 'year5', tag: 'milestone', trigger: G => G.day >= 113,
    text: 'Five years stand behind us. The chronicle grows long, the realm stands strong.' },
  // Loop 093 (surprise, 088-filed + un-filed founder-aging layer):
  // subsequent-winter beats. 088 captured the FIRST winter; 093 captures
  // the 2nd, 3rd, and 5th winters with tonal progression as the realm
  // (and its founder1) ages. Each gracefully degrades to a generic
  // settlers-narrative if 072 hasn't named founders yet.
  // Day thresholds: seasons are 7 days, year is 28. Winter boundaries:
  // year-1 day 22, year-2 day 50, year-3 day 78, year-5 day 134. Each
  // beat gates on winter season + sufficient day for that winter to be
  // reachable, so fired-once prevents re-fire across subsequent winters.
  { flag: 'second_winter_seen', tag: 'milestone',
    trigger: G => G.season === 'winter' && G.day >= 50,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `The second winter comes as no surprise. ${f} knows what to store, and what to wait out.`
        : 'The second winter comes as no surprise. The realm knows what to store, and what to wait out.';
    } },
  { flag: 'third_winter_seen', tag: 'milestone',
    trigger: G => G.season === 'winter' && G.day >= 78,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `The third winter. ${f} counts them now, the way elders count — pressing each one into memory.`
        : 'The third winter. The realm counts its own now.';
    } },
  { flag: 'fifth_winter_seen', tag: 'milestone',
    trigger: G => G.season === 'winter' && G.day >= 134,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `Five winters behind us. ${f} remembers the first, and speaks of it less often now.`
        : 'Five winters behind us. The oldest in the realm remember the first, and speak of it less often now.';
    } },
  // Loop 103 (surprise, 053 filed 50+ ticks): end-of-realm beat. Closes
  // the structural narrative gap 020/050/100 all flagged — the chronicle
  // is origin-heavy, death-silent. When population drops to 0 the realm
  // has fallen; this beat marks the moment. References founder1 by name
  // if 072 has fired (compounds with the 088/093/097 founder-arc).
  // New tag 'requiem' (justified per 075: no existing tag fits "realm
  // itself ends"). Added to _EVICTION_IMMUNE_TAGS so a flood of final
  // starvation/combat deaths doesn't cap-evict this last beat.
  // Loop 148 (surprise, un-filed, moratorium tick 2): wanderer
  // acknowledgment. 048 introduced the silent walker; 061 renamed it
  // `_wanderer` internally but kept it player-anonymous. 87 ticks
  // after 061, the wanderer still has ZERO narrative surface. 148
  // gives it ONE — a chronicle beat that acknowledges without
  // naming. Honors 048's original intent ("see if a later iteration
  // names it") by explicitly NOT naming. Tag: misc (reuse per 075;
  // aligns with elder-sayings' edge-of-voice register). Fires day
  // ≥ 50 (realm has lived long enough to have seen the figure at
  // least once — wanderer spawn is 55% per non-winter season, so
  // by year 2 the ~80%+ of realms have witnessed).
  { flag: 'wanderer_acknowledged', tag: 'misc',
    trigger: G => G.day >= 50,
    text: 'There is a figure that crosses the realm from one edge to the other, some seasons. No one knows where they go. No one calls them anything.' },
  // Loop 152 (surprise, un-filed, tick-146 founder-moratorium tick 6):
  // sibling to 148 — an ambient entity that has visual presence (enh.js
  // Loop 31 'ghosts' — wispy wraith spawning on grass/forest late at
  // night, ~30% per 500 ticks, zoom ≥ 0.7 only) but zero narrative
  // surface after 121 ticks. 148 gave the wanderer its first; 152
  // gives the ghost its first. Different focal: wanderer is a figure
  // that crosses edge-to-edge by day; the 152 surface is something
  // seen at night, by children, not confirmed by elders. Acknowledges
  // without naming (no "ghost" word in prose — 142 uses "winter-
  // ghost" for a DISTANT realm's news, keeping our ambiguity intact).
  // Tag: misc (reuse per 075 invariant; elder-saying register like
  // 148). Gate: day ≥ 60 + firstBirth (need children to have seen it).
  { flag: 'night_shape_seen', tag: 'misc',
    trigger: G => G.day >= 60 && G.storyFlags.firstBirth,
    text: 'There are nights when the youngest in the realm speak of a bright shape in the fields. No one asks them to describe it.' },
  // Loop 147 (surprise, un-filed, tick-146 founder-moratorium tick 1):
  // a great storm remembered. Location/weather-focal, NO founder
  // reference. Fires autumn of year 2+ (realm has lived long enough
  // to REMEMBER something). 5 storm-memory variants picked per-
  // kingdom hash; "the children born after do not believe it" gives
  // an intergenerational nod without naming anyone. Tag: event
  // (reuse per 075 invariant; 063 added event to echo-sources so
  // this can resurface).
  { flag: 'great_storm_remembered', tag: 'event', onFire: 'great-storm',
    trigger: G => G.storyFlags.year2 && G.season === 'autumn',
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const storms = [
        `the wind ran through ${kname} for a day and a night and stopped`,
        'rain fell hard and sideways until the wells overflowed',
        'a storm came from the east and bent the tallest trees',
        'the sky went the color of old bronze; no one spoke for an hour',
        'lightning struck nothing, but was seen for miles',
      ];
      const idx = _dreamHash(`${kname}_great_storm`) % storms.length;
      return `Some of the realm remember a great storm: ${storms[idx]}. The children born after do not believe it.`;
    } },
  // Loop 142 (surprise, un-filed): a letter from the other realm.
  // Opens up the WORLD beyond the island — the realm receives news
  // from a distant kingdom. Both the distant name and the news are
  // deterministic per kingdom (different hash seeds than founder/
  // constellation/stone pools). Cross-realm: same "Avalon" hears
  // from the same distant kingdom every time. Tag: event (reuse per
  // 075; 063 added event to _ECHO_SOURCE_TAGS so this can resurface
  // via 059 echo). Gate: firstMarket (a merchant network to carry
  // letters) + day ≥ 60 (realm has had time to establish trade).
  { flag: 'distant_letter_received', tag: 'event',
    trigger: G => G.storyFlags.firstMarket && G.day >= 60,
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const distantNames = [
        'Norrith', 'Velar', 'Ashen Fields', 'the Three Bays',
        'Oldspine', 'Maran', 'Drift-lee', 'Blackwell', 'Sylvain', 'Holm',
      ];
      const news = [
        'grain there is red, and their bells ring at dusk',
        'the wolves have been hunted clean; a winter-ghost walks their ridge',
        'their mayor has given their sword to a woman who would not take it',
        'their river runs backward one morning, then right again by noon',
        'a new star burns above their mountain, and they have named it',
        'a child has been born who speaks only in rhymes',
      ];
      const dIdx = _dreamHash(`${kname}_distant_name`) % distantNames.length;
      const nIdx = _dreamHash(`${kname}_distant_news`) % news.length;
      return `A traveler brings word from ${distantNames[dIdx]}: ${news[nIdx]}.`;
    } },
  // Loop 138 (surprise, un-filed): the shepherd's song. Once-per-
  // realm ambient beat: after founders are named AND cowpen is built
  // AND the season is cold (autumn/winter) AND the realm has
  // settled past day 30, founder2 is heard singing at the cowpen.
  // Gives founder2 a 5th canonical surface (sky-watcher + hearth-
  // door + namesake-candidate + audio-cue participation + shepherd-
  // singer). Compound extends 072 founders + 057 cowpen with a
  // gentle character moment. Tag: character (reuse per 075).
  { flag: 'shepherds_song_heard', tag: 'character', onFire: 'shepherds-song',
    trigger: G => {
      if (!G.storyFlags.founders_named) return false;
      if (!G.storyFlags.firstCowpen) return false;
      if (G.day < 30) return false;
      return G.season === 'autumn' || G.season === 'winter';
    },
    text: G => {
      const f = G.storyFlags.founder2 || 'one of the founders';
      return `${f} is heard singing at the cowpen one cold evening. The cattle stop moving, briefly, to listen.`;
    } },
  // Loop 134 (surprise, un-filed): a namesake. Once per realm, if
  // founders have been named (072) AND the realm has had ≥5 births,
  // a child is given one of the founders' names. Which founder is
  // deterministic per kingdom (hash-picked). Tag: character (034
  // aligned). Compound that extends 072 founders + firstBirth into
  // a continuing-generations surface.
  { flag: 'namesake_born', tag: 'character', onFire: 'namesake',
    trigger: G => {
      if (!G.storyFlags.founders_named) return false;
      const births = G.stats && (G.stats.citizensBorn || 0);
      return births >= 5;
    },
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const idx = _dreamHash(`${kname}_namesake_who`) % 3;
      const key = ['founder1', 'founder2', 'founder3'][idx];
      const f = G.storyFlags[key] || 'the founder';
      return `A child is born in the realm and takes the name ${f}. The news carries from house to house — no one gathers, but no one stays still.`;
    },
    // Loop 144 (the-fixer, 134 filed): actually rename the newest
    // citizen so the namesake is a real character in the realm, not
    // just a chronicle beat. Recomputes the same founder pick.
    after: G => {
      if (!G.citizens || G.citizens.length === 0) return;
      const kname = G.kingdomName || 'Realm';
      const idx = _dreamHash(`${kname}_namesake_who`) % 3;
      const key = ['founder1', 'founder2', 'founder3'][idx];
      const f = G.storyFlags[key];
      if (!f) return;
      // Newest citizen (most recently born/added).
      const c = G.citizens[G.citizens.length - 1];
      if (c && c.name !== f) c.name = f;
    } },
  // Loop 128 (surprise, un-filed): the longest night. Once per realm,
  // fires deep in a winter night (first winter is days 22-28;
  // dayPhase > 0.85 of dayLength = late-night). Gives founder3 a 4th
  // canonical surface (after 089 nightmare pool, 097 dream harvest
  // thread, 115 founders audio). Cast now: founder1=7, founder2=4,
  // founder3=4. 116's founder3-rebalancing continues.
  { flag: 'longest_night_seen', tag: 'milestone',
    trigger: G => G.season === 'winter' && G.day >= 22 && G.dayPhase > (G.dayLength || 3600) * 0.85,
    text: G => {
      const f = G.storyFlags.founder3;
      return f
        ? `The night is longer than any the oldest will admit to remembering. ${f} keeps watch at the fires.`
        : 'The night is longer than any the oldest will admit to remembering. The watchers at the fires do not speak.';
    } },
  // Loop 122 (surprise, un-filed): the stone weathers. A second beat
  // on 056's standing stone, fires once day ≥150 past first discovery.
  // Extends the stone's narrative arc: 056 discovery → 079 offering
  // → 122 weathering. Three beats about the same physical object over
  // ~150+ days. Tag: stone (reuses per 075 invariant; 085 makes it
  // eviction-immune). 4 prose variants picked by kingdom-hash —
  // different kingdoms see different kinds of weathering.
  { flag: 'stone_weathered', tag: 'stone',
    trigger: G => G.storyFlags.stone_found && G.day >= 150,
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const variants = [
        `Moss has begun to fill the name ${kname} on the standing stone.`,
        `The stone leans a little more than it did. The name ${kname} remains.`,
        `Weather has written lines on the stone beside the name ${kname} — marks only time reads.`,
        `A bird has nested in the lee of the stone. ${kname}, it continues to say.`,
      ];
      return variants[_dreamHash(`${kname}_weather`) % variants.length];
    } },
  // Loop 121 (the-re-shipper, 090 filed 31 ticks): first-snow beat
  // migrated from inline block (088) into NARRATIVE_BEATS. Honors 112
  // audio-surfaces.md invariant ("migrate inline beats to table before
  // adding audio"). Same trigger + text as the inline version.
  { flag: 'first_snow_seen', tag: 'milestone', onFire: 'first-snow',
    trigger: G => G.season === 'winter' && G.day >= 10,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `The first snow falls on the realm. ${f} stands in the fields a long time before going indoors.`
        : 'The first snow falls on the realm. The settlers stand in the fields a long time before going indoors.';
    } },
  // Loop 116 (surprise, un-filed): the realm names a constellation.
  // Every kingdom has a distinct star-pattern it remembers — the shape
  // it sees overhead when first autumn falls. Deterministic per
  // kingdom-name. Fires at dawn of first autumn-day past day 15
  // (autumn window is days 15-21 in year 1, 43-49 in year 2, etc; the
  // ≥15 gate just ensures realm has had a life before it names the
  // sky). Tag: milestone (reuse per 075). Text references founder2
  // when named — the 072 arc gives each founder a narrative lane;
  // 088/093/097/103 gave founder1 seasonality; 089 uses 1+2+3; 115
  // uses all three. 116 gives founder2 their own canonical role:
  // the one who looks up. First use of founder2 as sole focus.
  { flag: 'constellation_named', tag: 'milestone',
    trigger: G => G.season === 'autumn' && G.day >= 15,
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const shapes = [
        'the Hare', 'the Ash-Tree', 'the Broken Wheel', 'the Three Sisters',
        'the Lantern', 'the Old Wolf', 'the Shieldmaiden', 'the Seven Sisters',
        'the Midwife', 'the Plough', 'the Harp', 'the Empty Hand',
        'the Crown', 'the Fisherman', 'the Smith', 'the Open Door',
        'the Warning', 'the Traveler', 'the Black Bird', 'the Sheaf',
      ];
      const shape = shapes[_dreamHash(`${kname}_constellation`) % shapes.length];
      const f = G.storyFlags.founder2;
      return f
        ? `The first autumn stars stand clear above the eastern ridge. ${f}, looking up, names them ${shape}. The realm takes the name.`
        : `The first autumn stars stand clear above the eastern ridge. The elders name the pattern ${shape}. The realm takes the name.`;
    } },
  { flag: 'realm_fell', tag: 'requiem', onFire: 'requiem',
    trigger: G => G.day > 1 && G.population === 0,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `The last fire in the realm goes out. ${f}'s name is the last spoken, and then there is no one to speak it.`
        : 'The last fire in the realm goes out. There is no one left to tend it, and no one left to remember.';
    } },
];
// Loop 123 (refactor-only): added optional `onFire` field to
// NARRATIVE_BEATS entries. Replaces 111's inline `beat.tag ===
// 'requiem'` audio branch with a per-entry declaration. Per 112 audio-
// surfaces.md "2-is-coincidence, 3-is-a-pattern" rule: requiem was
// Pattern 2 alone; with first-snow/constellation/stone-weathers all
// wanting audio via the table (all tag:milestone or tag:stone that
// can't be distinguished by tag alone), the pattern needs
// generalization. onFire is that generalization.
//
// Usage: add `onFire: 'nameString'` to any NARRATIVE_BEATS entry; the
// dispatch loop calls `_PLAY_SOUND(beat.onFire)` after chronicle().
// Backward-compatible: entries without onFire fire silently, unchanged.

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

  // Loop 090 (refactor-only, closes 062 filed 28 ticks): once-fire
  // trigger-based beats share a shape (flag + trigger(G) + text + tag).
  // Consolidating 8 previously-inline beats (firstBirth + 5 pop + castle
  // + firstRaid) into NARRATIVE_BEATS mirrors the BUILDING_FIRST_BEATS
  // pattern. Happiness beats stay inline — they have re-fire semantics
  // (hysteresis reset) that don't fit a simple one-shot trigger.
  for (const beat of NARRATIVE_BEATS) {
    if (!hasFlag(beat.flag) && beat.trigger(G)) {
      setFlag(beat.flag);
      const text = typeof beat.text === 'function' ? beat.text(G) : beat.text;
      chronicle(text, beat.tag);
      // Loop 123 (refactor-only, generalizes 111's inline requiem audio
      // branch): per-entry `onFire` field. Any NARRATIVE_BEATS entry
      // with `onFire: 'soundName'` fires that sound after chronicle
      // writes. Backward-compatible (entries without onFire fire silently).
      if (beat.onFire) {
        try { if (_PLAY_SOUND) _PLAY_SOUND(beat.onFire); } catch (_e) {}
      }
      // Loop 144 (the-fixer, 134 filed): `after(G)` callback for
      // arbitrary side effects. Mirrors BUILDING_FIRST_BEATS' after:
      // field used for ensureCharacter hooks. Runs AFTER chronicle
      // and onFire audio — chronicle is the contract; side effects
      // are garnish.
      if (typeof beat.after === 'function') {
        try { beat.after(G); } catch (_e) {}
      }
    }
  }

  // Loop 088 (surprise): first-snow beat migrated to NARRATIVE_BEATS
  // in 121. Kept here as a sourcing breadcrumb — the beat now dispatches
  // through the table loop above with flag first_snow_seen.

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
  // Loop 072 (surprise): once per realm, the three founding settlers
  // are named. See checkFounderBeat.
  checkFounderBeat();
  // Loop 079 (surprise): offering at the stone. Cross-system beat
  // firing on happy-peak dawns once the 056 stone is placed.
  // See checkOfferingBeat.
  checkOfferingBeat();
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
    // Loop 097 (surprise, 089 filed): founders→dream. Converted from
    // array to function-form images so the founder1-conditional variant
    // can weave in when 072 has named the founders. Cross-refs the
    // 088/093 winter arc where founder1 is "the one who stands/counts/
    // remembers." Here the dream shows founder1 at the first fire.
    images: (G) => {
      const base = [
        'a boat of pale wood arriving at a shore that was not there yesterday',
        'nets of starlight pulled in empty',
        'a drowned crown resting on sea-washed stones',
        'three settlers at a fire that will not go out',
        'footprints in sand that the tide refuses',
      ];
      if (G.storyFlags.founders_named && G.storyFlags.founder1) {
        base.push(`${G.storyFlags.founder1} keeping the first fire alive, without effort or speech`);
      }
      return base;
    },
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
    // Loop 097: founder3-conditional variant. Harvest is the founders'
    // labor made visible across generations — founder3 takes the role
    // of the one who remembers the old counting rituals.
    images: (G) => {
      const base = [
        'wheat fields stretching into the sky, harvested by hands from above',
        'grain that speaks the old tongues when threshed',
        'bread baked by a mother no one remembers',
        'the first loaf each citizen ever tasted, warm again in their hands',
        'ears of corn with the kingdom\'s name hidden in their rows',
      ];
      if (G.storyFlags.founders_named && G.storyFlags.founder3) {
        base.push(`${G.storyFlags.founder3} counting grain by the handful, unable to remember how many handfuls`);
      }
      return base;
    },
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
    // Loop 097: founder2-conditional variant. Hearth is domestic
    // memory — founder2 standing at a door that opens on a room they
    // don't recognize. Complements the window-looking-forward image
    // already in the pool.
    images: (G) => {
      const base = [
        'every house lit at once, though no one struck a light',
        'the first hearth-smoke of the realm, visible again in the air',
        'a door that opens on a room the owner has never entered',
        'a window looking out on the realm as it will be in a hundred years',
      ];
      if (G.storyFlags.founders_named && G.storyFlags.founder2) {
        base.push(`${G.storyFlags.founder2} standing at a door that opens on a room they do not recognize`);
      }
      return base;
    },
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
  // Loop 089: founder-conditional fragments, gated on 072's founders_named flag.
  // Founders fire at day [3,6]; nightmare at [50,250] — so the flag will be set
  // by the time nightmare fires, unless the player somehow skipped 072's window.
  if (hasFlag('founders_named')) {
    const f1 = G.storyFlags.founder1;
    const f2 = G.storyFlags.founder2;
    const f3 = G.storyFlags.founder3;
    if (f1) pool.push(`${f1}'s footprints in fresh soil, leading only away from the realm`);
    if (f2) pool.push(`${f2} at the gate after sunset, not looking up`);
    if (f3) pool.push(`${f3}'s face on a stone that no hand in the realm carved`);
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

  // Loop 106 (surprise, un-filed): audio cue. A subtle low-chord
  // plays the one time the nightmare fires per realm. 064 filed a
  // "silent music cue on nightmare-APPROACH" idea; 106 ships the
  // fire-moment counterpart. Quiet enough to miss if the player
  // isn't listening — which fits the "rarest moment" philosophy.
  try {
    const ps = _PLAY_SOUND;
    if (ps) ps('nightmare');
  } catch (_e) {}
}

// Late-bound imports to avoid load-order coupling with story.js's
// position in the module graph. Set on module-load below.
let _NIGHTMARE_NOTIFY = null;
let _PLAY_SOUND = null;
import('./notifications.js').then(m => { _NIGHTMARE_NOTIFY = m.notify; }).catch(() => {});
import('./audio.js').then(m => { _PLAY_SOUND = m.playSound; }).catch(() => {});

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
// Loop 117 (the-re-shipper, 056 filed 61 ticks): expanded from 4 → 8
// phrase variants. 056's verification noted 3-of-8 kingdoms shared the
// same "barely-legible" phrase; doubling the pool halves that
// collision rate. New phrases keep the one-inscription-per-stone
// philosophy (the kingdom's own name is always the text), vary the
// descriptive framing.
const _STONE_PHRASES = [
  (kname) => `carved into its face is a single word: ${kname}`,
  (kname) => `the kingdom's name is cut shallow into it: ${kname}`,
  (kname) => `a name is pressed into the stone, barely legible — ${kname}`,
  (kname) => `the wind has worn ${kname} into the stone's lean`,
  (kname) => `moss has filled every letter of ${kname} but one`,
  (kname) => `the letters spelling ${kname} are deeper than any hand would carve them`,
  (kname) => `${kname} appears where rain has lightened the stone`,
  (kname) => `${kname}, cut as if the stone remembers being named`,
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

  // Loop 113 (the-fixer, 106-filed): stone chime. 3rd audio cue; Pattern
  // 1 per audio-surfaces.md (dedicated check-function). Ascending fifth
  // (E5 → B5) — brighter, consonant, "a thing was found." Reuses 106's
  // late-bound _PLAY_SOUND import.
  try { if (_PLAY_SOUND) _PLAY_SOUND('stone'); } catch (_e) {}
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

// ── Loop 072: the founders named (surprise) ──────────────────
//
// The day-1 founding beat describes "three weary settlers" but
// the settlers themselves stay nameless forever. 072 fills that
// gap: on a kingdom-seeded day in [3, 6] at dawn, a chronicle
// entry names the three founders. Names persist as story flags
// (founder1/founder2/founder3) so future echoes or lore-hunter
// ticks can reference them.
//
// Different from the 034 named-character system (mayor/bard/
// rival/smith/merchant/teacher) — those are building-rooted
// characters who appear ONCE a specific building exists. The
// founders pre-date any building; they're a fixed cast of the
// realm's beginning.
//
// Tag 'character' — auto-echo-eligible (059/063 pool).

const _FOUNDER_NAMES_POOL = [
  'Edda', 'Maren', 'Silas', 'Linna', 'Bram', 'Ivy', 'Torrin',
  'Hesper', 'Osric', 'Rhea', 'Corvin', 'Maia', 'Orin', 'Juno',
  'Wren', 'Thaddeus', 'Lira', 'Aldo', 'Bree', 'Finn',
];

export function checkFounderBeat() {
  if (hasFlag('founders_named')) return;
  if (G.day < 3) return;
  const kname = G.kingdomName || 'Realm';
  const targetDay = _dreamHash(`${kname}_founders_day`) % 4 + 3;  // [3, 6]
  if (G.day !== targetDay) return;
  if (G.dayPhase > 120) return;  // dawn-only, same gate as other beats
  setFlag('founders_named');

  // Pick 3 distinct names by per-slot hash, without replacement
  const pool = [..._FOUNDER_NAMES_POOL];
  const names = [];
  for (let i = 0; i < 3; i++) {
    const idx = _dreamHash(`${kname}_founder_${i}`) % pool.length;
    names.push(pool[idx]);
    pool.splice(idx, 1);
  }
  setFlag('founder1', names[0]);
  setFlag('founder2', names[1]);
  setFlag('founder3', names[2]);

  chronicle(
    `The three founders at last know each other's names: ${names[0]}, ${names[1]}, and ${names[2]}. The wicker packs are unpacked; the fire does not go out.`,
    'character'
  );

  // Loop 115 (the-composer, 106/111-filed founders-named cue; first use
  // of the tick-114 expanded challenge pool). Three-note minor triad,
  // one note per founder. Pattern 1 via this dedicated function.
  try { if (_PLAY_SOUND) _PLAY_SOUND('founders'); } catch (_e) {}
}

// ── Loop 079: offering at the stone (surprise) ───────────────
//
// Cross-system beat that can ONLY fire when three prior systems
// have all landed in the same realm:
//   - 056 stone is placed  (hasFlag('stone_found'))
//   - 071 happiness is at peak  (hasFlag('happyPeakActive'))
//   - 079 offering hasn't fired yet this realm
//
// Once per realm, on a qualifying dawn, ~15% probability fires a
// chronicle beat describing an anonymous offering at the stone.
// Narrative only — no resource cost, no visible sprite, no UI cue.
// Tag 'stone' (reuse, per 075 anti-tag-proliferation): keeps all
// stone-related beats together for filter/echo purposes.
//
// Feels like an interstitial moment that only a realm which has
// *become* happy and *has* the stone can experience. Players
// running an unhappy or sub-day-50 realm never see it.

const _OFFERING_ITEMS = [
  'a basket of new bread',
  'a rush of summer wildflowers',
  'a string of carved beads',
  'a small blue stone the rivers have not seen',
  'a child\'s drawing of the kingdom\'s gate',
  'a folded linen cloth the wind does not take',
];

export function checkOfferingBeat() {
  if (hasFlag('offering_made')) return;
  if (!hasFlag('stone_found')) return;
  if (!hasFlag('happyPeakActive')) return;
  if (G.dayPhase > 120) return;  // dawn gate
  if (G.day < 30) return;  // compounds require mid-game

  // ~15% per qualifying dawn, deterministic per (kingdom, day)
  const kname = G.kingdomName || 'Realm';
  const roll = _dreamHash(`${kname}_offering_${G.day}`) % 100;
  if (roll >= 15) return;

  setFlag('offering_made');

  // Pick item from the pool
  const idx = _dreamHash(`${kname}_offering_item`) % _OFFERING_ITEMS.length;
  const item = _OFFERING_ITEMS[idx];

  chronicle(
    `At dawn, ${item} was found at the standing stone. No one admits to placing it there.`,
    'stone'
  );

  // Loop 125 (the-composer, 106-filed, closes ORIGINAL 106 audio
  // list): offering gets a minor→major resolution chord. Sibling to
  // 106 nightmare's dissonance — same minor-interval opening, but
  // lifts to major within 0.3s. Pattern 1 (dedicated check-function).
  try { if (_PLAY_SOUND) _PLAY_SOUND('offering'); } catch (_e) {}
}

export function toggleChroniclePanel() {
  const p = document.getElementById('chronicle-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) renderChroniclePanel();
}
