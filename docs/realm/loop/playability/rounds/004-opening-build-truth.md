# Round 004 — Opening Build Truth

Date: 2026-08-02

Runtime revision: 188

## Outcome

The first Farm instruction now tells the truth about game state. A teal dashed
**Select** ribbon identifies the next tutorial action without looking like an
active building. Clicking Farm changes the card to the established gold active
state, sets `aria-pressed="true"`, exposes Cancel, and immediately changes the
tutorial from selection to placement.

The round also closes the adjacent opening-state failures that produced the
same player experience:

- Welcome waits for a real **Start building** action instead of advancing on a
  tick timer while saying “Click anywhere.”
- The fading title becomes inert immediately after New Game, so a quick phone
  tap reaches the newly visible game instead of disappearing into the title
  overlay.
- Cancel and Escape clear the same placement state and rewind an unplaced Farm
  to the selection instruction.
- Repeating the already-selected number hotkey keeps build mode active; Cancel
  and Escape are the explicit exits.
- An in-page New Game resets tutorial progress and dismissal.

## Live Reproduction

On Realm 187, New Game correctly initialized `G.selectedBuild` to `null`. After
30 simulation ticks, however, the welcome advanced automatically and added
`.tut-highlight` to Farm. That class drew a large pulsing gold outline and scale
breath. `.build-btn.active` had also become gold during later graphics work,
although the old tutorial comment still claimed selection was blue.

Farm therefore looked selected without being selected. Clicking a revealed
grass tile dispatched no `PLACE_BUILDING` command and placed nothing. Only a
second interaction on the Farm card entered real build mode.

Two related paths amplified the failure:

1. the title screen stayed above the live game for a 500 ms fade and continued
   intercepting pointer input; and
2. after Farm was genuinely selected, Cancel or Escape cleared selection while
   the forward-only tutorial stayed stranded on “Click a grass tile.”

## Interaction Contract

- **Teal dashed ribbon:** the tutorial is pointing at an action the player has
  not taken.
- **Gold lifted card + Cancel:** build placement is authoritatively active.
- **Unselected ground click:** never places or logs a building command.
- **Cancel/Escape:** leave build mode, clear the paint sentinel, and restore the
  appropriate selection instruction when the required building is unplaced.
- **Successful placement:** records exactly one command, keeps deliberate
  repeat-build mode, and cues the next building with the teal ribbon.
- **New Game:** starts at the welcome step regardless of the prior tutorial
  position or dismissal state.

## Changed Surface

- `index.html` separates teal tutorial guidance from gold active build mode and
  adds a 44px phone-sized welcome action.
- `js/ui.js` centralizes build activation/cancellation, exposes `aria-pressed`,
  reconciles reversible selection with tutorial steps, and owns tutorial reset.
- `js/input.js` uses the shared cancellation contract and refreshes tutorial
  state immediately after a successful placement.
- `js/main.js` makes the fading title inert, renders the welcome immediately,
  and resets tutorial shell state for both New Game entry points.
- `scripts/verify-opening-build-tutorial-browser.mjs` covers the ordinary
  desktop and `390x844` opening flow and is included in the Realm release suite.

## Save Contract Decision

No save or simulation version changes. Tutorial progress is presentation-shell
state and is intentionally reset for New Game. Authoritative placement still
uses the existing `PLACE_BUILDING` command and current building lifecycle.

## Focused Evidence

The browser gate proves:

- the fading title has no pointer or keyboard ownership after New Game;
- Welcome remains until the real Start building action;
- inactive Farm is teal-guided, not active, not pressed, and has no Cancel;
- clicking grass before selecting Farm produces no building and no placement
  command;
- clicking Farm produces gold active state, `aria-pressed="true"`, Cancel, and
  the placement instruction;
- Cancel and Escape return to the Farm selection instruction;
- pressing `2` again does not silently cancel an already-selected Farm;
- placing once produces one Farm and one command, preserves repeat-build mode,
  and cues Lumber Mill; and
- phone Start building is at least 44px and the first Farm tap succeeds.

Proof frames:

- `tmp/opening-build-tutorial/desktop-next-action.png`
- `tmp/opening-build-tutorial/desktop-active-placement.png`
- `tmp/opening-build-tutorial/phone-next-action.png`
- `tmp/opening-build-tutorial/phone-active-placement.png`

Focused gates:

```sh
node scripts/verify-opening-build-tutorial-browser.mjs
node scripts/verify-responsive-build-mode.mjs
node scripts/verify-browser-save-shell.mjs
node scripts/runtime-revision.mjs --check
node scripts/verify-module-graph.mjs
```

The final promotion gate, `node scripts/verify-realm.mjs`, passed all 50 checks,
including the ordinary opening-build browser proof, phone gesture arbitration,
save/continue, citizen AI and ownership, navigation, and broad gameplay logic.

## Deployment

Realm 188 is the publication checkpoint for this round. GitHub Pages deploys
the canonical `docs/` tree from `main` through the repository's Build & Deploy
workflow.
