# Round 211 — Source-aligned windows and furnace light

September 6, 2026. This pass improves building light within the continuing
whole-game AAA goal. It does not complete that goal.

## Result

The renderer was adding generic window rectangles and a whole-building radial
halo at offsets from the old procedural building shapes. The enhancement pass
then added separate house/tavern halos, church color spots, and forge glow and
embers over the already depth-sorted world. Some light missed the painted
openings or covered actors in front of the building.

`js/building-lighting.js` now traces actual windows, stained glass, furnace
openings and the trading-post lantern in 13 source designs. Aliases cover 15
runtime types. Source luminance retains the detail within each opening; church
glass retains its original colored pigment. Nearby facade reflection is soft
and clipped to the painted silhouette. The source PNGs remain unchanged.

Facade emission draws with the **same source crop, destination rectangle and
transform as the building body**, including all four house tiers and both
seasonal materials. It belongs to the building's depth entry. Small projected
ground pools sit beyond the painted footprint and render beneath every body
and actor. The duplicate generic window, house, church and forge light
renderers are removed. Other cosmetic effects remain separate future targets.

Only completed, discovered buildings add light. World building bodies and
their ground contacts now also honor discovery before entering the draw pass.
The window fade follows a continuous cyclic presentation curve, including
dusk and the midnight wrap. A low-amplitude, slow flame variation derives from
the existing tick and building coordinates; pause holds it exactly, and nearby
buildings have different phases. No simulation clock or field changes.

Two 512×512 sparse emission canvases and one shared 64×64 ground-light stamp
retain **2,113,536 pixel bytes**. Each source is read once when its emission
atlas is first baked. Warm rendering performs zero readbacks. Light variation
does not create new building-body composites or additional GL contexts.

## Verification

- **Chrome 152.0.7977.76 and Playwright WebKit 26.4** pass the new gate.
  Both engines find **2,320 main-atlas and 484 support-atlas light pixels**
  with alpha above 16. No emission pixel escapes the original opaque source,
  and no emission alpha exceeds its source alpha.
- Fourteen independently selected source landmarks verify lit windows,
  glass and furnace openings, and unlit roofs/chimneys. The gallery was also
  inspected alongside the enlarged painted source references from Round 210.
- **18 runtime type/tier combinations**, both seasonal materials and three
  zoom observations produce **108 facade light draws**. All **36 direct
  body-source registrations** at close zoom have exactly matching light UVs,
  destinations and transforms; lower zooms retain the cached body path.
- At noon, 10% construction, 99.9% construction and hidden discovery, there
  are **zero added light draws**. The completed house emits both facade and
  ground light. Window intensity remains continuous across the dusk boundary
  and midnight wrap, is identical in paused observations, and changes modestly
  with time and neighboring building coordinates.
- A controlled real game render changes **29,663 Chrome pixels** and **29,471
  WebKit pixels** when only the light layers are suppressed for comparison.
  Terrain, body, season, camera, tick and other effects remain fixed.
- Actual draw order is ground light → citizen/Founder → building/facade light
  when actors are behind the house, and ground light → building/facade light →
  citizen/Founder when they are in front. No later building light covers the
  foreground actors. The 30-render warm check has zero pixel readbacks and
  retains exactly two emission atlases and one ground stamp.
- The **7,200-tick expanded construction playthrough** completes all **46
  structures**, including 32 roads, by the 4,200-tick checkpoint. Population
  reaches 12. The longest measured wait for another 0.4 tile of progress
  toward an unchanged waypoint is 59 ticks. **5,540 continuously stationary
  observations contain zero unwanted gait changes** across 1,200 real renders.
- That run's saved JSON is **byte-identical to Round 210**: 169,527 bytes,
  SHA-256 `6ff891cb9a52eea2e5a22c66dab42259ce8a4e3b089759d9aa5d8be630cd574a`.
  Winter is temporarily shown during rendering; the ordinary simulation season
  is restored before CORE steps. This is not a winter-economy test.
- Dense traffic completes **24/24 routes**, with a longest exact no-progress
  interval of 2 ticks, minimum center spacing 0.310008447 and zero blocked
  building penetration. The deterministic rerun agrees. The gate still records
  3,262 brief close-contact pair-ticks, so this is not strict non-overlap.
- The 77 ground-contact cases, all building source/winter checks, and eight
  WebKit Founder gameplay checks pass, including actual 390px phone touch.
  Full browser logic is **87/87**, and the 43,200-tick deterministic replay
  passes all controls. Core purity, runtime identity, lint and whitespace
  checks pass. The new lighting gate is included in `verify-realm`.

Evidence under `tmp/graphics-world/`:

- `lighting-211-before/` and `lighting-211-final/`: actual grown-town day,
  dusk, night and winter-night screenshots. The final gallery fixes the first
  gallery's overlapping row labels; the earlier town screenshots were valid.
- `building-lighting-gate/` and `building-lighting-gate-webkit/`: reports and
  the isolated house render.
- `lighting-211-construction/{report.json,save.json,construction.png,settlement.png,close.png}`.
- `lighting-211-simulation-comparison.json`.
- `lighting-211-chrome-first.log`, `lighting-211-webkit-first.log`,
  `ground-contacts-211.log`, `building-surfaces-211.log`,
  `founder-game-211-webkit.log`, `dense-settlement-211.log`,
  `logic-211.log`, `determinism-211.log` and `lint-211-final.log`.

The new browser gate uses the shared `REALM_BROWSER` helper. WebKit requires
`PLAYWRIGHT_BROWSERS_PATH=/private/tmp/realm-webkit-210 REALM_BROWSER=webkit`;
use `REALM_PORT=8942` for the shared preview. Founder uses
`FOUNDER_BROWSER=webkit`. The preview server is left running.

## Remaining work

The light is better registered, but the older citizens, repeated houses and
generic construction scaffolding still limit the scene. The construction poles
still sway cosmetically and do not closely follow the painted building volume.
Overall scene exposure and the existing global day/night curve also need a
broader lighting pass; this change only makes the window fade continuous.
The next substantial art target should be the older citizen families, whose
proportions and materials remain conspicuous beside the revised Founder.

Native Safari UI review is still pending. A fresh `cua.getState()` attempt on
September 6 reported the Mac locked and automatic unlock unavailable. The
existing manual-unlock request remains unanswered; no repeat request was sent.
WebKit results are engine coverage, not a native Safari or full-town performance
claim. Module revision **198**, save shape **7**, simulation **11** are unchanged.
All changes are local and uncommitted. The original in-app game was not reloaded.
