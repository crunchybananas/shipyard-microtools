# Realm — Autonomous Loops Progress

## Through Loop 20 (commit 030ee96)

### Features shipped this batch (loops 4-20)
- L4: Wandering fishing boats on water tiles
- L5: Migrating bird flocks (V-formation) at dawn/dusk
- L6: Hot air balloons drift across daytime sky
- L7: Aurora borealis on winter nights
- L8: Frozen lake ice sheets in winter
- L9: Wolves prowl forest edges at night
- L10: Glowing bioluminescent mushrooms in forest at night
- L11: Dawn ground mist bands
- L12: Festival lantern strings between close houses
- L13: Wandering merchant carts visit markets
- L14: Rainbow after rain stops
- L15: Hawks circling overhead
- L16: Constellation patterns connecting bright stars
- L17: Wet ground puddles after rain
- L18: Town bonfire when happiness is high
- L19: Citizen footprints in snow
- L20: Animated sun with lens flare ghosts

### Architecture
- All features live in new `js/enhancements.js` module — additive, never refactored.
- `update*` functions hooked from `main.js` simTick, `render*` functions hooked from `render.js`.
- Inline `toScreen` in enhancements to avoid circular import with render.js.
- One feature per loop, one commit per loop.

### Themes emerging
- Time-of-day life: dawn mist, hawks at noon, dusk flocks, night wolves/mushrooms/aurora/constellations/bonfire glow.
- Weather aftermath: rainbow + puddles after rain.
- Winter signature: ice sheets, footprints, aurora.
- Town personality: lanterns, bonfire, merchant carts.

80 more loops to go.
