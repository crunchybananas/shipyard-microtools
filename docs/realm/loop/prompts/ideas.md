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
- 004 [review] — argue for/against re-shaping the lightCurve given 004 numbers; pair `the-skeptic` with `the-art-director`. [journal only] **PARTIALLY DONE → 005** (art-director side argued; contrarian/skeptic still open)
- 005 [code] — split `getDaylight` into `getDaylight` (clamp [0,1], gameplay-safe) + `getWarmth` (free-range color bias). Pre-req for any curve re-shape. [state.js]
- 005 [code] — align ground luminance peaks with sky-gradient peaks at t=0.22 and t=0.78 (they're currently mis-aligned — sky peaks warm when ground is ramping or already descending). [state.js + render.js:118]
- 005 [code] — `getSkyWarmth(t)` sampler on `G.debug.skyCurve`; enables sky/ground alignment verification before shipping a change. [render.js + state.js]
