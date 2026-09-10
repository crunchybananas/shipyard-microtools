# Round 205 — continuous landscape and released arrivals

September 5, 2026. Local working checkpoint; not committed or published.

The owner expanded the ongoing goal to every pixel approaching AAA quality,
with less cartoonish characters, a world that does not read as repeated stamps,
and reliable citizen traffic as buildings appear. This round establishes an
environment and movement foundation. It does not complete that broader goal.

## What changed

`js/landscape.js` renders a continuous world-space WebGL2 surface beneath the
Canvas scene. A 25,600-byte map texture carries terrain, discovery, wear, and
building footprints. Domain-warped earth and vegetation patches, fine surface
variation, relief lighting, dampness, coherent water, shoreline foam, and
seasonal snow replace the repeating ground bitmap. Wear and worksite soil blend
across tile boundaries. Camera movement leaves the texture attached to the
world. Unknown resources cannot tint the visible side of the fog boundary.

The surface caps backing density at 1.5, updates its map texture only when data
changes, and reuses paused frames. Context loss activates the existing Canvas
terrain fallback; restoration rebuilds the WebGL surface. This is a hybrid
renderer, with buildings and actors still drawn by Canvas. It adds no Three.js
or GLB download to the game.

Trees, stone, iron, and mountain props now share depth sorting with buildings
and people. Stable coordinate hashes vary species, stature, and root position.
Contact shadows remain in the ground pass, and occupied building cells suppress
their former natural prop. This reuses the existing nature source atlas;
new authored vegetation and geology are still needed for the full art goal.

Removed overlapping tile-water effects, permanent all-pairs festival lanterns,
the incorrect constant-duration green production rings, the screen-space sun
orb and lens ghosts, the heavy black map vignette, and the pause dimming layer.
Post-processing preserves diffuse midtones and uses much quieter grain. The
minimap follows the measured build-bar height and shrinks on phones, clearing
building and Cancel controls.

## Traffic cause and evidence

After a route completed or was cancelled, idle/find-job citizens could retain
an old `tx/ty`. The generic pathless movement branch chased that exact tile
center and skipped the activity timer and state machine. Several arrivals
therefore pulled back toward each other instead of taking new work. Completed
routes now accept the actual arrival position; only explicit open raid flight
uses pathless movement.

A proposed hard exclusion for actors with right of way was tested and rejected:
it deadlocked the larger crossing fixtures. The collision/separation model is
unchanged. The accepted fix addresses movement intent.

`inspect-growing-settlement.mjs` starts at exact tick zero and places twenty
buildings beside the Founder stockpile through real commands, one every 180
ticks. Construction, staffing, food, delivery, population growth, and routes run
normally. Resources and researched technology are fixture inputs; random events
and raids are disabled. The before control serves the previous citizen module
only to an isolated browser, without replacing live source files.

| Eight-day controlled run | Previous movement | Arrival correction |
| --- | ---: | ---: |
| Longest measured stall | 449 ticks | 124 ticks |
| All 21 buildings complete, sampled every 600 ticks | 8,400 | 5,400 |
| Food at tick 28,800 | 66 | 116 |
| Population at tick 28,800 | 26 | 24 |

A stall means the same active waypoint/goal while remaining within 0.4 tile of
the tracked position. The metric includes waiting; it is not a proof that every
possible town is jam-free. The previous run records a 419-tick episode around
Zev Ridge and other arrivals. No episode crossed the recording threshold in the
corrected run. The strict tick-zero corrected run was repeated when moving to
simulation 11 and produced the same reported marks.

The permanent citizen-congestion gate now reproduces completed and cancelled
arrival targets, proves their timers advance and new farm assignments are
available on tick two, and preserves explicit raid flight. The existing twenty
diners, twenty bidirectional routes, dynamic obstacles, approach queues, and
save-continuation cases also pass. The separate development crossroads probe
clears all 4/12/24-person cases on one- and three-tile crossings.

## Simulation baseline and saves

Runtime module revision remains canonical `198`; save shape remains `7`.
Simulation is now `11`, with a new reviewed golden rather than overwriting the
simulation-10 fixture. The 43,200-tick scenario preserves terrain, population,
accepted commands, and completed building set. At the midpoint, food changes
108→111, gold 534→536, iron 50→60, stone 451→467, wheat 32→44, and wood stays 373.
Final raid damage shifts from storehouse/granary 80/70 HP to 75/75 HP. Repeated
fresh processes agree exactly, including hostile shell-particle controls.

Realm's existing strict simulation-version policy rejects simulation-10 saves.
No migration or save-envelope rewrite was added. The original in-app game tab
was not reloaded or replaced during this round. The Safari visual review used
a separate `localhost` origin. New games use the corrected simulation.

## Validation

- All 68 affected checks from `deterministic-core purity` through `browser
  logic` pass. The older road fixture was corrected to draw a real citizen and
  the authored Founder, check both above roads, and retain citizen pixel-tier
  assertions. The initial 53 checks and final 15 checks are in separate logs.
- Logic: 87/87. Independent save producer/consumer, physical production,
  construction, raid shelters, mixed traffic, ownership, and mobile build
  interactions pass.
- The new `verify-landscape-browser.mjs` checks actual pixel registration under
  a pan (zero mean channel error), different neighboring ground pixels, wear,
  seasons, concealed resource types including boundary neighbors, water motion,
  pause reuse, density bounds, context loss/restoration, eight actual scenery
  crossings, phone touch, minimap clearance, and visible Canvas fallback.
- Native Safari rendered the continuous surface and varied/depth-sorted scene.
  This was a visual check, not an automated Safari behavior/performance suite.
  Chrome supplies the automated browser evidence. Review images cover opening,
  grown settlement, close zoom, dusk, and a phone.
- Graphics checks and responsive/startup checks were rerun after the minimap
  correction. Runtime graph/purity and whitespace checks cover final source.
- Founder gameplay passes all eight checks on the final renderer: eight-view
  movement, accepted-command gestures, interruption, pause, atlas bounds,
  Save/Continue, house depth, and phone ground taps. Repository-root
  `pnpm realm:lint` also passes.

Evidence lives in `tmp/graphics-world/`: `growth-control-205/`, `growth-205/`,
`landscape-gate/`, `surface-205/`, `simulation-11-review.log`,
`realm-205-verification.log`, and `realm-205-verification-tail.log`.
Render-profile timings are CPU submission measurements; they do not establish
a device GPU frame budget.

## Continue the same goal

1. Rework Founder anatomy in the editable Blender source: especially head/body
   proportions, garment silhouette, and restrained material response. Rebuild
   every action and direction, preserving the corrected shoulder and toes.
2. Drive live citizen walking by actual displacement and remove additional
   renderer bob where the authored sprite already supplies it. Preserve work,
   carry, direction changes, pause, and source-to-runtime proof; update test
   fixtures to exercise real motion rather than a stale movement timestamp.
3. Author building state/identity variation and coherent construction, walls,
   roads, geology, trees, and ground contact. More source detail should remain
   legible at settlement scale; changing texture frequency alone is insufficient.
4. Simplify the phone HUD and notifications, review native Safari interactions,
   and measure a realistic sustained GPU/crowd budget on both target browsers.
5. Repeat growing-town traffic runs with other seeds, narrow streets, demolitions,
   large populations, and active raids. The whole-game goal stays active.
