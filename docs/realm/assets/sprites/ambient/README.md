# Ambient Source Sprites

Ambient art is now edited as separate `48x48` PNG files in this folder:

- `cart.png`
- `fishboat.png`
- `sailboat.png`
- `cargo.png`
- `deer.png`
- `cow.png`
- `chicken.png`

The compiled `../ambient-atlas.png` file is a runtime artifact, not the source
of truth. Do not replace these separate prop files with one combined ambient
source sheet. Rebuild with:

```sh
node scripts/verify-sprite-source-contract.mjs
node scripts/build-motion-atlases.mjs
```

The reset material for carts and boats uses CC0 OpenGameArt ship, crate, and
village source PNGs under `_sources/` for provenance. The three animal sources
were generated for Realm's painted pixel-art direction, chroma-keyed to clean
alpha, reduced into generous `48x48` cells, and are intentionally shown only
through contextual runtime rules (wild deer, cow-pen cows, coop chickens).
Replace a single ambient PNG here when a prop needs art direction work; do not
edit the compiled atlas directly.
