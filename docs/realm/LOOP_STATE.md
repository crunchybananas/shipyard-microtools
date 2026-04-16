# Realm Improvement Loop — Live State

## How This Works
Every ~15 minutes, the main agent wakes up and runs one cycle:
1. Read this file for context
2. Screenshot the game in Chrome (ground truth)
3. Spawn a fresh-eyes VALIDATOR agent (only sees screenshot, no history)
4. Compare validator critique to BACKLOG — pick highest-impact task
5. Spawn a focused IMPLEMENTER agent with tight spec
6. Reload Chrome, verify the change works
7. Update this file with results
8. Schedule next wake-up

## Anti-Stagnation Rules
- If validator says "looks good" 3x in a row → pivot focus area (see FOCUS below)
- If implementer breaks something → fix-only cycle, no new features
- If same issue appears 2x → escalate to STUCK list
- Never skip Chrome verification
- Implementer agents get MAX 1 file to edit per cycle (keeps diffs small)
- NEVER use alert(), confirm(), or prompt() — they block Chrome MCP
- ALWAYS check console errors after changes — 60fps error loops cause lockups
- If an enhancement references a symbol not imported in its file, the function must be disabled or the import added

## Deep-Play Cycles
Every 5th cycle (51, 56, 61, ...), run a DEEP PLAY session instead of just screenshotting Day 1:
1. Navigate, new game, skip tutorial
2. Place 1 House + 1 Farm + 1 Lumber Mill via canvas clicks on the build bar then on tiles
3. Click ▶▶▶ fast-forward, let 3-5 days pass
4. Screenshot mid-play — check: workers assigned? food producing? citizens walking with purpose?
5. Continue until first raid (or 10 days max) — screenshot during combat
6. Open chronicle/stats panel, screenshot
7. Validator gets these screenshots — NOT just title screen
Deep-play cycles surface real quirks (combat flow, post-raid state, food/hunger loop, building worker assignment) that Day 1 screenshots miss.

## Current Focus Area
VISUAL_CLEANUP
<!-- Rotate through: VISUAL_CLEANUP → UX_FLOW → GAMEPLAY_DEPTH → STORY → AUDIO → repeat -->

## Focus Rotation Order
1. VISUAL_CLEANUP — rendering bugs, artifacts, clutter reduction
2. UX_FLOW — click targets, feedback, tutorials, discoverability
3. GAMEPLAY_DEPTH — balance, progression, meaningful choices
4. STORY — narrative events, character moments, chronicle
5. AUDIO — ambient layers, SFX, music

## Validator "Looks Good" Counter
0
<!-- Reset to 0 when focus area changes. At 3, rotate to next focus area. -->

## Last Cycle
- **Number**: 71 (deep-play)
- **What**: Deep-play run (House at 42,42 + Farm at 45,42; fast-forwarded to Day 28) triggered the severe Plague event at Day 15. Observed: population dropped 7→5 (2 citizens plague-killed), but `G.stats.citizensDied` stayed at 0, no chronicle entries named the dead, and no particles played. Cycle 49 fixed the identical class of bug for *combat* deaths, but plague was missed. Second issue in the same function: the description says "−1–2 citizens" but code was `Math.min(2, ...)` — always 2. Fix in events.js (severe plague onStart, line 253-269): randomized `1 + Math.floor(Math.random()*2)` for 1-or-2 losses; for each lost citizen, increment `G.stats.citizensDied`, push a `🪦 {name}` death particle, and chronicle `"${name} succumbed to the plague. The healer could do nothing."`. Parallels cycle 49 combat-death cleanup. events.js only.
- **Verified**: Chrome ?_cb=92 — fired severe plague manually via imported `EVENT_DEFS`. Before: `died=0, pop=3, chronicleCount=2, particles=17`. After: `died=2, pop=1, chronicleCount=4 (+2 new "death"-tagged entries: "Ulf Glen succumbed..." / "Celia Dale succumbed..."), particles=19 (+2 tombstone markers)`. All three previously-missing signals now fire. No console errors. Randomization landed on 2 this test; rerun would sometimes pick 1.
- **Validator notes (cycle 71, deferred)**: (1) Notify banner truncates the plague description mid-word ("−1–2 cit...") — banner width or text should fit. (2) "D15..Autumn begins!" notification renders on top of the House build card in the build bar — position/z-index conflict. (3) No iron mines on starting island means the "Iron mines are crucial" advisor tip is not actionable (trigger gate?).

## 40-Cycle Milestone Summary (addendum)
Bugs caught via Chrome verification that blind agents had shipped:
- loadGame import missing (game wouldn't start)
- confirm() dialog blocking automation
- Undefined BUILDINGS causing 60fps crash loop
- Insta-damage raids (no combat played out)
- Combat destroying buildings without proper cleanup
- Build-bar buttons toggling off unexpectedly
- Duplicate "Welcome to Realm" notification
- Birds/swallows spawning in vignette void
- Stats panel "Days Lived: 0" on Day 1

User-reported bugs (cycles 30-34): all 4 addressed — combat, build buttons, ambient floaters, post-raid state cleanup.

Polish wins: tile hover tooltip near cursor with terrain hints, mission list with gold-highlighted next objective, happiness panel roadmap showing unbuilt happiness buildings, trade panel empty-state sells the system, achievement panel "lifetime progress" clarifier, title screen Continue button shows save summary instead of bytes, build bar selection lift + glow, gold coin consistent styling, citizens 1.4x larger with colored ground circles + idle breathing, vignette softens void into atmosphere, night darkness capped for playability.

Pattern held: Chrome-verified loop + rotating validator focus (research/chronicle/citizens/stats/title/achievements/trade/happiness/log/tile-hover/combat/build-bar/accessibility) kept finding real issues without getting stuck on Day 1 empty-map critique. Anti-stagnation note: when validator repeats a critique (e.g. "citizens feel static"), look for what's actually broken in observable gameplay — the recurring complaint about "minimap is vestigial" turned out to be wrong (minimap already had dots).

## Backlog (prioritized)
1. [HIGH] USER-REPORTED (partial): After a raid wipes everything, can't place new buildings — cycle 31 fixed worker/maxPop cleanup but may need to verify canPlace after destruction
2. [HIGH] USER-REPORTED: Some ambient floating things look weird — audit remaining screen-space renderers (what's still rendering off-map or in odd spots)
3. [MED] DEEP-PLAY OBSERVATION: newly-placed building briefly shows "0/1" workers until next assignment tick — either auto-assign on place, or render "(assigning...)" until settled
4. [MED] DEEP-PLAY OBSERVATION: citizens cluster/stand near farm once assigned — walking-to-work looks like standing-still unless you watch closely. Consider a more visible "in transit" marker.
5. [HIGH] Citizens feel like static decoration — need idle animation, movement, or visible agency (partially addressed cycle 38)
6. [HIGH] Minimap is vestigial — RESOLVED (dots + viewport visible as of recent cycles)
7. [MED] "Found!" citizen bark fires on Day 1 with no context (RESOLVED cycle 36)
8. [MED] Sleep "Z" indicator needs context/legend
9. [LOW] Night is very dark — hard to see anything (addressed cycle 37, may revisit)
10. [LOW] Pollen/dust particles could be toned down further

## Stuck (needs investigation)
(empty — vignette resolved the void clutter issue)

## Completed
- Cycle 1: loadGame import fix (game couldn't start)
- Cycle 1: confirm() dialog removal (blocked Chrome MCP)
- Cycle 1: Sunrise burst disabled (overwhelmed screen)
- Cycle 1: Space effects disabled (meteors, comets, constellations, dragon, sun pillars)
- Cycle 1: Map boundary dots + animal clamping
- Cycle 2: Citizens 1.4x larger + colored ground circles + vibrant job colors
- Cycle 2: Animal screen-bounds check
- Cycle 3: CRITICAL — Fixed game lockup from 3 enhancement functions using undefined BUILDINGS (renderWorkerDots, renderRadiusPreview, renderGhostCost)
- Cycle 4: Radial vignette mask — hides void clutter, softens map edge
- Cycle 5: Disabled sheep clouds + strengthened vignette — void clutter now fully hidden
- Cycle 6: Hide empty HUD categories (iron, gold, soldiers) + defensive import audit (clean)
- Cycle 7: Replaced gold emoji with styled golden glyph — no longer reads as missing asset
- Cycle 8: Fixed Church mission text to hint at stonework research prerequisite
- Cycle 9: Added tooltips to all 9 top-right icon buttons — no more opaque iconography
- Cycle 10: Removed 💤 idle emote — citizens no longer look comatose on Day 1
- Cycle 11: Mission list visual hierarchy — next objective highlighted, later dimmed
- Cycle 12: Dynamic resource tooltips — food/wood/stone show meaningful context
- Cycle 13: Strengthened build-bar active state — lift + glow for tactile selection
- Cycle 14: Defensive guards for BUILDINGS[type] in 4 places — prevents crashes from bad state
- Cycle 15: Happiness HUD clarity — face emoji (reflects level) + tooltip instead of misleading ☀️
- Cycle 16: Per-resource red highlight on unaffordable costs in build bar + live refresh
- Cycle 17: Softened vignette — less "post-process stamp", more natural atmosphere
- Cycle 18: Gated premature scholar advisor tip to real research context
- Cycle 19: Lock badge on unaffordable build cards — accessibility for colorblind
- Cycle 20: Gold coin rendering fix extended to research panel + tooltips
- Cycle 21: Fixed "realm of Realm" chronicle collision + added founding flavor text
- Cycle 22: Hide pop panel assign dropdown when no understaffed buildings exist
- Cycle 23: Stats panel — fix Days Lived=0, add live Current group with day/pop/buildings
- Cycle 24: Title screen Continue button — human summary instead of raw KB
- Cycle 25: Achievements panel — "lifetime progress" clarifier text
- Cycle 26: Trade panel empty state — teaser pitch + accurate next step with Commerce prereq
- Cycle 27: Happiness panel — "Ways to Raise Happiness" roadmap section with potential bonuses
- Cycle 28: Fixed duplicate "Welcome to Realm" notify in event log
- Cycle 29: Tile hover tooltip near cursor + terrain building hints
- Cycle 30: Raid combat fix — removed abstract insta-damage, enemies & soldiers now fight visibly
- Cycle 31: Combat cleanup fix — enemies destroying buildings now calls demolishBuilding()
- Cycle 32: USER BUG FIXED — build-bar buttons no longer toggle off when clicked while selected
- Cycle 33: Build bar periodic refresh updates CSS in place instead of rebuilding DOM
- Cycle 34: USER BUG FIXED — disabled swallows (screen-space V-strokes in the vignette)
- Cycle 35: Void clutter — birds spawn offscreen, vignette tighter, pollen interior-only
- Cycle 36: Removed "Found!" bubble on forage — redundant with +resource particle
- Cycle 37: Capped night darkness at 0.7 + lighter multiply tint — scene stays playable after dark
- Cycle 38: Idle citizens get subtle breathing bob — no longer look frozen
- Cycle 39: Brighter gold coin glyph with stronger glow
- Cycle 40 (milestone): Build-bar cost affordance gradient — 3-state (white/amber/red) tension cue
- Cycle 41: Added orientation doc to enhancements.js about disable convention
- Cycle 42: Happiness emoji threshold fix — displayed % now matches shown face
- Cycle 43: Widened building click hit-box (44x58 → 56x72) for 1.3x render scale
- Cycle 44: USER BUG — disabled spring petals ("squares with circles coming down center"). Verified hit-box working.
- Cycle 45: Mission objectives show progress count like "(3/10)" in gold
- Cycle 46: USER BUGS — citizens flee/die near enemies, silent placement fails now explain why
- Cycle 47: Extended mission progress counts to Merchant/Seafaring/Industrial scenarios
- Cycle 48: demolishBuilding — no refund when byEnemy, clamp maxPop/defense to 0
- Cycle 49: Citizens killed by enemies now actually die — pop decrements, citizensDied stat fires, death particle/chronicle (cycle 46 had damage but no death handler)
- Cycle 50 (milestone): Halved grass tuft density (55%→27%, dense variant 31%→14%) — central plains were reading as noisy clutter per fresh-eyes validator
- Cycle 51 (first deep-play): Added Deep-Play rule (every 5th cycle plays through multiple days). First run: confirmed cycle 50 grass-tuft fix visibly works, observed Spring→Autumn transition, logged 2 new deep-play observations to backlog (worker assignment delay, citizen transit visibility). No code change — process cycle.
- Cycle 52: Minimap unexplored tiles rendered as #070810 ≈ background, making island invisible on Day 1. Now render at globalAlpha 0.28 with actual tile color — full silhouette always visible.
- Cycle 53: Desaturated HUD toolbar icons (filter:saturate(0.7)) so trophy 🏆 no longer dominates siblings. Hover restores full saturation.
- Cycle 54: USER BUG FIXED — build-bar two-click bug. Removed renderBuildBar() from 30-tick periodic path in main.js; it was wiping bar.innerHTML every 500ms and racing real mouse clicks between mousedown and click. updateBuildBarAffordability() inside updateUI() already handles in-place cost/lock updates.
- Cycle 55: Difficulty dot (🟡/🟢/🔴) was wrapping to an orphan second line under the day-display text. Added white-space:nowrap to #day-display in index.html — full "Year 1, Day 1 · 🌱Spring · 😐50% 🟡" now stays on one row.
- Cycle 56 (deep-play): CRITICAL — simTick's `% N === 0` checks silently miss when speed doesn't divide N (e.g., speed=4 + odd gameTick → updateUI, checkMissions, tickMusic ALL stop firing; HUD freezes mid-game). Replaced all 5 occurrences with a `crossed(N)` helper that fires on crossing a multiple of N, robust to any speed ≥ 1.
- Cycle 57: Tutorial highlight bug — `.build-btn` selector always resolved to HOUSE (first build button), so "Click Farm" / "Click Lumber Mill" / "Click House" steps all pulsed the same wrong card. Changed highlight selectors to `[data-build-key="<type>"]` for each step. Farm now glows when the tutorial says to select Farm.
- Cycle 58: Pause overlay transparency — backdrop 0.25α + text 0.5α let citizen sprites bleed through the letters so "PAUSED" looked clipped by villagers. Bumped backdrop to 0.42, text to 0.95, added dark stroke. Scene darkens when paused; text is readable over any background.
- Cycle 59: HUD difficulty dot was a bare emoji (🟡) with no label — read as a stray artifact after the happiness percent. Wrapped in a `<span>` with `title`/`aria-label` ("Difficulty: Normal"), keeping the compact single-glyph HUD but revealing meaning on hover + for screen readers.
- Cycle 60: Missions panel had no divider between the 3 scenario objectives and the 15 appended global side-missions — fresh-eyes readers thought every row should count toward "0/3". Added a "SIDE GOALS" subheader divider; side goals no longer steal the scenario's active-mission gold highlight.
- Cycle 61 (deep-play): Enemy pile-up bug — after settlement wipe, `updateEnemies` found null target and no-op'd, leaving every surviving raider spinning on the town-center tile. Later raid days stacked more on top (108→159 enemies on one tile, HUD skull counter climbing unbounded). Fixed by routing idle-no-target enemies to the nearest map edge via a `retreating` flag; they despawn on edge arrival. Verified injected 3 enemies retreat from x=40 to x=79 then despawn.
- Cycle 62: Build-bar hotkey badges + handler used BUILDINGS declaration order — Fisherman's Hut (idx 21) and Granary (idx 14) had no "4"/"5" badge and pressing 4/5 selected locked `quarry`/`mine`. Tracked a visible-order array in ui.js; badges now read 1-5 for the 5 visible Day 1 buttons, and a capture-phase keydown handler uses the same list (preempting input.js) so 4→fisherman and 5→granary as shown.
- Cycle 63: `renderIdleIndicators` drew "?" over every citizen idle >3s — on Day 1 (0 buildings, nothing to do), all three starting villagers sprouted "?" and read as broken state. Gated the renderer behind an "open job exists" predicate (non-housing/wall/road/tower/well building with a worker slot short), so "?" becomes a meaningful "this citizen could work here" cue instead of Day 1 noise.
- Cycle 64: HUD "👤 3/3" read as "at cap" to fresh eyes and clashed with the scenario mission "Reach 10 population (3/10)". Added live `title` on pop-display that spells out the denominator ("N settlers · M housing slots (room for X more)") and, at cap, prompts "build a House (+4) to grow". Static HTML title retained no information about what the "/" means; tooltip now teaches it.
- Cycle 65: Fisherman's Hut icon 🎣 (fishing rod + dangling fish) silhouetted as a vacuum cleaner at card scale on dark bg — cycle 62 validator called this out and I wrongly rejected it as a hallucination. Cycle 65 validator repeated the call; this time I zoomed on the actual pixels and confirmed the misread. Swapped to 🐟, matching chickencoop 🐔 / cowpen 🐄 animal-producer pattern. Lesson: verify rendered pixels, not just Unicode codepoints.
- Cycle 66 (deep-play): Chronicle of the Realm chronicled only 4 of the 6 building types on the Day 1 build bar (missed lumber mill, fisherman's hut, granary) and never acknowledged a single citizen birth (4 births by Day 12, zero entries). Added first-of-type beats in checkStoryBeats for lumber, fisherman, granary, mine, quarry; added firstBirth beat keyed off G.stats.citizensBorn. Chronicle Day 1 now shows 6 entries instead of 4 when all Day 1 buildings placed. Rejected validator's "daily quiet labor" spam suggestion in favor of real-action milestones.
- Cycle 67: Speed-control buttons (⏸ ▶ ▶▶ ▶▶▶) in the play controls had empty `title` attributes — new players saw 4 cryptic triangles with no labels. Cycle 9 tooltip pass covered the top-right HUD icons but missed this strip. Added title + aria-label to all four buttons. Discovered mid-fix that space bar cycles speeds (not just toggle pause) — input.js:367 runs through [0,1,2,4] — so corrected the Pause tooltip from "(space bar)" to "tap Space to cycle speeds". Validator's first take was a hallucination (claimed log-badge smudges the 📜 icon on Day 1, but badge is display:none); pivoted to self-audit.
- Cycle 68: Happiness-toggle HUD button (leftmost top-right icon) rendered as `◆?◆?` tofu since cycle 60 — `enhancements.js:4750` literally had `el.textContent = '��'` (two U+FFFD bytes) as the 50-79% happiness face. `updateHappinessEmoji` runs every 60 ticks, so the static 😊 in index.html was overwritten within 1s of load. Replaced the broken bytes with 🙂, giving the 4-step progression 😊→🙂→😟→😢. Verified codepoint is now 1f642 (single char, not two FFFD). Lesson: when a tool reports U+FFFD codepoints, don't dismiss as encoding artifact — `xxd` the source to confirm first.
- Cycle 69: Build-bar category labels (`.build-cat`, rotated 90°) at `rgba(255,255,255,0.35)` + `0.55rem` read as "visual glitch" to fresh eyes instead of as category headers. Bumped to `0.62` alpha, `font-weight:600`, `0.58rem`, `letter-spacing:0.12em`, plus `1px` side borders at 0.08 alpha to reinforce the divider role. Labels now readable but still secondary to white card content. index.html CSS-only.
- Cycle 70: PAUSED overlay label was drawn at (w/2, h/2) — dead-center — and on Day 1 sat right on the starting citizens, obscuring the exact area a new player scans first. Cycle 58 fixed transparency but kept position. Moved label to (w/2, 56) so it sits in the HUD band above the play area; shrunk from 28px→22px so it reads as a status notice, not a takeover headline. Full-canvas dark scrim stays — still signals "world frozen" — but play area is unobstructed. enhancements.js only.
- Cycle 71 (deep-play): Severe plague event killed citizens silently — `G.citizens.pop()` ran twice, population decremented, but `G.stats.citizensDied` never incremented, no chronicle entry per death, no particles. Cycle 49 fixed this for combat deaths; plague was missed. Also the "−1–2 citizens" description didn't match `Math.min(2, ...)` (always 2). Randomized to 1-or-2; each death now increments stats, chronicles the name ("{name} succumbed to the plague…"), and spawns a 🪦 death marker. Verified: died 0→2, chronicle +2 death-tagged entries with real citizen names, particles +2 tombstones. events.js only.

## 30-Cycle Milestone Summary
Over 30 Chrome-verified cycles the loop pattern caught and fixed:
- **4 critical runtime bugs** that blind agents had shipped: loadGame import, confirm() dialog, undefined BUILDINGS (60fps crash), insta-damage raids
- **Dozens of UX clarity wins** — gold coin styling, mission hierarchy, resource tooltips, build bar feedback, HUD cleanup, stats panel overhaul, title-screen save summary, chronicle collision fix, empty panel states
- **Four empty panels transformed** from placeholder text into useful: Trade panel now sells the feature, Happiness panel shows roadmap, Stats shows live Current group, Achievements clarified as lifetime progress
- **4 defensive guards** against unknown BUILDINGS types preventing future crashes
- **Accessibility**: gold coin text fix, lock icon on unaffordable builds, tooltip additions

Pattern held: rotating validator focus (research/chronicle/citizens/stats/title/achievements/trade/happiness/log/tile-hover/combat) avoids getting stuck on Day 1 empty-map critique. User-reported bugs (this cycle) are now highest priority in backlog.

## First 20 Cycles Summary
**What this loop pattern actually caught:**
- **3 real bugs** that blind agents shipped and never noticed: loadGame import (game wouldn't start), confirm() dialog (blocked automation), BUILDINGS undefined (60fps error lockup when buildings existed)
- **4 defensive guards** added to prevent future crashes from bad data
- **8 UX clarity wins**: gold coin emoji fix (×2), HUD cleanup, happiness face emoji, build-bar selection lift, mission hierarchy, cost affordability red, lock icon, tooltip additions
- **4 "too much going on" fixes**: sunrise burst disabled, sheep clouds disabled, vignette softened, premature advisor tip gated
- **1 content fix**: Church mission text clarified with prerequisite

**Pattern that worked:** Main agent (Chrome eyes) + fresh-eyes validator (no bias) + focused implementer (one file, one task) + Chrome verify. Rotating validator angle (onboarding, aesthetics, info density, accessibility) prevents getting stuck on one theme.

**Pattern that didn't work:** JS state injection to test mid-game — broke with invalid types. Better to interact through real game flow.

## Known-Disabled Features (may revisit if needed)
- Meteors, comets, constellations, sun pillars, dragon, dragon trail, meteor impacts (loop 3 ambient cleanup)
- Sunrise burst (too dominant)
- renderMapBoundary (red dots in void)
- renderWorkerDots, renderRadiusPreview, renderGhostCost (BUILDINGS import missing)
