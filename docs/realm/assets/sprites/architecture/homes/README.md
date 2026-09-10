# Carpentered homes

The editable source is [source/homes.blend](source/homes.blend). It contains twelve homes: reed, slate and clay roofs across four housing tiers. The first two tiers have one storey; the last two have two. The camera has one physical scale and ground anchor across the family.

Each named component has `realm_start` and `realm_end` properties. These describe when it is installed and, for temporary staging or delivered materials, when it disappears. A complete house uses the same framing, infill and roof pieces as its construction stages. The sixteen stages run from setting-out lines through plinth, joists, frames, infill, gables, rafters, battens, eaves, covering, chimney and joinery to completion.

Open the saved scene in Blender to edit its geometry, materials or installation properties. Homes are grouped by variant and tier; their library positions are removed for the sprite camera. The normal rebuild exports the edited scene and does **not** rerun the original geometry bootstrap:

```sh
REALM_PORT=8942 node scripts/house-sprites/rebuild-from-blender.mjs
```

Use `--out tmp/house-sprites/my-reviewed-rebuild` to build a separate candidate. The bootstrap, `author_houses.py`, only creates new staging sources and refuses an existing `.blend`. These are original Realm architectural meshes and packed material textures.

The game draws ordinary PNG layers. It does not download the source GLB or initialize a 3D renderer for a house. Seven small maps provide completed bodies, construction, winter roofs, cast contact shadows, window emission and ground light. `anchors.json` supplies chimney positions measured from the saved meshes. All seven maps and the anchors must be ready before the renderer replaces the painted fallback family.

Completed houses use 128×160 base cells; construction uses 64×80 cells. Detailed 512×640 images are shared by material variant, tier, stage and season, with at most twelve retained and two simultaneous detail loads. Small cells use coverage-weighted area filtering in linear light so fine construction details survive reduction consistently. Window dividers occlude emission, snow preserves the body alpha, and shadows and light on the ground draw before citizens.

`source/source.json` records independently evaluated Blender bounds for every installed stage. `quality.json` records rendered bounds, image coverage, clipping and layer checks. `manifest.json` hashes the source files and every generated output.

```sh
REALM_PORT=8942 node scripts/verify-house-source.mjs
REALM_PORT=8942 node scripts/verify-house-game.mjs
REALM_BROWSER=webkit REALM_PORT=8942 node scripts/verify-house-source.mjs
REALM_BROWSER=webkit REALM_PORT=8942 node scripts/verify-house-game.mjs
```

The architecture is presentation only. Existing construction progress, housing upgrades, occupancy, routes and collisions remain simulation-owned.

Roof and scaffold selection uses the source alpha. Early construction also accepts the whole ground cell, so the empty center of a setting-out plot is selectable. Hover identifies the building or its construction stage. Progress appears beside the selected or hovered project; obsolete completion rings and unconditional sleep bubbles no longer cover the house.
