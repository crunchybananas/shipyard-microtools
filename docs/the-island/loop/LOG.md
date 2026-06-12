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

- **Grass inside structures** — blades spawn inside the lighthouse study and
  annex (scatter lacks exclusion radii that the tree scatter has). The
  owner's literal example of the jank class.
- **Drained-seabed softlock** — with the tide out, the exposed bay floor has
  ravines (e.g. mouth near (52, −1), floor at −5) whose walls all exceed the
  1.35 walkable gradient: walk in, never out. Below the waterline the world
  also reads hollow (water-sheet edge + unskinned skirt), and the 12 s
  autosave can persist the trapped position. Owner hit this live on level 2.
- **Model sea reads chalky up close** — sun-glitter speckle at 1:240 scale
  overwhelms the body color; consider damping spec/foam by a uniform set on
  the model instance's material clone... careful: water material is shared
  by design. Maybe derivative-based fade instead.
- **Chest lid state is session-local** — `chestOpen` lives on Game, not W:
  reload after taking the ruler shows a closed chest (cosmetic, but a
  continuity break).
- **Beam reads as two streaks** from some angles (open-ended double-sided
  cone); could use a soft volumetric impostor or inner cone.
- **Cellar is flat** — one point light, no dust motes, the carve barely
  reads; this room delivers the plumb bob and deserves mood.
- **Stone glyphs barely visible** — the etched music glyphs on the standing
  stones are too subtle to serve as the clue they are.
- **Trees pop flat at distance** — no LOD/imposters; distant canopies could
  be cheaper AND prettier (billboard ring?).
- **Gulls are two quads** — fine at range, comic up close; they also never
  land. A gull landing on the gallery rail at dawn would be free soul.
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
