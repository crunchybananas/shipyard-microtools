# Round 002 — Responsive Phone Build Mode

Date: 2026-08-01

Runtime revision: 186

## Outcome

Established a fresh responsive evidence baseline at desktop `1440x900`, tablet
portrait `820x1180`, tablet landscape `1180x820`, phone portrait `390x844`, and
phone landscape `844x390`. The first shipped surface fixes the phone build-mode
trap without changing the Canvas2D renderer or simulation ownership.

When a build is selected, the build bar now presents an explicit Cancel control
measuring `64x103` in the `390x844` proof. A stationary tap places one building
and preserves repeat-build mode. An eight-pixel movement threshold separates a
tap from a one-finger camera drag, so panning no longer places an unwanted
building. Two-finger pinch continues to zoom without placing, and tapping an
ordinary building still selects it after Cancel.

## Live Reproduction

On Realm 185 at `390x844`, selecting Farm entered persistent repeat-build mode.
The first touch placed the Farm immediately on `touchstart`; any attempted
one-finger camera pan therefore placed another building before movement could
begin. The selected build card did not toggle off and the bar exposed no touch
Cancel action, leaving Escape as the only reliable exit.

Evidence frames:

- `tmp/responsive-audit/phone/03-farm-selected.png`
- `tmp/responsive-audit/phone/04-farm-placed.png`
- `tmp/responsive-audit/phone/14-camera-before-pan.png`
- `tmp/responsive-audit/phone/15-camera-after-pan.png`

## Changed Surface

- `js/input.js` now defers a stationary touch action until `touchend`, promotes
  movement beyond eight pixels to camera drag, and shares the primary tap path
  between mouse and touch so citizen/building selection and founder follow are
  preserved.
- `js/ui.js` prepends an accessible Cancel button while a build is selected.
- `index.html` gives the control a visible destructive treatment and a minimum
  44px target at every breakpoint.
- `scripts/verify-responsive-build-mode.mjs` is a real `390x844` browser gate
  and is included in `scripts/verify-realm.mjs`.

## Focused Evidence

The focused browser proof starts an ordinary New Game and asserts:

- a phone tap places exactly one Farm and repeat-build mode remains active;
- selected-build drag changes the camera without placing or getting stuck;
- outward pinch changes zoom without placement or camera translation;
- Cancel is visible, unobstructed, reachable, and at least `44x44`;
- Cancel clears build mode; and
- a subsequent phone tap selects the placed Farm and opens its info panel.

Proof frames:

- `tmp/responsive-build-mode/phone-build-mode-active.png`
- `tmp/responsive-build-mode/phone-build-mode-cancelled.png`

## Reproducible Responsive Queue

The viewport audit also established the following ranked queue. These were not
folded into this build-mode slice:

1. **Invisible advisor hit target:** the faded advisor tip can retain pointer
   events and block phone Load/New actions.
2. **Keyboard focus:** the global Tab shortcut prevents ordinary focus traversal
   on title and in-game controls.
3. **Tutorial contracts:** Welcome auto-advances despite asking for a click;
   Research checks research count instead of panel-open state; clearing a Farm
   selection can strand the placement step; and the last step still says Skip.
4. **Tablet HUD overflow:** at `820x1180`, the HUD is approximately 1,147px wide
   inside an 820px viewport and hides actions without a scroll cue.
5. **Phone surface overlap:** the minimap overlaps the build cards around the
   lower-right of `390x844` and can steal taps.
6. **Touch target baseline:** multiple HUD, tutorial, mission, and panel controls
   remain below `44x44`.
7. **Dense phone landscape:** at `844x390`, the build bar and minimap consume
   most of the playable height.

Desktop mouse drag, wheel zoom, canvas resize, placement feedback, panel scroll,
Save, Load, and Continue passed the audit. Tablet resize and drag passed in both
orientations. The browser harness could not synthesize a native device pinch,
so the release gate supplies deterministic CDP pinch evidence instead.

## Release Evidence

Focused gates:

```sh
node scripts/verify-responsive-build-mode.mjs
node scripts/verify.mjs --game
node scripts/verify-browser-save-shell.mjs
node scripts/runtime-revision.mjs --check
node scripts/verify-module-graph.mjs
```

The final `node scripts/verify-realm.mjs` promotion run passed all 48 checks,
including the responsive phone build-mode proof, strict navigation and mixed
traffic correctness, deterministic simulation, save continuity, browser New
Game/Save/reload/Continue, and the real miner lifecycle.

## Deployment

Realm 186 is the publication checkpoint for this round. GitHub Pages deploys
the canonical `docs/` tree from `main` through the repository's Build & Deploy
workflow.
