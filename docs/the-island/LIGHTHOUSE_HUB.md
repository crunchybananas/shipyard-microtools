# THE LIGHTHOUSE AS A PROGRESSION HUB — design (APPROVED, building)

> Status: **APPROVED — building.** Owner reviewed + answered the six questions (2026-06-25) and said
> "start building". **Phase A (bones) is BUILT + SHIPPED.** Decisions are recorded in §7.
> Canon guardrails: zero-dep three.js · ALL-METAPHOR · grief → INTEGRATION · power-safe 60fps ·
> the 1:240 chart-table model mirrors the island (recursion) · never literal.
>
> **OWNER DECISIONS (binding):** (1) tunnels = **large network**; (2) top vista = **foreshadow** (glimpse
> the next level's waterline); (3) cross-level = **YES, tunnels connect between sea-strata levels** (this is
> what justifies the large network); (4) flood-per-depth = **YES**; (5) lore = **one line each**; (6) start
> with **Phase A bones**. Build order: A bones ✅ → B climb + foreshadow vista → C large cross-level flooded
> network → D wiring.

---

## 1. The core idea (why this is *right*, not just bigger)

ABYME already runs on two axes: you go **down** (the dive / SEA-STRATA — descend into deeper, dimmer
copies of the island) and you go **up** (the climb-out ending — `W.flags.returned`). Right now the
lighthouse is mostly a *fixture* you operate from the study; the descent happens through a plate in the
floor and the ascent is an ending.

The hub idea makes the lighthouse **hold both axes in one structure** — and that's the whole game's
metaphor made architectural:

- **The top — the watch.** You climb to tend the light. The part of grief that keeps a vigil, keeps
  something lit, keeps perspective.
- **The middle — the working room.** The study: where you look at your situation from outside (the
  model), and keep doing the daily work.
- **The depths — the buried.** Tunnels under the foundation: the unspoken, the things you don't go into
  until you're ready.

> **The lighthouse is the architecture of a grieving mind.** It opens up as you do the work — locked
> parts become walkable. **That progressive opening *is* integration, made spatial.** You don't conquer
> the lighthouse; you become able to move through all of yourself.

---

## 2. Current state (what we build on)

- **Tower** (~26 m, tapered) with a gallery + lamp room + dome at the top (the lamp lens ≈ y36). Today
  it's only seen from outside / operated via the model — **not climbable.**
- **Base drum = the study** (~5.2 m radius): chart table + 1:240 model, valve, sun-crank, music box,
  the brass descent plate. The control room.
- **Annex** (keeper's room, props.js:777): small, attached at the drum edge — currently **overlaps the
  drum wall (z-fights)** and has no real walkable connection (owner-flagged). Opens one dive-level down.
- **Cellar** (props.js:1448, group `cellar`): already a real underground space — the vault vista, the
  "room that disagrees" (`disagreeSea`/`disagreeLamp`), the light shaft, motes. **This is the seed of
  the tunnel network — we grow it, we don't start from scratch.**
- **Progression flags** (`W.flags`): `lampLit`, `hatchOpen`, `carried`, `returned`, `bellRung` — the
  unlock signals we gate hub spaces on.
- **Window** — just fixed (glazed, reads as a window).

---

## 3. The four spaces

### A · Ground floor — *the working room* (fix + open)
**What:** the study, made into a clean, properly walkable ground floor; the annex fixed and connected.
**Fix the bones:** nudge the annex out so its wall no longer overlaps the drum (kill the z-fight), cut a
real doorway in the drum at the annex angle, and widen the passage so you can actually walk in. The annex
stays the keeper's room (the life left mid-sentence), now reachable.
**Metaphor:** the present-tense room — the daily work continues while you grieve.
**Gate:** open from the start (annex still reveals its contents one level down, as today).

### B · The climb — *the watch* (new)
**What:** an internal spiral stair winding up the tower from the ground floor to a **walkable lamp room +
gallery (outdoor balcony)** at the top, with a **vista** over the whole island and the sea.
**The vista is the payoff:** from the top you see the island whole — the stones, the causeway, the
drowned shapes — and the sea-strata reading of the tide. Orientation and awe; the model made real at
1:1. (Option: the top is where you glimpse the *next* level's waterline — a quiet foreshadow.)
**Metaphor:** going up to tend the light = the vigil, hope kept lit, the long view that grief eventually
allows.
**Gate:** the stair is dark/roped until **`lampLit`** — you earn the climb by lighting the lamp. (Lighting
the lamp is already a mid-game beat.)

### C · The tunnels — *the buried* (grow the cellar)
**What:** extend `cellar` into a small **network** beneath the foundation — the keeper's workings, old
drains, buried rooms — revealed a piece at a time. Each tunnel carries one thing: a fragment/lore beat
(the keeper's buried writing), a small mechanic, or a connection (e.g., a tunnel that surfaces at the
stones).
**Scale (proposed):** **3–4 short tunnels**, not a maze — legible, each a single idea. Lean geometry
(instanced supports, BackSide shells like the existing vault) so it stays in budget.
**Metaphor:** the foundations the light stands on — the parts of grief you go into only when ready. The
descent work, literalized under the structure that holds the watch.
**Gate:** staged — tunnel 1 with the cellar/plumb beat (`hatchOpen`); deeper ones after a dive / near the
turn; the deepest only after the keeper (`carried`).

### D · Hub wiring — *integration* (progressive opening)
**What:** make the lighthouse the **return point** that visibly opens each pass: study → annex → climb
(`lampLit`) → tunnels (staged) → fully open after the turn/return (`carried`/`returned`). Coming back and
finding more of it walkable is the felt reward.
**Metaphor:** the parts becoming connected = integration. The final state (everything open, top and
tunnels both reachable) is the structure whole.

---

## 4. Progression map (gate → space)

| Beat / flag | Unlocks |
|---|---|
| start | study ground floor (walkable, annex fixed) |
| one dive down | annex contents (existing) |
| `lampLit` | the stair + walkable top + vista |
| `hatchOpen` | tunnel 1 (cellar/plumb, existing) |
| after a dive / mid-descent | tunnel 2 (a buried fragment) |
| `carried` (the turn) | the deepest tunnel |
| `returned` | the lighthouse fully open — the integrated structure |

---

## 5. Technical constraints (the honest ones)

- **The 1:240 model clone mirrors the island (recursion).** Every lighthouse change reflects in the
  chart-table model. The clone prunes some named groups (`MODEL_PRUNE`) and chokes on `Points` — interior
  stair/tunnel detail should be `Mesh`/`InstancedMesh` and likely pruned from the tiny clone (too small to
  read). Need to verify the climb/tunnels don't break `core.clone(true)`.
- **Power budget:** more geometry (stair steps, top room, tunnels). Hold <360 draws / <800k tris /
  <16.6 ms. Levers: instance the stair steps; gate tunnel-section visibility on player proximity (don't
  render the whole network at once); reuse the BackSide-shell trick the vault already uses.
- **Collision:** `player.interior()` exists; interior walkability already works for the study. The stair
  needs walkable step collision (ramp approximation likely simpler than true steps) and the tunnels need
  wall collision — confirm how the study interior currently constrains the player.
- **SEA-STRATA per level:** the lighthouse exists in every region copy. Decide whether the hub changes per
  depth — e.g., **tunnels flood as the tide rises deeper** (a strong, free metaphor: the buried parts go
  underwater the deeper you are), the top vista dims/changes per era grade.
- **Intro fly-over:** the opening camera path must not clip the new stair/top geometry.

---

## 6. Phasing & rough scope

- **Phase A — Bones** (~1–2 sessions): annex overlap fix + doorway + walkable ground floor. *Also clears
  the glitch the owner flagged.*
- **Phase B — The climb** (~2–3 sessions): stair + walkable top + vista + `lampLit` gate + model-clone safety.
- **Phase C — The tunnels** (~3–4 sessions): 3–4 tunnels, staged unlocks, fragments, flood-per-level.
- **Phase D — Wiring** (~1–2 sessions): progression gating, return-point polish, full-open integration state.

Each phase ships standalone and is verifiable in isolation.

---

## 7. Questions — ANSWERED (owner, 2026-06-25)

1. **Tunnel scale:** → **LARGE NETWORK.** Go bigger than 3–4 — a non-linear warren, a real explorable depth.
2. **The top vista:** → **FORESHADOW (mechanical).** The top glimpses the *next level's waterline* — a quiet
   reveal of where the descent goes, on top of the contemplative whole-island view.
3. **Cross-level:** → **YES — tunnels connect *between* sea-strata levels.** This is the keystone: the
   cross-level links are what make the large network cohere (a warren that descends through the strata, not
   isolated per-level basements). The dive/flood and the tunnels become one continuous descent.
4. **Flood-per-depth:** → **YES.** Tunnels flood as you go deeper — the buried parts go underwater the
   deeper you carry the grief.
5. **New writing:** → **one line each.** Atmospheric, not a reading chore.
6. **Start phase:** → **Phase A bones first.** ✅ BUILT + SHIPPED (annex z-fight fix + real walkable doorway
   throat + drum doorway; clears the owner-flagged "can't go in, too tight, glitches into the main part").
