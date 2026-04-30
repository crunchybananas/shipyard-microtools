# narrative-surfaces.md

**Table of contents** (288 doc-hygiene addition; doc growth past 2000
lines unblocked by this navigability + per-section anchors):

- `## why this exists` — purpose and steering
- `## tag inventory` — 15 tags taxonomy
- `## 20 chronicle-writing systems` — 075's audit + updates
- `## execution order` — system-call order at startup/tick
- `## invariants` — prescriptive rules (~8 active: 075/144/named-char-
  mech/etc + 276 shape-axis + 284 variant-pool + 287 combination-rule
  + 298 OUTSIDE-cluster + 308 STRUCTURAL-surprise [+ 315 STRUCTURE-
  ANGLE coupling sub-rule within 308; + 350 sub-type-internal-axes
  sub-rule within 276])
- `## observed patterns` — descriptive observations <3 uses
- `## known gaps` — 104-tick filing of unresolved seams
- `## retired hypotheses` — patterns falsified or demoted
- `## cadence summary` — per-tick chronicle entry budget
- `## how to update this doc` — maintenance protocol
- `## related loop references` — adjacent loop docs

**Status:** Written in tick 075. Updated 080, 084, 091, 104, 129, 141, 155, 177, 178, 188, 198, 203, 205, 206, 208, 209, 210, 211, 212, 214, 227, 228, 229, 230, 232, 243, 248, 251, 252, 253, 288. Maintained by
subsequent loops.
**Sources:** 059 built echo, 060 mapped 9 systems, 069 saw real-time
triplicate, 070 fixed it, 073 audited enhancements.js and found 11
more systems, 074 removed 5 duplicates, 075 wrote this. 076 audit
found 10 more duplicate-toast sites, 077 closed 8 of them (3 HIGH
+ 5 MEDIUM). 078 shipped the tag-filter UI using the taxonomy
below. 079 added a cross-system compound beat (offering-at-stone,
reuses `stone` tag). 080 first maintenance update. 081 shipped
`G.debug.fastForward` infra. 082 ran completionist through
fastForward + found 2 HIGHs (raid pollution, "dawn gate skip").
083 closed BOTH with one 3-line fix — the "dawn gate skip"
hypothesis was wrong; real mechanism was cap eviction by raid
noise. 084 captured the 082/083 lesson. 085 shipped eviction-
immune protection for nightmare/stone/victory tags. 088 added
first-snow cross-system compound beat. 089 added founder-
conditional fragments to the nightmare pool (closed 072's
founder→nightmare gap). 090 consolidated 8 inline one-shot
beats into the shared NARRATIVE_BEATS table (closed 062, the
longest-open idea at 28 ticks). 091 captured 085-090 in the doc.
092 migrated year-milestones cross-file into NARRATIVE_BEATS
(closed 082 "1 souls" grammar bug). 093 added subsequent-winter
beats × 3 as a founder-aging arc. 097 added founder-conditional
image variants to 3 dream threads. 101 + 102 graduated the
named-character system from decoration to mechanic (teacher +10%
research, merchant +5% trade). 103 (surprise) added an end-of-
realm `requiem` beat — new 15th tag, Lira arc closes across 7
narrative surfaces. 104 caught the doc up to 092-103. 116 added
constellation_named (first beat where founder2 is sole focal;
began rebalancing the founder arc from founder1-oversaturation).
121 migrated 088's inline first-snow into NARRATIVE_BEATS. 122
(un-filed surprise) added stone_weathered — 3rd beat on 056's
stone arc (discovery→offering→weathering). 123 refactored
Pattern-2 audio dispatch to `onFire: 'soundName'` field on
NARRATIVE_BEATS entries (see audio-surfaces.md). 124 shipped
first-snow cue via onFire. 125 shipped offering cue — **closes
original 106-filed audio list entirely** (6 cues shipped). 128
(un-filed surprise) added longest_night_seen — founder3 as
night-watcher, continuing 116's founder-rebalancing. 129 caught
the doc up to 116-128. 134 (un-filed surprise) added
namesake_born — intergenerational continuity beat (child takes
a founder's name, kingdom-hashed pick). 137 shipped the
namesake audio cue (F4→A4 spoken-name intonation). 138 (un-
filed surprise) added shepherd's song — founder2 at cowpen on
cold evening; **founder arc fully balanced at 7/5/4**. 141
caught the doc up to 134-138. 142 (un-filed surprise) added
`distant_letter_received` — first beat referencing the world
OUTSIDE the island (10 distant-kingdom names × 6 news fragments
= 60 pairs per kingdom-hash pool, kingdom-deterministic). 144
(the-fixer) extended the NARRATIVE_BEATS schema with
`after: (G) => void` callback for arbitrary side effects
(mirrors BUILDING_FIRST_BEATS `after:`); 134's namesake entry
gained the hook to rename the newest citizen to the hashed
founder's name. **146 (the-contrarian) flagged founder-arc
overreach at 16 surfaces (7/5/4); proposed a 10-tick
founder-moratorium for ticks 147-156.** 147 (moratorium
tick 1, surprise) added `great_storm_remembered` — weather/
memory focal, no founder reference, 5 kingdom-hashed storm
variants. 148 (moratorium tick 2, surprise) gave 048's
silent walker its first narrative surface
(`wanderer_acknowledged`, misc tag, elder-saying register,
"no one calls them anything"). 151 (the-fixer) reactivated
016's disabled `renderConstellations` path for a kingdom-
hashed procedural asterism that actually appears in the
night sky after 116's beat fires. 152 (moratorium tick 6,
surprise) mirrored 148's pattern for 031's ghost entity
(`night_shape_seen`, seen by children at night) —
**moratorium scorecard HITS target** (3/≥3 non-founder
surprises). 148+152 form a paired grammar for ambient-
entity acknowledgment without founder bookkeeping. 155
caught the doc up to 142-152. **157 (meta) closed the 146
moratorium check-in** with all targets HIT; soft-cap policy
replaces hard rule; founder arc unchanged at 7/5/4. 158-170
shipped 5 SVG sprites + 2 3D mesh ticks (167/163), opening
the SVG/3D render axes per user steering 2026-04-28; 171/172
captured the strategic plan + .glb-meshes "loop does not
touch" boundary in `loop/docs/render-layers.md` (sibling doc
to this one). 166 (post-moratorium surprise) added
`frog_voices_heard` — 3rd ambient-entity acknowledgment beat
(water-edge sound focal, spring/summer evenings, 14-tick
spacing from 152 honors 156's queue-drain warning). 174
(post-moratorium surprise, between Phase A sprites) added
`first_frost_marked` — sibling to 147 great-storm in
seasonal placement (year-2+ autumn) but PRESENT-tense
observation rather than past-tense memory; pairs the
autumn-of-year-2+ signature. 177 caught the
doc up to 166 and 174. 178 (the-fixer, 1-line) lowered 166's
day-gate from 70 to 35 — original `≥ 70` was a math mistake by
166's author given the 28-day-year structure (year 1: days 1-28;
year 2 spring/summer ends at day 42 — `≥ 70` only fired year 3
day 70 onward). Doc cadence revised ~144-185 post-fix.
**184 (surprise, post-moratorium)** added `stone_forgotten` —
**FOURTH beat on the standing-stone arc**, closing the cycle:
056 discovery → 079 offering → 122 weathering → 184 forgetting.
Realm's longest object-centered narrative gets its closing
chord. Generational-gap framing parallels 147 great-storm's
"children born after do not believe it." Static prose; no
kingdom-hashed variants (forgetting is universal whereas
weathering is per-kingdom). Tag: stone (reuse;
eviction-immune per 085). Gate: `year3 && stone_found &&
citizensBorn ≥ 10`. 185-187 shipped 3D-mesh fallback ticks
(tavern/blacksmith/market) — chrome-independent
graphics work; no chronicle additions. 188 caught
the doc up to 184 + added the OBJECT-ARC CLOSURE
template invariant (filed at 184 for cross-
application). 189/191 shipped type-scale phase 5
+ 6 (CSS hygiene; **130 HIGH closes** after 6
phases / 42 migrations / 61 ticks; non-narrative).
**190 (surprise, post-moratorium)** added
`constellation_forgotten` — a 2-beat closure (116
named → 190 forgotten). 188 originally framed
this as "second use of object-arc closure
template"; **202 contrarian** rejected the
template framing (stone's 4-beat and constellation's
2-beat are different shapes); **203** demoted to
observed pattern (see `## observed patterns`). **192
(the-fixer)** closed 103-filed `G.realmEnded`
flag via the **second use** of the 144 `after:`
schema (after 134 namesake's citizen-rename) —
realm_fell beat sets a runtime flag for future
post-end consumers. **193 (surprise)** added
`landmark_named` — opens the **realm-environment
naming triplet** (sky 116 / object 056 / place
193). NARRATIVE_BEATS reaches 30 entries. **194
(the-fixer)** closed 116-filed constellation
echo frame: special branch in checkEchoBeat
detects 116 source via unique phrase + extracts
shape via regex; surfaces "Old folk still call
them ${shape}" frame. Constellation arc now 5
touchpoints (116/151/159/190/194). **195 (the-
skeptic)** flagged year-3+ beats may be
invisible to median play; recommended early-
game bias for next 5-10 narrative ticks. **196
(surprise)** directly responded with
`first_long_evening` — year-1 summer day ≤ 14;
**anti-anxious mood** ("things are okay");
fills the THIN year-1 summer narrative gap.
NARRATIVE_BEATS 31 entries. **197 (the-fixer)**
shipped G.realmEnded save persistence (closes
192-filed; 2-path defensive load). 198 (this
update) catches the doc up to 190/193/196 +
documents the 194 checkEchoBeat source-specific
echo branch in system #11.

## why this exists

Before 075, the realm's chronicle-producing systems were scattered
across 6 files with no single place that listed them. Each new
tick doing narrative work re-discovered parts of the surface by
grep. 053 mis-diagnosed an existing system as missing. 060 claimed
9 systems; reality was ~20. 069 found a season-change triplicate
that no programmatic audit would catch. 073 found 5 duplicate
first-build beats that were dead code for many ticks.

This doc is the single place to look when you want to know:

- What chronicle tags exist, and who writes them
- Which file owns which narrative system
- What's shipped versus deprecated
- Where the dead code lives, if any remains

Keep it accurate or retire it — a lying doc is worse than none.

## tag inventory (15 tags)

| Tag          | Writer file(s)                      | Cadence             |
| ------------ | ----------------------------------- | ------------------- |
| `milestone`  | story.js + enhancements.js + main.js | one-shot + recurring |
| `victory`    | story.js + enhancements.js          | once-per-realm      |
| `character`  | story.js + enhancements.js          | one-shot + recurring |
| `birth`      | story.js + economy.js               | one-shot + recurring |
| `death`      | combat.js + economy.js + events.js  | recurring           |
| `raid`       | story.js + enhancements.js + events.js | one-shot + recurring |
| `event`      | events.js (+ notify passthrough)    | recurring            |
| `season`     | main.js                             | recurring           |
| `dream`      | story.js                            | recurring            |
| `nightmare`  | story.js                            | once-per-realm      |
| `stone`      | story.js                            | once-per-realm      |
| `echo`       | story.js                            | recurring            |
| `research`   | tech.js                             | recurring            |
| `misc`       | story.js + enhancements.js + notifications.js | rare+recurring |
| `requiem`    | story.js                            | once-per-realm (103)|

## 20 chronicle-writing systems (as of tick 075)

Numbered in rough order of file:

### story.js (10 systems)

1. **Founding beat** (day 1, one-shot, `milestone`) — written from
   `main.js:118` but conceptually belongs with story.
2. **BUILDING_FIRST_BEATS** (022/057/062, table-driven, `milestone`) —
   single source of truth for first-build. 16 entries. Tavern/
   barracks/church entries include `after:` hooks for 034 named
   characters.
3. **034 ensure* character intros** (`character`) — mayor/bard/
   rival/smith/merchant/teacher. Triggered by building-first hooks.
4. **072 founders named** (seeded day [3,6], `character`) — 3 names
   from a 20-name pool, stored as `storyFlags.founder1/2/3`.
5. **NARRATIVE_BEATS table** (090 landed; 092, 093, 103, 116,
   121, 122, 128, 134, 138, 142, 147, 148, 152, 166, 174, 184,
   190, 192, 193, 196 extended) — consolidates state-triggered
   one-shot beats. Each entry: `{ flag, tag, trigger(G)→bool,
   text: string|(G)→string, onFire?: string, after?: (G)=>void }`.
   Mirrors BUILDING_FIRST_BEATS; sibling table, single dispatch
   loop. 123 added the optional `onFire: 'soundName'` string
   field for audio (see audio-surfaces.md Pattern 2); **144
   added the optional `after: (G) => void` callback for
   arbitrary side effects** (mirrors BUILDING_FIRST_BEATS
   `after:` used since 034). 192 added a **SECOND use of the
   `after:` schema** (after 134 namesake): `realm_fell` entry
   gains `after: G => { G.realmEnded = true; }` for post-end
   runtime mode. **Current 31 entries:**
   - 8 original (090): firstBirth, pop10/25/50/75/100, castleBuilt,
     firstRaidSurvived
   - 3 year milestones (092, migrated from enhancements.js): year2,
     year3, year5 (year2 uses `${n} soul${n===1?'':'s'}` for
     correct pluralization — closes 082 grammar bug)
   - 3 subsequent-winter beats (093, founder-aging arc):
     second_winter_seen, third_winter_seen, fifth_winter_seen —
     each references founder1 by name ("Lira knows what to store"
     / "Lira counts like elders" / "Lira remembers the first")
   - 1 realm-end beat (103): realm_fell — requiem tag, references
     founder1 when present ("${f}'s name is the last spoken");
     **`onFire: 'requiem'`** (123 — audio via single bell toll)
   - 1 constellation beat (116): constellation_named — fires first
     autumn past day 15; deterministic 20-shape pool per kingdom
     hash; **first beat where founder2 is SOLE focal** (sky-
     watcher role) — began rebalancing the founder arc
   - 1 first-snow beat (121, migrated from 088 inline; founder1
     canonical field-stander); **`onFire: 'first-snow'`** (124 —
     audio via noise bursts + high sine)
   - 1 stone-weathering beat (122, un-filed surprise): fires day
     ≥150 AND stone_found; tag:stone (reuse); 4 kingdom-hashed
     variants
   - 1 stone-forgetting beat (184, un-filed surprise): once-per-
     realm when `year3 && stone_found && citizensBorn ≥ 10`;
     **CLOSES THE STONE ARC** as a 4-beat cycle (056 discovery
     → 079 offering → 122 weathering → 184 forgetting) — realm's
     longest object-centered narrative. Tag: stone (reuse;
     eviction-immune per 085). Static text: "Years pass, and the
     standing stone goes unmentioned for whole seasons. The
     youngest in the realm have never heard the story of who
     found it." Generational-gap framing parallels 147
     great-storm's "children born after do not believe it" —
     same past-event-not-witnessed structure for an OBJECT
     instead of a WEATHER MEMORY. Static (no kingdom-hashed
     variants) because forgetting is universal even when
     weathering is per-kingdom.
   - 1 constellation-forgetting beat (190, un-filed surprise):
     once-per-realm when `year3 && day ≥ 85 &&
     constellation_named && citizensBorn ≥ 10`.
     **Closes the constellation arc as a 2-beat cycle** (116
     named → 190 forgotten). Originally framed at 190 as
     "second use of 188 object-arc closure template"; 202
     contrarian rejected that framing — stone's 4-beat and
     constellation's 2-beat are different shapes — and 203
     demoted the template to observed-pattern (see
     `## observed patterns`). Tag: milestone (matches 116's
     anchor). Static
     prose: "Years pass, and the constellation the realm named
     goes back to being just stars. No one corrects the
     youngest when they call them by other names, or by no
     name at all."
   - 1 landmark-named beat (193, un-filed surprise): once-per-
     realm when `year2 && day ≥ 50`. **OPENING beat** (mood
     contrast vs forgetting cluster). Third member of the
     realm-environment naming triplet (sky 116 / object 056 /
     place 193). 8 kingdom-hashed rural-vernacular names ("the
     bent ash" / "the cold spring" / "the long hill" / "the
     path between" / "the high meadow" / "the southern ridge" /
     "the stone wall" / "the old well"). "No one decided this;
     it simply is" emergent-naming idiom. Tag: milestone.
   - 1 first-long-evening beat (196, un-filed surprise; **post-
     195 skeptic-flag response**): once-per-realm when
     `season === 'summer' && day ≤ 14`. **YEAR-1 ONLY** —
     fires in the THIN year-1 mid-summer narrative gap (days
     8-14, between founders day 3-6 and autumn beats day ≥ 15).
     **Anti-anxious mood**: "things are okay right now" —
     almost no other realm beat permits rest. Static text:
     "There is a summer evening early in the realm when nothing
     is asked of anyone. The work is done. The fields hold heat
     into the dusk, and the fire is allowed to burn low." Tag:
     misc (joins observational cluster — 9 misc-tag beats now).
   - 1 realm-fell `after:` hook (192, the-fixer): closes 103
     filed 89 ticks ago. `realm_fell` entry gains `after: G =>
     { G.realmEnded = true; }` for post-end runtime mode. Second
     use of the after callback after 134 namesake. Silent-
     module: ships the flag-setter; consumers (render desat /
     audio fade / UI suppression) pending. 197 added save
     persistence (defensive 2-path load).
   - 1 longest-night beat (128, un-filed surprise): fires in deep
     night of first winter (day ≥22 AND dayPhase > 0.85 ×
     dayLength); **founder3 as night-watcher** (4th canonical
     role for founder3)
   - 1 namesake beat (134, un-filed surprise): once-per-realm
     when `founders_named && citizensBorn >= 5`; child is born
     bearing a founder's name (deterministic per kingdom via
     `_dreamHash(${kname}_namesake_who) % 3`); **`onFire:
     'namesake'`** (137 — F4→A4 two-note spoken-name intonation)
   - 1 shepherd's-song beat (138, un-filed surprise): once-per-
     realm when `founders_named && firstCowpen && day ≥ 30 &&
     (autumn || winter)`; **founder2 as shepherd-singer** —
     completes the founder arc rebalance to 7/5/4
   - 1 namesake `after:` hook (144, the-fixer): 134's entry
     gained an `after: G => ...` hook that renames the newest
     citizen to the kingdom-hashed founder's name. First use of
     the new schema field. Citizens persist names across save/
     load (save.js:29 confirms); what was theatrical at 134
     now reifies a real in-game citizen carrying the founder's
     name (visible in tooltips)
   - 1 distant-letter beat (142, un-filed surprise): once-per-
     realm when `firstMarket && day ≥ 60`; **first beat to
     reference the world OUTSIDE the island** — a traveler
     brings word from one of 10 distant kingdoms (Norrith /
     Velar / Ashen Fields / etc) about one of 6 news fragments
     (grain red + bells at dusk / rivers backward / winter-
     ghost / …). 60 pairs total, both dimensions kingdom-
     hashed (separate seeds: `_distant_name`, `_distant_news`).
     Tag: event (reuse); echo-eligible via 063
   - 1 great-storm beat (147, moratorium tick 1, un-filed
     surprise): once-per-realm when `year2 && autumn`;
     **weather/memory focal, NO founder reference** — 5
     kingdom-hashed storm-memory variants. Intergenerational
     nod via "children born after do not believe it" without
     named founders. Tag: event (reuse). `onFire:
     'great-storm'` (149 audio — low-band noise + D2 rumble
     + D3 overtone, slow attack signals memory-forms)
   - 1 wanderer-acknowledgment beat (148, moratorium tick 2,
     un-filed surprise): once-per-realm when `day ≥ 50`;
     **gives 048's silent walker its first narrative surface
     after 87 ticks**. Static string, no variants (048's
     design asserts ONE wanderer per realm). Tag: misc (reuse;
     elder-saying register). "No one calls them anything" —
     acknowledges without naming, honoring 048's original
     intent (the wanderer remains un-identified)
   - 1 night-shape-acknowledgment beat (152, moratorium tick 6,
     un-filed surprise): once-per-realm when `day ≥ 60 &&
     firstBirth`; **gives 031's ghost entity its first
     narrative surface after ~121 ticks**. Static string;
     no "ghost" word in prose (142 uses "winter-ghost" but
     only for a DISTANT realm's news — our own realm's
     ambiguity preserved). Tag: misc (reuse; mirrors 148).
     "The youngest in the realm speak of a bright shape in
     the fields. No one asks them to describe it."
   - 1 frog-voices beat (166, post-moratorium surprise; gate
     fixed at 178): once-per-realm when `day ≥ 35 && (spring
     || summer)`. Third ambient-entity acknowledgment
     (148/152/166 grammar); **water-edge sound focal** (no
     other beat covers water-edge or sound-based). Tag: misc.
     Static string: "There are evenings after rain when the
     water-edges speak in two voices. The realm does not name
     the things speaking." 14-tick gap from 152 honors 156's
     queue-drain warning. **178 fixed**: 166 originally shipped
     with `day ≥ 70` (math mistake — fired year-3+ only); 178
     lowered to 35 so year-2 spring is the natural fire window.
   - 1 first-frost beat (174, post-moratorium surprise): once-
     per-realm when `year2 && autumn && day ≥ 45`. **Sibling
     to 147 great-storm in seasonal placement** (both year-2+
     autumn) but PRESENT-tense observation rather than past-
     tense memory; 174's `day ≥ 45` gate gives 147 a 2-day
     head start so beats land on different chronicle mornings
     within the same season. Year-2-aware: realm has lived
     through one full cycle and now RECOGNIZES the seasonal
     change. Tag: misc. Static string: "There is a morning
     when frost finds the fields and does not leave by noon.
     The realm marks the year by it now." Different family
     from ambient-entity grammar — seasonal/weather
     recognition.
6. **Happiness-threshold beats** (071, recurring with hysteresis,
   `milestone`) — peak ≥80 / crisis ≤20, mid-range 35-65 resets
   flags so cycling works. Kept inline in 090 refactor (re-fire
   semantics don't fit one-shot NARRATIVE_BEATS shape).
7. **First-snow beat** (088 inline, 121 migrated into
   NARRATIVE_BEATS) — fires once the first time the realm enters
   winter past day 10. References `storyFlags.founder1` by name
   if 072 has fired ("…${founder} stands in the fields…");
   otherwise generic. Now table-dispatched (see system #5 above)
   with `onFire: 'first-snow'` audio cue (124).
8. **checkDreamBeat** (039/054/055/097, 10-day cadence, `dream`) —
    10-thread pool, 044 seasonal lens, 064 approach boost. 097
    added founder-conditional image variants to 3 threads
    (founding:founder1, hearth:founder2, harvest:founder3) —
    function-form `images: (G) => [...]` pattern established by
    forge/market/learning threads. Graceful fallback when 072
    hasn't named founders.
9. **checkNightmareBeat** (043, once-per-realm seeded, `nightmare`).
    089 added 3 founder-conditional fragments to the image pool,
    gated on `founders_named`. Pool base 11 → 14 (+ up to 4 named-
    character conditionals = 18 max). Pool growth preserves
    hash-seed determinism per kingdom.
10. **checkStoneBeat** (056, once-per-realm seeded, `stone`) — renders
    via 058 at stored `stone_x`/`stone_y`.
11. **checkEchoBeat** (059/063/194, ~2% per-dawn, `echo`) —
    cites prior `_ECHO_SOURCE_TAGS` with one of 4 memory
    frames. **194 added a SOURCE-SPECIFIC FAST-PATH** before
    the default 4-frame dispatch: when source is the 116
    constellation_named beat (detected by unique "first
    autumn stars stand clear above the eastern ridge"
    phrase), extract kingdom-hashed shape via regex and
    surface "Old folk still call them ${shape}." Specialized
    echo for the constellation arc; default frames untouched
    for all other 12 milestone-tagged beats.
12. **checkOfferingBeat** (079, cross-system gated, `stone` tag
    reuse) — fires once per realm on a dawn when `stone_found`
    AND `happyPeakActive` AND `!offering_made` (+ day ≥ 30) at
    ~15% probability. First chronicle beat requiring the
    intersection of 3 system flags. 6 item variants.

(12 items in story.js. 090 compressed systems 5-8 of the pre-090
numbering into a single NARRATIVE_BEATS table; the underlying
beats still fire — firstBirth + 5 pops + castleBuilt + firstRaid
— they just share dispatch now.)

### main.js (2 systems)

13. **Founding beat** (day 1, `milestone`).
14. **Season transitions** (4×/year, `season`) — prose in
    `seasonTexts` object. After 070, toast does NOT double-chronicle
    (passes `{chronicle: false}`).

### tech.js (1 system, shipped in 065)

15. **Research completion** (per-tech completion, `research`) —
    RESEARCH_BEATS table, 11 entries + fallback.

### enhancements.js (10 systems)

16. **Year milestones** (year 2/3/5, `milestone`). 082 grammar
    bug ("1 souls") still open.
17. **Rival messenger** (day-scheduled via 034 `rival`, `character`
    and `raid`).
18. **Bard compositions** (raid-triggered via 034 `bard`, `character`).
19. **Mayor declarations** (happiness-triggered via 034 `mayor`,
    `character`).
20. **Building-count milestones** (10/25/50/etc., `milestone`).
21. **Disaster events** (plague/drought/fire/earthquake/merchant/
    refugees, `event`).
22. **Seasonal proverbs** (season-change `misc`) — was 069's
    "Children play at the well..." mystery.
23. **Victory v2** (`victory`) — may overlap with castleBuilt; audit
    needed.
24. **100-building milestone** (`victory`).
25. **Trading post first-build** (`firstTradingPost` flag,
    `milestone`) — only source; NOT in BUILDING_FIRST_BEATS.

### combat.js + economy.js + events.js + notifications.js (6 systems)

26. **Combat death** (combat.js:134, `death`) — raider kills.
27. **Starvation death** (economy.js:338, `death`).
28. **Population birth** (economy.js:362, `birth`).
29. **Plague death** (events.js:288, `death`).
30. **Random events** (events.js:308+, `event`, `character`, `raid`)
    — cloaked stranger, bard arrives, rival tribute.
31. **notify-passthrough** (notifications.js:68) — when callers
    pass type='event'/'danger'/'mission', the toast is also
    chronicled. Can be suppressed with `meta.chronicle=false`
    (loops 15 + 070 pattern).

### final count

story.js: 12 systems (post-090 table consolidation; underlying
  beat count unchanged)
main.js: 2 systems
tech.js: 1 system
enhancements.js: 10 systems
combat.js + economy.js + events.js: 5 systems
notifications.js: 1 shared passthrough

**≈ 31 narrative entry-points, producing ~29 distinct beat-
flavors post-155.** The 090 refactor means story.js has fewer
dispatching SITES but the same underlying beat SURFACES. Post-
155 NARRATIVE_BEATS holds 25 entries; total distinct flavors
factors in other system outputs (dreams, seasons, research,
disasters, etc).

The 060 audit said 9; 073 revised to ~20; a careful recount in
075 lands at 25. Each time the loop re-audits, the count grows.
Budget for that drift.

## execution order (matters)

Main-loop per-tick order (from main.js, simplified):

```
1. updateCitizens()
2. updateProduction() / economy beats
3. checkRaids() / combat beats
4. updateSeason() → season beats
5. checkRandomEvents() → event beats
6. updateResearch() → research beats  (065)
7. checkStoryBeats() → everything in story.js
   - BUILDING_FIRST_BEATS table
   - 034 ensure* hooks (via `after:` field)
   - NARRATIVE_BEATS table (090 — firstBirth / pop thresholds /
     castleBuilt / firstRaidSurvived in one dispatch loop)
   - first-snow (088) — winter + day ≥ 10 + founder1 if named
   - happiness-threshold (071) — peak/crisis with hysteresis
   - checkDreamBeat (039/054/055)
   - checkNightmareBeat (043 + 089 founder fragments)
   - checkStoneBeat (056)
   - checkEchoBeat (059/063)
   - checkFounderBeat (072)
   - checkOfferingBeat (079) — cross-gated by stone+happyPeak
8. enhUpdateAll() → enhancements.js registered updaters
   - year milestones
   - rival / bard / mayor beats
   - building-count
   - disaster events
   - seasonal proverbs
   - tradingpost first-build
```

**Consequence:** story.js beats fire BEFORE enhancements.js beats
in the same tick. This is why 074's removed duplicates were dead —
BUILDING_FIRST_BEATS set the flag before enhancements.js ran.

## invariants

These are things the loop has established and subsequent ticks
should respect:

- **`BUILDING_FIRST_BEATS` is the single source of truth for
  building-first beats.** No duplicate `updateXxxChronicle` in
  enhancements.js. (Enforced: 074 removed the duplicates.)
- **`NARRATIVE_BEATS` is the single source for state-triggered
  one-shot beats** (090, sibling to BUILDING_FIRST_BEATS). New
  beats that fit the shape `{flag, trigger(G), text, tag}` and
  fire at most once per realm SHOULD be added to this table
  rather than written inline. Re-fire semantics (hysteresis,
  cycles) stay inline until/unless the table grows a
  `resetOn:` extension (090 filed).
- **`_ECHO_SOURCE_TAGS` governs which tags are echo-eligible.**
  Currently: milestone, victory, character, birth, dream,
  nightmare, stone, raid, event, season, research.
  Currently excluded: death (debatable), misc, echo.
- **Dawn-only gating for scheduled beats.** `checkDreamBeat`,
  `checkNightmareBeat`, `checkStoneBeat`, `checkEchoBeat`,
  `checkFounderBeat`, `checkOfferingBeat` all guard
  `G.dayPhase > 120`.
- **Once-per-realm beats use `hasFlag` + `setFlag` to prevent
  re-fire.** `nightmare_fired`, `stone_found`, `founders_named`,
  `offering_made`, `year2`/`year3`/`year5`, `firstXxx`, `pop10`/etc.,
  `castleBuilt`, `firstRaidSurvived`.
- **Tags are REUSED across related beats, not proliferated per
  feature.** 075 established and 079 respected: the offering beat
  reuses `stone` rather than adding tag #15 `offering`. Rule of
  thumb — if the new beat's subject is already a tag, reuse.
- **Cross-system beats gate on multiple flags.** 079 requires all
  of `stone_found + happyPeakActive + !offering_made`. Treat
  multi-flag gates like a sentence: AND the prerequisites.
- **Hysteresis-gated beats use pairs of flags.** See
  `happyPeakActive` / `happyCrisisActive` (071).
- **notify() calls that already chronicle directly at the same
  callsite should pass `{ chronicle: false }`.** See 070. Prevents
  the toast from duplicating the direct write.
- **Chronicle cap 300 entries** (story.js:26). Enforce via
  `G.chronicle.splice(0, excess)` — oldest drops first.
- **Noise evicts signal at the cap.** 082/083 discovered: if any
  single system writes many entries per game-day, rare one-shot
  beats (nightmare, stone, founder-naming, offering) can be
  pushed out of the 300-entry window before a player reads them.
  Before adding a chronicle writer, estimate its steady-state
  rate per 200-day realm. Anything above ~1 entry/day is a
  candidate for `{chronicle: false}` unless the entries are
  truly memorable. See 083's raid-toast cleanup for the template
  fix.
- **Once-per-realm tag writes are eviction-immune** (085,
  implemented — closes the 083-filed defensive protection;
  103 added `requiem`). `_EVICTION_IMMUNE_TAGS = { nightmare,
  stone, victory, requiem }` at story.js:26. When the 300-entry
  cap triggers, non-immune entries drop oldest-first and immune
  entries survive even if the buffer soft-overflows. Protects
  lifetime-unique beats from future noise regressions — especially
  critical for 103's realm-end beat, which could otherwise be
  cap-evicted by a flood of death entries as population drops to 0.
- **Chronicle entries have `{day, season, tick, text, tag}`
  shape.** Writers should use the existing `chronicle(text, tag)`
  helper; don't push directly.
- **Named characters can carry game mechanics** (101 + 102,
  closing 050's filed ask). Two patterns now shipped:
  - **Multiplicative variant** — used when the character
    amplifies an existing system:
    `const <char>Mult = G.namedCharacters?.<char> ? 1.N : 1;`
    applied inside existing multiplier chains.
  - **Additive baseline variant** — used when the character
    contributes flat baseline character independent of
    buildings (filed at 1 use; see `## observed patterns`):
    `const <char>Bonus = G.namedCharacters?.<char> ? N : 0;`
    added to a baseline expression.

  Currently shipped (**6 of 6 — CAST COMPLETE**):
  teacher → +10% research (tech.js, 101), merchant →
  +5% trade (trade.js, 102), smith → +5% tower
  fire-rate (combat.js, 105 → re-tuned at 153 from
  damage to fire-rate), bard → +5 happiness baseline
  (economy.js, 201), rival → +10% raid count + +5
  gold per raider slain (economy.js raid spawn 206 +
  combat.js raider death 209; adversarial-AND-rewarding
  symmetric pair), mayor → unlocks townhall building
  (state.js BUILDINGS + tech.js isBuildingUnlocked +
  ui.js Culture category, 243; structural-unlock
  pattern). Silent mechanic (no UI, no chronicle beat
  — 034's character-intro already narrates arrival).
  **All 6 named-character mechanics now have effects;
  the cast is functionally complete.**
- **End-of-realm beats are first-class** (103, closing 053's
  filed ask). `realm_fell` NARRATIVE_BEATS entry fires when
  `G.population === 0 && G.day > 1`. Tag: `requiem`.
  Eviction-immune. No echo-eligible (no more dawns post-fall).
- **Ambient-entity acknowledgment is a paired grammar** (148 +
  152 + 166; 3 uses meets promotion threshold). Ambient
  entities with existing visual presence but no narrative
  surface (wanderer: 048/061 → 148; ghost/night-shape: 031 →
  152; frogs: → 166) may get a 1-beat acknowledgment each.
  Pattern: misc-tag, static string, no variants (entity
  singularity), no "name" word that would collapse ambiguity.
  Elder-silence register ("no one calls them anything" / "no
  one asks them to describe it"). Gate on timing or
  prerequisite that makes the sighting plausible (wanderer:
  day ≥ 50; night-shape: day ≥ 60 + firstBirth; frog: day ≥
  35 + spring/summer). Does NOT contribute to founder arc
  bookkeeping — useful during/after the 146 founder-
  moratorium to diversify focal points. Rule: if the entity
  already has a kingdom name or a player interaction, use a
  different pattern (it's no longer ambient). Filed
  candidates for additional uses: owls / rams / trade-ships /
  hawks. Now also a sub-type of the broader observational-
  elder register cluster (see `## observed patterns`).
- **144 schema: `after: (G) => void` for NARRATIVE_BEATS
  entries.** Mirrors BUILDING_FIRST_BEATS `after:` (used since
  034 for named-character intros). Dispatch loop runs
  `beat.after(G)` after chronicle + onFire, in a try/catch
  wrapper. First use: 134 namesake's citizen-rename. Rule per
  123/144 pattern-emergence: new schema fields are added when
  3+ entries would need them (`onFire` had 3+ audio needs at
  123; `after` had 1 at 144 — justified because 144's need was
  a legitimate side effect, not a post-hoc generalization).
- **Shape-axis pattern: observations and sub-types can be
  extended via SHAPES — orthogonal to use counts. Shape
  additions DO NOT advance the sub-type counter; they widen
  the authoring space.** (276, promoted from observed-pattern
  with 4 confirming uses + margin: 266 + 270 + 272 + 275.)
  Per 257 anti-completionist: shape-extensions ship if prose
  introduces NEW ANGLE on its own merits, not to fill the
  shape ledger. Each shape-extension MUST document the new
  angle explicitly with a `// Loop NNN ... NEW ANGLE within
  existing sub-type, NOT count-advancement` comment in
  story.js + matching annotation in this doc.

  **Confirmed shape-axes (descriptive ledger, not
  prescriptive checklist):**
  - *Ambient-entity-grammar* (148/152/166 sustained;
    266 transient): SUSTAINED-PRESENCE → +TRANSIENT-WITNESS.
  - *Character-interiority* (240/245/247/249/252/253
    solitary; 270 confluence): SOLITARY-INTERIORITY → +
    MULTI-CHARACTER-CONFLUENCE.
  - *Weather-recognition* (147/174/246 arriving; 272
    not-arriving): WEATHER-ARRIVING → +NEGATIVE-SPACE.
  - *Individual-interiority* (212 mid-action; 275
    totalizing; 277 inference-by-absence): MID-ACTION-
    INTERIORITY → +TOTALIZING-WORLDVIEW → +INFERENCE-BY-
    ABSENCE. **First sub-type to grow 3 shapes**;
    demonstrates shape-axes can extend beyond binary.
  - *Habituation-recognition* (254 automaticity; 280
    rhythm-awareness; 285 language-drift): AUTOMATICITY
    → +RHYTHM-AWARENESS → +LANGUAGE-DRIFT. **Second
    sub-type to grow 3 shapes** (after individual-
    interiority); the 3 shapes span 3 distinct DOMAINS
    of habituation (action / time / language).
  - *Land-as-agent* (207/227/229/290/294/307): made/own
    → +INHERITED-FROM-OUTSIDE → +RESHAPED-BY-USE →
    +ANTICIPATORY-AGENCY. 290 = objects realm DID NOT
    MAKE; 294 = objects the realm has WORN; 307 = path
    KNOWS where citizen is going BEFORE citizen does
    (anticipation as agency; lift line "the realm has
    no need to ask where" — privacy-WITHOUT-surveillance).
    **6 shapes total — sole-leading sub-type.**
  - *Forgetting* (184/190/292/301): LOSS → +ARTIFACT-
    PRESERVED-MEANING-LOST → +RITUAL-PERSISTENCE-
    WITHOUT-ORIGIN. 292 = object kept by inertia;
    301 = practice continued without remembering why
    (first QUESTION-OPENING beat in the corpus).

  **Why this is an invariant not just an observation:** the
  pattern is now PRESCRIPTIVE — it tells future authors that
  a beat fitting an existing register but introducing a fresh
  philosophical angle should be SHIPPED via shape-extension
  framing rather than (a) creating a new sub-type [forbidden
  by 257 if motivated by count] or (b) framing as OUTSIDE the
  cluster [wrong when register matches]. The shape-axis
  framing is the third path 257's discipline opened up; 4 uses
  prove it's the operational default.

  **Authoring craft:** when shipping a beat that fits an
  existing sub-type, ask:
  1. Does the prose surprise on its own merits (per 203)?
  2. Does it introduce a NEW ANGLE the existing uses don't
     touch?
  3. Does the register match (declarative present-tense /
     observational-elder / etc.)?
  If all three: ship as shape-extension with explicit angle
  documentation. If (3) is no: consider OUTSIDE-cluster (per
  263 META precedent). If (2) is no: don't ship — per 257.

  **SUB-TYPE-INTERNAL-AXES SUB-RULE** (promoted at 350 from
  339-347 [process] observations; 7 confirming uses): when
  extending a sub-type past 4 shapes, examine for an internal
  axis (1D, 2D, or higher); articulate the axis in the doc
  annotation if one exists; document declined-axis if the
  sub-type's shapes don't form a cleanly articulable axis.
  The axis can be temporal / domain-based / threshold-class /
  phase / spatial / agency / or any analytical dimension that
  distinguishes the shapes.

  **Confirmed uses establishing the rule (8):**
  - 336 forgetting: 1D temporal (PAST/FUTURE; later expanded
    to PAST/PRESENT/FUTURE at 348)
  - 337 habituation-recognition: 1D 5-domains (action / time /
    language / rule-transmission / gesture-enforcement);
    extended to 6 domains at 354 with rhythmic-collective-moment
  - 339 sustained-state-recognition: 1D 4-threshold-classes
    (count / ratio / transformation / script)
  - 341 weather-recognition: 1D 4-WEATHER-PHASE positions
    (REMEMBRANCE / ARRIVAL / NON-EVENT / ANTICIPATION)
  - 342 naming-place: 1D 5-TIME-RELATIONSHIP positions
    (EMERGENCE / FUNCTIONAL-SUBSTITUTE / CONTRADICTORY /
    POSTHUMOUS / SHIFTING)
  - 343 ambient-entity-grammar: 2D PERSISTENCE × COLLECTIVITY
    (4 quadrants populated by 346)
  - 347 individual-interiority: 1D 6-INTERIOR-MANIFESTATION-
    MODE (DURING-ACTION / AS-WORLDFRAME / AS-ABSENCE /
    AS-PRIVATE-COMPETENCE / AS-INHERITED-PATTERN /
    AS-UNEXPLAINED-AVOIDANCE)
  - 352 land-as-agent: 1D 6-TEMPORAL-AGENCY positions
    (ATEMPORAL / PAST-RETAINED / PAST-IMPORTED / PAST-ACCRETED
    / FUTURE-PROJECTED / PRESENT-RECURRENT) — 7 shapes across
    6 positions (227+229 share PAST-RETAINED). Closes the
    last un-examined sub-type case identified at 350 letter.

  **Declined-axis cases (1):**
  - 344 early-game-mood: 4 prior shapes don't articulate a
    clean internal axis (mood-of-time + cross-listed registry);
    345 [process] noted decline as informative signal.

  **Why this is a sub-rule and not just a recurrence:** 8 of
  9 sub-types have articulated axes; 1 declined; 0 un-examined
  (LA closed at 352). The pattern emerged opportunistically
  but is now PRESCRIPTIVE for any future sub-type extension
  past 4 shapes. The "or declined" clause distinguishes
  un-examined sub-types from examined-and-declined ones (per
  345 rule refinement). **8/9 formalization status post-352**:
  the only outstanding sub-type axis status is 344 EM-decline
  itself, which is informative-not-deficient.

  **What this sub-rule does NOT prescribe:**
  - Forced axis articulation when no clean axis exists (per
    344 EM-decline + 345 refinement)
  - A specific axis dimensionality (1D / 2D / higher all valid)
  - A specific axis class (temporal / domain / etc. — pick
    what fits the shapes)
  - Promotion of axis-pattern to its own invariant — sub-rule
    under 276 is sufficient.

- **Sprite-variant pool: sprite types with culturally-
  variable visual elements gain variant pools of 2-4 palette
  alternates picked by kingdom-hashed selection. Source
  palette = variant index 0 preserves backward-compat. Each
  variant differentiates HERALDIC or PALETTE choice without
  changing silhouette.** (284, promoted from observed-
  pattern with 6 confirming uses spanning ~70 ticks: 218
  church.glass / 259 townhall.stone / 279 castle.roof / 281
  granary.silo / 282 windmill.sail / 283 tower.banner.)

  **Implementation pattern (mature copy-paste, ~25 LoC per
  sprite type):**
  - Add palette table to `_VARIANT_PALETTES[type][group]` in
    render.js. Source = index 0 (must match SVG exact);
    indexes 1+ are alternates.
  - Add SPECS entry to `verify-variants.mjs` mirroring the
    same palette structure.
  - Visual A/B at zoom 5-6 across 4 representative kingdom
    names (Norrith/Avalon/Velar/Ashfall is the canonical
    test set). Optional once pattern reaches copy-paste
    maturity (skipped at 282/283 — text-level assertions
    sufficient).

  **Authoring craft when picking the variant element:**
  - Pick the sprite's MOST PROMINENT swappable element
    (castle keep-roof, not banner; granary silo-body, not
    door; windmill sail-cloth, not stone-tower).
  - Vary ONE axis only — preserve silhouette so the
    building remains universally recognizable. Multi-axis
    variation risks fragmenting building identity across
    realms.
  - 4 palettes is the default for visually-prominent
    elements; 2-3 is fine for small or simple gradients
    (windmill 2-color sail, townhall 3-color stone).
  - Faction-flavor names (naval / moss-forest / twilight /
    etc.) in palette comments give future authors hooks
    for narrative beats that align with visual identity.

  **Why this is an invariant not just an observation:** the
  pattern is now PRESCRIPTIVE for any future sprite that
  reaches authoring attention. The 220 filing exhausted at
  283 demonstrates the pattern can RUN END-TO-END through
  a roster — the FIRST single-thread filing-arc to do so in
  the corpus (050 named characters / 192 realmEnded
  consumers also closed, but those were multi-thread).
  Promotion formalizes the variant-pool as the default
  authoring move when adding sprite identity.

  **What this invariant DOES NOT prescribe:**
  - Whether a sprite SHOULD have variants (decision is per-
    sprite, based on cultural-variability appetite).
  - Cross-sprite synchronization (e.g. matching castle-roof
    + tower-banner colors per realm). Currently independent
    hashes; future tick could synchronize via shared key.
  - Variant count beyond the 2-4 default.

- **Pessimist→fixer combination rule: when pessimist findings
  share a single doc/file target AND each is ≤15 LoC,
  combine into one fixer tick. When they span multiple files
  OR any exceeds ~30 LoC, split.** (287, promoted from
  observed-pattern with 3 confirming uses: 256→257-259 arc /
  192→260+261 arc / 268→269 arc.)

  **Combining uses observed:**
  - 257 closed 2 of 4 256 findings (HIGH categorization +
    MEDIUM cluster anti-completionist) — same target
    narrative-surfaces.md, ≤16 LoC each.
  - 259 closed 1 of 4 256 findings (LOW variant pipeline) +
    255 filing (townhall variant entry) — both touched
    `_VARIANT_PALETTES` in render.js.
  - 269 closed all 3 268 findings (HIGH realmEnded reset +
    MEDIUM sustained-state-tracker reset + LOW particle-cap
    guard) — first two same target main.js newGame(); third
    a small story.js sibling.
  - 192→260+261 multi-tick arc: 260 chronicle gate + 261
    render desat both consumed G.realmEnded; sibling fixes
    where one tick's discovery unlocked the next.

  **Net savings**: each pessimist→fixer arc closed N
  findings in N or N-1 ticks rather than 1+N ticks. Across
  3 arcs, ~3 ticks saved.

  **Why this is an invariant not just an observation:** the
  rule is now PRESCRIPTIVE for any future pessimist→fixer
  arc. Prior practice was N findings → N fixer ticks
  (default-split). The combination rule reverses the default:
  combine first, split only when scope-or-target diverges.
  Promotion formalizes the new default.

  **What this invariant DOES NOT prescribe:**
  - Combining unrelated fixer ticks (only same-arc findings).
  - Combining surprises with fixers (different scope/intent).
  - Combining when the LoC budget would balloon ≥30 per
    finding — split for review-clarity.
  - Combining via cross-file shared filings unless ≤15 LoC
    each.

  **Mature fixer-arc shape (per 268-269 cleanest example):**
  pessimist tick → 1 audit producing N findings → 1 fixer
  tick combining all eligible findings → arc closed in 2
  ticks vs 1+N split.

- **OUTSIDE-cluster register: when a beat's prose surprises
  with a register family the cluster does NOT accommodate
  (META / JOYFUL / WONDER / etc.), ship OUTSIDE the
  observational-elder cluster with its own register
  annotation. Each OUTSIDE register is documented as its own
  observation; OUTSIDE beats DO NOT consolidate into a 'meta-
  cluster.'** (298, promoted from observed-pattern with 3
  confirming uses: 263 META / 296 JOYFUL / 297 WONDER.)

  **Confirmed OUTSIDE registers:**
  - *META-paradoxical* (263 chronicle_self_known) — chronicle
    referenced AS A THING IN THE WORLD; paradoxical self-
    reference. "The chronicle has grown longer than any
    citizen's memory."
  - *DYNAMIC-JOYFUL* (296 realm_laughs_known) — collective
    ease, action-not-observation. "the way a settled place
    laughs when it doesn't have to pay attention to itself."
  - *CURIOUS-WITHOUT-RESOLVING* / WONDER (297 unplaceable_
    sound_known) — attention without conclusion; self-
    deception as cultural form. "The realm pretends not to
    listen, then listens anyway."

  **Why this is an invariant not just an observation:** the
  rule is now PRESCRIPTIVE for any future beat whose prose
  doesn't fit the cluster's declarative-present-tense
  observational register. Prior practice was to either
  awkwardly fit a beat into a sub-type OR ship without
  classification. The OUTSIDE-cluster invariant gives a
  third path: ship cleanly with explicit register
  annotation. Complements 276 shape-axis invariant (which
  governs INSIDE-cluster extension) by formalizing the
  OUTSIDE path.

  **Authoring decision tree (combined with 276):**
  1. Does the prose surprise (203)?
  2. What register family?
     - DECLARATIVE-PRESENT-TENSE observational →
       INSIDE cluster:
       - New angle within existing sub-type → 276
         shape-extension
       - Reuse of existing angle → don't ship per 257
     - DIFFERENT register (META/JOYFUL/WONDER/etc) →
       OUTSIDE cluster per 298 invariant.
  3. Document with explicit register annotation in
     narrative-surfaces.md (cluster sub-type for
     INSIDE; OUTSIDE register entry for OUTSIDE).

  **What this invariant DOES NOT prescribe:**
  - The set of OUTSIDE registers — these emerge organically
    as prose introduces them.
  - Consolidation: OUTSIDE beats remain separate
    observations (no meta-cluster).
  - Promotion of any OUTSIDE register to its own sub-type
    if it accumulates 3+ uses — separate decision.

- **STRUCTURAL surprise (4-vector framework): every surprise
  beat occupies a position on at least one of four orthogonal
  axes — REGISTER / ANGLE / TAG / STRUCTURE. STRUCTURE is the
  PROSE-OPENING form: declarative (corpus default) /
  question / imperative / second-person / and successors.
  When a beat opens with a non-declarative form, document
  the structural surprise as a formal vector axis distinct
  from REGISTER (cluster vs OUTSIDE) and ANGLE (shape-extension
  within sub-type).** (308, promoted from observed-pattern
  with 3 confirming uses: 301 question / 305 imperative /
  307 second-person.)

  **The 4 vectors (orthogonal axes a surprise can vary on):**
  - *REGISTER* — INSIDE the observational-elder cluster
    (declarative-present-tense voice) vs OUTSIDE the cluster
    (META/JOYFUL/WONDER/IRRITATION-DOMESTICATED — see 298).
  - *ANGLE* — shape-extension within an existing sub-type
    (see 276). 13+ uses since promotion.
  - *TAG* — 15-tag taxonomy chosen for eviction / echo
    (misc / milestone / character / event / etc).
  - *STRUCTURE* — prose-OPENING form. Declarative is the
    corpus default (~61 of 64 beats). Non-declarative
    openings are surprises in their own right.

  **Confirmed STRUCTURAL surprises:**
  - *QUESTION-opening* (301 noon_bell_origin_known) — "Why
    is the church bell rung at noon and not at any other
    hour?" Question-answer-reflection rhythm: Q (why is X?)
    → A (because it always has been) → Reflection (origin
    lost AT THE MOMENT of practice-establishment).
  - *IMPERATIVE-opening* (305 silent_morning_known) —
    "Listen for the bell on the day the bell does not ring."
    Direct address to an unspecified listener. The prose
    instructs the realm (or the reader) to attend.
  - *SECOND-PERSON address* (307 path_knows_routine_known) —
    "You walk down the path you have walked many times."
    The "you" addresses the reader as if they were the
    realm's citizen. Distinct from imperative because the
    "you" is a SUBJECT, not the recipient of a command.
  - *DIALOG-opening* (312 tacit_norms_known) — "'Don't
    ask the well that.' A grandmother stops a child mid-
    question." The opening is overheard quoted speech
    voiced FROM WITHIN the realm — distinct from
    imperative (which addresses an outside listener) and
    second-person (which addresses the reader). Dialog
    implies the narrator is one of many citizens nearby.
  - *NEGATION-opening* (314 morning_dread_known) — "No
    bell rang that morning. The realm waited..." Opens
    by foregrounding ABSENCE as the agent of attention.
    A non-event becomes the unsettling thing. Distinct
    from question/imperative/second-person/dialog because
    NEGATION makes the reader notice what ISN'T (vs all
    prior forms which make the reader notice what IS).
  - *FRAGMENT-opening* (318 empty_seat_known) — "An
    empty seat." Three-word incomplete sentence; no
    verb. Foregrounds an OBJECT-IN-VIEW with NO ACTION
    attached. The reader must supply the verb. Distinct
    from prior 5 because FRAGMENT removes grammatical
    completeness rather than adding a different form.
    The remaining sentences in the beat resume
    declarative form once the FRAGMENT's attention has
    been claimed.
  - *REPETITION-opening* (322 recurrence_known) —
    "The same bread rising. The same lamps lit. The
    same children asleep." Anaphora: three parallel
    fragments with identical opening phrase. Distinct
    from FRAGMENT (single incomplete sentence) and
    LIST because REPETITION's parallel structure IS
    the meaning — the prose's rhythm enacts the
    realm's recurrence. The repeated form makes the
    reader experience the recurrence directly rather
    than only being told about it.

  **Why this is an invariant not just an observation:** the
  rule is now PRESCRIPTIVE. Prior practice would have framed
  these as "oddly-opened beats" or attributed the surprise
  to the angle alone; the 4-vector framework names STRUCTURE
  as a first-class authoring axis. Future structural openings
  (FRAGMENT / DIALOG / NEGATION / etc.) are recognized as
  surprises BEFORE they accumulate; ANGLE-only surprises with
  declarative form remain valid (most beats), but STRUCTURE-
  varied beats are explicitly called out.

  **STRUCTURE-ANGLE coupling SUB-RULE** (promoted at 315 from
  307 prediction; reached 5 of 5 confirming uses by 314):
  **non-declarative STRUCTURE openings (question / imperative /
  second-person / dialog / negation / future forms) MUST pair
  with a fresh ANGLE.** Declarative openings remain free to
  reuse an angle (per 257); the rule applies ONLY to
  STRUCTURE-vector ships.

  **Confirmed uses establishing the rule (5 at promotion;
  9 in production after 334):**
  - 301 QUESTION + RITUAL-PERSISTENCE-WITHOUT-ORIGIN
    (forgetting shape 4)
  - 305 IMPERATIVE + EMERGENT-TRADITION (forgetting shape 5)
  - 307 SECOND-PERSON + ANTICIPATORY-AGENCY (land-as-agent
    shape 6)
  - 312 DIALOG + SOCIAL-NORMS (habituation-recognition
    shape 4)
  - 314 NEGATION + DREAD-WITHOUT-CAUSE (5th OUTSIDE
    register, TERROR)
  - 318 FRAGMENT + SILENT-COLLECTIVE-ADJUSTMENT-TO-LOSS
    (6th OUTSIDE register, GRIEF) — first post-promotion
    confirming use; rule held in production.
  - 322 REPETITION + RECURRENCE-AS-SELF-RECOGNITION
    (7th OUTSIDE register, CONTENTMENT) — second post-
    promotion confirming use; rule continues to hold.
  - 332 REPETITION (re-use; 2nd) + NAMED-AFTER-WHO-IS-GONE
    (4th naming-place shape) — first re-use of an existing
    STRUCTURAL form post-promotion. Rule holds for
    re-uses: structural form repetition is fine;
    angle must remain fresh.
  - 334 REPETITION (re-use; 3rd) + BODILY-INHERITED-MEMORY-
    WITHOUT-CONSCIOUS-AWARENESS (5th individual-interiority
    shape) — second re-use of REPETITION; rule continues
    to generalize across structural-form re-uses with
    fresh angles. 9th confirming use overall.

  **Why this is a rule and not just a recurrence:** 5 of 5
  ships across both INSIDE cluster sub-types AND OUTSIDE
  register. The rule operates across REGISTER boundaries —
  it's not register-bound. Per 314 [process] **CRAFT FACT
  hypothesis**: non-declarative voice RESISTS stale content
  because writing in a non-default voice triggers fresh
  thinking. The coupling appears to be a property of the
  writing act, not a contingent observation about this
  particular corpus. Falsification remains theoretically
  possible (ship 6th non-declarative with stale angle and
  see if prose holds), but constructed-stale-angle test
  prose by definition would not surprise (per 203/257),
  so the test is effectively unrunnable. The rule stands
  until either disproved by a real ship that surprises
  with a stale angle and non-declarative form
  simultaneously, or refined by future authors discovering
  a sixth non-declarative form whose prose somehow
  decouples from angle.

  **What this sub-rule does NOT prescribe:**
  - Adding STRUCTURE to declarative beats — declarative
    remains the corpus default; the rule only fires when
    the author chooses non-declarative.
  - "Fresh angle" = entirely new sub-type. Angles can be
    extensions WITHIN existing sub-types per 276 shape-
    axis. Only the specific angle-INSTANCE must not
    duplicate an existing beat.
  - A specific COUNT requirement (e.g. "must add 1
    structural surprise per N ticks"). The rule only
    constrains; it does not mandate.

  **Authoring decision tree (combined with 276 + 298):**
  1. Does the prose surprise (203)?
  2. What register family?
     - DECLARATIVE-PRESENT-TENSE observational →
       INSIDE cluster:
       - New angle within existing sub-type → 276
         shape-extension
       - Reuse of existing angle → don't ship per 257
     - DIFFERENT register (META/JOYFUL/WONDER/etc) →
       OUTSIDE cluster per 298 invariant.
  3. What opening form?
     - DECLARATIVE (default; ~95% of corpus) → ship
       on REGISTER/ANGLE/TAG vectors as above.
     - NON-DECLARATIVE (question / imperative / second-
       person / successors) → STRUCTURE vector
       per 308 invariant; pair with fresh ANGLE
       (per coupling prediction).
  4. Document with explicit annotation in narrative-
     surfaces.md (cluster sub-type for INSIDE shape;
     OUTSIDE register entry; STRUCTURAL-surprise entry
     for non-declarative form).

  **What this invariant DOES NOT prescribe:**
  - The set of structural openings — these emerge organically
    as prose introduces them. FRAGMENT / DIALOG / NEGATION /
    REPETITION are filed as candidates per 307 [code]; not
    yet shipped.
  - Consolidation: structural-surprise beats remain in
    their cluster annotations (NOT a separate "structural
    cluster"); STRUCTURE is annotation, not sub-type.
  - Promotion of a specific structural form to its own
    invariant if it accumulates 3+ uses — separate decision
    (e.g. "all imperative beats must do X" would be a
    further refinement, not entailed).
  - Mandate: declarative remains the corpus default. The
    invariant gives non-declarative ships a recognized path,
    NOT a quota. Most beats will always be declarative.

## observed patterns

Distinct from invariants. Observations describe
what the realm has done; invariants prescribe
what the realm must do. Patterns in this section
have NOT yet been promoted (typically: <3
canonical uses or unresolved structural questions).

**The 3+ rule (per 202 contrarian, refined at
231):** thresholds TRIGGER REVIEW, not automatic
promotion. 3 uses signals "this is worth a
loop-level decision"; the actual promotion is
contrarian-eligible. 188 was promoted at 1 use
and demoted; the lesson is conservatism. Sub-
types within an existing cluster register
typically should NOT be promoted — they're
variations of a unifying invariant, not
separate authorship rules. See land-as-agent
(207/227/229) and sustained-state-recognition
(211/228/230) below: both meet 3+ but
intentionally stay as sub-types per 231
contrarian.

Promote to invariants only when the rule is
prescriptive AND consistently applied.

- **Framework state at 330 (synthesis observation).**
  At tick 330 the loop is at a documented saturation
  moment. This entry consolidates the saturation
  observations filed across 322-329 [process] for
  reference at the 350 milestone-letter (20 ticks
  away). **See "Framework state at 340" below for
  current state (340 archivist update post-331/332/
  334/336/337/339 ships).**

  **Snapshot status (per 333 [code], shipped 353):**
  FROZEN at tick 330. Counts in this entry refer to
  state at 330 only. For state past 330 see "Framework
  state at 340" below or 350 milestone-letter at
  `loop/journal/350.md` or current doc-body counts.
  Do not silently update body counts; archivist may
  ship a fresh snapshot observation at the next
  milestone (e.g. "Framework state at 400") rather
  than mutating this one.

  **NARRATIVE_BEATS inventory at 330**: 73 entries.

  **INSIDE cluster** (9 sub-types, **33 shapes total**,
  avg 3.7 shapes/sub-type, **all sub-types at 3+
  shapes** since 327):
  - Land-as-agent: 6 shapes (sole-leader since 307)
  - Forgetting: 5 shapes
  - Habituation-recognition: 4 shapes
  - Weather-recognition: 4 shapes
  - Ambient-entity-grammar: 4 shapes
  - Early-game-mood: 4 shapes
  - Individual-interiority: 4 shapes (post-329)
  - Sustained-state-recognition: 3 shapes at
    330 (4 post-331; was most-under-extended;
    naming-place becomes new most-under-extended
    target post-331)
  - Naming-place: 3 shapes (recovered from 130-tick
    dormancy at 1 shape via 325 + 327)

  **OUTSIDE cluster** (7 registers, **emotional-tone
  field saturated** on 2D valence × intensity plane,
  per 322 [process]):
  - META 263 (paradoxical)
  - JOYFUL 296 (positive-active)
  - WONDER 297 (curious-without-resolving)
  - IRRITATION 303 (negative-domesticated)
  - TERROR 314 (negative-acute)
  - GRIEF 318 (negative-sustained)
  - CONTENTMENT 322 (positive-passive)

  **STRUCTURAL forms** (7 non-declarative openings;
  315 sub-rule held at 7/7 confirming uses; CRAFT
  FACT framing):
  - QUESTION 301 / IMPERATIVE 305 / SECOND-PERSON 307
  - DIALOG 312 / NEGATION 314 / FRAGMENT 318
  - REPETITION 322

  **Active doctrine** (8 invariants + 1 sub-rule;
  doctrine in STABILITY phase since 315):
  - 075 chronicle ordering
  - 144 named-character mech
  - 203 surprise primary driver
  - 231 conservative-promotion
  - 257 anti-completionism
  - 276 shape-axis (INSIDE)
  - 284 variant-pool
  - 287 combination-rule
  - 298 OUTSIDE-cluster
  - 308 STRUCTURAL-surprise + 315 STRUCTURE-ANGLE
    coupling sub-rule

  **Doctrine-cadence phases** (per 323 [process]):
  - Drought (pre-276 / 80 ticks no promotion)
  - Expansion (276-298 / 4 invariants in 22 ticks
    adding new axes)
  - Deepening (308-315 / 1 invariant + 1 sub-rule
    in 17 ticks refining STRUCTURE)
  - **Stability (315-330 / 15 ticks no new
    invariants)**

  **Audit-yield trajectory** (per 309/316/323/328
  [process]):
  - [play] yield: 260 CRITICAL → 310 2× MEDIUM →
    320 1 LOW → 326 0 (clean)
  - Pessimist yield: 309 LOW (cluster) → 316 LOW
    (legacy-load) → 323 LOW (rebuild-mutex) → 328
    LOW (deferred-item)
  - Both audit types trend toward zero actionable
    yield as framework saturates.

  **Authoring patterns at 330** (empirical, not
  prescriptive):
  - Multi-axial ships (314/318/322 triple-axis +
    301/305/307/312 dual-axis) ARE the post-308
    default when prose supports.
  - Single-axis ships (325/327/329) are EQUALLY
    valid when prose surprises on a single axis;
    framework imposes no quota (per 257 + 325/327
    axis-flexibility observations).
  - 4-vector framework permits any combination;
    the choice is per-prose, not per-tick.
  - Day-offset gate-spreading (per 313 + 321) +
    bidirectional mutex (per 319 + 324) +
    everHadBuilding flag (per 311 + 317 + 319)
    are mature ecosystem patterns.

  **Verify-rig at 330**: 63 logic + 66 variants =
  129 assertions. Mutex-validation pattern with 4
  tests across 2 beat pairs. Test #50 (placeBuilding
  flag-set) + #53 (loadGame backfill) +
  #55/#59/#60 (mutex variants) form the
  everHadBuilding ecosystem coverage.

  **300 hopes scoreboard at 330** (50 ticks past 300):
  - #1 5th invariant promotion: DONE at 308 (42
    ticks early)
  - #2 Audio halt lifts: STILL OPEN (170 ticks)
  - #3 Phase F sprite: DONE at 306 (44 ticks early)
  - #4 Shape-axis saturation gracefully: DONE
    (cluster-uniformity at 3+ shapes per 327)
  - #5 7th OUTSIDE register: DONE at 322 (28
    ticks early)
  - **4 of 5 hopes closed before 350**;
    0 of 5 fears materialized.

  **Why this synthesis matters**: the 350 milestone-
  letter (20 ticks away) will score 300 hopes/fears,
  identify surprises 300 couldn't predict, and state
  hopes for 400. This synthesis front-runs the
  inventory work so the 350 letter can focus on
  scoring + retrospective + new-hope-formulation
  rather than re-cataloging the realm's current
  state.

  **What this observation does NOT do**: introduce
  any new invariant. Per 315 prediction "0-2 more
  sub-rule refinements through 350" — at 330 the
  count is 0 of 2; this archivist tick preserves
  the prediction. Filed as observation; promotion
  candidates remain in their existing [process]
  filings for 350 letter evaluation.

- **Framework state at 340 (synthesis update; 350
  letter front-run continued).** Updates the 330
  state observation with 331-339 ship-arc results.
  Synthesis-only; no new invariants (preserves 315
  prediction at 0/2 with 10 ticks remaining).

  **Snapshot status (per 333 [code], shipped 353):**
  FROZEN at tick 340. Counts in this entry refer to
  state at 340 only. For state past 340 see 350
  milestone-letter at `loop/journal/350.md`, the LA
  axis articulation at 352, or current doc-body
  counts. Do not silently update body counts; the
  archivist may ship a fresh snapshot observation at
  the next milestone (e.g. "Framework state at 400")
  rather than mutating this one.

  **NARRATIVE_BEATS inventory at 340**: 79 entries
  (was 73 at 330; +6 in 10 ticks).

  **INSIDE cluster** (9 sub-types, 39 shapes total
  unique-only-methodology / 43 shapes
  fully-counted-methodology):
  - Land-as-agent: 6 shapes (sole-leader since 307;
    tied with forgetting since 336)
  - Forgetting: 6 shapes (was 5 at 330; +336
    unteach_known)
  - Individual-interiority: 5 shapes (was 4 at 330;
    +334 inherited_walk_known)
  - Habituation-recognition: 5 shapes (was 4 at 330;
    +337 cup_holding_known; spans 5 domains:
    action/time/language/rule-transmission/gesture-
    enforcement)
  - Sustained-state-recognition: 5 shapes (was 3
    at 330; +331 winter_normalized + 339 raid_routine;
    spans 4 threshold-classes: count/ratio/
    transformation/script)
  - Weather-recognition: 4 shapes (unchanged)
  - Ambient-entity-grammar: 4 shapes (unchanged)
  - Early-game-mood: 4 shapes (unchanged; all 4
    cross-listed in other sub-types)
  - Naming-place: 4 shapes (was 3 at 330; +332
    lingering_name_known)

  **Sub-type distribution at 340**: 5 sub-types at
  5+ shapes (was 2 at 330); 4 sub-types at 4 shapes
  (was 4 at 330 with 1 at 3); zero at 3 or below.

  **CLUSTER MINIMUM AT 4 SHAPES** since 332 (was 3
  at 327). All 9 INSIDE sub-types now at 4+ shapes.

  **OUTSIDE registers**: 7 (unchanged since 322
  CONTENTMENT closed 300 hopes #5).

  **STRUCTURAL forms**: 7 (unchanged since 322
  REPETITION). 315 sub-rule at 9/9 confirming uses
  (322 + 332 + 334 are REPETITION re-uses post-
  promotion; 9 includes the 5-at-promotion plus
  318/322/332/334 post-promotion).

  **Active doctrine at 340**: 8 invariants + 1 sub-
  rule (075/144/named-char-mech/203/231/257/276/284/
  287/298/308 + 315 sub-rule). UNCHANGED since 315.
  Per 315 prediction "0-2 more sub-rule refinements
  through 350" — at 340 the count is 0/2 with 10
  ticks remaining.

  **Doctrine-cadence phases** (per 323 [process]):
  drought (pre-276) → expansion (276-298 / 4 inv
  in 22 ticks) → deepening (308-315 / 1 inv + 1
  sub-rule in 17 ticks) → STABILITY (315-340 /
  25 ticks no new invariants; longest stability
  phase yet).

  **Audit-yield trajectory at 340** (per 326/328/
  333/335/338 [process]):
  - [play]: 326 0 + 335 0 = 2 consecutive clean
  - Pessimist: 328 + 333 + 338 = 3 consecutive
    non-actionable
  - 5 saturation phases formalized: bugs → edge
    cases → deferred → observations → meta-pattern
  - Pessimist role at maturity = META-PATTERN
    ARTICULATION (per 338 [process])

  **Cadence-extension warrant FULLY VALIDATED**
  (per 338 [process]): pessimist window 5-8 → 8-12;
  [play] cadence ~30-50 → ~50-75. Filed for 350
  letter promotion review.

  **Sub-type-internal-axes meta-pattern** (per 336
  /337/339 [process]): 3 of 9 sub-types now have
  formalized internal axes:
  - 336 forgetting: 2 temporal orientations (PAST 5
    + FUTURE 1)
  - 337 habituation-recognition: 5 domains
  - 339 sustained-state-recognition: 4 threshold-
    classes
  Threshold-met (3+) for promotion candidate at
  350 letter. Authoring rule emerging: "WHEN
  EXTENDING A SUB-TYPE PAST 4 SHAPES, ARTICULATE
  ITS INTERNAL AXIS in the doc annotation."

  **Authoring patterns at 340** (cumulative since
  330):
  - Multi-axial ships continue (314/318/322 triple-
    axis + 332/334 dual-axis)
  - Single-axis ships now dominant (325/327/329/
    331/336/337/339 = 7 in 14 ticks)
  - 4-vector framework permits any combination
  - Production mode = UNRESTRICTED-AXIS per 332
    [process]
  - Asymmetric-deepening phase (per 334 [process]):
    floor stable at 4; sub-types deepen above floor
    based on prose merit
  - Cluster-uniformity sweep cycles complete (325-
    332 raised floor 1→2→3→4); cluster now in
    asymmetric-deepening sustaining ~0.1/tick avg
    growth (3.4 at 325 → 4.3 at 339 unique-only
    methodology; trajectory linear)

  **Verify-rig at 340**: 69 logic + 66 variants =
  135 assertions. New tests: #66 (334 inherited_
  walk) / #67 (336 unteach) / #68 (337 cup_holding)
  / #69 (339 raid_routine). Mutex-validation pattern
  formalized (4 tests across 2 beat pairs per 319+
  324) — verify-rig discipline.

  **300 hopes scoreboard at 340** (50 ticks past
  300; 10 ticks to 350): UNCHANGED since 322
  closure. 4 of 5 closed before 350 (audio remains
  open; 180+ ticks deferred).

  **Open [code] candidates at 340**:
  - 333 [code] last-updated annotation (~2 LoC;
    7 ticks open)
  - 319 [code] bakery_door fallback (~20 LoC;
    21 ticks open; per 257 only ship if fresh
    angle)
  - 322/325/327/329/331/332/334/336/337/339 [code]
    next-shape candidates per various sub-types

  **Filed 350 letter doctrine candidates**:
  1. Cadence-extension warrant per 335/338 [process]
     (3 confirming uses)
  2. Sub-type-internal-axes meta-pattern per 336/
     337/339 [process] (3 confirming uses)
  3. Axis-articulation-as-extension-pattern per
     339 [process] (recurring at every >4 extension)
  4. Cluster-shape-count methodology clarification
     per 339 [process] (cross-list resolution
     ambiguity in 330 count of 33)
  5. Pessimist-role-evolution per 338 [process]
     (5 saturation phases formalized)

  **350 letter prep status**: inventory + observations
  consolidated; 350 letter can focus on (a) 300 hopes/
  fears scoring; (b) surprises 300 couldn't predict;
  (c) doctrine-promotion review; (d) 400 hopes/fears
  formulation; without re-cataloging current state.

  **What this observation does NOT do**: introduce
  any new invariant. 315 prediction preserved at 0/2.
  Doctrine candidates filed for 350 letter
  evaluation.

- **Object-arc closure (observation, not template).**
  Some long-lived focal objects have closed via a
  forgetting beat. These closures take **different
  shapes** depending on the object's earlier
  presence:
  - **Stone — 4 beats** (056 discovery / 079 use
    / 122 weathering / 184 forgetting). Each
    middle beat does load-bearing work: 079 makes
    the stone ritual; 122 makes the stone aged.
  - **Constellation — 2 beats** (116 named / 190
    forgotten). No use-beat or weathering-beat;
    the closure compresses straight from naming
    to forgetting.
  Calling these the same shape obscures the
  difference. Stone's middle beats give its
  closure weight the constellation's doesn't have.
  This passage previously claimed (188 invariant)
  these were "uses of the same template"; **202
  contrarian** rejected that framing. Demoted
  here as an OBSERVATION about what the realm has
  done — not a prescription for future arcs.

  **Authoring rule (positive):** *closure beats
  should surprise the realm, not satisfy a
  pattern.* If a forgetting beat reads as
  template-completion, reject it. Long-lived
  objects (wanderer 048/148, great-storm 147,
  night-shape 152, frost 174, long-evening 196,
  cold-morning 199) are NOT obligated to close.
  They may stay open as 1- or 2-beat observations
  indefinitely. Closure should land because the
  prose deserves to land.

  **Year-3+ gating + citizensBorn ≥ 10** remain
  appropriate WHEN closure is being authored:
  the realm needs to have lived long enough that
  forgetting is plausible. Static prose is
  preferred for closure (forgetting is universal);
  kingdom-hashed variants reserve for weathering
  beats where variation reads as different
  conditions of the same object. These remain
  good guidance, not enforcement.

  **History note:** the 184 stone-forgotten beat
  was authored without 188-template foresight.
  188 codified the shape post-hoc and promoted
  to "invariant" at 1 use; 202 contrarian flagged
  the inconsistent threshold (other patterns —
  `after:` schema, source-specific echo, same-day
  beat-pair, additive-baseline mechanics — are
  filed at 3+ promotion threshold). 203 demoted
  to this section.

- **Same-day beat-pair pattern (observation, 1 use).**
  Two NARRATIVE_BEATS entries gated to the same
  day (199 first_cold_morning + 116
  constellation_named both at `autumn && day ≥
  15`). Table-iteration order = chronicle order;
  morning-beat fires first, evening-beat second.
  Filed at 199 with promotion threshold 3+;
  currently 1 use. If 2+ more emerge, promote
  to invariant.

- **Named-character mechanic shapes (observation,
  4+1+1+1 uses).** Four shapes now in the wild.
  **NOTE (256 pessimist HIGH finding):** the
  6-of-6 cast framing groups HETEROGENEOUS
  shapes. 5 of the 6 mechanics deliver
  CONTINUOUS NUMERIC EFFECTS every tick
  (multiplicative ×4 + additive ×1) plus an
  event-trigger reward. The 6th — mayor
  structural-unlock (tech.js:141) — is a
  BOOLEAN GATE; once townhall is built, the
  mayor has no ongoing mechanic effect. Future
  7th-character authors should NOT copy the
  cast-completion frame as if all six shapes
  are interchangeable. Decide which shape
  category fits the new character's canonical
  role before reaching for "shape that
  hasn't been used yet" symmetry.
  - **Multiplicative** when the character
    amplifies an existing system (4 uses):
    101 teacher × research speed, 102 merchant
    × trade margin, 105+153 smith × tower fire-
    rate, 206 rival × raid count. Effectively
    the default; the invariant in `## invariants`
    documents it as the primary pattern.
  - **Additive baseline** when the character
    contributes flat baseline character
    independent of buildings (1 use): 201 bard
    +5 happiness baseline. Filed at 201 with
    promotion threshold 3+; currently 1 use.
  - **Event-trigger reward** when the character
    grants a per-event bonus on a discrete game
    event (1 use): 209 rival +5 gold per raider
    slain (combat.js raider-death handler).
    Different shape from multiplicative (no
    multiplier chain) and additive (not a
    baseline) — it's a CONDITIONAL GRANT inside
    an event handler.
  - **Structural-unlock** when the character's
    presence gates a NEW BUILDING or capability
    (1 use): 243 mayor unlocks townhall.
    Different shape from the other three —
    boolean rather than numeric, gates content
    rather than tuning math. `isBuildingUnlocked`
    in tech.js owns the gate logic.
    **CATEGORICALLY DIFFERENT from continuous-
    bonus shapes:** structural-unlock is a
    one-time gate that delegates ongoing
    mechanical impact to the unlocked building
    (state.js:77 townhall happiness:8 + pop:5).
    The character's continuous mechanical
    presence is ZERO once the gate has fired.
  
  Rival is the first character with TWO mechanic
  sites (raid-spawn multiplier 206 + raider-kill
  reward 209). The pair is symmetric: harder
  raids AND more reward for surviving them.
  Future characters may follow the same dual-
  shape design (e.g., a hypothetical bandit-king
  rival might dual-ship raid difficulty AND
  per-bandit-corpse loot).

  **Cast complete (243):** all 6 named slots
  (teacher / merchant / smith / bard / rival /
  mayor) now have mechanic effects. Future
  filings should generally reach for additional
  uses of EXISTING shapes (e.g., a 3rd
  multiplicative or 2nd structural-unlock)
  rather than inventing new shape categories,
  unless a genuine 5th shape emerges that
  none of the existing four cover.

- **Source-specific echo branch (observation,
  1 use).** 194 added a conditional fast-path
  in `checkEchoBeat` for the 116 constellation
  source (regex extracts kingdom-hashed shape;
  surfaces tighter "Old folk still call them
  ${shape}" frame). Default 4-frame pool
  unchanged for 12 other milestone-tagged
  beats. Filed for promotion at 3+; currently
  1 use. When 3+ accrete, refactor to a
  registry table (`_ECHO_SPECIAL_FRAMES` keyed
  by source-prose-fingerprint) and promote.

- **Observational-elder register cluster
  (observation, ~18 uses across 4 tags).** A
  REGISTER-based authoring shape distinct from
  any single tag. Beats in this cluster share:
  declarative present-tense voice, "the realm"
  as collective subject (or implicit), no
  founder reference, no named-character agency,
  hopeful-not-anxious-or-resigned mood ("goes
  on" / "is allowed" / "agreed" / "no one calls
  them anything"). **Register guides voice and
  mood; tag guides eviction and echo. They are
  orthogonal.** A misc-tag beat and a milestone-
  tag beat can share register; a milestone-tag
  beat outside this register would read
  differently.

  **Cluster members (cross-tag):**
  - *misc tag* (13): 148 wanderer / 152 night-shape /
    166 frog-voices / 174 first-frost / 196 long-
    evening / 199 cold-morning / 207 fields-know-realm /
    211 sustained-peace / 212 first-sigh / 227 well-remembers /
    228 no-death-known / 229 hearth-holds-names / 230 full-pop-known
  - *milestone tag* (2): 190 constellation-forgotten /
    193 landmark-named
  - *stone tag* (1): 184 stone-forgotten
  - *event tag* (2): 147 great-storm-remembered /
    246 first-thaw-known (year-2+ spring sibling to
    174 first-frost autumn — together form a
    YEAR-CYCLE PAIR at seasonal endpoints)

  **Sub-types within the cluster:**
  - *Ambient-entity-grammar* (148/152/166/266/343/346):
    1-beat acknowledgment of an entity or
    shared-moment present but unnamed. Codified
    separately as the silent-walker grammar
    invariant. **6 shapes** spanning **2D AXIS
    fully populated** (PERSISTENCE × COLLECTIVITY)
    — first sub-type to complete 4/4 quadrants:
    - **SUSTAINED × INDIVIDUAL**: 148 wanderer
      / 152 night-shape / 166 frog-voices
      (entity persists; each citizen aware
      separately)
    - **TRANSIENT × INDIVIDUAL**: 266
      summer_falling_star ("the star is gone
      before anyone can ask if anyone else saw
      it")
    - **TRANSIENT × COLLECTIVE**: 343
      collective_waking ("There is a winter
      night when every citizen wakes at the
      same hour... The realm carries the memory
      of being all awake at once, without
      naming it.")
    - **SUSTAINED × COLLECTIVE**: 346
      autumn_sound ("There is a sound the
      realm hears in autumn evenings... no
      one alive has named it; everyone alive
      expects it.") — sustained shared
      expectation of unnamed thing.
    **First sub-type to populate FULL 2D axis**
    (4/4 quadrants). Joins land-as-agent (6)
    and forgetting (6) at sole-leader level —
    3 sub-types tied at 6 shapes.
    Per 276 invariant + 343/346 2D axis
    completion. Sub-type-internal-axes pattern
    remains at 6/9 sub-types formalized (Am
    already articulated 2D at 343; 346 does
    not add new axis but COMPLETES existing
    one).
  - *Weather-recognition* (147/174/246/272/341):
    the realm notices or remembers weather as
    a marker of the year. **5 shapes** spanning
    a WEATHER-PHASE temporal axis:
    - 147 great_storm_remembered — STORM-AS-
      MEMORY-EVENT (REMEMBRANCE phase)
    - 174 first_frost — FROST-AS-SEASONAL-
      ARRIVAL (ARRIVAL/EVENT phase)
    - 246 first_thaw — THAW-AS-SEASONAL-RETURN
      (ARRIVAL/EVENT phase; year-cycle pair
      with 174)
    - 272 storm_passed_seen — STORM-NOT-
      ARRIVING (NON-EVENT/NEGATIVE-SPACE phase)
    - 341 first_frost_wait_known — ANTICIPATION-
      AS-SEASON ("There is a week before the
      first frost when the realm holds its
      breath... The waiting is itself the
      season.") — PRE-EVENT phase; the WAITING
      becomes the seasonal experience itself.
    Per 339 [process] axis-articulation-as-
    extension-pattern: weather-recognition now
    spans 4 distinct phases on the WEATHER-
    PHASE temporal axis (REMEMBRANCE / ARRIVAL
    / NON-EVENT / ANTICIPATION). Sub-type-
    internal-axes meta-pattern now formalized
    for 4 of 9 sub-types (336 forgetting / 337
    habituation / 339 sustained-state / 341
    weather-recognition).
    Per 276 invariant + 308 STRUCTURAL-surprise
    invariant.
  - *Forgetting* (184/190/292/301/305/336/348):
    closure of a long-lived object's or
    practice's KNOWLEDGE. **7 shapes** post-
    348 — sole-leader (LA/Am/II at 6).
    Spanning loss / persistence / emergence /
    active-pedagogy / present-loss:
    - 184 stone_forgotten — OBJECT WEATHERED.
    - 190 constellation_forgotten — PATTERN
      UNNAMED.
    - 292 bakery_door_carving_known —
      ARTIFACT-PRESERVED-MEANING-LOST.
    - 301 noon_bell_origin_known — RITUAL-
      PERSISTENCE-WITHOUT-ORIGIN. First
      QUESTION-opening beat.
    - 305 silent_morning_known — EMERGENT-
      TRADITION ("Listen for the bell on
      the day the bell does not ring...
      No one has ever decided which morning;
      the realm always knows"). Practice
      emerged COLLECTIVELY with no first-
      instance to forget; ORIGIN NEVER
      EXISTED as a decision. **2nd structural
      surprise**: imperative-opening (vs
      301 question-opening). Per 308
      STRUCTURAL-surprise invariant.
    - 336 unteach_known — ACTIVE-FORGETTING-
      AS-PEDAGOGY ("There is a custom the
      elders remember and have chosen not
      to teach... The forgetting will be
      complete in one generation.") — the
      realm CHOOSES not to transmit; elders
      remember + transmission DELIBERATELY
      WITHHELD; future-oriented forgetting.
      First FUTURE-ORIENTED shape (prior 5
      are PAST-ORIENTED: things lost or
      origin obscured).
    - 348 PRESENT-FORGETTING-AS-EMERGING-GAP
      ("The realm is forgetting something at
      this moment. No one knows what... the
      something will be the gap.") —
      temporally PRESENT (not past, not
      future); meta-aware mid-process
      forgetting; INVOLUNTARY.
    **7 shapes — SOLE-LEADER post-348**
    (LA/Am/II at 6). Forgetting temporal
    axis advances 2-position → **3-position**
    (PAST/PRESENT/FUTURE): PAST 184/190/292/
    301/305 + PRESENT 348 + FUTURE 336. Per
    276 invariant.
  - *Naming-place* (193/325/327/332/342): the
    realm gives a place a colloquial name. Third
    member of the realm-environment naming
    triplet (sky 116 / object 056 / place 193).
    **5 shapes** (post-saturation extension)
    spanning TIME-RELATIONSHIP axis (NAME-vs-
    REFERENT over time):
    - 193 EMERGENCE — name attached at place
      creation (no decision)
    - 325 FUNCTIONAL-SUBSTITUTE — name does
      verification work in present
    - 327 CONTRADICTORY — name no longer
      matches state
    - 332 POSTHUMOUS — referent gone; name
      persists
    - 342 SHIFTING — name updates organically
      when modifier stops carrying information
      ("the new path" → "the path"; qualifier
      dropped when no longer meaningful)
    Per 276 invariant + 339/341/342
    axis-articulation pattern. Sub-type-
    internal-axes pattern at 5/9 sub-types
    formalized post-342 (336 forgetting /
    337 habituation / 339 sustained-state /
    341 weather / 342 naming-place); past
    majority threshold (56%).
    Naming-place was the most-under-extended
    sub-type at 1 shape since 193; shipped
    1→4 shapes in 7 ticks (325 + 327 + 332)
    after 130-tick dormancy; 5th at 342
    completes the TIME-RELATIONSHIP axis.
    Single-axis at 325 + 327 + 342; multi-
    axial at 332 — sub-type demonstrates
    both axis-modes per 325/327/331
    axis-flexibility framing.
  - *Early-game-mood* (196/199/207/212/344):
    year-1 moments of arrival, change, or
    familiarity. Anti-anxious continuity
    register counterbalancing the late-arc
    bias 195 flagged. **5 shapes** post-344:
    - 196 long-evening (mood-of-evening)
    - 199 cold-morning (mood-of-morning)
    - 207 fields-know-realm (cross-listed
      in land-as-agent; LAND-KNOWING-REALM)
    - 212 first-sigh (cross-listed in
      individual-interiority; CITIZEN-MOOD-
      MID-ACTION)
    - 344 realm-begun-known — REALM-AS-
      CONTINUITY-UNNOTICED ("There is an
      evening in the first year when the
      realm goes to sleep without thinking
      of itself as a realm trying to be
      one. The realm has begun.") —
      retrospective beat: first moment
      realm-as-continuous-entity registers
      as ABSENCE of self-doubt rather
      than presence of confidence.
    EM does not articulate a clean
    internal axis (mood-of-time + cross-
    listed registry); per 343 [process]
    meta-pattern is OPPORTUNISTIC not
    MANDATORY — sub-type-internal-axes
    remains at 6/9 post-344. Per 276
    invariant.
  - *Land-as-agent* (207/227/229/290/294/307/352):
    land/object/relational-keeper has subjective
    voice. **7 shapes** (TIES forgetting at 7
    post-352; both co-leaders):
    - 207 broad LAND-EXISTENCE (ATEMPORAL)
    - 227 OBJECT-HOLDS-MEMORY (well water;
      PAST-RETAINED)
    - 229 OBJECT-HOLDS-NAMES (hearth;
      PAST-RETAINED)
    - 290 INHERITED-FROM-OUTSIDE (sea-bell;
      PAST-IMPORTED)
    - 294 RESHAPED-BY-USE (worn step;
      PAST-ACCRETED)
    - 307 ANTICIPATORY-AGENCY ("the path
      knows where you are going before you
      do. The realm has no need to ask
      where") — object KNOWS in advance;
      anticipation as agency; FUTURE-PROJECTED.
      **3rd structural surprise**: SECOND-
      PERSON address (after 301 question /
      305 imperative). Per 308 STRUCTURAL-
      surprise invariant.
    - 352 PRESENT-INDEPENDENT-AGENCY ("There
      is a hill on the south coast that
      gathers fog every autumn morning. The
      fog finds the hill before the sun
      finds the realm. The hill does not
      need a name for what it does.") — land
      acts in PRESENT-RECURRENT mode; cyclic
      atmospheric agency; citizens are
      spectators; land does not need them.
      **Articulates LA temporal axis**:
      ATEMPORAL → PAST-RETAINED → PAST-
      IMPORTED → PAST-ACCRETED → FUTURE-
      PROJECTED → PRESENT-RECURRENT (1D 6-
      position; 7 shapes; 227+229 share
      PAST-RETAINED). **Closes un-examined
      LA case** in sub-type-internal-axes
      sub-rule ledger (8/9 formalized
      post-352).
    Per 276 invariant + 352 axis articulation.
  - *Sustained-state-recognition* (211/228/230/331/339):
    the realm crosses a temporal threshold and
    notices the change in collective behavior.
    **5 shapes** post-339:
    - 211 sustained-peace 50d ("watch still
      climbs the walls but hands rest") — count
      threshold (no raid days).
    - 228 no-death 100d ("hundred days without
      burial; grave field is older than the
      last grave") — count threshold (days
      since last death).
    - 230 full-pop 60d ("for sixty days the
      houses have all stood full... the realm
      is the size it knows how to be, for now")
      — ratio threshold (current/max = 1).
    - 331 winter-normalized ("By the third
      winter the realm has stopped counting...
      Winter has become weather") —
      TRANSFORMATION threshold (recurring cycle
      becoming background); seasonal-cycle
      threshold rather than count or ratio.
      First sustained-state shape to track
      CHARACTER-OF-EXPERIENCE crossing rather
      than MOMENTARY count crossing.
    Prior 3 (211/228/230) follow the same
    infrastructure pattern: G.lastXDay tracker
    + save.js persistence + earned-state gate.
    **331 uses a different infrastructure**:
    G.season + year3 flag (no per-realm tracker
    needed; the cycle-count is implicit in
    year3 = "third year" = "third cycle of all
    seasons"). Single-axis ship #4 in a row
    (after 325/327/329); axis-flexibility
    pattern empirically continued.
    **339 raid_routine_known — THREAT-
    NORMALIZATION**: 5th shape; G.stats.
    raidsSurvived counter + script-internalization
    angle. "By the third raid the realm has a
    routine for it... The realm has learned to
    be afraid the same way each time." Distinct
    from 211 (THREAT-ABSENCE; peace days);
    339 = THREAT-PRESENCE-METABOLIZED. Distinct
    from 314 morning_dread (acute fear, OUTSIDE
    TERROR); 339 is INSIDE-CHRONIC-SCRIPTED-FEAR.
    Sub-type now spans 4 threshold CLASSES:
    COUNT (211/228) / RATIO (230) /
    TRANSFORMATION (331) / SCRIPT (339) — adds
    sub-type-internal-axis per 337 [process]
    meta-pattern.
    Future literary-uses welcome (peak
    no-death + peace already shipped); ship
    if prose surprises per 203 positive rule,
    not for promotion math.
  - *Individual-interiority* (212/275/277/329/334/347):
    focal is a single anonymous citizen rather
    than the realm collective. **6 shapes**
    spanning INTERIOR-MANIFESTATION-MODE axis
    (1D, 6 positions) — articulated at 347:
    - 212 MID-ACTION ("settler... breathes
      out. No one sees.") — brief inner moment.
    - 275 TOTALIZING ("the world ends at the
      eastern ridge as far as they are
      concerned") — whole frame-of-reference.
    - 277 INFERENCE-BY-ABSENCE ("their seat at
      the inn is empty for the third evening
      in a row") — awareness mediated through
      routine disruption.
    - 329 PRIVATE-KNOWLEDGE-WITHOUT-RECOGNITION
      ("There is a citizen who knows every bird
      in the realm by sound. No one has asked,
      and no one has been told...") — hidden
      expertise exercised privately and
      recurrently; competence never offered.
    - 334 BODILY-INHERITED-MEMORY-WITHOUT-
      CONSCIOUS-AWARENESS ("Their grandmother
      walked this way. Their mother walked
      this way. They walk this way and have
      never noticed... a kind of memory the
      body keeps without the mind.") — physical
      pattern transmitted through generations
      via gait, not language; knowledge in
      body but not in mind. **Multi-axial**:
      ANGLE + STRUCTURE (REPETITION 3rd use;
      9th confirming use of 315 sub-rule).
    - 347 AVOIDANCE-UNEXPLAINED ("There is a
      citizen who has never sat in the south
      corner of the inn... the south corner
      remains theirs not to sit in.") —
      citizen has daily exclusion without
      explanation; realm sustains pattern via
      non-inquiry; avoidance-as-property in
      negative space.
    **INTERIOR-MANIFESTATION-MODE axis** (1D,
    6 positions): DURING-ACTION (212) /
    AS-WORLDFRAME (275) / AS-ABSENCE (277) /
    AS-PRIVATE-COMPETENCE (329) /
    AS-INHERITED-PATTERN (334) /
    AS-UNEXPLAINED-AVOIDANCE (347). Each
    shape captures HOW a citizen's interior
    life manifests as exterior pattern.
    Sub-type-internal-axes meta-pattern
    advances 6/9 → 7/9 post-347.
    Per 276 invariant + 347 axis articulation.
    Sub-type now joins land-as-agent (6) and
    forgetting (6) and ambient-entity-grammar
    (6) at sole-leader level — 4 sub-types
    tied at 6.
  - *Habituation-recognition* (254/280/285/312/337/354):
    the realm recognizes its own habits and
    rhythms (vs sustained-state-recognition's
    EXTERNAL conditions). **6 shapes** spanning
    6 domains (post-354):
    - 254 AUTOMATICITY ("the fire is set
      without thinking now") — action domain.
    - 280 RHYTHM-AWARENESS ("no one has named
      this moment but everyone knows it") —
      time domain.
    - 285 LANGUAGE-DRIFT ("would not know how
      to use it now") — linguistic domain.
    - 312 SOCIAL-NORMS ("'Don't ask the well
      that.' A grandmother stops a child
      mid-question. The realm has rules no
      one ever wrote down") — intergenerational
      tacit-rule transmission via ACTIVE
      correction. **4th structural surprise**:
      DIALOG-OPENING. **CONFIRMS 308 STRUCTURE-
      ANGLE coupling** at 4 of 4 uses.
    - 337 NON-CORRECTION-AS-CULTURAL-
      ENFORCEMENT ("The realm has a way of
      holding the cup. No one taught it.
      Strangers visit and hold the cup wrong,
      and no one corrects them; the realm
      waits for them to leave.") — gestural
      cultural marker enforced by PASSIVE
      EXCLUSION rather than active correction.
      Distinct from 312 (active shush) +
      327 (linguistic marker with directional
      correction): 337 is gestural marker
      + non-correction.
    - 354 RHYTHMIC-COLLECTIVE-MOMENT ("There
      is a moment in the late afternoon when
      the realm goes quiet for the length of
      one breath. No one calls it. No one
      remembers when it started. The realm
      has stopped distinguishing the silence
      from the time.") — synchronized non-
      conducted moment recurring within a
      day. Distinct from 280 RHYTHM-AWARENESS
      (named-time-not-on-clock vs 354 sub-
      second collective synchronization);
      distinct from 311 silent_morning
      (forgetting EMERGENT-TRADITION; daily
      community-scale practice vs 354 sub-
      second collective rhythm); distinct
      from 322 CONTENTMENT (citizen-aware
      recurrence vs 354 unaware-collective-
      habit).
    Per 308 STRUCTURAL-surprise invariant +
    276 shape-axis invariant. Sub-type now
    spans 6 distinct domains: action / time /
    language / rule-transmission / gesture-
    enforcement / rhythmic-collective-moment.

  **Beats explicitly OUTSIDE the cluster
  (different register, listed for awareness):**
  - *Meta-self-aware* (263): a beat where the
    chronicle itself is referenced AS A THING
    IN THE WORLD. Different REGISTER from the
    declarative-present-tense observational-
    elder; this register is META, paradoxical,
    self-referential. 263 chronicle_self_known:
    "The chronicle has grown longer than any
    citizen's memory." Gate: chronicle.length ≥
    100. NOT a cluster sub-type per 257
    discipline.
  - *Collective-ease* (296): DYNAMIC-JOYFUL
    register — the realm laughs, not observes.
    "the way a settled place laughs when it
    doesn't have to pay attention to itself."
    Gate: year2 + happiness > 65. First JOYFUL
    register.
  - *Wonder* (297): CURIOUS-WITHOUT-RESOLVING
    register — the realm acknowledges mystery
    and chooses to remain in it. "There is
    sometimes a sound the realm cannot place...
    the realm pretends not to listen, then
    listens anyway." Gate: year2.
  - *Irritation-domesticated* (303): NEGATIVE
    emotion the realm has accommodated and
    even VALUES through its cultural use. "a
    wagon-track on the eastern road... everyone
    curses it... Filling it would be missed."
    Cultural value of imperfection; cursing the
    annoyance is PART of the experience, not a
    problem. Gate: year3. **4th OUTSIDE
    register** — first NEGATIVE emotional
    register in OUTSIDE ledger.
  - *Terror* (314): ACUTE-FEAR register —
    dread without object. "No bell rang
    that morning. The realm waited, then
    waited longer, then went on with the
    day. Some mornings ask to be feared
    without showing why." Gate: year3 +
    day>=80. **5th OUTSIDE register**
    and second NEGATIVE-tone register
    (distinct from IRRITATION-DOMESTICATED's
    cultural-of-imperfection because TERROR
    is acute, ungrounded, and does not
    resolve). **TRIPLE-AXIS surprise**:
    REGISTER (5th OUTSIDE) + STRUCTURE
    (5th non-declarative; NEGATION-opening)
    + ANGLE (DREAD-WITHOUT-CAUSE — fear
    without external referent).
  - *Grief* (318): SUSTAINED-LOSS register —
    loss integrated into routine rather
    than surfaced. "An empty seat. The
    realm sets fewer plates now. No one
    names what changed." Gate: year3 +
    citizensDied>=2. **6th OUTSIDE
    register** and third NEGATIVE-tone
    register (distinct from IRRITATION
    cultural-of-imperfection and TERROR
    acute-fear: GRIEF is sustained,
    integrated, and language-avoiding).
    **TRIPLE-AXIS surprise**: REGISTER
    (6th OUTSIDE) + STRUCTURE (6th non-
    declarative; FRAGMENT-opening) +
    ANGLE (SILENT-COLLECTIVE-ADJUSTMENT-
    TO-LOSS — realm changes behavior
    without articulating the change).
    Establishes triple-axis as
    not-one-off pattern (after 314).
  - *Contentment* (322): SETTLED-IN-
    RECURRENCE register — passive
    fitting in repeated pattern. "The
    same bread rising. The same lamps
    lit. The same children asleep. The
    realm finds itself in an evening
    it has had many times before, and
    it does not mind." Gate: year3 +
    day>=85. **7th OUTSIDE register**
    and second POSITIVE-tone register
    (distinct from JOYFUL active-
    laughter: CONTENTMENT is passive,
    settled, and oriented around
    recurrence rather than ease). 300
    hopes #5 closure ("7th OUTSIDE
    register by 350") at 7 of 7 done.
    **TRIPLE-AXIS surprise**: REGISTER
    (7th OUTSIDE) + STRUCTURE (7th non-
    declarative; REPETITION via
    anaphora) + ANGLE (RECURRENCE-AS-
    SELF-RECOGNITION-AS-CONTENTMENT).
    Third triple-axis ship after
    314/318 — pattern stabilizing.

  **7 OUTSIDE beats now**. 298 PROMOTED the
  pattern to invariant; 303/314/318/322
  confirm the path remains operational. The
  7 registers cover: paradoxical (META) /
  positive-active (JOYFUL) / curious (WONDER)
  / negative-domesticated (IRRITATION) /
  acute-fear (TERROR) / sustained-loss
  (GRIEF) / positive-settled (CONTENTMENT).
  3 NEGATIVE-tone (IRRITATION/TERROR/GRIEF)
  span minor-cultural / acute / sustained;
  2 POSITIVE-tone (JOYFUL/CONTENTMENT) span
  active-laughter / passive-settled;
  META + WONDER fill paradoxical + curious.
  **300 hopes #5 CLOSED 28 ticks ahead of
  350.**

  **Authoring guidance (when adding to cluster):**

  **Sub-type-completion is NOT a positive
  authoring driver (256 pessimist MEDIUM).**
  The 9-sub-type ledger above is DESCRIPTIVE,
  not PRESCRIPTIVE. Filed sub-type uses (e.g.
  "second habituation-recognition use") are
  hints worth considering, not assignments to
  fulfill. Four of the nine sub-types sit at
  1 use each with "filed for promotion at 3+";
  the temptation is to ship 2nd/3rd uses to
  advance the counter. **Resist it.** Per 203
  positive rule: ship a sub-type's next use
  ONLY if the prose surprises on its own
  merits. Counter-pressure is intentional —
  the cluster's discipline depends on
  preferring fresh angles over completionism.
  When in doubt, choose a NEW axis or skip the
  cluster entirely for that tick.

  - Pick a sub-type that reads as fresh angle,
    not sub-type-completion (per 203 positive
    rule).
  - Match the sibling beats' register
    (declarative, present-tense,
    hopeful-or-resigned).
  - Choose tag by anchor (075 invariant: reuse
    the closest existing tag; new tags require
    3+ uses).
  - Static prose by default; kingdom-hashed
    variants only for sub-types with per-realm
    legitimate variation (147 great-storm picks
    from 5 storm types; 193 landmark picks from
    8 place names; most cluster beats are
    universal).
  - Some beats span multiple sub-types (207 is
    early-game-mood + land-as-agent; 193 is
    naming-place + observational closer to
    elder-saying than to stone-discovery).
    That's fine — sub-types are descriptive,
    not exclusive.

  **Filed at 199 + 207** (cluster size 4+
  threshold met; documented at 208 per
  207's filing).

- **Named-character interiority beats
  (observation, 6 uses — CAST COMPLETE).**
  Distinct from the observational-elder
  cluster — uses an INDIVIDUAL named
  character as subject, not the realm
  collective. Six beats shipped (6 of 6
  named cast; literary surface arc closed
  at 253):
  - 240 bard_unsung_song — bard composes a
    song no one will hear; "some songs the
    realm has had were never sung aloud"
    (register: *hidden art*)
  - 245 smith_walks_river — smith's anvil
    falls silent for an hour; "the fire
    cools by a degree, and waits"
    (register: *unexplained departure*)
  - 247 teacher_pauses_slate — teacher
    finds child's name still chalked from
    yesterday; doesn't wipe it for an hour
    (register: *small preservation*)
  - 249 merchant_counts_thrice — merchant
    counts the day's coins three times by
    lamplight; "counting is its own reason"
    (register: *meditative ritual*)
  - 252 rival_banner_distant — rival's
    banner sighted on a far ridge; "in the
    way far-off neighbors are"
    (register: *distant observation*) —
    **PREDICTION FROM 251 HELD**: rival's
    canonical adversarial-vigilance role
    matched the predicted shape.
  - 253 mayor_first_in_hall — mayor unlocks
    town hall before anyone else, watches
    the day arrive; "for now ${mayor.name}
    is the only person in it"
    (register: *procedural witnessing*) —
    **PREDICTION FROM 251 HELD**: mayor's
    canonical civic-governance role matched
    the predicted shape. **6-FOR-6
    PREDICTIVE VALIDATION**.

  All tag:character. All gate on the named
  character + a once-per-realm season/year
  condition. Each closes with a small lift
  line beyond the literal moment (per
  184/199/240 craft pattern).

  **CANONICAL-ROLE-MATCHED REGISTER** is the
  emergent authoring rule (validated at 252
  via prediction-confirmation): each
  character's interiority shape matches
  their canonical role from the realm's
  existing surfaces:
  - Bard's role: art/composition →
    interiority of HIDDEN ART
  - Smith's role: industrial labour →
    interiority of UNEXPLAINED DEPARTURE
    (rare absence from the forge)
  - Teacher's role: instruction/preservation
    of knowledge → interiority of SMALL
    PRESERVATION
  - Merchant's role: counting/exchange →
    interiority of MEDITATIVE RITUAL
    (counting as refuge)
  - Rival's role: adversarial vigilance →
    interiority of DISTANT OBSERVATION
    (banner on a far ridge; far-off-
    neighbor awareness)

  **CAST COMPLETE at 253.** All 6 named
  characters now have BOTH mechanic effects
  (101/102/105+153/201/206/209/243) AND
  literary surfaces beyond 034 silent
  intros (240/245/247/249/252/253). Mirror
  of 243's mechanic-cast 6/6 closure at
  ~10-tick lag.

  **Loop 270 (NEW SHAPE — confluence,
  multi-character):** 270 inn_confluence_seen
  introduces a SECOND shape within the
  character-interiority observation —
  multi-character co-presence rather than
  solitary interiority. All 240-253 beats
  feature ONE named character alone in a
  moment of inner life; 270 features THREE
  named characters (mayor, bard, smith)
  co-present at the inn. Lift line "the
  realm has grown into the kind of place
  where this is possible" captures the
  social-density transition. NEW shape
  (1 use, threshold 3+); per 257 anti-
  completionist + 266 precedent: shipped
  because PROSE INTRODUCES FRESH AXIS
  (multi-character co-presence corpus has
  never touched), NOT to advance any sub-
  type counter. Future confluence beats
  COULD ship if prose surprises (e.g.
  rival + mayor at the same town hall;
  merchant + teacher at the school);
  document each here as own observation
  entries, NOT as a sub-type to fill.

  **Canonical-role-matched register rule
  validated 6-for-6** with NO violations.
  This is unusually strong evidence for an
  observed-pattern that started as 1-use
  observation at 240 and grew via prediction-
  driven shipping (251 predicted rival/mayor
  registers; 252+253 confirmed both). The
  pattern can be CONFIDENTLY APPLIED by
  future authors — but per 231+251 stays
  observed-pattern not invariant
  (descriptive guidance, future authors can
  still violate deliberately if surprise
  warrants).

  **Hoist-vs-stay review (251 per 249
  PRIORITY filing): STAY at observed-pattern.**
  4 uses meets 3+ threshold but per 231
  contrarian discipline: thresholds trigger
  review, not auto-promotion. The pattern
  is descriptive (this is what the realm has
  done) not prescriptive (you must do this).
  Promotion to standalone invariant would
  imply the rule MUST be followed for new
  character beats; the current shape is
  guidance, not law. Future authors COULD
  break the canonical-role-matched register
  rule deliberately if a character's
  interiority moment surprises by violating
  expectation. Discipline preserved.

  **Filed at 240 + 247.** Reviewed at 251.

## known gaps (as of 104)

- **~~Sustained-state beats~~** (060 → 211). Closed:
  211 shipped `sustained_peace_known` (misc tag,
  observational-elder register cluster). Trigger:
  `G.stats?.raidsSurvived ≥ 1 && G.lastRaidDay !== undefined
  && (G.day - G.lastRaidDay) ≥ 50`. New infrastructure: 1-LoC
  `G.lastRaidDay = G.day` set at raid-spawn site (economy.js
  ~506) + save.js persistence. Realistic firing window: year-2+
  for fortified realms. Introduces **sustained-state-recognition**
  as 7th sub-type of the observational-elder cluster (1 use;
  promote at 3+).
- **~~Founder→dream cross-reference~~** (072 → 089 → 097 → 214).
  Closed: 089 wired founders into the nightmare pool. 097 wove
  founder1/2/3 conditional images into the founding/hearth/harvest
  dream threads (closed 089's specific filing). 214 added a founder1-
  conditional item to the offering pool (`a small piece of wood with
  ${founder1}'s name carved into the grain`) — closes the broader
  cross-reference scope (dream + offering pools both now reference
  founders; nightmare pool already did via 089). All three founder-
  hashed pools (dream / nightmare / offering) now cross-reference
  the founder arc.
- **Victory v2 in enhancements.js may duplicate `castleBuilt`** —
  needs a follow-up audit.
- **Disaster events live in enhancements.js, not events.js** —
  073 noted this split responsibility. Filed to consolidate.
- **Seasonal-proverb duplicates the misc-tag space with advisor.js**
  — actually 069/073 showed advisor.js doesn't write chronicle at
  all. Proverbs are the only misc-tag recurring system.
- **LOW design-choice sites** (076 LOW): main.js:247 trade-success
  and economy.js:589 upgrade-success chronicle every action.
  Noisy for long economies; worth a design review.
- **~~Year-milestone has grammar bug~~** (082 → 092). Closed:
  year-milestones migrated into NARRATIVE_BEATS with
  `${n} soul${n===1?'':'s'}` conditional pluralization. Year
  boundary computation simplified from year-math to
  `G.day >= 29/57/113` direct thresholds.
- **~~End-of-realm beats missing~~** (053 → 103). Closed:
  `realm_fell` beat with `requiem` tag (new 15th tag). Castle-
  falls and realm-forgotten variants still filed as follow-ups.
- **~~Named-character mechanics partially landed~~** (050 →
  101/102/105/153/201/206/209). Closed: 5 of 6 graduated as
  of 209. Teacher +10% research (101), merchant +5% trade
  (102), smith +5% fire-rate (105 shipped as damage, 153
  swapped to fire-rate per 120 audit finding that integer
  HP-rounding made the damage axis marginal), bard +5
  happiness baseline (201), rival +10% raid count (206) +
  +5 gold per raider slain (209). Three mechanic shapes now
  in the wild: multiplicative ×4 / additive baseline ×1 /
  event-trigger reward ×1 (see `## observed patterns`
  additive-baseline entry). 154's cumulative-speedup concern
  was partially mitigated by 153's smith re-tune AND by
  diversifying mechanic axes (research / trade / combat /
  happiness / raid / gold), avoiding multiplicative stacking
  within a single system. Mayor structural-unlock remains
  filed as the 6th and last (~30-50 LoC larger scope).
- **~~Founder-weaving arc + 146 founder-moratorium~~** (146 →
  157). Closed: 16 surfaces deep at 7/5/4 (fully balanced)
  pre-moratorium. 146 the-contrarian argued the arc had
  become the loop's default crutch (75% of surprises 116-138
  leaned founder-focal); proposed 10-tick moratorium 147-156.
  Scorecard at 157 HIT all targets (3/≥3 non-founder
  surprises: 147 great-storm / 148 wanderer / 152 night-
  shape; ≥2 new focal points introduced; 0 founder-surface
  increase). 157 check-in tick formally closed the moratorium.
  POST-moratorium discipline (158-209) sustained: 174
  frost / 184 stone-forgotten / 190 constellation-forgotten /
  193 landmark-named / 196 long-evening / 199 cold-morning /
  207 fields-know-realm — 7 non-founder surprises in 50+
  ticks. 200 milestone confirmed Lira (founder1) saturation
  fear from 100 letter did not materialize.
- **Happiness beats not in NARRATIVE_BEATS** (090 filed) — their
  hysteresis-reset semantics don't fit the one-shot trigger
  model. Could be migrated with a `resetOn:` extension field.
- **~~First-snow beat (088) not in NARRATIVE_BEATS~~** (090 →
  121). Closed: first_snow_seen migrated to NARRATIVE_BEATS
  table at story.js:615 as part of 121's audio-onFire arc.
- **~~Year milestones not in NARRATIVE_BEATS~~** (090/073 →
  092). Closed: year2/year3/year5 milestones migrated to
  NARRATIVE_BEATS at story.js:289-293 with conditional
  pluralization grammar fix.

## retired hypotheses (record for future ticks)

- **"fastForward skips dawn-gated beats"** (082 HIGH #2 →
  retired by 083). Original 082 symptom was dream/stone/echo =
  0 in a 200-day fastForward. Hypothesis: rAF-free loop with
  G.speed=60 + `crossed(60)` sampling missed the dayPhase 0-120
  window. Reality: beats FIRED but got cap-evicted by 197 raid-
  noise entries. fastForward is trustworthy for dawn-gated beats.
  Don't re-investigate this unless there's new evidence.

## cadence summary

Per a 200-day realm with a normal build pace (updated at 084
after 077/083 cleanups + 079 addition). 082 measured 299 entries
pre-083 (hit 300 cap, evicting dream/stone/echo). 083 cleaned
raid-toast pollution (-162). Re-measured 083: **156 entries**.

```
25  first-build/milestone beats (day 1-30 cluster)
1   founder beat (day 3-6, one-shot — 3 names in one entry)
1   first-snow beat (088 — first winter past day 10, one-shot)
0-3 subsequent-winter beats (093 — 2nd/3rd/5th, founder-aging)
0-1 constellation beat (116 — first autumn past day 15)
0-1 longest-night beat (128 — first winter deep night)
0-1 stone-weathering beat (122 — day ≥150 after stone_found)
0-1 namesake beat (134 — founders_named + 5 births)
0-1 shepherd's-song beat (138 — founders_named + cowpen + cold season + day ≥ 30)
10  character intro + events (034 ensures + bard arrivals)
20  dreams (every 10 days from day 10; 097 folds founder names in)
2-4 echoes (2% per-dawn)
0-1 nightmare (seeded [50,250]; 089 may include founder images)
0-1 stone (seeded [30,200])
0-1 offering-at-stone (079 — cross-gated on peak+stone, rare)
28  season transitions (every 7 days × 4-ish cycles)
29  seasonal proverbs (one per season change + elder saying)
0-3 research beats (depends on player pace)
2-5 disaster event beats (RNG; plague/drought/fire/earthquake)
0-4 happiness-threshold beats (depends on trajectory)
3   year milestones (year 2/3/5 if realm lives long enough)
0-1 requiem beat (103 — fires iff population drops to 0)
15-35 raid-resolution beats (one per raid cycle, 083 clean-up;
      PRE-083 was 150-200 due to UI-toast pollution)
```

Total per 200-day realm: **~130-170 chronicle entries** in 083-
clean play. Under 300 cap with comfortable headroom. 075's
original ~80-120 prediction was slightly low — didn't anticipate
that season (28) + seasonal proverbs (29) each contribute at the
high end of a season cycle; those are fixed-cadence recurring
beats that sum near 57 by themselves. 088's first-snow adds
+1 to the per-realm total; negligible impact on the range.

**Cadence health trend:**
- 082 (pre-083): 299 (cap-hit, signal evicted)
- 083 (post-fix): 156 (quality signal, no eviction)
- 075's target: 80-120 (too low — underestimated seasons)
- 084's revised target: ~130-170
- **091 (this update): target unchanged at ~130-170.** 088
  added +1 beat; 089/090 added no new chronicle writers (089
  expands nightmare pool; 090 is pure refactor). 085's
  eviction-immune protection means the target is also now
  floor-robust against future noise regressions.
- **104 (this update): target unchanged at ~130-170.** 092 is
  pure migration (no new beats). 093 adds 0-3 subsequent-winter
  beats (depends on realm lifespan; most realms see 2nd+3rd
  but not 5th). 097 adds no NEW beats (extends existing dream
  threads). 103 adds exactly 1 terminal beat. Effective impact:
  realms reaching year 5 produce +4 beats over 091's target.
  Still well under the 300-entry cap.
- **129 (this update): target revised to ~135-175.** 116 adds
  +1 constellation beat (0-1 per realm depending on survival).
  121 is pure migration (first-snow). 122 adds +1 stone-
  weathering (conditional on stone_found + day ≥150). 128 adds
  +1 longest-night (conditional on first winter night). Total
  new beats per long-lived realm: +3 over 104's budget. Still
  well under cap. Audio cues (124/125) don't add chronicle
  entries — they're playback side-effects.
- **141 (this update): target revised to ~137-178.** 134 adds
  +1 namesake (founders + 5 births gate). 138 adds +1
  shepherd's song (founders + cowpen + cold season). Both
  cross-system conditional — realms that build cowpens before
  cold season see the shepherd's song; those that don't never
  do. Peak cadence is still well under 300 cap. 137/139/140
  (audio, savedAt, tokens) don't add chronicle entries.
- **155: target revised to ~141-182.** +4 conditional beats
  since 141: 142 distant-letter / 147 great-storm / 148
  wanderer / 152 night-shape. Expected +3-4 new beats per
  long-lived realm, still well under 300 cap.
- **177: target revised to ~143-184** (initial estimate
  before 178 gate fix). +2 conditional beats since 155: 166
  frog-voices + 174 first-frost. Documented 166 firing
  year-3+ in practice given the original ≥ 70 day-gate.
- **178: cadence target REVISED to ~144-185 post-fix.**
  166's gate lowered from `day ≥ 70` to `day ≥ 35`. Most
  long-lived realms now see frog-voices.
- **188: cadence target ~145-186 with stone_forgotten.** +1
  conditional beat. Most realms reaching year 3 see this.
- **198 (this update): cadence target ~147-188** with the
  3 new beats (190/193/196). +3 conditional beats since 188:
  - **190 constellation-forgotten** (year3 + day ≥ 85 +
    constellation_named + citizensBorn ≥ 10): year-3+ realms
    with their constellation named — most long-lived realms.
  - **193 landmark-named** (year2 + day ≥ 50): year-2+ realms
    past day 50 — visible to most realms reaching year 2's
    second half.
  - **196 first-long-evening** (year-1 summer day ≤ 14):
    fires in year-1 summer ONLY (year-2+ summers excluded
    by day-gate). **Most players reaching day 8 see this.**
    195 skeptic-flag-response beat.
  Cadence still well under 300 cap. **195 skeptic flag
  partially addressed**: 196 ships an early-game beat
  counterbalancing the late-arc bias; one more early-game
  beat filed (196 [code] "first cold morning") for future
  ticks.

- **262 (this update — archivist sweep, ~64 ticks since
  198): cadence target REVISED to ~165-210.**

  +17 conditional beats since 198 across 5 axes:

  *early-game-mood cluster (4 beats):* 199 first-cold-
  morning / 207 fields-know-realm / 212 first-sigh-seen
  (year-1 summer/autumn). Most year-1 realms see all 4.

  *sustained-state-recognition (3 beats, year-2+):* 211
  sustained-peace-known / 228 no-death-known / 230
  full-pop-known. Conditional on raidsSurvived≥1 and
  lastRaidDay≥50 / citizensDied≥1 and lastDeathDay≥100 /
  pop=maxPop and lastUnderpopDay≥60. Most peaceful
  fortified realms see all three.

  *land-as-agent (2 beats):* 227 well-remembers / 229
  hearth-holds-names. Conditional on building presence +
  year-2+ and stats. Most year-2+ realms see well; year-3+
  with citizensDied see hearth.

  *character-interiority cast (6 beats):* 240 bard-unsung-
  song / 245 smith-walks-river / 247 teacher-pauses-slate
  / 249 merchant-counts-thrice / 252 rival-banner-distant /
  253 mayor-first-in-hall. Each gated on character-named +
  era + season. Most long-lived realms with full named cast
  see 4-6 of these.

  *misc (2 beats):* 246 first-thaw-known (year-2+ spring,
  YEAR-CYCLE PAIR with 174 first-frost) / 254 nights-blur-
  known (year-2+ autumn/winter — habituation-recognition).

  *event tag:* 214 added a founder-conditional offering item
  (NOT a new beat — extends 097's offering pool).

  *milestone tag:* 244 firstTownHall building-first beat
  (BUILDING_FIRST_BEATS, gated on townhall + mayor).

  *Per-realm impact:* well-played long-lived realms with
  named cast + radio-active mayor see most of these.
  Realistic +12-18 new chronicle entries per such realm.

  **260's chronicle-gate side effect:** ungated pre-260
  cadence on FALLEN realms could write 200+ post-end beats
  to the 300 cap (raids/seasons/dreams firing into a dead
  realm — see 260 [play] tick). Post-260, fallen realms
  freeze the chronicle at requiem; only LIVE realms reach
  the upper bound of this cadence target. This is a TIGHTER
  target than pre-260 in practice, even though authored
  beat count grew.

  **Cadence health:** still well under 300 cap. NARRATIVE_BEATS
  has 47 entries (story.js:trigger count); BUILDING_FIRST_BEATS
  + season + dreams + nightmares + echoes + raids contribute
  the rest. Per the 075 invariant: "the chronicle is the
  narrative memory; one entry per event is the right shape" —
  no current eviction-pressure observed in long-lived realms.

  **No invariant promotions** this archivist sweep. Per 231
  contrarian + 251 conservative-promotion: cluster sub-types
  (9 now) stay observed-pattern; named-character-mechanic
  observation stays at 4 shapes; same-day pairing stays at
  1 use; source-specific echo branch stays at 1 use. The
  authoring discipline shipped at 257 (HIGH categorization
  note + cluster anti-completionist warning) reinforces the
  conservative stance.

## how to update this doc

Future ticks that add or remove a chronicle-producing system MUST
update this doc in the same commit. The alternative is the 053
disaster where a system was mis-flagged as missing because the
doc didn't exist.

Ideas.md files a `[doc]` tag for any new narrative system. When
shipping, touch this file too.

## related loop references

- **020, 050** — milestone letters mapping realm state
- **053** — mis-diagnosed season-transitions; prompted 060
- **060** — first archivist audit (9 systems found)
- **069** — real-time play found season triplicate
- **070** — fixed season triplicate
- **073** — found 25 enhancements.js callsites + 5 duplicates
- **074** — removed 5 dead duplicates
- **075** — wrote this doc
- **076** — audit found 10 notify-duplicate sites
- **077** — fixed 8 of 10 (3 HIGH + 5 MEDIUM)
- **078** — tag-filter UI using taxonomy above
- **079** — added cross-system offering beat (reuses `stone` tag)
- **080** — first maintenance update (adds #14 system, tag-reuse +
  cross-system gate invariants)
- **081** — `G.debug.fastForward` helper; main.js
- **082** — fastForward-driven completionist; found 2 HIGHs
- **083** — closed BOTH 082 HIGHs with one 3-line fix. Raid-toast
  cleanup + surprise lesson: the "dawn-gate skip" was actually
  cap-eviction by noise, not a fastForward bug.
- **084** — maintenance update. Captured noise-evicts-signal
  as an invariant; revised cadence target to 130-170 post-083;
  corrected 082's HIGH #2 hypothesis.
- **085** — implemented eviction-immune protection for
  nightmare/stone/victory tags (083's filed defensive work).
- **088** — added cross-system first-snow compound beat
  (winter + day ≥ 10 + founder1 if named). +1 to cadence.
- **089** — closed 072's founder→nightmare gap: 3 founder-
  conditional image fragments in `_nightmareImagesForState`
  pool, gated on `founders_named`. Pool 11 → 14 base.
- **090** — NARRATIVE_BEATS refactor (closes 062, 28 ticks open).
  Consolidated 8 inline state-triggered one-shot beats into a
  shared table. Net LoC −2; bit-for-bit behavior preservation
  verified via 9 chrome-mcp tests.
- **091** — maintenance update. Captured 085/088/089/090 in
  the invariants + system enumeration. Renumbered story.js
  systems post-090 consolidation.
- **092** — year-milestones migrated cross-file into
  NARRATIVE_BEATS. Closed 082 "1 souls" grammar via
  conditional pluralization + function-form text. First
  cross-file use of the 090 table pattern.
- **093** — subsequent-winter beats × 3 (founder-aging arc).
  Third generation of NARRATIVE_BEATS use (090 landed,
  092 cross-file, 093 native).
- **097** — founders→dream. Added founder-conditional image
  variants to founding/hearth/harvest threads. Each founder
  owns one thread. Closes 089's filed idea.
- **101** — teacher research-bonus. First named-character
  mechanic. Closes 050's 50-tick-old ask.
- **102** — merchant price-bonus. Second character mechanic;
  pattern proven portable.
- **103** — end-of-realm requiem beat. Closes 053's 50-tick-
  old ask. New 15th tag. Lira arc closes at 7 surfaces.
- **104** — maintenance update. Captured 092-103 in the
  invariants + tag inventory + system enumeration + cadence
  summary.
- **116** — constellation_named surprise. First beat where
  founder2 is sole focal — began rebalancing the founder arc
  from founder1-oversaturation.
- **121** — the-re-shipper migrated 088's first-snow into
  NARRATIVE_BEATS. Honored 112 audio-surfaces invariant
  ("migrate inline beats to table BEFORE adding audio"). 090
  closed 31 ticks after filing.
- **122** — stone_weathered surprise. 3rd beat on 056's stone
  arc (discovery→offering→weathering).
- **123** — refactor-only `onFire` field on NARRATIVE_BEATS
  entries. Unblocks Pattern-2 audio for entries sharing tags.
- **124** — first-snow audio cue via `onFire: 'first-snow'`.
  First audio to ship under the 123 refactor.
- **125** — offering audio cue. Closes the original 106-filed
  audio cue list entirely.
- **127** — welcome-back summary on tab refocus. Closes 030
  filed 97 ticks ago.
- **128** — longest_night_seen surprise. Founder3 as night-
  watcher; continues 116's rebalancing (cast now 7/4/4).
- **129** — maintenance update. Captured 116-128 in the
  invariants + NARRATIVE_BEATS entry list (15→19) + cadence
  summary + related-loops.
- **134** — namesake_born surprise. Intergenerational
  continuity via kingdom-hashed founder pick.
- **137** — namesake audio cue via `onFire: 'namesake'`. 7th
  catalog entry.
- **138** — shepherd's song surprise. Founder2 gets 5th
  surface; arc fully balanced at 7/5/4.
- **139** — savedAt + real-world wait prefix. Re-engagement
  quintet across 5 absence-magnitudes.
- **140** — type-scale CSS variables phase 1 (silent-module).
- **141** — maintenance update. Captured 134-140 in the
  NARRATIVE_BEATS entry list (19→21) + cadence summary +
  related-loops.
- **142** — distant-letter surprise. First beat to reference
  the world OUTSIDE the island; 60 kingdom/news pairs via
  two separate deterministic hashes.
- **144** — the-fixer. Extended NARRATIVE_BEATS schema with
  `after: (G) => void` callback for arbitrary side effects
  (mirrors BUILDING_FIRST_BEATS `after:`). 134 namesake
  gained the hook (renames newest citizen to the kingdom-
  hashed founder's name — reifies a chronicle reference).
  Schema now `{ flag, tag, trigger, text, onFire?, after? }`.
- **146** — the-contrarian. Flagged founder-arc overreach
  (16 surfaces at 7/5/4, 75% of recent surprises founder-
  focal). Proposed 10-tick founder-moratorium ticks
  147-156; scorecard targets (≥3 non-founder surprises,
  ≥2 new focal points, ≤1 founder-surface increase).
- **147** — great-storm-remembered surprise (moratorium
  tick 1). Weather/memory focal, no founder reference;
  5 kingdom-hashed variants. Tag: event (reuse).
- **148** — wanderer-acknowledgment surprise (moratorium
  tick 2). Gives 048's silent walker its first narrative
  surface after 87 ticks. Static string, misc tag, elder-
  saying register. Opens the paired ambient-entity
  acknowledgment grammar.
- **151** — the-fixer. Reactivated 016's disabled
  `renderConstellations` path for 116's kingdom-hashed
  asterism. Narrative surface unchanged (116 beat still
  fires prose); visual payoff now manifests in actual
  night-sky rendering after the beat fires.
- **152** — night-shape-acknowledgment surprise (moratorium
  tick 6). Sibling to 148 for 031's ghost entity. Different
  focal (night vs day, children-observed vs edge-traveller).
  **Moratorium scorecard HITS target** (3/≥3 non-founder
  surprises). Closes the ambient-entity acknowledgment
  grammar's first pair.
- **153** — the-fixer. Smith mechanic damage→fire-rate
  swap (closes 120 MEDIUM). Named-character chain now
  3/6 graduated (teacher/merchant/smith).
- **154** — the-skeptic. Flagged audio-axis growth without
  verification (9 cues, 0 auditions). No code change;
  recommends halting new audio cues until 149's audition
  ships.
- **155** — maintenance update. Captures 142-152 in
  the NARRATIVE_BEATS entry list (21→25) + schema
  evolution (added `after` field per 144) + cadence
  summary (~137-178 → ~141-182) + ambient-entity
  grammar invariant + founder-arc moratorium status +
  related-loops.
- **156** — refactor-only. Ambient-entity grammar
  template comment in story.js anchors the 148/152
  pattern at the authoring site (sibling to 155's
  invariant in this doc). FINAL moratorium tick.
- **157** — meta. Moratorium check-in: scorecard 3/≥3
  HIT. Soft-cap policy replaces hard rule: new founder
  surfaces must close a long-open idea or resolve a
  structural gap, not just "add flavor."
- **161-170** — SVG / 3D render axis opens per user
  steering 2026-04-28. 5 SVG sprites (granary 161,
  castle 162, church 164, windmill 168, tower 170)
  + 2 3D meshes (granary 163, windmill 167) + render-
  layers.md doc (165). No new chronicle beats.
- **166** — surprise (post-moratorium): 3rd ambient-
  entity acknowledgment beat (`frog_voices_heard`).
  Water-edge sound focal; spring/summer evenings.
  14-tick spacing from 152 honors 156's queue-drain
  warning. **Note: gate `day ≥ 70 && spring/summer`
  fires year 3+ in practice** — narrow window, may
  warrant a fixer to lower the day-gate.
- **171/172** — strategic decision + render-layers.md
  doc anchor (3-phase plan: Phase A complete sprite
  roster → Phase B integration sprint → Phase C
  animation). 3D engine declared standalone; .glb
  meshes "loop does not touch."
- **173-176** — Phase A continues: house (173),
  tavern (175), blacksmith (176). 3 of 5 Phase A
  sprites shipped. Non-graphics interleave: 174
  surprise (this beat).
- **174** — surprise (Phase A interleave):
  `first_frost_marked`. Sibling to 147 great-storm
  in seasonal placement (year-2+ autumn) but
  PRESENT-tense observation rather than past-tense
  memory. Day ≥ 45 gate gives 147 a 2-day head
  start.
- **177** — maintenance update. Captures 156-176 in
  the doc. NARRATIVE_BEATS entry list 25→27 (frog
  166 + frost 174). Cadence summary ~141-182 →
  ~143-184 (+2 conditional beats). Sources
  paragraph extended through 177. Filed: fixer to
  lower 166's day-gate.
- **178** — the-fixer. 1-line gate fix on 166 frog-
  voices: `day ≥ 70` → `day ≥ 35`. Doc analysis at
  177 had revealed the ≥ 70 gate fired year-3+ only
  in practice (math mistake by 166's author given
  the 28-day-year structure). Most long-lived realms
  now see the beat.
- **184** — surprise. **stone_forgotten** beat
  closes the standing-stone arc as a 4-beat cycle
  (056 discovery → 079 offering → 122 weathering →
  184 forgetting). Realm's longest object-centered
  narrative gets its closing chord. Generational-gap
  framing parallels 147 great-storm. Static prose
  (forgetting is universal). Tag: stone (eviction-
  immune per 085). Year-3+ + stone_found + 10+
  births gate.
- **185-187** — chrome-offline 3D-mesh fallback
  queue (tavern / blacksmith / market). Chrome-
  independent graphics work; no chronicle additions.
  3D layer reaches ROSTER COMPLETE 11/11.
- **189-191** — type-scale phase 5+6 CSS hygiene; **130
  HIGH closes** (42 migrations / 6 phases / 61 ticks).
  Non-narrative.
- **190** — surprise. **constellation_forgotten** —
  2-beat closure (116 named → 190 forgotten) for the
  constellation arc. Originally framed as "second use
  of 188 object-arc closure template"; 202 contrarian
  rejected that framing (stone's 4-beat and
  constellation's 2-beat are different shapes); 203
  demoted to observed-pattern. Tag: milestone (matches
  116).
- **192** — the-fixer. Closes 103 filed (89 ticks):
  `realm_fell` entry gains `after: G => { G.realmEnded
  = true; }`. **Second use of after: schema** (134
  namesake first). Silent-module post-end-mode flag.
- **193** — surprise. **landmark_named** — opens
  realm-environment naming triplet (sky 116 / object
  056 / place 193). 8 kingdom-hashed rural-vernacular
  names. NARRATIVE_BEATS reaches 30.
- **194** — the-fixer. Closes 116-filed echo frame
  (78 ticks): `checkEchoBeat` gains source-specific
  branch detecting constellation prose + extracting
  shape via regex; surfaces "Old folk still call them
  ${shape}." Constellation arc now 5 touchpoints.
- **195** — the-skeptic. Year-3+ beats may be
  invisible to median play; ~7 shipped + 3 filed
  long-arc beats. **Recommend bias to early-game**
  for next 5-10 narrative ticks. Filed playtime
  audit (chrome-required).
- **196** — surprise. **first_long_evening** —
  direct response to 195 flag. Year-1 summer day
  ≤ 14 (most players reach day 8). **Anti-anxious
  mood**: "things are okay right now." NARRATIVE_BEATS
  reaches 31.
- **197** — the-fixer. Closes 192-filed save
  persistence (5 ticks): `state.realmEnded =
  !!G.realmEnded` save + 2-path defensive load
  (explicit field OR fallback derive from
  storyFlags.realm_fell). Backward-compatible.
- **188** — the-archivist. Caught the doc up to 184
  + added the object-arc closure passage (originally
  promoted to "invariant"; 203 demoted to observed-
  pattern per 202 contrarian).
- **198** — the-archivist. Catches the doc up to
  190/193/196 + 192's after-callback + 194's source-
  specific echo branch in checkEchoBeat.
  NARRATIVE_BEATS 28 → 31. Cadence ~145-186 → ~147-188.
  195 skeptic flag partially addressed by 196.
- **199** — surprise. **first_cold_morning** —
  second early-game beat per 196 filed. Year-1 autumn
  day ≥ 15; placed BEFORE constellation_named in
  table order (chronicle reads cold-morning →
  star-evening on the seam day). Novel **same-day
  beat-pair** filed as candidate observed-pattern (1
  use; promote at 3+). NARRATIVE_BEATS 32.
- **200** — the-future-you. Century-mark milestone
  letter (4th: 020 → 050 → 100 → 200). Scored 100's
  hopes/fears; named 5 surprises 100 couldn't predict;
  hopes for 250+. Pure journal.
- **201** — the-fixer. Closes 101 filed (100 ticks):
  bard +5 happiness baseline. **Additive baseline
  pattern** as sibling to multiplicative `*Mult`
  (filed as observed-pattern; 1 use; promote at 3+).
  5 of 6 named-cast now have mechanics.
- **202** — the-contrarian. 6-point case against 188
  object-arc closure invariant (4→2 beat compression
  is doctrine collapse; retroactive pattern recognition;
  inconsistent 3+ promotion threshold; "earned closure"
  unfalsifiable; doctrine silent about un-closed
  objects; closure-pressure not authorship-discipline).
  Recommendation: demote to observed-pattern.
- **203** — the-fixer. Ships 202's mutation: 188
  invariant moved out of `## invariants` into new
  `## observed patterns` section; reframed as
  descriptive not prescriptive; "earned closure" replaced
  with positive authoring rule "*closure beats should
  surprise the realm, not satisfy a pattern.*" Same-day
  beat-pair (199), additive-baseline (201), and source-
  specific echo (194) added to the new section as 1-use
  observations (consistent 3+ promotion threshold). All
  references to "188 invariant" / "second use of template"
  updated through the doc.
- **204** — the-pessimist. Adversarial bug-hunt across
  192/194/196/197/199/201/203. 3 findings: HIGH (named-
  character invariant 4 ticks stale; claims teacher+merchant
  shipped when 4 are); MEDIUM (same invariant claims
  multiplicative-only pattern contradicting 201 additive);
  LOW (201 journal verification path has wrong character
  trigger). 6 ships otherwise clean. Doc-lag is the
  dominant failure mode.
- **205** — the-fixer. Ships 204 HIGH + MEDIUM:
  named-character invariant updated to reflect 4 of 6
  mechanics shipped (teacher 101 / merchant 102 / smith
  105+153 / bard 201) + dual-pattern shape
  (multiplicative + additive variants documented;
  cross-references `## observed patterns`). LOW finding
  (201 journal verification path) deliberately not
  edited per "don't rewrite history" discipline.
- **206** — the-fixer. Closes 105 filed (101 ticks):
  rival → +10% raid count. Sixth named-character
  mechanic; only mayor structural-unlock remains.
  Multiplicative variant; floor-rounding produces soft
  difficulty curve. Doc invariant updated SAME tick per
  204 [process] discipline (5 of 6 mechanics enumerated).
- **207** — surprise. **fields_know_realm** — third
  early-game beat (closes 196/199 filings). Year-1
  summer day 10+ between long-evening day 8 and autumn
  pair day 15. Mutual-recognition mood: land-as-agent
  ("agreed to be lived in") inverts realm-observes-world.
  Per 203 positive authoring rule earns landing through
  fresh axis, not pattern-completion. NARRATIVE_BEATS
  reaches 33; year-1 progression now 5 beats over 12 days.
- **208** — refactor. Adds
  **observational-elder register cluster** as 5th
  observed-pattern: ~11 beats across 4 tags share
  declarative-present-tense voice + "realm" as collective
  subject + no founder/character agency + hopeful-or-
  resigned mood. Sub-types catalogued: ambient-entity-
  grammar (148/152/166) / weather-recognition (147/174) /
  forgetting (184/190) / naming-place (193) / early-game-
  mood (196/199/207) / land-as-agent (207, 1 use).
  **Register and tag are orthogonal**: register guides
  voice/mood; tag guides eviction/echo. Authoring
  guidance for new cluster members included. 207 and
  199 filed this; cluster size threshold met.
  Multiplicative-bonus count in additive-baseline entry
  updated 1+3 → 1+4 (caught up for 206 rival).
- **209** — the-fixer. Closes 206 filed (3 ticks):
  rival's symmetric +reward arm — +5 gold per raider slain
  when rival named (combat.js raider-death handler at line
  94+). Pairs with 206's difficulty bump as
  **adversarial-AND-rewarding** symmetric design. Rival is
  now the first character with TWO mechanic sites
  (raid-spawn 206 + raider-death 209). Three mechanic shapes
  now: 4 multiplicative + 1 additive + 1 event-trigger.
- **210 (this update)** — the-archivist. 12-tick rhythm
  sweep (198 last). Closes filings 202 [process] (promotion-
  threshold audit) + 204 [process] (code-state drift audit) +
  205 [doc] (known-gaps closure sweep). **Findings/fixes:**
  (1) Ambient-entity paired-grammar invariant updated from
  2-uses claim (148+152) to **3 uses (148+152+166)** —
  meets 3+ threshold consistently; doc was lagging the 166
  ship. Filed candidates list refined. (2) Known-gaps:
  closed first-snow gap (090 → 121, story.js:615), closed
  year-milestones gap (090/073 → 092, story.js:289-293),
  closed founder-moratorium gap (146 → 157), updated named-
  character mechanics gap from "3 of 6" to **5 of 6** with
  three-shape taxonomy summary. (3) No other invariants
  found at sub-threshold; the 144 `after:` schema is
  infrastructure (not a literary pattern; 3+ rule doesn't
  apply); end-of-realm-beats invariant is class-level (1
  beat, but the property generalizes). 188 demotion at 203
  remains the only active demotion. Status line adds 210.
  Chronology stays through 210.
