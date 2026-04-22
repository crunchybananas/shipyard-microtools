# narrative-surfaces.md

**Status:** Written in tick 075. Updated 080, 084, 091. Maintained by
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
longest-open idea at 28 ticks). 091 (this update) catches the
doc up to 085-090.

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

## tag inventory (14 tags)

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
5. **NARRATIVE_BEATS table** (090, table-driven, closes 062) —
   consolidates 8 one-shot state-triggered beats that used to be
   inline if-blocks: firstBirth (`birth`), pop10/25/50/75/100
   (`milestone`), castleBuilt (`victory`, dynamic text with mayor+
   kingdom), firstRaidSurvived (`raid`). Each entry:
   `{ flag, tag, trigger(G)→bool, text: string|(G)→string }`.
   Mirrors BUILDING_FIRST_BEATS; sibling table, single dispatch
   loop.
6. **Happiness-threshold beats** (071, recurring with hysteresis,
   `milestone`) — peak ≥80 / crisis ≤20, mid-range 35-65 resets
   flags so cycling works. Kept inline in 090 refactor (re-fire
   semantics don't fit one-shot NARRATIVE_BEATS shape).
7. **First-snow beat** (088, cross-system compound, `milestone`) —
   fires once the first time the realm enters winter past day
   10. References `storyFlags.founder1` by name if 072 has fired
   ("…${founder} stands in the fields…"); otherwise generic.
   Kept inline (story-specific compound; NARRATIVE_BEATS trigger
   would work but adds nothing at N=1).
8. **checkDreamBeat** (039/054/055, 10-day cadence, `dream`) —
    10-thread pool, 044 seasonal lens, 064 approach boost.
9. **checkNightmareBeat** (043, once-per-realm seeded, `nightmare`).
    089 added 3 founder-conditional fragments to the image pool,
    gated on `founders_named`. Pool base 11 → 14 (+ up to 4 named-
    character conditionals = 18 max). Pool growth preserves
    hash-seed determinism per kingdom.
10. **checkStoneBeat** (056, once-per-realm seeded, `stone`) — renders
    via 058 at stored `stone_x`/`stone_y`.
11. **checkEchoBeat** (059/063, ~2% per-dawn, `echo`) — cites
    prior `_ECHO_SOURCE_TAGS` with one of 4 memory frames.
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

**≈ 31 narrative entry-points, producing ~25 distinct beat-
flavors.** The 090 refactor means story.js has fewer
dispatching SITES but the same underlying beat SURFACES.

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
  implemented — closes the 083-filed defensive protection).
  `_EVICTION_IMMUNE_TAGS = { nightmare, stone, victory }` at
  story.js:17. When the 300-entry cap triggers, non-immune
  entries drop oldest-first and immune entries survive even
  if the buffer soft-overflows. Protects lifetime-unique beats
  from future noise regressions.
- **Chronicle entries have `{day, season, tick, text, tag}`
  shape.** Writers should use the existing `chronicle(text, tag)`
  helper; don't push directly.

## known gaps (as of 091)

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
- **Year-milestone has grammar bug** (082, still open): "enters
  second year with 1 souls" — should be `soul` when N=1. Also
  year boundary computation at day 29 is unusual.
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
10  character intro + events (034 ensures + bard arrivals)
20  dreams (every 10 days from day 10)
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
- **091** — this maintenance update. Captures 085/088/089/090
  in the invariants + system enumeration. Renumbers story.js
  systems post-090 consolidation (14 → 12 dispatching sites,
  same underlying beat surfaces).
