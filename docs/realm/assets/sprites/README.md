# Sprite Asset Notes

The current art direction uses painted PNG atlases as the source of truth:

- `buildings-atlas-painted.png` for core settlement buildings.
- `support-atlas.png` for farms, production sites, walls, roads, and small support structures.
- `terrain-atlas.png` for tile overlays.
- `nature-atlas.png` for trees, rocks, ore, mountains, and ground details.
- `ui-icons.png` for HUD resource symbols.
- `actors-atlas.png` for directional settler walk cycles.
- `ambient-atlas.png` for small moving world props such as carts and boats.

The individual `*.svg` files in this directory are compatibility wrappers around cropped raster art. They exist so older code paths, direct image tags, and SVG fallback mode keep working while the live renderer uses atlas PNGs first.

Long term, the useful split is:

- Keep PNG atlases and their generation notes as the editable art pipeline.
- Keep SVG wrappers only as fallback/export shims.
- Avoid hand-authoring new decorative SVG sprites unless the shape is genuinely vector-native, such as UI marks or simple line icons.
