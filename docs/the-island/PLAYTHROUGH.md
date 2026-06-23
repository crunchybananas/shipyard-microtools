# ABYME — Playthrough & Test Guide

*An island within an island.* A zero-build, three.js first-person Myst-like. This guide walks the **complete game in order** so you can test it end to end without ever getting stuck, plus every fast-travel shortcut, both endings, all secrets, and a tick-box test checklist.

> Verified against source: `js/puzzles.js`, `js/main.js`, `js/world.js`, `index.html`. Flag names, gates, time windows, and debug calls below are exact.

---

## 1. How to run + Controls

### Open it
- It's static ES modules — **serve the folder over any static server** and open `index.html` (file:// won't load ES modules / CDN three.js). From the game folder:
  - `python3 -m http.server 8000` → open **`http://localhost:8000/`**
  - or `npx serve` and open the printed URL.
- Headphones recommended (all audio is synthesized live).
- Title screen has **Begin** and (if a save exists) **Continue**. Begin wipes any save and starts the ~19s intro flight; a single click/tap during the intro **skips** it. You wake on the beach.

### Debug build (the tester's master switch)
Append **`?debug`** to the URL: **`http://localhost:8000/?debug`**
This is the ONLY thing that creates the on-screen `#debug-panel` AND the `window.ABYME` console API. Without it none of the test aids exist (zero cost to players). `main.js:21`: `DEBUG = URLSearchParams(...).has('debug')`.

### Controls
| Input | Action |
|---|---|
| **Drag** (pointer down + move on the canvas) | Look around |
| **W A S D** | Walk |
| **Click** | "Touch the world" — fires the hotspot under the iris cursor (this is how nearly everything is used) |
| **Drag a hotspot** | Two hotspots are *drag* type, not click: the **sun crank** and the **model lamp housing** (lens-aim/beam). Hold and drag those. |
| **J** | Journal (Field Notes) open/close |
| **M** | Mute / unmute (persists) |
| **C** | Reduced-motion comfort toggle (persists) |
| **Esc** | Close journal / close reader |
| Reader open | **←** prev page, **→ / Space** next page, **Esc** or click backdrop closes |

While a **reading surface is open**, the reader owns input — J/M/C and walking do nothing until you close it.

---

## 2. Tester's fast-travel toolkit (`?debug` only)

### Debug PANEL (top-left, 8 collapsible groups) + the live STATE readout
The `?debug` panel is grouped, labelled and tooltipped, with a 2-line live **state readout** at the top
(level/region · encounter · tide+waterY · window · inv · stems · beamΔ · key flags · regions-seen · frags;
the tide line turns **amber when tide>1**). Press **`` ` ``** (backtick) — or the **▾ hide** header button — to toggle the panel.
- **Teleport:** `beach` · `study` · `stones` · `islet` · `cliff` · `bridge` · `dory` · `bluff` · `cellar↓`.
- **Time & Tide:** `dawn` · `golden` · `night` · `❄ sun` · `drain` · `high` · `mist`, plus a **time** slider (0–24h → `W.time`) and a **tide** slider **(0–2)**. NOTE: tide **>1 RAISES** the sea above high-water (`waterY = -TIDE_DROP·(1-tide)`); the dive-levels use 1.35 / 1.65 / 1.9. `drain`→low, `high`→raised.
- **Grant — surface chain:** `ruler+` · `ruler✓ bridge` · `bird✓` · `lens+` · `beam on` · `glyphs✓` · `glass+` · `ALL surface✓` (the whole surface chain at once).
- **Grant — bluff / dive chain:** `shadow✓` · `hatch✓ code` (dials=[3,7,1,5]+`hatchOpen`) · `plumb+` · `dive armed`.
- **Levels & dives — SEA-STRATA:** `L1 surface` · `L2 shallows` · `L3 midwater` · `L4 source` (each = `ABYME.goLevel(n)`: applies the LEVELS row — region + raised tide + spawn) · `dive ▼` / `dive ▼ i` (instant) · `ascend ▲` / `ascend ▲ i` · `bottom`.
- **Encounters:** `bird sing` · `Watcher spawn` / `Watcher resolve` / `Watcher reset` · `keeper twist` · `carried ✓` · `Tide-Figure`.
- **Endings** (collapsed) · **Power & Reset:** `ring bell` · `row oar` · `replay intro` · `bench (perf)` · `replay cines` · `mark lore read` · `clear lore` · `read log` · `read Q` · `frag+` / `frag clr` · `clr seen` · `save` · `reset flags` · `wipe ↻`.
- **bench (perf)** — fixed Power-Ledger pose (time 12); read the fps/draws/tris/GPU-ms line (red if calls≥360, tris≥800k, or fps<58).

### `window.ABYME` console API
Handles: `player, W, camera, scene, core, refs, modelRefs, renderer, game, THREE, UI, composer, bloomPass`.

```js
// --- teleport / time ---
ABYME.tp(-82, -42.5, 2.6)     // study (chart table)
ABYME.tp(4, -104, 2.19)       // wake-up beach / dive plate
ABYME.tp(135, -158, 0)        // standing stones
ABYME.tp(138, -141, 0)        // islet reading-glass
ABYME.tp(97, 32, Math.PI)     // bluff / hatch
ABYME.tp(-26, -104, 0)        // the dory / oar
ABYME.W.time = 6.5            // dawn (bird)        5.4–8.6
ABYME.W.time = 18             // golden hour (hatch) 17.1–18.5
ABYME.W.time = 22             // night (lamp/beam)  sunElev < -0.06

// --- grant state directly ---
ABYME.W.flags.readGlass = true        // reveal lens marks without the islet trip
ABYME.W.lensPlaced = true             // (top-level field, NOT under flags!)

// --- SEA-STRATA levels (PREFER goLevel over raw W.level — it applies the whole LEVELS row) ---
ABYME.goLevel(3)    // jump to a level: region + raised tide + spawn  (1 surface · 2 shallows · 3 midwater · 4 source)
ABYME.dive(true)    // run the real dive snap (true = instant) ; ABYME.ascend(true) to rise
ABYME.watcher('spawn')        // L3 Watcher encounter: 'spawn' | 'resolve' | 'reset'
ABYME.tideFigure()            // arm the L2 Tide-Figure encounter
ABYME.read('keeper_logbook')  // open a lore fragment by id (marks readKeys + journal; deep pages unlock at depth)
ABYME.state()                 // dump the live state line ; ABYME.resetFlags() clears puzzle flags for a fresh run
// (raw `ABYME.W.level = 3` sets only the number — it does NOT apply the region/tide/spawn; use goLevel.)

// --- jump to the deep beats / endings ---
ABYME.bottom()      // W.level=MAX_DEPTH(4), plumbHung+dove, spawns leaning over the keeper → the TWIST fires
ABYME.ascend()      // run one ascent cinematic (~28s); ascend(true) lands instantly, skips mode-gate
ABYME.armOar()      // W.level=1 + returned=true → arms the oar
ABYME.leave()       // startOarFinale() — the OAR ending directly
ABYME.ring()        // startFinale() — the BELL ending directly (bypasses the twist lock)

// --- inspectors / scrubbers ---
ABYME.getTwist()    // {keeperRose, carried, rise, climbing, level}
ABYME.getFinale()   // {kind:'bell'|'oar', t, shown}
ABYME.bench(12)     // power pose ; ABYME.gpuMs() ; ABYME.setIntroT(t) (intro only)
ABYME.bloomPass.enabled = false   // raw render for a clean screenshot
```

> **Gotcha:** `lensPlaced`, `beamAngle`, `tide`, `tideTarget` are **top-level `W` fields, not in `W.flags`**. There is no panel chip for valve / crank / music-box / model-lens-set / beam-aim / bell / oar — test those by teleporting and clicking/dragging in-world, or via `ABYME.*`.

**Fastest full skip to the dive:** click panel `+ruler → bird✓ → +lens → shadow✓ → code✓ → +plumb✓`, then in console `ABYME.W.lensPlaced = true`, teleport `study`, walk onto the plate.

**Fastest both-endings test:** see §4.

---

## 3. The guided playthrough (surface puzzles in order)

Two chains run in **parallel** and converge at the brass plate: the **LENS chain** (bird → stones → lens → set lens → beam) and the **RULER/HATCH chain** (chest → crack → shimmer → dials → plumb → hook). The hard couplings are noted per step. The **sun crank is the silent prerequisite** for three timed beats — if you're stuck, you're almost always at the wrong `W.time`.

You wake on the south beach (~4,−104). Walk WNW to the lighthouse study.

### A. The three free study tools (no gate — touch any time)
1. **Brass VALVE** — `study`, chart-table edge (~−82.7,−38.9). Click hotspot **`valve`** → toggles the tide (eases ~13s). First click sets `valveTurned` (earns music stem 1). **Drain it** to walk out to the chest, the causeway, and the drowned gallery later.
2. **Sun CRANK** — opposite table edge (~−86.7,−41.1). **DRAG** hotspot **`crank`** → sets `W.time` (and `crankUsed`). This is your hour control: **dawn 5.4–8.6**, **golden 17.1–18.5**, **night sunElev<−0.06 (≈ >20.6 or <4.6)**. (Debug: use the time slider.)
3. **MUSIC BOX** — back-left wall shelf (~−88.6,−42.6). Click **`musicBox`** → plays **E·G·A·D·C** (sets `heardBox`). This is the **decoy** tune — the stones reject it. Listen, then let the bird correct it.

### B. LENS chain
4. **Hear the dawn BIRD** — set time to **dawn**, go to the **stones** (islet, 135,−146; debug `stones`). Stand within 38m and **wait** (~21–29s) — no click. The bird sings **E·G·A·G·C** (the box's 4th note bent UP). Sets `heardBird`. *Skip: panel `bird✓`.*
5. **Play the STONES** — click the stones by **index** in bird order: **stone2 → stone3 → stone4 → stone3 → stone0**. `maxDist` is 13, so play the whole arc **from one vantage** where all five are visible (no need to walk up to each). Wrong note resets; playing the box's `[2,3,4,1,0]` is scolded. Correct full sequence sets **`birdSolved`** (stem 3) and slides the outcrop vault open. *Skip: `bird✓`.*
6. **Take the FIRST LENS** — at the now-open vault outcrop SW of the arc (~124,−150). Click **`lensItem`** → sets `lensTaken`, adds `lens` to inventory. *Skip: panel `+lens`.*
7. **Set the lens in the MODEL lighthouse** — return to `study`, **lean close over the model's tiny lighthouse lamp room** (`maxDist` 3.2). Click **`lensSlot`** → sets **`W.lensPlaced = true`** (top-level field) and consumes the lens. *No chip — use `ABYME.W.lensPlaced = true`.*
8. **(Optional) Aim the BEAM / read the cliff glyphs** — set time to **night** so `W.lampLit` (lensPlaced && night) turns on. **DRAG** hotspot **`beamAim`** (the model lamp housing) to turn the beam; align it with the cliff azimuth while standing **within 70m of the cliff (57.5,14,50)**. Sets `glyphsSeen` (stem 5) and shows the glyphs. **This is a HINT only** — the hatch code is hard-coded `[3,7,1,5]`; you can dial it blind, so this step is skippable.

### C. RULER / HATCH chain (can be done in parallel)
9. **Open the CHEST, take the RULER** — drain the tide first, then walk to the exposed chest at (118,−176) (debug `ABYME.tp(118,-176,0)`). Click **`chest`** twice (open, then take). Sets `chestOpen` → `rulerTaken`, adds `ruler`. *Skip: panel `+ruler`.*
10. **Lay the RULER over the model CRACK** — in `study`, lean over the model's eastern chasm (`maxDist` 3.2). Click **`crack`** → consumes ruler, sets **`rulerPlaced`** (stem 2). The real brass **bridge** rises at z=25 (x 35–59) — your land route to the bluff.
11. **Reveal the HATCH** — set time to **golden hour**, cross the bridge to the bluff hatch (97,32; debug `bluff`). Click the pulsing **`shimmer`** ("troubled sand", `maxDist` 6) → sets **`shadowRevealed`**, exposing the four dials. *Skip: panel `shadow✓`.*
12. **Set the DIALS to `3·7·1·5`** — click **`dial0`..`dial3`** to cycle each glyph (+1 mod 8). Set dial0=3, dial1=7, dial2=1, dial3=5. The instant `W.dials` equals `[3,7,1,5]` it sets **`hatchOpen`** (stem 4) and the lid slides open. *Skip: panel `code✓` (sets dials+shadowRevealed+hatchOpen).*
13. **Take the PLUMB BOB** — descend the open hatch into the cellar (~97,19.5,18.5). Click **`plumb`** → sets `plumbTaken`, adds `plumb`. Journal: "the chart table has a hook." *Skip: panel `+plumb✓` (also hangs it).*
14. **Hang the PLUMB on the HOOK** — return to `study`, look UP at the hook over the chart table (`maxDist` 6). Click **`hook`** → consumes plumb, sets **`plumbHung`**. The brass **PLATE** on the study floor is now live. *Skip: `+plumb✓`.*

### D. The DESCENT — the brass PLATE (two-touch dive)
15. **Stand on the PLATE** (~−82.8,−41.4) — you must be **within ~1.0m of its centre** or it just whispers "Stand on it." Click **`plate`** (`maxDist` 3.5) **twice**: first touch = the **brink** ("there is no climbing back"); a second deliberate touch **commits** → sets `dove`, runs the ~21s dive cinematic, and lands you on the beach **one level deeper** (`W.level` +1, max 4). Stepping >1.25m off the plate cancels the brink.
16. **Repeat the dive** at each level. `W.level` runs 1 (surface) → 4 (`MAX_DEPTH`, the bottom). So a manual run is **3 dives down**. *Skip: `ABYME.bottom()` jumps straight to the bottom leaning over the keeper.*

What each level unlocks: **L≥1** quarters journal hotspot · **L≥2** inner door opens, coat + footprints + BELL appear, coat letter readable, tiny keeper figure on the model · **L≥3** keeper speaks on arrival, the WATCHER activates, deep re-read pages appear · **L≥4 (bottom)** the plate goes UP only (amber `plateGlow`), the TWIST arms.

### E. The bottom TWIST (mandatory)
17. At the bottom, **walk up to the tiny keeper figure on the chart-table model** (within 2.4m) — **no click**. Proximity fires `keeperTwist`: the figure turns, **rises** toward you, looms larger, and speaks ("There you are. I've been coming down for you."). Sets **`keeperRose`** immediately, locks you ~6s. *Fast path: `ABYME.bottom()` spawns you right at it.*
> The twist is a **hard gate**: you cannot ring the deep bell until `keeperRose` is set.

Now choose an ending (§4).

---

## 4. Both endings

The plate (one hotspot) disambiguates by state: `goingUp = climbing || level>=MAX_DEPTH`. Every crossing is a **two-touch** (brink → commit); stepping off cancels.

### Ending A — THE OAR (return to the surface, leave changed)
1. **The EMBRACE** — at the bottom after the twist, walk onto the plate. With `keeperRose && !climbing`, first touch arms a **separate embrace brink**; second touch commits → sets **`carried`** + `climbing`, starts the ascent **carrying him** (integration). *(Skip the embrace = the "plain climb": he stays below; same surface outcome but no `carried`.)*
2. **Climb out** — two-touch the plate at each level (or `ABYME.ascend(true)` ×3) until `W.level` reaches 1. Reaching the surface clears `climbing` and sets **`returned`** (this **arms the oar**).
3. **Row off** — walk to the dory at (−26,−102) (a nudge fires within 9m). Click **`oar`** (gate: `level≤1 && returned`) **twice** → `startOarFinale()`: the only look-back shot, the world shrinks to a tiny lit model, card **"you left the light on."**
   - *Fast: `ABYME.armOar()` then click the oar, or `ABYME.leave()`.*

### Ending B — THE BELL (stay below, keep the light lit)
- The bell appears at **L≥2** near the study (~−84,14.85,−40.4). Click **`bell`** (`maxDist` 2.2) once.
- At the **bottom**, it's **locked until the twist** (`keeperRose`) — else it whispers "Not yet. Something at the chart table has lifted its head…". After the twist, clicking commits → `startFinale()`.
- **Tone forks by depth at the moment of ringing:** ring at **L≥3 (deep)** WITHHOLDS — a held bittersweet golden hour, **no stars**, card **"you keep the light now."** Ring at **L2 (shallow)** keeps the full golden constellation parade, card "the tide brought you back."
- *Fast: `ABYME.bottom()` → fire the twist → click the bell, or `ABYME.ring()`.*

Both endings are terminal (mode-guarded). The only exit is **"Begin again"** (wipes the save + reloads).

---

## 5. Secrets & lore checklist (all optional — none gate the main chain)

Readable fragments (click → `UI.openReader`; first read drops a journal line):
- **Bottle note** — wake-up beach (~6.5,−101). Click **`bottle`**. Always available.
- **Stone inscription** — foot of the jetty (~−16,−103). Click **`inscription`**.
- **Keeper's logbook** — study chart table (~−86.4,−39.3). Click **`logbook`** (6 pages). **Deep 7th page** only appears on a **re-read at L≥3**.
- **Coat letter** — annex, on the keeper's coat. Click **`coatLetter`** — needs **L≥2** (coat is hidden above that). Dive once first.
- **Quarters journal** — on the cot in the annex. Click **`quartersJournal`** — practically reached at **L≥2** (inner door). **Deep 4th page** at **L≥3**.

**SEA-STRATA per-level hidden readables** (each lives in its level's region, readable only there):
- **Kelp slate** — L2, on the wade-line from the L2 spawn (~8,−101). Click **`kelpSlate`** (`when: W.level===2`). Diegetically hints the **Tide-Figure**.
- **Bluff cairn** — L3, by the bluff spawn (~91.5,31.5), a faint cold ring on the top stone. Click **`bluffCairn`** (`when: W.level===3`). Hints the **Watcher**.
- **Source note** — L4, on the study floor by the chart table (~−83.8,−41.8). Click **`sourceNote`** (`when: W.level===4`). Frames the keeper-look twist.

**The deep-read economy** (cross-level, Meow-Wolf): the 4 CANONICAL deep-capable fragments — **stone** (deepFrom 2) · **logbook** (3) · **quarters** (3) · **music** (4) — each accretes a colder *journalDeep* line the first time you reach its deep page; reading **all 4** fires the **integration** payoff (a self-hand entry + whisper, once). A **"N of 4 read from the deep"** tally rides the journal header, and a count-aware whisper marks each. Two **bonus** deep-reads (**coat**@L3, **bottle**@L2) accrete + whisper but stay OUT of the 4-tally. *Audit: `ABYME.read(id)` at the right level, page to the last page; or panel `mark lore read`.*

**Tide-Figure** (L2 encounter — the shallow counterpart to the Watcher): a soft dark humanoid in the kelp. It **disperses if you wade at it**, and **resolves if you stand still and watch** (~2.6s of stillness → a chime, it sinks). *Arm: `ABYME.tideFigure()` or panel `Tide-Figure`.*

**Ambient detail:** drifting **fish-shadows** over the L2 kelp; two **lampblack tide-lines** (old + risen) on the jetty-foot standing stone (the keeper measured the rising sea — the logbook's "the new one has gone over it").

The **FOUND-LENS reveal** (the key to two hidden fragments):
- **Take the reading glass** on the islet (~138,−141). Click **`readGlass`** → sets `readGlass`, adds `readglass`. Two lampblack marks fade up.
  - **`lensMarkStudy`** — chart-table margin (study). **`lensMarkStone`** — high on stone #4 (islet).
  - Both are **invisible/non-clickable until `readGlass` is set**. *Force without the trip: `ABYME.W.flags.readGlass = true`.*

Vistas (observed, **no click** — at most a one-time proximity whisper):
- **Drowned gallery** — drain the tide, look seaward from the beach (whisper "a road of wet stone" at tide<0.25).
- **Vault Beneath** (inverted lighthouse) — open the hatch, look **east** through the cellar window.
- **The Room That Disagrees** — open the hatch, stand at the cellar **west** window (fires `roomDisagrees`; its model floods inversely to your tide).
- **Descent tally + recursion glint** — chart-table margin strokes (one per level; stays full after `returned`) and a sub-mm lit point deep in the model at night.

The **WATCHER** (deep shore, real island only):
- Needs **`W.level≥3`** AND **`!watcherSeen`** (once per game). Move onto the open shore; it **drifts toward you when unwatched, freezes when watched**. Resolve by **REGARD** — keep it within ~35° of your gaze and <70m for **2.6 continuous seconds** (do NOT flee). Sets `watcherSeen`, it rises into a cold light and is gone. *Replay: `ABYME.W.flags.watcherSeen = false; ABYME.W.level = 3`.*

> Pruned from the model clone (full-scale island only): drowned gallery, jetty, quarters, vault drips/vista, watcher, all particle points. Don't hunt for them in the chart-table model.

---

## 6. Test checklist

**Setup**
- [ ] App serves over a static server; `index.html` loads (no console errors). Fastest: `python3 -m http.server`.
- [ ] `?debug` builds the `#debug-panel` and `window.ABYME` (type `ABYME` in console).
- [ ] **Begin** starts the intro flight; a click skips it; you wake on the beach.
- [ ] **Continue** appears only when a save exists and restores flags/level/time.

**Surface puzzles** (each fastest-trigger noted)
- [ ] Valve drains/refills the tide; first turn earns stem 1 — `tide` chip or click `valve`.
- [ ] Crank/time slider wheels the sky (dawn/golden/night) — `crank` drag or time slider.
- [ ] Music box plays E·G·A·D·C — click `musicBox`.
- [ ] Dawn bird sings E·G·A·G·C at the stones — time→6.5, `stones`, wait. (`bird✓` skips.)
- [ ] **Stones solve from one vantage** (maxDist 13): stone2,3,4,3,0 → `birdSolved` + vault opens. (Verify you do NOT need to walk to each.)
- [ ] Box tune `[2,3,4,1,0]` is rejected on the stones.
- [ ] Take first lens (`lensItem`) → `+lens`.
- [ ] Set lens in model (`lensSlot`) → `ABYME.W.lensPlaced=true`.
- [ ] Beam at night aimed at cliff writes glyphs → `glyphsSeen` (optional/HINT).
- [ ] Chest (tide down) → ruler; lay ruler on model crack → bridge rises at z=25. (`+ruler`.)
- [ ] Golden-hour shimmer → `shadowRevealed`; dials to **3·7·1·5** → `hatchOpen`. (`shadow✓`/`code✓`.)
- [ ] Plumb from cellar → hang on hook → `plumbHung`; plate goes live. (`+plumb✓`.)

**Descent / twist**
- [ ] Plate is a **two-touch** dive; stepping off cancels the brink; "Stand on it." if >1m off.
- [ ] Each dive increments `W.level` (1→4) via the ~21s cinematic.
- [ ] Level reveals: L2 inner door/coat/footprints/bell/tiny figure; L3 keeper speaks + Watcher; L4 amber plateGlow.
- [ ] **TWIST** fires by proximity to the tiny figure at the bottom (no click) → `keeperRose`. (`ABYME.bottom()`.)

**Endings**
- [ ] **Embrace** (plate, keeperRose && !climbing, own two-touch) → `carried`; "two lights" text.
- [ ] **Plain climb** (skip embrace) reaches surface without `carried`; keeper's spoken farewell.
- [ ] Climbing to surface sets `returned` and arms the oar.
- [ ] **OAR** ending (`oar`, two-touch) → look-back finale, "you left the light on." (`ABYME.armOar()` then click / `ABYME.leave()`.)
- [ ] **BELL deep** (L≥3, after twist) → withheld, no stars, "you keep the light now." (`ABYME.bottom()`→twist→bell.)
- [ ] **BELL shallow** (L2) → full constellation parade. (`level2` then click bell.)
- [ ] Deep bell is **locked before the twist** ("Not yet…").
- [ ] "Begin again" wipes the save and reloads.

**Lore / secrets**
- [ ] All 5 readable fragments open and log a journal line: bottle, inscription, logbook, coat letter (L≥2), quarters journal (L≥2).
- [ ] Logbook deep page (re-read L≥3) and quarters deep page (L≥3) appear.
- [ ] **Found-lens reveal**: take `readGlass` → `lensMarkStudy` + `lensMarkStone` become visible & clickable (and are invisible before). (`ABYME.W.flags.readGlass=true`.)
- [ ] **Watcher** at L≥3 resolves by 2.6s of sustained regard → `watcherSeen`; drifts in when unwatched. (`watcherSeen=false; level=3` to replay.)
- [ ] Vistas observed (no click): drowned gallery (tide down), vault-beneath (east window), Room That Disagrees (west window, floods inversely to tide).
- [ ] Descent tally grows per level and stays full after `returned`; night recursion glint visible.

**Systems / polish**
- [ ] **Music crossfade**: era music darkens as you descend (L2/L3+); stems 1–5 accrue as puzzles solve.
- [ ] **Journal (J)**: every first-read/first-solve drops an entry; tab pulses on a new entry; keeper vs self hands render distinctly.
- [ ] **Save/Continue**: every flag/inventory change autosaves to `localStorage 'abyme-save-v1'`; reload + Continue restores state; the plate brink pauses autosave.
- [ ] **Sky/visuals**: orrery lamp + real sun track `W.time`; lamp burns and beam projects at night; golden-hour shimmer pulses only in the golden window.
- [ ] **Power Ledger** (`bench` / `ABYME.bench()`): fps/draws/tris/GPU-ms readout stays in budget (not red: calls<360, tris<800k, fps≥58).
- [ ] **M** mute and **C** reduced-motion both toggle and persist; **Esc** closes reader/journal.
