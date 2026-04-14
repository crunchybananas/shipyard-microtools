# Realm — 100-Iteration Autonomous Roadmap

## Design North Star (inspired by)
- **Caesar 3**: walker AI, service coverage, trade routes, disasters, scenarios
- **Stronghold**: production chains (wheat→flour→bread), castle economy, military
- **Warcraft 2**: military units, direct combat, fog of war
- **FarmRush/FarmVille**: crop cycles, livestock, harvest loops
- **SimCity**: zoning, utilities, service radius

## Vision
A medieval settlement-builder-meets-light-RTS where the player grows an island kingdom through:
1. Multi-step production chains (raw → processed → refined)
2. Service coverage (happiness from church, culture from school, entertainment from tavern, water from well)
3. Military recruitment and combat (not just static defense)
4. Trade routes with actual caravan logistics
5. Scenarios/campaign with specific objectives
6. Disasters/events that challenge the player

## Current State (as of iteration 0)
- 17 buildings with detailed sprites
- Citizen AI with automatic job-finding
- Tech tree with 9 technologies
- Day/night cycle, 4 seasons
- 12 random events
- WebGL post-processing
- Basic raids (static damage)
- 15+ missions

## Iteration Phases

### Phase 1 (iterations 1-20): Deep Gameplay Foundations
- Production chains (wheat→mill→bakery→bread; wood→carpenter→furniture)
- Service radius/coverage system
- Walker AI refinement (market traders, priests, etc.)
- Food types (bread, meat, fish — variety requirement)
- Livestock buildings (chicken coop, cow pen)
- Storage separate from raw production
- Tax collection from houses

### Phase 2 (iterations 21-40): Military & Combat
- Recruit soldiers from barracks (actual units, not just defense value)
- Unit types: swordsman, archer, knight
- Select and command units
- Enemy raiders approach from edge of map
- Archer towers fire arrows (animated projectiles)
- Battle animations, blood particles
- Military campaigns/scenarios

### Phase 3 (iterations 41-60): Trade & Diplomacy
- Trade routes with named foreign cities
- Request/send specific resources
- Caravan pathfinding across map
- Sea trade via trading post with boats
- Market demand system (prices fluctuate)
- Emissary/diplomatic events

### Phase 4 (iterations 61-80): World & Scenarios
- Multiple island types (tundra, desert, island)
- Scenario system (campaign with objectives)
- Disaster types (fire, flood, plague)
- Named NPC figures (advisors)
- Story events per scenario

### Phase 5 (iterations 81-100): Polish & Depth
- Animated water reflections via shader
- Building upgrade visual progressions
- Citizen portraits & detailed info
- Achievement expansion
- Balance pass
- UI/UX final polish

## Rules
1. Every iteration = one clear, committable improvement
2. Direction can shift based on emerging ideas
3. Must maintain 60fps throughout
4. Must not break existing systems
5. Commit and push each iteration
6. Update this file's "Completed" section as iterations land

## Completed (30/100)
- iter 0: roadmap created
- iter 1: bread production chain (windmill+bakery boost farms)
- iter 2: livestock (chicken coop, cow pen)
- iter 3: service coverage radius system
- iter 4: tax collection from houses
- iter 5: fisherman hut (coastal food)
- iter 6: actual soldier units spawn from barracks
- iter 7-8: visible enemy raiders + arrow projectiles
- iter 9-10: game stats tracking + panel
- iter 11-12: soldier melee combat with enemies
- iter 13-14: blacksmith building (soldier damage boost)
- iter 15: rally point (shift+right-click)
- iter 16-17: raid warning + walls block enemies
- iter 18-19: 3 scenarios with objectives
- iter 20: LOD optimizations
- iter 21-23: trade partners + trade panel
- iter 24-26: disasters (fire, plague) with spread
- iter 27-30: HUD soldier/threat count, resource deltas, polish

## Verified in browser
- Scenarios load correctly
- Combat (soldiers vs enemies) works
- All new building sprites render
- HUD indicators update
- Missions complete with toast

## Known bugs to fix
(none currently — citizen auto-assign to barracks verified working)

## Verified iter 45 state (browser test)
- Archery Range builds + trains 3 archers
- Barracks trains 4 swordsmen
- Both unit types kill enemies successfully
- Archery Range sprite renders with target + arrow
- Scenario progress "0/3" indicator shows correctly
- All 5 scenarios available on title screen

## Verified iter 30 state (browser test)
- Title screen scenario selector works (Peaceful/Military/Merchant)
- Scenario starts with correct resources + raid timing
- Citizens auto-assign to barracks (workers added, soldiers trained)
- Soldiers patrol with correct chibi sprites (grey armor + red plume)
- HUD shows soldier count, threat indicator, emoji resources
- Missions panel shows active scenario + objectives
- All new buildings render correctly
