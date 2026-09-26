# The Island — quieter shore, living birds

Implemented in the local checkout, September 19, 2026 UTC. Not deployed.
[Visual review](index.html) · [Complete asset audit](ASSET_REVIEW.md)

## Result

The beach has half the driftwood and wrack, three shore gulls instead of five,
and one western tide-rock cluster instead of three. An open arrival-to-rack route
is verified by actual player movement. The shingle transition blends into the sand.

Original Blender gull, crow and songbird rigs replace the previous assembled bird
primitives. Twelve joints drive independent looks, foraging, preening, blinks,
calling, gliding, short wingbeat bursts and landing. Nearby players draw a bird's
attention; shore gulls depart continuously and return after the player moves away.
The clue bird's beak follows actual musical notes and resets with the sound.

The same kit rebuilds the dory as an open lapstrake hull with floorboards, ribs,
seats, keel and a shaped oar. The existing pointer interaction, lens mark and two-scale
geometry ownership remain. Conifer boughs have fuller volume at the same geometry
budget. Split stone crowns, the hovering clue bird, and the partly buried final
note/record slab are repaired against the real surfaces.

## Provenance and geometry

Blender 5.2.1 LTS authored/exported the kit in a separate background process.
The source file is [island-life.blend](../../tools/blender/island-life.blend);
[island_life.py](../../tools/blender/island_life.py) regenerates it.
[Geometry inventory](../../tools/blender/island-life-geometry.json).
No downloaded models or additional image textures were added in this pass.
The drying rack retains the prior built-in imagegen timber, whose
[prompt and source](../../tools/blender/shore-texture-prompt.txt) are preserved.

| Part | Near triangles | Far triangles |
|---|---:|---:|
| Gull | 2,806 | 859 |
| Crow | 2,522 | 563 |
| Songbird | 2,522 | 563 |
| Dory | 4,836 | shared at model scale |
| Oar | 44 | shared at model scale |

Runtime kit: 583,244 bytes. Each bird renders one skin/material; near/far skins share
its animated bones. Hysteresis is 18/22 metres scaled by apparent size, so the
miniature uses the lighter silhouette. Editable Blender pose actions remain in the
source; production animation is procedural bone posing in `js/island-life.js`.

## Verification

- Complete `tools/harness/run.sh`: **gate green**, including the **69/69** game walk,
  **18/18** shore gate and **11/11** wildlife gate. [Full log](full-regression.log).
- The last additional stone-topology assertion and final capture were verified in
  a fresh **21/21** asset pass and **11/11** wildlife rerun. The full run above logged
  the preceding 20-assertion asset gate. [Final rerun](final-asset-gates.log).
- Packaged review: 39 local links resolve, desktop/mobile layouts fit, and the
  28-second video plays in a real browser. [Review checks](review-validation.json).
- Unit tests: **115/115**; module syntax passed. [Unit log](unit-tests.log), [syntax](syntax.log).
- Real pointer interaction with the rebuilt oar; musical note/beak synchronization;
  no pending beak motion after reset; all four era visibility rules; bird feet on
  actual surfaces; note and slab above the fitted floor; no runtime errors.
- Dawn flock clears the tower by at least 1.43m (required 1.32m). A grounded bird has
  zero measured sole error/root drift. Departure remains 82m outward and 26m upward
  over 6.32s; return is visible, continuous and lands at its home position.

## Fixed-view cost

1440×900, same camera positions and hours as the pre-shore-detail baseline. These
measure the combined shore/life work, not just the birds. Geometry/draw counts are
rendered samples; GPU medians are seven local observations per view. Host load was
not controlled, so this is not an unchanged-FPS claim.

| View / hour | Draw calls before → after | Triangles before → after | Current median GPU ms |
|---|---:|---:|---:|
| study / 12:00 | 475 → 474 | 931,799 → 935,821 | 9.20 |
| study / 22:00 | 475 → 474 | 931,799 → 935,821 | 6.78 |
| forest / 12:00 | 251 → 242 | 631,914 → 633,003 | 11.71 |
| forest / 22:00 | 239 → 239 | 630,576 → 630,576 | 11.48 |
| beach / 12:00 | 346 → 321 | 661,480 → 680,933 | 12.34 |
| beach / 22:00 | 307 → 310 | 654,964 → 668,636 | 22.26 |

[Raw power samples](power.json). The unchanged fixed-view gate permits at most
14 additional calls and 30,000 additional triangles. Global ceilings remain
525 calls / 1,000,000 triangles. The Upstream Hand event measured 496 calls /
936,586 triangles at baseline and 510 / 938,216 at peak. Its incremental limits
remain +16 calls / +20,000 triangles. No point lights were added (nine remain).

## Visual evidence

The 28-second [bird recording](gull-life.mp4) uses actual browser frames and ordinary
production time, recorded at 960×600 with a 5× detail camera from 10m away. It is
muted. Encoding to H.264 preserves capture timestamps; it does not interpolate motion.
The [gameplay view](04-gull-gameplay.jpg) uses the ordinary camera.

Era/prerequisite and encounter screenshots are explicitly staged debug fixtures,
not proof of earned progression. Pose stills select production poses. The entire
family-by-family audit, including remaining weak assets and the missing Tide-Figure
visual proof, is in [ASSET_REVIEW.md](ASSET_REVIEW.md).

## Reproduce

From `docs/the-island`:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/blender/island_life.py
bash tools/harness/syntax.sh
node --test test/*.test.mjs
SERVE_PORT=8794 CDP_PORT=9494 bash tools/harness/run.sh
SERVE_PORT=8795 CDP_PORT=9495 SHOT_DIR=/tmp/island-life-review bash tools/harness/one.sh island-life.mjs gulls.mjs
SERVE_PORT=8796 CDP_PORT=9496 SHOT_DIR=/tmp/island-life-frames bash tools/harness/one.sh capture-wildlife.mjs
```

Use free ports. The capture harness writes JPEG frames and a timestamp-based
`concat.txt`; ffmpeg can encode it with `-f concat -safe 0 -vf fps=24 -c:v libx264
-pix_fmt yuv420p -movflags +faststart`. Refresh the manifest size if a Blender export
changes. Regenerating the existing timber geometry does not invoke imagegen.
