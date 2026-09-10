# Round 207 — Citizen displacement and ground contact

The broader graphics goal remains active: refine the whole playable settlement
toward the owner's AAA standard, with a less cartoonish direction and reliable
citizen traffic as construction changes the town. This pass fixes misleading
running-in-place in the presentation of existing citizen families.

## Result

Walk and carry phase now follows the actual interpolated distance traveled.
Previously, an active path and a recently refreshed `_movedAt` could select
walking even when collision separation cancelled the accepted step. A frozen
citizen at `(4, 5)` cycled through all eight walking frames as game ticks passed.
The same reproduction now holds its feet.

A brief gap holds the current frame; a wait of six simulation ticks settles
once to a contact pose. An empty-handed waiting citizen uses its authored idle
row, while held cargo stays in the corresponding planted carry frame. Actual
travel resumes the gait. Distance, not refresh rate or simulation speed, sets
the phase. Teleports, clock rewinds and reappearance after culling reset safely.

The sprite is drawn directly at its accepted world position. CORE already
provides traffic lanes and separation, so the second `.16`-tile cosmetic road
offset was removed. The extra time-driven vertical bob was removed as well;
body motion comes from the registered source cells. Direction hysteresis now
uses elapsed simulation time and stays frozen while paused.

All continuity remains in the SHELL cache, keyed by stable citizen actor IDs.
The Founder's temporary citizen-art fallback uses its separate WeakMap record
while the new images decode. A broad startup check exposed this boundary;
the regression now deliberately holds Founder images during an early New Game
click. No citizen fields, sprite sources or simulation outcomes change here.
Module revision remains **198**, save shape **7**, simulation **11**.

## Verification

- New Node motion gate: stationary routes and cargo, actual travel, equal
  distance at two speeds and four draws per tick, paused redraws, planted
  waits, resumed movement, teleport/rewind/culling, immutable inputs, and
  anonymous Founder fallback isolation all pass.
- New Chrome gate inspects the real `drawImage` atlas frames and positions.
  Blocked route intent selects idle; traveling advances at least four frames;
  stationary cargo and paused camera movement hold phase. Ground-anchor error
  stays below `1e-7` world-display pixels on an actual road.
- The eight-day staged construction run uses **4,800 real renders** and
  **60,332 actor samples**. All **40,361 continuously stationary observations**
  have zero gait-phase changes. It completes **21/21 buildings**, ends at
  population **24** with food **116**, and retains the prior **124-tick**
  maximum observed local traffic wait. Simulation behavior was not changed.
- The motion observer excludes indoor/culling gaps. Its first run counted
  three reappearance resets as continuous stationary motion; inspecting those
  traces corrected the observer to require consecutive visible samples.
- Physical traffic passes 20 diners, 20 opposing routes, and four-way crossings
  with 4, 12 and 24 citizens in both narrow and wider corridors. All crossing
  routes complete; the largest measured crossing wait is 30 ticks. These are
  controlled cases, not proof of every possible town layout.
- All **69** release checks from `sprite animation contract` onward pass.
  The run resumed at the corrected startup check after its terminal failure;
  all 30 remaining checks pass, including browser cache ownership and all
  **87/87** logic assertions. The earlier 43,200-tick determinism, save,
  presentation and purity checks passed in the same run.
- The source contract passes unchanged: 224 production rows, zero candidate
  rows in runtime, current hashes and all four exact runtime tiers.
- Repository `pnpm realm:lint` and `git diff --check` pass.

Evidence:

- `tmp/graphics-world/locomotion-207/report.json` and `held-cargo.png`.
- `tmp/graphics-world/growth-207/inspection.json`, `final-save.json`, and town
  screenshots at 3,600, 7,200 and 28,800 ticks.
- `tmp/graphics-world/crossing-gait-207.json`.
- `tmp/graphics-world/realm-207-verification.log` and
  `realm-207-verification-resume.log`.

## Remaining work

The source rows still have eight authored frames and their existing anatomical
and cadence limitations. Distance-driven phase prevents false walking; it does
not provide full inverse-kinematic foot locking or replace those families.
Traffic is improved by the previous simulation-11 arrival work, but arbitrary
future congestion remains a playtest target.

The visual review shows detached oval shadows beneath buildings and trees,
flat road materials, repeated architecture, rough construction overlays and
inconsistent actor/landscape materials. Those are still below the target.
Native Safari review of this pass remains pending because the last computer-use
attempt reported a locked Mac; the owner's unlock question is unanswered.
No full-town GPU performance claim is made. Changes remain local and uncommitted;
the original in-app game and its older save were left intact.
