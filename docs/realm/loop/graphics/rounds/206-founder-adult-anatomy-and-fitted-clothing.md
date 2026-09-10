# Round 206 — Founder anatomy and fitted clothing

The owner expanded the graphics goal to refining every pixel toward AAA quality,
with less cartoonish characters and a coherent, playable settlement. This round
improves one source character. The broader graphics and citizen-traffic goal
remains active.

## Result

The editable Founder now has longer legs, a slimmer torso and boots, a smaller
head and hands, and a relaxed standing pose. The head occupies 17.9% of the
neutral model height, compared with 46.7% in the original KayKit source. The
leg chain is 0.786 units in a 1.825-unit body. This remains a stylized character;
facial anatomy and glove articulation can be developed further.

The source mesh and bind joints were reshaped together. New continuous sleeves
replace the old shoulder surfaces, with weights blended around the elbow. The
costume adds leather cuffs, sleeve seams, a survey strap fitted to the actual
tunic surface, and a bronze cloak clasp. The cloak is shorter and opens behind
the legs. Linen wraps have their own surface response, separate from skin.
Muted cloth, brown leather and brass replace the bright original palette.

All four saved actions were retargeted. The hand rests beside the body at the
shared ready pose; pointing retains a soft elbow. The original ankle paths
remain unchanged. Shortening the boot changes its diagonal rest axis, so the
sole rotation is retargeted as a delta from the old rest pose. Copying the old
absolute bone rotation was caught in staging and corrected before promotion.

The game uses the new source through the existing Canvas2D sprite adapter. Its
cell height is now 44px, recalibrated for the body's smaller share of the atlas
cell. The rendered Founder remains about 30.4px high beside a 31.9px settler.
The source atlas dimensions, action timing, eight facings and bounded direction
strip cache remain the same. No new simulation revision is needed for this
asset and presentation pass.

## Source and rebuild

- Authoritative source: `assets/sprites/founder/founder-actions.blend`.
- Preserved prior source: `founder-actions-before-anatomy.blend` in that folder.
- One-time authoring: `scripts/founder-sprites/refine_anatomy.py`; it refuses an
  already reshaped rig and stages its result under `tmp/` by default.
- Staged browser review: `scripts/founder-sprites/review-anatomy.mjs`.
- Routine rebuild: `node scripts/founder-sprites/rebuild-from-blender.mjs`.
  This reads the saved scene without reapplying the anatomical authoring.
- `export_blender.py` now accepts separate output/witness paths for staging and
  records independent rest-geometry measurements alongside the joint samples.
- All PNG tiers, runtime direction strips, combined GLBs and animated proofs
  were rebuilt. The manifest records `adult-traveler-v1` and `settlement-v2`.

The first staging render had an oversized torso and cloak after reducing the
head. It was rejected. Subsequent review exposed the jagged original shoulder
surfaces, leading to the sleeve rebuild. Review images are retained under
`tmp/founder-sprites/anatomy-206/review`, `review-2`, and `review-3`.

## Verification

Installed Chrome 152.0.7977.76 passes:

- All **4,032** nonblank, unclipped action cells; all **64** runtime direction
  strips match the decoded atlas RGBA exactly.
- Every source joint agrees with its Blender witness within **1.22e-6** units.
  Standing feet drift less than **4.82e-7** units. The planted ankle-to-toe drop
  remains **0.119247**, and the toe sole stays level.
- Pointing wrist deviation is at most **1.68°**; shoulder-to-wrist extension
  stays below **92.04%** of arm length. The four loops close and the three
  standing actions share their ready pose.
- All **576** walk cells are distinct, with fixed leg lengths and maximum
  stance error **5.06e-7**. Scrubbing, turning, grounded stops, source preview,
  mobile layout and reduced-motion behavior pass.
- **80** real Founder/settler comparisons across eight facings, five zooms and
  1x/2x display density pass the stature, width and ground-baseline bounds.
- **8** game integration checks cover real movement and collision commands,
  construction/rally gestures, interruption, pause, save/continue, house depth,
  maximum-resolution cache bounds, and phone touch movement.
- **9** live-scene checks cover actual relighting, normal/roughness response,
  visible wireframe changes and restoration, all named poses and facings,
  resolution caps, atlas eviction, context loss/recovery and phone controls.
  The reviewed scene reports **11,725 triangles / 110 draws**; the Founder
  itself has **5,861 triangles**. This is not a settlement GPU benchmark.
- Landscape validation passes world-space stability, nonrepetition, fog,
  seasons, water, density bounds, context recovery, all eight Founder/scenery
  crossings, phone touch and Canvas fallback. Road ordering passes as well.
- Repository-root `pnpm realm:lint`, touched-script syntax checks and
  `git diff --check` pass.

Two test assumptions were corrected without weakening the intended behavior.
The gameplay fixture now waits for the founding camera move before assigning
its maximum zoom; the smaller assets exposed the timing race. The wireframe
check counts visibly changed pixels and requires restoring the original image,
so a slimmer character is not penalized by a whole-courtyard mean difference.
The walking gate now reads the current action witness, replacing a historical
witness tied to the preserved walking prototype.

Logs: `tmp/founder-sprites/anatomy-206/*-gate.log` and `rebuild.log`.
Detailed reports: `tmp/founder-sprites/{actions-validation,validation,
scale-validation,game-validation-chrome,detail-validation}.json`.
Visual proofs: `assets/sprites/founder/{eight-directions,founder-actions}.gif`,
`tmp/founder-sprites/scale-comparison.png`, and the game/workshop screenshots.
The grown-settlement review is under `tmp/graphics-world/founder-206/`.

## Remaining work and live-state limits

Native Safari visual review could not run because the computer-use tool
reported a locked Mac. The owner was asked to unlock it; this round does not
claim fresh Safari verification. The original in-app game was left intact.
Its earlier simulation-10 development save is still subject to the existing
strict save policy; current simulation is **11**, save shape **7**, module
revision **198**. Browser verification used independent current-version games.

Changes are local and uncommitted. The overall AAA target is unfinished.
Citizen gait should follow actual displacement through crowd delays, and the
remaining citizen families need consistent anatomy/materials. Architecture,
vegetation variation, ground detail, road materials, effects and full-town GPU
budgets still need work. The settlement screenshots also expose a floating dark
construction progress bar and rough placeholder construction art; address those
with the architecture pass. Source foot contact is precise; the compressed game's
1.6-tile presentation stride still carries the previously documented physical
foot-slip limitation at the existing travel speed.
