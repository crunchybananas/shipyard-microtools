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
- 007 [code] — tutorial progress label: change `2/10` to `Step 2 of 10` or similar explicit label. Currently ambiguous with resource counts. [ui.js tutorial tip]
- 007 [code] — cancel building-selection on tutorial-step advance (or flash the new target). Current behavior: tutorial says "click Lumber Mill" but previous Farm selection stays active, causing accidental double-farm placement. [input.js / ui.js]
- 007 [code] — tooltip coverage on tile-decoration dots (berries, herbs, ore, etc.). Current: no hover reveal. Novice can't identify them. [input.js hover handler + ui.js]
- 007 [code] — disambiguate decorative ambient objects (hot air balloon, birds). Either make them subtly click-for-flavor or add cursor/style hint that they're NOT interactive. [enhancements.js]
- 007 [code] — placement-preview grid contrast: the translucent green grid nearly disappears against grass tiles. Brighter edges, subtle pulse, or higher-contrast outline would make it discoverable. [render.js] **DONE → 009** (pulse alpha 0.06–0.30 → 0.14–0.42, fill `#22c55e`→`#4ade80`, added pale-green `#bbf7d0` stroke at 2× pulse for edge definition)
- 007 [code] — `#toast` is overloaded: welcome + danger + info + mission all share one centered element. Split into a decorative `#announce` (top-center, fade) and a critical `#alert` (stays visible until dismissed). Pairs with 006 repositioning. [index.html + notifications.js]
- 007 [review] — audit all toast callsites for type appropriateness; some "info" toasts probably deserve to be "event" or silent ticker entries. [notifications.js callers]
- 010 [code] — smart danger toasts: when the toast message names buildings (walls/barracks/towers), check availability. If tech-locked, append "Research X first." Current behavior points the player at something invisible. [notifications.js + events.js + tech.js]
- 010 [code] — sticky raid banner during active combat + post-raid body-count summary. Currently raids happen off-screen with no active UI — just a ticker entry. [events.js / render.js]
- 010 [code] — auto-pause on first raid (toggleable setting thereafter). Gamer at speed 4× loses citizens before noticing. [events.js]
- 010 [code] — survive-raids counter increments without any defense built: counter went 0→3/5 while player had zero military buildings. Likely counts "raid fired" not "defense succeeded". Verify the mechanism; fix so only actual defenses count. [events.js / missions.js]
- 010 [code] — scenario-specific first tutorial steps: Military scenario's first step should be "research military basics", not "build a farm." [ui.js tutorial steps]
- 010 [code] — Research button pulse/glow when critical tech is undiscovered AND a raid is forecast. Current state: button is visible but doesn't actively draw attention. [ui.js]
- 011 [code] — hue-vary the multiply-tint overlay across dayPhase: currently `rgb(255-D×160, 255-D×150, 255-D×100)` produces a uniformly-blue cast at every non-peak moment. Varying the coefficient profile by `dayT` so midday-blue/dusk-orange/night-indigo are distinct hues would make the 19% luminance delta read against different-colored backgrounds. Cheapest fix for the "all frames look alike" complaint. [render.js:2518] **DONE → 012** (three-band profile: dawn rose (80/140/160), dusk→night lerp from amber (80/120/180) at t=0.70 to indigo (180/140/100) at t=1.0; magnitude preserved)
- 011 [code] — `G.debug.tintCurve()` sampler: sibling to `lightCurve()`, returns the tint RGB across samples of dayPhase. Enables numeric measurement of tint variance before/after a hue-variation change. [state.js or new debug module]
- 011 [code] — photo-mode scope-bound lightCurve: a separate `getPhotoDaylight()` used only when `G.photoMode === true`, so the flat-plateau gameplay curve and a dramatic photographic curve can coexist without compromise. Pairs with the photo-mode toggle idea from 003. [state.js]
- 013 [code] — winter tileShift tune: current `[-10, -5, +15]` produces a uniformly blue-washed drained midday (overlay is off at daylight=1.0 so the tileShift is unopposed). Try `[-5, -3, +8]` (half magnitude) or similar. Highest-leverage frame — midday dominates 42% of play time. [state.js SEASONS.winter.tileShift]
- 013 [code] — season-aware midday tint: introduce a very-light tint even at daylight=1.0 that reflects season (subtle warm in summer, cool in winter). Would make midday participate in the day-color system instead of being the only frame without chromatic season coupling. [render.js night-overlay block]
