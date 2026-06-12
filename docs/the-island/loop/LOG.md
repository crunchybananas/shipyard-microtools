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
- **Islet is bald** — grass scatter only covers the main island; the stones
  islet reads naked, especially at golden hour.
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
