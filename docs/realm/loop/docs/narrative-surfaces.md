# narrative-surfaces.md

**Status:** Written in tick 075. Updated 080, 084, 091, 104, 129, 141, 155, 177, 178, 188, 198, 203, 205, 206, 208, 209. Maintained by
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

  Currently shipped (5 of 6): teacher → +10% research
  (tech.js, 101), merchant → +5% trade (trade.js, 102),
  smith → +5% tower fire-rate (combat.js, 105 → re-tuned
  at 153 from damage to fire-rate), bard → +5 happiness
  baseline (economy.js, 201), rival → +10% raid count +
  +5 gold per raider slain (economy.js raid spawn 206 +
  combat.js raider death 209; adversarial-AND-rewarding
  symmetric pair). Silent mechanic (no UI, no chronicle
  beat — 034's character-intro already narrates arrival).
  Remaining: mayor (civic-unlock; structural, larger
  scope only).
- **End-of-realm beats are first-class** (103, closing 053's
  filed ask). `realm_fell` NARRATIVE_BEATS entry fires when
  `G.population === 0 && G.day > 1`. Tag: `requiem`.
  Eviction-immune. No echo-eligible (no more dawns post-fall).
- **Ambient-entity acknowledgment is a paired grammar** (148 +
  152). Ambient entities with existing visual presence but no
  narrative surface (wanderer: 048/061; ghost: 031; others
  pending — owls/frogs/rams/trade-ships/hawks) may get a
  1-beat acknowledgment each. Pattern: misc-tag, static string,
  no variants (entity singularity), no "name" word that would
  collapse ambiguity. Elder-silence register ("no one calls
  them anything" / "no one asks them to describe it"). Gate
  on timing or prerequisite that makes the sighting plausible
  (wanderer: day ≥ 50; night-shape: day ≥ 60 + firstBirth).
  Does NOT contribute to founder arc bookkeeping — useful
  during/after the 146 founder-moratorium to diversify focal
  points. Rule: if the entity already has a kingdom name or a
  player interaction, use a different pattern (it's no longer
  ambient).
- **144 schema: `after: (G) => void` for NARRATIVE_BEATS
  entries.** Mirrors BUILDING_FIRST_BEATS `after:` (used since
  034 for named-character intros). Dispatch loop runs
  `beat.after(G)` after chronicle + onFire, in a try/catch
  wrapper. First use: 134 namesake's citizen-rename. Rule per
  123/144 pattern-emergence: new schema fields are added when
  3+ entries would need them (`onFire` had 3+ audio needs at
  123; `after` had 1 at 144 — justified because 144's need was
  a legitimate side effect, not a post-hoc generalization).
## observed patterns

Distinct from invariants. Observations describe
what the realm has done; invariants prescribe
what the realm must do. Patterns in this section
have NOT yet been promoted (typically: <3
canonical uses or unresolved structural questions).
Promote to invariants only when the rule is
prescriptive AND consistently applied.

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

- **Additive-baseline vs multiplicative-bonus
  vs event-trigger-reward for named-character
  mechanics (observation, 4+1+1 uses).** Three
  shapes now in the wild:
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
    Filed at 209 with promotion threshold 3+.
    Different shape from multiplicative (no
    multiplier chain) and additive (not a
    baseline) — it's a CONDITIONAL GRANT inside
    an event handler.
  
  Rival is the first character with TWO mechanic
  sites (raid-spawn multiplier 206 + raider-kill
  reward 209). The pair is symmetric: harder
  raids AND more reward for surviving them.
  Future characters may follow the same dual-
  shape design (e.g., a hypothetical bandit-king
  rival might dual-ship raid difficulty AND
  per-bandit-corpse loot).

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
  (observation, ~11 uses across 4 tags).** A
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
  - *misc tag* (7): 148 wanderer / 152 night-shape /
    166 frog-voices / 174 first-frost / 196 long-
    evening / 199 cold-morning / 207 fields-know-realm
  - *milestone tag* (2): 190 constellation-forgotten /
    193 landmark-named
  - *stone tag* (1): 184 stone-forgotten
  - *event tag* (1): 147 great-storm-remembered

  **Sub-types within the cluster:**
  - *Ambient-entity-grammar* (148/152/166):
    1-beat acknowledgment of an entity present
    but unnamed. Codified separately as the
    silent-walker grammar invariant.
  - *Weather-recognition* (147/174): the realm
    notices or remembers weather as a marker
    of the year.
  - *Forgetting* (184/190): generational-gap
    closure of a long-lived object. See the
    object-arc closure observation above for
    the 4-beat-vs-2-beat shape distinction.
  - *Naming-place* (193): the realm gives a
    place a colloquial name. Third member of
    the realm-environment naming triplet
    (sky 116 / object 056 / place 193).
  - *Early-game-mood* (196/199/207): year-1
    moments of arrival, change, or familiarity.
    Anti-anxious continuity register
    counterbalancing the late-arc bias 195
    flagged.
  - *Land-as-agent* (207): the LAND has
    subjective voice ("agreed to be lived in").
    1 use; filed for promotion at 3+.

  **Authoring guidance (when adding to cluster):**
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

## known gaps (as of 104)

- **Sustained-state beats** (060 filed) — no beat for "realm has
  known peace for 50 days." Filed as 060 idea.
- **Founder→dream cross-reference** (072 filed, partially closed
  by 089). 089 wired founders into the nightmare pool; the dream
  pool (039) and offering pool (079) still don't reference
  founder names. 089-filed idea: weave founder-named images
  into `founding`/`hearth`/`harvest` dream threads.
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
  101/102/105/153). Closed: 3 of 6 graduated. Teacher +10%
  research (101), merchant +5% trade (102), smith +5% fire-
  rate (105 shipped as damage, 153 swapped to fire-rate per
  120 audit finding that integer HP-rounding made the damage
  axis marginal). Bard/mayor/rival still decoration. 154
  the-skeptic flagged pursuing all 6 may exceed 120's 25%
  cumulative-speedup budget; remaining 3 await deliberate
  decision (pair each with a distinct game system to avoid
  multiplicative stacking).
- **Founder-weaving arc is 16 surfaces deep at 7/5/4 (fully
  balanced)** (088 + 089 + 093×3 + 097 + 103 = founder1 7;
  116 + 128 + 134 + 137 + 138 = founder2 5 via named-role
  or spoken-name; 128 + 134 + 138 = founder3 4). **146 the-
  contrarian argued the arc had become the loop's default
  crutch** (75% of surprises 116-138 leaned founder-focal);
  proposed 10-tick moratorium 147-156 on NEW founder
  surfaces. Scorecard at 152 HITS target (3/≥3 non-founder
  surprises: 147 great-storm / 148 wanderer / 152 night-
  shape; ≥2 new focal points introduced; 0 founder-surface
  increase). **157 check-in tick will close the moratorium.**
  Going forward: new narrative ticks should continue
  diversifying focal points (ambient-entity grammar, object-
  focal beats, location-focal beats, weather) rather than
  adding founder mentions.
- **Happiness beats not in NARRATIVE_BEATS** (090 filed) — their
  hysteresis-reset semantics don't fit the one-shot trigger
  model. Could be migrated with a `resetOn:` extension field.
- **First-snow beat (088) not in NARRATIVE_BEATS** (090 filed) —
  trivial to migrate; left inline as minimum-risk path on 090.
- **Year milestones not in NARRATIVE_BEATS** (090/073 filed) —
  enhancements.js:5086; would need cross-file table export.

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
- **209 (this update)** — the-fixer. Closes 206 filed
  (3 ticks): rival's symmetric +reward arm — +5 gold per
  raider slain when rival named (combat.js raider-death
  handler at line 94+). Pairs with 206's difficulty bump
  as **adversarial-AND-rewarding** symmetric design.
  Rival is now the first character with TWO mechanic
  sites (raid-spawn 206 + raider-death 209). Doc
  invariant updated SAME tick per 204 [process]; rival
  entry expanded to "+10% raid count + +5 gold per
  raider slain". Observed-patterns additive-vs-
  multiplicative entry now identifies a THIRD shape:
  **event-trigger reward** (1 use, threshold 3+).
  Three shapes now: 4 multiplicative + 1 additive +
  1 event-trigger.
