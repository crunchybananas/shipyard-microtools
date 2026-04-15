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
- Aurora borealis on winter nights (loop 7)
- Frozen lake ice sheets in winter (loop 8)
- Wolves prowling at night (loop 9)
- Glowing bioluminescent mushrooms in forest at night (loop 10)
- Dawn ground mist bands (loop 11)
- Festival lantern strings between houses (loop 12)
- Merchant carts visit markets (loop 13)
- Rainbow after rain (loop 14)

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

### Loop 7
- Validator: winter nights look identical to other nights aside from snow particles; no signature winter atmosphere.
- Ideas: (1) **aurora borealis on winter nights** (2) frozen lake ice sheets (3) dynamic constellations
- Chose: aurora (high visual payoff, signature winter mood)
- Implemented: enhancements.js renderAurora. Three undulating colored ribbons (green/cyan/violet), screen-blend mode, only at night during winter season, animated by sine waves.

### Loop 8
- Validator: winter only changes ground tint and adds snow particles; water remains liquid blue, breaking immersion.
- Ideas: (1) **frozen lake ice sheets** (2) wolves at night near forest (3) frozen waterfall/icicles on stone tiles
- Chose: ice sheets (highest-impact winter visual, ties season to water tile)
- Implemented: extra layer in drawWater (render.js) — pale ice overlay with deterministic crack patterns and snow drifts when G.season === winter. Boats still render on top (slightly silly but fine).

### Loop 9
- Validator: nights are visually atmospheric but lack threatening creatures; deer/sheep don't react to time of day.
- Ideas: (1) **wolves prowling near forest at night** (2) ghostly will-o-wisps in marshes (3) glowing mushrooms in dark forests
- Chose: wolves (adds tension + nocturnal life balancing daytime herbivores)
- Implemented: enhancements.js updateWolves/renderWolves. Spawn near forest at night, prowl between forest/grass, yellow glowing eyes, occasional howl arc indicators, despawn at sunrise.

### Loop 10
- Validator: forest tiles look identical at night vs day — only darken; missing magical/dangerous undertone.
- Ideas: (1) **glowing bioluminescent mushrooms** (2) low ground mist between trees (3) wisp lights between branches
- Chose: glow mushrooms (cheap render, deterministic placement, adds magic)
- Implemented: enhancements.js renderGlowMushrooms — deterministic per-tile (~12% of forest tiles), 2-4 cyan-green glow points per cluster, screen-blend, pulse animation, only at night, only on visible viewport.

### Loop 11
- Validator: dawn transitions are flat — color shifts but no atmospheric depth at horizon.
- Ideas: (1) **dawn ground mist** (2) chimney smoke columns visible from far (3) sun rays through trees
- Chose: dawn mist (subtle but powerful mood)
- Implemented: enhancements.js renderGroundMist — three undulating soft horizontal bands fading in/out around dawn (strong) and dusk (weak).

### Loop 12
- Validator: dense town areas have no human-warmth markers; just clumps of houses with no decoration linking them.
- Ideas: (1) **festival lantern strings between close houses** (2) market awnings/stall canopies (3) town square paving
- Chose: lantern strings (visually striking at night, organically wires the town)
- Implemented: enhancements.js renderLanterns. For every house/tavern pair within 3 tiles, draw a sagging rope with 4 colored lanterns; bright halos at night via screen blend.

### Loop 13
- Validator: trade economy is invisible — gold appears with no spatial story; markets sit alone with no traffic.
- Ideas: (1) **wandering merchant carts visit markets** (2) caravan campfire props (3) ghost fishing nets in shallow water
- Chose: merchant carts (visualize commerce, narrative payoff)
- Implemented: enhancements.js updateCarts/renderCarts. Spawn at map edge, travel to a market, unload, depart back to edge. Horse + canvas-cover wagon sprite with wheels + bobbing.

### Loop 14
- Validator: weather changes pass without payoff — rain just stops.
- Ideas: (1) **rainbow after rain** (2) puddles on ground after rain (3) wet shine on building roofs
- Chose: rainbow (cheap, iconic, big payoff)
- Implemented: enhancements.js updateRainbow/renderRainbow. Detect rain→clear transition, draw 7-band screen-space arc rainbow with fade in/out for ~25 sec.
