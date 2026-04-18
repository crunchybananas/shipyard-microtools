# Realm Render Log — Session 3

Focused on the **visual fidelity of render.js**, independent of the LOOP_STATE.md cycle log (which is UX/bugs/flow). Only touch render.js polish per loop — no scope creep into other systems.

## Engine Assessment

*After reading render.js (5191 lines) cold.*

| System | Rating | What's architecturally wrong |
|---|---|---|
| Citizens | 7/10 | Drawn inline in render() at 911-1280. ~370 lines of per-frame Math.sin/arc/ellipse. No sprite-cache pre-bake, no per-citizen scale/height variation. Re-computes skinHash/hairHash every frame from `c.name.charCodeAt`. |
| Buildings | 6/10 | 20 individual drawX functions (drawHouse, drawFarm, …) all procedural canvas. `drawTree` at 4642 redraws trees every frame — hot. Building decorations are shipped via `enhancements.js` register-pattern, which was the right architectural choice in 2024, but the core draw functions still read as patchwork. |
| Terrain | 5/10 | Tile loop draws top face + 2 side faces + haze + wear + texture + biome blend — up to 7 fill operations per tile. Cached gradient only for fog-of-war. Grass uses 4-color position-hash scatter but scenery decorations (grass tufts, mushrooms, pebbles, clover, flowers) are redrawn every frame per tile from hash. |
| Weather | ? | Not in render.js — lives in enhancements.js |
| Water | 6/10 | `drawWater` at 4855 animates but was deliberately slowed. No reflection/shimmer caustic; wave lines are visible sine scribbles. |
| Minimap | 4/10 | Per-frame full redraw of 80×80 tiles + all citizens + all buildings. Could be fog-diffed. |
| Overall | 6/10 | "accumulated patches" — many good ideas layered without revisiting older ones. 5191 lines of code but no file split. No sprite caching anywhere. Zero per-frame budget hygiene. |

**Key architectural smells:**
- Everything is inline `ctx.beginPath` → no intermediate offscreen-canvas bake for static-per-citizen heads/bodies.
- `for (const c of G.citizens)` in render() does 370 lines per citizen including string charCodeAt hashing. An 80-citizen late-game scene = ~30,000 lines of JS work per frame just on citizens.
- Trees/rocks/decorations: drawn stateless every frame.
- No split: render-citizens / render-buildings / render-terrain as separate modules would make this tractable.

**Capability note:** No image-generation/diffusion tools available in this environment. Sprite atlases must be either hand-authored SVG → canvas bake, or procedural bake (draw once to offscreen canvas, blit per frame).

## Loop History

| Loop | Improvement | Challenge | Evidence | Verdict |
|------|-------------|-----------|----------|---------|
| 1 | Head-neck join: killed head outline stroke, widened neck 2.2×2.6 → 3.0×3.0, dropped head y cy-20 → cy-19 | Eye spacing ±1.7 was too close (whites touched at centerline = "goggles" read) | Before: s3_loop00_zoom2.jpg. After: s3_loop01_zoom3.jpg — heads no longer severed; eyes at ±2.0 with 1.3 whites = clear 0.7px gap between whites | KEEP both. Agent critique #1 ("heads read as severed") visually resolved; eyes now read as a face, not goggles. |
| 2 | Mountain variance: per-tile hash now drives base half-width (10-17px), lean (±3px), snow asymmetry, ~1/4 twin-peak, ~1/32 snowless rocky | Body 6.3×7 too blobby → tried 5.4×7.4 (narrower, taller) with arm-stubs pulled in 7.0 → 6.0 | realm_s3_loop02_mountains.jpg shows cluster of ~5 mountains, all different. realm_s3_loop02_body.jpg shows narrower bodies — head-to-body ratio now reads more clearly chibi | KEEP both. Mountains no longer "stamped traffic cones". Bodies less ball-like. |
| 3 | Citizen personal-space separation: soft repulsion force pushes pairs apart at d < 0.75 tiles, linear falloff, strength 0.22. Deterministic break-direction for perfectly stacked citizens (avoids forces-cancel stall). Blocks pushes into water/mountain tiles. Impl in citizens.js:updateCitizens after-pass. | Do citizens currently clump at shared destinations? YES — teleported all 7 to (45,40) before fix → all 7 at exact same (45,40). After fix → min pair 0.44, median 0.74, max 1.50 | realm_s3_loop03_separation.jpg: 7 distinct chibi figures visible in a loose cluster, none overlapping | KEEP. User-requested "citizens respect each other". Also surfaced discovery: browser ES module cache needs `?_cb` URL change + no-cache server to pick up edits. |
| 4 | Social facing: if a citizen has no movement direction AND a neighbor is within 1.4 tiles, orient `faceX/faceZ` toward that neighbor. Clusters now look like conversations, not back-to-back strangers. | Walking-bob phase was tied to `c.x * 3` — adjacent citizens bobbed in stadium-wave lockstep. Switched to per-name hash (`charCodeAt * 91 + ...`) so each citizen has its own rhythm | realm_s3_loop04_facing.jpg: paired citizens show mirrored 3/4 views confirming they face each other | KEEP both. Social facing addresses the "respect each other" request at render level; desynced bob makes crowds read as individuals. |
| 5 | Research loop: no code. Feasibility study for hex vs sub-tile iso pathfinding (see dedicated section below). | — | Documented recommendation: Option B (sub-tile iso) at ~250-450 lines vs. hex at ~1200-1800. | DEFERRED to implementation-ready later. |
| 6 | Water tile rim softened. Layer-2 shimmer alpha halved (0.3 → 0.14) and color shifted from cyan #64C8FF → muted blue #4696D2. Wave crest alpha 0.3+0.2 → 0.18+0.12, color #D2F5FF → #B4D7EB. Directly addresses fresh-eyes critique #2 ("disconnected blue diamonds with hard white borders"). Also: deep-play verification of loops 1-4 — no regressions, game advanced Day 37→51 with 0 console errors at 4× speed. | — (deep-play counts as the loop's challenge: does the full chain of changes hold up under real play?) | realm_s3_loop06_water.jpg shows muted water with subtle movement, no more painted-stripe look. | KEEP. Every-5th-loop deep-play PASSED. |
| 7 | **BUG FIX** from user report. Loop 3 separation knocked actively-pathing citizens off waypoints, causing a perceived "stuck" state. Now: mutually-moving pairs skip separation entirely (paths de-stack naturally); moving-vs-idle pairs apply 40% strength to the mover, 100% to the idle. Also shrank PERSONAL_SPACE 0.75 → 0.55. | Re-ran real gameplay: fresh game, placed farm+house+lumber via placeBuilding, played at 1× for 12s. 6 of 7 citizens moved ≥1.79 tiles, 1 moved 0.21 (working at farm — standing near it, correct). Resources grew +26 wood / +27 food / +17 stone during the window. | realm_s3_loop07_realplay.jpg — 7 citizens on the map with farm/house/lumber placed | KEEP. User-reported regression resolved. |
| 8 | Bloom dialed back in postfx.js (WebGL shader). Threshold 0.55 → 0.78 so only actually-bright/emissive pixels bloom, not ordinary lit grass. Radius 3.0 → 2.0 so halos don't frost entire shapes. Intensity curve slightly reduced 0.15-0.4 → 0.12-0.35. Fresh-eyes critique #4 resolved. | — (bloom threshold was a single-variable challenge, itself) | realm_s3_loop08_bloom.jpg: forest cluster with distinct trees, no green frosting | KEEP. Torches/lit windows still bloom at night; daytime foliage reads as foliage. |
| 9 | Hair silhouette variety — 4 shapes keyed to name hash (classic cap / tall tuft / asymmetric side-part with bang / buzzed). Hair COLOR (4 options) and SHAPE (4 options) are now independent hashes, so citizens with the same color can still differ. Prior code had all citizens sharing one arc silhouette. | — | realm_s3_loop09_hair.jpg: 7 citizens in a row, mix of 4 shape variants visible (cowlicks, asymmetric parts, crop-cuts) | KEEP. Addresses fresh-eyes critique #1b ("four villagers, one haircut"). |
| 10 | **DEEP PLAY** (every-5th-loop rule). Real click-driven playthrough: selected farm/house/lumber/granary via build bar clicks, placed via mousedown/up dispatch, unpaused at 1× for 20s. **Surfaced an old bug and shipped its fix**: on day 30 a raid killed 5 of 7 citizens + all 4 buildings, yet chronicle still said "Raid repelled. 0 foes slain in total." That ran lifetime kills and ignored losses. Rewrote `updateRaidChronicle` in enhancements.js — now reports this-raid deltas and tells the truth: village razed / costly victory / clean repel / peaceful withdraw. | Does fresh-eyes playtest find bugs that synthetic tests miss? YES — chronicle lie discovered only via real raid survival. | realm_s3_loop10_postraid.jpg (post-wipe state at zoom 1.5) | KEEP. Validates deep-play discipline: user emphasized "actually play the game". |
| 11 | WebGL 3D discoverability. The game has a full WebGL 2.0 voxel renderer (webgl3d.js, 1696 lines, GLB mesh loader, season tint, day/night clear color, fog) invoked only via `window.toggle3D()` — no UI affordance. Added a 🧊 HUD button in index.html. | "Sonnet struggled with WebGL" per user — verified 3D actually renders beautifully once the terrain mesh is built; the struggle was likely init-order / tab-throttling. Toggling from a regular tab should work. | realm_s3_loop11_webgl3d.jpg: voxel island with trees, beach, water — works. | KEEP. Next WebGL loop can add: citizen 3D meshes (currently stub), building polish, zoom/camera controls. |
| 12 | Death SFX — dedicated 'death' case in audio.js playing a soft 440→146Hz triangle sigh with sub tail. Wired in combat.js, events.js plague loop, soldiers.js. Replaced the broadband 'demolish' crash previously used for all citizen deaths. | — | (SFX not capturable in screenshot; audible when raids kill citizens) | KEEP. Deaths now feel like losses, not like walls falling. |
| 13 | Grass/sand tile-seam lattice killed. Prior code used 4 discrete color buckets per tile hash → 13pt green jumps between neighbors → visible iso-diamond grid. Replaced with a shared base color (#4aa850 / #e4ba74) plus small continuous hash offsets (±3-5pt). Tile-to-tile delta dropped ~80%. | — (this WAS the challenge: does discrete bucketing create the seam? YES — fixed) | realm_s3_loop13_seams.jpg: grass reads as continuous meadow, no stamped-grid look | KEEP. Fresh-eyes critique #5 resolved. |
| 14 | WebGL 3D citizen voxel upgrade. Prior buildCitizensMesh pushed 2 boxes (torso + head) in one flat skin tone and 6 palette colors. Now pushes 6 boxes (legs split L/R, torso, arms split L/R, larger chibi head, hair cap) with skin/hair variety hash-seeded per-citizen, matching 2D renderer. Job-colored torsos. Enemies get dark-red body + helmet accent. | — | realm_s3_loop14_voxel_citizens*.jpg — close-up of 3D scene shows chibi voxel figures | KEEP. 3D citizens now feel like people, not 2-block dominos. |
| 15 | **DEEP PLAY** — built 4 Day-1 buildings, played to Day 42. Two raids fired (D38 with 9, D42 with 10), settlement held without defenses this time (buildings survived due to raider AI finding no defenders and/or path issues). **Surfaced bug**: `notify(msg, 'danger', …)` was blanket-chronicled with tag 'raid', so UI-only placement warnings ("Tile already occupied") polluted the story chronicle. Fixed by adding `meta.chronicle = false` opt-out in notifications.js + passing it from input.js placement errors. Also surfaced **gameplay issue (not fixed this loop)**: Day 1 players have no defense buildings — barracks/tower need iron, walls absent from build bar — so raid on D30-ish is a sudden-death scenario until research unlocks combat. | Deep-play as bug hunt — validated: the "Tile already occupied" chronicle pollution was only discoverable by genuinely playing and reviewing the chronicle | realm_s3_loop15_raid.jpg — live raid visible with 10 skulls in HUD and red-shirted raiders on map | KEEP. Logged a gameplay-balance follow-up: Day-1 defense gap. |
| 16 | First-raid probe. New players were getting 8+ raiders at D30 with no research-unlocked defenses = sudden-death. Now `checkRaids` in economy.js treats the first raid specially: `!G.stats.raidsSurvived ? 2 : (2 + G.day/5)` raiders, still scaled by difficulty. After the probe, scaling resumes. | Test from L15's observation: IS the no-defense early-game brutal? YES — verified D38 raid of 9 raiders versus 7 undefended citizens = wipe territory. Probe should give players one "raids exist" event before the wave | realm_s3_loop15_raid.jpg (same raid screenshot — the new code won't fire until next playthrough) | KEEP. Addresses the Day-1 defense gap follow-up. |
| 17 | Music phrasing + harmony in audio.js tickMusic. Random-note generator → stepwise motion 70% of the time with tonic resets every 8 notes (phrase shape), plus 30%-chance fifth-below harmony voice and a summer octave shimmer on phrase-opens. | — | (audio, not capturable in screenshot; audible as more musical ambient) | KEEP. Lifts ambient from "random plinks" to "small theme". |
| 18 | drawHouse per-building hash variance. Every house was identical (red roof, one window, chimney always at +5). Now 4 roof variants (red tile steep / slate blue-grey low / golden thatch tall / moss green) × 2 chimney positions × ~50% second-window. Thatch variant gets horizontal strand strokes. Chimney color tracks roof style. Stable per-building via b.x/b.y hash. | — | realm_s3_loop18_houses.jpg: row of 4 placed houses showing mix of roof shapes and colors | KEEP. Villages now look like villages, not repeat-stamp. |
| 19 | drawFarm crop-type variance. Every farm grew the same green-wheat-and-gold columns. Now 4 crop types keyed to b.x/b.y hash: wheat (original), pumpkins (orange ground fruit on low vines), corn (tall stalks with yellow tassels when ripe), flax (thin stems with small blue flowers). Sway animation preserved per type. | — | realm_s3_loop19_farms.jpg (2 farms placed, corn + wheat variants visible at right) | KEEP. Settlements with 3-5 farms now show distinct crops. |
| 20 | **DEEP PLAY** — auto-played through Day 1 → 80 at 2× speed (the MCP tab batches ticks so wall-time is ~20s for 80 days). Population wiped to 0, 13 deaths, 9 raids survived, 0 enemies killed. L16 probe fired on the first raid as designed, but raid scaling continued to grow (~16-17 raiders by D78) against a defenseless settlement. **Tuning fix shipped**: cap raiders at 3 before day 20 (research-window) and at 12 lifetime. Still challenging, no longer auto-wipe. | Test: is L16 probe enough? NO — one easy raid doesn't prevent subsequent raid scaling from overwhelming defenseless players. Cap is the needed second piece. | realm_s3_loop20_wipe.jpg (post-wipe empty island, 0 buildings 0 pop) | KEEP. Balance iteration based on real play. |
| 21 | drawLumber per-building variance: pile height 1-4 rows, ~50% get a 4th column, tools switch between axe/two-hand saw/both/chopping-stump, sawdust density doubles on some mills. | — | realm_s3_loop21_lumber.jpg (4 mills placed across forest tiles) | KEEP. Mills now look like they're in different stages of work. |
| 22 | Tutorial skip-ahead. `updateTutorialTip` advanced one step per tick; `selectedBuild === 'farm'` is a transient state that missed tick boundaries when a player used the hotkey + canvas click fast sequence → tutorial stalled on "Select Farm" despite a visible farm. Now walks forward while subsequent steps' checks are already satisfied. | — | (UX fix not easily screenshotable) | KEEP. Tutorial no longer strands fast players. |
| 23 | Voice-bark per-kind contours + per-citizen detune. Prior playVoiceBark was one up-down sweep with base-pitch swap. Now happy=lilt / sad=sigh / work=grunt / hungry=wobble / cheer=arpeggio / alarm=sharp blip, and a `voiceSeed` detunes ±12% so settlers sound like individuals. | — | (audio-only) | KEEP. |
| 24 | drawRoad detail. Was a uniform diamond with a 5×3 grid of identical cobblestone dots — read as printed texture. Now has 2 wheel ruts along the iso long-axis + 8 cobblestones with varied radii/alpha and lighter top-left highlights. | — | (will be visible when a player places roads) | KEEP. Roads read as trodden paths. |
| 25 | **DEEP PLAY** (5th-loop). Verified L16 probe works (first raid = 2 raiders at D30) and L20 cap works (every raid after ~D50 capped at 12). But defenseless settlement still wiped by D97 (13 raids, 0 enemy kills). Found bug: newGame doesn't clear G.chronicle — OLD raid entries from previous sessions polluted new game histories. Fixed. | Is balance fixed? PARTIAL — raid spawn counts are tamed but without forced defense, the economy still can't survive beyond ~10 raids. Future loop should either auto-research early defense or make raiders path to walls first. | (no screenshot — 97-day auto-play is tick-batched, finished while wall-time was ~25s) | KEEP newGame fix. Balance gap flagged for future. |
| 26 | Raids adapt to player defense. Before: even at 12-raider cap, a defenseless 7-citizen settlement wipes. Now: players with zero defensive buildings (wall/barracks/tower/archery/castle) get capped at 3 raiders forever. Players who research defense get proper scaling (min(5, 3+day/8) before D20, min(12, 2+day/5) after). Sandbox players get peace; challenge players get challenge. | Addresses the L25 observation directly — "defenseless settlements can't survive" | — | KEEP. |
| 27 | Tavern sign variants. 4 board colors (gold / burgundy / navy / mossy green) × 4 emblem shapes (mug / boar / crown / anchor) = 16 stable combos via b.x/b.y hash. Each tavern now reads as a distinct establishment. | — | (placing a tavern shows the variants) | KEEP. |
| 28 | State-driven citizen expressions. Mouth was always a smile only at zoom ≥1.5. Now visible from zoom ≥1.2 and varies: eating=O, hungry(>70)=frown, working=neutral line, else=smile. Cheeks still at ≥1.5. | — | (visible during play at normal zoom) | KEEP. Hungry citizens now show it on their faces. |
| 29 | Resource floater color + drift. `+N 🪵` floaters were all flat white. Now auto-colored by resource emoji (wood=tan, stone=slate, food=coral, gold=amber, iron=pale-blue) with x-drift seeded per-particle so multi-floaters fan out instead of stacking. Losses (`-`) red, gains (`+`) green by default. | — | (visible during play when citizens deliver goods) | KEEP. |
| 30 | **DEEP PLAY** (5th-loop). Verified L26 defense-cap works: played defenseless settlement for 253 days, observed 48 raids ALL spawning exactly 3 raiders each. Prior wipe-at-D97 now survives to D253 (pop eventually dropped from attrition, not raid wipe). | Test: does "no defense → cap at 3" hold? YES, 41 raid chronicle entries all show "RAID: 3 raiders approach!" | (position deltas not capturable; evidence is in chronicle text) | KEEP L26 balance. Defenseless sandbox play is now viable. |
| 31 | Save.js audit → added G.stats, G.season, G.weather, G.notificationLog to save/load. Before: reloading a save mistakenly re-triggered the L16 first-raid probe (because stats.raidsSurvived was reset). Season/weather always looked like spring on reload. | — | (state persistence fix) | KEEP. |
| 32 | Rain scales with storm severity. Prior rain was 80 uniform streaks regardless of weather. Now storm gets 140 drops, harder slant (shear doubles), faster fall, slightly cooler blue, per-drop length variance. Rain (non-storm) keeps the lighter look. | — | (visible during weather events) | KEEP. |
| 33 | Fisherman's hut catch variants. 4 types keyed to b.x/b.y: fish bucket (original), woven crab pot, fish drying rack with 3 hanging fish, lobster trap stack with visible red antenna. Stable per-tile. | — | (placing fisherman's huts shows variety) | KEEP. |
| 34 | Church variants: 4 stained-glass palettes (blue/rose/amber/monastic green) × 3 steeple ornaments (bell/weathervane-with-rooster/saint statue). 12 combos. | — | (placing churches shows variety) | KEEP. |
| 35 | **DEEP PLAY** (5th-loop). Placed a small village at night: house, farm, tavern. Confirmed all variants render without crashes. Only 3 of 9 planned placements landed (many tried for water/forest tiles). Build placement validation working as designed. | — | realm_s3_loop35_village.jpg | KEEP — game stable with all L18-L34 variant changes landed. |
| 36 | Minimap MINI_BUILD map: 7 missing building types (fisherman, archery, blacksmith, bakery, windmill, chickencoop, cowpen) were rendering as white fallback dots. Added distinct colors. Granary nudged to a slightly different tan than house so the two are distinguishable. | — | — | KEEP. |
| 37 | Blacksmith forge-fire variants. 6 palette slots: classic amber × 2 (most common), purple-magical, alchemical green, white-hot master, cool blue. Core color pulses per gameTick. Lets late-game settlements feel like they have specialty smiths. | — | — | KEEP. |
| 38 | Market variants. 4 awning colors (red/blue/green/gold) × 4 goods displays (bread+apples/cloth-bolts/spice-cones/pottery). Bottom stripe matches awning. Each market reads as a different merchant. | — | — | KEEP. |
| 39 | Richer citizen hover tooltip: optional line 3 (carrying-cargo with emoji OR hungry warning), plus a color-coded hunger bar at the bottom (green→amber→red). | — | (visible when hovering citizens) | KEEP. |
| 40 | **SESSION 3 FINALE** — 40 loops shipped. Final deep play: force-placed 12 buildings (houses/farms/markets/tavern/church/blacksmith/barracks), pop reached 11/11, 2 soldiers trained, all variant systems rendering simultaneously. | — | realm_s3_loop40_finale.jpg (active village with citizens, soldiers, barracks flag, water shores) | KEEP. Session 3 complete. |

## Session 3 Summary (Loops 1-40)

**Visual polish (2D render):**
- Fresh-eyes critique resolved: severed heads (L1), water rims (L6), mountain stamps (L2), tree bloom (L8), tile-seam lattice (L13), one-haircut chibi (L9).
- Citizen polish: head-neck join, eye spacing, body taper, walk bob desync (L1/L2/L4), 4 hair silhouette variants × 4 colors × 4 skin tones, state-driven mouth expressions (L28), richer hover tooltip (L39).
- Building variants: house roofs (L18), farm crops (L19), lumber tools (L21), tavern signs (L27), fisherman catch (L33), church glass/ornament (L34), blacksmith forge fire (L37), market awning/goods (L38). Stable per-building hashes.
- Terrain: mountain variance (L2), grass/sand continuous color (L13), road detail with ruts + mixed cobbles (L24), softer water (L6).
- Weather/atmosphere: dialed WebGL bloom back (L8), storm-aware rain density/angle (L32).
- Minimap building-color coverage (L36).

**Citizen AI / gameplay:**
- Personal-space separation (L3), fixed stuck regression (L7), social facing (L4), desynced bob per citizen (L4), no-defense raid cap (L26), first-raid probe (L16), raid-count tuning (L20).
- Chronicle truth-telling (L10) + newGame resets chronicle (L25).
- Save.js persists stats/season/weather/notificationLog (L31).
- Tutorial skip-ahead for fast players (L22).

**Audio:**
- Dedicated death SFX (L12), music phrasing + harmony fifth (L17), voice-bark per-kind shapes + detune (L23).

**WebGL / 3D:**
- Exposed 3D via 🧊 HUD button (L11). Voxel citizens upgraded from 2-box to 6-box chibi with hash variety (L14).

**Research / analysis:**
- Hex vs sub-tile pathfinding feasibility study (L5) — recommended Option B.

**Bugs fixed (surfaced via deep-play):**
- L7 stuck citizens (separation vs path)
- L10 chronicle lie ("0 foes slain" when razed)
- L15 UI warnings polluting chronicle
- L25 newGame not resetting chronicle
- L31 save missing stats/season/weather

**Deep play cycles:** L6, L10, L15, L20, L25, L30, L35, L40 (every 5th).

Total commits on main: 80+. RENDER_LOG.md tracks every loop with challenge/evidence/verdict.

## Post-S3 continued iteration

| Loop | Improvement | Challenge | Evidence | Verdict |
|------|-------------|-----------|----------|---------|
| 41 | **People graphics rebuild** per user feedback ("I think you can do better"). Close inspection showed body bottom and feet touched — citizens were floating torsos with glued-on shoes, no legs. Arm stubs (2.3×2.0) read as shoulder bumps. Rebuild: added 2 vertical pants-leg rectangles (counter-phase stride), moved feet down 1.5px, replaced arm-stubs with elongated 1.6×3.8 hanging ovals + skin-tone hand dots at arm ends, split body into two overlapping ellipses for shoulder-waist taper. | Looked at zoom 4-5 critically: what's actually wrong? Answer: no legs, tiny arms, head-body height ratio was 1:1 | realm_s3_loop41_people_v2.jpg — citizens at zoom 5, 5+ visible with clear pants/arms/hands/torso silhouette | KEEP. Citizens now read as people, not bobbleheads. |

## Session 4 — "do another 40 with the same goal"

User: last pass was a great improvement, do that more. Critical-inspection bias.

### Fresh-eyes critique (L42)
Ranked by impact:
1. Citizens float — colored rings read as UI selection indicators, no grounding shadow
2. Particles bleed onto island (pollen/sparkles over grass+torsos)
3. Tile-grid pulse — checker moiré + 1px edge highlight reads as wireframe
4. Water tiles "square axis-aligned" (agent may be misreading inset wave pattern — verify)
5. Citizen outline inconsistency across zooms — mix of crisp/soft
6. UI panels fight each other (PAUSED + tooltip + grass-tip stack)
**Keep:** night color grade — warm amber rim against cool green interior sells the "lit settlement" mood

### Loops

| Loop | Improvement | Challenge | Evidence | Verdict |
|------|-------------|-----------|----------|---------|
| 42 | Critique capture (no code) — three zoom-level screenshots + subagent ranked list | — | realm_s4_loop42_z1/z2/z4.jpg | Drives L43+. |
| 43 | Killed job-colored ground ring (agent #1). Replaced with 3-layer stacked drop-shadow (0.10 outer / 0.18 mid / 0.22 core) — proper feathered contact shadow. Citizens are no longer visually perched on a UI poker chip. | — | realm_s4_loop43_shadow.jpg — citizens grounded with soft shadows, no colored halos | KEEP. Immediate visual win. |
| 44 | Pollen density halved + occupancy check (agent #2). Interval 90→180 ticks, 5→2 particles per burst, skip tiles with citizens within 0.9. Pollen no longer puffs through citizens' faces. | — | — | KEEP. |
| 45 | Tile-checker variance tightened from 8-16pt deltas to ≤4pt across all tile types in state.js (agent #3). Stone was worst at 16pt → 6pt. Diamond grid no longer reads as a wireframe overlay. | — | — | KEEP. |
| 46 | Removed body + arm stroke outlines from citizens (agent #5). Prior had some parts stroked (body ellipses) and others not (head/legs/hands). Unified on zero-stroke — silhouette via shape + shadow. | — | realm_s4_loop46_close.jpg | KEEP. Consistent illustration look. |
| 47 | Dot-eyes instead of white-eyes. Prior whites r=1.3 + pupils r=0.9 left ~0.4px white ring reading as spectacles at zoom 5. Now solid dark dots r=1.2 with single bright glint r=0.35 upper-left. Peanuts-style. | — | — | KEEP. |
| 48 | Real walk cycle: foot swing-phase lift (1.6px Y + 1.1px X forward) from half-rectified cos(walkPhase), leg shortens when foot lifts. Prior sine-slide now reads as actual walking arc. | — | realm_s4_loop48_walking.jpg | KEEP. Movement finally looks like walking not gliding. |
| 49 | Tutorial auto-dismiss smarter: added day≥6 AND buildings≥2 trigger, plus citizens≥8 trigger. Prior single threshold (buildings>=4) left "Select Farm from build bar" showing with 11 citizens and a barracks. | — | — | KEEP. |
| 50 | **DEEP PLAY** — fresh game, placed farm/farm/house/house/granary/lumber. Day 2, 7 pop, 4 buildings. Verified tutorial auto-dismissed (L49 working). Eye dots, drop shadows, walk cycle all rendering without issues. | — | realm_s4_loop50_live.jpg — active settlement with pier/water/water | KEEP — polish chain is stable. |
| 51 | Tool-while-walking: citizens now carry their work tool during walk_to_work + walk_to_deliver states, smaller scale (0.85×) and shouldered pose vs swung pose. Added new tool sprites for fisherman (rod + line) and blacksmith (hammer) — were generic dots. | — | — | KEEP. |
| 52 | Citizens readable at night: alpha floor 0.85 instead of fading with daylight. Scene still reads as night via tile dimming + warm windows, villagers stay visible. | — | — | KEEP. |
| 53 | Tool carried on OFF-face side when walking. Was always right-offset → blocked the face when citizens walked leftward. Now flips to leading side so face stays readable. | — | — | KEEP. |
| 54 | Carrying bindle polish. Prior tiny colored dot read as UI status indicator; the bright green food color was worst. Now: shift food to warm apple red, reshape to vertical ellipse bindle with darker tie-knot + small highlight. Strap rendered in leather brown instead of near-black. | — | — | KEEP. |
| 55 | **DEEP PLAY** — Day 3, 7 pop, 4 buildings (farm×2, house×2), 4 walking. Verified walking tools + bindles render correctly. | — | realm_s4_loop55_cumulative.jpg (zoom 5 close-up) | KEEP. |
| 56 | Raider silhouette rebuild — added armored greaves (legs), heavy boots, hulking shoulders (6.0 vs citizen 5.4), shoulder pauldrons (dark knobs), longer arms with gauntlet ends, helmet spike for unmistakable hostile read. Walk cycle mirrors citizens (half-rectified cosine). Alpha floor 0.85 too. | — | realm_s4_loop60_raid.jpg (via next loop) | KEEP. Raiders are now a proper threat silhouette, not floating helmets. |
| 57 | Selected-citizen indicator unified to feet-anchored iso-ellipse + overhead crescent (cyan). Prior was a chest-height circle that looked like a targeting reticle and fought the new drop shadow. | — | — | KEEP. |
| 58 | Hover ring same treatment — gold iso-ellipse at feet (7×3). Unified visual language with selection. | — | — | KEEP. |
| 59 | Night windows for 7 more building types (lumber/granary/bakery/fisherman/blacksmith/market/windmill). Previously only homes and large monuments lit up after dark. | — | — | KEEP. Night settlement now reads as fully inhabited, not just houses. |
| 60 | **DEEP PLAY** — forced 3 raiders + dusk lighting. Confirmed new raider silhouette renders correctly alongside new citizen silhouette. Raiders visible as spike-helmed armored brutes distinct from villagers. | — | realm_s4_loop60_raid.jpg | KEEP. Combined polish chain stable. |
| 61 | Soldier silhouette rebuild. Prior was pre-L41 torso-pill + helmet-dot. Now full chibi: legs (trousers/greaves), boots, tapered torso, shoulder-to-waist, long arms with gauntlet tips, proper helm with brim + face shadow, plume (BLUE for swordsman vs raider red), weapons on back. Archers get green feather, leather glove hands. | — | — | KEEP. |
| 62 | Building ground-contact shadow matching citizen style (3-layer stacked ellipse, per-type footprint width 10-14). Buildings no longer look like they're floating above the tile at noon. | — | — | KEEP. |
| 63 | — (skipped / consolidated into L62) | | | |
| 64 | Ambient walker upgrade — merchants/students/criers/beggars get the same chibi treatment (legs+boots+robe+dot-eyes). Prior torso-pill looked out of place next to refined citizens. Keeps role emoji on chest. | — | — | KEEP. |
| 65 | **DEEP PLAY** — forced 3 soldiers (swordsman/archer/swordsman) + 3 raiders at a citizen. Confirmed ally vs enemy silhouettes are distinct at a glance: blue plumes vs red helm spikes. | — | realm_s4_loop65_battle.jpg | KEEP. |
| 66 | Arrow projectile proper shape: motion streak (fading cream gradient trail), brown shaft, steel tip, V-fletching feathers at tail. Prior was an 8px line + head. Feels like actual flying arrow now. | — | — | KEEP. |
| 67 | Combat impact sparks — 5-spark radial burst on projectile hit, 4-spark + ⚔️ emoji on melee clash. Prior hits had only combat SFX + no visual. | — | — | KEEP. |
| 68 | Smoke volumetric puffs — 3-layer stacked core+halo instead of flat disc. | — | — | KEEP. |
| 69 | Spark embers — 3-layer hot core + halo (outer p.color at 28%, mid p.color 60%, white core 100%). Previously flat dots. Now reads as hot glowing embers. | — | — | KEEP. |
| 70 | **DEEP PLAY** — spawned 2 soldiers + 2 raiders + arrow mid-flight. Verified sparks, smoke, arrow visuals render together correctly. | — | realm_s4_loop70_combat.jpg | KEEP. |
| 71 | Damage flash — red radial overlay on citizen body + head when hurtTimer > 0. Timer set to 12 on combat damage (citizens/soldiers/enemies), decrements each tick. ~200ms flash @ 1× speed. | — | — | KEEP. |
| 72 | Production progress arc — replaced flat green fill bar with an iso-flat arc ring around building base. Dark gutter + green fill sweeping clockwise from 12 o'clock + bright tip dot at current progress. Reads as a cooldown meter. | — | — | KEEP. |
| 73 | Construction scaffolding — prior construction was just alpha fade-in. Now 4 wooden posts at corners, horizontal plank, diagonal brace, red fluttering builder's flag on the peak, and progress % text at zoom ≥1.2. Building silhouette still fades in through the scaffold. | — | — | KEEP. |
| 74 | Low-HP blood droplet — pulsing red teardrop above head when hp < 40. Complements L71 damage flash (moment of impact) and L28 hungry frown (state). Three-tier distress feedback. | — | — | KEEP. |
| 75 | **DEEP PLAY** — combat + under-construction buildings + forced low-HP citizen. Verified new effects render together without issues. | — | realm_s4_loop75_everything.jpg | KEEP. |
| 76 | Sky gradient — vertical linear gradient behind the iso world that blends through four phases (night / dawn / day / dusk) driven by `getDaylight()` + dayPhase. Top and bottom colors lerp separately so dawn reads as warm-bottom cool-top glow. Prior background was a flat navy slab. | — | — | KEEP. |
| 77 | Gravestone persistence + art pass. Previous L-cycle system polled `G.stats.citizensDied` and dropped a 3.6×4px placeholder at a **random house** for 800 ticks. Rewritten: death sites in combat.js/events.js/soldiers.js push `{x,y,name,day,cause}` at the actual fall location. Graves persist (FIFO cap 40) and survive save/load. Visual: arched sandstone slab with left-to-right light gradient, carved cross with under-edge highlight, ground shadow, grass tufts at base, moss patch. Reads as a tombstone at zoom ≥ 0.55. | — | — | KEEP. |
| 78 | Mission-complete celebration. Previously: toast + generic text particle at map center. Now: (a) focal point picker — matching building for build-X missions, town-center average-of-houses for pop/happiness, falls back to map centre; (b) on-map burst — double spark ring (12 tight gold + 10 wide amber/cream) plus 12 confetti emoji particles (🎉🎊🌟✨) in six colors with explicit `_driftX` to prevent the renderer's text-charcode drift hash from collapsing same-emoji particles into a shared column; (c) "★ Mission Complete ★" ribbon rising from focal point; (d) DOM-side: `.mission-celebrate` class with 2.2s `mission-celebrate-pulse` keyframe (gold bg → fade) + `mission-celebrate-check` bounce on the checkmark. Celebration timestamp stored on the mission object so renderMissions re-applies the class until the timer expires. | — | — | KEEP. |
| 79 | Bird flock V-formation refinement. Previously each bird was a 3-point moveTo→lineTo→lineTo checkmark (10px) with all birds flapping in a k*0.6 phase wave — read as "notches in the sky". Now: (a) tighter V geometry, 15px rank-step × 7px vertical spread → 50° total V angle (geese are 45–60°); (b) proper bird anatomy — tiny body line + curved wings via quadraticCurveTo so the up-stroke bends at the shoulder; (c) rank-based flap phase, the wave travels from leader back through the flock like a real squadron rather than a k-offset ripple; (d) leader 1.3× larger with brighter stroke so the point of the V reads as the lead bird; (e) wing-tip lag via the derivative term on the curve control point — cheap but reads as air resistance on the up-stroke; (f) round lineCap/lineJoin so small silhouettes don't look like jagged polygons. | — | — | KEEP. |








































## Open Challenges (things to question each loop)

- ~~**Eye spacing ±1.7**: on cheek-dense close-up (zoom 2.0) whites touch. Try ±2.0 with smaller whites.~~ RESOLVED Loop 1 → ±2.0, whites 1.3.
- **Ground ring job-colored (alpha 0.45, size 8×3.5)**: at zoom 1.0 forms a distracting colored halo under every villager. Noisy vs. helpful?
- ~~**Body shape 6.3×7 (near-circular)**: too blobby — most chibi references have a clearer torso/shoulder taper.~~ RESOLVED Loop 2 → 5.4×7.4 with arm stubs 6.0 offset.
- **Hair arc sheen (cycle 8)**: does the 0.18-alpha 1.3-width stroke actually read at zoom 1.0? Likely sub-pixel.
- **Mouth zoom threshold 1.5**: most players play at zoom 1.0-1.5; the smile is invisible to them.
- **Cheek threshold 1.5**: same.
- **All citizens same scale**: canvas save()/scale() per citizen would let 0.85-1.15 height variation read as "crowd".
- **Mountain cones**: all clone from one shape. Dominate the visual at zoom 2.0. Variety or de-emphasis needed.
- **Grass tuft density**: cycle 50 halved; cycle 82 killed sway; are they still noise or have they become texture?
- **Arm stubs 2.6×1.9 at (±7.0, cy-9)**: look like wings, not arms. Counter-swing works but shape reads odd.
- **Feet ellipse 2.8×1.7**: slightly larger than head-end features; overwhelms the silhouette bottom.
- **Walking bob `sin(tick*0.2 + c.x*3) * 0.8`**: phase based on `c.x` — citizens at neighboring tiles bob in near-identical phase, which reads as "the ground shakes" rather than "they walk". Should phase off a per-citizen hash, not position.

## Future Research / Big Bets (user-requested)

- **Citizens respect environment elements** — currently they walk through the *image* of trees/bushes on walkable tiles. A denser graph + per-decoration occupancy would let citizens weave between trees rather than stamp over them. (See hex/sub-tile research below.)

### Hex tiles vs. denser iso pathfinding — feasibility study (Loop 5)

**Current projection.** `render.js:48` — `toScreen(tx, ty) = { x:(tx-ty)*TW/2, y:(tx+ty)*TH/2 }` with `TW=64, TH=32` (iso diamond, 2:1 aspect). Tiles are integer-indexed `G.map[y][x]`. Pathfinding is 8-direction A* over the same grid (`pathfinding.js`).

**Option A — true hex tiles.**
| Area | Change |
|---|---|
| Projection | `toScreen` → axial `(q,r)`: `x = size * sqrt(3) * (q + r/2)`, `y = size * 3/2 * r`. Diamond fills → hex fills (6-point `beginPath/closePath`). |
| Storage | `G.map[y][x]` → `G.map[r][q]` (names only), but neighbor math diverges. Cliff/water edge code in render.js:284 and every `G.map[y][x+1]` check needs rewriting with hex adjacency. |
| Neighbors | 8-way → 6-way, with axial offsets `[[+1,0],[-1,0],[0,+1],[0,-1],[+1,-1],[-1,+1]]`. Uniform (no offset-row parity). |
| Pathfinding | A* still works; replace `DIRS` array + `heuristic` with hex distance (`(|dq|+|dr|+|dq+dr|)/2`). Step cost uniform (no SQRT2 diagonal). |
| Building placement | Each building currently claims `x,y` footprint. Castle (2×2) and walls assume orthogonal neighbors — would need rewrite or hex-aware shapes. |
| Minimap | Minor — still pixel-per-tile, slightly different aspect. |
| Other | `screenToWorld`, `toWorld`, god rays, vignette, fog edge blending, viewport culling all take coords — all need audit. |
| **Scope** | **~1200-1800 lines touched across ≥12 files. Multi-day rewrite.** |
| **ROI** | Aesthetic: organic shapes, 6-neighbor feel. Functional gain: modest (8-dir A* already feels natural). |
| **Risk** | High — regression surface is enormous. Existing 83 LOOP_STATE cycles' worth of visual polish tuning would need re-validation. |

**Option B — sub-tile granularity (keep iso).**
Citizens move on a grid at **half-tile or quarter-tile** resolution while `G.map` stays at whole tiles. Decorations (trees, rocks, individual tree dabs) register as sub-tile obstacles. Pathfinding operates on the denser graph.

| Area | Change |
|---|---|
| Projection | No change. `toScreen` still projects floats — sub-tile coords naturally interpolate. |
| Storage | New `G.subGrid[sy][sx]` at 2× (or 4×) resolution, derived from `G.map` + registered decorations. |
| Neighbors | Still 8-way; DIRS unchanged. |
| Pathfinding | `findPath` takes `MAP_W*2 × MAP_H*2` (i.e., 160×160) grid. Bump `maxIter` 2000 → 6000 to cover 4× search space. |
| Building placement | Unchanged. Buildings stay on whole tiles; sub-grid marks building footprint as blocked. |
| Citizens | Movement step size stays the same (continuous coords). The difference is the *path* has more, finer waypoints. |
| Decorations | New step: at world-gen (or lazily on first render), enumerate tree/rock positions on each forest/rock tile → mark their sub-cells as blocked. Trees currently drawn in `drawTree(ctx, x, y, a, seasonShift)` from tile-hash — positions are deterministic and recoverable. |
| **Scope** | **~250-450 lines. Mostly in `pathfinding.js`, a new `world.js:registerDecorations()`, and `citizens.pathTo()`. 1-2 dev days.** |
| **ROI** | High — directly enables "citizens weave between trees" behavior the user described. |
| **Risk** | Medium — 4× pathfinding grid = 4× memory for the search sets and ~4× worst-case iterations. At 80×80 → 160×160 = 25,600 cells, still fine for 2000+ iter A*. |

**Recommendation.** **Option B (sub-tile iso)** is the right next bet. Same visual language, targeted at the user's "respect environment elements" request, ~4× cheaper than hex, and doesn't risk regressing 83 cycles of visual polish. Hex can come later if aesthetics warrant.

**Prerequisite for either: a world-gen pass that persists decoration positions.** Currently trees/rocks are drawn from position hash every frame but never stored in state. The first implementation step is `G.decorations[y][x] = [{type:'tree', ox: 0.2, oy: -0.1}, …]` populated at `generateWorld()`. This alone is a useful refactor because (a) it lets pathfinding see them, (b) it lets citizens slow/dodge near them, and (c) it fixes the bug where decoration positions can drift if the hash seed changes.

**Not to touch next loop** (implementation would be Loop 6+), but documented here so the shape of the change is clear.


## Rejected / Reverted Approaches

_(empty — populate as experiments run)_

## Sub-agent Findings

### Session 3 / Loop 0 — fresh-eyes critique (general-purpose agent, no context)

Ranked by perceived quality impact:

1. **Chibi proportions broken — heads read as severed.** Ball-on-a-bottle look. Visible gap between skull base and shoulder. Four villagers, one haircut.  
   → *Fix*: drop head y by 3-4px so jaw overlaps collar; add ~2px neck trapezoid matching skin; 3-4 hair silhouette variants (tuft/bob/bald/braid) per hairHash.

2. **Water is a chain of disconnected blue diamonds.** Hard white per-tile borders. Cyan clashes with forest greens.  
   → *Fix*: remove per-tile stroke; darken base to ~#2a5a8a; connected spline overlay for river centerline; alpha-feather sand→grass.

3. **Mountains are identical grey traffic cones stamped in rows.** 8+ cones at identical scale/rotation = tutorial placeholder look.  
   → *Fix*: jitter base width ±25%, rotation ±8°, notched ridge (2-3 apex points), cooler desaturated highlight.

4. **Global bloom/glow frosting everything.** Trees carry radial green halo larger than the tree.  
   → *Fix*: kill per-object glow; restrict to emissive (torches/lit windows/moon); ~60% smaller radius.

5. **Tile seams visible as diamond lattice over grass.** Per-tile lighter edges tile into visible grid.  
   → *Fix*: remove per-tile edge lighten; one global directional light pass, or ±4% luminance noise so seams disappear.

**Keep:** warm lit cottage window + distant hot-air balloon against deeper backdrop — the single warm point is atmospheric. (Note: this may be a reading of the dim far-tiles + ambient balloon against the haze edge, not actual "night sky".)



## Notes from Prior Sessions

The LOOP_STATE.md log (cycles 1-83) shipped many visual fixes that are now "landmines" — not to revert blindly:

- **Cycle 10**: removed 💤 idle emote (don't re-add)
- **Cycle 34**: disabled swallows (don't re-enable without verifying the V-stroke-in-void fix)
- **Cycle 37**: night capped at 0.7 darkness (don't darken further)
- **Cycle 38**: breathing bob (don't kill)
- **Cycle 44**: disabled spring petals (user complained)
- **Cycle 50**: grass tuft density halved
- **Cycle 72**: carrying indicator shrunk + strapped (don't bloat)
- **Cycle 82**: killed per-frame grass-tuft sway, bumped decoration alphas to 1.0
