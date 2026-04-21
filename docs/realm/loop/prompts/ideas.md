# ideas

Append-only backlog for future iterations. Format:

```
- <iter-added> <tag> — <one line>. [optional: context / file hint]
```

`<tag>` is one of: `[play]` `[code]` `[review]` `[persona]` `[open]`.

When an iteration lands an idea, mark it `DONE → NNN` in-place (don't
delete — the audit trail matters). When an idea turns out to be
wrong or stale, mark it `DROPPED — <reason>`.

Ideas don't get picked directly — they inform a challenge. If an
idea would make a good challenge, promote it to `challenges.md`
and note the promotion here.

## seeds (from archive/LOOP_STATE.md Known Issues, 2026-04-15)

- 001 [code] — minimap click broken: async `import()` in `input.js` doesn't resolve. [input.js] **DROPPED → 006** (verified in chrome-mcp: no async imports remain; handler works; seed was outdated)
- 001 [play] — long-session verify: 30+ day play with missions/raids/research after rAF fallback fix. [the-idle-player pairs well]
- 001 [code] — workers should be visible at buildings: citizens assigned to farms standing visibly near the farm. [citizens.js + render.js]
- 001 [play] — sound-on-production verify: SFX fires for each production tick across all building types. [the-lore-hunter]
- 001 [code] — module cache-busting story: current workaround is fresh tab + clear site data. Worth a cleaner pattern?

## open

(new ideas go here — newest on top)

- 002 [code] — population-growth hint on "Reach 10 population" mission card; novice has no signal that housing grows pop. [ui.js / missions.js]
- 002 [play] — HUD tooltip audit: hover every top-bar icon and report which have tooltips vs which are bare. Pair with `the-novice` persona. [index.html / ui.js]
- 002 [code] — tighten welcome-banner fade: currently overlaps starting citizens at T+0–3. Either move it out of the citizen zone or fade it faster. [main.js? enhancements.js?] **DONE → 006** (repositioned `#toast` to top:5rem in index.html; affects all centered toasts, welcome no longer covers map center)
- 002 [play] — verify or refute: is there a placement ghost-preview after selecting a building? 30-seconds tick missed it; needs a focused second look. [input.js + render.js] **DONE → 006** (confirmed by incidental observation during 006 fix: selecting Farm overlays a translucent grid on buildable tiles — 30-seconds tick's screenshot timing missed it)
- 003 [code] — day-lighting curve audit: log current luminance multiplier across dayPhase 0–3600 for each season; expose on `G.debug.lightCurve`. Measure before changing. [render.js] **DONE → 004** (in state.js+main.js)
- 003 [code] — photo mode (`H` toggle): hide HUD, mission panel, minimap, build bar, pause label. Useful for marketing and for future `the-photographer` ticks. [index.html / ui.js]
- 003 [code] — winter palette warm-highlight pass: lit windows, fire glow, sun-on-snow specular so winter doesn't read as "underexposed." [render.js / enhancements.js]
- 003 [code] — particle–season rebind: when season flips (even via `G.season=`), clear and re-seed the particle pools so snowflakes stop in spring. [enhancements.js]
- 003 [code] — `G.setSeason(name)` dev helper that flips season AND refreshes HUD + particles, for photo/debug work. [main.js]
- 004 [code] — golden-hour peak: replace the flat 1.0 plateau (t=0.17→0.58) with a symmetric peak around t=0.4. Curve, not rectangle. [state.js getDaylight]
- 004 [code] — seasonal sun-angle: winter peak ~0.9, summer ~1.05. First real season→luminance coupling. [state.js]
- 004 [code] — canvas pixel-luminance sampler on `G.debug.sampleLum()`: snapshot N pixels, compute mean luminance. More rigorous than the effLum proxy in lightCurve. [main.js / render.js]
- 004 [code] — configurable night floor: expose `G.debug.nightFloor` knob so designers can test 0.3 / 0.4 / 0.55 / 0.7 without re-deploy. [state.js]
- 004 [code] — night-progression curve: let effLum dip past 0.76 mid-night and recover near dawn so the back half of a day *feels* like a night. [state.js getDaylight]
- 004 [review] — argue for/against re-shaping the lightCurve given 004 numbers; pair `the-skeptic` with `the-art-director`. [journal only] **DONE → 005 (art-director) + 011 (contrarian)** — both sides now on record; current recommendation: leave the curve alone, fix the tint instead
- 005 [code] — split `getDaylight` into `getDaylight` (clamp [0,1], gameplay-safe) + `getWarmth` (free-range color bias). Pre-req for any curve re-shape. [state.js]
- 005 [code] — align ground luminance peaks with sky-gradient peaks at t=0.22 and t=0.78 (they're currently mis-aligned — sky peaks warm when ground is ramping or already descending). [state.js + render.js:118]
- 005 [code] — `getSkyWarmth(t)` sampler on `G.debug.skyCurve`; enables sky/ground alignment verification before shipping a change. [render.js + state.js]
- 007 [code] — scenario descriptions on landing page: one line per scenario (Peaceful/Military/Merchant/Seafaring/Industrial), hover or always-visible. Novice can't tell them apart. [index.html landing] **DONE → 008** (desc element under `.scenario-buttons`, driven by `SCENARIOS[id].desc` via `setScenario`)
- 007 [code] — tutorial progress label: change `2/10` to `Step 2 of 10` or similar explicit label. Currently ambiguous with resource counts. [ui.js tutorial tip] **DONE → 019** (one-string change at ui.js:937; verified "Step 2 of 10" renders)
- 007 [code] — cancel building-selection on tutorial-step advance (or flash the new target). Current behavior: tutorial says "click Lumber Mill" but previous Farm selection stays active, causing accidental double-farm placement. [input.js / ui.js]
- 007 [code] — tooltip coverage on tile-decoration dots (berries, herbs, ore, etc.). Current: no hover reveal. Novice can't identify them. [input.js hover handler + ui.js]
- 007 [code] — disambiguate decorative ambient objects (hot air balloon, birds). Either make them subtly click-for-flavor or add cursor/style hint that they're NOT interactive. [enhancements.js]
- 007 [code] — placement-preview grid contrast: the translucent green grid nearly disappears against grass tiles. Brighter edges, subtle pulse, or higher-contrast outline would make it discoverable. [render.js] **DONE → 009** (pulse alpha 0.06–0.30 → 0.14–0.42, fill `#22c55e`→`#4ade80`, added pale-green `#bbf7d0` stroke at 2× pulse for edge definition)
- 007 [code] — `#toast` is overloaded: welcome + danger + info + mission all share one centered element. Split into a decorative `#announce` (top-center, fade) and a critical `#alert` (stays visible until dismissed). Pairs with 006 repositioning. [index.html + notifications.js]
- 007 [review] — audit all toast callsites for type appropriateness; some "info" toasts probably deserve to be "event" or silent ticker entries. [notifications.js callers]
- 010 [code] — smart danger toasts: when the toast message names buildings (walls/barracks/towers), check availability. If tech-locked, append "Research X first." Current behavior points the player at something invisible. [notifications.js + events.js + tech.js] **DONE → 015** (rephrase at economy.js:383 using `isBuildingUnlocked` from tech.js; three branches: no-techs → "Research Masonry to unlock walls", +masonry → "Build walls. Research Military for barracks/towers", +military → original text)
- 010 [code] — sticky raid banner during active combat + post-raid body-count summary. Currently raids happen off-screen with no active UI — just a ticker entry. [events.js / render.js]
- 010 [code] — auto-pause on first raid (toggleable setting thereafter). Gamer at speed 4× loses citizens before noticing. [events.js]
- 010 [code] — survive-raids counter increments without any defense built: counter went 0→3/5 while player had zero military buildings. Likely counts "raid fired" not "defense succeeded". Verify the mechanism; fix so only actual defenses count. [events.js / missions.js] **DONE → 014** (moved increment from main.js day-tick into economy.js checkRaids, gated on hasDefense; verified in chrome-mcp — defenseless raid no longer increments, defended raid does)
- 010 [code] — scenario-specific first tutorial steps: Military scenario's first step should be "research military basics", not "build a farm." [ui.js tutorial steps]
- 010 [code] — Research button pulse/glow when critical tech is undiscovered AND a raid is forecast. Current state: button is visible but doesn't actively draw attention. [ui.js]
- 011 [code] — hue-vary the multiply-tint overlay across dayPhase: currently `rgb(255-D×160, 255-D×150, 255-D×100)` produces a uniformly-blue cast at every non-peak moment. Varying the coefficient profile by `dayT` so midday-blue/dusk-orange/night-indigo are distinct hues would make the 19% luminance delta read against different-colored backgrounds. Cheapest fix for the "all frames look alike" complaint. [render.js:2518] **DONE → 012** (three-band profile: dawn rose (80/140/160), dusk→night lerp from amber (80/120/180) at t=0.70 to indigo (180/140/100) at t=1.0; magnitude preserved)
- 011 [code] — `G.debug.tintCurve()` sampler: sibling to `lightCurve()`, returns the tint RGB across samples of dayPhase. Enables numeric measurement of tint variance before/after a hue-variation change. [state.js or new debug module]
- 011 [code] — photo-mode scope-bound lightCurve: a separate `getPhotoDaylight()` used only when `G.photoMode === true`, so the flat-plateau gameplay curve and a dramatic photographic curve can coexist without compromise. Pairs with the photo-mode toggle idea from 003. [state.js]
- 013 [code] — winter tileShift tune: current `[-10, -5, +15]` produces a uniformly blue-washed drained midday (overlay is off at daylight=1.0 so the tileShift is unopposed). Try `[-5, -3, +8]` (half magnitude) or similar. Highest-leverage frame — midday dominates 42% of play time. [state.js SEASONS.winter.tileShift] **DONE → 017** (tuned to exactly the half-magnitude recommendation; verified in chrome-mcp: winter midday reads "dormant cool" not "drained", winter dusk still distinctly warmer than midday per 012+017 combined)
- 013 [code] — season-aware midday tint: introduce a very-light tint even at daylight=1.0 that reflects season (subtle warm in summer, cool in winter). Would make midday participate in the day-color system instead of being the only frame without chromatic season coupling. [render.js night-overlay block]
- 016 [code] — cap raid-flash accumulation: 4 raids fired in rapid succession leaves `G.raidFlash` stuck at ~0.35 long after. Likely `Math.min(G.raidFlash + delta, 1.0)` or a single-source assignment. Defensive; matters for debug/stress but not normal play. [render.js / events.js] **DROPPED → 019** (re-diagnosed: code already uses direct `= 1.0` assignment, not `+=`. No accumulation bug. The "stuck at 0.35 long after" was a chrome-mcp hidden-tab artifact: decay runs per render frame and render pauses when tab is backgrounded. Not present in real play. A future tick could move decay to game-tick loop for testability; not a real-player bug.)
- 016 [code] — tutorial event-awareness: tutorial sat frozen at "build a farm" through 4 raids and 12 citizen deaths. Either pause with contextual tip on major events, or auto-advance when the game state clearly supersedes the current step. [ui.js tutorial system]
- 016 [code] — population + skull counter coherence: `☠️ 12` next to pop `3/3` reads as ambient when it's actually a massacre log. A "-3 citizens lost in raid" inline toast or red flash on the pop icon would connect the dots. [ui.js / events.js]
- 018 [code] — summer-dawn tune candidate: the rose tint at t<0.10 rides on already-warm summer tiles and reads "slightly tinted morning" rather than distinct dawn. Could widen the window (t<0.15) or strengthen the rose R-drop. Low priority — may be correctly subtle by design. [render.js night-overlay dawn branch]
- 018 [code] — photo-mode preset: codify t=0.70 + summer as the cover-art recipe when photo-mode ships. Save a "sunset" preset that sets dayPhase + season + hides HUD. [ideas pair with 003 photo-mode]
- 018 [play] — full-settlement frame gallery: 018 shot empty-map frames. A 50+ building gallery would surface lighting issues that interact with building silhouettes (rim-light, shadow pools, lit-window contrast). Pair with photo-mode. [the-screenshot-critic repeat once settlement is large]
- 021 [code] — add 5 first-build chronicle beats: blacksmith, school, windmill, bakery, archery. Pattern-match existing 12 beats in story.js:checkStoryBeats. Drafts provided in 021 journal. Highest narrative-payoff-per-line fix available. [story.js] **DONE → 022** (5 flag-gated blocks appended; verified in chrome-mcp — placing all 5 test buildings fires all 5 beats in order)
- 021 [code] — mission-objective tone pass: rewrite 15 objective texts (5 scenarios × 3) in the voice of their scenario `desc`. Current objectives read like JIRA tickets vs the evocative scenario names. Copy task, high mood return. [scenarios.js]
- 021 [code] — fill the `migration` event endMsg: currently empty (`''`). All other 4 events have evocative end messages. One-line add. [events.js:64]
- 021 [code] — wire named characters for blacksmith (smith), market (merchant), school (teacher). `namedCharacters` system exists; 3 new ensure* functions + story.js hooks on firstBlacksmith/firstMarket/firstSchool. Would multiply "inhabited realm" signal. [story.js]
- 023 [code] — drop "Research stonework, then " prefix from Peaceful scenario objective 2. 15-char removal. Only chained objective in the game; references tech the engine calls "masonry" not "stonework"; check function doesn't test the research half. [scenarios.js:14]
- 023 [review] — audit all objectives across all scenarios for chained "A, then B" language. Industrial has "Build a Windmill + Bakery" (conjunction variant). Could split into atomic objectives. Pairs with the 021 tone-pass idea. [scenarios.js]
- 024 [code] — **undo + chronicle desync** (real bug): `undoLastBuild()` removes a building but leaves its first-build chronicle entry AND the `firstX` flag in place. After rebuild, no new beat fires. Fix approach (a): snapshot `G.storyFlags` onto the undo-stack entry and restore it on undo. Small, generalizes to all story flags. [story.js + economy.js undoLastBuild]
- 024 [code] — retroactive chronicle beats on old saves: low-severity, but a player's pre-022 save with a blacksmith already built will get "first blade quenched..." at load-time instead of at the actual place-time. Consider guarding with `G.day === 1` or similar so only fresh placements narrate. [story.js]
- 024 [play] — pessimist-revisit pool: targets not hunted in 024 that deserve a later pass: (a) rapid double-click placement double-charging, (b) mass-death save/load population coherence, (c) season fast-forward chronicle queueing, (d) fisherman edge-placement on water adjacency, (e) research completion mid-raid UI consistency. [the-pessimist second run]
