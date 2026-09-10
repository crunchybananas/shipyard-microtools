# Round 212 — Adult citizens and authored work

September 6–10, 2026. Local, uncommitted work within the continuing goal of
refining every pixel of the actual game toward AAA quality. This pass does
not complete that goal.

## Character and game integration

The earlier builder/settler rows could pass their structural checks while
still reading as broad, flat toy figures. This pass authors an adult
craftsperson in a separate saved Blender scene and gives it a complete
eight-direction walk, rest, hammer and carry family. Opening settlers use it
too: their temporary construction assignments do not change their profession
to builder, so a builder-only art replacement missed the opening game.

The 1.820 m body has a 0.272 m head and 0.786 m leg chain. Fitted linen,
rolled cuffs, a waistcoat and split leather apron replace the old silhouette.
Continuous sleeves, forearms and wrists replace intersecting limb pieces;
smaller eyes, a sculpted continuous face and restrained hair/stubble pigment
reduce the cartoon proportions. Source reviews corrected wrist gaps,
exaggerated wrist folds, overlapping caps, spherical cheeks and bulky boots.
The original Founder scene remains independent.

The mallet follows the striking hand through ready, backswing, contact,
rebound and recovery poses. Both hands grip the cargo crate. Carry uses the
same ankle trajectory as walk; rest and hammer keep both feet planted. All
four actions use 24 frames in each of eight directions: **768 authored poses**,
baked into **1,536 cells** at two resolutions. Stable normal/roughness materials,
soft self-shadows and muted pigments share the Founder's settlement profile.
The ordinary game loads PNGs only; its new NPCs do not add a live 3D scene.

`source/builder.blend` is the editable authority. Its export includes
independent Blender joint witnesses; the manifest hashes source dependencies
and 52 generated outputs. The normal rebuild reads the saved scene and never
reruns the bootstrap authoring script. An isolated clean rebuild reproduces
**all 52 outputs exactly**. See
[`../../../assets/sprites/citizens/builder/README.md`](../../../assets/sprites/citizens/builder/README.md).

`builder-presentation.js` belongs to SHELL. It switches families only when all
four small action maps are ready, so slow or failed images cannot mix bodies
between actions. A shared cache retains at most twelve detailed direction
rows, with two loads in flight. Recently visible rows stay resident; excess
facings use the small maps instead of repeatedly decoding. Retained decoded
image references total at most **39.375 MiB**. This is not a browser-process or
GPU peak-memory claim, and no full-town frame-rate claim is made.

Walk/carry uses the existing accepted-displacement clock. Paused or blocked
citizens keep their feet still; rest/hammer follows presentation time.
Foraging/eating use rest rather than an unrelated hammer animation. Baked
cargo suppresses the old extra attachment. Other professions and explicit
legacy Sprite Lab previews remain independent. The new family and Founder
now use the bake's physical ground origin `(0.5, 0.86)`; the previous `.90`
runtime anchor confused the camera origin with the forward toe. Citizen
contact shadows now share the Founder's softer footprint. Pathless moving
citizens use their actual facing before considering a stale target.

## Defects found during actual play

The selected citizen panel exposed internal activity reasons and could meet
the phone build dock. It now shows the player's work/needs information, clears
the measured dock height and has a larger phone close target. Screenshots wait
for the panel's opacity transition to finish rather than recording its faded
intermediate state.

Native Safari and phone review also exposed the fixed **All demos** link
covering wood and stone. The title-screen link remains in place; the game link
now participates in the scrolling header layout. The four starting resources
pass actual hit-visibility checks on desktop and phone.

The more serious native defect was Retina picking: input multiplied browser
coordinates by device pixel ratio, although camera coordinates use logical
pixels. Clicking off-center citizens or buildings missed their visible
sprites. Both hit tests now share the correct logical coordinate conversion.
The new regression clicks **actual canvas draw destinations**, including three
ordinary opening citizens and the storehouse at two zooms and DPR 1/2. It
failed before the fix at DPR 2/zoom 1.3 and passes all **16 targets per engine**
afterward. The old phone test's target formula was corrected as well.

On September 10, an isolated native Safari private window successfully ran
house placement, citizen approach/construction, completion, growth to four
residents and sleeping inside the completed house. Later checks confirmed
the exposed resource counters, selected citizen work panel, off-center Thea
Ash and storehouse selection. Safari initially retained the old local input
module after an ordinary reload; **Reload Page From Origin** loaded the fix.
These observations are separate from automated Playwright WebKit coverage.
The existing personal Safari window and original in-app game were not used
for these fixtures.

## Verification and exact limits

- Source gate: installed **Chrome 152.0.7977.83** and **Playwright WebKit 26.4**
  pass all 1,536 nonblank, unclipped cells and all 32 exact detail strips.
  Every row contains at least 20 distinct sampled frames. Saved/exported
  landmark agreement is within 0.000002 m; standing-foot drift is below
  0.0000005 m. Maximum reviewed wrist bends are 42.63° for work and 47.23°
  for carry. Planted toe orientation matches the grounded source gait.
- Game gate in both engines: all eight headings, actual house construction
  completed at tick **470**, rest during eating, held traffic/cargo/pause,
  unchanged serialized saves during rendering, atomic delayed/failed maps,
  bounded crowd cache and real 390px touch selection. All 32 detailed facings
  are exercised; warm crowd rendering makes **zero additional row requests**.
- The 80 rendered Founder/citizen scale comparisons pass. Their body-only
  measurement excludes contact shadows and permits one physical raster pixel
  of rounding; it does not rescale either character to force a pass.
- The 7,200-tick growing-town run completes all **21 buildings** by tick
  5,400 and reaches **14 residents**. The longest measured wait for another
  0.4 tile of progress toward an unchanged waypoint is **57 ticks**. Across
  1,200 renders, **4,787 continuously stationary observations have zero gait
  phase changes**. This is evidence of motion holding, not universal collision
  freedom or a stress-performance benchmark.
- That fixture's saved simulation matches the before run byte for byte:
  **166,108 bytes**, SHA-256
  `6b2904372f377b7e0de624e7fc8d25e417f33462b42ceea1d264254c6e091d9f`.
  Later corrections affect only drawing, input coordinates, CSS and tests.
- Dense traffic completes **24/24 routes**, with two ticks of maximum exact
  no-progress, minimum center spacing 0.310008447 and no blocked-building
  penetration. It still records 3,262 brief close-contact pair-ticks. We do
  not claim strict non-overlap.
- All **68** canonical checks from deterministic-core purity through browser
  logic passed across three sequential resumptions. Two initial failures
  counted only legacy actor image URLs; the gates now recognize the actual
  new-family draws. The road gate checks each draw's real source cell and
  smoothing, not an unrelated legacy-atlas data attribute. Browser logic is
  **87/87**. After the late Retina correction, all **24** checks from shell
  isolation through browser logic pass across two sequential runs. The
  lifecycle gate initially required the removed internal activity reason;
  it now checks the same immutable identity/vocation, the readable Idle state
  and absence of the internal reason. Actor removal, selection ownership and
  continuation assertions remain intact.
- Final ground-contact, citizen locomotion and building-lighting checks pass:
  77 contact cases, 36 production light registrations, correct actor depth,
  stable caches and zero warm readbacks. The Founder gameplay regression
  retains its eight action/depth/loading/save/touch checks.
- Lint, syntax, whitespace and runtime module verification pass. All **86/86**
  runtime files remain reachable through **369** canonical internal edges.

The temporary WebKit browser from September 6 lost its launcher under `/tmp`;
the official matching runtime was restored under `/private/tmp/realm-webkit-212`.
One subsequent Founder command used `REALM_BROWSER`, while that older gate
expects `FOUNDER_BROWSER`; the correctly selected rerun is recorded separately.
Neither infrastructure error is described as a passing browser check.
The final native private-window close was attempted, but subsequent native
accessibility reads timed out. Closure was not independently confirmed; do not
reuse that stale native window handle for a later review.

Evidence lives under `tmp/graphics-world/`: `builder-source-gate{,-webkit}`,
`builder-game-gate{,-webkit}`, `retina-picking-212{,-webkit}`,
`builder-212-{before,after}`, `builder-clean-rebuild-212.json`, and the
`builder-*-212*.log` files. Close source reviews live under
`tmp/citizen-sprites/builder-212/review-final/`. These are local QA artifacts.

## Next substantial work

Construction still uses generic partial-building/scaffold presentation, and
its placement notification says "built" before completion. House variants,
older profession bodies, animals, repeated architecture and the overall night
curve remain below the target. Action-entry/exit animation, unique identities,
resource-specific cargo and useful eating/foraging poses are unfinished.
Desktop panels and hover/selection labels also need a coherent visual pass.
Several older HUD resource glyphs appear semantically mismatched to their
counters and deserve a source-atlas review.
The new craftsperson is an editable foundation, not final AAA art.

Continue with authored construction phases and their worker/ground contact,
then integrate further identities and profession actions into the real growing
settlement. Keep source-level review and player-loop evidence together. CORE
remains simulation **11**, save shape **7**, runtime revision **198**; no commit
or deployment is part of this pass.
