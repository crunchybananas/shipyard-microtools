# 080 - actor-motion-path-polish

## Goal

Continue the actor-animation polish after the lumber work/carry pass, and make
citizen movement feel less erratic during everyday work and idle behavior.

## Changes

- Filled the remaining blank lumber `idle` rows. Each direction now uses a
  stable standing pose derived from the matching walking row, so the lumber
  actor no longer disappears when idle.
- Slowed the actor animation display cadence from the very quick `4/5` tick
  loops to `6/7` tick loops, and reduced walking bob amplitude. This lets the
  eight-frame strips read as smoother movement instead of rapid flicker.
- Replaced the fractional animation phase offset with a discrete per-citizen
  frame phase so citizens still desync without landing on arbitrary sub-frame
  timing.
- Added path compression for same-direction path segments. Citizens now follow
  longer straight runs instead of reacting at every tile center.
- Reduced citizen separation strength and personal-space radius slightly so
  nearby citizens do not shove each other into visible jitter as often.
- Added stable work-site targeting:
  - Lumber workers prefer reachable forest tiles near the mill.
  - Quarry and mine workers prefer reachable stone/iron tiles when available.
  - Other staffed/producing buildings use exterior edge spots so workers do not
    all path to the building center.
- Idle citizens now loiter near settlement anchors such as houses, storehouses,
  granaries, or the nearest building. They only forage aggressively when food is
  actually low; otherwise foraging is occasional.
- Citizens now remember their last movement-facing direction, reducing snap
  turns when they pause between path segments.

## Verification

Commands run:

```sh
node scripts/build-motion-atlases.mjs
node --check js/citizens.js
node --check js/render.js
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Additional audit:

- Checked every actor role/action/direction row with ImageMagick alpha maxima;
  all actor rows are now populated.
- Refreshed the visible in-app browser at
  `http://127.0.0.1:4711/index.html?motionpolish=...`.

## Remaining Issues

- Several non-lumber roles still use older shared/derived source art even
  though their rows are populated. The next art pass should repaint role-specific
  work rows rather than only tuning runtime cadence.
- `lumber/work/down` and `lumber/work/up` remain placeholder rows from the prior
  round. They are visible and stable, but not true direction-specific chop
  strips yet.
