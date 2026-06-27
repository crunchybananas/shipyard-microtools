# 094 - walk-gait-audit

## Goal

Respond to the visible walk-cycle issue where front/back actor rows can look
like the same foot keeps taking the forward step, even when the existing
sprite-frame continuity audit reports clean scale and center transitions.

## Changes

- Added `scripts/audit-walk-gait.mjs`.
  - The audit inspects every actor `walk` row.
  - For front/back rows, it focuses on the central lower boot band so side
    props such as axes are not counted as feet.
  - It writes a numeric JSON report and an enlarged proof sheet:
    `scripts/screenshots/walk-gait-audit-report.json`
    and `scripts/screenshots/walk-gait-audit-worst-rows.png`.
- Added `scripts/alternate-walk-feet.mjs`.
  - The helper mirrors only the lower boot band on alternating frames.
  - It is intentionally limited to front/back rows where the torso, hands,
    tools, and scale are already acceptable.
- Corrected `lumber/walk/down` with a boot-only pass.
  - The actor/tool silhouette and frame size were preserved.
  - The row no longer appears in the highest gait-audit failures after the
    correction.
- Rebuilt `assets/sprites/actors-atlas.png` and
  `assets/sprites/ambient-atlas.png`.

## Proofs

- Gait worst-row proof:
  `scripts/screenshots/walk-gait-audit-worst-rows.png`
- Standard sprite audit proof:
  `scripts/screenshots/sprite-audit-worst-rows.png`
- Lumber walk block before correction:
  `tmp/realm-graphics-round-094/lumber-walk-block-before-x4.png`
- Lumber down after the accepted boot-band correction:
  `tmp/realm-graphics-round-094/lumber-walk-down-after-mirror-x4.png`
- Source backups:
  - `tmp/realm-graphics-round-094/lumber-before-gait-pass.png`
  - `tmp/realm-graphics-round-094/builder-before-gait-pass.png`
  - `tmp/realm-graphics-round-094/blacksmith-before-gait-pass.png`

## Gait Result

Before tightening the audit and correcting the lumber row, the top gait
failures included:

```text
builder/walk/up    gait=131.2 signs=+0/-3 changes=0
lumber/walk/up     gait=119.3 signs=+8/-0 changes=0
lumber/walk/down   gait=111.8 signs=+0/-8 changes=0
blacksmith/walk/up gait=79.7  signs=+2/-1 changes=1
```

After excluding side props from the front/back foot measurement and applying the
accepted lumber/down boot-band correction, `lumber/walk/down` dropped out of
the highest gait failures. The top remaining bitmap gait targets are:

```text
builder/walk/up    gait=131.2 signs=+0/-3 changes=0
blacksmith/walk/up gait=79.7  signs=+2/-1 changes=1
```

Quick surgical attempts to force builder/blacksmith back-facing foot
alternation were rejected because they made the lower body muddy or repetitive.
Those rows should be repainted cleanly in the next bitmap pass rather than
patched with an overlay.

## Verification

Commands run:

```sh
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-frames.mjs
node --check scripts/audit-walk-gait.mjs
node --check scripts/alternate-walk-feet.mjs
node --check scripts/audit-sprite-frames.mjs
node --check js/main.js
node --check js/render.js
env PYTHONPYCACHEPREFIX=/private/tmp/realm-pycache python3 -m py_compile scripts/pack-generated-sprite-strip.py
env PATH=/opt/homebrew/bin:$PATH magick identify -format '%f %wx%h %[channels]\n' assets/sprites/actors/lumber.png assets/sprites/actors/builder.png assets/sprites/actors/blacksmith.png assets/sprites/actors-atlas.png assets/sprites/ambient-atlas.png scripts/screenshots/walk-gait-audit-worst-rows.png scripts/screenshots/sprite-audit-worst-rows.png
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
node scripts/verify-critic.mjs
```

Notes:

- `lumber/walk/down` remains visually stable at x4 proof scale after the
  boot-band correction.
- The standard continuity audit still ranks old SVG-port work/walk rows as the
  largest artifact offenders.
- `verify-anim`, `verify.mjs --game --logic`, and `verify-critic` passed with
  no page errors. The game smoke test still logs the known GPU `ReadPixels`
  performance warning.
- The gait audit is now a required companion check for future front/back walk
  replacements because continuity score `0.0` does not guarantee a believable
  alternating stride.

## Remaining Issues

- Repaint `builder/walk/up` and `blacksmith/walk/up` with true alternating
  back-facing foot contact. A local overlay is not enough.
- Replace the older derived/SVG-port rows that still dominate
  `scripts/screenshots/sprite-audit-worst-rows.png`.
- Clean remaining chroma-key matte pixels on older generated bitmap strips as
  part of each dedicated repaint pass.
