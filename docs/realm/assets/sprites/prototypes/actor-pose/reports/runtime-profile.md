# Actor Pose Runtime Output Profile

Machine: Apple M4, darwin 25.3.0; Chromium 147.0.7727.15.

Each output mode ran in a fresh Chromium process, fresh browser context, and minimal same-origin page that loaded only that mode’s assets.

## Draw workload

| Output | Actors | Draws/frame | Median submit ms | p95 submit ms | Median drain ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| flattened | 100 | 100 | 0.040 | 0.050 | 1.400 |
| flattened | 250 | 250 | 0.100 | 0.110 | 2.800 |
| layered | 100 | 300 | 0.120 | 0.130 | 3.300 |
| layered | 250 | 750 | 0.290 | 0.310 | 7.100 |

| Actors | Layered/flat median | Layered/flat p95 | Layered/flat mean |
| ---: | ---: | ---: | ---: |
| 100 | 3.00x | 2.60x | 2.96x |
| 250 | 2.90x | 2.82x | 3.02x |

Each timing sample draws 10 frames and is normalized to per-frame cost, reducing sub-millisecond timer quantization. The timed interval covers `clearRect` plus `drawImage` command submission. Every 30 samples, a full-canvas `createImageBitmap` snapshot is awaited and closed outside the timed interval. Its duration is reported as “drain”; this bounds deferred work without pretending the snapshot copy is a normal Realm frame cost. The browser still controls exact GPU scheduling.

## Asset footprint

| Output | Encoded files | Encoded bytes | Decoded images | Estimated RGBA bytes |
| --- | ---: | ---: | ---: | ---: |
| flattened | 16 | 199984 | 16 | 2752512 |
| layered | 48 | 280540 | 48 | 8257536 |

## Forced-GC page memory

| Output | Heap before | Heap after | Heap delta | DOM-node delta | Listener delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| flattened | 527424 | 680688 | 153264 | 17 | 0 |
| layered | 527424 | 675164 | 147740 | 49 | 0 |

The forced-GC heap delta is attributable to that isolated mode’s retained page objects, but it does not include browser-managed decoded textures or GPU memory. The RGBA estimate above reports decoded image footprint separately.

## Browser errors

- None.

## Interpretation limits

- This is a machine-specific isolated Canvas2D microprofile of draw-loop command/raster workload, not the full Realm renderer.
- It excludes Realm simulation, culling, sorting, camera work, atlas selection, effects, compositing, UI, and browser presentation.
- The flattened asset count represents only the tested fixed rows; it does not include the storage or build cost of combinatorial flattened identity, garment, equipment, and action variants.
- Fresh browser processes make per-mode page heap deltas attributable, but process caches, GPU memory, and decoded textures remain outside the forced-GC JS heap metric.

Validation: PASS.
