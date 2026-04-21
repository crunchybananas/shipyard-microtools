# narrative-surfaces.md

**Status:** Written in tick 075. Updated 080, 084. Maintained by
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
noise. 084 (this update) captures the 082/083 lesson.

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
5. **First citizen born** (one-shot, `birth`) — `G.stats.citizensBorn >= 1`.
6. **Population thresholds** (10/25/50/75/100, one-shot, `milestone`).
7. **Castle built** (`castleBuilt` flag, `victory`) — kingdom +
   mayor name in prose.
8. **First raid survived** (one-shot, `raid`).
9. **Happiness-threshold beats** (071, recurring with hysteresis,
   `milestone`) — peak ≥80 / crisis ≤20, mid-range 35-65 resets
   flags so cycling works.
10. **checkDreamBeat** (039/054/055, 10-day cadence, `dream`) —
    10-thread pool, 044 seasonal lens, 064 approach boost.
11. **checkNightmareBeat** (043, once-per-realm seeded, `nightmare`).
12. **checkStoneBeat** (056, once-per-realm seeded, `stone`) — renders
    via 058 at stored `stone_x`/`stone_y`.
13. **checkEchoBeat** (059/063, ~2% per-dawn, `echo`) — cites
    prior `_ECHO_SOURCE_TAGS` with one of 4 memory frames.
14. **checkOfferingBeat** (079, cross-system gated, `stone` tag
    reuse) — fires once per realm on a dawn when `stone_found`
    AND `happyPeakActive` AND `!offering_made` (+ day ≥ 30) at
    ~15% probability. First chronicle beat requiring the
    intersection of 3 system flags. 6 item variants.

Wait — that's 14 items in story.js counting founding. Let me
collapse: founding is logically main.js's; story.js owns 13.

### main.js (2 systems)

14. **Founding beat** (day 1, `milestone`).
15. **Season transitions** (4×/year, `season`) — prose in
    `seasonTexts` object. After 070, toast does NOT double-chronicle
    (passes `{chronicle: false}`).

### tech.js (1 system, shipped in 065)

16. **Research completion** (per-tech completion, `research`) —
    RESEARCH_BEATS table, 11 entries + fallback.

### enhancements.js (6 systems)

17. **Year milestones** (year 2/3/5, `milestone`).
18. **Rival messenger** (day-scheduled via 034 `rival`, `character`
    and `raid`).
19. **Bard compositions** (raid-triggered via 034 `bard`, `character`).
20. **Mayor declarations** (happiness-triggered via 034 `mayor`,
    `character`).
21. **Building-count milestones** (10/25/50/etc., `milestone`).
22. **Disaster events** (plague/drought/fire/earthquake/merchant/
    refugees, `event`).
23. **Seasonal proverbs** (season-change `misc`) — was 069's
    "Children play at the well..." mystery.
24. **Victory v2** (`victory`) — may overlap with castleBuilt; audit
    needed.
25. **100-building milestone** (`victory`).
26. **Trading post first-build** (`firstTradingPost` flag,
    `milestone`) — only source; NOT in BUILDING_FIRST_BEATS.

That's 10 systems in enhancements.js, not 6. Let me correct — I
mis-collapsed them.

### combat.js + economy.js + events.js + notifications.js (4 systems)

27. **Combat death** (combat.js:134, `death`) — raider kills.
28. **Starvation death** (economy.js:338, `death`).
29. **Population birth** (economy.js:362, `birth`).
30. **Plague death** (events.js:288, `death`).
31. **Random events** (events.js:308+, `event`, `character`, `raid`)
    — cloaked stranger, bard arrives, rival tribute.
32. **notify-passthrough** (notifications.js:68) — when callers
    pass type='event'/'danger'/'mission', the toast is also
    chronicled. Can be suppressed with `meta.chronicle=false`
    (loops 15 + 070 pattern).

### final count

story.js: 12 systems
main.js: 2 systems
tech.js: 1 system
enhancements.js: 10 systems
combat.js + economy.js + events.js: 6 systems
notifications.js: 1 shared passthrough

**≈ 25 narrative systems producing chronicle entries.**

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
   - firstBirth / pop thresholds / castle / firstRaid
   - happiness-threshold (071)
   - checkDreamBeat (039/054/055)
   - checkNightmareBeat (043)
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
- **Filed as future protection** (083 idea): once-per-realm tag
  writes (nightmare/stone/victory) could be marked
  eviction-immune when the cap kicks in. Not implemented yet.
- **Chronicle entries have `{day, season, tick, text, tag}`
  shape.** Writers should use the existing `chronicle(text, tag)`
  helper; don't push directly.

## known gaps (as of 084)

- **Sustained-state beats** (060 filed) — no beat for "realm has
  known peace for 50 days." Filed as 060 idea.
- **Founder→nightmare/dream cross-reference** (072 filed) — 072
  names the 3 founders; 043/039/079 pools don't reference them.
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
- **Once-per-realm beats aren't eviction-immune** (083 filed).
  If a future noise regression happens, the rare beats could get
  cap-evicted again. ~5-line fix in story.js:26 chronicle()
  would pin lifetime tags. Filed; defensive.
- **Year-milestone has grammar bug** (082): "enters second year
  with 1 souls" — should be `soul` when N=1. Also year boundary
  computation at day 29 is unusual.

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
10  character intro + events (034 ensures + bard arrivals)
20  dreams (every 10 days from day 10)
2-4 echoes (2% per-dawn)
0-1 nightmare (seeded [50,250])
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
beats that sum near 57 by themselves.

**Cadence health trend:**
- 082 (pre-083): 299 (cap-hit, signal evicted)
- 083 (post-fix): 156 (quality signal, no eviction)
- 075's target: 80-120 (too low — underestimated seasons)
- **084's revised target: ~130-170** (realistic with current
  surfaces, assumes no future noise regressions)

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
- **084** — this maintenance update. Captures noise-evicts-signal
  as an invariant; revises cadence target to 130-170 post-083;
  corrects 082's HIGH #2 hypothesis.
