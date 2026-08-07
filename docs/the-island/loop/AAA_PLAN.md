# ABYME — The AAA Plan

*Written 2026-08-06, the day the issue board hit zero. Everything below assumes the
canon locks (SPINE.md): grief resolves to INTEGRATION, all-metaphor and never
biography, the keeper is the only speaking I/you (written hands may write), the twist
beats are load-bearing, three.js only, and every graphics change holds or cuts power.*

The craft caught up with the ambition this month: 28-assertion walk gate, -59% GPU,
touch, settings, spatial audio, 16 readable fragments, three optional chains, three
written hands, and a codebase split into leaves and seams. What has NOT caught up is
the thing the player carries out of the game. The owner's steer is exact: **the story
still needs work.** So the plan puts story first, and everything else in service of it.

---

## Part I — The honest story diagnosis

What the game is today: wake, work the surface chain, reach the top, see the model
(twist one: the island contains itself, and you are in it), earn the dive, descend
four strata reading what the keeper left, reach the source, choose to leave or to
stay. It is *coherent*. It is not yet *gripping*. Five specific weaknesses:

**D1 — The middle act is a reading list.** Between the model twist and the source,
the player's verbs are: descend, find paper, read paper. Understanding accumulates
passively. Nothing the player DOES between L2 and L4 changes what they believe or
what the island does. The great environmental narratives (Outer Wilds, Edith Finch)
never let the middle go slack — every discovery re-aims the player.

**D2 — The keeper is prose, never presence.** He exists entirely as text. He is well
written, but he is never STAGED — the game never blocks him into a scene the player
inhabits. We already own his props (the crank, the lamp, the logbook, the bell); we
have never made the player stand where he stood and do what he did *knowingly*.

**D3 — No second force wants anything.** The Watcher and the Tide-Figure are superb
vignettes, but they are weather, not will. The inspector — institutional doubt, the
world that measures — is the seed of a counter-force and exists only on paper. Drama
needs a second pressure on the player's sympathy, not just atmosphere.

**D4 — Nothing is ever lost.** The tide rises between strata but costs nothing the
player can see. No irreversibility anywhere until the final choice, so the final
choice carries the whole game's weight alone. Grief without loss is theory.

**D5 — The endings close the game without reopening it.** Leave and stay are both
staged, both earned, but neither *recontextualizes* the hours behind it. A AAA ending
makes the player re-see everything they did — ours lets them stop doing it.

A three-lens self-critique was run against this diagnosis (the bereaved player, the
Myst veteran, the story-skeptic critic). The bereaved player asks that loss never be
punished mechanically — losing must be the game's grammar, not its penalty. The Myst
veteran warns that agents and clocks can cheapen a contemplative island — pressure
must be tidal, not ticking. The skeptic says the middle act needs a QUESTION, not
more content. All three constraints are honored below.

## Part II — The story overhaul (the one big swing)

One reframe fixes D1-D5 together, and the geometry already supports it:

**The strata are not depths. They are eras.** The drowned island repeats because the
keeper's life repeats — the same island, four times, at four ages of one tenancy.
L1 is the last day. L2 is the arrival years (the climbers' era — his first descent,
the kelp slate's first shallow wonder). L3 is the inspection years (the congregation
capitals, the commendation, the world measuring him). L4 is the last winter (the
source, the final instruction). Nothing about SEA-STRATA's geometry changes; what
changes is that every artifact, encounter, and ambient choice is RE-KEYED to its era,
and the game says so out loud exactly once, at the L2 threshold. Depth becomes time.
Diving becomes remembering. The rising tide becomes what rising tides are in a life.

On that spine, five story systems:

**S1 — HIS ROUNDS (fixes D2).** At each stratum there is one act the keeper performed
daily, findable and performable: wind what he wound, light what he lit, log what he
logged, ring what he rang. Performing a round stages an ECHO TABLEAU — a brief,
non-verbal blocking of light, sound, and the resident encounter-figure arranged as
actors (the Watcher stands where a visitor stood; the Tide-Figure waits where someone
waited at the shore). No new speaker, no biography — memory as stagecraft. Completing
all four rounds is an optional chain whose payoff lands inside the endings (S5).

**S2 — THE INSPECTION, PLAYABLE (fixes D3).** The ambiguity engine becomes a verb.
Every inspector artifact (ledger, commendation copy, closure notice, and two new ones)
can be FILED — placed into the quarters' cabinet, the record completed for the world —
or KEPT — carried down and left at the source. Neither is scored; both are read back.
The codex grows a drawer that shows what the player did with the record of a life.
This is the middle act's running question: *does a life belong to its measurements or
to its witnesses?* — asked entirely with existing mechanics (carry, place, read).

**S3 — THE SHRINKING SHORE (fixes D4).** Each return to the surface, one pre-staged
piece of shore is gone under the water — the jetty's outer arm, the beach path's low
loop, the south shallows bench. Scripted, irreversible, three moments total, each
marked only by a whisper that names what the water now holds. The world the player
saves gets visibly smaller as they understand it better. That IS the game's thesis,
finally enacted by the world instead of described by it. (Power-neutral: pre-staged
variants of existing meshes, toggled once per act.)

**S4 — ERA EVENTS (fixes D1).** One authored, unmissable event at each stratum's
threshold — the moment of arrival re-aimed: L2, the climbers' rope still swinging
somewhere ahead (motion where nothing should move); L3, the congregation's three
capitals BREACH as the player watches the waterline (the only time the sea gives
something back); L4, the beam sweeps once below the surface and goes dark for the
rest of the stratum (the island stops performing; now it is only true things). Each
event is staging + audio on existing props — no new systems, maximum re-aim.

**S5 — ENDINGS THAT RE-OPEN (fixes D5).** Both endings gain a read-back coda built
from play: the rounds performed, the record filed or kept, the shore the water took.
Leaving, the boat passes the drowned pieces at oar-height — close enough to name.
Staying, the model shows its mark standing among them, at home. Same endings, same
canon, but now they are mirrors of THIS player's walk, not terminals of any walk.

Sequenced: S-keying (the era pass) → S4 → S1 → S2 → S3 → S5. Each lands
independently; the walk gate grows an assertion per system.

## Part III — The pillars

**Art.** The island reads as handsome-indie; AAA needs signature images. Four
composed VISTA moments (one per stratum arrival, framed like key art — camera-locked
first sighting), a color script per era (L2 warm-green wonder, L3 steel-grey
measurement, L4 near-monochrome), the Bender normal-relief pass on sand/rock/bark
(owner task, queued), and water-as-character (era-tinted, within the power policy).

**Audio.** The music box's five notes are the game's leitmotif and don't know it yet:
four arrangements, one per era, under the ambient beds; the rounds each get an
instrument. Voice stays TEXT — breathed, wordless close-mic textures only (the
written-hands conceit survives; a spoken keeper would collapse it). Owner decision
gate documented before any Bender voice work.

**Tech.** Save versioning + migration test (saves now survive story re-keying),
draw/tri budget assertions inside the walk gate, and a bench regression line in CI.

**QA/CI.** The walk gate goes to GitHub Actions: headless Chrome, walk.mjs 28+/28+,
coverage.mjs, and a golden-screenshot diff set (the four vistas, both endings). The
harness already exists; CI is packaging it.

**Packaging.** A release the world can hold: itch.io first (web build is done — this
is a page), then a Tauri desktop wrap for Steam, capsule/key art from the vista
system, and a 90-second trailer CAPTURED BY THE HARNESS (the cdp walk is a camera
dolly that never misses a mark).

**Accessibility.** Reading pace control (whisper hold ×1/×1.5/×2), text size,
photosensitivity audit of the beam/bloom moments, colorblind pass on glint/glyph
reads, and a no-timer guarantee documented (the island already never rushes anyone).

## Part IV — Sequencing

- **Phase A — the story overhaul** (S-keying, S4, S1, S2, S3, S5) — everything else
  waits; this is the owner's steer.
- **Phase B — the frame** (vistas + color script + leitmotif arrangements) — art and
  audio landing on the now-final story beats.
- **Phase C — the door** (CI, saves, packaging, accessibility, trailer) — the world
  gets let in last, when what it meets is worth it.

The board carries one epic per phase; every child issue states its walk-gate
assertion. The loop protocol (one verified fire, LOG, push cadence) is unchanged —
it is how all of the above ships.

**The board (filed 2026-08-06, label `aaa`):**
- **EPIC AAA-A #144** — the story overhaul: #129 era re-keying · #130 era events ·
  #131 His Rounds · #132 the Inspection playable · #133 the Shrinking Shore ·
  #134 endings that re-open
- **EPIC AAA-B #145** — the frame: #135 vistas · #136 color script · #137 leitmotif ·
  #138 Bender normal-relief (owner)
- **EPIC AAA-C #146** — the door: #139 CI · #140 saves · #141 release ·
  #142 trailer (owner gate) · #143 accessibility
