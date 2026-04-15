# Realm — Autonomous Improvement Loops (3-agent pattern)

## Pattern per loop
1. **Validator** — sees current state (screenshot + brief), reports weaknesses, no prescriptions
2. **Divergent thinker** — sees current state + "things tried" list, proposes 3 BOLD ideas (not incremental polish)
3. **Implementer** — tight spec from main agent, just executes

## Things tried (avoid re-proposing)
- WebGL 3D prototype (worked for terrain, not buildings)
- WebGL post-processing (shipped: bloom, color grading, AO, film grain)
- Mountain scaling + 4 tree variants (shipped)
- Cinematic lighting (god rays, cloud shadows, directional building shadows)
- Fireflies + dust motes + pollen particles
- Hero castle with stone texture, pennants, arch
- Transparency fix (buildings now fully opaque, multiply-blend night overlay)
- Ground details (boulders, clover, mushrooms, tree stumps, lily pads)
- Seasonal weather (rain, snow particles)
- Citizen directional facing (eyes, mouth, hair)
- Wandering fishing boats on water (loop 4)
- Migrating bird flocks at dawn/dusk (loop 5)
- Hot air balloons drift across daytime sky (loop 6)

## Rules
- Divergent thinker gets sparse context (NOT the full project history). Just: screenshots + "things tried" + "propose 3 non-incremental ideas"
- Validator gets ONLY the new screenshot. No context about what was attempted.
- Main agent picks one idea per loop, commits, updates log.
- If divergent thinker proposes something already tried, reject and re-ask.

## Loop log

### Loop 1 — 295fc38
- Validator: castle doesn't feel elevated; mountains look like wallpaper; houses float like tokens; water is a color zone; assets feel like different games
- Ideas: (1) wildlife ecosystem (2) **procedural road wear** (3) dawn reveal cinematic
- Chose: procedural road wear (addresses "houses float like tokens")
- Implemented: tileWear grid, citizen+soldier movement increments wear, rendered as progressive dirt tint, save/load support

### Loop 2 — 031919e
- Validator: snow caps are stickers; buildings feel like catalog of placed objects; water is linoleum
- Ideas: (1) **living animal herds** (2) spatial ruins layer (3) dynamic fire/torch network
- Chose: living animal herds (kills "catalog of placed objects")
- Implemented: animals.js — deer (near forest), sheep (grass), chickens (near houses), graze/walk state machine, rendered with species-specific sprites

### Loop 4
- Validator: water still feels static and unused — only color/foam, no life on it; nothing happens "out there" in unused parts of the map.
- Ideas: (1) **wandering fishing boats on open water** (2) seasonal migrating bird flocks across sky (3) shipwreck props sprinkled on coastline
- Chose: fishing boats (gives water purpose, complements existing animal life on land)
- Implemented: enhancements.js (new module). Boats spawn in water clusters, wander between water tiles, two kinds (sail + fishing pole with figure), bobbing animation, V-shaped wake. Hooked into main.js sim tick + render.js after animals.

### Loop 5
- Validator: existing single birds feel scattered; sky has stars/moon at night but feels empty during dawn/dusk transitions.
- Ideas: (1) **migrating flocks in V-formation** (2) hot air balloons drifting overhead (3) shooting comets visible at twilight
- Chose: V-formation flocks (timed to dawn/dusk reinforces day/night cycle)
- Implemented: enhancements.js updateFlocks/renderFlocks. Spawns rare flock of 7-12 birds at dawn or dusk, V-formation, dark silhouettes with flapping wings, drift across screen-space sky.

### Loop 6
- Validator: skies have stars, moon, occasional flocks, but daytime sky lacks any spectacle objects above buildings.
- Ideas: (1) **hot air balloons drifting overhead** (2) wind-driven leaves swirling around buildings (3) celestial weather (auroras at night)
- Chose: hot air balloons (daytime spectacle, 5 random colorways)
- Implemented: enhancements.js updateBalloons/renderBalloons. Rare daytime spawn, drift across screen-space sky, gradient envelope, vertical stripe pattern, basket with ropes, gentle bobbing.
