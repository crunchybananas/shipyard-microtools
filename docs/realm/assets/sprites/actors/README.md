# Actor Source Sheets

Actor art is now edited one role at a time in this folder. The compiled
`../actors-atlas.png` file is a runtime artifact, not the source of truth.
Do not generate, edit, or introduce a single combined actor source sheet; that
is the retired atlas-first workflow and the verifier will reject it.

Each role file is a `512x1344` PNG:

- 8 frames wide, `64x84` each.
- 4 action blocks: `idle`, `walk`, `work`, `carry`.
- 4 directions inside each action: `down`, `up`, `left`, `right`.
- Row formula inside one role sheet: `action * 4 + direction`.

Normal workflow:

```sh
node scripts/verify-sprite-source-contract.mjs
node scripts/build-motion-atlases.mjs
```

Reset workflow, only when intentionally replacing the editable source files:

```sh
node scripts/bootstrap-sprite-sources.mjs
node scripts/build-motion-atlases.mjs
```

The current reset material comes from the CC0 OpenGameArt "Isometric Painted
Game Assets" knight walk cycle, kept under `_sources/` for provenance. Future
passes should replace or repaint individual role PNGs directly instead of
editing the compiled atlas or growing a procedural actor generator.
