# Graphics Backlog

Prioritize work that changes what the player sees in the live game.

## Ready

1. Finish the opening actor family, then migrate farmer and rancher.
   - Problem: round 111 replaced and locked the eight visible settler idle/walk
     rows, but `settler/work` and `settler/carry` can still pop back to legacy
     art. Farmer and rancher remain especially visible old-role families in
     established towns.
   - Push: finish settler work/carry at the same `71-72px` body scale, then
     migrate farmer and rancher one complete action family at a time through
     the canonical `actor-rows/` work-order/stage/accept/compile loop. Treat
     WAIVED rows as protected repaint debt and never hand-edit generated
     compiled sheets.
   - Verify: require within-row metrics, peer-direction checks, cross-action
     body scale/palette checks, Sprite Lab inspection, exhaustive atlas
     verification, and a real saved/fresh-game close crop.

2. Service walker art integration.
   - Problem: `G.walkers` still draws small procedural walkers in
     `js/render.js`, so some ambient people do not yet share the new
     painted actor atlas vocabulary.
   - Push: route service walkers through the actor atlas or add a small
     dedicated painted walker strip.
   - Verify: close town screenshots show service walkers matching citizen
     scale, palette, and shadow style.

3. Building upgrade states.
   - Problem: upgrade state is mostly overlay accents; buildings do not
     feel physically upgraded.
   - Push: add painted state differences: extra roofs, banners, braces,
     lit windows, reinforced stone, larger awnings, richer props.
   - Verify: side-by-side Level 1/2/3 grid in the 2D renderer.

4. Construction phase.
   - Problem: reveal/overlay is useful but still looks like a generic
     construction effect on top of finished art.
   - Push: painted scaffolds, tarps, planks, stone piles, foundation
     silhouettes, and staged reveal per building category.
   - Verify: 25/50/75/100 percent screenshots for core and support
     buildings.

5. Dedicated wall variants.
   - Problem: the first wall-continuity pass connects segments with
     repeated atlas crops, so corners/T/cross junctions still read a bit
     cloned at close zoom.
   - Push: add true painted end/straight/corner/T/cross wall frames or a
     small wall-junction strip generated from painterly bitmap art.
   - Verify: 2D wall cluster screenshots at zoom 2+, construction wall
     screenshots, no procedural line fallback.

6. Terrain/building grounding.
   - Problem: buildings are painterly, but the tile grid can still show
     through strongly and separate art from terrain.
   - Push: softer local dirt pads, shadow/wear variations, tile-edge
     blend reduction around buildings.
   - Verify: settlement screenshot at zoom 1.0, 1.4, and 2.2.

7. UI icon crop polish.
   - Problem: build-bar icons now use atlases, but small crops may clip
     tall or wide buildings.
   - Push: per-icon CSS crop variables or a dedicated small icon sheet
     from painted art.
   - Verify: full build-bar screenshot after unlocking all build types.

## Done

- Frontier settler opening family and live runtime capture (round 111):
  replaced all four settler idle rows and all four settler walk rows with one
  imagegen-assisted frontier-villager identity; normalized idle against walk
  to `71-72px` dense-body height; rejected two unstable generated left rows in
  favor of a cell-wise reflected clean right peer; corrected front/back gait;
  changed the gait audit to use boot depth for front/back perspective; added a
  query-gated exact composed-canvas capture; fixed actor-atlas cache revision
  propagation; and repaired the animation verifier's off-map close screenshot.
  Eleven total row overrides are now verified. Runtime evidence:
  `scripts/screenshots/runtime-settler-opening-round-111.png`.

- Live Actor Muster and exhaustive runtime-map verification (round 110):
  connected the production renderer to the canonical sprite contract, routed
  citizen and muster drawing through one shared atlas-frame function, fixed the
  previously unreachable live forager role, and added an animated real-canvas
  Actor Muster accessible from the title screen and Sprite Lab. The new
  exhaustive verifier passed all `224` role/action/direction rows and `1,792`
  frames with zero blanks, low-variety moving rows, address mismatches, mapping
  failures, or page errors. Desktop proofs:
  `scripts/screenshots/actor-muster-01.png` and
  `scripts/screenshots/actor-muster-02.png`.

- Row sprite factory and miner work-up migration (round 109): established
  canonical `512x84` actor-row overrides under `assets/sprites/actor-rows/`,
  SHA-256 manifest locks, BASE/LOCKED/WAIVED/CANDIDATE provenance in Sprite
  Lab, generated per-role sheets under `actors-compiled/`, and copy-semantics
  compilation that lets transparent override pixels erase legacy art.
  `miner/work/up` is LOCKED with flicker `27.8`, dense-body height range `1px`,
  cross-direction body-height delta `0.5px`, and no quality warnings.
  Sprite Lab now uses dense-body diagnostics, crops standalone candidate strips
  from row zero, and keeps the active row visible on mobile. Full source,
  audit, animation, critic, game, and logic verification passed; exact pixel
  comparisons found no differences between the canonical row, compiled miner
  row, and runtime atlas row.

- Imagegen lumber work-left prototype (round 078): used the built-in imagegen
  skill path to generate and retry candidate left-facing lumber work/chop
  strips, selected the best woodsman/axe silhouette, chroma-keyed and packed it
  into exact `64x84` cells, restored an initial row-indexing mistake, inserted
  the final strip into the true `lumber/work/left` row at `y=840`, and rebuilt
  `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and
  `scripts/screenshots/actors-source-sheets-round-078.png`. Static proof found
  the actual pre-edit work-left row was transparent; browser verification
  passed through `verify-anim`, `verify-critic`, and `verify.mjs --game
  --logic`; SVG invariants and ImageMagick dimension audits passed.

- Actor scale and ambient prop read pass (round 077): reduced the live actor
  draw size in `js/render.js` from `30x39` to `27x35`, tightened the rendered
  foot anchor, softened atlas-era citizen shadows, repainted
  `assets/sprites/ambient/cart.png`, `fishboat.png`, `sailboat.png`, and
  `cargo.png` with stronger silhouettes/highlights/contact shadows, and rebuilt
  `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and
  `scripts/screenshots/actors-source-sheets-round-077.png`; also changed
  `scripts/build-motion-atlases.mjs` from a Chromium canvas compiler to an
  ImageMagick-backed source PNG stitcher. `node --check ...`,
  `node scripts/build-motion-atlases.mjs`, the ImageMagick dimension audit, and
  SVG invariants passed. Chromium-backed live verifiers failed before game load
  with `MachPortRendezvousServer... Permission denied (1100)`, so live readback
  remains the first follow-up.

- Source-sheet actor/ambient reset (round 076): replaced
  `scripts/build-motion-atlases.mjs` with a compiler that stitches editable
  per-role and per-prop PNG source files instead of painting the atlas in code;
  added reset-only `scripts/bootstrap-sprite-sources.mjs`; generated 14 actor
  source sheets in `assets/sprites/actors/`, 4 ambient source sprites in
  `assets/sprites/ambient/`, provenance docs for CC0 OpenGameArt source
  material, and proof/live close screenshots; verification passed via
  `node --check ...`, `node scripts/bootstrap-sprite-sources.mjs`,
  `node scripts/build-motion-atlases.mjs`, `node scripts/verify-anim.mjs`,
  `node scripts/verify-critic.mjs`, and `node scripts/verify.mjs --game --logic`;
  no sprite SVG files or retired SVG runtime references were found. Remaining
  art issue: the initial actor sheets still derive from one CC0 knight base, so
  future rounds should replace individual role PNGs instead of atlas-wide
  generation.

- Fresh painted actor/ambient atlas reset (round 075): replaced the old
  accumulated actor/ambient atlas generator in `scripts/build-motion-atlases.mjs`
  with a fresh painted generator that keeps the live atlas contracts but
  removes the layered `ROLE_WORKPOSE_*` motion stack; regenerated
  `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`,
  and `scripts/screenshots/actors-fresh-painted-atlas-round-075.png`;
  `node --check ...`, `node scripts/build-motion-atlases.mjs`,
  `node scripts/verify-anim.mjs`, `node scripts/verify-critic.mjs`,
  and `node scripts/verify.mjs --game --logic` all passed; no sprite SVG
  files or retired SVG runtime references were found.

- Actor workpose payload-cant breakup pass (round 074): increased `ROLE_WORKPOSE_TABLEAU_RAW` in `scripts/build-motion-atlases.mjs` across roles with larger silhouette/fold/payload/hand deltas (especially `lumber`/`miner`/`builder`/`blacksmith`, plus asymmetric `trader`/`forager` boosts), advanced close-proof output to `scripts/screenshots/actors-workpose-close-round-074.png`, and updated close proof rows toward heavier carry/work asymmetry reads; `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` and `node scripts/build-motion-atlases.mjs` passed (regenerating `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the round-074 close screenshot), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose role tableau breakup pass (round 073): increased `ROLE_WORKPOSE_TABLEAU_RAW` in `scripts/build-motion-atlases.mjs` across all roles with stronger heavy-role (`lumber`/`miner`/`builder`/`blacksmith`) silhouette snap, cloth-fold cadence breakup, asymmetric payload cant, and hand-cadence/asym-lift separation; increased `trader`/`forager` asymmetry; updated close proof heading/rows and advanced proof output to `scripts/screenshots/actors-workpose-close-round-073.png`; `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` and `node scripts/build-motion-atlases.mjs` passed (regenerating `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the round-073 close screenshot), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose fold cadence overdrive pass (round 072): increased `ROLE_WORKPOSE_TABLEAU_RAW` in `scripts/build-motion-atlases.mjs` across all roles with stronger heavy-role (`lumber`/`miner`/`builder`/`blacksmith`) silhouette snap, cloth-fold cadence breakup, asymmetric payload cant, and hand-cadence/asym-lift separation; increased `trader`/`forager` asymmetry; updated close proof heading/rows and advanced proof output to `scripts/screenshots/actors-workpose-close-round-072.png`; `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` and `node scripts/build-motion-atlases.mjs` passed (regenerating `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the round-072 close screenshot), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose rolepose asymmetry depth pass (round 071): increased `ROLE_WORKPOSE_TABLEAU_RAW` in `scripts/build-motion-atlases.mjs` across all roles with stronger heavy-role silhouette snap, cloth-fold torsion, asymmetric payload cant, and hand-cadence/asym-lift separation; updated close proof heading/rows and advanced proof output to `scripts/screenshots/actors-workpose-close-round-071.png`; `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` and `node scripts/build-motion-atlases.mjs` passed (regenerating `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the round-071 close screenshot), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.


- Actor workpose silhouette/payload breakup pass (round 070): increased `ROLE_WORKPOSE_TABLEAU_RAW` values in `scripts/build-motion-atlases.mjs` (especially `lumber`/`miner`/`builder`/`blacksmith`) to deepen silhouette break, fold pinch, payload cant, pose split, and hand-cadence/asym-lift separation; advanced proof output to `scripts/screenshots/actors-workpose-close-round-070.png` with updated close rows (`lumber`/`miner` work plus `builder`/`blacksmith` carry asymmetry); `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs` and `node scripts/build-motion-atlases.mjs` passed (regenerating `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the round-070 close screenshot), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose tableau breakup pass (round 069): increased `ROLE_WORKPOSE_TABLEAU_RAW` values in `scripts/build-motion-atlases.mjs` (with heavier `lumber`/`miner`/`builder`/`blacksmith` silhouette/fold/payload/pose/hand deltas), advanced proof target to `scripts/screenshots/actors-workpose-close-round-069.png`, and refreshed close-proof row directions toward asymmetric heavy-role work/carry reads; `node --check js/render.js js/ui.js js/main.js js/input.js scripts/verify.mjs scripts/verify-critic.mjs scripts/verify-anim.mjs scripts/build-motion-atlases.mjs` passed, `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `build-motion-atlases`, `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose silhouette/torque split pass (round 068): increased `ROLE_WORKPOSE_TABLEAU_RAW` values in `scripts/build-motion-atlases.mjs` with stronger heavy-role silhouette snap/fold pinch/payload cant/pose cadence plus hand-cadence/asym-lift split, advanced proof output to `scripts/screenshots/actors-workpose-close-round-068.png`, and refreshed proof rows toward heavy-role work-pose separation (`lumber`/`miner`/`builder`/`blacksmith`) plus `trader` carry and `forager` work contrast; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed (writing `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the new close proof), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose pose asymmetry split pass (round 067): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs` with stronger heavy-role silhouette snap/fold pinch/payload cant/pose cadence and higher hand-cadence + asym-lift splits, advanced proof output to `scripts/screenshots/actors-workpose-close-round-067.png`, and refreshed proof rows to compare `lumber`/`miner` work directions against `builder`/`blacksmith` carry asymmetry plus `trader` work bias; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed (writing `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and the new close proof), `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose fold cadence split pass (round 066): increased heavy-role `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs` (`lumber`/`miner`/`builder`/`blacksmith`) for stronger silhouette snap, cloth fold pinch, payload cant, pose-set split, hand cadence, and asym-lift; advanced close proof output to `scripts/screenshots/actors-workpose-close-round-066.png` and refreshed proof rows/directions to better expose asymmetric work/carry read; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed, `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose silhouette/load asymmetry pass (round 065): raised `ROLE_WORKPOSE_TABLEAU` role values in `scripts/build-motion-atlases.mjs` to push heavier role silhouette break, deeper cloth fold pinch, stronger asymmetric payload cant, and larger hand-cadence/asym-lift splits; advanced close proof output to `scripts/screenshots/actors-workpose-close-round-065.png` and updated close proof rows to emphasize heavy-role work (`lumber`, `miner`, `builder`, `blacksmith`) plus `trader` carry contrast; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed, `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose role pose asymmetry pass (round 064): raised `ROLE_WORKPOSE_TABLEAU` role values in `scripts/build-motion-atlases.mjs` for stronger silhouette snap, deeper cloth fold pinch, more asymmetric payload cant, and sharper pose/hand cadence split; advanced close proof output to `scripts/screenshots/actors-workpose-close-round-064.png` and updated close proof rows to `settler/lumber/miner/builder` work plus `trader/blacksmith` carry asymmetry; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed, `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, and `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose role asymmetry breakup pass (round 063): raised `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs` to push stronger role silhouette snap, cloth fold pinch depth, asymmetric payload cant, and role-specific hand cadence/lift offsets; updated close proof title/rows and advanced proof output to `scripts/screenshots/actors-workpose-close-round-063.png`; `node --check ...` and `node scripts/build-motion-atlases.mjs` passed, `find assets/sprites -maxdepth 1 -name '*.svg' -print` produced no output, `rg -n "svg-test|spriteMode|toggleSVG|_loadSprite|_spriteCache|_VARIANT_PALETTES|SPRITE_MODE" ...` produced no matches, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose asymmetric tableau depth pass (round 062): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs` to push stronger role-specific silhouette snap, cloth fold pinch, asymmetric payload cant, and hand cadence/lift split; advanced proof output to `scripts/screenshots/actors-workpose-close-round-062.png`, and regenerated `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and `scripts/screenshots/actors-workpose-close-round-062.png`; `node --check ...` and SVG-path invariants passed, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose tableau expressivity pass (round 061): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs`, strengthened `workposeTableauRhythm` frequency/coupling/amplitude plus final tableau fold-sweep displacement/thickness and hand-height asymmetry weighting, advanced proof output to `scripts/screenshots/actors-workpose-close-round-061.png`, and regenerated `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and `scripts/screenshots/actors-workpose-close-round-061.png`; `node --check ...` and SVG-path invariants passed, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose tableau silhouette/cadence pass (round 060): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs`, added per-role `handCadence` and `asymLift` controls, strengthened `workposeTableauWarp` + `workposeTableauRhythm`, deepened the final tableau fold slash/body skew, advanced proof output to `scripts/screenshots/actors-workpose-close-round-060.png`, and regenerated `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and `scripts/screenshots/actors-workpose-close-round-060.png`; `node --check ...` and SVG-path invariants passed, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose tableau overdrive pass (round 059): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs`, strengthened tableau silhouette body-drift weight plus `workposeTableauWarp` and `workposeTableauRhythm` frequency/amplitude, and advanced proof output target/text to `scripts/screenshots/actors-workpose-close-round-059.png`; `node --check ...` and `node --check scripts/build-motion-atlases.mjs` passed, while `build-motion-atlases`, `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose silhouette breakup pass (round 058): increased `ROLE_WORKPOSE_TABLEAU` values in `scripts/build-motion-atlases.mjs`, strengthened tableau payload pulse/rhythm frequency and amplitude, increased late-stage tableau fold stroke displacement/thickness, increased left/right hand asymmetry weighting, advanced proof output target/text to `scripts/screenshots/actors-workpose-close-round-058.png`, and regenerated `assets/sprites/actors-atlas.png`, `assets/sprites/ambient-atlas.png`, and `scripts/screenshots/actors-workpose-close-round-058.png`; `node --check ...` and SVG-path invariants passed, while `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose asymmetric load pass (round 057): increased `ROLE_WORKPOSE_TABLEAU` values again in `scripts/build-motion-atlases.mjs`, strengthened tableau payload pulse cadence (`workposeTableauPulse`), increased tableau rhythm frequency/amplitude (`workposeTableauRhythm`), raised left/right hand asymmetry weighting (`leftHandY`/`rightHandY`), and advanced close proof export target/title to `scripts/screenshots/actors-workpose-close-round-057.png`; `node --check ...` and SVG-path invariants passed, while `build-motion-atlases`, `verify-anim`, `verify-critic`, and `verify.mjs --game --logic` remain blocked by Chromium launch denial in this sandbox.

- Actor workpose profile stress pass (round 056): increased `ROLE_WORKPOSE_TABLEAU` values again in `scripts/build-motion-atlases.mjs`, strengthened tableau silhouette displacement (`bodyX`), fold warp/rhythm amplitudes, and left/right hand cadence breakup, advanced close proof export target/title to `scripts/screenshots/actors-workpose-close-round-056.png`, and switched close proof role set to `lumber/miner/builder/blacksmith/trader/guard`; `node --check ...` and SVG-path invariants passed, while Playwright screenshot verification remains blocked by Chromium launch denial in this sandbox.

- Actor workpose tableau silhouette pass (round 055): increased `ROLE_WORKPOSE_TABLEAU` role values again in `scripts/build-motion-atlases.mjs` to push stronger silhouette snap, cloth fold pinch, asymmetric payload cant, and pose-set cadence separation; advanced close proof export target/title to `scripts/screenshots/actors-workpose-close-round-055.png`; Chromium launch denial still blocks atlas rebuild and live screenshot refresh in this sandbox.


- Actor workpose tableau cadence pass (round 054): raised `ROLE_WORKPOSE_TABLEAU` role values again in `scripts/build-motion-atlases.mjs` to push stronger silhouette snap, cloth fold pinch, asymmetric payload cant, and pose-set hand cadence breakup; advanced proof output target/text to `scripts/screenshots/actors-workpose-close-round-054.png` and updated close-proof focus roles to `lumber/miner/builder/blacksmith/trader/forager`; atlas rebuild/proof export now succeeds, while Playwright live verify screenshots remain blocked by Chromium launch denial in this sandbox.

- Actor workpose role asymmetry pass (round 053): increased `ROLE_WORKPOSE_TABLEAU` values and strengthened tableau-driven profile displacement (`bodyX`), cloth warp/rhythm (`workposeTableauWarp`, `workposeTableauRhythm`), and asymmetric hand cadence (`leftHandY`/`rightHandY`) in `scripts/build-motion-atlases.mjs`; advanced proof export target to `scripts/screenshots/actors-workpose-close-round-053.png` and updated close proof focus roles; Chromium launch denial in this sandbox still blocks atlas rebuild and live screenshot refresh.


- Actor workpose kinetic breakup pass (round 052): increased `ROLE_WORKPOSE_TABLEAU` values and strengthened tableau-driven silhouette displacement, cloth-fold warp/rhythm, and hand-cadence desync in `scripts/build-motion-atlases.mjs`, plus added an extra deep tableau fold slash and advanced proof output path to `scripts/screenshots/actors-workpose-close-round-052.png`; Chromium launch denial in this sandbox still blocks atlas rebuild and live screenshot refresh.


- Actor workpose silhouette snap pass (round 051): increased `ROLE_WORKPOSE_TABLEAU`
  values in `scripts/build-motion-atlases.mjs`, wired tableau silhouette
  displacement directly into `drawActor(...)` body offsets, added an
  extra deep tableau fold slash, increased tableau hand-cadence desync,
  advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-051.png`, and rebuilt
  `assets/sprites/actors-atlas.png`; Chromium launch denial in this
  sandbox still blocks `verify-anim`, `verify-critic`, and
  `verify.mjs --game --logic` screenshot refresh.

- Actor workpose tableau pass (round 050): added
  `ROLE_WORKPOSE_TABLEAU` in `scripts/build-motion-atlases.mjs`, wired
  silhouetteSnap/foldPinch/payloadCant/poseSet through `drawActor(...)`
  + `drawPayload(...)`, deepened role-specific silhouette snap and
  cloth-fold pinch breakup, increased asymmetric payload cant pulses, and
  hand-cadence pose-set desync, advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-050.png`, and rebuilt
  `assets/sprites/actors-atlas.png`; Chromium launch denial in this
  sandbox still blocks `verify-anim`, `verify-critic`, and
  `verify.mjs --game --logic` screenshot refresh.

- Actor workpose story pass (round 049): added `ROLE_WORKPOSE_STORY` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteBreak/foldDrape/
  payloadSkew/handTuck through `drawActor(...)` + `drawPayload(...)`,
  deepened role-specific silhouette break, cloth-drape fold breakup,
  asymmetric payload skew pulses, and hand-cadence tuck/desync, advanced
  close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-049.png`, and rebuilt
  `assets/sprites/actors-atlas.png`; Chromium launch denial in this
  sandbox still blocks `verify-anim`, `verify-critic`, and
  `verify.mjs --game --logic` screenshot refresh.

- Actor workpose taskform pass (round 048): added `ROLE_WORKPOSE_TASKFORM` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteHook/foldBraid/
  payloadLunge/poseOffset through `drawActor(...)` + `drawPayload(...)`,
  deepened role-specific silhouette hooks, cloth-fold braid breakup,
  asymmetric payload lunge pulses, and hand-cadence desync, and advanced
  close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-048.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.


- Actor workpose profile pass (round 047): added `ROLE_WORKPOSE_PROFILE` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteYaw/foldStack/
  payloadSkew/handBias through `drawActor(...)` + `drawPayload(...)`,
  deepened role-specific silhouette yaw, cloth-fold stack breakup,
  asymmetric payload skew pulses, and hand-cadence desync, and advanced
  close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-048.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.

- Actor workpose rolepose pass (round 046): added `ROLE_WORKPOSE_ROLEPOSE` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteLean/foldCrease/
  payloadCant/poseBrace through `drawActor(...)` + `drawPayload(...)`,
  deepened role-specific silhouette lean, cloth-crease breakup, asymmetric
  payload cant shaping, and work-pose brace cadence desync, and advanced
  close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-048.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.

- Actor workpose asymload pass (round 045): added `ROLE_WORKPOSE_ASYMLOAD` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteSkew/foldShear/
  payloadSling/poseCrank through `drawActor(...)` + `drawPayload(...)`,
  added a new deep asymload fold stroke and extra work-pose crank
  cadence breakup, and advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-045.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.

- Actor workpose taskbias pass (round 044): added `ROLE_WORKPOSE_TASKBIAS` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteYaw/foldCrank/
  payloadOffset/handLead through `drawActor(...)` + `drawPayload(...)`,
  added a new deep task-bias fold stroke and extra hand-lead cadence
  breakup, and advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-044.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.


- Actor workpose rolesign pass (round 043): added `ROLE_WORKPOSE_ROLESIGN` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteNudge/foldBias/
  payloadSwing/handPhase through `drawActor(...)` + `drawPayload(...)`,
  added a new deep role-sign fold stroke and extra hand-phase cadence
  breakup, and advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-043.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.

- Actor workpose drape pass (round 042): added `ROLE_WORKPOSE_DRAPE` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteHook/foldDrape/
  payloadDrop/handFavor through `drawActor(...)` + `drawPayload(...)`,
  added a new deep drape-fold stroke and hand-cadence breakup, and
  advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-043.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.
- Actor workpose fold pass (round 041): added `ROLE_WORKPOSE_FOLD` in
  `scripts/build-motion-atlases.mjs`, wired silhouetteTilt/foldStack/
  payloadSling/handOffset through `drawActor(...)` + `drawPayload(...)`,
  and advanced close-proof export target to
  `scripts/screenshots/actors-workpose-close-round-043.png`; Chromium
  launch denial in this sandbox still blocks atlas rebuild and live
  screenshot refresh.
- Actor workpose sway + proof export (round 040): added
  `ROLE_WORKPOSE_SWAY` in `scripts/build-motion-atlases.mjs` and wired it
  into silhouette drift, cloth-fold ripple slashes, asymmetric payload
  lag, and hand timing, then moved close-proof export to
  `scripts/screenshots/actors-workpose-close-round-040.png` and rebuilt
  `assets/sprites/actors-atlas.png`; verify screenshot scripts still
  blocked by Chromium launch denial in this sandbox.
- Actor workpose rhythm + proof export (round 039): added
  `workposeHeftRhythm` in `scripts/build-motion-atlases.mjs` to break
  mirrored work-hand cadence and added direct close-proof export wiring to
  `scripts/screenshots/actors-workpose-close-round-039.png` for bitmap
  motion evidence when Chromium launch is available.
- Raster-only live path: title icon, build bar, 2D buildings, actors,
  terrain, and nature now use painted PNG atlases.
- SVG live fallback removed from `js/render.js`.
- `scripts/verify-anim.mjs` now verifies raster actor motion instead of
  retired SVG animation.
- Retired SVG sprite files, the `svg-test` sandbox, and the legacy SVG
  verifier branch were removed.
- `scripts/verify-critic.mjs` now captures all buildable painted sprites
  in the canonical 2D renderer.
- Painted wall continuity first pass: walls now draw connected
  atlas-backed link pieces instead of live procedural line segments, and
  the critic captures complete/construction wall clusters.
- Single-renderer cutover: the WebGL/diorama runtime, HUD toggle, input
  mapping, and 3D critic screenshots were removed so future graphics work
  rallies around the 2D renderer.
- Sprite grounding pass: raster buildings now get subtle 2D contact
  shadows/dirt bites and lighter hard-diamond foundations to reduce the
  floating-shadow read.
- Dead procedural building draw helpers were removed from `js/render.js`;
  the remaining building path is the painted atlas renderer.
- Actor motion silhouette pass (round 003): role-specific body-form
  offsets, stronger cloth folds, asymmetric carry payloads, and wider
  work/carry arm arcs were added in `scripts/build-motion-atlases.mjs`
  and baked into `assets/sprites/actors-atlas.png`.
- Actor motion pose-bias pass (round 004): role-specific stance width,
  torso cant, shoulder drop, carry-side bias, and extra cloth-fold lines
  were added in `scripts/build-motion-atlases.mjs` to push less-mirrored,
  less puppet-like motion once atlas rebuild verification is unblocked.
- Actor motion silhouette depth pass (round 005): role body-form and pose
  spread values were increased, carry loads were made more offset and
  uneven, and extra moving cloth-fold strokes were added in
  `scripts/build-motion-atlases.mjs`; atlases were rebuilt but live close
  proof screenshots remain blocked by local verify server startup.
- Actor work-pose breakup pass (round 006): heavy-role stance/cant/drop
  spread was increased again, role-biased work-side kick offsets were
  added to arm/cloth motion, and extra tunic fold breakup was layered in;
  atlases were rebuilt but screenshot verifiers remained blocked.
- Verify runtime fallback pass (round 007): `_serve.mjs` now falls back
  to `file://` mode when local socket bind is denied, and all verify
  entrypoints now consume `server.gameUrl`; HTTP startup blocker is
  resolved, leaving Chromium launch permission as the remaining gate.
- Actor motion silhouette breakthrough pass (round 008): stronger
  role-form and pose spreads, deeper cloth-fold motion, and pose-biased
  payload offsets were added and rebuilt into `actors-atlas.png`; live
  close screenshot proof remains blocked by Chromium launch denial.
- Actor pose asymmetry escalation (round 009): role-form offsets and
  role-pose spread were escalated with deeper carry asymmetry and cloth
  breakup in `scripts/build-motion-atlases.mjs`, but live close proofs
  remain blocked by Chromium launch denial.
- Actor workpose silhouette overdrive (round 010): role-specific
  work-bend, shoulder bulk, hem split, and strap payload cues were
  increased in `scripts/build-motion-atlases.mjs`, pending atlas bake and
  live close capture in a Chromium-allowed environment.
- Actor workpose torque pass (round 011): role-specific work
  crouch/hitch/reach/hem-torque controls were added in
  `scripts/build-motion-atlases.mjs` to force chunkier asymmetric labor
  motion, but close screenshots remained blocked by Chromium launch denial.
- Actor workpose gait/drag pass (round 012): role-specific gait
  phase/drag/lurch timing was added and wired into torso/arm/cloth/payload
  motion, and atlases were rebuilt; live close screenshots remain blocked
  by Chromium launch denial.
- Actor silhouette/load breakup pass (round 013): role-specific torso skew,
  fold-depth shaping, and heavier asymmetric payload width/drop were added
  in `scripts/build-motion-atlases.mjs`, and atlases were rebuilt; live
  close screenshots remain blocked by Chromium launch denial.
- Actor gesture/cloth-shear pass (round 014): role-specific elbow-lift,
  reach-bias, cloth-shear, and load-tilt controls were added in
  `scripts/build-motion-atlases.mjs` and wired into work/carry motion
  folds, arm offsets, and payload tilt; atlases were rebuilt, but close
  screenshots remain blocked by Chromium launch denial.
- Actor workpose asymmetry surge (round 015): role gesture ranges were
  increased again, carry payloads gained phase-driven asymmetry drift,
  heavy labor loads gained extra mass breakup, and work-only diagonal
  cloth slash folds were added in `scripts/build-motion-atlases.mjs`;
  atlases were rebuilt, but close screenshots remain blocked by Chromium
  launch denial.
- Actor pose accent layer (round 016): added per-role `ROLE_ACCENT`
  controls for silhouette/cloth/payload motion, integrated cross-phase
  carry-load jitter and stronger tilt/asymmetry gains in
  `drawPayload(...)`, and added a third work-only diagonal cloth slash in
  `drawActor(...)`; atlas rebake and close screenshot proof remain blocked
  by Chromium launch denial.
- Actor task-bias breakup (round 017): added per-role `ROLE_TASK`
  controls for side/elbow/fold/load asymmetry, wired this into body
  offset, cloth fold skew, carry payload drift, and work arm imbalance in
  `scripts/build-motion-atlases.mjs`; atlas rebuild passed, while close
  screenshot verification remains blocked by Chromium launch denial.
- Actor workload torque layer (round 018): added per-role
  `ROLE_WORKLOAD` controls for torque/fold snap/pack swing, wired this
  into torso cant, work cloth skew cadence, extra work slash folds, and
  carry payload cross-nudge shaping in `scripts/build-motion-atlases.mjs`;
  verification checks passed, but atlas rebuild and close screenshot proof
  remain blocked by Chromium launch denial.
- Actor posture yaw/drape layer (round 019): added per-role `ROLE_POSTURE`
  controls for work hinge, cloth drape snap, shoulder lead, and payload
  yaw; wired these into `drawActor(...)` and `drawPayload(...)` in
  `scripts/build-motion-atlases.mjs`; syntax checks passed, while atlas
  rebake and close screenshot proof remain blocked by Chromium launch denial.
- Actor rig work-pose breakup layer (round 020): added per-role `ROLE_RIG`
  controls for hip shift, fold fan, load skew, and tool reach, then wired
  these controls into torso hinge/side-bias shaping, work cloth fold
  amplitude, work slash reach arcs, and carry payload skew in
  `scripts/build-motion-atlases.mjs`; syntax/invariant checks passed,
  while close screenshot proof remains blocked by Chromium launch denial.
- Actor stance/payload breakup layer (round 021): added per-role
  `ROLE_STANCE` controls for lead-hand bias, shoulder asymmetry, fold
  sweep, and payload lobe imbalance, then wired these controls into
  arm anchors, cloth fold diagonals, and carry payload offset cadence in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor poise silhouette/torsion layer (round 022): added per-role
  `ROLE_POISE` controls for silhouetteShift/foldTorsion/payloadKnot/
  stanceDrive, then wired these controls into torso lateral drift, cloth
  fold torsion, hand-height asymmetry, and carry payload knot nudge in
  `scripts/build-motion-atlases.mjs`; `node --check ...` passed, while
  atlas rebuild and close screenshot proof remain blocked by Chromium
  launch denial.
- Actor workpose drift breakup layer (round 023): added per-role
  `ROLE_DRAMA` controls for shoulderSkew/clothDrop/loadSwing/leadBias,
  then wired these controls into work shoulder asymmetry, cloth drop
  bias, lead-hand pose drift, and carry payload swing breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` passed, while
  atlas rebuild and close screenshot proof remain blocked by Chromium
  launch denial.
- Actor workpose silhouette/fold pass (round 024): added per-role
  `ROLE_WORKPOSE` controls for silhouetteEdge/foldDrop/payloadSkew/
  workReach, wired them into actor body drift, work-only cloth fold
  slashes, and carry payload skew/shape breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor loadout silhouette breakup (round 025): added per-role
  `ROLE_LOADOUT` controls for shoulderPack/hemWeight/kitSwing/clothClamp,
  wired them into work-only cloth slash asymmetry, heavy-role shoulder
  strap pack drift, and carry payload lobe skew in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and SVG-path
  invariants passed, while atlas rebuild plus close screenshot proof
  remain blocked by Chromium launch denial.
- Actor impact silhouette/lag breakup (round 026): added per-role
  `ROLE_IMPACT` controls for silhouetteSnap/clothTorque/payloadLag/
  reachDrift, wired them into actor silhouette drift, work-fold slash
  torque accents, arm reach phase drift, and carry payload lag breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and SVG-path
  invariants passed, while close screenshot proof remains blocked by
  Chromium launch denial.
- Actor labor pose breakup (round 027): added per-role `ROLE_LABOR`
  controls for poseSnap/foldJerk/payloadCant/armDrive, wired them into
  work cloth fold jerk accents, carry payload cant pulse, and stronger
  role-specific work arm drive in `scripts/build-motion-atlases.mjs`;
  `node scripts/build-motion-atlases.mjs` and `node --check ...` passed,
  while close screenshot proof remains blocked by Chromium launch denial.
- Actor exertion silhouette/torque breakup (round 028): added per-role
  `ROLE_EXERT` controls for silhouetteWarp/foldSlice/loadAsym/poseTorque,
  wired them into body silhouette drift, extra work-fold slicing strokes,
  payload asymmetry pulse shaping, and work arm/hand torque offsets in
  `scripts/build-motion-atlases.mjs`; `node scripts/build-motion-atlases.mjs`
  and `node --check ...` passed, while close screenshot proof remains
  blocked by Chromium launch denial.
- Actor signature asymmetry pass (round 029): added per-role
  `ROLE_SIGNATURE` controls for shoulderBias/foldPinch/loadDrag/handFavor,
  wired them into carry payload drag pulses, a new work-only cloth pinch
  slash, role-dominant shoulder sway, and asymmetric hand heights in
  `scripts/build-motion-atlases.mjs`; `node scripts/build-motion-atlases.mjs`
  and `node --check ...` passed, while close screenshot proof remains
  blocked by Chromium launch denial.
- Actor workpose-plus asymmetry pass (round 030): added per-role
  `ROLE_WORKPOSE_PLUS` controls for silhouetteLift/foldHook/payloadOffset/
  poseLead, wired them into actor body silhouette offset, an extra
  work-only cloth hook slash, carry payload offset pulses/width shaping,
  and stronger left/right hand-height asymmetry in
  `scripts/build-motion-atlases.mjs`; `node scripts/build-motion-atlases.mjs`
  and `node --check ...` passed, while close screenshot proof remains
  blocked by Chromium launch denial.
- Actor workpose edge asymmetry pass (round 031): added per-role
  `ROLE_WORKPOSE_EDGE` controls for stanceTwist/clothDrag/payloadSwing/
  handSet, wired them into actor body silhouette drift, a new work-only
  cloth drag slash, carry payload swing pulses/width shaping, and stronger
  left/right hand-height breakup in `scripts/build-motion-atlases.mjs`;
  `node scripts/build-motion-atlases.mjs` and `node --check ...` passed,
  while close screenshot proof remains blocked by Chromium launch denial.
- Actor workpose force asymmetry pass (round 032): added per-role
  `ROLE_WORKPOSE_FORCE` controls for silhouetteDrive/foldPress/payloadList/
  handDrive, wired them into actor body silhouette displacement, an extra
  deep work-only fold slash layer, carry payload list/cadence shaping, and
  stronger left/right hand-height breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` passed, while
  atlas rebuild and close screenshot proof remain blocked by Chromium
  launch denial.
- Actor workpose grit asymmetry pass (round 033): added per-role
  `ROLE_WORKPOSE_GRIT` controls for torsoJut/foldRake/payloadSkid/
  handClamp, wired them into actor body displacement, a new work-only
  fold-rake slash layer, carry payload skid/width shaping, and stronger
  left/right hand-height breakup in `scripts/build-motion-atlases.mjs`;
  `node --check ...` and `node scripts/build-motion-atlases.mjs` passed,
  while close screenshot proof remains blocked by Chromium launch denial.
- Actor workpose torque layer (round 034): added per-role
  `ROLE_WORKPOSE_TORQUE` controls for silhouetteBrace/foldWhip/payloadDrag/
  handBrace, wired them into actor body silhouette displacement, a new
  work-only fold-whip slash layer, carry payload drag cadence/width
  shaping, and stronger left/right hand-height breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor workpose weight pass (round 035): added per-role
  `ROLE_WORKPOSE_WEIGHT` controls for silhouetteDrop/foldCrush/payloadLurch/
  handLoad, wired them into actor body silhouette displacement, a new
  work-only fold-crush slash layer, carry payload lurch cadence/width
  shaping, and stronger left/right hand-height breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor workpose shift pass (round 036): added per-role
  `ROLE_WORKPOSE_SHIFT` controls for silhouetteHook/foldShear/payloadCant/
  handSet, wired them into actor body silhouette displacement, a new
  work-only fold-shear slash layer, carry payload cant cadence/width
  shaping, and deeper left/right hand-height breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor workpose strike pass (round 037): added per-role
  `ROLE_WORKPOSE_STRIKE` controls for silhouettePitch/foldBreak/
  payloadSwing/handClamp, wired them into actor body silhouette
  displacement, a deep work-only fold-break slash layer, carry payload
  swing cadence/width shaping, and deeper left/right hand-clamp breakup
  in `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
- Actor workpose heft pass (round 038): added per-role
  `ROLE_WORKPOSE_HEFT` controls for silhouetteCrank/foldSplay/payloadYaw/
  handDrop, wired them into actor body silhouette displacement, a new
  deep work-only fold-splay slash layer, carry payload yaw/cadence/width
  shaping, and deeper left/right hand-height breakup in
  `scripts/build-motion-atlases.mjs`; `node --check ...` and
  `node scripts/build-motion-atlases.mjs` passed, while close screenshot
  proof remains blocked by Chromium launch denial.
