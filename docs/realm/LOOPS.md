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
- Rare dragon flyover (loop 25)
- Wind-rippled wheat halos around farms (loop 26)
- Perched owls in forest at night (loop 27)
- Large 3-masted trade ships along map edges (loop 28)
- Sparkles orbiting wells (loop 29)
- Slow comets across deep-night sky (loop 30)
- Wandering ghost wisp at night (loop 31)
- Frogs hop on sand near water at night (loop 32)
- Visible jagged lightning bolts in rain (loop 33)
- Mountain rams on stone tiles (loop 34)
- Bee swarms around farms in summer (loop 35)
- Will-o-wisps in forest at night (loop 36)
- Spider webs in autumn forests (loop 37)
- Crabs scuttle on sand (loop 38)
- Soldier campfires by barracks at night (loop 39)
- Fluttering banners on watch towers (loop 40)
- Pigeons near markets (loop 41)
- Citizen motion dust trails (loop 42)
- Swallows dart in spring sky (loop 43)
- Warm window glow on houses at night (loop 44)
- Rotating windmill blades overlay (loop 45)
- Acorns drop in autumn (loop 46)
- Pulsating tide foam on coastal sand (loop 47)
- Snow drift mounds beside buildings (loop 48)
- Dust devils on summer sand (loop 49)
- Victory confetti rain (loop 50)
- Cart campfires while unloading (loop 51)
- Mine carts at iron mines (loop 52)
- Fish jump from water with splash (loop 53)
- Drying laundry between houses (loop 54)
- Day-1 sunrise burst (loop 55)
- Toadstools around taverns (loop 56)
- Smoke columns during raids (loop 57)
- Fishing nets in shallow water (loop 58)
- Golden aura over castle on victory (loop 59)
- Fluffy sheep clouds drifting (loop 60)
- Spiders hanging on threads (loop 61)
- Research-complete sparkle burst from school (loop 62)
- Dense fireflies over summer water edges (loop 63)
- Bunnies hop on spring grass (loop 64)
- Sleep z-bubbles above houses at night (loop 65)
- Forge embers around blacksmiths (loop 66)
- Rooster weather vanes on churches (loop 67)
- Sabbath light beams from churches (loop 68)
- Compass signposts at map edges (loop 69)
- Pumpkin patches at farms in autumn (loop 70)
- Bats fly across night sky (loop 71)
- Heart particles on population growth (loop 72)
- Floating resource emoji from producers (loop 73)
- Chickens orbit chicken coops (loop 74)
- Pulsing halo under selected building (loop 75)
- Gravestone markers on citizen death (loop 76)
- Town crier walks across map (loop 77)
- Dragonflies over summer water (loop 78)
- Midday golden sparkles around castle (loop 79)
- Driftwood logs on sand (loop 80)
- Large screen-space snowflakes in winter (loop 81)
- Steam from wells in winter (loop 82)
- Underwater bubbles rise on water tiles (loop 83)
- Rooftop cats nap on houses (loop 84)
- Beggar with coin bowl beside taverns (loop 85)
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

### Loop 25 — rare dragon flyover (screen space): purple body, animated wings, occasional fire breath.

### Loop 26 — wind-rippled wheat halo around each farm building (animated sway).

### Loop 27 — owls perched on forest tiles at night (silhouettes + glowing yellow eyes that blink + occasional 'hoo' text).

### Loop 28 — large 3-masted trade ships traverse map edge water (entry from left/top, exit on opposite side; flag, big sails).

### Loop 29 — magical blue sparkles orbit each well building.

### Loop 30 — slow majestic comets across deep-night sky (gradient teardrop tail + glowing head, distinct from existing fast meteors).

### Loop 31 — wandering ghost wisp at night (rare, fades in/out, drifts on land tiles).

### Loop 32 — frogs hop on sand near water at dusk/night, occasional throat-puff croak.

### Loop 33 — visible jagged lightning bolts during rain (multi-segment paths from sky downward + glow halo).

### Loop 34 — mountain rams clamber on stone tiles (curling horns).

### Loop 35 — bee swarms (yellow striped dots with wing blur) buzz around farms in summer.

### Loop 36 — colored will-o-wisps drift in forest at night (cyan/blue/violet).

### Loop 37 — spider webs draped on autumn forest tiles (radial+concentric, deterministic ~18%).

### Loop 38 — crabs scuttle sideways on sand tiles.

### Loop 39 — campfires beside each barracks at night, with flickering flame and seated soldier silhouette.

### Loop 40 — fluttering red banners with white cross atop each watch tower.

### Loop 41 — pigeons walk and peck near markets.

### Loop 42 — subtle dust trails behind moving citizens (high-zoom only).

### Loop 43 — swallows dart erratically across spring daytime sky (small forked silhouettes).

### Loop 44 — warm window glow on houses+taverns at night (flickering candlelight).

### Loop 45 — visibly rotating 4-blade windmill overlay on each windmill.

### Loop 46 — acorns drop from autumn forest tiles, settle on the ground.

### Loop 47 — pulsating tide foam on sand tiles bordering water (slow tidal cycle).

### Loop 48 — snow drift mounds piled on east side of every building in winter.

### Loop 49 — twisting dust devils on summer sand tiles.

### Loop 50 — continuous confetti rain after winning a scenario or the main game.

### Loop 51 — small campfire next to merchant carts while unloading at market.

### Loop 52 — small mine cart slides back-and-forth on track at iron mines.

### Loop 53 — occasional fish jumps out of water with arc + splash ripple.

### Loop 54 — laundry lines between adjacent houses with swaying colored clothes.

### Loop 55 — opening-day sunrise burst (radial god rays) only on day 1.

### Loop 56 — red-cap toadstool clusters around taverns.

### Loop 57 — dark smoke columns rise from random land tiles during raids.

### Loop 58 — floating fishing nets with buoys in water tiles bordering sand (~12% spawn).

### Loop 59 — pulsing golden aura over castle after victory.

### Loop 60 — fluffy 'sheep clouds' drift across daytime sky with soft shadows.

### Loop 61 — small spider hangs from web thread in autumn forest tiles (rare).

### Loop 62 — magical sparkle burst from school when research completes.

### Loop 63 — extra dense firefly clouds over water-edge tiles in summer nights.

### Loop 64 — bunnies hop across grass in spring (white tail).

### Loop 65 — sleepy 'z' bubbles drift up from each house at night.

### Loop 66 — orange forge glow + rising embers around each blacksmith building.

### Loop 67 — rooster weather vane on each church spire (oscillates with wind).

### Loop 68 — golden light beam shines up from churches at the start of every 7th day (sabbath).

### Loop 69 — N/S/E/W stone signposts at map edges (orientation cue).

### Loop 70 — pumpkin patch decorations around farms in autumn.

### Loop 71 — bats erratically fly across screen at night.

### Loop 72 — heart particles burst from a random house when population grows.

### Loop 73 — small chance per tick that production buildings float a resource emoji upward.

### Loop 74 — chickens orbit and peck near each chicken coop building.

### Loop 75 — pulsing golden ellipse halo under any selected building.

### Loop 76 — small temporary gravestone marker spawns at a random house when a citizen dies.

### Loop 77 — town crier in red coat walks across map ringing a bell occasionally.

### Loop 78 — dragonflies hover over water tiles in summer (translucent wings).

### Loop 79 — golden sparkles orbit castle rooftop at midday peak daylight.

### Loop 80 — driftwood logs scattered on sand tiles (deterministic ~8%).

### Loop 81 — large 6-arm snowflake silhouettes drift down the screen in winter.

### Loop 82 — wells emit visible steam plumes in winter (warm water vs cold air).

### Loop 83 — small bubble pairs rise from random water tiles (suggests fish / underwater life).

### Loop 84 — cats nap on rooftops of ~1/8 houses (orange or black tabby).

### Loop 85 — cloaked beggar with coin bowl sits beside each tavern.
