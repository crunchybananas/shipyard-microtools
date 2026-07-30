# Sprite Asset Notes

The current art direction uses painted PNG assets as the source of truth:

- `buildings-atlas-painted.png` for core settlement buildings.
- `support-atlas.png` for farms, production sites, walls, roads, and small support structures.
- `terrain-atlas.png` for tile overlays.
- `nature-atlas.png` for trees, rocks, ore, mountains, and ground details.
- `ui-icons.png` for HUD resource symbols.
- `actors/*.png` as editable per-role citizen source sheets.
- `actor-rows/` as canonical reviewed row overrides plus their SHA-256
  manifest.
- `prototypes/actor-pose/source/` and `references/` as the hash-locked
  modular identity, garment, equipment, pose, and image-generation
  authorities used to compile complete replacement families.
- `actors-compiled/*.png` as generated per-role sheets with accepted row
  overrides applied.
- `ambient/*.png` as editable moving-prop and animal source sprites such as
  carts, boats, deer, cows, and chickens.
- `actors-atlas.png` compiled from `actors-compiled/*.png` as the full
  `64x84` review/runtime scale.
- `actors-atlas-native.png`, `actors-atlas-default.png`, and
  `actors-atlas-double.png` as deterministic row-isolated runtime derivatives
  for `27x35`, `35x46`, and `54x70` physical presentation.
- `actors-runtime-atlases.json` as the dimensions, compiler settings,
  provenance, and SHA-256 contract for every actor runtime scale.
- `ambient-atlas.png` compiled from `ambient/*.png` for the live renderer.

Hard rule for motion sprites: do not edit a compiled role sheet or atlas as
source art. Review and promote one `512x84` action/direction row at a time.
Complete modular families compile those rows from separate identity, garment,
equipment, pose, and attachment authorities. Ambient motion source art remains
one PNG per prop under `ambient/`.

## Runtime Actor Resolution

The `512x84` row remains the editable and reviewable unit. Runtime presentation
does not repeatedly shrink that row from `64x84` to the actor's on-screen
footprint. `build-motion-atlases.mjs` resizes every action/direction row in
isolation. It normalizes hidden RGB beneath fully transparent pixels, uses a
no-negative-lobes `Box` area downsample followed by a bounded unsharp pass,
strips non-visual metadata, and writes four hash-locked atlases:

| Tier | Frame | Intended presentation |
| --- | ---: | --- |
| `native` | `27x35` | exact ordinary-screen 1x actor |
| `default` | `35x46` | exact default-camera actor; exact 2x on Retina |
| `double` | `54x70` | exact native actor at 2x / common zoom transitions |
| `review` | `64x84` | canonical full-resolution review frame |

The renderer measures the canvas transform in physical pixels and chooses the
tier that lands closest to exact 1x/2x/3x presentation. Integer fits disable
Canvas image smoothing. Arbitrary zooms retain high-quality smoothing rather
than distorting the actor. The game canvas exposes the active decision through
`data-actor-atlas-*` attributes so browser verification can prove the selected
tier without relying on a screenshot alone.

Post-processing preserves the full backing resolution through device pixel
ratio `2`; it no longer halves every Retina frame before color grading.
Unusually dense displays cap post-processing at `2x`, while the existing
slow-frame guard can suspend the effect without hiding the sharp base canvas.

Actor Muster also chooses an exact compiled frame size that fits each review
cell. It no longer stretches a `35x46` frame to an arbitrary `40x52`
presentation and accidentally makes good art look soft during review.

## Historical Modular A3 Vertical Slice

The first replacement-pipeline slice lives under
`prototypes/actor-pose/output/a3-interchange/`. It is intentionally separate
from the production atlas while the style is being established.

- Two independently painted identities (`watchman`, `craftsperson`) combine
  with two independently painted garment kits (`watch-blue`, `ochre-work`).
- Identity-specific render profiles preserve a broad or lean body silhouette
  while fitting the same garment source.
- A socketed cargo-crate attachment proves the explicit
  `far-hand < cargo < near-hand` occlusion contract.
- One authored eight-beat carry skeleton drives all
  `2 identities × 2 garments × 2 attachment states`: eight ordinary
  `512x84` flattened rows and 64 distinct frames.
- Identity, garment, attachment, semantic-mask, landmark, quality, and
  provenance outputs remain independently inspectable. Runtime still receives
  flattened raster rows; no live skeletal renderer was added.
- Each row has prefiltered `27x35`, `35x46`, `54x70`, and `64x84` derivatives.
  All derivatives share one deterministic 48-color factorial palette, fixed
  tone curve, binary alpha, and no dithering. This converts soft painted
  gradients into classic-strategy pixel clusters without changing the
  canonical painted source row.

This A3 output is retained as provenance for the first factorial source test.
Its former single-row guard candidate and preview URL have been retired. The
complete A5 guard and A7 farmer families supersede it in production.

## Complete Modular Actor Families

- A5 compiles the guard from one watchman identity, one watch-blue garment,
  a short sword, and a cargo crate across all four actions and directions.
- A7 compiles the farmer from one craftsperson identity, one ochre workwear
  kit, a four-view hoe, and the same socketed cargo crate across all four
  actions and directions.
- Each family emits 16 independent `512x84` rows, 128 frames, semantic and
  equipment planes, landmarks, body-only proofs, a family contact sheet, and
  four exact runtime tiers.
- Both compilers require binary runtime alpha, a shared 48-color family
  palette, stable `76px` body height, ground row `79`, clear rows `80–83`,
  distinct directions, clean row-quality reports, and a byte-identical clean
  rebuild.
- `guard/carry` and `farmer/carry` own their baked containers. A6 supplies the
  nine resource-specific payloads at the same tier, frame, and destination
  rectangle; the procedural fallback is suppressed only for those owners.

Verification:

```sh
python3 scripts/actor-pose-prototype/a7_farmer_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a7_farmer_actions.py
scripts/sprite-row verify
node scripts/verify-farmer-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
```

The live verification checks preview rows before promotion and production
atlas rows after promotion. It proves exact zoom-matched tier selection,
row-local addressing, transition resets, actor/payload alignment, disabled
smoothing at integer scale, and no preview requests from an ordinary URL.

## Actor Row Factory

Treat one `512x84` action/direction strip as the reviewable actor-art unit:
eight chronological `64x84` transparent frames. Do not edit
`actors-compiled/*.png` or `actors-atlas.png` directly.

The row manifest records three visible source states in Sprite Lab:

- `BASE`: inherited from `actors/<role>.png`; not reviewed or hash-locked.
- `CANDIDATE`: staged for comparison but not compiled into the runtime atlas.
- `LOCKED`: accepted override with no analyzer warnings.

Accepted row files are SHA-256 locked. The compiler copies each base role sheet
and replaces accepted rows with copy semantics, so transparent override pixels
erase legacy pixels beneath them instead of compositing over old art.

Typical row workflow:

```sh
scripts/sprite-row work-order --role miner --action work --dir up
scripts/sprite-pack ...
scripts/sprite-row stage ...
scripts/sprite-row accept ...
scripts/sprite-row status
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
node scripts/audit-sprite-frames.mjs
node scripts/audit-walk-gait.mjs
node scripts/audit-sprite-direction-phase.mjs
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
```

Direction changes preserve the live actor's current frame index. Treat all four
direction rows for one role/action as a temporal family: frame `N` must remain
the same gait or tool beat in `down`, `up`, `left`, and `right`.
`audit-sprite-direction-phase.mjs` compares within-view motion signatures, not
cross-perspective silhouettes, and rejects only a decisive cyclic offset
supported by independent views (or the same-perspective left/right pair). It
runs deliberate in-memory cyclic-shift mutations plus a full right-row
chronology reversal as self-tests. Exact normalized alpha signatures also
reject a side family stored as `left[N] = mirror(right[7-N])`, even when cyclic
scoring alone looks aligned. The audit writes actionable frame mappings to
`scripts/screenshots/sprite-direction-phase-report.json`, and has no release
waiver.

`work-order` writes two deliberately separate contacts:

- `identity-reference-contact.png` contains only warning-free, hash-matched
  `LOCKED` rows from other actions for the same role and direction. Its row
  labels and `spec.json` entries identify every source path and status. This
  contact is authoritative for costume, face/headgear, palette, body scale,
  and painterly style.
- `motion-reference-contact.png` contains the target action and its direction
  peers, including their explicit `BASE`, `CANDIDATE`, or `LOCKED` status. It
  is evidence for pose, cadence, direction, and tool travel only; it must not
  redefine character identity.

The generated `prompt.txt` states that identity wins whenever the contacts
conflict. Work-order creation fails when no trusted adjacent-action identity
row exists; inherited `BASE` art is never silently promoted to an identity
reference. Use `--out-dir <path>` for an isolated inspection or test output.
Run `scripts/.venv/bin/python scripts/test-sprite-row-work-order.py` for the
focused identity/motion reference regression.

The Python row tooling (`sprite-row`, `sprite_row_quality.py`) needs Pillow,
and the system `python3` is PEP-668 externally managed. Use the project
virtualenv (gitignored):

```sh
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install pillow
REALM_SPRITE_PYTHON=scripts/.venv/bin/python scripts/sprite-row status
```

## Style-Era and Scale Gate

The compiled sheets historically mixed two art generations: legacy flat
"blocky" toy figures and the painted direction that is the stated art style.
Both analyzers now classify every row's style era from measurable features
(distinct quantized color count and the continuous-shading ratio of adjacent
opaque pixels; painted rows measure roughly 315-706 colors / 0.61-0.67
shading, blocky rows 80-160 / 0.19-0.23):

- `scripts/sprite_row_quality.py` reports `styleEra` per row and adds a
  `legacy-blocky-style` warning to any non-painted row, so the row factory
  cannot accept legacy-era art.
- `node scripts/audit-sprite-frames.mjs` audits every compiled row, prints a
  full role/action/direction table (era, dense-body height, palette cluster,
  debris flags), and exits non-zero when a role sheet mixes eras or when a
  row's dense-body height drifts more than 10px from the same-direction walk
  row. There is no release-path waiver or mixed-era bypass.

The reference body scale is the locked settler walk family at `72px` dense
body height (see Round 111 note above); repainted idle/walk rows must land on
that scale, not merely be internally stable.

Acceptance requires stable identity and viewing direction, stable dense-body
height/width/anchor inside the row, compatible body scale and palette across
the other directions of the same action, compatible body scale and palette
across adjacent actions for the same role, visual Sprite Lab inspection, and
runtime verification. A moving tool may enlarge the full alpha silhouette; it
does not excuse body-scale flicker. Round 111's settler idle rows were repacked
to the locked walk family's `72px` body height before acceptance; isolated
row quality was not treated as sufficient.

The live game references PNG atlases directly. Retired SVG sprites and the old
SVG sandbox are intentionally absent so future work cannot drift back into a
second building-art implementation. The `*-atlas-large.png` variants were
retired in the 2026-07-01 cleanup: nothing in js/ ever loaded them, and the
small variants are the only runtime sources. The one-shot repaint scripts
(`paint-cohesive-legacy-actors`, `refit-settler-frontier-rows`,
`alternate-walk-feet`, `scrub-work-row-particles`) were retired at the same
time — their capabilities live on as `sprite-row` workbench verbs (`derive`,
`stance`, `headswap`, `rescale`, `stabilize`, `scrub`) with the role palette
table kept as `ROLE_CLOTH` in the workbench.

Sprite review now has an in-app front end:

- Open Sprite Lab from the title screen/HUD, or load
  `index.html?spritelab=1`.
- Open Actor Muster from the title screen, Sprite Lab's **Live Canvas**
  button, or `index.html?spritemuster=1`. Actor Muster renders every
  role/action/direction map through the same atlas-frame function used by live
  citizens on the real game canvas.
- Deep-link an actor row with query params such as
  `index.html?spritelab=1&role=miner&action=work&dir=left`.
- Mark bad rows or frames with tags and notes, then use Copy Report or Export
  JSON to turn visual review into a concrete repaint queue.
- Actor body scale must stay stable across every frame in a row. Tools,
  weapons, sacks, and swing arcs may extend through the cell, but the NPC
  should not shrink or grow to make room for the prop. Treat large Sprite Lab
  height deltas or visible body-scale drift as a repaint rejection.
- Run `node scripts/verify-all-sprite-maps.mjs` after renderer or atlas
  integration work. It inspects all 224 runtime rows and 1,792 frames, checks
  blank frames and motion variety, proves canonical atlas addressing, verifies
  all live role/action/direction mappings, and walks every Actor Muster page.
- For exact in-app runtime evidence when generic browser screenshots time out
  on the dual game canvases, load `index.html?runtimecapture=1&v=<revision>`.
  The query-gated hook publishes a hidden composed game/postfx PNG for review;
  normal gameplay performs no capture work. The optional `v` value also
  revisions the actor-atlas request so a rebuilt PNG cannot be mistaken for a
  stale cached atlas.

Long term, the useful split is:

- Keep actor and ambient source PNGs editable per role/prop; treat their
  compiled atlases as runtime artifacts.
- Use `scripts/build-motion-atlases.mjs` only as a compiler/stitcher for
  actor and ambient source PNGs. It shells out to ImageMagick for dimension
  checks, atlas stitching, and the source-sheet proof image; it does not launch
  Chromium or repaint actor source art.
- Run `node scripts/verify-sprite-source-contract.mjs` before and after motion
  sprite work. It fails if actor/ambient source PNGs are missing, extra, mixed
  together, or dimensionally wrong.
- Use `scripts/bootstrap-sprite-sources.mjs` only for intentional reset work;
  re-running it overwrites editable actor and ambient source PNGs.
- Do not add SVG fallback paths to live rendering or UI.
- Avoid hand-authoring new decorative SVG sprites unless the shape is genuinely vector-native, such as UI marks or simple line icons.
- Keep actor and ambient atlas work close to the terrain/building/mountain
  paint style. Do not revive the retired layered `ROLE_WORKPOSE_*` motion maps
  or a procedural actor generator as the live art path.
