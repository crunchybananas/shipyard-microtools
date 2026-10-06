# Round 009 — Make the first neighborhood rewarding

Played the deployed `2b951b8` Peaceful Valley opening through Day 5, using real placement, research, time controls, and building inspection. Built a Farm, Lumber Mill, House and Well, researched Masonry, and watched a Hovel become a Cottage with five residents. No gameplay resources, terrain, citizens or ticks were injected.

## What felt good

The strongest moment was a home improving and another named resident moving in. Food physically reaching a pantry, workers walking between jobs, and a home gaining capacity make the settlement feel purposeful. The early experience should make those connections easy to discover.

## Reproduced friction and changes

- Research guidance highlighted the Founder button. Opening Research or starting a project left the same instruction on screen. It now targets Research specifically and explains choosing, progress, and paused time.
- A finished technology did not refresh its unlocked building cards until another input rebuilt the bar. The shell now notices a changed research set and refreshes once; ordinary resource updates keep the existing buttons.
- Affordability updates depended on `gameTick % 30 === 0`, although the shell's batched ticks can skip those exact values. Cards now refresh affordability whenever the already-throttled UI updates.
- Housing came after research while early citizen mood was falling. The opening now establishes a completed home before the first discovery and explains rest, new neighbors and taxes.
- Masonry had no directed payoff. The tutorial now connects a nearby Well and pantry food to the first Cottage. Other research choices remain valid; an active tutorial no longer disappears merely because the fourth building was placed.
- Clicking a desktop build card destroyed its pointer-leave handler and could strand its tooltip over the world. Rebuilding the bar now clears that tooltip.

## Fresh replay

`verify-first-neighborhood-browser.mjs` uses real clicks and normal 4× time controls to play Farm → Lumber Mill → completed House → Masonry → Well → Cottage. The verified run reached a five-settler Cottage on Day 2 and continued from an exact saved tick. This is one playthrough, not a balance or timing benchmark. The original exploratory run used different pacing and placement.

The test checks research highlighting, paused guidance, immediate unlock visibility, the fourth-building guidance boundary, affordability and Save/Continue. It is included in `verify-realm.mjs`. Screenshots and the state report are generated under `tmp/first-neighborhood/`.

Focused checks also cover the existing desktop/phone opening, actual tap/drag/pinch cancellation, mouse/touch tooltips, alternate first research, shell isolation, module graph, core purity, save continuity, the browser save lifecycle and the military opening. Lint and whitespace checks pass. No simulation or save contract changed. This pass has not been deployed.

## Next highest-value work

1. **Explain current household needs.** The happiness panel suggested late-game Castle/Church/Tavern bonuses while the opening penalty was citizen mood. Show an actionable early explanation of rest, pantry food and service access, linked to the affected people or home.
2. **Make placement readable.** Two visually plausible Lumber Mill clicks missed the forest tile beneath the art. Show the eligible ground and a short reason beside invalid placement, especially on touch.
3. **Give Peaceful Valley a shorter next goal.** Ten population, a Church and 80% happiness are distant from the opening. A compact household goal with a visible benefit would give the player a reason to make the next choice while keeping the broader objectives.

These are follow-up opportunities, not implemented or verified outcomes of this round. Production art remains paused.
