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
- `actors-compiled/*.png` as generated per-role sheets with accepted row
  overrides applied.
- `ambient/*.png` as editable moving-prop source sprites such as carts and
  boats.
- `actors-atlas.png` compiled from `actors-compiled/*.png` for the live
  renderer.
- `ambient-atlas.png` compiled from `ambient/*.png` for the live renderer.

Hard rule for motion sprites: do not create or edit a single mixed actor source
sheet. Actor source art is one PNG per actor role under `actors/`; ambient
motion source art is one PNG per prop under `ambient/`. The atlas files are
generated runtime artifacts only.

## Actor Row Factory

Treat one `512x84` action/direction strip as the reviewable actor-art unit:
eight chronological `64x84` transparent frames. Do not edit
`actors-compiled/*.png` or `actors-atlas.png` directly.

The row manifest records four visible source states in Sprite Lab:

- `BASE`: inherited from `actors/<role>.png`; not reviewed or hash-locked.
- `CANDIDATE`: staged for comparison but not compiled into the runtime atlas.
- `LOCKED`: accepted override with no analyzer warnings.
- `WAIVED`: accepted override with named warnings; protected from overwrite
  but still repaint debt.

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
node scripts/verify-anim.mjs
node scripts/verify.mjs --game --logic
```

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
second building-art implementation.

Sprite review now has an in-app front end:

- Open Sprite Lab from the title screen/HUD, or load
  `index.html?spritelab=1`.
- Open Actor Muster from the title screen, Sprite Lab's **Live Canvas**
  button, or `index.html?spritemuster=1`. Actor Muster renders every
  role/action/direction map through the same atlas-frame function used by live
  citizens on the real game canvas.
- Deep-link an actor row with query params such as
  `index.html?spritelab=1&role=miner&action=work&dir=left`.
- The legacy cache-busting `?rolesheet=...` value is also parsed when it
  contains a role/action/direction name, for example
  `?rolesheet=round107-miner-work-left`.
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
