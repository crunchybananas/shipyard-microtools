# journal index

One line per iteration. Newest at bottom. Format:

```
- [NNN](NNN.md) — <summary; file hint(s)> [challenge: <name> <accepted|mutated|rejected>]
```

- [001](001.md) — genesis: loop/ scaffolding, manifest, challenges pool (34 challenges), seed ideas from LOOP_STATE known issues  [challenge: (none — scaffolding tick)]
- [002](002.md) — the-30-seconds baseline: strong first-action loop; onboarding gaps around pop-growth, placement-preview, HUD tooltip density, welcome-banner overlap  [challenge: the-30-seconds accepted]
- [003](003.md) — the-photographer: day-lighting curve tonally compressed (midday ≈ dusk); winter under-exposed; composition bones are solid; photo-mode would help next hunts  [challenge: the-photographer accepted]
- [004](004.md) — the-profiler (lighting curve): `G.debug.lightCurve()` live in state.js+main.js; curve is SEASON-INVARIANT (winter darkness is tint, not luminance); 42% of day is flat-1.0 plateau; night-floor 0.55 still the raised fix  [challenge: the-profiler accepted]
- [005](005.md) — the-art-director (lightCurve critique, mutated): 3 failure modes identified (frame lies about time, plateau shaped wrong, sky/ground uncoupled); proposes peaks at dawn/dusk t=0.22/0.78 aligned with sky gradient; acknowledges load-bearing 0.55 floor constraint  [challenge: the-art-director mutated]
- [006](006.md) — the-fixer: minimap-click idea DROPPED (bug was stale); repositioned `#toast` from viewport-center to top-5rem in index.html so welcome no longer covers starting citizens; incidentally confirmed placement-preview grid exists  [challenge: the-fixer accepted]
- [007](007.md) — the-novice: 006 fix verified in the wild (no modal over citizens); 6 new onboarding findings (scenario desc missing, tutorial progress label, persistent build selection across tutorial steps, unnamed tile dots, decorative balloon reads clickable, placement-grid low contrast); named-character hover ("Ada Pike") is a delightful beat  [challenge: the-novice accepted]
- [008](008.md) — the-fixer: surfaced scenario descriptions on landing page from existing `SCENARIOS[id].desc` via `setScenario` + `#scenario-desc`; closes 007 #1 finding; one source of truth preserved  [challenge: the-fixer accepted]
- [009](009.md) — the-fixer (mutated): placement-grid contrast; pulse alpha 0.06–0.30 → 0.14–0.42, fill #22c55e→#4ade80, added pale-green stroke at 2× pulse for edge definition; closes 007 #6  [challenge: the-fixer mutated]
- [010](010.md) — the-gamer: Hard+Military; 006 + 009 pass in the wild (danger toasts at top-center, grid visible on grass); 5 new findings including "danger toast names buildings player can't build" and "survive-5-raids increments without defenses"  [challenge: the-gamer accepted]
- [011](011.md) — the-contrarian (against 005): don't re-shape the lightCurve; 005's fix violates its own constraints, mis-diagnoses the perceptual failure, and 010 is evidence that winter-dark lives outside the curve; recommends hue-varying the multiply tint + photo-mode instead  [challenge: the-contrarian accepted]
- [012](012.md) — the-fixer (tint hue-variation): closes 011's recommendation; three-band profile in render.js (dawn rose → dusk-night lerp amber→indigo); magnitude unchanged; dusk reads warm, night reads cool, mid-scene lands near-neutral; verified numerically + visually  [challenge: the-fixer accepted]
- [013](013.md) — the-screenshot-critic: 6 frames across seasons/time-of-day; 012 holds up — winter-dusk (5b) clearly distinct from winter-midday (5a), 003 complaint resolved; weakest frame is winter-midday (no tint, bare cold tileShift); recommends tileShift tune next  [challenge: the-screenshot-critic accepted]
- [014](014.md) — the-fixer (survive-raids counter): moved unconditional increment from main.js day-tick into economy.js checkRaids, gated on existing hasDefense variable; verified in chrome-mcp — defenseless raid no longer counts (stays 0), defended raid increments (0→1); closes 010 #3 correctness bug  [challenge: the-fixer accepted]
