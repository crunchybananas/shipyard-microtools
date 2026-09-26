# The Island — landing-beach details (initial pass)

Implemented in the local checkout, September 19, 2026 UTC. Not deployed.

Historical first-pass evidence. The current layout, wildlife and combined power
measurements are in [the living-coast review](../island-life/REPORT.md).

## Result

Original Blender geometry adds a net-drying rack, geometric rope coils, cork floats,
painted buoys, a bait tin, an open slatted creel, and three eroded tide rocks with
hollow barnacle shells, mussels and shallow retained water. Equipment stands beside
the existing dory. Rack and rock colliders prevent walking through the new geometry.
The near rack switches to a small silhouette at distance; the 1:240 tabletop keeps
that same silhouette. No additional point lights were introduced (the scene has nine).

The timber material was created with the **built-in imagegen tool**. Its [complete
prompt](../../tools/blender/shore-texture-prompt.txt), [generated original](../../tools/blender/shore-timber-source.png),
and [512px runtime texture](../../assets/shore-timber.jpg) are preserved.
The [editable Blender source](../../tools/blender/shore-details.blend),
[generator](../../tools/blender/shore_details.py), and
[geometry inventory](../../tools/blender/shore-details-geometry.json) are included.
The live Blender MCP connection was unavailable; a separate Blender 5.2.1 LTS
background process authored, exported and rendered the kit.

[Open the visual review](index.html).

## Verification

- ES-module parse gate: passed.
- Existing unit tests: **115 / 115**.
- Shore detail gate: **18 / 18**. Real WebGL loading and rendering, image dimensions,
  near/far selection, miniature geometry, movement collision and error collection.
- Screenshots reviewed at walking scale, noon/night, and all four era grades.
  Era views use labelled debug fixtures; they are not evidence of earned progression.
- Existing tide event: **32 / 32**. Measured event baseline 498 calls / 933,003
  triangles; peak 512 calls / 934,633 triangles, below the unchanged event ceilings.
- Final full-game walk: **69 / 69**.
- Other required gameplay/render gates passed; exact outputs are in
  [gameplay-gates.log](gameplay-gates.log).

The hover-glint optional screenshot export lost its browser debugging connection.
Its assertions passed when rerun without that optional export; every remaining gate
also passed in a fresh isolated browser. This is a complete set of passing gate results, not one uninterrupted run.
Two harness issues exposed during testing were fixed: a threaded static server now
accepts concurrent module requests, and reset plus timer sampling occur in one
browser task. Assertions were retained.

## Fixed-view performance

1440×900, identical positions and hours. Draws and triangle counts are deterministic
comparisons. Seven GPU timing samples were collected at each pose; host GPU load
was not controlled, so these timings do not establish unchanged frame time.

| View / hour | Draw calls before → after | Triangles before → after | Median GPU ms before → after |
|---|---:|---:|---:|
| study / 12:00 | 475 → 476 | 931,799 → 931,897 | 5.13 → 9.18 |
| study / 22:00 | 475 → 476 | 931,799 → 931,897 | 8.54 → 14.54 |
| forest / 12:00 | 251 → 251 | 631,914 → 631,914 | 7.40 → 8.02 |
| forest / 22:00 | 239 → 239 | 630,576 → 630,576 | 11.22 → 16.92 |
| beach / 12:00 | 346 → 351 | 661,480 → 675,356 | 6.91 → 11.36 |
| beach / 22:00 | 307 → 312 | 654,964 → 668,840 | 12.07 → 10.79 |

The new executable gate allows at most 14 additional calls / 30,000 additional
triangles in these views and retains the existing 525-call / 1,000,000-triangle
total ceiling. Actual landing-view cost is five calls and 13,876 triangles;
study cost is one call / 98 triangles; forest cost is unchanged.

## Reproduce

From `docs/the-island`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/shore_details.py
bash tools/harness/syntax.sh
node --test test/*.test.mjs
SERVE_PORT=8766 CDP_PORT=9466 bash tools/harness/run.sh
```

Rebuilding geometry requires refreshing its manifest byte count if the Blender
export changes. The source generator uses the checked-in runtime timber texture;
regeneration does not call imagegen or require an image API key.
