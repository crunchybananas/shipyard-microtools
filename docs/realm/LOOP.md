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

## Last Completed (verified on FRESH module load)
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
1. **Missions not completing visually** — missions may need more game time to trigger (check runs every 60 ticks). Verify on a longer play session.
2. **Minimap click broken** — async import() in input.js doesn't resolve correctly.
3. **Workers should be visible at buildings** — citizens assigned to farms should visibly stand near the farm, not wander away.
4. **No sound on production** — verify SFX fires when farms/buildings produce.
5. **Research panel may need more play testing** — verify tech unlocks work end-to-end.

## Dev Testing Note
Use import map version bumping: change `?v=5` to `?v=6` etc. in index.html to bust browser module cache. Or clear site data from Chrome DevTools.

## Next Priority
Play a longer session (30+ days) at 4x speed to verify missions, raids, production, and research end-to-end.

## Shipped Features
See MISSION.md for the complete feature list with checkmarks.
