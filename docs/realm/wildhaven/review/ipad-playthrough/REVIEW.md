# Research and town switching playthrough

Release: `20261014-ipad-research-6`. Reviewed on October 14, 2026.

## What changed

- The live research card puts the current stage, blocked state, funding and resume controls first. Supplies use a three-column delivered/required ledger. All stages and the funding explanation remain available in a disclosure.
- Research action and allocation buttons have 44px minimum targets. School/workforce guidance appears before the ledger.
- The HUD reports paused time before allocation, opens the research section directly even without an active project, and reports completion when all current discoveries are learned.
- The active town name remains in the compact dock. Return to town closes the picker without reloading the same town, resetting its camera, or replacing its chosen speed. Switching to another town still opens paused.
- The picker heading and close button remain accessible while a long list scrolls.
- Focus stays on the replacement control or project heading when funding removes a button. A planning-button regression found during this iteration was fixed and covered by focused tests before publication.

## Background MCP playthrough

Used a dedicated `http://localhost:4788` origin and prepared saves; no real player save was edited. No desktop screen takeover or native simulator interaction.

- Played Timber framing through stages two and three, using 50% allocation, manual funding, research pause/resume and the normal 3x time control. Observed automatic knowledge delivery in the next stage, then completed research.
- Returned to the current town through the picker and verified the 3x clock resumed. Switched to another town and verified it opened paused.
- Duplicated Coast experiments as Pine trial, renamed it Pine laboratory, continued it, then reloaded. The name, completed research and resources persisted. Returned to Cory's coast and verified its independent, unfinished 66% project and 50% allocation remained.
- Created Willow start from the intro without replacing the other saves. Started Fieldcraft with its default 25% allocation, changed it to 100%, and observed newly produced timber/food entering research. Pausing stopped collection; cancelling returned the unused stage supplies. The schoolhouse action opened the normal placement flow.
- Started a project after cancellation and checked that its title appeared below the sticky navigation, with focus on the project heading. Allocation changes preserved focus and expanded stage details.
- Final save audit: four library slots, including a companion pair (five town cards); every home snapshot restores, and the original legacy fixture records remain byte-identical. The completed copy and original have independent research state.

## Layout evidence and limits

Reviewed 744x1133 and 1133x744 (iPad mini-size viewports), plus 768x1024 and 1024x768. Landscape funding/resume/allocation controls remain visible together. DOM geometry confirmed no horizontal overflow and 44px research action targets. Scrolling the five-town portrait picker retained its close button in view.

Screenshots and `layout-1024.json` are captured through MCP. `final-browser-errors.json` contains no errors or warnings for the final release assets. Viewport review does not establish physical-iPad Safari behavior, touch gestures, or the software keyboard; those still need device testing.

## Verification

- Full final Node suite: 451 passed, zero failures (`tests-final.txt`).
- Focused research/focus regression checks: `focused-tests.txt` (10 passed).
- Archive verifier: `archive.txt` (2,020 checks, 33 apps, 9 stories).
- Save compatibility evidence: `save-audit.json`.
- No new libraries, save formats, or networking changes.
