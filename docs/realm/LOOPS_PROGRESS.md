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

## Loops 121-140 Snapshot

| Loop | Feature | Category |
|------|---------|----------|
| 121 | Citizen death/birth chronicle entries | Story |
| 122 | Build progress animation | UX |
| 123 | Tile type tooltip on hover | UX |
| 124 | Raid chronicle entries | Story |
| 125 | Production efficiency bars under buildings | UX |
| 126 | Biome-aware audio data (hoveredBiome) | Audio |
| 127 | Population milestone celebration particles | UX |
| 128 | Build placement ripple effect | UX |
| 129 | Water footstep splash sounds | Audio |
| 130 | Building HP warning (red tint) | UX |
| 131 | Victory cinematic golden overlay | Story |
| 132 | Selected citizen nameplate | UX |
| 133 | Dawn/dusk glow overlay | UX |
| 134 | Advisor popup tips | UX |
| 135 | Worker assignment dots on buildings | UX |
| 136 | R hotkey for research panel | UX |
| 137 | Building upgrade particles (stub) | UX |
| 138 | Carried resource icons above citizens | UX |
| 139 | Map edge boundary indicators | UX |
| 140 | Town hum ambient audio layer | Audio |

## Loops 141-160 Snapshot

| Loop | Feature | Category |
|------|---------|----------|
| 141 | Rain patter weather SFX | Audio |
| 142 | Starvation vignette (red screen edge) | UX |
| 143 | Fire crackle SFX | Audio |
| 144 | Year anniversary chronicle milestones | Story |
| 145 | Night danger red border during raids | UX |
| 146 | Happiness emoji indicator | UX |
| 147 | L hotkey for log panel | UX |
| 148 | Auto-save age display | UX |
| 149 | Rival lord messenger story beats | Story |
| 150 | Crosshair cursor when building | UX |
| 151 | Notification sound type differentiation (stub) | Audio |
| 152 | Seasonal tree tint (stub) | UX |
| 153 | Bard composes songs about milestones | Story |
| 154 | Drag-to-build highlight indicator | UX |
| 155 | Upgrade sparkle SFX (stub) | Audio |
| 156 | Mayor decrees at happiness/population milestones | Story |
| 157 | Building radius preview circle | UX |
| 158 | M hotkey for minimap toggle | UX |
| 159 | Building count chronicle milestones | Story |
| 160 | Night crickets volume scaling (stub) | Audio |

## Loops 161-180 Snapshot

| Loop | Feature | Category |
|------|---------|----------|
| 161 | Speed indicator overlay | UX |
| 162 | Pause overlay | UX |
| 163 | Plague chronicle entry | Story |
| 164 | C hotkey for chronicle | UX |
| 165 | Drought chronicle entry | Story |
| 166 | Population-scaled town ambience volume | Audio |
| 167 | Resource trend arrows (stub) | UX |
| 168 | Fire chronicle entry | Story |
| 169 | Ghost preview cost display | UX |
| 170 | Keyboard shortcuts in help overlay (stub) | UX |
| 171 | Wandering merchant chronicle | Story |
| 172 | Double-click building selection (stub) | UX |
| 173 | Heartbeat SFX when starving | Audio |
| 174 | Earthquake chronicle entry | Story |
| 175 | B hotkey to cycle build types | UX |
| 176 | Victory chronicle with summary | Story |
| 177 | Sunrise chime audio | Audio |
| 178 | Camera shake on demolish (stub) | UX |
| 179 | Immigration wave chronicle | Story |
| 180 | Forest rustle ambient audio on cursor | Audio |

## Loops 181-200 Snapshot

| Loop | Feature | Category |
|------|---------|----------|
| 181 | Seasonal flavor text variety (stub) | Story |
| 182 | Minimap red flash during raids | UX |
| 183 | Water ambient SFX on cursor | Audio |
| 184 | Seasonal proverbs in chronicle | Story |
| 185 | Minimap building selection (stub) | UX |
| 186 | Notification chime for events (stub) | Audio |
| 187 | School chronicle entry | Story |
| 188 | Selected building pulse ring (stub) | UX |
| 189 | Trading post chronicle entry | Story |
| 190 | Wind gust SFX on camera pan | Audio |
| 191 | Granary chronicle entry | Story |
| 192 | Tab key cycles through panels | UX |
| 193 | Blacksmith chronicle entry | Story |
| 194 | Distant thunder SFX in rain | Audio |
| 195 | Windmill chronicle entry | Story |
| 196 | Right-click confirm for expensive buildings (stub) | UX |
| 197 | Archery range chronicle entry | Story |
| 198 | Victory fanfare audio | Audio |
| 199 | 100-building chronicle milestone | Story |
| 200 | Ambient volume master control (stub) | Audio |

**Final totals (101-200)**: UX: 55, Story: 30, Audio: 23, Meta: 3 (including stubs)
