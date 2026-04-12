# Realm — Development Mission

## Vision
A professional-quality settlement builder inspired by Caesar 3, Stronghold, and Civilization. Zero dependencies, pure web tech. The goal is a game that makes people say "an AI built this?"

## File Structure
```
docs/realm/
├── index.html          # Shell, CSS, HTML layout
├── js/
│   ├── main.js         # Init, game loop, glue
│   ├── world.js        # Map generation, terrain, fog, noise
│   ├── render.js       # Canvas rendering, iso helpers, building sprites, minimap
│   ├── citizens.js     # Citizen AI, state machine, pathfinding (A*)
│   ├── economy.js      # Resources, production, buildings, trade
│   ├── missions.js     # Goals, progression, unlock tree
│   ├── combat.js       # Raids, defense, military units
│   ├── audio.js        # Web Audio SFX (synthesized, no files)
│   ├── input.js        # Mouse, keyboard, touch, camera controls
│   ├── ui.js           # HUD updates, build bar, tooltips, info panels
│   ├── save.js         # localStorage serialization, auto-save
│   └── particles.js    # Floating numbers, smoke, sparkles
├── MISSION.md          # This file — the loop reads it each tick
```

## Priority Queue (each loop picks the top incomplete item)

### Phase 1: Core Systems (make it feel alive)
- [x] Isometric tile engine + procedural island
- [x] Building placement + resource economy
- [x] Citizen spawning + basic AI
- [x] Day/night cycle + raids
- [x] Mission/goal system
- [ ] **A* Pathfinding** — binary heap, 8-directional, road speed bonus. Citizens MUST pathfind around water/mountains. Cache path on citizen, only recompute on state transition.
- [ ] **Citizen AI State Machine** — idle → find_job → walk_to_work → working → walk_to_deliver → deliver → idle. Active nearest-building job seeking. Visual carrying.
- [ ] **Floating Resource Particles** — "+2 🪵" floats up on production. World-space coords, rendered each frame.
- [ ] **Web Audio SFX** — build click, production ding, raid alarm, mission fanfare. Pure oscillator synthesis.

### Phase 2: Visual Polish (make it beautiful)
- [x] **Isometric Building Sprites** — each of 12 types drawn as proper canvas path art. Houses with peaked roofs/chimneys, farms with field patterns, towers with crenellations, etc. NO emoji — pure drawn art.
- [x] **Minimap** — 160x160 corner canvas. Full island, building markers, citizen dots, camera viewport rect. Click to jump.
- [x] **Terrain Polish** — beach wave edges on sand tiles adjacent to water, grass shade variation per tile via position hash (3 shades), animated water ripples.
- [x] **Citizen Variety** — job-colored clothing (green=farm, brown=lumber, grey=quarry, gold=market, etc.), walking bob animation (sin-based vertical oscillation), leg swing, hair variety per name hash, shoulder-mounted resource carrying.
- [x] **Particle Effects** — smoke rising from chimneys (houses, taverns, lumber mills), drifts sideways, grows and fades. Capped at 200 particles.

### Phase 3: Depth (make it strategic)
- [ ] **Building Selection & Info** — click building → info panel (HP, workers, rate). Right-click demolish with half refund.
- [ ] **Save/Load** — full state to localStorage. Auto-save every 60s. Rebuild all cross-references on load.
- [x] **Technology Tree** — 8 techs with prerequisites: Agriculture/Forestry (free, pre-researched) → Masonry → Engineering/Metallurgy, Commerce → Brewing, Metallurgy → Military. Research panel overlay with progress bar. Build bar auto-filters to unlocked buildings only. Persisted in save/load.
- [ ] **Trade Routes** — send caravans between your settlement and map-edge trading posts. Risk/reward.
- [ ] **Happiness Detail** — breakdown panel showing positive (tavern, well) and negative (overcrowding, starvation) factors.

### Phase 4: Content (make it deep)
- [ ] **More Missions** — 25+ missions across 5 tiers. Each tier unlocks after completing 3 from the previous.
- [ ] **Events** — random events: drought (food -50%), gold rush (+gold), plague (happiness crash), migration wave (+settlers).
- [ ] **Seasons** — visual + gameplay: winter slows farms, summer boosts growth, autumn harvest bonus.
- [ ] **Advanced Buildings** — church, school, castle, harbor, granary, warehouse, aqueduct.
- [ ] **Military Units** — train soldiers at barracks, assign to towers, sally forth during raids.

### Phase 5: Polish (make it ship-quality)
- [ ] **Tutorial Overlay** — first 3 minutes: arrows pointing to build bar, "click here to place a house", etc.
- [ ] **Statistics Panel** — graphs of population/resources over time.
- [ ] **Achievements** — "First Settlement", "Iron Age", "Fortress", "100 Citizens", etc.
- [ ] **Performance** — culling off-screen tiles, dirty-rect rendering, WebGL upgrade path.
- [ ] **Music** — procedural ambient music via Web Audio (drone + melody layers based on game state).

## Rules for Each Loop Iteration
1. Read this MISSION.md to pick the top incomplete item
2. Implement it across the appropriate file(s)
3. Serve the game (`python3 -m http.server 8889 --directory docs/realm`)
4. Test in Chrome via the MCP tools — verify the feature works visually and functionally
5. Commit with a descriptive message
6. Push to main
7. Schedule next wake (120-270s depending on task size)
8. Mark the item as [x] in this file when done

## Architecture Notes
- All files are ES modules (`type="module"` in script tags)
- Shared state lives in `main.js` and is imported by other modules
- The game loop runs in `main.js` and calls update/render from other modules
- No build step — just serve the directory
- Keep each file under 400 lines for readability
