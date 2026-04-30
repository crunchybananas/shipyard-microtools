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
  // Loop 260 (the-player [play]): once the realm has fallen, no more
  // beats. The 192 commit added G.realmEnded but never wired the
  // consumer ("chronicle stop" was filed at 192, never shipped). 260's
  // play tick observed 248 beats writing AFTER realm_fell at day 52
  // through day 720 — raids on a village with no population, echoes
  // referencing a kingdom no one remembers. Gate at the chronicle()
  // write itself so ALL call sites (NARRATIVE_BEATS / season-changes /
  // dreams / nightmares / echoes / raids / events) benefit from a
  // single check. The realm_fell beat itself still writes its requiem
  // because `after: G => { G.realmEnded = true; }` runs AFTER chronicle.
  if (G.realmEnded) return;
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
  // Loop 244 (the-fixer, 243 filed): first-townhall beat. Civic-formal
  // register, contrasts with tavern's "laughter" / church's "bells" /
  // barracks' "drill at dawn" — the realm's earlier institutional beats
  // are sensory; townhall's is procedural ("door is locked at dusk for
  // the first time"). Mayor is already named when townhall can be
  // built (per 243 isBuildingUnlocked gate); refer to mayor by name to
  // close the loop between the structural-unlock and the chronicle.
  { type: 'townhall',    flag: 'firstTownHall',
    text: G => {
      const m = G.namedCharacters?.mayor;
      return m
        ? `The town hall opens. ${m.name} sits at the long table for the first time; the door is locked at dusk for the first time. The realm has minutes that will outlast it.`
        : 'The town hall opens. The door is locked at dusk for the first time. The realm has minutes that will outlast it.';
    } },
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
  // ── AMBIENT-ENTITY ACKNOWLEDGMENT (misc tag) ─────────────────
  // A paired-grammar set (148 + 152) for giving ambient entities
  // that have VISUAL presence but no narrative surface their first
  // chronicle beat. Formalized as an invariant in loop/docs/
  // narrative-surfaces.md per 155.
  //
  //   Rules for future acknowledgments:
  //   1. Tag: misc (75's reuse invariant).
  //   2. Static string, no variants — entity is SINGULAR by nature;
  //      variants would imply plurality or collapse the ambiguity.
  //   3. No "name" word that would collapse the entity's intended
  //      anonymity. "No one calls them anything" / "No one asks
  //      them to describe it" / etc. — elder-silence register.
  //   4. Gate on timing or prerequisite that makes sighting
  //      plausible (wanderer: day ≥ 50; night-shape: day ≥ 60 +
  //      firstBirth).
  //   5. Does NOT contribute to founder arc bookkeeping. Useful
  //      during/after 146's founder-moratorium to diversify focal
  //      points.
  //   6. If the entity already has a kingdom name or a player
  //      interaction, use a different pattern — it's no longer
  //      ambient.
  //
  //   Candidates for future ticks: owls (enh.js 1587), frogs
  //   (enh.js 1865), rams (enh.js 1975), trade-ships (enh.js 1651),
  //   hawks. Each ~15 LoC. Space them out — 3-4 in rapid
  //   succession would start to feel like queue-drain per the
  //   155-filed pattern-grouping concern.
  //
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
  // Loop 166 (surprise, un-filed, post-moratorium): 3rd ambient-
  // entity acknowledgment. enh.js Loop 32 frogs (visible at dusk/
  // night at sand-tiles adjacent to water; croak stochastically;
  // ~zero player-noticed because zoom ≥ 1.0 to render) get their
  // first narrative surface. Different focal axis from 148 (day
  // figure crossing) and 152 (night sight at fields): water-edge
  // SOUND, paired with rain. "Two voices" reads as croaking + water
  // lapping; or as something stranger — preserves the ambiguity.
  // Static string; no "frog" word. Tag: misc (148/152 precedent).
  // Gate: spring/summer (frogs are vocal in warm seasons) + day ≥
  // 35 (settling-year window: year 2 spring 29-35; original 166's
  // ≥ 70 was a math mistake — ≥ 70 with spring/summer fires year
  // 3+ in practice (year 1 spring 1-7, summer 8-14; year 2 spring
  // 29-35, summer 36-42; year 3 spring 57-63, summer 64-70 → only
  // day 70 qualified, and most realms missed it). 178 lowered the
  // gate to 35 per 177 archivist's finding so spring of year 2 is
  // the natural fire window. 14-tick gap from 152 ambient-grammar
  // sibling honored. Continues 156's filed candidate list
  // (owls/frogs/rams/trade-ships/hawks).
  { flag: 'frog_voices_heard', tag: 'misc',
    trigger: G => G.day >= 35 && (G.season === 'spring' || G.season === 'summer'),
    text: 'There are evenings after rain when the water-edges speak in two voices. The realm does not name the things speaking.' },
  // Loop 196 (surprise, un-filed, post-195 skeptic-flag): EARLY-GAME
  // beat to counterbalance the late-arc bias 195 flagged. Fires only
  // in year-1 summer (days 8-14) — fills the THIN zone between founders
  // (days 3-6) and autumn beats (constellation day ≥ 15). Anti-anxious
  // tone: most early-realm prose has a settling/striving register; this
  // beat gives the realm one moment of "things are okay." Non-founder
  // (per 157 soft-cap), non-forgetting (per 195 saturation flag),
  // observational-elder register (sibling to 148/152/166).
  { flag: 'first_long_evening', tag: 'misc',
    trigger: G => G.season === 'summer' && G.day <= 14,
    text: 'There is a summer evening early in the realm when nothing is asked of anyone. The work is done. The fields hold heat into the dusk, and the fire is allowed to burn low.' },
  // Loop 207 (surprise, 196 + 199 filed): THIRD early-game beat. Fires
  // year-1 summer day 10+ — between 196 first_long_evening (day 8) and
  // the autumn day-15 pair (199 first_cold_morning + 116 constellation).
  // Inverts the typical realm-observes-world mood — instead of the realm
  // noticing/naming/finding things in its land, this beat gives the LAND
  // agency: "the land has agreed to be lived in." Mutual-recognition
  // register, distinct from 148/152/166's elder-silence and from
  // 184/190's forgetting. Per 203 positive authoring rule (closure
  // beats should surprise, not satisfy a pattern) this beat earns its
  // landing not by completing the early-game cluster but by introducing
  // a fresh axis (land-as-agent). Tag: misc (joins observational
  // cluster — 11 misc-tag beats now). Static prose (universal — every
  // realm reaches familiarity with its land regardless of kingdom name).
  // Year 1 progression now: founders day 3-6 → 196 long-evening day 8
  // → 207 fields-know-realm day 10 → 199 cold-morning + 116 constellation
  // day 15.
  { flag: 'fields_know_realm', tag: 'misc',
    trigger: G => G.season === 'summer' && G.day >= 10,
    text: 'There comes a season when the fields are no longer strange. The grass under bare feet is the realm\'s own; the path between buildings goes the right way without thought. The land has agreed to be lived in.' },
  // Loop 227 (surprise, post-Phase-C return to narrative): SECOND
  // USE of land-as-agent sub-type (207 was first). The WELL has
  // subjective agency — the water "felt" and "remembers" buckets.
  // Distinct from 207: that beat gave the LAND broad agency
  // (collective ground/path/grass); 227 gives a SPECIFIC OBJECT
  // (the well) subjective interiority. Different shape within the
  // same sub-type — promotes the pattern toward 3+ threshold.
  // Per 213 skeptic FINDING 2: this beat AVOIDS the META-frame
  // ("the realm doesn't see") that 212 used. The well-and-water
  // exist with their own awareness; the realm's awareness is not
  // commented on. Pure object-interiority.
  // Tag: misc (cluster sub-type land-as-agent now 2 uses).
  // Gate: year2 + well exists. The well must have stood through
  // at least one full cycle for the prose to land.
  { flag: 'well_remembers', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.buildings && G.buildings.some(b => b.type === 'well'),
    text: 'The well has been there since the realm\'s first thirsty summer. The water in the dark below has felt every bucket lowered to it, and remembers each one a long while.' },
  // Loop 229 (surprise, 227 filed): THIRD use of land-as-agent
  // sub-type. Diversifies agency-shape: 207 broad-LAND collective
  // ("agreed to be lived in"), 227 specific-OBJECT interiority
  // (water remembers buckets), 229 RELATIONAL-keeper (hearth holds
  // names of the dead). Year-3+ gate + earned-state requirement
  // (citizensDied >= 1) ensures the hearth has names to hold.
  // The "fire keeps them the same way it keeps wood" double-meaning
  // — fire keeps wood by burning it; suggests fire keeps memory by
  // consuming it — is the surprising image per 203 positive rule.
  // Avoids META-frame per 213 finding 2.
  // Tag: misc. Sub-type: land-as-agent reaches 3 uses (207/227/229)
  // — meets 3+ threshold for sub-type-to-invariant promotion
  // candidate. Whether to actually promote is a separate
  // contrarian-eligible decision per 188 demotion precedent.
  { flag: 'hearth_holds_names', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.stats && G.stats.citizensDied >= 1,
    text: 'In the long evenings the hearth seems to know which names belong to it — the ones who built it, who tended it, who died too young for it to learn well. The fire keeps them the same way it keeps wood.' },
  // Loop 240 (surprise, un-filed): TAG:CHARACTER moment for the
  // bard. Per 213 cluster-monoculture flag: diversify away from
  // misc tag (8 ticks of misc-tag narrative since 207); this beat
  // uses tag:character which is echo-eligible per 075/063. Not
  // founder, not mechanic-introduction (034 already announces);
  // a quiet INTERIORITY moment for the named bard. Closes with
  // a generalizing line "some songs the realm has had were never
  // sung aloud" — captures realm-has-unwitnessed-moments theme
  // WITHOUT breaking META-frame (per 213 finding 2; doesn't
  // commentate on the chronicle's omniscience).
  // Gate: bard named (church built per 034 hook) + day≥25 (bard
  // has been around ~19+ days for "composing a song" to land) +
  // spring/summer (creative-walking-by-river weather). Once per
  // realm.
  { flag: 'bard_unsung_song', tag: 'character',
    trigger: G => G.namedCharacters?.bard && G.day >= 25 && (G.season === 'spring' || G.season === 'summer'),
    text: G => {
      const b = G.namedCharacters.bard;
      return `There is an evening when ${b.name} composes a song no one will hear sung — they hum it to themselves walking back from the river, and by morning have already half-forgotten the second verse. Some songs the realm has had were never sung aloud.`;
    } },
  // Loop 245 (the-fixer, 240 filed): SMITH interiority moment.
  // Mirrors 240 bard's quiet-personhood shape: named-character does
  // something off-task. Bard composed a song; smith walks the river.
  // Closing image gives the fire (an inanimate forge element) quiet
  // agency — "and waits" — small land-as-agent shape WITHIN a tag:
  // character beat. Per 213 skeptic finding 2 NO META-frame.
  // Gate: smith named (blacksmith built per 034 hook → ensureSmith)
  // + day ≥ 30 + summer/autumn (work-weather; smith feels right
  // walking the river when the fire could be cooling). Once per
  // realm.
  { flag: 'smith_walks_river', tag: 'character',
    trigger: G => G.namedCharacters?.smith && G.day >= 30 && (G.season === 'summer' || G.season === 'autumn'),
    text: G => {
      const s = G.namedCharacters.smith;
      return `There is an afternoon when ${s.name}'s anvil falls silent for an hour past noon. The smith has gone walking to the river, alone, for reasons even ${s.name} does not name. The fire cools by a degree, and waits.`;
    } },
  // Loop 247 (the-fixer, 240+245 filed): TEACHER interiority moment.
  // 3rd character interiority beat (240 bard / 245 smith / 247
  // teacher); 2 remain (merchant / rival). Per 240 filing draft:
  // "the slate-board with a child's name still chalked on it."
  // Mood: a small artifact of childhood persistence noticed by the
  // teacher who chooses not to immediately erase it. The teacher's
  // small preservation IS the lift line — the realm doesn't act,
  // the teacher does, but quietly.
  // Tag:character. Gate: teacher named (school built per 034 hook
  // → ensureTeacher) + year2 (school has had time to accumulate
  // student-trace; year-1 school is brand-new). Once per realm.
  { flag: 'teacher_pauses_slate', tag: 'character',
    trigger: G => G.namedCharacters?.teacher && G.storyFlags.year2,
    text: G => {
      const t = G.namedCharacters.teacher;
      return `There is a morning when ${t.name} arrives at the schoolhouse and finds a child's name still chalked on the slate from yesterday. The child wrote their own name, slowly, three times, before being called home. ${t.name} does not wipe it clean for another hour.`;
    } },
  // Loop 249 (the-fixer, 240+245+247 filed): MERCHANT interiority
  // moment. 4th character interiority beat (240 bard / 245 smith /
  // 247 teacher / 249 merchant); 1 remains (rival). Reaching 4 uses
  // triggers the 248 [process] hoist-vs-stay decision review for
  // the named-character-interiority observed-pattern. Mood: small
  // obsessive-yet-meditative behaviour — counting as ritual not
  // verification. Closing line "counting is its own reason" —
  // gentle observation that some habits don't have purposes, they
  // have textures. Per 213 finding 2 NO META-frame.
  // Tag:character. Gate: merchant named (market built per 034 hook
  // → ensureMerchant) + autumn + day ≥ 40 (year-2+ autumn; markets
  // typically build mid-game so year-1 autumn would be too soon).
  { flag: 'merchant_counts_thrice', tag: 'character',
    trigger: G => G.namedCharacters?.merchant && G.season === 'autumn' && G.day >= 40,
    text: G => {
      const m = G.namedCharacters.merchant;
      return `There is an evening when ${m.name} closes the market early and counts the day's coins by lamplight. They count them three times. Each count is the same number; ${m.name} counts again anyway, because the lamp is warm and the night is cold, and counting is its own reason.`;
    } },
  // Loop 252 (the-fixer, 240+245+247+249 filed; 251 predicted):
  // RIVAL interiority moment. 5th-by-addition character interiority
  // beat (originally 4 filed at 240; 4 shipped; rival was 5th
  // candidate per 240 filing). 251 archivist predicted rival's
  // interiority shape would be DISTANT OBSERVATION matching the
  // canonical-role-matched register rule: rival's adversarial-
  // vigilance role → interiority of being-seen-from-afar.
  // PREDICTION HELD: this beat is the banner-on-far-ridge shape
  // 240 filing drafted, expressing the realm and rival as
  // far-off-neighbors aware of each other without active
  // engagement.
  // Closing line "in the way far-off neighbors are" humanizes
  // the adversarial relationship without resolving it.
  // Tag:character. Gate: rival named (barracks build per 034 hook
  // → ensureRival) + year3+ + autumn/winter (late-late-game feel).
  // Closes 5-of-5 character interiority arc; cluster sub-type
  // (per 251 STAY verdict) now at 5 uses.
  { flag: 'rival_banner_distant', tag: 'character',
    trigger: G => G.namedCharacters?.rival && G.storyFlags.year3 && (G.season === 'autumn' || G.season === 'winter'),
    text: G => {
      const r = G.namedCharacters.rival;
      return `There is an evening late in the year when ${r.name}'s banner is sighted on a far ridge — visible briefly between two crests, then gone. No challenge is sounded; no preparation is made. The realm and ${r.name} are aware of each other, in the way far-off neighbors are.`;
    } },
  // Loop 253 (the-fixer, 252 filed): MAYOR interiority moment.
  // 6-of-6 character literary cast closure. 251 predicted
  // PROCEDURAL WITNESSING for mayor's canonical civic-governance
  // role; 253 ships exactly that — mayor unlocks the town hall
  // before anyone else, watches the day arrive from the long
  // window, is alone in the realm for a moment. "Procedural
  // witnessing" reads as both routine governance AND lonely
  // stewardship.
  // Closing line "for now ${mayor.name} is the only person in it"
  // is the lift — the mayor's privileged position as first-up
  // doubles as a small private possession of the realm itself.
  // 6-FOR-6 PREDICTIVELY VALIDATED canonical-role-matched
  // register rule (after 252's 5-for-5).
  // Gate: mayor named (tavern build → ensureMayor) + year3 +
  // townhall exists (243 building required for the prose to land).
  // Once per realm; season-agnostic (mayor's morning routine is
  // year-round).
  // **6-OF-6 CHARACTER LITERARY CAST COMPLETE** at 253. Mirror
  // of 243 mechanic cast 6/6 closure at 140-tick lag.
  { flag: 'mayor_first_in_hall', tag: 'character',
    trigger: G => G.namedCharacters?.mayor && G.storyFlags.year3 && G.buildings && G.buildings.some(b => b.type === 'townhall'),
    text: G => {
      const m = G.namedCharacters.mayor;
      return `There is a morning when ${m.name} unlocks the town hall before the realm is awake and stands at the long window watching the day arrive. The first carts are not yet on the road. The first chimneys are not yet smoking. The realm will be busy soon; for now ${m.name} is the only person in it.`;
    } },
  // Loop 254 (surprise, un-filed, alternation after 7-tick narrative
  // streak): NEW SUB-TYPE habituation-recognition — the realm
  // recognizing its own habits as a second-order observation.
  // Distinct from sustained-state-recognition (which observes a
  // continuous external condition like peace/no-deaths/full-pop)
  // and from land-as-agent (which gives objects/land subjective
  // agency). Habituation-recognition is the realm noticing its own
  // *threshold of accumulated experience* — it has lived enough
  // nights for them to form a textured memory where some are
  // remembered separately and the rest blur. The lift line "the
  // fire is set without thinking now" — automaticity is the proof
  // of habituation. 9th sub-type of the observational-elder cluster
  // (1 use, threshold 3+; per 231 contrarian stays observed-pattern,
  // not invariant). Year-2 + autumn/winter gate (the realm needs to
  // have lived enough nights for the prose to land — autumn/winter
  // is when the night-falling-differently observation triggers).
  // Universal static prose — every realm experiences this. Tag misc.
  // Per 203 positive authoring rule: surprises by introducing a NEW
  // sub-type rather than reusing existing ones.
  { flag: 'nights_blur_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && (G.season === 'autumn' || G.season === 'winter'),
    text: 'There is a season when night falls differently — not later or earlier, but with more weight. The realm has lived enough nights that some are remembered separately and the rest blur into one long evening. The fire is set without thinking now.' },
  // Loop 280 (surprise, un-filed, alternation after 277/278/279):
  // LIMINAL-MOMENT-AWARENESS shape-extension per 276 invariant.
  // 2nd shape of habituation-recognition sub-type (sibling to 254
  // nights_blur_known). NEW ANGLE: where 254 captures AUTOMATICITY
  // (the realm's actions becoming unconscious through repetition),
  // 280 captures RHYTHM-AWARENESS (the realm's recognition of the
  // GAPS between actions — the liminal pause between work and rest
  // that recurs every evening). Different facet of habituation:
  // 254 is "doing without thinking"; 280 is "noticing the
  // unactioned moment." The lift line "no one has named this
  // moment but everyone knows it" captures universal silent
  // recognition — the realm shares awareness of moments it has
  // not given language to. Per 276 invariant: shape-extension
  // ships because LIMINAL-MOMENT angle the corpus has never
  // touched (existing habituation-recognition uses a single
  // angle: accumulated experience), not as count-advancement.
  // Habituation-recognition sub-type now has 2 shapes
  // (automaticity + rhythm-awareness). Gate: year2 (enough
  // evenings to recognize the rhythm) + late-day dayPhase >
  // 0.6 (the prose specifies "evenings"). Once-per-realm; tag
  // misc; static universal prose.
  { flag: 'liminal_moment_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.dayPhase > (G.dayLength || 3600) * 0.6,
    text: 'There is a moment most evenings when the realm is between things — the shutters not yet closed, the dishes not yet cleared, the children not yet called in. The realm holds its breath and lets it out. No one has named this moment but everyone knows it.' },
  // Loop 285 (surprise, un-filed, alternation after 281-283-284
  // fixer/archivist run): LANGUAGE-DRIFT shape-extension per 276
  // invariant. 3rd shape of habituation-recognition sub-type
  // (sibling to 254 AUTOMATICITY + 280 RHYTHM-AWARENESS). Per
  // 276 decision tree: prose surprises (mishearing-as-origin is
  // a genuinely fresh angle); new angle (254 captures unconscious
  // action, 280 captures rhythm/gaps, 285 captures linguistic
  // drift — three different DOMAINS of habituation); register
  // matches (declarative present-tense "There is a phrase"
  // parallels "There is a season"). Habituation-recognition
  // becomes the SECOND sub-type to grow 3 shapes after
  // individual-interiority (212/275/277). The lift line "would
  // not know how to use it now" captures the realm's recognition
  // that origin itself has become FOREIGN through accumulated
  // drift — different from forgetting (184/190 = no longer
  // remember WHO/WHAT) where the THING is preserved but the
  // KNOWLEDGE OF IT lapses; here the THING (a phrase) is fully
  // alive but its ORIGIN has become foreign. Year3+ gate ensures
  // enough accumulated culture for drift to be plausible. Once-
  // per-realm; tag misc; static universal prose.
  // 313 (the-fixer, 309 [process] gate-spreading): added `G.day >= 60`
  // — 3 days after year3 (d57) — to spread year3-only beats across
  // d60-d75 instead of all firing same checkStoryBeats call at d57.
  { flag: 'phrase_misheard_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 60,
    text: 'There is a phrase the realm uses that began as a mishearing of something else. The mishearing has lasted longer than the original. The realm does not remember the original; it would not know how to use it now.' },
  // Loop 290 (surprise, un-filed, alternation after 289 [play]): SEA-BELL
  // beat. 4th use of land-as-agent sub-type (sibling to 207 broad-land /
  // 227 specific-object well / 229 relational hearth) — but shipped per
  // 276 invariant because PROSE INTRODUCES NEW ANGLE: INHERITANCE-VS-CRAFT.
  // Existing land-as-agent uses observe land/objects MADE BY OR
  // BELONGING TO the realm. 290 introduces an OBJECT FROM ELSEWHERE
  // (the bell pulled from the sea) that the realm INHERITED rather than
  // made. The lift line "rings clearer than any bell the realm has cast"
  // captures the comparison: the realm acknowledges its FOUND OBJECTS
  // outshine its MADE OBJECTS. Cultural humility about craft. Distinct
  // from 184 stone-forgotten (forgetting an object) and 116 constellation
  // (naming a celestial); here the object's STORY is alive, the object
  // is in active use, and the comparison is acknowledged. Land-as-agent
  // sub-type now has 4 uses (3 made/own + 1 inherited). Per 276 +
  // 257: ships because new INHERITANCE-VS-CRAFT angle, not because
  // count needed advancing. Gate: church built + year3 (need both the
  // bell-host building + temporal distance for "no one alive remembers
  // the storm" to land). Once-per-realm; tag misc.
  // 324 (the-fixer, 323 [code]): added !storyFlags.sea_bell_lost_known
  // for bidirectional mutex with 319-A fallback. Without this, a realm
  // that loses the church pre-y3, fires sea_bell_lost, then rebuilds
  // the church would ALSO fire sea_bell_known — chronicle inconsistency.
  // Now both directions of "first-fired wins" hold.
  { flag: 'sea_bell_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.buildings && G.buildings.some(b => b.type === 'church') && !G.storyFlags.sea_bell_lost_known,
    text: 'There is a bell at the church that is said to have been pulled from the sea. No one alive remembers the storm; everyone tells the story. The bell still rings clearer than any bell the realm has cast.' },
  // Loop 292 (surprise, un-filed, alternation after 286-291 forward-
  // motion arc): PRESERVATION-WITHOUT-MEMORY shape-extension per 276
  // invariant. 3rd shape of forgetting sub-type (sibling to 184
  // stone_forgotten + 190 constellation_forgotten). Existing forgetting
  // uses are about LOSS — the thing fades, weathers, becomes unnamed.
  // 292 introduces PERSISTENCE through INERTIA — the artifact survives
  // intact, but its meaning is gone, and yet new owners DO NOT remove
  // it. Inertia-as-memorial. The carving stays not because anyone
  // reveres it but because no one decides to remove it. Per 276 +
  // 257: ships because NEW ANGLE (artifact-preserved-but-meaning-lost,
  // distinct from artifact-and-meaning-both-lost), not as count-
  // advancement. Forgetting sub-type 2 → 3 uses, joining individual-
  // interiority + habituation-recognition as 3-shape sub-types.
  // Gate: bakery built + year3. Once-per-realm; tag misc; static
  // universal prose.
  { flag: 'bakery_door_carving_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.buildings && G.buildings.some(b => b.type === 'bakery'),
    text: 'There is a name carved into the door of the bakery that no one alive remembers. The baker who carved it never said why. The new bakers leave it where it is.' },
  // Loop 294 (surprise, un-filed, alternation; pre-300 narrative
  // material): RESHAPED-BY-USE shape-extension per 276 invariant.
  // 5th shape of land-as-agent sub-type (sibling to 207 broad-land /
  // 227 specific-object well / 229 relational hearth / 290 inherited
  // bell). NEW ANGLE: physical deformation of an artifact through
  // generations of use, creating insider/outsider knowledge. The
  // step's worn dip looks broken to newcomers, invisible to regulars.
  // Distinct from 207 (land BECOMING familiar — broader transition);
  // 227 (water HOLDING memory of buckets); 229 (hearth HOLDING names);
  // 290 (object INHERITED from outside). 294 is RESHAPED-BY-USE: the
  // realm's own activity has worn the artifact into its current form;
  // the deformation IS the history. Land-as-agent sub-type now has
  // 5 shapes — the most of any sub-type. Per 276 + 257: ships because
  // RESHAPED-BY-USE angle the corpus has never touched, not as count-
  // advancement. Gate: church + year3 (need long-use temporal distance
  // for "many years" to land). Once-per-realm; tag misc.
  // 324 bidirectional mutex with 319-B fallback (per 323 [code]).
  { flag: 'church_step_worn_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.buildings && G.buildings.some(b => b.type === 'church') && !G.storyFlags.church_step_worn_lost_known,
    text: 'There is a step at the church door that has been worn to a curve by feet over many years. New visitors trip on it; regulars step over the dip without looking.' },
  // Loop 296 (surprise, un-filed, alternation after 295 review):
  // COLLECTIVE-EASE beat — first JOYFUL register in the corpus. Per 263
  // OUTSIDE-cluster precedent: ships as STANDALONE OUTSIDE the
  // observational-elder cluster, NOT as a sub-type extension. Different
  // REGISTER family from cluster's declarative-contemplative — this is
  // DYNAMIC + JOYFUL (the realm laughs, not observes). Distinct from
  // existing OUTSIDE beats: 263 META was self-aware-paradoxical
  // ("chronicle has grown longer than memory"); 296 is collective-
  // emotional ("the realm laughs"). The lift line "doesn't have to pay
  // attention to itself" captures EASE as the opposite of VIGILANCE —
  // the realm relaxed enough to laugh without worrying about why.
  // 2nd OUTSIDE-cluster beat in the corpus. Per 263's note: "If a 2nd
  // use of this register ships, document AS ITS OWN observation"; 296
  // is its own register, not a re-use of 263's META register. Gate:
  // year2 + happiness > 65 (need actual sustained contentment for
  // collective ease to be plausible). Once-per-realm; tag misc.
  { flag: 'realm_laughs_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.happiness > 65,
    text: 'There comes an evening when the realm laughs. Not at anything in particular — just laughs, here and there, the way a settled place laughs when it doesn\'t have to pay attention to itself.' },
  // Loop 297 (surprise, un-filed, 3 ticks pre-300): WONDER beat. 3rd
  // OUTSIDE-cluster beat after 263 META + 296 COLLECTIVE-EASE. Per 296
  // [code] filing + 296 OUTSIDE-cluster pattern: ships OUTSIDE with own
  // register. NEW REGISTER: CURIOUS-WITHOUT-RESOLVING — the realm
  // acknowledges mystery and chooses to remain in it. Different from
  // 263 META (chronicle as self-aware object) and 296 JOYFUL (collective
  // ease/laughter); WONDER is attention-without-conclusion. The lift
  // line "pretends not to listen, then listens anyway" captures social
  // fiction (realm has cultural rules about what to acknowledge) +
  // helpless curiosity (yet listens despite the rule). Self-deception
  // as cultural form. **3 OUTSIDE-cluster beats now** (263/296/297) —
  // 231 invariant-promotion threshold MET; OUTSIDE-cluster pattern
  // could be promoted at 300 milestone-letter or next archivist.
  // Pattern statement: each OUTSIDE beat documents its own register;
  // multiple OUTSIDE beats coexist as separate observations. Gate:
  // year2 (settled enough for attention drift). Once-per-realm; tag
  // misc.
  // 313 (the-fixer, 309 [process] gate-spreading): added `G.day >= 32`
  // — 3 days after year2 (d29) — to break this beat from the year2
  // transition cluster. Sole year2-ONLY beat, so a single offset is
  // sufficient.
  { flag: 'unplaceable_sound_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.day >= 32,
    text: 'There is sometimes a sound the realm cannot place — a creak, a far-off bell, a piece of song from across the water. The realm pretends not to listen, then listens anyway.' },
  // Loop 301 (surprise, un-filed, post-300 milestone): RITUAL-
  // PERSISTENCE-WITHOUT-ORIGIN shape-extension per 276 invariant.
  // 4th shape of forgetting sub-type (sibling to 184 stone-weathered /
  // 190 constellation-unnamed / 292 artifact-preserved-meaning-lost).
  // Existing forgetting uses: 184/190 = LOSS (thing AND meaning fade);
  // 292 = ARTIFACT preserved + meaning lost (the THING is an object).
  // 301 introduces RITUAL/ACTION preserved + ORIGIN lost (the THING is
  // a PRACTICE the realm performs without remembering why). Per 276 +
  // 257: ships because (a) fresh angle distinct from 292's artifact-
  // focus, (b) STRUCTURAL surprise — first beat to OPEN with a
  // QUESTION rather than declarative "There is X." The question-
  // answer-reflection rhythm is a corpus-novel prose structure. Lift
  // line "the first ringing was forgotten before the second was held"
  // captures origin-loss at the very moment of practice-establishment.
  // Forgetting sub-type now has 4 shapes; joins land-as-agent (5
  // shapes) as 2nd most-extended sub-type. Gate: church + year2
  // (need bell-host building + long-enough establishment for "always
  // has been"). Once-per-realm; tag misc.
  { flag: 'noon_bell_origin_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.buildings && G.buildings.some(b => b.type === 'church'),
    text: 'Why is the church bell rung at noon and not at any other hour? Because it always has been, in this realm. The first ringing was forgotten before the second was held.' },
  // Loop 303 (surprise, un-filed, alternation after 301 surprise + 302
  // fixer): IRRITATION-DOMESTICATED beat. 4th OUTSIDE-cluster register
  // per 298 invariant. Confirmed OUTSIDE registers ledger (pre-303):
  // 263 META / 296 JOYFUL / 297 WONDER. 303 introduces IRRITATION-
  // DOMESTICATED — a small daily annoyance the realm has accommodated
  // and even VALUES through its cultural use. Distinct from:
  // - 296 JOYFUL (positive emotion, celebration)
  // - 297 WONDER (curiosity-without-resolution, mystery)
  // - 263 META (paradoxical self-reference)
  // IRRITATION is NEGATIVE emotion the realm has DOMESTICATED; cursing
  // the wagon-track has become PART of going down the road, not a
  // problem to solve. The lift line "Filling it would be missed"
  // captures CULTURAL VALUE OF IMPERFECTION — fixing the annoyance
  // would erase the cultural fact of cursing-the-road. Self-aware
  // about own irritation. Per 298 OUTSIDE-cluster invariant: ships
  // standalone outside cluster with own register annotation. Gate:
  // year3 (need long-enough establishment for "no one has ever
  // bothered" to land). Once-per-realm; tag misc.
  // 313 gate-spread: G.day >= 65 (8 days after year3 d57).
  { flag: 'wagon_track_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 65,
    text: 'There is a wagon-track on the eastern road that no one has ever bothered to fill in, even though everyone curses it. The cursing is part of going down that road. Filling it would be missed.' },
  // Loop 305 (surprise, un-filed, alternation after 304 review):
  // EMERGENT-TRADITION shape-extension per 276 invariant + 2nd
  // STRUCTURAL surprise per 301 4-vector framework. 5th shape of
  // forgetting sub-type (sibling to 184/190/292/301). NEW ANGLE:
  // TRADITION-ORIGIN-NEVER-DECIDED — distinct from 301
  // RITUAL-PERSISTENCE-WITHOUT-ORIGIN ("first ringing forgotten")
  // because here the origin NEVER EXISTED as a decision; the practice
  // emerged COLLECTIVELY, with no first-instance to forget. STRUCTURAL
  // surprise: 2nd beat to open with non-declarative prose form
  // (imperative "Listen..." vs 301's question-opening). Per 301
  // [process] 4-vector framework: REGISTER (cluster) / ANGLE
  // (5th forgetting shape) / TAG (misc) / STRUCTURE (imperative
  // opening) — 305 varies on STRUCTURE as primary surprise. The lift
  // line "the realm always knows" captures EMERGENT-COLLECTIVE-
  // KNOWLEDGE: no one decided, but somehow everyone agrees. This is
  // how culture forms in the absence of authority. Forgetting sub-
  // type now at 5 shapes (was joint-leading; 307 promoted land-as-agent
  // to 6 sole-leader). Gate: year3 + EVER-HAD-CHURCH (per 311 fixer
  // closing 310 [code] partially). The prose lift line "the realm
  // always knows" captures practice INDEPENDENT of current substrate;
  // a realm that once had a church and lost it can still keep the
  // silent morning. Distinct from 290/294 (sea_bell / church_step_worn)
  // which describe specific objects requiring current presence.
  // Once-per-realm; tag misc.
  // 321 (the-fixer, 320 [code]): added `day>=58` per 320 [process] —
  // extends 313 gate-spread to condition-only year3 beats. Single day
  // post-y3 transition; spreads silent_morning out of the d57 cluster.
  { flag: 'silent_morning_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 58 && G.stats?.everHadBuilding?.church,
    text: 'Listen for the bell on the day the bell does not ring. Once a year the church keeps a silent morning. No one has ever decided which morning; the realm always knows.' },
  // Loop 307 (surprise, un-filed, alternation after 306 fixer): PATH-
  // KNOWS-ROUTINE shape-extension per 276 invariant + 3rd STRUCTURAL
  // surprise per 301 [process] 4-vector framework. 6th shape of
  // land-as-agent sub-type (sibling to 207/227/229/290/294). NEW
  // ANGLE: ANTICIPATORY-AGENCY — the path KNOWS where the citizen
  // is going BEFORE the citizen does. Distinct from prior 5 shapes:
  // 207 (land foreign→home), 227 (object holds bucket-memory), 229
  // (object holds names), 290 (object came from outside), 294
  // (object reshaped by use). 307 captures objects that KNOW IN
  // ADVANCE — anticipation as agency. STRUCTURAL surprise: 3rd
  // beat to open with non-declarative form (after 301 question +
  // 305 imperative): SECOND-PERSON address. The "you" addresses
  // the reader as if they were the realm's citizen — different
  // from imperative ("listen") + question ("why"). 3 STRUCTURAL
  // SURPRISES NOW (301 question / 305 imperative / 307 second-
  // person) — 231 invariant-promotion threshold MET; ready for
  // archivist review per 305 [process] filing. Lift line "the
  // realm has no need to ask where" captures privacy-WITHOUT-
  // surveillance: realm doesn't need to track citizens because
  // their paths already know. Land-as-agent now at 6 shapes —
  // sole leader (forgetting at 5). Gate: year3 (need long-enough
  // for "many times" to land). Once-per-realm; tag misc.
  // 313 gate-spread: G.day >= 70 (13 days after year3 d57).
  { flag: 'path_knows_routine_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 70,
    text: 'You walk down the path you have walked many times. The path knows where you are going before you do. The realm has no need to ask where.' },
  // Loop 312 (surprise, un-filed, alternation after 311 fixer): SOCIAL-
  // NORMS-DOMAIN extension of habituation-recognition sub-type per 276
  // invariant + 4th STRUCTURAL surprise per 308 invariant 4-vector
  // framework. 4th shape of habituation-recognition (sibling to 254
  // AUTOMATICITY action / 280 RHYTHM-AWARENESS time / 285 LANGUAGE-
  // DRIFT linguistic). NEW DOMAIN: SOCIAL-NORMS — habituation operating
  // on intergenerational rule-transmission. The grandmother's shush
  // CARRIES the rule WITHOUT articulating it; the realm has learned
  // that some things are not asked. STRUCTURAL surprise: 4th beat to
  // open with non-declarative form: DIALOG-OPENING (after 301 question /
  // 305 imperative / 307 second-person). The opening quoted speech is
  // VOICED FROM WITHIN THE REALM — distinct from imperative ("listen")
  // which addresses an outside listener, and from second-person ("you")
  // which addresses the reader. Dialog is OVERHEARD; it implies the
  // narrator is one of many citizens who happen to be near. **TESTS the
  // 308 STRUCTURE-ANGLE coupling prediction**: 4 of 4 STRUCTURAL
  // surprises now ship WITH fresh ANGLE. Coupling CONFIRMED at 4 uses
  // (next falsification opportunity is 5th structural). Lift line "no
  // one ever wrote down" captures TACIT-COLLECTIVE-AUTHORSHIP: rules
  // exist, are transmitted, but never crystallized into writing.
  // Distinct from 305 EMERGENT-TRADITION (no decision was ever made);
  // here decisions WERE made implicitly, just never recorded. Gate:
  // year3 (need long-enough for "no one ever" to land + intergenerational
  // scene needs older citizens). Once-per-realm; tag misc.
  // 313 gate-spread: G.day >= 75 (18 days after year3 d57). Latest of
  // the 4 year3-only beats; ships near the end of the y3 spread window.
  { flag: 'tacit_norms_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 75,
    text: '"Don\'t ask the well that." A grandmother stops a child mid-question. The realm has rules no one ever wrote down.' },
  // Loop 314 (surprise, 303 [code] filing): 5th OUTSIDE-cluster register
  // — TERROR, per 298 OUTSIDE-cluster invariant. Multi-axial surprise:
  // (1) REGISTER: OUTSIDE TERROR, distinct from the 4 prior OUTSIDE
  //     registers (META 263 paradoxical / JOYFUL 296 collective-ease /
  //     WONDER 297 curious-without-resolving / IRRITATION 303 negative-
  //     domesticated). TERROR is acute fear without object — distinct
  //     from IRRITATION's cultural-of-imperfection because TERROR is
  //     instantaneous + ungroundable. The realm experiences dread
  //     without being able to name what triggered it; the dread does
  //     not resolve.
  // (2) ANGLE: DREAD-WITHOUT-CAUSE — fear-as-experience without
  //     external referent. Distinct from raid mechanic (raid creates
  //     justified fear of imminent destruction); this beat captures
  //     UNFOUNDED collective-foreboding. The non-event ("no bell rang")
  //     is itself the unsettling thing. Lift: "Some mornings ask to
  //     be feared without showing why."
  // (3) STRUCTURE: 5th non-declarative opening — NEGATION-opening
  //     (after 301 question / 305 imperative / 307 second-person /
  //     312 dialog). NEGATION foregrounds ABSENCE as the agent of
  //     attention. Per 308 STRUCTURAL-surprise invariant: STRUCTURE-
  //     ANGLE coupling now at **5 of 5 confirming uses** — promotion-
  //     eligible threshold reached for promoting the coupling itself
  //     to a sub-rule. Filed for next archivist.
  // **TRIPLE-AXIS SURPRISE**: REGISTER + STRUCTURE + ANGLE all fresh
  // simultaneously. Most surprise-axes-fresh single beat in the corpus.
  // 4-vector framework production-default-mode (per 312 [process])
  // operating at peak — every fresh axis can be activated at once when
  // prose supports it. Gate: year3 + day >= 80 per 313 authoring
  // guideline (next available year3-only day-offset slot after 312
  // tacit_norms at 75). Once-per-realm; tag misc; static prose.
  { flag: 'morning_dread_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 80,
    text: 'No bell rang that morning. The realm waited, then waited longer, then went on with the day. Some mornings ask to be feared without showing why.' },
  // Loop 318 (surprise, 314 [code] filing): TRIPLE-AXIS surprise — 6th
  // OUTSIDE register (GRIEF / SUSTAINED-LOSS-DOMESTICATED) + 6th
  // STRUCTURAL opening (FRAGMENT) + SILENT-COLLECTIVE-ADJUSTMENT-TO-
  // LOSS angle. Per 315 sub-rule: STRUCTURE ships MUST pair with fresh
  // ANGLE — 318 complies (FRAGMENT + new angle).
  // (1) REGISTER: OUTSIDE GRIEF — sustained collective-loss recognition.
  //     Distinct from the 5 prior OUTSIDE registers: META 263 (paradox)
  //     / JOYFUL 296 (positive ease) / WONDER 297 (curious-without-
  //     resolving) / IRRITATION 303 (cultural-of-imperfection) /
  //     TERROR 314 (acute fear). GRIEF is sustained, not acute; the
  //     loss is integrated into routine rather than surfaced. Third
  //     NEGATIVE-tone register but qualitatively different — TERROR
  //     is foreboding without object; GRIEF is presence-of-absence
  //     normalized. The realm has been through enough death that
  //     "fewer plates" is unconscious correction, not a new policy.
  // (2) STRUCTURE: 6th non-declarative opening — FRAGMENT ("An empty
  //     seat."). Three-word incomplete sentence; no verb. Distinct
  //     from prior 5 (Q/I/2P/D/N) because FRAGMENT foregrounds an
  //     OBJECT-IN-VIEW with NO ACTION attached. The reader must
  //     supply the verb. Per 315 sub-rule: STRUCTURE ships must pair
  //     fresh ANGLE — 318 confirms by adding 6th OUTSIDE register.
  // (3) ANGLE: SILENT-COLLECTIVE-ADJUSTMENT-TO-LOSS — the realm
  //     CHANGES ITS BEHAVIOR ("sets fewer plates now") without
  //     articulating the loss ("No one names what changed").
  //     Distinct from 229 hearth_holds_names (names KEPT through
  //     loss) — here the names are SPECIFICALLY UNSPOKEN. Distinct
  //     from 184/190/292/301/305 forgetting (loss-of-knowledge) —
  //     here the loss IS known but not articulated. The
  //     LANGUAGE-AVOIDANCE around grief is itself the cultural
  //     adaptation.
  // **TRIPLE-AXIS surprise** (REGISTER + STRUCTURE + ANGLE all
  // fresh): second beat in the corpus to ship triple-axially after
  // 314. Establishes that triple-axis is not a one-off but an
  // emerging mature surprise pattern. STRUCTURE-ANGLE coupling
  // sub-rule (315) holds at 6/6 in production. Gate: year3 +
  // citizensDied >= 2 (need real losses for "fewer plates" to land
  // — single death is too thin to register as collective adjustment).
  // Once-per-realm; tag misc.
  // 321 gate-spread: day>=72 per 320 [process].
  { flag: 'empty_seat_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 72 && (G.stats?.citizensDied || 0) >= 2,
    text: 'An empty seat. The realm sets fewer plates now. No one names what changed.' },
  // Loop 319 (the-fixer, 311 [code] filing): fallback beats for raid-
  // destroyed realms that ONCE had a church or bakery but lost it
  // before reaching the year3 gate. Closes 310 [process] coverage gap
  // partially (sea_bell + church_step; bakery_door defers — its prose
  // requires a more substantive fresh angle to surprise post-loss).
  // Mutually-exclusive gates: each fallback fires only if (1)
  // everHadBuilding flag set (per 311/317 infrastructure) AND (2)
  // building NOT currently present AND (3) the corresponding ORIGINAL
  // beat's flag is NOT yet set. This prevents double-firing for
  // realms that experienced the original beat then lost the building.
  // Per 257 anti-completionism: each fallback ships its OWN fresh
  // angle distinct from the original — the original's prose described
  // the building's specific object/feature; the fallback describes
  // the BODILY-MEMORY or CULTURAL-STANDARD that survives the
  // building's loss.
  // 319-A: sea_bell_lost — INHERITED-FROM-OUTSIDE-PERSISTS-AS-STANDARD.
  // The bell was pulled from the sea; the church is gone. The bell's
  // tone became the realm's reference point for what a bell sounds
  // like — the cultural standard outlived the substrate. Distinct
  // from 290's INHERITED-FROM-OUTSIDE because 290 treats the bell as
  // present-and-ringing; 319-A treats the bell-tone as a cultural
  // measurement that endures even when no bell hangs in the realm.
  // 321 gate-spread: day>=62.
  { flag: 'sea_bell_lost_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 62 && G.stats?.everHadBuilding?.church && !G.buildings?.some(b => b.type === 'church') && !G.storyFlags.sea_bell_known,
    text: 'The realm remembers a bell that was pulled from the sea. The church that held it is gone. The bell\'s tone is still the realm\'s reference for what a bell ought to sound like — a measurement that outlived its instrument.' },
  // 319-B: church_step_worn_lost — RESHAPED-BY-USE-AS-BODILY-MEMORY.
  // The step is gone with the church; the gait it shaped is not.
  // The regulars who walked the dip still step a little high when
  // they pass the empty patch of ground — the wear has migrated
  // from stone into bodies. Distinct from 294 RESHAPED-BY-USE
  // because 294's lift line was about insider-knowledge-built-into-
  // stone; 319-B's lift line is about insider-knowledge-built-into-
  // gait — the body remembering what stone no longer can.
  // 321 gate-spread: day>=68.
  { flag: 'church_step_worn_lost_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 68 && G.stats?.everHadBuilding?.church && !G.buildings?.some(b => b.type === 'church') && !G.storyFlags.church_step_worn_known,
    text: 'The church is gone. The step that was worn to a curve by feet of three generations is gone with it. The regulars who knew the dip still step a little high when they walk past the empty patch of ground — the wear migrated from stone into bodies.' },
  // Loop 322 (surprise, 318 [code] filing): TRIPLE-AXIS surprise — 7th
  // OUTSIDE register (CONTENTMENT / settled-in-recurrence) + 7th
  // STRUCTURAL opening (REPETITION via anaphora) + RECURRENCE-AS-SELF-
  // RECOGNITION angle. **Closes 300 hopes #5** ("7th OUTSIDE register
  // by 350") at 7 of 7 done, 28 ticks ahead of milestone.
  // (1) REGISTER: OUTSIDE CONTENTMENT — passive-settled-in-recurrence.
  //     Distinct from prior 6 OUTSIDE registers: META (paradox) /
  //     JOYFUL (positive ease — ACTIVE laughter) / WONDER (curious-
  //     without-resolving) / IRRITATION (negative-domesticated) /
  //     TERROR (acute-fear) / GRIEF (sustained-loss). CONTENTMENT is
  //     the SECOND POSITIVE-tone register (after JOYFUL) but
  //     qualitatively different: JOYFUL is ACTIVE LAUGHTER at no
  //     particular trigger; CONTENTMENT is PASSIVE FITTING in a
  //     repeated pattern. The realm "does not mind" the recurrence —
  //     captures non-anxious acceptance.
  // (2) STRUCTURE: 7th non-declarative opening — REPETITION via
  //     anaphora ("The same X." "The same X." "The same X.").
  //     Distinct from prior 6 (Q/I/2P/D/N/F) because REPETITION
  //     foregrounds RHYTHMIC RECURRENCE rather than introducing a
  //     fresh form. The repeated structure IS the meaning — the
  //     prose's rhythm enacts the realm's recurrence.
  // (3) ANGLE: RECURRENCE-AS-SELF-RECOGNITION-AS-CONTENTMENT — the
  //     realm finds ITSELF in the repeated pattern (vs 312 SOCIAL-
  //     NORMS which is about TACIT TRANSMISSION; vs 285 LANGUAGE-
  //     DRIFT which is about UNCONSCIOUS HABITUATION). 322's angle:
  //     the realm RECOGNIZES itself as continuous through repetition,
  //     and FEELS GOOD about it.
  // **TRIPLE-AXIS surprise** (REGISTER + STRUCTURE + ANGLE all fresh):
  // third triple-axis ship after 314 + 318. Triple-axis pattern
  // continues stabilizing; 3 of last 5 surprise ticks ship triple-
  // axially. Per 315 sub-rule: STRUCTURE+fresh-ANGLE held at 7/7
  // confirming uses. Gate: year3 + day>=85 (next-available year-only
  // day-offset slot per 321 [code] authoring guideline). Once-per-
  // realm; tag misc.
  { flag: 'recurrence_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 85,
    text: 'The same bread rising. The same lamps lit. The same children asleep. The realm finds itself in an evening it has had many times before, and it does not mind.' },
  // Loop 325 (surprise, un-filed): SINGLE-AXIS surprise — 2nd naming-
  // place shape per 276 invariant. Naming-place sub-type was at 1
  // shape (193 EMERGENT-NAMING) — most-under-extended sub-type post-
  // saturation observations at 322. NEW ANGLE: NAME-AS-MEASUREMENT-
  // WITHOUT-VERIFICATION. The realm names a corner "the cold corner";
  // citizens use the name about ALL weather; no one has measured the
  // claim. The name does the work that measurement would. Lift "the
  // name has" reverses agency: the citizens haven't measured it but
  // the NAME has — the linguistic artifact carries the verification
  // that the people skipped. Distinct from 193 (place gains name
  // without ceremony) because 325 is about NAME-FUNCTIONING-AS-DATA
  // — naming substitutes for measurement.
  // **Single-axis ship**: STRUCTURE declarative (corpus default);
  // REGISTER INSIDE cluster naming-place; TAG misc. Per 257
  // anti-completionism + 312-322 multi-axial DEFAULTS but NOT
  // REQUIRED — single-axis surprise is valid when prose surprises
  // on its own merits. Naming-place sub-type promoted 1→2 shapes
  // (still 2nd-most-under-extended after eventual 8th land-as-agent
  // or 6th forgetting). Gate: year3 + day>=90 per 321 authoring
  // guideline (next-available slot post-322 at d>=85). Once-per-
  // realm; tag misc.
  { flag: 'cold_corner_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 90,
    text: 'There is a corner of the realm called the cold corner. Citizens say it of all weather. No one has ever measured it; the name has.' },
  // Loop 327 (surprise, 325 [code] filing): SINGLE-AXIS surprise — 3rd
  // naming-place shape per 276 invariant. Naming-place sub-type goes
  // 2→3 shapes. NEW ANGLE: CONTRADICTORY-NAMING-AS-INSIDER-DIRECTION.
  // The realm gives a place a name that becomes factually inverted
  // over time (e.g. "the new road" is actually the oldest); the realm
  // does NOT update the name; outsiders take the name at face value
  // and walk the wrong way; insiders know the contradiction and
  // navigate by it. The contradiction itself becomes a marker of
  // insider knowledge.
  // Distinct from prior naming-place shapes:
  //  - 193 EMERGENT-NAMING — place gains name from nothing; no
  //    decision; "it simply is"
  //  - 325 NAME-AS-MEASUREMENT — name does the work of measurement
  //    citizens skipped
  //  - 327 NAMING-CONTRADICTION-AS-INSIDER-MARKER — name is
  //    factually wrong + realm doesn't update it + the wrongness
  //    itself functions as cultural-insider/outsider distinction.
  // Distinct from 285 LANGUAGE-DRIFT (phrase mishearing) and
  // 312 SOCIAL-NORMS (tacit rule-transmission) and 294 RESHAPED-
  // BY-USE (church step worn — wear-as-insider-knowledge); 327 is
  // about the linguistic contradiction itself functioning as
  // cultural marker, not the wear/usage carrying knowledge.
  // **Single-axis ship** (ANGLE-only); per 325 [process] axis-
  // flexibility — multi-axial DEFAULTS but NOT REQUIRED. Gate:
  // year3 + day>=95 (next-available year-only slot post-325 at
  // d>=90, per 321 authoring guideline). Once-per-realm; tag misc.
  { flag: 'new_road_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 95,
    text: 'The new road is the oldest road in the realm. No one has ever proposed renaming it. Insiders know what is meant; outsiders point the wrong way.' },
  // Loop 329 (surprise, un-filed): SINGLE-AXIS surprise — 4th
  // individual-interiority shape per 276 invariant. Sub-type goes
  // 3→4 shapes. NEW ANGLE: PRIVATE-KNOWLEDGE-WITHOUT-RECOGNITION.
  // An anonymous citizen has expertise the realm has neither asked
  // for nor been told about; the knowledge persists silently as a
  // private morning practice. The knowing-without-display contrasts
  // with the realm's typical externalization patterns.
  // Distinct from prior individual-interiority shapes:
  //  - 212 MID-ACTION ("settler breathes out. No one sees.") —
  //    brief inner moment within action.
  //  - 275 TOTALIZING ("the world ends at the eastern ridge as
  //    far as they are concerned") — whole frame-of-reference.
  //  - 277 INFERENCE-BY-ABSENCE ("their seat at the inn is
  //    empty for the third evening in a row") — awareness
  //    mediated through routine disruption.
  //  - 329 PRIVATE-KNOWLEDGE-WITHOUT-RECOGNITION — hidden
  //    expertise that nobody knows the citizen has, exercised
  //    privately and recurrently. The naming-of-birds is not a
  //    secret kept; it is a competence never offered.
  // Distinct from 312 SOCIAL-NORMS (tacit-rule-transmission;
  // collective + transmitted) because 329 is INDIVIDUAL +
  // UNTRANSMITTED — the knowledge is real but never enters the
  // realm's collective awareness. Distinct from 322 RECURRENCE
  // (collective-self-recognition) because 329 is private, not
  // collective. Distinct from 285 LANGUAGE-DRIFT (linguistic
  // collective drift) because 329 is competence, not language.
  // **Single-axis ship** (ANGLE-only); per 325/327 axis-flexibility.
  // The lift "in the quiet before breakfast" anchors the privacy
  // in a daily moment of ordinary stillness — captures recurrent
  // unrecognized expertise as a daily fact of the realm.
  // Individual-interiority sub-type 3→4 shapes; ALL 9 INSIDE
  // sub-types now at 3+ shapes (cluster minimum still 3 — no
  // change to floor). Gate: year3 + day>=100 per 321 authoring
  // guideline (next-available year-only slot post-327 at d>=95).
  // Once-per-realm; tag misc.
  { flag: 'bird_namer_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 100,
    text: 'There is a citizen who knows every bird in the realm by sound. No one has asked, and no one has been told. The knowing happens every morning, in the quiet before breakfast.' },
  // Loop 331 (surprise, 329 [code] filing): SINGLE-AXIS surprise — 5th
  // sustained-state-recognition shape per 276 invariant. Sub-type was
  // most-under-extended at 3 shapes (most-under-extended target per
  // 329 [process]); 331 promotes 3→4. NEW ANGLE: NORMALIZATION-
  // THROUGH-ACCUMULATION. The realm crosses a SEASONAL-CYCLE
  // threshold: the third winter feels indistinguishable from the
  // second; winter has shifted from EVENT to BACKGROUND. Threshold
  // is not a count crossed but a TRANSFORMATION (event → weather).
  // Distinct from prior sustained-state shapes:
  //  - 211 sustained-peace 50d — count threshold (50 days no raid)
  //  - 228 no-death 100d — count threshold (days since last death)
  //  - 230 full-pop — ratio threshold (current/max = 1)
  //  - 331 winter-normalized — TRANSFORMATION threshold (recurring
  //    cycle becoming background). All prior 3 are MOMENTARY-
  //    crossings; 331 is CHARACTER-OF-EXPERIENCE crossing.
  // Distinct from 254 AUTOMATICITY (action without thinking; subject
  // is action, not season) and 246 first_thaw (year2+spring; subject
  // is the moment of seasonal arrival, not seasonal ROUTINIZATION).
  // 331's lift "Winter has become weather" reframes winter from
  // notable-event to ordinary-condition — captures the moment when
  // accumulated experience erases anticipation.
  // **Single-axis ship** (ANGLE-only); 4th consecutive single-axis
  // surprise (after 325/327/329) — pattern continues as production
  // default for ANGLE-only ships. Sustained-state-recognition sub-
  // type 3→4 shapes; **8 of 9 INSIDE sub-types now at 4+ shapes**
  // (only naming-place at 3 remaining). Gate: year3 + winter — uses
  // SEASONAL gate rather than day-offset because year3-winter
  // naturally distributes across the realm's seasonal cycle (per
  // 254 nights_blur precedent: year2 + autumn/winter; per 246
  // first_thaw: year2 + spring d>=32). The seasonal condition
  // provides natural spread without explicit day-offset. Once-per-
  // realm; tag misc.
  { flag: 'winter_normalized_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.season === 'winter',
    text: 'By the third winter the realm has stopped counting. The third frost feels neither earlier nor later than the second. Winter has become weather.' },
  // Loop 332 (surprise, 327 [code] filing): MULTI-AXIAL surprise — 4th
  // naming-place shape per 276 invariant + 2nd use of REPETITION
  // STRUCTURAL form per 308 invariant. Breaks 4-tick single-axis
  // streak (325/327/329/331); intentional return to multi-axial when
  // prose supports.
  // (1) ANGLE: NAMED-AFTER-WHO-IS-GONE — place name persists past
  //     the person it referenced. Distinct from prior 3 naming-place
  //     shapes:
  //      - 193 EMERGENT-NAMING (place gains name from nothing)
  //      - 325 NAME-AS-MEASUREMENT (name does verification work)
  //      - 327 CONTRADICTORY-NAMING (name is factually inverted; cultural marker)
  //      - 332 NAMED-AFTER-WHO-IS-GONE (name preserves person past their life)
  //     Distinct from 229 hearth_holds_names (hearth as keeper of
  //     names; INTERIOR/communal preservation) because 332 is
  //     EXTERIOR/geographic preservation — places carry names
  //     attached to absent referents.
  // (2) STRUCTURE: REPETITION via anaphora ("Hilda's bridge. Hilda's
  //     well. Hilda's path.") — 2nd use of REPETITION form (1st was
  //     322 recurrence "The same X. The same X. The same X."). Same
  //     structural form, fresh angle. Per 315 sub-rule: STRUCTURE
  //     ship MUST pair fresh ANGLE — 332 complies (NAMED-AFTER-WHO-
  //     IS-GONE is fresh angle distinct from 322 RECURRENCE-AS-SELF-
  //     RECOGNITION). 8th confirming use of 315 sub-rule (was 7 at
  //     322).
  // (3) Multi-axial: ANGLE + STRUCTURE (declarative resolution makes
  //     register INSIDE cluster; no fresh REGISTER axis). The
  //     anaphora makes the reader EXPERIENCE the name's repetition
  //     across the geography directly, then the resolution reveals
  //     the absent referent. The form enacts the realm's preservation
  //     mechanism: each "Hilda's" repeats the absence into existence.
  // **Multi-axial ship #4** (after 314/318/322 triple-axis multi-
  // axials); 332 is dual-axis (REGISTER stays default INSIDE-cluster).
  // Naming-place sub-type 3→4 shapes; only naming-place was at 3
  // post-331; now naming-place at 4 + sustained-state at 4 + 7
  // others at 4+; **CLUSTER MINIMUM AT 4 SHAPES** as next milestone
  // candidate. Gate: year3 + day>=105 (next-available year-only slot
  // post-329 at d>=100; 331 used seasonal gate so d=105 still open).
  // Once-per-realm; tag misc.
  { flag: 'lingering_name_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 105,
    text: 'Hilda\'s bridge. Hilda\'s well. Hilda\'s path. There has not been a Hilda in years; the realm carries her by accident.' },
  // Loop 334 (surprise, 329 [code] filing): MULTI-AXIAL surprise — 5th
  // individual-interiority shape per 276 invariant + REPETITION re-use
  // (3rd use of STRUCTURAL form). NEW ANGLE: BODILY-INHERITED-MEMORY-
  // WITHOUT-CONSCIOUS-AWARENESS. An anonymous citizen walks like an
  // ancestor without knowing they do; the body retains a physical
  // pattern the mind never learned. The lift "a kind of memory the
  // body keeps without the mind" is the angle's compressed statement.
  // Distinct from prior 4 individual-interiority shapes:
  //  - 212 MID-ACTION (inner moment within action; no inheritance)
  //  - 275 TOTALIZING (frame-of-reference; no body)
  //  - 277 INFERENCE-BY-ABSENCE (awareness via routine disruption;
  //    requires absence)
  //  - 329 PRIVATE-KNOWLEDGE-WITHOUT-RECOGNITION (hidden expertise;
  //    knowledge IS in mind, just unshared)
  //  - 334 BODILY-INHERITED-MEMORY-WITHOUT-CONSCIOUS-AWARENESS —
  //    knowledge in BODY but NOT in mind; passes through generations
  //    via posture/gait, not language.
  // Distinct from related angles:
  //  - 312 SOCIAL-NORMS (collective+rule-transmission via shush);
  //    334 = INDIVIDUAL+gait-transmission via lineage.
  //  - 285 LANGUAGE-DRIFT (collective phrase mishearing); 334 =
  //    individual physical inheritance.
  //  - 319-B church_step_worn_lost (collective+responsive: the step
  //    is gone but bodies retain its shape because they EXPERIENCED
  //    it); 334 = individual+inherited: body retains shape never
  //    experienced because ancestor experienced it.
  // STRUCTURE: REPETITION via anaphora ("Their X walked this way" ×
  // 2 + resolution). 3rd use of REPETITION form (1st 322 RECURRENCE,
  // 2nd 332 NAMED-AFTER-WHO-IS-GONE). Per 315 sub-rule: structure
  // re-use must pair fresh ANGLE — 334 complies. **9th confirming
  // use of 315 sub-rule** (was 8 at 332).
  // Multi-axial #5 (after 314/318/322 triple-axis + 332 dual-axis).
  // Re-establishes that multi-axial defaults are valid alongside the
  // 325-331 single-axis streak. The 4-vector framework permits all
  // combinations per-prose. Individual-interiority sub-type 4→5
  // shapes; **first INSIDE sub-type to reach 5+ shapes since 332's
  // cluster-minimum-4 milestone** (joins forgetting at 5; 6 sub-
  // types remain at 4). Cluster-uniformity advances asymmetrically
  // — floor stays at 4 but individual sub-types extend further.
  // Gate: year3 + day>=110 (next-available year-only slot post-332
  // at d>=105). Once-per-realm; tag misc.
  { flag: 'inherited_walk_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 110,
    text: 'Their grandmother walked this way. Their mother walked this way. They walk this way and have never noticed. The realm has not told them. The walking is a kind of memory the body keeps without the mind.' },
  // Loop 336 (surprise, un-filed): SINGLE-AXIS surprise — 6th forgetting
  // shape per 276 invariant. Forgetting sub-type 5→6 shapes; joins
  // land-as-agent at 6 (now 2 sub-types tied at sole-leader level).
  // NEW ANGLE: ACTIVE-FORGETTING-AS-PEDAGOGY. The realm CHOOSES not
  // to teach a custom; the elders remember it but deliberately do
  // not transmit it; the children grow up without it. The forgetting
  // is ACTIVE and FORWARD-LOOKING ("will be complete in one
  // generation") rather than passive or origin-loss.
  // Distinct from prior 5 forgetting shapes:
  //  - 184 stone_forgotten — OBJECT WEATHERED (passive loss)
  //  - 190 constellation_forgotten — PATTERN UNNAMED (passive loss)
  //  - 292 bakery_door_carving_known — ARTIFACT-PRESERVED-MEANING-
  //    LOST (artifact intact + idea gone)
  //  - 301 noon_bell_origin_known — RITUAL-PERSISTENCE-WITHOUT-ORIGIN
  //    (action persists + start gone)
  //  - 305 silent_morning_known — EMERGENT-TRADITION (origin never
  //    existed as decision)
  //  - 336 ACTIVE-FORGETTING-AS-PEDAGOGY — DECISION exists +
  //    elders remember + transmission DELIBERATELY WITHHELD; the
  //    forgetting is a project the realm is currently completing.
  // Distinct from related angles:
  //  - 312 SOCIAL-NORMS (tacit-transmission via shush; rule TRAVELS
  //    silently); 336 = rule WITHHELD, doesn't travel
  //  - 285 LANGUAGE-DRIFT (collective phrase mistransmission); 336
  //    is non-transmission, not mistransmission
  //  - 305 EMERGENT-TRADITION (no decision but practice formed);
  //    336 is decision-NOT-to-teach (the inverse: practice exists,
  //    decision is to let it die)
  // Forgetting sub-type now has TWO temporal orientations: PAST-
  // ORIENTED (184/190/292/301/305: things lost or origin obscured)
  // + FUTURE-ORIENTED (336: forgetting a current realm is actively
  // completing). Lift "The forgetting will be complete in one
  // generation" makes the future-orientation explicit and time-
  // bounded.
  // **Single-axis ship** (ANGLE-only); STRUCTURE declarative
  // (corpus default); REGISTER INSIDE cluster; TAG misc. Per 257
  // axis-flexibility — multi-axial DEFAULTS but NOT REQUIRED.
  // Forgetting 5→6 shapes; **2 sub-types now at 6 shapes** (joins
  // land-as-agent). Total INSIDE shapes: 37. Cluster avg 4.1
  // (was 4.0 at 334). Gate: year3 + day>=115 (next-available
  // year-only slot post-334 at d>=110). Once-per-realm; tag misc.
  { flag: 'unteach_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 115,
    text: 'There is a custom the elders remember and have chosen not to teach. The children grow up without it. The forgetting will be complete in one generation.' },
  // Loop 337 (surprise, un-filed): SINGLE-AXIS surprise — 5th habituation-
  // recognition shape per 276 invariant. Sub-type 4→5 shapes; joins
  // individual-interiority + forgetting at 5. NEW ANGLE: NON-CORRECTION-
  // AS-CULTURAL-ENFORCEMENT. The realm has converged on a way of holding
  // the cup; strangers do it wrong; no one corrects them — the realm
  // waits for them to leave instead. Cultural enforcement happens
  // through PASSIVE EXCLUSION rather than ACTIVE CORRECTION.
  // Distinct from prior 4 habituation shapes:
  //  - 254 AUTOMATICITY (action without thinking; INTERNAL automaticity)
  //  - 280 RHYTHM-AWARENESS (time-cycle noticed; TEMPORAL)
  //  - 285 LANGUAGE-DRIFT (linguistic; PHRASE)
  //  - 312 SOCIAL-NORMS (tacit-rule-transmission via SHUSH; ACTIVE
  //    correction)
  //  - 337 NON-CORRECTION-AS-CULTURAL-ENFORCEMENT — gestural cultural
  //    marker enforced by SOCIAL DISTANCE, not active correction. The
  //    realm recognizes "wrong" but doesn't correct; instead waits for
  //    the wrongness to leave.
  // Distinct from related angles:
  //  - 327 CONTRADICTORY-NAMING-AS-INSIDER-MARKER (linguistic marker;
  //    outsiders point wrong way + GET DIRECTED): 337 = gestural marker
  //    + outsiders NOT corrected at all (realm waits them out).
  //  - 312 SOCIAL-NORMS: ACTIVE shush ("Don't ask the well that"); 337
  //    = absence-of-correction as enforcement.
  //  - 322 RECURRENCE (CONTENTMENT in repetition; OUTSIDE register);
  //    337 is INSIDE habituation territory.
  // Habituation-recognition sub-type now spans 5 domains: ACTION (254)
  // / TIME (280) / LANGUAGE (285) / RULE-TRANSMISSION (312) / GESTURE-
  // ENFORCEMENT (337). The 5th shape adds a domain not previously
  // covered. Lift "the realm waits for them to leave" captures
  // passive-aggressive cultural enforcement — the realm doesn't NEED
  // to correct because the strangers will leave eventually anyway.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster. Sub-type 4→5 shapes; **3 sub-types now at 5+ shapes**
  // (forgetting/individual-interiority/habituation) — joins forgetting
  // at 6 already at sole-leader; closer to LAND-AS-AGENT's 6. Total
  // INSIDE shapes: 38; cluster avg 4.2/sub-type. Gate: year3 + day>=120
  // per 321 authoring guideline. Once-per-realm; tag misc.
  { flag: 'cup_holding_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 120,
    text: 'The realm has a way of holding the cup. No one taught it. Strangers visit and hold the cup wrong, and no one corrects them; the realm waits for them to leave.' },
  // Loop 339 (surprise, 329 [code] filing): SINGLE-AXIS surprise — 5th
  // sustained-state-recognition shape per 276 invariant. Sub-type 4→5
  // shapes; joins forgetting (6) / individual-interiority (5) /
  // habituation (5) / land-as-agent (6) at 5+. NEW ANGLE: THREAT-
  // NORMALIZATION. The realm has experienced enough raids to have a
  // ROUTINE for them; the routine becomes a threshold of its own.
  // Distinct from prior 4 sustained-state shapes:
  //  - 211 sustained-peace 50d (count threshold — NO raid days)
  //  - 228 no-death 100d (count — days since last death)
  //  - 230 full-pop 60d (ratio — pop/maxpop=1)
  //  - 331 winter-normalized (transformation — cycle becomes background)
  //  - 339 THREAT-NORMALIZATION (count + script — N raids endured +
  //    realm has internalized response). Distinct from 211 because
  //    211 is THREAT-ABSENCE (peace days); 339 is THREAT-PRESENCE-
  //    METABOLIZED (raids endured become routine).
  // Distinct from 314 morning_dread (DREAD-WITHOUT-CAUSE; OUTSIDE
  // TERROR; acute fear) because 339 is INSIDE sustained-state +
  // CHRONIC-SCRIPTED-FEAR. The fear has a SCRIPT — shutters before
  // bells, children to known places. The realm knows HOW to be afraid.
  // Lift "The realm has learned to be afraid the same way each time"
  // captures fear-as-collective-routine — the most striking framing
  // of normalized threat: not the threat itself but the SHAPED
  // RESPONSE TO IT becoming background. Sustained-state-recognition
  // now has 5 threshold classes: COUNT (211/228) / RATIO (230) /
  // TRANSFORMATION (331) / SCRIPT (339). Per 337 [process] sub-types
  // developing INTERNAL DOMAIN-AXES: SS sub-type now spans threshold-
  // CLASS axis with 4 distinct classes across 5 shapes.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster. Gate: year3 + day>=125 + raidsSurvived>=3 (multi-condition
  // for fitting prose: realm needs experience of multiple raids for
  // "same way each time" to land). Once-per-realm; tag misc.
  { flag: 'raid_routine_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 125 && (G.stats?.raidsSurvived || 0) >= 3,
    text: 'By the third raid the realm has a routine for it. The shutters go up before the bells. The children know where to go. The realm has learned to be afraid the same way each time.' },
  // Loop 341 (surprise, un-filed): SINGLE-AXIS surprise — 5th weather-
  // recognition shape per 276 invariant. Sub-type 4→5 shapes; joins
  // forgetting (6) / land-as-agent (6) / individual-interiority (5)
  // / habituation (5) / sustained-state (5) at 5+ shapes. NEW ANGLE:
  // ANTICIPATION-AS-SEASON. The realm WAITS for the first frost; the
  // waiting itself becomes the season. Pre-event becomes its own
  // experience.
  // Distinct from prior 4 weather-recognition shapes:
  //  - 147 great_storm_remembered — STORM-AS-MEMORY-EVENT (past;
  //    remembrance)
  //  - 174 first_frost — FROST-AS-SEASONAL-ARRIVAL (event)
  //  - 246 first_thaw — THAW-AS-SEASONAL-RETURN (event)
  //  - 272 storm_passed — STORM-NOT-ARRIVING-AS-NEGATIVE-SPACE
  //    (non-event)
  //  - 341 ANTICIPATION-AS-SEASON (PRE-EVENT becomes the seasonal
  //    experience). The realm doesn't notice the frost arriving; it
  //    notices the WAITING for it.
  // Per 339 [process] axis-articulation-as-extension-pattern: weather-
  // recognition now spans WEATHER-PHASE temporal axis with 5 phases:
  //  - REMEMBRANCE (147)
  //  - ARRIVAL/EVENT (174 + 246)
  //  - NON-EVENT/NEGATIVE-SPACE (272)
  //  - ANTICIPATION/PRE-EVENT (341)
  // Sub-type-internal-axis pattern now formalized for 4 of 9 sub-
  // types (336 forgetting / 337 habituation / 339 sustained-state /
  // 341 weather-recognition).
  // Distinct from 280 LIMINAL-MOMENT (rhythm-awareness; DAILY-liminal
  // — between things in evening); 341 = SEASONAL-liminal — a week
  // of waiting becomes the season. Different temporal scale.
  // Distinct from 322 RECURRENCE (CONTENTMENT in repetition; OUTSIDE
  // register); 341 is INSIDE weather + ACTIVE WAITING (not passive
  // recurrence).
  // Lift "The waiting is itself the season" captures pre-event-as-
  // event. The most striking framing: the realm's anticipation BEFORE
  // the seasonal marker IS the marker; the frost arrival merely ends
  // the waiting.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Gate: year3 + season=autumn + day>=130
  // (multi-condition: year3 + autumn for fitting prose + day-offset
  // per 321 authoring guideline). Once-per-realm; tag misc.
  { flag: 'first_frost_wait_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.season === 'autumn' && G.day >= 130,
    text: 'There is a week before the first frost when the realm holds its breath. Citizens pretend they are not waiting. The waiting is itself the season.' },
  // Loop 342 (surprise, 332 [code] filing): SINGLE-AXIS surprise — 5th
  // naming-place shape per 276 invariant. Sub-type 4→5 shapes; joins
  // 5 other sub-types at 5+ shapes. NEW ANGLE: COLLECTIVE-RENAMING-
  // VIA-QUALIFIER-DROP. The realm called a path "the new path" for
  // two years; the qualifier stopped carrying information; the realm
  // dropped it organically without ceremony.
  // Distinct from prior 4 naming-place shapes:
  //  - 193 EMERGENT-NAMING (place gains name from nothing)
  //  - 325 NAME-AS-MEASUREMENT (name does verification work)
  //  - 327 CONTRADICTORY-NAMING (name is factually inverted; insider
  //    marker)
  //  - 332 NAMED-AFTER-WHO-IS-GONE (name preserves person past their
  //    life)
  //  - 342 COLLECTIVE-RENAMING-VIA-QUALIFIER-DROP — name CHANGES
  //    organically when its modifier no longer carries information.
  //    Distinct from 285 LANGUAGE-DRIFT (mistransmission of phrase)
  //    because 285 is mishearing-error; 342 is information-pruning.
  // Per 339/341 axis-articulation pattern: naming-place now spans
  // a TIME-RELATIONSHIP axis (NAME-vs-REFERENT relationship over
  // time) with 5 positions:
  //  - 193 EMERGENCE (name attached when place came into being)
  //  - 325 FUNCTIONAL-SUBSTITUTE (name does work in present)
  //  - 327 CONTRADICTORY (name no longer matches state)
  //  - 332 POSTHUMOUS (referent gone; name persists)
  //  - 342 SHIFTING (name updates when context changes)
  // Sub-type-internal-axes meta-pattern now formalized for **5 of 9
  // sub-types** (336 forgetting / 337 habituation / 339 sustained-
  // state / 341 weather / 342 naming-place). Past majority threshold
  // (5/9 = 56%); 350 letter promotion-review strengthens.
  // Lift "The realm dropped the qualifier when the qualifier stopped
  // meaning anything" captures organic name-update mechanism — no
  // decision, no ceremony, just collective convergence on a shorter
  // name.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Gate: year3 + day>=135 (next-available year-
  // only slot post-339 at d>=125; 341 used seasonal gate so d=135
  // open). Once-per-realm; tag misc.
  { flag: 'qualifier_dropped_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 135,
    text: 'There is a path the realm called "the new path" for two years. Now it is just "the path." No one announced the change. The realm dropped the qualifier when the qualifier stopped meaning anything.' },
  // Loop 343 (surprise, un-filed): SINGLE-AXIS surprise — 5th ambient-
  // entity-grammar shape per 276 invariant. Sub-type 4→5 shapes; only
  // Early-game-mood remains at 4 — cluster ONE TICK from UNIFORM-5.
  // NEW ANGLE: TRANSIENT-COLLECTIVE-WITNESS. A simultaneous one-instant
  // experience shared by every citizen but never spoken about. The
  // realm carries the memory of the simultaneity even though no
  // individual reports it.
  // Distinct from prior 4 ambient-entity-grammar shapes:
  //  - 148 wanderer (SUSTAINED-INDIVIDUAL-WITNESS — entity persists
  //    over time; each citizen aware separately)
  //  - 152 night-shape (SUSTAINED-INDIVIDUAL-WITNESS)
  //  - 166 frog-voices (SUSTAINED-INDIVIDUAL-WITNESS)
  //  - 266 falling_star (TRANSIENT-INDIVIDUAL-WITNESS — single-
  //    instant unsharable; "the star is gone before anyone can ask
  //    if anyone else saw it")
  //  - 343 collective_waking — TRANSIENT-COLLECTIVE-WITNESS
  //    (single-instant SHARED but UNSPOKEN; the realm KNOWS it was
  //    simultaneous despite no one saying so)
  // Per 339/341/342 axis-articulation pattern: ambient-entity-grammar
  // now spans **2D AXIS** (PERSISTENCE × COLLECTIVITY):
  //  - SUSTAINED × INDIVIDUAL: 148/152/166
  //  - TRANSIENT × INDIVIDUAL: 266
  //  - TRANSIENT × COLLECTIVE: 343
  //  - SUSTAINED × COLLECTIVE: empty cell — possible 6th shape
  // First sub-type with explicit 2D axis (prior 4 sub-types with
  // formalized axes had 1D axes). Sub-type-internal-axes meta-pattern
  // now formalized for **6 of 9 sub-types** (336 forgetting / 337
  // habituation / 339 sustained-state / 341 weather / 342 naming-
  // place / 343 ambient-entity-grammar). 67% formalization rate.
  // Distinct from related angles:
  //  - 322 RECURRENCE (CONTENTMENT in repetition; OUTSIDE register;
  //    passive collective-recognition): 343 = ACTIVE simultaneous
  //    awakening
  //  - 312 SOCIAL-NORMS (rule TRANSMITTED via shush): 343 = NOT
  //    transmitted; the experience stays in each citizen
  //  - 263 chronicle_self (META; chronicle as object): 343 is in-
  //    cluster INSIDE register
  // Lift "carries the memory of being all awake at once, without
  // naming it" captures collective-experience-without-articulation.
  // The realm KNOWS it shared the moment despite no individual
  // reporting it — knowing-without-saying.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Gate: year3 + season=winter + day>=140 (per
  // 321 authoring guideline + season fitting prose; will fire in
  // year4+ winter when year3 flag persists past d=140 + winter
  // returns). Once-per-realm; tag misc.
  { flag: 'collective_waking_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.season === 'winter' && G.day >= 140,
    text: 'There is a winter night when every citizen wakes at the same hour. No one tells anyone in the morning. The realm carries the memory of being all awake at once, without naming it.' },
  // Loop 344 (surprise, un-filed): SINGLE-AXIS surprise — 5th early-
  // game-mood shape per 276 invariant. Sub-type 4→5 shapes; **CLUSTER-
  // UNIFORM-5 MILESTONE REACHED** — all 9 INSIDE sub-types now at
  // 5+ shapes. NEW ANGLE: REALM-AS-CONTINUITY-UNNOTICED. The first
  // moment when the realm STOPS performing being-a-realm and just IS
  // one. Retrospective frame from year3+ looking back at year-1.
  // Distinct from prior 4 early-game-mood shapes:
  //  - 196 long-evening (mood-of-evening; year-1 weather-mood)
  //  - 199 cold-morning (mood-of-morning)
  //  - 207 fields-know-realm (cross-listed in land-as-agent;
  //    LAND-knowing-realm)
  //  - 212 first-sigh (cross-listed in individual-interiority;
  //    citizen mood mid-action)
  //  - 344 REALM-AS-CONTINUITY-UNNOTICED — the FIRST moment
  //    realm-as-continuous-entity registers; the realm has been
  //    PERFORMING being-a-realm and now stops noticing.
  // Distinct from related angles:
  //  - 322 RECURRENCE (CONTENTMENT in repetition; OUTSIDE register;
  //    settled-place laughs at recurrence): 344 = first moment the
  //    realm DOESN'T NOTICE itself recurring; transitional
  //  - 254 AUTOMATICITY (action without thinking; habituation):
  //    254 is about specific actions; 344 is about REALM-AS-WHOLE
  //    not noticing itself
  //  - 207 fields_know_realm (LAND knowing realm): 344 = REALM
  //    KNOWING ITSELF
  //  - 212 first_sigh (individual citizen mid-action): 344 =
  //    collective realm-mood
  // Per 343 [process] sub-type-internal-axes pattern: early-game-mood
  // 4 prior shapes don't articulate a clean internal axis (mood-of-
  // time + cross-listed registry). 344 doesn't force axis-
  // articulation — meta-pattern is OPPORTUNISTIC, not mandatory.
  // Sub-type-internal-axes meta-pattern remains at 6/9 (343-baseline)
  // post-344 — 7th potential candidate is naming-place's TIME-
  // RELATIONSHIP axis OR forgetting's PAST/FUTURE temporal axis;
  // EM declined.
  // Lift "The realm has begun" captures the moment of self-
  // recognition WITHOUT noticing — the realm's continuity registers
  // as an absence of self-doubt rather than a presence of confidence.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Retrospective frame: gate year3 + day>=145
  // (next-available year-only slot post-342 at d>=135; 343 used
  // winter+140; 145 open). The prose looks back at year-1 from
  // year-3+ retrospective. Once-per-realm; tag misc.
  // **CLUSTER-UNIFORM-5 MILESTONE REACHED**: all 9 INSIDE sub-types
  // now at 5+ shapes (cluster minimum 5). Trajectory: pre-325 min 1
  // → 325 min 2 → 327 min 3 → 332 min 4 → **344 min 5**.
  // Each milestone advance preceded by 1-12 ticks of focused
  // extension; 332→344 = 12 ticks for floor 4→5. Total INSIDE
  // shapes post-344: 47 across 9 sub-types (avg 5.2/sub-type fully-
  // counted; cluster avg trajectory continues linear).
  { flag: 'realm_begun_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 145,
    text: 'There is an evening in the first year when the realm goes to sleep without thinking of itself as a realm trying to be one. The realm has begun.' },
  // Loop 346 (surprise, 343 [code] filing): SINGLE-AXIS surprise — 6th
  // ambient-entity-grammar shape per 276 invariant. Sub-type 5→6
  // shapes; joins land-as-agent (6) and forgetting (6) at sole-leader
  // level (3 sub-types tied at 6). Completes the 2D PERSISTENCE ×
  // COLLECTIVITY axis with all 4 quadrants populated.
  // NEW ANGLE: SUSTAINED-COLLECTIVE-AWARENESS-WITHOUT-NAMING. Every
  // citizen expects the same sustained presence; the expectation is
  // shared across the realm but the thing itself is unnamed. Fills
  // the SUSTAINED × COLLECTIVE quadrant of 343's 2D axis.
  // 2D axis at 346:
  //  - SUSTAINED × INDIVIDUAL: 148 wanderer / 152 night-shape / 166
  //    frog-voices (each citizen aware separately of persistent
  //    entity)
  //  - TRANSIENT × INDIVIDUAL: 266 falling-star (single-instant
  //    unsharable; "star is gone before anyone can ask if anyone
  //    else saw it")
  //  - TRANSIENT × COLLECTIVE: 343 collective-waking (single-instant
  //    SHARED but UNSPOKEN; realm carries memory of simultaneity)
  //  - SUSTAINED × COLLECTIVE: 346 autumn-sound (sustained shared
  //    expectation; unnamed)
  // **First sub-type to populate full 2D axis** (4/4 quadrants).
  // Lift "no one alive has named it; everyone alive expects it"
  // captures sustained-collective-awareness-as-cultural-fact: the
  // expectation is a feature of the realm, transmitted without
  // articulation.
  // Distinct from related angles:
  //  - 312 SOCIAL-NORMS (rule TRANSMITTED via shush): 346 = no
  //    transmission needed; expectation is collectively pre-loaded
  //  - 322 RECURRENCE (CONTENTMENT in repetition; OUTSIDE register):
  //    346 = expectation OF unnamed thing; 322 = recognition OF
  //    pattern
  //  - 343 collective-waking (transient): 346 is sustained
  //  - 148/152/166 (individual): 346 is collective
  //  - 277 INFERENCE-BY-ABSENCE (citizen empty seat noticed): 346
  //    is presence noticed collectively without articulation
  // Sub-type-internal-axes meta-pattern remains at 6/9 (Am already
  // articulated 2D at 343); 346 doesn't add new axis but COMPLETES
  // existing 2D axis. Worth filing for 350 letter as cluster-axis-
  // completion observation: when sub-type articulates a 2D axis,
  // future ships can target empty quadrants.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Gate: year3 + season=autumn + day>=150 (per
  // 321 authoring guideline + autumn fits prose). Once-per-realm;
  // tag misc.
  { flag: 'autumn_sound_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.season === 'autumn' && G.day >= 150,
    text: 'There is a sound the realm hears in autumn evenings, never the same week, never the same hour. Citizens know to listen for it. No one alive has named it; everyone alive expects it.' },
  // Loop 347 (surprise, un-filed): SINGLE-AXIS surprise — 6th
  // individual-interiority shape per 276 invariant. Sub-type 5→6
  // shapes; **4 sub-types now tied at 6 shapes** (LA/FG/Am/II).
  // NEW ANGLE: AVOIDANCE-UNEXPLAINED — a citizen has a daily
  // exclusion (never sits in south corner) without any explanation.
  // The pattern is preserved by the realm's NON-INQUIRY: the realm
  // has never asked.
  // Distinct from prior 5 individual-interiority shapes:
  //  - 212 MID-ACTION (interior moment within action)
  //  - 275 TOTALIZING (whole frame-of-reference)
  //  - 277 INFERENCE-BY-ABSENCE (citizen empty seat noticed)
  //  - 329 PRIVATE-KNOWLEDGE (hidden expertise unshared)
  //  - 334 BODILY-INHERITED-MEMORY (citizen inherits posture
  //    without awareness)
  //  - 347 AVOIDANCE-UNEXPLAINED (citizen abstains from a
  //    place/action without conscious reason; realm sustains
  //    the avoidance through non-inquiry)
  // Per 339/341/342/343/346 axis-articulation pattern: 347
  // ARTICULATES individual-interiority's INTERIOR-MANIFESTATION-MODE
  // axis with 6 positions (one per shape). The axis describes HOW a
  // citizen's interior life MANIFESTS as exterior pattern:
  //  - 212 DURING-ACTION (manifests in the moment of doing)
  //  - 275 AS-WORLDFRAME (manifests in the whole frame of
  //    perception)
  //  - 277 AS-ABSENCE (manifests in not-being-there, inferred)
  //  - 329 AS-PRIVATE-COMPETENCE (manifests in unrequested
  //    expertise)
  //  - 334 AS-INHERITED-PATTERN (manifests in body without mind)
  //  - 347 AS-UNEXPLAINED-AVOIDANCE (manifests in negative space
  //    of action; refusing without saying why)
  // Sub-type-internal-axes meta-pattern advances **6/9 → 7/9**:
  //  - 336 forgetting (PAST/FUTURE temporal; 1D)
  //  - 337 habituation (5 domains; 1D)
  //  - 339 sustained-state (4 threshold-classes; 1D)
  //  - 341 weather (4 WEATHER-PHASE positions; 1D)
  //  - 342 naming-place (5 TIME-RELATIONSHIP positions; 1D)
  //  - 343 ambient-entity-grammar (PERSISTENCE × COLLECTIVITY; 2D)
  //  - **347 individual-interiority** (6 INTERIOR-MANIFESTATION-
  //    MODE positions; 1D)
  // Distinct from related angles:
  //  - 312 SOCIAL-NORMS (rule TRANSMITTED via shush; collective):
  //    347 = individual + UN-INQUIRED
  //  - 322 RECURRENCE (settled-place repetition; OUTSIDE register):
  //    347 = individual + INSIDE register
  //  - 277 INFERENCE-BY-ABSENCE: 277 = inferred-absence;
  //    347 = active-avoidance preserved by non-inquiry (different
  //    causal mechanism — 277's absence is what's noticed; 347's
  //    avoidance is what's NOT noticed)
  //  - 305 EMERGENT-TRADITION ("no one decided"): 305 is
  //    collective-practice; 347 is individual-pattern
  // Lift "the south corner remains theirs not to sit in" captures
  // avoidance-as-property: the not-sitting-there is a possession of
  // the citizen, sustained by collective non-inquiry. The negative
  // space is owned.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Gate: year3 + day>=155 per 321 authoring
  // guideline. Once-per-realm; tag misc.
  { flag: 'avoided_corner_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 155,
    text: 'There is a citizen who has never sat in the south corner of the inn. They could not say why. The realm has never asked, and the south corner remains theirs not to sit in.' },
  // Loop 348 (surprise, un-filed): SINGLE-AXIS surprise — 7th
  // forgetting shape per 276 invariant. Sub-type 6→7 shapes;
  // becomes SOLE-LEADER again (LA/Am/II remain at 6). NEW ANGLE:
  // PRESENT-FORGETTING-AS-EMERGING-GAP — forgetting happening
  // RIGHT NOW; meta-aware mid-process.
  // Distinct from prior 6 forgetting shapes:
  //  - 184 stone-forgotten (PAST-OBJECT-WEATHERED)
  //  - 190 constellation-forgotten (PAST-PATTERN-UNNAMED)
  //  - 292 bakery-door-carving (PAST-ARTIFACT-PRESERVED-MEANING-LOST)
  //  - 301 noon-bell-origin (PAST-RITUAL-PERSISTS-WITHOUT-ORIGIN)
  //  - 305 silent-morning (PAST-EMERGENT-TRADITION; origin never
  //    existed)
  //  - 336 unteach (FUTURE-ACTIVE-FORGETTING-AS-PEDAGOGY)
  //  - 348 PRESENT-FORGETTING-AS-EMERGING-GAP — temporally
  //    PRESENT (not past, not future); forgetting is happening
  //    RIGHT NOW; the realm KNOWS it's forgetting but doesn't
  //    know WHAT.
  // Per 336 [process] forgetting temporal axis: was 2-position
  // (PAST + FUTURE); 348 ADVANCES to 3-position (PAST + PRESENT +
  // FUTURE). Sub-type-internal-axes meta-pattern: forgetting's
  // axis count was 1 (PAST/FUTURE 2-pos); now richer (PAST/
  // PRESENT/FUTURE 3-pos) — same axis, more positions.
  // Distinct from related angles:
  //  - 263 META-self-aware (chronicle-as-thing-in-world; OUTSIDE
  //    register): 348 is INSIDE; doesn't reference chronicle
  //  - 322 RECURRENCE (settled-place repetition): 348 is mid-
  //    process loss
  //  - 336 ACTIVE-FORGETTING (deliberate non-teaching; future-
  //    oriented): 348 is INVOLUNTARY mid-process; not deliberate
  //  - 305 EMERGENT-TRADITION (no decision; practice formed):
  //    348 is no decision; thing being lost; the negative
  //    counterpart
  // Lift "the something will be the gap" captures forgetting-as-
  // emerging-absence. The most striking framing: the realm
  // KNOWS something is being lost without being able to NAME
  // what; by the time the loss is articulated, the gap will
  // already be the only thing remaining.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Forgetting now SOLE-LEADER at 7 shapes
  // (LA/Am/II at 6). Cluster top advances; **first sub-type to
  // reach 7 shapes**. Total INSIDE shapes: 50. Gate: year3 +
  // day>=160 per 321 authoring guideline. Once-per-realm; tag
  // misc.
  { flag: 'present_forgetting_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 160,
    text: 'The realm is forgetting something at this moment. No one knows what. By the time someone says "we used to," the something will be the gap.' },
  // Loop 352 (surprise, un-filed; the-optimist mutated to surprise per
  // 351 plan): SINGLE-AXIS surprise — 7th LAND-AS-AGENT shape per 276
  // invariant. Sub-type 6→7 shapes; LA TIES forgetting at 7 (LA/forgetting
  // = co-leaders at 7; Am/II remain at 6). NEW ANGLE: PRESENT-INDEPENDENT-
  // AGENCY — land actively SHAPES atmospheric phenomenon RIGHT NOW,
  // repeatedly, on its own schedule. Citizens are spectators; the land
  // does not need them to know what it's doing.
  // Distinct from prior 6 LA shapes:
  //  - 207 broad LAND-EXISTENCE (atemporal collective claim)
  //  - 227 OBJECT-HOLDS-MEMORY (well water; PAST-RETAINED)
  //  - 229 OBJECT-HOLDS-NAMES (hearth; PAST-RETAINED)
  //  - 290 INHERITED-FROM-OUTSIDE (sea-bell; PAST-IMPORTED)
  //  - 294 RESHAPED-BY-USE (worn step; PAST-ACCRETED)
  //  - 307 ANTICIPATORY-AGENCY (path knows; FUTURE-PROJECTED)
  //  - 352 PRESENT-INDEPENDENT-AGENCY — land acts in PRESENT-RECURRENT
  //    mode; no citizen interaction needed; cyclic atmospheric agency.
  // **Land-as-agent temporal axis articulation (NEW at 352)**:
  //   ATEMPORAL (207) → PAST-RETAINED (227, 229) → PAST-IMPORTED (290)
  //   → PAST-ACCRETED (294) → FUTURE-PROJECTED (307) → PRESENT-RECURRENT
  //   (352). 1D temporal axis with 6 positions, 7 shapes. **Closes
  //   un-examined LA case in 350 sub-type-internal-axes sub-rule
  //   ledger**: 7→8 of 9 sub-types formalized (only EM declined remains).
  // Distinct from related sub-types:
  //  - 266 summer-falling-star (ambient-entity-grammar; TRANSIENT
  //    presence; star-as-spectacle): 352 is PERSISTENT cyclic land-
  //    behavior, not a single transient event
  //  - 343 collective_waking (ambient 2D PERSISTENCE × COLLECTIVITY):
  //    352 is land-as-agent not entity-grammar; the FOG isn't an entity
  //    being witnessed, the HILL is the agent gathering it
  //  - 307 path-anticipates (FUTURE-PROJECTED): 352 is PRESENT-RECURRENT;
  //    cyclic action, not future projection
  //  - 322 recurrence_known (CONTENTMENT register; settled-place
  //    repetition): 322 is citizen-experience of recurrence; 352 is
  //    LAND'S OWN recurrence independent of citizens
  // Lift "The hill does not need a name for what it does" captures
  // independence-of-purpose: land has function without nomenclature;
  // citizens are not the audience.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. LA TIES forgetting at 7 shapes; Am/II remain
  // at 6. Total INSIDE shapes: 51. Gate: autumn + year2+ + day>=50
  // per 321 authoring guideline (autumn fits the "fog at autumn
  // morning" prose); year2+ ensures realm has accumulated enough
  // tenure that "every autumn morning" is plural-recurrent. Once-
  // per-realm; tag misc.
  { flag: 'hill_gathers_fog_known', tag: 'misc',
    trigger: G => G.season === 'autumn' && G.storyFlags.year2 && G.day >= 50,
    text: 'There is a hill on the south coast that gathers fog every autumn morning. The fog finds the hill before the sun finds the realm. The hill does not need a name for what it does.' },
  // Loop 354 (surprise, un-filed; the-optimist per 353 plan): SINGLE-AXIS
  // surprise — 6th HABITUATION-RECOGNITION shape per 276 invariant. Sub-
  // type 5→6 shapes; advances cluster-uniform sweep (5@5→4@5+1@6 post-
  // 354; HB joins Am/II at 6). NEW DOMAIN: RHYTHMIC-COLLECTIVE-MOMENT
  // (synchronized non-conducted moments).
  // Distinct from prior 5 HB domains:
  //  - 254 ACTION (the way the realm does things)
  //  - 280 TIME (when meals/work shift unconsciously)
  //  - 285 LANGUAGE (the realm says X without knowing it adopted X)
  //  - 312 RULE-TRANSMISSION (tacit norms; shush)
  //  - 337 GESTURE-ENFORCEMENT (cup-holding; non-correction pedagogy)
  //  - 354 RHYTHMIC-COLLECTIVE-MOMENT — synchronized collective behavior
  //    no one coordinated. Distinct from 337 because 337 is single
  //    citizen acting + collective non-correction; 354 is collective
  //    synchronization without conducting (everyone goes quiet at the
  //    same moment without anyone calling for it). Distinct from 311
  //    silent_morning because 311 is DAILY-SCALE pattern start (Sunday-
  //    morning quiet AS COMMUNITY-PRACTICE); 354 is SHORTER-SCALE
  //    moment recurring within a day (one-breath quiet in the late
  //    afternoon every day).
  // Distinct from related sub-types:
  //  - 322 recurrence_known (CONTENTMENT register; settled-place
  //    repetition): 322 is citizen-AWARENESS of recurrence (mood);
  //    354 is collective UNAWARE habit (the citizens do it without
  //    knowing they're doing it together)
  //  - 343 collective_waking_known (ambient 2D PERSISTENCE×COLLECTIVITY):
  //    343 is TRANSIENT-COLLECTIVE-WITNESS (a single moment of shared
  //    seeing); 354 is RECURRING-COLLECTIVE-PERFORMANCE (a habit
  //    performed every late afternoon)
  //  - 305 silent_morning_known (forgetting EMERGENT-TRADITION): 305
  //    is community-scale practice with no origin-decision; 354 is
  //    collective-rhythm with no origin-decision; difference is 305
  //    is once-weekly community gathering, 354 is daily sub-second
  //    synchronization. Both share "no one decided" but at different
  //    scales of observable behavior.
  // Lift "The realm has stopped distinguishing the silence from the
  // time" captures habit-completion: the silence has migrated FROM
  // citizens INTO the temporal frame; it no longer exists as a
  // distinct thing the realm DOES, only as a property of the
  // afternoon itself.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Sub-type 5→6 shapes; HB joins Am/II at 6.
  // INSIDE cluster post-354: 2@7 (forgetting + LA) / 3@6 (Am, II,
  // HB) / 4@5 (SS, WE, NP, EM). 52 total INSIDE shapes (was 51).
  // **Cluster-uniform sweep advance**: 4 sub-types remain at 5; 4
  // more shapes needed for cluster-uniform-6. Gate: year2 + day>=80
  // per 321 authoring guideline (year2 ensures realm has accumulated
  // enough tenure for "as long as anyone can remember"). Once-per-
  // realm; tag misc.
  { flag: 'afternoon_quiet_known', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.day >= 80,
    text: 'There is a moment in the late afternoon when the realm goes quiet for the length of one breath. No one calls it. No one remembers when it started. The realm has stopped distinguishing the silence from the time.' },
  // Loop 357 (surprise, un-filed; the-optimist per 356 plan): SINGLE-AXIS
  // surprise — 6th SUSTAINED-STATE-RECOGNITION shape per 276 invariant.
  // Sub-type 5→6 shapes; advances cluster-uniform sweep (4@5→3@5+1@6
  // post-357; SS joins Am/II/HB at 6). NEW THRESHOLD CLASS:
  // EQUILIBRIUM-AS-DEFAULT.
  // Distinct from prior 4 SS threshold classes:
  //  - 211 sustained-peace 50d: COUNT (no raid days)
  //  - 228 no-death 100d: COUNT (days since last death)
  //  - 230 full-pop 60d: RATIO (current/max = 1)
  //  - 331 winter-normalized: TRANSFORMATION (cycle-becomes-background)
  //  - 339 raid_routine: COUNT + SCRIPT (threats-survived + script-
  //    internalization)
  //  - 357 EQUILIBRIUM-AS-DEFAULT — flow-balance over time. Two streams
  //    (birth/death, in/out, growth/loss) reach approximate balance and
  //    the realm settles at unchanging size without anyone deciding.
  //    Distinct from 230 RATIO because 230 is static peak (current = max);
  //    357 is dynamic balance (flows continuing but matching). Distinct
  //    from 331 TRANSFORMATION because 331 is cycle-becoming-background
  //    (rhythmic); 357 is flat-line equilibrium (non-rhythmic stability).
  // Sub-type-internal-axis advance: SS adds 5th threshold class
  // (COUNT/RATIO/TRANSFORMATION/SCRIPT/EQUILIBRIUM); 6 shapes across
  // 5 classes (211/228 share COUNT). Per 350 sub-type-internal-axes
  // sub-rule extension.
  // Distinct from related sub-types:
  //  - 322 recurrence_known (CONTENTMENT register; settled-place
  //    repetition mood): 357 is SS mechanic of flow-balance, not
  //    register-mood; 322 is citizen-experience, 357 is realm-state
  //  - 230 full_pop_known (RATIO at peak): 357 is flow-balance,
  //    not count-at-static
  //  - 331 winter_normalized (TRANSFORMATION cycle-as-background):
  //    357 is non-rhythmic equilibrium
  //  - 354 afternoon_quiet (HB rhythmic-collective-moment): 354 is
  //    sub-second collective rhythm; 357 is multi-year flow-balance
  // Lift "without anyone deciding to stop" captures equilibrium-without-
  // intent: the balance happened on its own; no one chose growth-cessation;
  // the realm simply BALANCED.
  // **Single-axis ship**; STRUCTURE declarative; REGISTER INSIDE
  // cluster; TAG misc. Sub-type 5→6 shapes; SS joins Am/II/HB at 6.
  // INSIDE cluster post-357: 2@7 (forgetting + LA) / 4@6 (Am, II,
  // HB, SS) / 3@5 (WE, NP, EM). 53 total INSIDE shapes (was 52).
  // **Cluster-uniform sweep advance**: 3 sub-types remain at 5; 3
  // more shapes needed for cluster-uniform-6. Gate: year3 + day>=90
  // per 321 authoring guideline (year3 for "two years" plausibility;
  // day>=90 spreads from 354 d>=80 + 348 d>=160). Once-per-realm; tag
  // misc.
  { flag: 'realm_equilibrium_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && G.day >= 90,
    text: 'For two years the realm has stayed the same size. There is a name added for every name lost. The realm has stopped growing without anyone deciding to stop.' },
  // Loop 263 (surprise, un-filed, alternation after 5 fixer/archivist
  // ticks in 6): META-SELF-AWARE beat — first time the chronicle is
  // referenced AS A THING IN THE WORLD by a NARRATIVE_BEAT entry. The
  // realm becomes aware that it has been chronicled long enough that
  // the chronicle now exceeds individual recollection. **OUTSIDE the
  // observational-elder cluster** — different REGISTER (meta-self-
  // aware vs declarative-present-tense observational); not a new sub-
  // type. Per 257 anti-completionist warning: this beat is a
  // standalone, NOT a 10th cluster sub-type to "fill in." The lift
  // line "stories the realm has forgotten how to tell" — paradox
  // landing: the chronicle preserves what the realm itself has lost.
  // Gate: chronicle.length ≥ 100 — long-lived realms only (typical
  // 200-day realm produces ~165-210 entries per 262 cadence target,
  // so threshold 100 fires roughly mid-life of long-lived realms).
  // Once-per-realm; tag misc; static universal prose.
  // Per 203 positive authoring rule: surprises by introducing a NEW
  // axis (META-self-aware) without sub-type-completion within an
  // existing cluster. First self-reference in the corpus.
  { flag: 'chronicle_self_known', tag: 'misc',
    trigger: G => G.chronicle && G.chronicle.length >= 100,
    text: 'The chronicle has grown longer than any citizen\'s memory. Some of its days are stories the realm has forgotten how to tell.' },
  // Loop 266 (surprise, un-filed, alternation after 264+265 fixer pair):
  // SHOOTING-STAR beat. 4th use of ambient-entity-grammar sub-type
  // (sibling to 148 wanderer / 152 night-shape / 166 frog-voices) — but
  // shipped because PROSE SURPRISES on its own merits, NOT to advance
  // the cluster counter (per 257 anti-completionist warning). The
  // existing ambient-entity beats acknowledge SUSTAINED presences (a
  // wanderer who returns, a night-shape that recurs, frog voices in
  // the rain). 266 introduces TRANSIENT presence — the star falls in
  // an instant — and a NEW philosophical angle: the SOCIAL
  // IMPOSSIBILITY of shared witness ("the star is gone before anyone
  // can ask if anyone else saw it"). Other cluster beats let entities
  // BE; 266 lets an entity GO before anyone can confirm it. Distinct
  // angle: witness-without-confirmation. Gate: summer + deep night
  // (G.dayPhase > 0.75 of dayLength — mirrors 128 longest-night
  // 0.85 threshold but slightly looser since summer nights are short).
  // Once-per-realm; tag misc; static universal prose. Per 203 positive
  // rule: ships because prose introduces fresh angle, not because
  // ambient-entity-grammar count needed advancing.
  { flag: 'summer_falling_star', tag: 'misc',
    trigger: G => G.season === 'summer' && G.dayPhase > (G.dayLength || 3600) * 0.75,
    text: 'There is a night in summer when a star falls across the sky from north to south. The realm watches without naming it; the star is gone before anyone can ask if anyone else saw it.',
    // Loop 267 (the-fixer, 266 follow-on): visual+textual sync. Spawns a
    // bright streak with fading trail in screen space above the camera
    // center. Particle motion lives in particles.js shootingstar branch
    // and render in render.js shootingstar branch (~30 LoC together).
    after: G => {
      if (!G.particles || !G.camera) return;
      // Loop 269 (the-fixer, 268 LOW): respect the 400-particle cap that
      // neighboring spawn sites in particles.js (lines 87/91/94/115/etc)
      // gate on. Single-instance can't overflow on its own (once-per-realm
      // flag), but the convention matters for future synchronized-surprise
      // applications per 267 [process] template.
      if (G.particles.length >= 400) return;
      // Loop 273 (the-fixer): use proper inverse iso projection for the
      // spawn tile. Earlier 267 used `camera.x/32, camera.y/16` which only
      // approximates a tile coord when camera.x ≈ 0. The correct math:
      //   tx = (camera.y/16 - camera.x/32) / 2
      //   ty = (camera.y/16 + camera.x/32) / 2
      // Now the streak reliably appears in the visible sky regardless of
      // where the player has panned.
      const tx = (G.camera.y / 16 - G.camera.x / 32) / 2;
      const ty = (G.camera.y / 16 + G.camera.x / 32) / 2;
      G.particles.push({
        tx, ty,
        offsetX: 0, offsetY: -200,
        vxScreen: -3, vy: 0.5,
        alpha: 1.2, decay: 0.012,
        type: 'shootingstar',
      });
    } },
  // Loop 270 (surprise, un-filed, alternation after 267-268-269 fixer-
  // class triple): SOCIAL CONFLUENCE beat — FIRST multi-character beat
  // in the corpus. All previous character-interiority beats
  // (240/245/247/249/252/253) feature ONE named character alone in a
  // moment of solitary interiority (bard hidden art / smith unexplained
  // departure / teacher small preservation / etc). 270 inverts the
  // shape: three named characters CO-PRESENT in the same scene by
  // chance. The lift line "the realm has grown into the kind of place
  // where this is possible" captures the social-density transition —
  // the realm has crossed a threshold where ordinary co-presence
  // becomes a notable event. NEW shape (confluence) within the broader
  // character-interiority observation; NOT a sub-type of observational-
  // elder cluster. Gate: mayor + bard + smith all named (the canonical
  // 3 most-likely to all be present in a year-3 realm with tavern +
  // barracks + townhall built) AND year3. Once-per-realm; tag
  // character. Per 203 positive rule: ships because prose introduces
  // fresh axis (multi-character co-presence) the corpus has never
  // touched. Per 257 anti-completionist: NOT framed as cluster sub-
  // type completion — distinct shape recognized as +1 observation
  // entry, not a 10th cluster sub-type.
  { flag: 'inn_confluence_seen', tag: 'character',
    trigger: G => G.storyFlags.year3 && G.namedCharacters?.mayor && G.namedCharacters?.bard && G.namedCharacters?.smith,
    text: G => {
      const m = G.namedCharacters.mayor.name;
      const b = G.namedCharacters.bard.name;
      const s = G.namedCharacters.smith.name;
      return `There comes an evening when ${m}, ${b}, and ${s} all happen to be at the inn at the same time. None of them planned it. The realm has grown into the kind of place where this is possible.`;
    } },
  // Loop 272 (surprise, un-filed, alternation after 5 fixer/review ticks
  // since 263 META): NEGATIVE-SPACE WEATHER beat. 4th use of weather-
  // recognition sub-type (sibling to 147 great-storm-remembered / 174
  // first-frost-marked / 246 first-thaw-known) — but shipped because
  // PROSE INTRODUCES NEW ANGLE, NOT to advance the count (per 257 anti-
  // completionist + 266 precedent). All 3 existing weather-recognition
  // beats are about weather ARRIVING. 272 is about weather NOT
  // ARRIVING — a storm builds offshore, lightning a long way off, but
  // the rain falls on the next ridge. The realm receives the night
  // intact as a GIFT it did not earn. Negative-space observation:
  // good fortune via absence rather than presence. Lift line "is given
  // the night intact" — passive voice acknowledges grace. No other
  // weather beat captures the WHAT-DIDN'T-HAPPEN axis. Gate: summer
  // + day ≥ 30 (mid-summer, weather-sensitive). Once-per-realm; tag
  // misc; static universal prose. Per 203 positive rule: ships
  // because new angle (negative-space) the corpus has never touched,
  // not because weather-recognition count needed advancing.
  // Loop 275 (surprise, un-filed, alternation after 273-274 fixer pair):
  // CHILD POV-INVERSION beat. 2nd use of individual-interiority sub-type
  // (sibling to 212 first_sigh_seen) — but shipped because PROSE
  // INTRODUCES NEW ANGLE within the sub-type, NOT to advance count
  // (per 257 anti-completionist + 266+272 precedents). 212's interiority
  // is MID-ACTION (a settler sets down a bucket and breathes out — a
  // brief inner moment); 275's interiority is TOTALIZING (a child's
  // entire worldview — they have only ever known this realm). Different
  // shape: 212 captures the realm's witness of an UNNOTICED INTERIOR
  // INSTANT; 275 captures a CITIZEN'S WHOLE FRAME OF REFERENCE. The
  // realm's wider world (cities, other coasts) is HEARSAY to a young
  // citizen; the EASTERN RIDGE is the world's edge. Lift line "the world
  // ends at the eastern ridge as far as they are concerned" — POV
  // inversion + the universal child-experience of small-town totality.
  // Gate: year3 + at least one citizen born (a child must exist).
  // Once-per-realm; tag misc; static universal prose. Per 203 positive
  // rule: ships because POV-inversion angle the corpus has never
  // touched, not because individual-interiority count needed advancing.
  // Individual-interiority sub-type now has 2 shapes: MID-ACTION
  // (212) + TOTALIZING (275). Same pattern as 270 confluence + 272
  // negative-space — observations developing SHAPE-axes orthogonal to
  // use-counts.
  { flag: 'child_no_elsewhere_known', tag: 'misc',
    trigger: G => G.storyFlags.year3 && (G.stats?.citizensBorn || 0) >= 1,
    text: 'There is a child in the realm who has lived nowhere else. They have heard their elders speak of other places but have never seen one. The world ends at the eastern ridge as far as they are concerned.' },
  // Loop 277 (surprise, un-filed, alternation after 276 archivist):
  // INFERENCE-BY-ABSENCE shape-extension per 276 invariant.
  // 3rd shape of individual-interiority sub-type (after 212 mid-action +
  // 275 totalizing). NEW ANGLE: the realm's awareness of a citizen
  // mediated through a SHARED ROUTINE'S DISRUPTION rather than direct
  // observation. The realm doesn't see the citizen; it sees the
  // empty-seat-shaped HOLE in daily life. "Empty for the third evening
  // in a row" — the detail of "third" is load-bearing: not first
  // (could be coincidence), not every (too definitive), but third-in-
  // a-row (when habit-breakage becomes notable). The implicit story
  // of the absent citizen (sick? dead? gone?) is left unsaid; the
  // realm only registers the SHAPE of their absence. Per 276 invariant:
  // shape-extension ships because INFERENCE-BY-ABSENCE angle the
  // corpus has never touched, not as count-advancement. Individual-
  // interiority sub-type now has 3 shapes (212 mid-action / 275
  // totalizing / 277 inference-by-absence) — first sub-type to grow
  // 3 shapes; documents that shape-axes can extend beyond binary.
  // Gate: tavern built + day ≥ 30 (long enough for daily inn-routine
  // to exist as a reference pattern). Once-per-realm; tag misc.
  { flag: 'absent_citizen_seat_known', tag: 'misc',
    trigger: G => G.day >= 30 && G.buildings && G.buildings.some(b => b.type === 'tavern'),
    text: 'There is a citizen no one has seen in many days. The realm only notices when their seat at the inn is empty for the third evening in a row.' },
  { flag: 'storm_passed_seen', tag: 'misc',
    trigger: G => G.season === 'summer' && G.day >= 30,
    text: 'There is a summer evening when a storm builds over the eastern sea but does not come ashore. The realm watches the lightning a long way off and is given the night intact.',
    // Loop 273 (the-fixer, 272 follow-on): synchronized visual+textual
    // pattern's 2nd application (1st was 267 shooting-star). Spawns a
    // distant faint lightning flash at the eastern edge of viewable sky.
    // Particle render in render.js lightning branch — soft pale-blue
    // halo + tiny bright core, fades over ~40 frames (~0.7s real time)
    // with a flicker phase mid-decay matching real distant lightning's
    // primary-then-secondary brightness pattern.
    after: G => {
      if (!G.particles || !G.camera) return;
      if (G.particles.length >= 400) return;
      // Inverse iso projection: camera.x = (tx-ty)*32, camera.y = (tx+ty)*16
      // → tx = (camera.y/16 - camera.x/32) / 2, ty = (camera.y/16 + camera.x/32) / 2
      // Spawning at the actual camera-tile keeps the flash visible regardless
      // of camera position. (267 used the simpler camera.x/32 approximation
      // which only works when camera.x ≈ 0; this corrected math is robust.)
      const tx = (G.camera.y / 16 - G.camera.x / 32) / 2;
      const ty = (G.camera.y / 16 + G.camera.x / 32) / 2;
      G.particles.push({
        tx, ty,
        offsetX: 120, offsetY: -150,  // slight east + sky
        vy: 0,
        alpha: 0.85, decay: 0.015,    // ~55 frames ≈ 0.9s lifetime
        type: 'lightning',
      });
    } },
  // Loop 212 (the-fixer, 207 filed): FOURTH early-game beat. Year-1
  // summer day 12+ — late summer, between fields_know (day 10) and
  // autumn pair (day 15). **Individual-interiority register** — first
  // beat in the cluster where focal is a single anonymous settler
  // rather than "the realm" collective. Per 207 filing: shifts focal
  // from realm-collective to individual citizen. Per 203 positive
  // authoring rule: meta-recognition that the chronicle witnesses
  // moments the realm-as-collective never sees ("No one sees. The
  // realm goes on without seeing.") — earns the landing through
  // fresh META-angle, not pattern-completion. Sub-type:
  // individual-interiority (1 use, threshold 3+; new 8th sub-type
  // of observational-elder cluster). Static prose. Misc tag. Year-1
  // progression now 6 beats over 12 days (founders 3-6 / long-evening
  // 8 / fields-know 10 / first-sigh 12 / cold-morning + constellation
  // 15). Density 6 beats / ~3 minutes at speed 4× = 2 beats/min;
  // tight but coherent.
  { flag: 'first_sigh_seen', tag: 'misc',
    trigger: G => G.season === 'summer' && G.day >= 12,
    text: 'There is an afternoon when a settler sets down a bucket halfway between the well and the houses, leans against a stone, and breathes out. No one sees. The realm goes on without seeing.' },
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
  // Loop 174 (surprise, un-filed, post-moratorium): first frost. Sibling
  // to 147 great-storm in seasonal placement (both year-2+ autumn) but
  // PRESENT-tense observation rather than past-tense memory. Fires on
  // day ≥ 45 (mid-late year-2 autumn) so 147 has a 2-day head start
  // and the two beats land on different chronicle mornings.
  // Year-2-aware: the realm has lived through one full cycle and now
  // RECOGNIZES the seasonal change rather than just experiencing it.
  // Tag: misc (sibling cluster register; observational, communal).
  // Static string — autumn frost is a singular event (no kingdom-
  // hashed variants; the FIRST frost is one moment per realm-year).
  // Diversifies the surprise palette: 148/152/166 = ambient-entity
  // grammar, 174 = seasonal/weather-recognition. Different family.
  { flag: 'first_frost_marked', tag: 'misc',
    trigger: G => G.storyFlags.year2 && G.season === 'autumn' && G.day >= 45,
    text: 'There is a morning when frost finds the fields and does not leave by noon. The realm marks the year by it now.' },
  // Loop 246 (surprise, un-filed): FIRST-THAW year-2+ spring beat.
  // Sibling to 174 first-frost (year-2 autumn) but OPPOSITE seasonal
  // boundary — the realm now has memory of one full winter and
  // experiences the thaw differently than the unfamiliar first time.
  // Per 213 diversification: tag:event matches 147 great-storm
  // weather-memory pattern, NOT misc-tag (8 ticks of misc surprises
  // since 207). "Colder than memory expected; somehow this is
  // reassuring" — small psychological observation that weather memory
  // is unreliable + that's OK. Closing line lifts beyond literal
  // moment per 184/199/240 craft. No META-frame per 213 finding 2.
  // Static prose; year-2+ once-fire.
  { flag: 'first_thaw_known', tag: 'event',
    trigger: G => G.storyFlags.year2 && G.season === 'spring' && G.day >= 31,
    text: 'The first warm day of the second year arrives. The realm goes barefoot to the river. The water is colder than memory expected; somehow this is reassuring.' },
  // Loop 211 (surprise, closes 060 filed ~150 ticks): SUSTAINED-STATE
  // beat. New shape — fires when a temporal threshold is crossed
  // (50+ days since last raid) rather than a single state-condition.
  // Gate requires raidsSurvived ≥ 1 (peace must be EARNED, not just
  // never-threatened) AND lastRaidDay set (defensive against legacy
  // saves) AND G.day - lastRaidDay ≥ 50. The infrastructure (211
  // economy.js + save.js) tracks lastRaidDay; this trigger checks the
  // delta. Realistic firing window: year-2+ for fortified realms
  // that successfully repel raids and accumulate peace. Joins the
  // observational-elder register cluster as a new sub-type:
  // sustained-state-recognition (1 use; promote at 3+). Per 203
  // positive rule: the prose surprises ("the realm carries the
  // quiet differently than it carried the war") rather than just
  // checking a peace-box. Tag: misc.
  { flag: 'sustained_peace_known', tag: 'misc',
    trigger: G => G.stats && G.stats.raidsSurvived >= 1 && G.lastRaidDay !== undefined && (G.day - G.lastRaidDay) >= 50,
    text: 'There comes a stretch of days when the watch still climbs the walls each evening, but their hands rest where weapons would have been. The alarm has not sounded in fifty days. The realm carries the quiet differently than it carried the war.' },
  // Loop 228 (surprise, 211 filed): SUSTAINED-STATE #2 — promotes
  // the sub-type from 1 use (211) to 2 toward 3+ threshold. Mirror
  // shape: G.lastDeathDay tracker (set at combat.js:131 and
  // economy.js:347 starvation site) + save.js persistence + this
  // gate. Earned-state requirement: stats.citizensDied >= 1
  // ensures the realm has FACED death, not just lived in lucky
  // absence. Realistic firing window: year-2+ for realms that
  // survived early hardship and stabilized. 100-day threshold (vs
  // 211's 50-day for peace) reflects that death is rarer baseline
  // than raids — needs a longer absence to read as remarkable.
  // Sub-type sustained-state-recognition; tag misc; static prose.
  { flag: 'no_death_known', tag: 'misc',
    trigger: G => G.stats && G.stats.citizensDied >= 1 && G.lastDeathDay !== undefined && (G.day - G.lastDeathDay) >= 100,
    text: 'A hundred days have passed without burial. The grave field is older than the last grave; weeds soften the marker stones. The realm sleeps with a different weight in its chest now.' },
  // Loop 230 (surprise, 228 filed): SUSTAINED-STATE #3. Promotes the
  // sub-type 2 → 3 uses (mirror of 229's land-as-agent promotion).
  // 60-day threshold (vs 211's 50-day peace and 228's 100-day death-
  // free) reflects that full population is more recoverable than peace
  // (you can lose a citizen and gain another quickly) but rarer than
  // simple absence-of-event. Earned gate: pop >= 10 ensures the realm
  // is large enough that "fully populated" is meaningful + lastUnderpop
  // !== undefined ensures the realm has FACED at least one underpop
  // moment. "For now" closing acknowledges this is a transient state,
  // not permanence — typical realm-resilience register.
  // Sub-type sustained-state-recognition reaches 3 uses (211/228/230)
  // — meets 3+ promotion threshold but per 188 precedent promotion
  // remains conservative.
  { flag: 'full_pop_known', tag: 'misc',
    trigger: G => G.population >= 10 && G.lastUnderpopDay !== undefined && (G.day - G.lastUnderpopDay) >= 60,
    text: 'For sixty days the houses have all stood full. No empty bed, no vacant chair, no spare loaf. The realm is the size it knows how to be, for now.' },
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
  // Loop 184 (surprise, un-filed): the stone is forgotten. FOURTH beat
  // on 056's standing stone arc, closing the cycle: 056 discovery →
  // 079 offering → 122 weathering → 184 forgetting. The realm has lived
  // long enough for an entire generation to grow up never having
  // witnessed the discovery. Frame parallels 147 great-storm's
  // "children born after do not believe it" — generational gap as
  // narrative texture, not founder bookkeeping.
  // Gate: year3 (day ≥ 57) + stone_found + citizensBorn ≥ 10 (enough
  // generational turnover that 'youngest never heard the story' lands).
  // Tag: stone (reuse; eviction-immune per 085). Static text — the
  // forgetting is uniform, regardless of kingdom.
  { flag: 'stone_forgotten', tag: 'stone',
    trigger: G => G.storyFlags.year3 && G.storyFlags.stone_found && G.stats && G.stats.citizensBorn >= 10,
    text: 'Years pass, and the standing stone goes unmentioned for whole seasons. The youngest in the realm have never heard the story of who found it.' },
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
  // Loop 199 (surprise, 196 filed): SECOND early-game beat per 195
  // skeptic alternation discipline. Sibling to 196 first_long_evening
  // (summer-evening / anti-anxious) but DIFFERENT MOOD: morning beat
  // marking the seasonal turn from summer into autumn. Fires the same
  // day-window as 116 constellation_named (autumn day ≥ 15) but BEFORE
  // it in table order — so the chronicle reads morning-cold then
  // evening-stars on the seam day. Static prose; observational-elder
  // register matching the 148/152/166/174/184/190/193/196 cluster.
  // Hopeful-not-anxious: "goes on" closes with continuity rather than
  // alarm. Pairs first_long_evening (8 of 196 filed early-game pool)
  // → first_cold_morning (this) as morning/evening sibling beats
  // bracketing year-1's mid-game. Two more candidates remain filed
  // ("fields know the realm" / citizen first sigh).
  { flag: 'first_cold_morning', tag: 'misc',
    trigger: G => G.season === 'autumn' && G.day >= 15,
    text: 'There is a morning when the air has changed. Dew holds late on the grass; breath shows on a back step for the first time. The realm pulls a cloak closer and goes on.' },
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
  // Loop 193 (surprise, post-moratorium): a place gets a name. Sibling
  // to 116 constellation (sky-naming) and 056 stone (object-finding) on
  // the realm-naming-its-environment axis. Different mood from forgetting
  // beats (184/190): something coming-into-existence rather than fading.
  // 8 kingdom-hashed feature names (bent ash / cold spring / long hill /
  // etc) — rural-vernacular shape (places named for distinguishing
  // features, not founders). "No one decided this; it simply is" frames
  // the naming as emergent rather than imposed.
  // Gate: year2 (day ≥ 29) + day ≥ 50 (deep year-2 — realm has lived
  // long enough that places ACQUIRE names by use). Tag: milestone
  // (matches 116 naming-axis anchor).
  { flag: 'landmark_named', tag: 'milestone',
    trigger: G => G.storyFlags.year2 && G.day >= 50,
    text: G => {
      const kname = G.kingdomName || 'Realm';
      const names = [
        'the bent ash',
        'the cold spring',
        'the long hill',
        'the path between',
        'the high meadow',
        'the southern ridge',
        'the stone wall',
        'the old well',
      ];
      const idx = _dreamHash(`${kname}_landmark`) % names.length;
      return `There is now a place called ${names[idx]}. No one decided this; it simply is.`;
    } },
  // Loop 190 (surprise, post-moratorium): the constellation is
  // forgotten. SECOND use of the object-arc closure template (188
  // invariant): 116 constellation_named → 190 constellation_forgotten.
  // Constellation has narrative anchor (116) + visual support (151
  // SVG-rendered asterism + 159 shooting-star-once) — the closure
  // beat acknowledges that named patterns fade across generations.
  // Different cycle shape from stone (4 beats) — constellation has
  // 1 narrative anchor, so this is a 2-beat closure (named + un-
  // named). Template doesn't require all 4 beats; only that the
  // object has earned its closure.
  // Gate: year3 (day ≥ 57) + day ≥ 85 (deep year 3 / year 4) +
  // constellation_named (the realm must have NAMED it before it can
  // forget) + citizensBorn ≥ 10 (intergenerational turnover, matches
  // 184 stone). Tag: milestone (matches 116 constellation_named's
  // anchor). Static prose (forgetting is universal).
  { flag: 'constellation_forgotten', tag: 'milestone',
    trigger: G => G.storyFlags.year3 && G.day >= 85 && G.storyFlags.constellation_named && G.stats && G.stats.citizensBorn >= 10,
    text: 'Years pass, and the constellation the realm named goes back to being just stars. No one corrects the youngest when they call them by other names, or by no name at all.' },
  // Loop 192 (the-fixer, closes 103 filed): `G.realmEnded` flag added
  // via `after:` callback (144 schema). Sets when realm_fell beat
  // fires. Silent-module: future rendering ticks can read this to
  // desaturate / fog / silence post-end. No immediate visual change.
  // Mirrors the way 144 namesake's `after:` reifies a chronicle
  // reference into game state.
  { flag: 'realm_fell', tag: 'requiem', onFire: 'requiem',
    trigger: G => G.day > 1 && G.population === 0,
    text: G => {
      const f = G.storyFlags.founder1;
      return f
        ? `The last fire in the realm goes out. ${f}'s name is the last spoken, and then there is no one to speak it.`
        : 'The last fire in the realm goes out. There is no one left to tend it, and no one left to remember.';
    },
    // Loop 278 (the-fixer, 260 [code] filing): write the terminal "chronicle
    // closes" entry directly via G.chronicle.push, bypassing the chronicle()
    // gate which is about to activate when realmEnded flips below. Pairs
    // with 260's chronicle-gate to give the chronicle a clean typographic
    // close — like the last page of a book. Tag 'requiem' is eviction-
    // immune (story.js:26 _EVICTION_IMMUNE_TAGS), so this terminal entry
    // survives any future cap-eviction pressure. Two consecutive requiem
    // entries (the realm_fell text + this terminal) is intentional: both
    // deserve the realm's last-page treatment.
    after: G => {
      if (G.chronicle) {
        G.chronicle.push({
          day: G.day, season: G.season, tick: G.gameTick,
          text: 'The chronicle ends here. There is no one left to begin a new page.',
          tag: 'requiem',
        });
      }
      G.realmEnded = true;
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
  // Loop 260 (the-player): also gate the iteration itself so flags
  // don't get set for beats whose chronicle write would no-op anyway.
  // Belt-and-suspenders alongside the chronicle() gate above — the
  // chronicle() gate is the seatbelt; this is the speed-limit.
  if (G.realmEnded) return;

  // Simple first-build beats — one pattern, one table. See BUILDING_FIRST_BEATS.
  // The optional `after` field runs once when a beat fires; used to introduce
  // a named character tied to the building (added in 034).
  for (const beat of BUILDING_FIRST_BEATS) {
    if (!hasFlag(beat.flag) && G.buildings.some(b => b.type === beat.type)) {
      setFlag(beat.flag);
      // Loop 244: text may be a string OR a function (G)→string,
      // mirroring NARRATIVE_BEATS dispatch (story.js:910). Lets
      // first-build beats reference dynamic state like the named
      // mayor at townhall (see 244 entry).
      const text = typeof beat.text === 'function' ? beat.text(G) : beat.text;
      chronicle(text, 'milestone');
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

  // Loop 194 (the-fixer, closes 116 filed): constellation-specific
  // echo frame. When the echoed source is the 116 constellation_named
  // beat (detected via the unique "first autumn stars" phrase), surface
  // a tighter quote — "Old folk still call them ${shape}" — pulling the
  // kingdom-hashed shape name out of the source text. Replaces the
  // generic 4-frame wrap which would echo the whole "${f}, looking up..."
  // prose. Reads as the constellation NAME persisting through time, not
  // the act of naming being repeated.
  if (src.tag === 'milestone' && /first autumn stars stand clear above the eastern ridge/.test(quoted)) {
    const shapeMatch = quoted.match(/(?:names? them|name the pattern) (.+?)\. The realm takes the name/);
    const shape = (shapeMatch && shapeMatch[1]) ? shapeMatch[1] : 'them';
    chronicle(`Old folk still call them ${shape}.`, 'echo');
    return;
  }

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

  // Loop 214 (surprise, 089-broader filed): founder-conditional
  // offering item. 097 wove founders into 3 dream threads
  // (founding/hearth/harvest); offering pool stayed founder-blind.
  // 213 skeptic flagged cluster monoculture in recent narrative
  // ships (5 in 17 ticks all misc-tag observational-elder); 214
  // diversifies by EXTENDING an existing non-cluster beat rather
  // than adding a new cluster member. Tag stone (reuse per 075);
  // anonymity preserved (founder1's name on the item, not as
  // placer — "no one admits to placing it" still reads).
  // Founder1 chosen for continuity with 097 (founder1 = fire-
  // keeper / first ritualist); the offering at the stone is a
  // continuation of ritual life. Once-per-realm — additive only,
  // doesn't change existing realms' deterministic offerings if
  // they fired pre-214.
  const items = [..._OFFERING_ITEMS];
  if (G.storyFlags.founders_named && G.storyFlags.founder1) {
    items.push(`a small piece of wood with ${G.storyFlags.founder1}'s name carved into the grain, smooth from being held`);
  }
  // Pick item from the pool (now possibly 7-deep with founder variant)
  const idx = _dreamHash(`${kname}_offering_item`) % items.length;
  const item = items[idx];

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
