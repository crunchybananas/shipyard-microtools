# Realm — Autonomous Loops Progress

## Through Loop 100 (commit ae409c7)

97 autonomous improvement loops (4 → 100) completed.

### Architecture
- All ambient enhancements live in a single new module `js/enhancements.js`.
- Loops 4-22 wired directly into `main.js` + `render.js`.
- Loop 23 introduced a `register*()` aggregator pattern so loops 23-100 only edit `enhancements.js`.

### Feature catalog (loops 4-100)
Ambient world life: fishing boats, trade ships, merchant carts, mine carts, town crier, royal procession, students, beggars, pigeons, chickens, owls, bunnies, frogs, crabs, rams, hawks, eagles, bats, swallows, dragonflies, bees, fish jumps, wolves, ghosts, wisps, dragon, dragon trail.

Sky & weather: V-formation flocks, hot air balloons + shadows, aurora, comets, meteor impacts, lightning bolts, rainbows, sun lens flare, sun pillars, sheep clouds, constellations, ground mist, rain splashes, puddles.

Seasonal markers: cherry blossoms (spring), pollen bursts, bee swarms (summer), dust devils, autumn pumpkins, acorns, spider webs, hanging spiders, winter ice sheets, snowflakes, snow drifts, snowmen, footprints, well steam.

Building personality: tower banners, church glass + vane + sabbath beam, school books + students, blacksmith embers + glow, well sparkles, windmill blades, tavern toadstools + beggar, house glow + cats + sleep z, status bubbles, selected halo, cart campfires, barracks campfires, trade-cart unloading, building shadows, soldier dust + sunset shadows.

Special events: smoking volcano, victory confetti, castle aura + midday sparkles, town happiness bonfire, gravestones on death, hearts on birth, research sparkle bursts, day-1 sunrise burst, ancient monoliths + glowing runes, compass signposts, festival lanterns, laundry lines, driftwood, fishing nets, raid smoke columns, floating resource emoji, citizen dust trails, glowing forest mushrooms, underwater bubbles, tide foam.

## Loops 101-120 Snapshot

**Mandate pivot**: stop ambient particles/wildlife. Focus on Gameplay UX, Story/Progression, Audio.

| Loop | Feature | Category |
|------|---------|----------|
| 101 | Chronicle of the Realm (story diary with tags) | Story |
| 102 | Highlight all valid placement tiles | UX |
| 103 | Per-building placement sounds (axe, bell, coins...) | Audio |
| 104 | Named mayor, bard, rival lord + milestone beats | Story |
| 105 | Idle citizen '?' indicators | UX |
| 106 | Camera pans to attacked building in raids | UX |
| 107 | Citizen voice barks (procedural sine warbles) | Audio |
| 108 | Resource shortage warnings (flashing HUD) | UX |
| 109 | Hotkey hints in building tooltips | UX |
| 110 | Ctrl+Z undo last build (full refund) | UX |
| 111 | Narrative events: stranger trade, bard song, rival demand | Story |
| 112 | Building count badges in build bar | UX |
| 113 | Lore tooltips on buildings (flavor quotes) | Story |
| 114 | Church bell toll at dawn | Audio |
| 115 | Extended tutorial (house step, hotkey tips) | UX |
| 116 | Seasonal music scales (minor winter, bright spring) | Audio |
| 117 | Combat clang SFX on hits | Audio |
| 118 | Season change chronicle entries | Story |
| 119 | Build queue system | UX |
| 120 | Progress snapshot | Meta |

**Breakdown**: UX: 9, Story: 5, Audio: 5, Meta: 1
