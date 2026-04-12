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
- Fixed camera starting position (was at x:768 y:0, should be x:0 y:768)
- Camera fix placed in generateWorld() so it runs at init regardless of cached defaults
- Verified: island visible, house placed (wood 60→45, pop 3→6), farm placed
- Verified: citizen AI works (1 citizen pathfinding to farm job), production ticks, particles visible
- Verified: missions complete, food economy creates tension

## Known Issues (fix in order)
1. **Second farm click often fails silently** — clicking near-center after placing one building often hits the same tile or a non-grass tile. Need better visual feedback: show the actual tile that would be built on, flash red if invalid.
2. **Most citizens idle** — only 1 farm so only 1 worker needed. Early game needs more building variety guidance. Consider: auto-assign idle citizens to gather nearby resources even without buildings.
3. **Food economy too tight** — 80 starting food lasts ~15 days with 6 citizens. Player MUST build farms immediately or starve. Starting food could be 100, or slow consumption more.
4. **No tutorial/guidance** — new player has no idea what to do. Need at minimum a "Build a house first!" prompt.
5. **Smoke particles pile up** — with many buildings, particle count grows. Already capped at 200 but verify performance.
6. **Night too dark** — at minimum daylight the game is barely visible. Lighten the night floor.
7. **Minimap click doesn't work** — the import() in input.js for minimap click is async and broken.

## Next Priority
Pick #1 (build feedback) or #4 (tutorial) — both improve new-player experience significantly.

## Shipped Features
See MISSION.md for the complete feature list with checkmarks.
