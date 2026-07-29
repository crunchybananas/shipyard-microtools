# Actor Pose Prototype Evaluation

This report compares the same sixteen flattened `512x84` runtime rows. It does not promote any candidate into the game.

| Candidate | Rows | Primary bytes | Structural | Body scale | Root/feet | Phase | Sockets | Paint/style | Overall |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- |
| A | 16/16 | 199,984 | PASS | PASS | PASS | PASS | PASS | — | FAIL |
| B | 16/16 | 175,327 | PASS | PASS | PASS | PASS | PASS | — | FAIL |
| C | 16/16 | 746,068 | PASS | — | — | FAIL | FAIL | — | FAIL |

## Candidate A

- Directory: `assets/sprites/prototypes/actor-pose/output/a-layered2d`
- Artifact tree SHA-256: `35e7db44231c372de441861ab318c55da8a0d3f9db06ee64f8b97746c34a6950`
- Distinct primary-row file hashes: 16/16
- Authored phase/contact contract: valid (16/16 rows)
- Flattened side-view phase conflicts: none
- Socket metadata: complete (16/16 rows)
- Paint/style raster cue: 16/16 rows classified painted; human verdict pending

| Row | Frames | Compiler body range | Compiler root Y | Compiler ground Y | Rig evidence | Structural |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `guard/walk/down` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/walk/up` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/walk/left` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/walk/right` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/carry/down` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/carry/up` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/carry/left` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `guard/carry/right` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `builder/walk/down` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `builder/walk/up` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `builder/walk/left` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `builder/walk/right` | 8/8 | 1.0 | 0.0 | 1.0 | valid | PASS |
| `builder/work/down` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/up` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/left` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/right` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |

Cross-direction compiler body height:
- `guard/walk`: range `1.0` px (PASS)
- `guard/carry`: range `1.0` px (PASS)
- `builder/walk`: range `0.0` px (PASS)
- `builder/work`: range `0.0` px (PASS)

Left/right temporal similarity:
- `guard/walk`: `zero-shift`, best cyclic shift `0`
- `guard/carry`: `zero-shift`, best cyclic shift `0`
- `builder/walk`: `zero-shift`, best cyclic shift `0`
- `builder/work`: `zero-shift`, best cyclic shift `0`

Flattened-raster review warnings: `guard/walk/down`, `guard/walk/up`, `guard/walk/left`, `guard/walk/right`, `builder/walk/down`, `builder/walk/up`, `builder/walk/left`, `builder/walk/right`

## Candidate B

- Directory: `assets/sprites/prototypes/actor-pose/output/b-orthographic3d`
- Artifact tree SHA-256: `1984f8268c64c45a2ee04314d096a90517ff10a60122b56fecb784e248fadec3`
- Distinct primary-row file hashes: 16/16
- Authored phase/contact contract: valid (16/16 rows)
- Flattened side-view phase conflicts: none
- Socket metadata: complete (16/16 rows)
- Paint/style raster cue: 4/16 rows classified painted; human verdict pending

| Row | Frames | Compiler body range | Compiler root Y | Compiler ground Y | Rig evidence | Structural |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `guard/walk/down` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/walk/up` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/walk/left` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/walk/right` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/carry/down` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/carry/up` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/carry/left` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `guard/carry/right` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/walk/down` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/walk/up` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/walk/left` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/walk/right` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/down` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/up` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/left` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |
| `builder/work/right` | 8/8 | 0.0 | 0.0 | 0.0 | valid | PASS |

Cross-direction compiler body height:
- `guard/walk`: range `0.0` px (PASS)
- `guard/carry`: range `0.0` px (PASS)
- `builder/walk`: range `0.0` px (PASS)
- `builder/work`: range `0.0` px (PASS)

Left/right temporal similarity:
- `guard/walk`: `zero-shift`, best cyclic shift `4`
- `guard/carry`: `zero-shift`, best cyclic shift `0`
- `builder/walk`: `zero-shift`, best cyclic shift `0`
- `builder/work`: `zero-shift`, best cyclic shift `0`

Flattened-raster review warnings: `builder/work/down`, `builder/work/up`

## Candidate C

- Directory: `assets/sprites/prototypes/actor-pose/output/c-row-factory`
- Artifact tree SHA-256: `d40dc7152dba4b49d961c91dbe8402a1db9528750321a9f714fb9b001e098134`
- Distinct primary-row file hashes: 16/16
- Authored phase/contact contract: missing (0/16 rows)
- Flattened side-view phase conflicts: guard/carry
- Socket metadata: missing (0/16 rows)
- Paint/style raster cue: 16/16 rows classified painted; human verdict pending

| Row | Frames | Compiler body range | Compiler root Y | Compiler ground Y | Rig evidence | Structural |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `guard/walk/down` | 8/8 | — | — | — | missing | PASS |
| `guard/walk/up` | 8/8 | — | — | — | missing | PASS |
| `guard/walk/left` | 8/8 | — | — | — | missing | PASS |
| `guard/walk/right` | 8/8 | — | — | — | missing | PASS |
| `guard/carry/down` | 8/8 | — | — | — | missing | PASS |
| `guard/carry/up` | 8/8 | — | — | — | missing | PASS |
| `guard/carry/left` | 8/8 | — | — | — | missing | PASS |
| `guard/carry/right` | 8/8 | — | — | — | missing | PASS |
| `builder/walk/down` | 8/8 | — | — | — | missing | PASS |
| `builder/walk/up` | 8/8 | — | — | — | missing | PASS |
| `builder/walk/left` | 8/8 | — | — | — | missing | PASS |
| `builder/walk/right` | 8/8 | — | — | — | missing | PASS |
| `builder/work/down` | 8/8 | — | — | — | missing | PASS |
| `builder/work/up` | 8/8 | — | — | — | missing | PASS |
| `builder/work/left` | 8/8 | — | — | — | missing | PASS |
| `builder/work/right` | 8/8 | — | — | — | missing | PASS |

Cross-direction compiler body height:
- `guard/walk`: range `None` px (—)
- `guard/carry`: range `None` px (—)
- `builder/walk`: range `None` px (—)
- `builder/work`: range `None` px (—)

Left/right temporal similarity:
- `guard/walk`: `zero-shift`, best cyclic shift `0`
- `guard/carry`: `reversed-chronology`, best cyclic shift `0`
- `builder/walk`: `zero-shift`, best cyclic shift `0`
- `builder/work`: `zero-shift`, best cyclic shift `0`

Flattened-raster review warnings: `guard/walk/left`, `guard/walk/right`, `builder/walk/left`, `builder/walk/right`, `builder/work/down`

## Interpretation limits

- Raster-inferred root and feet measurements are review proxies. They are warnings and do not override hash-tied compiler body-mask/ID, ground, root, contact, or socket evidence.
- Mirrored left/right alpha similarity can expose a cyclic offset, but cannot prove that all four views express the same semantic beat. A decisive contradiction still blocks phase approval for review.
- Hash, bounds, and style-era signals cannot decide whether guard and builder identities are sufficiently distinct at `1x`; that remains a blind visual review.
- The `painted` style-era signal is descriptive only. Human paint/style approval remains mandatory, so no candidate can auto-pass overall.
- Joint gaps, paint seams, and occlusion defects require proof review; the evaluator does not pretend alpha continuity establishes anatomy.
- Cold/incremental authoring time and the `100`/`250` actor flattened-versus-layered runtime profile are separate RFC evidence and are not measured here.

Proofs: `candidate-<label>-contact.png`, `candidate-<label>-beats.gif`, and `comparison-contact.png`.
