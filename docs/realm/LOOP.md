# Realm — Improvement Loop State

## Rules for Every Loop Tick
1. READ THIS FILE FIRST to know what was done last and what to do next
2. Serve the game: `python3 -m http.server 8889 --directory docs/realm`
3. Navigate Chrome to http://localhost:8889/
4. Fix camera if needed: `const {G}=await import('./js/state.js'); G.camera.x=0; G.camera.y=768;`
5. ACTUALLY PLAY: build at least 2 buildings, watch citizens pathfind, wait for production
6. Identify the BIGGEST issue visible during play
7. Fix it
8. Test the fix by PLAYING AGAIN
9. Commit + push with a descriptive message
10. Update this file with what was done and what's next
11. Schedule next wake

## Last Completed
- Idle citizens now FORAGE from nearby resource tiles (forest→wood, stone→stone, sand→food)
- They pathfind to the nearest resource tile within 6 tiles, gather +1, show floating particle
- Settlement feels alive — 5 of 6 citizens now actively moving even without building jobs
- Mission UI now refreshes each game tick (was only rendering at init before)
- Verified by injecting foraging targets live: 5 citizens immediately started moving to resource tiles

## Known Issues (fix in order)
1. **ES module caching** — browser caches old module versions aggressively. Fixes work on fresh loads (production) but not during dev testing session. Consider: add version query params to sub-module imports, or switch to a dev server with cache-control headers.
2. **No tutorial/guidance** — new player has no idea what to do. Need "Build a house!" prompt on start.
3. **Build placement feedback** — clicking an invalid tile does nothing. Need flash/tooltip/sound for "can't build here".
4. **Night too dark** — game nearly invisible during night phase. Raise floor.
5. **Minimap click broken** — async import() in input.js doesn't resolve correctly.
6. **Missions not triggering** — may be a module identity issue where missions.js imports a different G than main.js uses. Need to verify on a fresh load.

## Next Priority
#2 (tutorial) or #3 (build feedback) — both critical for new-player experience. Also investigate #1 (module caching) since it blocks dev testing.

## Shipped Features
See MISSION.md for the complete feature list with checkmarks.
