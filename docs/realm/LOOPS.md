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
- Hawks circle overhead (loop 15)
- Constellation line patterns at night (loop 16)
- Wet ground puddles after rain (loop 17)
- Town bonfire when happiness high (loop 18)
- Citizen footprints in snow (loop 19)
- Animated sun with lens flare ghosts (loop 20)
- Spontaneous snowmen near houses in winter (loop 21)
- Cherry blossom canopies in spring forests (loop 22)
- Smoking volcano on a mountain peak (loop 23)
- Floating status bubbles above buildings (loop 24)
- Aggregator hooks for future loops (loop 23 refactor)

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

### Loop 15
- Validator: sky has flocks/balloons/birds but they all travel linearly; nothing hovers/observes the world.
- Ideas: (1) **hawks circling overhead** (2) constellations connecting stars at night (3) shooting stars from horizon
- Chose: hawks (hovering predator above complements wolves below)
- Implemented: enhancements.js updateHawks/renderHawks. Rare daytime spawn, circle elliptically around a center point, triangular wings + tail fan silhouette.

### Loop 16
- Validator: night sky has stars but no structure; eye doesn't latch onto patterns.
- Ideas: (1) **constellation patterns connecting bright stars** (2) zodiac wheel near horizon (3) crescent moon phases per day
- Chose: constellations (mythic feel, simple line art)
- Implemented: enhancements.js renderConstellations. Three named patterns (dragon/cup/archer) at fixed screen-space coords with line-connecting bright stars + cross sparkles.

### Loop 17
- Validator: rain ends with no trace; ground returns to dry instantly. Need wet-aftermath.
- Ideas: (1) **puddles after rain** (2) wet-shine roof tint (3) muddy roads
- Chose: puddles (cheap, distinct, complements rainbow)
- Implemented: enhancements.js updatePuddles/renderPuddles. After rain ends, deterministic ~22% of grass/sand tiles get blue elliptical puddles with sky glint, fade out over ~30 sec.

### Loop 18
- Validator: happiness is just a UI bar; nothing in the world reflects mood.
- Ideas: (1) **town bonfire when happiness > 65** (2) cheering villagers near tavern (3) confetti when scenario won (already kind of done)
- Chose: bonfire (passive worldspace happiness indicator + nighttime warmth)
- Implemented: enhancements.js renderBonfire. Above town center, logs + flickering flame layers + warm halo at night, only when happiness ≥ 65.

### Loop 19
- Validator: snow accumulates only on building roofs; ground stays static, citizens leave no trace.
- Ideas: (1) **citizen footprints in snow** (2) snowmen built spontaneously (3) icicles dripping
- Chose: footprints (kinetic, organic trail telling movement story)
- Implemented: enhancements.js updateFootprints/renderFootprints. Each citizen drops a small dual-print every 20 ticks in winter, fade out over ~10 sec; capped at 200 prints.

### Loop 20
- Validator: god rays exist but the actual sun is invisible; daytime sky lacks a focal point.
- Ideas: (1) **animated sun + lens flare** (2) cloud rim-lighting (3) sun reflection on water tiles
- Chose: lens flare (defines sky direction, animates with time of day)
- Implemented: enhancements.js renderLensFlare. Sun position interpolates left→right across the day, radial gradient sun + 4 colored ghost spots along the sun→center axis.

### Loop 21
- Validator: winter has new ice/aurora/footprints but no playful winter activity.
- Ideas: (1) **snowmen built spontaneously** (2) sledding citizens on hillside (3) ice fishing huts on frozen water
- Chose: snowmen (cheap, charming, persistent across the season)
- Implemented: enhancements.js updateSnowmen/renderSnowmen. Periodically spawn 3-tier snowman near a random house in winter, with hat/eyes/carrot nose/stick arms; cleared when winter ends.

### Loop 22 — cherry blossom canopies in spring forest tiles (deterministic per tile, ~25%, pink/white puffs).

### Loop 23 — refactor: registerUpdater/Renderer aggregator added so future loops only edit enhancements.js. First registered feature: smoking volcano on a single mountain peak (orange glowing crater + drifting grey smoke plumes).

### Loop 24 — floating status bubbles above buildings ('?' for understaffed, '!' for low food on farms).
