# ABYME Quality Loop — Log

Newest entry first. Every iteration appends one entry using this template:

```
## <n> — <date> — <axis>
**Shipped:** what and why it wows (1-3 sentences)
**Evidence:** screenshots taken (times of day), fps/draws after, chain links re-verified
**Debt:** added/cleared VISUAL DEBT or backlog items
**Next tick suggestion:** one concrete item + why it's the highest-wow next move
```

---

## 9 — 2026-06-12 — ambient life (the gull that lands)

**Shipped:** At dawn the first gull leaves the gyre, glides to the gallery
rail's east side, and settles facing the sun — wings tucked (rotation.x
fold + flap amplitude fading with the ease), a 2 cm breathing bob, heading
eased to due east. When dawn ends it lifts off back into the orbit. One
eased scalar (`perchT`, 4.5 s in / 3 s out) drives the whole behavior;
no state, no saves, gulls aren't cloned into the model. Debug gains
`ABYME.setPerch()` beside `setIntroT` — the scrub-knob pattern is now
the standard way to verify slow eases under frame-starved captures.

**Evidence:** dawn approach observed accumulating live (wing fold growing
from −0.0005 — which first looked like a dead branch and was actually
the capture windows advancing only ~0.2 s of frames each; chased a NaN
ghost before measuring); settled numerics dist-to-perch 0.008 m, fold
−0.12, flap 0, heading −π/2; settled visual (white bird-form resting on
the gallery rim while gull 2 still rides the gyre); post-dawn departure
visual (mid-blend, half-spread wings, empty rail). Zero console errors.
Also fixed in-flight: the new tickGulls(dt) signature's call site —
an undefined dt would have NaN-poisoned perchT permanently.

**Debt:** none added.

**Next tick suggestion:** iteration 10 closes batch 2 — push everything
(stone glyphs, intro flight, M toggle, the gull, plus this tick) per
MISSION step 3, submodule first. For the work itself: "model sea reads
chalky up close" (backlog) — the speckle at 1:240 overwhelms the body
color; sample the shared-material constraint carefully (water material
is shared BY DESIGN between world and model — a derivative-based fade
keyed on mesh scale, not a material clone, is the likely shape).

---

## 8 — 2026-06-12 — UX (the promised sound toggle)

**Shipped:** `M` toggles sound — the owner's deferred request from the
persistent-mute commit, paid back. Wired in `ui.js` beside the `J`
journal key, through the existing `A.setMuted()` (so it persists via
`abyme-muted` across reloads and New Game). Feedback is diegetic, not
chrome: a whisper — "The sea goes quiet." / "The sea breathes again." —
and the controls hint now reads `… · J journal · M sound`. Works on the
title screen too (flag flips before audio init; init respects it).

**Evidence:** real keydown dispatches: muted 1→0 (master gain 0→0.6,
localStorage '0', whisper "breathes again" in DOM) then 0→1 (gain 0,
'1', "goes quiet"); hint line with `M sound` captured on screen; zero
console errors; owner's save untouched and session left MUTED as they
prefer. Whisper photography note: whisper hold timers are wall-clock,
so they expire between hidden-tab evals and captures — DOM textContent
is the reliable evidence; the visual was confirmed via the hint line.

**Debt:** cleared the "Audio mute UX" backlog item.

**Next tick suggestion:** the gull that lands (backlog: "gulls are two
quads… they never land; a gull landing on the gallery rail at dawn would
be free soul"). Contained: at dawn, one gull breaks orbit, glides to the
gallery rail anchor, perches for a minute, departs. Pure ambient
behavior in main.js tickGulls — no state, no saves, big soul-per-line.

---

## 7 — 2026-06-12 — cinematics (the approach earns the sea)

**Shipped:** The intro dolly is a flight now, not an elevator: Catmull-Rom
path that falls from the high offshore start, SKIMS the swell for a third
of the run (camera ~1.8–2.5 m over the water, swell-coupled bob that
strengthens as the flight drops, gentle banking roll), then rises along
the coast to the beach. 72 seeded spume points (`introSpray`, glow-points
with drift) blow past only during the skim leg (smoothstep window on
uGlobal), removed from the scene at endIntro. The title now holds for
1.4 s over the first seconds of sea before fading — the breath the
backlog asked for. Debug gains `ABYME.setIntroT()` to scrub the dolly.

**Evidence:** beat screenshots — skim leg (camera among the swell, foam
rushing, a crest shouldering into frame, island at eye level), brighter
spume pass (flecks at several depths, one flaring near-camera; first
attempt was invisible against the foam — size 0.34→0.7, count 56→72),
rise leg (coastal flyby past pines toward the tower, draws peak 189 of
the 200 budget — transient), settle and endIntro handoff (spray removed,
beach spawn). Zero console errors. Verification traps hit and recorded:
hidden-tab captures advance intro.t only ~0.1–0.3 s each, so beat
sampling needs setIntroT jumps and the final second needs an overshoot;
sessionStorage autostart flags are PER-ORIGIN (set on localhost, lost on
127.0.0.1 — looked like autostart silently failing); the localhost
origin still holds a STALE save from early ticks (looked like the owner
had wiped — they hadn't; 127's save was intact the whole time).
endIntro force-saves the beach over the live save — stash/restore of the
real save string is mandatory around intro testing.

**Debt:** none added. Title-breath uses a setTimeout against the existing
CSS fade — if the title CSS ever changes, re-check the overlap.

**Next tick suggestion:** audio mute UX from the backlog (owner request
waiting since tick "persistent mute") — an `M` key toggle via
`A.setMuted()` plus a one-line `· M sound` addition to the existing
hint/controls whisper line; no HUD chrome, ~20 lines, and it pays back a
promise. Alternatively the gull-lands-on-the-rail-at-dawn soul beat.

---

## 6 — 2026-06-12 — puzzle clarity (the stones face their players)

**Shipped:** The music glyphs were not "too subtle" — they were on the
WRONG FACES. Stone rotation puts local +z toward the arc center; the
glyphs sat at local −z, etched for an audience of open sea. Flipped to
the inner faces, given the cellar-carve treatment (0.78 size and opacity,
soft halo), named `stoneMark0–4` (added to NAMES), and wired in `_apply`
to pulse to full brightness while that stone's tone sings (rides the
existing `an.stoneGlow` envelope — post-solve clicks still pulse, so the
instrument keeps feeling alive after the puzzle).

**Evidence:** dawn arc-center before (five blank monoliths, bird hovering)
vs after (all five glyphs reading: sight, triangle, wave, arrow, ring);
golden-hour after (read on sun-warmed faces — dawn-shade and golden-light
bracket noon); real-input projection click on stone 2 → screenshot caught
the mid-pulse flood with the wave glyph at white heat, numerics
stoneGlow 0.973 → mark opacity 0.994 (= 0.78 + 0.973×0.22), birdSolved
flag untouched. Zero console errors, +5 draws (halos). Preview server had
died between ticks — restarted from the launch config; owner save (browser
localStorage) unaffected, restored & re-saved after testing.

**Debt:** none added.

**Next tick suggestion:** the intro dolly underuses the sea (backlog) —
the approach should skim wave-top with spray before rising to the beach,
title timing breathing more. It's every player's first 19 seconds and the
only first impression the game gets; cinematics axis untouched so far.
Verify by autostart-reloading with the skip DISARMED (watch the full
dolly at least once), screenshots at 3-4 beats along the path.

---

## 5 — 2026-06-12 — story/worldbuilding (the cartographer's marginalia)

**Shipped:** First story beat: the cartographer annotated their own model.
Five small burnished marks on the chart-table's wood margin — a tide glyph
by the valve, a sun glyph by the crank, the plumb diagram on the south
edge facing the model's beach (the SAME glyph as the cellar carve: one
hand, everywhere), and a tiny paired maker's mark tucked into the
south-east corner like a signature stamp. No words, no state, no UI —
pure environmental authorship, found only by leaning in over the thesis
object.

**Evidence:** close-look screenshots: SE-corner pair at noon and golden
(reads as a stamp catching the light, model islands behind); plumb-mark
lean-in (full arrow on the margin between the model sea and the rim).
Zero console errors, +5 draws (one per sprite, frustum-culled outside
the study), no state/save surface touched, chain untouched. Sizing
lesson recorded: the margin band is 25 cm (model water sheet edge 1.29 →
rim face 1.54) and the sheet sits 5 cm proud of the wood, so marks
larger than ~0.2 duck under its overhang at glancing angles — first two
attempts hid their inner halves; final marks are 0.13–0.2.

**Debt:** none added. The "model sea reads chalky up close" backlog item
was visibly confirmed again in the golden close-ups.

**Next tick suggestion:** the stone glyphs (backlog: "barely visible") —
they are the clue for the music sequence and now the islet meadow draws
the eye to the stones; etch them brighter the way the cellar carve got
its halo, and consider a faint glow only while the stone's tone plays
(material already cloned per-shell). Close-look + puzzle-clarity in one.

---

## 4 — 2026-06-12 — graphics wow (the cellar deserves mood)

**Shipped:** The plumb-bob room is an altar now, not a void. Cool teal fill
light on the carve wall (separates room from the shaft's warm key), the
carve glyph at 1.9 with a 0.16-alpha halo behind it (reads as etched
relief — and its arrow points up from exactly where the bob hangs, item
and hint in one sightline), a dusty light shaft falling from the open
hatch onto the stairs (`cellarShaft`, beam material, intensity eased with
`an.hatch` so it fades in as the lid slides), and 64 seeded dust motes
split between both interior volumes. Bonus discovered in verification:
at night the open hatch now spills warm light up through its ring —
visible across the bluff, beckons.

**Evidence:** before shots (uniform murk; a flat tan wall) vs after: room
composition (bob + blazing carve + motes in fill light), shaft view
(stairs climbing into falling light, motes hanging in the dark, hatch
ring silhouetted), night exterior (glow through the ring, no bleed
through rock — verified the beam/motes are depth-occluded). fps 60,
draws +2 (beam + motes, 46 in-room view), tris +0.4k, zero console
errors. Interior light is flag-driven, not time-driven, so single-time
screenshots suffice; night exterior covered the only outdoor-visible
surface. Trap learned: the cellar is two overlapping BackSide boxes —
a camera in the shaft stares at the shaft's own end wall, so room
vantages must stand z < 22.6; first mote pass landed entirely in the
shaft for the same reason.

**Debt:** cleared "Cellar is flat". Nuance noted, not chased: the shaft
beam implies daylight but burns constant at night (reads fine as lantern
glow). Pre-existing: makeGlowPoints seeds via Math.random() (visual
phase only, not world-gen — but it's the one PRNG-rule hole in the file).

**Next tick suggestion:** iteration 5 closes the push batch — ship
something story-flavored so the batch lands with soul, then PUSH ALL
(submodule first, then parent; five the-island commits + cadence doc are
waiting). Concrete pick: the cartographer's marginalia — tiny etched
marks on the chart-table rim (brass Baker pass exists; glyphSprite for a
hand symbol), placed where the orrery crank, valve and basin sit, as if
someone annotated their own model. Quiet, close-look, thesis-room. The
push protocol is MISSION.md step 3.

---

## 3 — 2026-06-11 — performance/code health (the drained-bay softlock)

**Shipped:** The only known way to ruin a playthrough is sealed. Walking can
no longer descend onto raw terrain below −2.2 m (`player.js step()`, inside
the `!structural` branch so the bridge deck, stairs and pads are exempt) —
this re-seals the chasm's drowned ends, which were designed to be locked by
water ("both ends drown below the lowest tide") but opened into one-way pits
when the valve drained the bay (down-ramps walk at any grade; up beats the
1.35 limit; floor at −5 sits below even the drained waterline of −4.2).
Upslope steps below the line stay legal, so stale saves can still scramble
shallower. Continue also sanitizes: a save below −2.2 respawns on the beach
("the tide returns you", `main.js`).

**Evidence:** real-input tests (held KeyW via dispatched key events, frames
flushed by screenshots): descent from the bluff shoulder (terrain 16.6)
halts at the rim, terrain −1.80, and two further bursts only slide along
the contour — the flooded crack below stays a vista; causeway sprint
60→69.3 m straight through its deepest saddle (crest −1.42) with zero
false blocks; chest path probed (min +6.0 — untouched); bridge exemption
proven by predicate (walkableY 18.45 vs raw −8.5 → structural). Planted a
trapped save at (52, −5.18): Continue spawns the beach. Owner's real save
restored and re-written after testing (live pos == saved pos, meadow).
No console errors; geometry untouched so no perf delta; times-of-day N/A
(movement logic only). Constants from in-page probes, not guesses:
causeway walk-line min −1.42, drained waterY −4.2, clamp −2.2.

**Debt:** cleared the drained-seabed softlock backlog item. The sub-
waterline void sightlines (entry 1's chasm-seam note) are now unreachable
by walking — only debug teleports can still see them; deprioritized.

**Next tick suggestion:** "Cellar is flat" — the room that hands over the
plumb bob is one point light and a barely-readable wall carve. Mood pass:
warm key from the hatch shaft, cool fill, dust motes in the shaft beam
(glow-points pattern already exists), brighter carve glyph. Contained,
big before/after, and it's the next axis in the rotation (light/graphics
after jank → vegetation → movement). Alternative if feeling literary:
first story beat — etched marginalia on the chart table rim (cartographer's
hand, no text dumps).

---

## 2 — 2026-06-11 — graphics wow (the islet meadow)

**Shipped:** The islet is no longer bald. A second grass ring (1500 blades,
same blade pool/material — zero new draw calls) around SPOTS.islet, with
keep-out discs for the stones pad (r 9 — the dance floor and its shadow
stage stay bare), the vault outcrop (r 5) and the chest (r 3), plus the
slope gate. Its own height band 2.2–11.2: probing revealed the pad sits in
a shallow BOWL whose shoulder rises to ~10.5 before falling to the beach —
the first attempt capped at 8.4 and left the visible ring empty (caught by
a nearest-blade-to-pad assertion of 22 m instead of ~9).

**Evidence:** golden-hour south vantage (tick 1's bald "before" now has a
backlit meadow ring behind the stones); dawn 7.0 with the songbird perched;
on-pad close-up (floor bare to exactly the keep-out edge, meadow line
beyond); vault outcrop apron clean; noon wide. Numeric: 1500/1500 islet
blades placed, 0 in any keep-out disc, nearest blade 9.04 m from pad
center, main-island layout untouched (same PRNG draw order — 9000 blades,
0 in lighthouse/annex discs). Night skipped: the islet is unlit dark at
23h and grass adds no luminous material. Perf: 60 fps settled, draws ≤145,
tris ≤519k, render submission 0.31 ms/frame, no console errors. Owner's
live level-2 session preserved via Continue (never Begin — Begin wipes
saves) and restored to the exact spot afterward, audio re-muted.

**Debt:** none added; "Islet is bald" cleared from backlog. Added the
drained-seabed softlock (below) — observed live: the owner fell into a
bay-floor ravine at (52, −5) on level 2 and was pinned by >1.35 gradients,
with see-through-the-world sightlines below the waterline and the 12 s
autosave ready to trap the position permanently.

**Next tick suggestion:** fix that softlock — it's the only known way to
ruin a playthrough and the owner personally hit it within an hour of play.
Axis switch (two vegetation ticks in a row). Sketch: in `player.js step()`,
when tide is drained, treat sub-waterline terrain that has no walkable
exit gradient as water-equivalent (block entry the way swimming is
blocked), OR clamp walkable depth to ≥ −2 m except along the causeway
corridor; verify by walking into the ravine mouth at (52, −1) and along
the full causeway (chest must stay reachable), plus a reload-while-deep
test. Cheap, owner-validated, protects every future player.

---

## 1 — 2026-06-11 — close-look jank

**Shipped:** Vegetation scatter correctness — grass keep-out discs for the
lighthouse study and annex (the owner's "blades through the furniture" class:
59 blades stood inside the study disc, the nearest 1.07 m from the tower axis,
growing through the chart table; 16 more in the annex where the bell stands),
plus a slope gate (analytic gradient > 1.0) that strips blades off the chasm
walls and sea cliffs. The meadow keeps its full 9000 blades — rejected spawns
resample onto legal ground.

**Evidence:** before/after screenshots at identical vantages: study chart
table (noon), annex floor (noon), chasm east wall; exteriors at dawn 7.5h and
golden 17.7h (the bare apron at the tower base reads like a worn doorstep,
not a crop circle); night render clean. Numeric proof: in-disc blade counts
59→0 and 16→0, nearest-to-tower 1.07 m→7.25 m, count 9000→9000. Real-input
valve click (pointermove → rAF → pointerdown/up) drains the tide 1→0 — chain
link 1 re-verified; nothing else in the chain touched. 60 fps, draws ≤131,
tris ≤495k, zero console errors.

**Debt:** none added. Tooling fix recorded here because it will bite again:
python http.server's missing cache headers let Chrome serve stale modules
under heuristic freshness — verification ran OLD code while the server had
the new file. The launch config now serves `Cache-Control: no-store`; if a
stale ghost persists anyway, load via `http://127.0.0.1:8741` (separate cache
keys from localhost). Also: the pointer pipeline only advances during visible
frames — to drive a click, queue pointermove + pointerdown/up inside nested
`requestAnimationFrame` callbacks in ONE eval, then screenshot to flush.
Backlog note: from inside the chasm slot a pale terrain-skirt seam is visible
overhead (reachable only by falling in); logged, not chased.

**Next tick suggestion:** "Islet is bald" — this tick's golden-hour stones-pad
screenshot shows the puzzle islet utterly naked while the main meadow is lush,
and players stare at exactly that ground through the whole music sequence.
The scatter now has keep-outs and a slope gate, so seeding the islet is
low-risk: a second spawn ring around SPOTS.islet with keep-outs for the
stones pad (r ~9 so the dance floor stays readable) and the vault outcrop,
reusing the same blade pool budget (+~1500 instances stays far under tri
budget). Highest wow-per-line-of-code on the board.

---

## 0 — 2026-06-11 — the overhaul itself (baseline)

**Shipped:** Complete rebuild as ABYME — recursive island, six-puzzle chain,
dive finale. Design by judged panel; adversarially reviewed (two softlocks
found and fixed); pushed to main; live on Pages.

**Evidence:** full visual tour at dawn/noon/golden/night; dive end-to-end;
real-input click tests on valve, hook, plate; 60fps, ~140 draws, ~495k tris.

**Debt:** see backlog below — seeded from build-session observations.

**Next tick suggestion:** the close-look jank sweep, starting with grass
spawning inside structures (owner has personally seen blades poke through
furniture — `props.js` grass scatter gates only on height + main-island
distance; it excludes nothing around the lighthouse pad, the chest, or the
bridge pads, unlike the tree scatter). Sweep the whole class with close-up
screenshots: study/annex interiors, chest, stones pad, hatch ring, vault.
First impressions of the model room are the game's thesis statement —
nothing may break it.

---

# Backlog (unordered; claim items into iterations)

- ~~Audio mute UX~~ — done in iteration 8: `M` toggles via `A.setMuted()`,
  whisper feedback, hint line updated.

- **Grass inside structures** — blades spawn inside the lighthouse study and
  annex (scatter lacks exclusion radii that the tree scatter has). The
  owner's literal example of the jank class.
- ~~Drained-seabed softlock~~ — fixed in iteration 3 (rim clamp at −2.2 +
  Continue-time rescue).
- **Model sea reads chalky up close** — sun-glitter speckle at 1:240 scale
  overwhelms the body color; consider damping spec/foam by a uniform set on
  the model instance's material clone... careful: water material is shared
  by design. Maybe derivative-based fade instead.
- **Chest lid state is session-local** — `chestOpen` lives on Game, not W:
  reload after taking the ruler shows a closed chest (cosmetic, but a
  continuity break).
- **Beam reads as two streaks** from some angles (open-ended double-sided
  cone); could use a soft volumetric impostor or inner cone.
- ~~Cellar is flat~~ — fixed in iteration 4 (fill light, carve halo, light
  shaft, motes).
- ~~Stone glyphs barely visible~~ — fixed in iteration 6: they were facing
  the open sea; flipped inboard, brightened, halo'd, tone-pulsed.
- **Trees pop flat at distance** — no LOD/imposters; distant canopies could
  be cheaper AND prettier (billboard ring?).
- ~~Gulls never land~~ — iteration 9: the first gull takes the gallery rail
  at dawn, folds its wings, faces the sun, departs after. (Still two quads
  up close — that half of the item stands if anyone ever cares.)
- **Intro dolly underuses the sea** — the approach should skim wave-top
  with spray before rising to the beach; title timing could breathe more.
- **Story axis is thin** — who was the cartographer? The coat, the
  footprints, the warm window are beats without a throughline. Journal
  pages / etched marginalia on the chart table / a name somewhere.
- **Secret axis unexplored** — the model's model (the speck impostor on the
  model's chart table) is begging to do something for players who lean in
  with the time cranked to night.
- **Finale could resolve more** — the day-wheel happens, but the credits
  sky could spell the constellation/leitmotif; the bell could audibly
  gather all five stems into the final chord more explicitly.
- **Weather axis absent** — the grades support fog density already; a slow
  drizzle or mist roll-in (synth rain on the amb bus) would be a mood
  multiplier, if it can stay 60fps and grade-consistent.
