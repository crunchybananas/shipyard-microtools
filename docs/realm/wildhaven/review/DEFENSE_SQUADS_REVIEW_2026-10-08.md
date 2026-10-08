# Clear town defense and touch squad commands

Ready for review, **not deployed**. Branch `codex/wildhaven-defense-squads`, based on live resource/seasons merge `775605ca6d67fe311e18102bff7d135b67531e6c`; runtime version `20261008-defense-1`. The resource/seasons release remains live through PR161. This separate defense batch has no combat deployment authorization.

Players can now open Company, choose **Ready soldiers**, and issue **Defend Town**. The order brings resident soldiers home by real traversable paths, intercepts hostile troops within eight tiles of the village footpath, limits pursuit to that area, and returns survivors to their rally positions. The selected group shows its current stance, rally spots and a labeled home boundary. Defend Town does not declare war or attack neutral settlements. Hold Here stays stationary and attacks within weapon range; Move, explicit Attack and Retreat remain available.

[Tablet Company](defense-squads-2026-10-08/ipad-landscape-company.png) · [Defended home area](defense-squads-2026-10-08/defended-home-area.png) · [After a simulated encounter](defense-squads-2026-10-08/defense-after-combat.png)

## Saved groups and touch selection

Up to six named squads persist separately in each town. Membership uses the existing 160-unit simulation ceiling and can overlap. The interface creates clear automatic names such as Squad 1. Recall selects ready members without issuing movement orders; training and recovering members stay in the saved group and are counted separately. Dead, released, foreign and allied helper units do not enter saved resident squads. Empty groups remain removable. Optional squad metadata is repaired on loading without invalidating an otherwise valid earned save.

Select on island folds the book into a simple selection strip. Tap friendly soldiers to toggle them, then Done; Cancel restores the previous living selection. Empty ground, buildings and fieldworkers cannot hijack that mode. Dragging, pinching, canceled gestures and unexpected capture loss cannot become selections or orders. Large roster buttons provide an alternative to tapping models; desktop Shift-click adds/removes soldiers. Opening another panel or changing towns clears the appropriate temporary interaction, and reused resident IDs cannot carry a selection or recruitment draft across towns.

The reading pause continues while group selection folds the book. Explicit player speed choices retain their existing behavior. Controls remain mounted through a held native press; a canceled Save squad touch saves nothing, and the next tap saves exactly one group.

## Understandable threats and time to prepare

Coastal cargo demands and physical soldiers now explain their different responses. Town → Watch identifies civilian watch-house staffing, supplies, actual patrol progress and the next useful research/building/workforce step. Paying ends that cargo incident; shelter reduces exposure by 40%; recruited soldiers and walls do not supply coastal readiness. Recruiting a resident from the watch removes them from that civilian job. Company and Watch link directly to each other, and the island's physical-threat notification opens Company.

Future automatically generated threats use these timings. All numbers are simulation time at 1×; 3× takes one third of the wall-clock time.

| Threat | Initial time before warning | Warning preparation | Recovery before another warning |
| --- | --- | --- | --- |
| Coastal cargo | At least 6 minutes | 6 minutes | At least 12 minutes |
| Physical raid | 9 minutes | 6 minutes | 15 minutes |

Only **new** automatic warnings wait for the other system's active incident/warning to clear. Already-announced deadlines, patrol progress and scheduled legacy dates survive loading unchanged. Deliberately declared wars retain their existing 90-second first column and 270-second repeat timing. These choices preserve existing promises and consequences while spacing future automatic threats. A six-minute warning does not guarantee enough time to research and build an entire watch from scratch; the interface describes affordable alternatives and warns when current readiness cannot finish in time.

Fixed an existing save issue where an overdue coastal date, dormant after population fell below twenty, could prevent restoring the town.

[Physical warning](defense-squads-2026-10-08/authored-warning-company.png) · [Simultaneous legacy threats](defense-squads-2026-10-08/authored-warning-active-company.png) · [Coastal Watch](defense-squads-2026-10-08/watch-distinct-cargo.png)

## Illustration library and compact screens

One ImageGen request added `assets/defense-company.jpg`: a warm, playful illustration of three town defenders preparing at an open gate. It extends the existing pantry illustration library. Its original PNG is preserved in the task workspace; `ASSETS.md` records provenance and SHA-256. The 626 KB JPEG is lazy-loaded, decorative, at most 80px high on tablets, and hidden on short landscape screens. Group controls come first.

The short-landscape playthrough also found an existing entry-screen bug: Continue could fall below the viewport. Compact introductory typography now keeps Start and Continue reachable. Company uses a compact opaque book at short heights, with **185px of reading space at 667×375**. Primary action targets, tabs and close controls retain at least 44px touch dimensions.

[Compact art](defense-squads-2026-10-08/ipad-company-art.png) · [Phone](defense-squads-2026-10-08/phone-company.png) · [Short landscape](defense-squads-2026-10-08/short-landscape-top.png) · [Fixed entry](defense-squads-2026-10-08/short-landscape-entry-fixed.png)

## Verification and practical limits

- **347/347 Node tests pass**. The defense-specific coverage checks squads, stale/mixed selections, actual combat and paths, unreachable positions, walls/gates, no implicit war, target disappearance, leash edges, civilian construction reservation, canonical save round-trips, tick partitions, per-town isolation and legacy deadlines. Coastal tests cover recovery rounding, pause/3× timing and actionable guidance.
- Independent review found and fixed a rounded-cell boundary stall and a default-context building-blocking error. Both reproductions reached home without crossing a building; 160 consecutive save normalization checks remained valid. Review also caught a countdown import and recruitment-draft reset issue, both corrected.
- All **34 runtime JavaScript modules parse**, whitespace checks pass, and the unchanged archive verifier passes **2,020 checks**. No dependency installation or large build was needed. Local ESLint remains unavailable.
- Serial isolated headless Chrome checks passed at **1024×768 touch, 768×1024 touch, 667×375 touch, 390×844 touch, and 1440×900 mouse**. Tests use actual trusted DOM taps/clicks and raycast-confirmed model hits, including Done/Cancel, Shift-click, drag/pinch/cancel, saved squads, reload, town switching, warning navigation and layout bounds.
- A separate encounter issued Attack against a staged hostile through the actual island hit, then Defend Town. Three residents defeated the attacker, survived, returned to their rally spots, lost no cargo, and restored from a valid save. This is a deliberately authored interaction fixture, **not a new earned campaign or broad difficulty balance study**. The map/model movement and combat rules executed normally.
- Final browser checks report no application errors. Physical iPad Safari, real device input, and sustained native-device performance remain unverified. There is no claim that this makes the game perfect on every iPad.

Evidence: [combined browser receipt](defense-squads-2026-10-08/browser-receipt.json), [edge receipt](defense-squads-2026-10-08/edge-receipt.json), [readable boundary label](defense-squads-2026-10-08/visual-receipt.json), [Node results](defense-squads-2026-10-08/unit-tests.log), [50 runtime hashes](defense-squads-2026-10-08/runtime-sha256.json). Reproducible harnesses and the authored save are in the same folder.

Earlier attempts remain preserved: a short-lived preview launcher caused connection refusal; the short entry bug was fixed; one assertion expected a defeated enemy to remain after normal cleanup; and an authored watch fixture omitted a production field before being corrected. The final passes distinguish these harness issues from game fixes. The first two tablet viewports passed before the short-height-only CSS correction; the remaining viewports and a fresh edge pass verify the correction.

This batch is a local review commit only. No push, merge, or defense deployment. No desktop UI, CNC/controller/Makera files, local memories, moth design, MyStory, network settings, or application installation was touched. All test browsers and the owned preview server were closed after verification.

The next useful review is on a physical iPad: confirm that selecting three soldiers and issuing Defend Town feels immediate, then inspect one warning and its preparation choices. Broader combat balance should follow that small player review rather than another large feature expansion.
