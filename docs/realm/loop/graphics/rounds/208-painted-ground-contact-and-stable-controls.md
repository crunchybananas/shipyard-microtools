# Round 208 — Painted ground contact and stable controls

The growing-town visual review showed buildings hovering over detached oval
shadows. This pass grounds the existing art and fixes an interaction failure
found during the broader checks. It is another local step toward the owner's
whole-game AAA standard, not completion of that goal.

## Result

Contact shading follows the actual front edge of the painted asset. The old
trim rectangles included transparent padding; treating their lower edge as
the painted base and adding another five pixels of shadow offset detached
the contact from the object. The renderer now measures each decoded crop's
alpha once and caches the result outside simulation state.

Soft contact falls beneath the painted base. It replaces the hard stacked
ellipses and the extra dark tile diamonds. Trees and mineral outcrops use
the same visible-edge registration. No source PNG was retouched or rescaled.

Building contact now draws with the ground, before the entire actor/building
depth pass. A building that sorts later cannot paint its ground shadow over
an earlier citizen's feet. The body's composite cache contains only painted
art, keyed by building type and house tier. Daylight and ordinary zoom changes
reuse those copies rather than adding more daylight/ring combinations.

An opening-flow failure exposed a separate UI defect. Routine tutorial updates
replaced an unchanged button between pointerdown and pointerup, swallowing the
click and losing keyboard focus. Unchanged markup now retains its controls;
the highlight also keeps its animation instead of restarting every update.
New Game, cancellation and genuine tutorial transitions still reconcile.

## Verification

The contact gate inspects actual game `drawImage` calls and independently
measures source alpha:

- **77 rendered building cases**, covering all **26 non-road/non-wall types**,
  normal cached rendering, close direct rendering, four housing levels,
  changing daylight and ordinary zoom.
- Every contact center stays behind the front painted edge; measured distances
  are **3.62–10.49 logical pixels** behind it. Exactly one contact draws per
  building, before both the building body and citizen pixels.
- All four tall-scenery categories retain contact beneath their painted base.
  Flat meadow flowers share the nature atlas but are excluded from this
  tall-scenery observer; the first observer version counted those decorations.
- **29 body variants** retain exactly one composite each throughout the test.
  Thirty warm draws perform **zero contact pixel readbacks**.
- Landscape validation passes world-space stability, nonrepetition, seasons,
  wear, fog, water, density bounds, recovery and Canvas fallback. All eight
  Founder/scenery depth crossings and the phone interaction pass.
- All eight Founder gameplay checks pass, including movement, gestures,
  interruption, pause, save/continue, house depth, atlas bounds and phone touch.
- The citizen locomotion browser gate passes again with the new ground pass.
- Tutorial coverage now asserts button identity and keyboard focus survive
  60 routine updates, followed by the real desktop click and phone opening flow.
- Core purity and repository lint pass; no simulation behavior changed.
- All **25 affected release checks** from dense-settlement congestion onward
  pass across the resumed sequence, including all **87/87** browser logic
  assertions. The **69** broader checks passed for the preceding locomotion
  pass; this grounding pass reran the affected browser/gameplay surface.

The affected release sequence resumes after terminal failures rather than
discarding their evidence. Tutorial controls were fixed in the product. The
mechanical First Muster fixture also had two timing assumptions: it paused
after an extra browser round trip, allowing a variable opening tick count,
and required a late-day recruit to finish through the crew's sleep schedule.
It now pauses in the New Game click event and asserts tick zero; its bounded
drill wait allows the next workday. All construction, staffing, food, scouting,
escort-distance, combat and recovery assertions remain. The complete scenario
passes in **4.57 minutes at 1x**. The prior failure traces remain in the logs.

The realm-end filter observer also assumed that two animation callbacks always
included a paint. The renderer caps painting separately from display refresh.
The observer now waits for the actual filter transition and restoration, each
within a fixed 1.5-second bound; all original visual assertions remain.

Evidence:

- `tmp/graphics-world/grounding-208-before/{buildings,town}.png`.
- `tmp/graphics-world/grounding-208-after/{buildings,town}.png`.
- `tmp/graphics-world/grounding-208-validation/report.json` and `scenery.png`.
- `tmp/graphics-world/landscape-208.log`, `founder-208-game.log`,
  `locomotion-208-browser.log`, and `lint-208.log`.
- `tmp/graphics-world/realm-208-verification.log`,
  `realm-208-verification-resume.log`, and `realm-208-verification-final.log`.
- `tmp/graphics-world/muster-208-tick-zero.log` and
  `muster-208-tick-zero-scheduled.log` retain the deterministic fixture check.
- `tmp/graphics-world/logic-208-painted-transition.log` contains the final
  87/87 logic result; `verification-208-summary.json` indexes the passed checks
  across the resumed logs without discarding the failed attempts.

## Remaining work and limits

These are contact shadows, not geometric sun shadows or live normal-map
lighting for every object. Building silhouettes, repeated houses, road surfaces,
construction scaffolds/progress bars, seasonal overlays and the older citizen
families still need substantial art direction. The lower crop of the current
wall art also warrants a dedicated source/continuity review.

The browser checks use Chrome/Chromium. Native Safari remains pending because
the last computer-use attempt reported a locked Mac and the unlock request has
not received an answer. A local Playwright WebKit executable is not installed;
its presence was checked, not represented as Safari coverage. There is no new
full-town GPU performance claim.

Module revision **198**, save shape **7**, simulation **11** remain current.
The original in-app game was left intact. Changes are local and uncommitted;
the overall graphics and traffic goal remains active.
