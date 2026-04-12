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
- ✅ Camera centers on island at (0, 768) — generateWorld sets it at runtime
- ✅ Foraging: 2 of 6 citizens actively foraging from resource tiles
- ✅ Build fail feedback: "❌ Can't build here" particle on invalid placement
- ✅ Night raised to 0.55 floor (was 0.3, too dark to play)
- ✅ Tutorial tips system: 6 contextual tips based on game state
- ✅ Import map in index.html for cache-busting module versions
- ✅ Fixed foraging→job priority: citizens now re-check for building jobs immediately after foraging
- ✅ Mission UI refreshes every 60 ticks
- Verified by playing: house placed (wood 60→45, pop 3→6), farm placed, 2 citizens foraging, fail feedback on duplicate build

## Known Issues (fix in order)
1. **Browser module caching** — old module versions stick in Chrome. Must open a FRESH tab + clear site data to test new code. Use `window.G` (exposed from main.js) instead of importing state.js from console.
2. **Play a long session** — now that rAF fallback is fixed, verify 30+ day play with missions/raids/research.
3. **Minimap click broken** — async import() in input.js doesn't resolve.
4. **Workers should be visible at buildings** — citizens assigned to farms should visibly stand near the farm.
5. **Sound on production** — verify SFX fires.

## Dev Testing Note
- `window.G` gives you the real game state from the console (no import needed)
- Game loop uses setTimeout fallback when tab is hidden — game runs even in background tabs
- To bust module cache: clear site data from Chrome DevTools > Application tab, or open an incognito window

## Next Priority
Play a 30+ day session to verify end-to-end game loop. Then focus on making more buildings available earlier + more visual feedback.

## Shipped Features
See MISSION.md for the complete feature list with checkmarks.
