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

## 37 — 2026-06-19 — environment (the Keeper's Quarters — a life mid-sentence) — #15

**Shipped:** The first real ENVIRONMENT, now earned (you can descend #33, someone's
there #14, the ending resolves #22, the levels read #36). The annex — already the
keeper's space (coat, bell, footprints) and already reachable at depth — is
furnished into a life left mid-sentence (#15, panel critical-path step 5):
- **A cot** against the far wall, blanket cold and unmade, a pale pillow.
- **A cold dead stove** — iron body, lid, a flue to the roof, its mouth a black
  hole. The fire long out; the contrast the warm lamp needs.
- **The wound on the wall**: the recursion drawn in the keeper's own hand —
  nested islands receding to a single warm-lit dot (echoes the nestedGlint). He
  KNEW where the descent led and drew himself down it anyway.
- **The one WARM lamp**, hung over the room (brass cap + emissive globe in
  `props.js`; the `keeperLamp` point-light in `main.js`, warm 0xffb45a, gated to
  `W.level >= 2` with a faint lamp-oil flicker). Darkness defined by a light it
  threatens, not a black frame — folds in the Art Director's deep-level key light
  and issue #19's remaining piece.

SAFE BUILD: purely additive geometry + one gated light — NO new walkable space,
NO collision/walkableY change (the annex was already reachable), so main can't
break or softlock. All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`) at L2 — teleported into the annex (player on the
annex floor y13.5, reachable at depth via the verified dive). Screenshots: the
study→open-inner-door vista with the warm lamp glowing through; a 3/4 interior
(cot, warm lamp globe, nested-sketch wound, coat all reading); a wide interior
(lamp + sketch + cot + coat + bell + maker's marks, warm-lit). Numeric: quarters
group has 4 furnishing subgroups (cot/stove/sketch/lamp); `keeperLamp` intensity
~25 at L2, **0 at L1** (no surface leak — furnishings hidden behind the closed
inner door). Zero console errors; 198–530 fps, draws ≤243.

**Debt:** none added. The quarters is a furnished reachable room, not a sealed
vista — the fuller-walkability worry didn't apply (the annex was already walkable).

**Next tick suggestion:** **#16 The Drowned Gallery** (panel critical-path step 6
— abyss as architecture, NOW allowed since the spine carries weight). The first
sunless, low-ceiling interior the drained tide reveals: reuse the cellar
BackSide-box recipe at a ~2.2m ceiling, knee-deep water keyed to `W.tide`, lit by
`waterShallow` caustics against the (now-legible) deep grade — no sun. This one
IS a new walkable space, so build it carefully and fully-verified, or ship a
COMPLETE sealed-vista slice (see into the drowned corridor through the drained
chasm before you can enter) and note the rest — never half-ship a walkable space.

---

## 36 — 2026-06-19 — graphics (the descent's era-colors finally READ) — #13 redux

**Shipped:** The reachable decay (loops 30–33) was a grey value-ramp, not a
color-arc — the Art Director (panel #2) proved `gradeBias` desaturated toward
luminance FIRST, then blended the cast at only 0.10·d, so the hue was dead before
the cast spoke (a neutral wall at L2 landed one 8-bit value off pure grey).
Fixed (`world.js gradeBias`, panel critical-path step 4):
- **Reordered: tint → desat → darken.** The cast is now tinted onto the
  FULL-chroma colour first (so the hue actually shifts), then the tinted result
  is desaturated toward grey, then darkened. Emotion rides chroma; depth rides
  the dark multiplier.
- **Re-authored the four casts as saturated, hue-separated, sequenced** as a felt
  descent: L2 sodium streetlight green-yellow (false comfort) → L3 sickly
  jaundice/fluorescent gold (sickness) → L4 cold isolation blue → L5 dead violet
  floor. The old warm-cold-warm-cold zigzag is gone; warmth drains to cold as you
  sink.
- **Per-channel darkness floor** (`_LUM_FLOOR = 0.045`, hue-preserving, capped) so
  night × depth lifts to a resolvable ember instead of crushing to black.

All metaphor, no biography, no JS dep, no asset. L1 surface is untouched (the
`d===0` early return); the finale is untouched (it grades at level 1 via
`W._finaleWarm`).

**Evidence:** on-screen L1→L5 strip at a fixed noon beach vantage (5 screenshots)
— now reads as distinct FEELINGS without labels: L1 bright clean blue (alive) →
L2 pale sickly (faint false comfort) → L3 jaundiced grey-gold (sickness) → L4
cold deep blue (isolation) → L5 dim dead violet (the floor), each a distinct
temperature, none a grey ramp. Night × L4 screenshot: deep cold blue, oppressive
but fully READABLE (lighthouse/trees/stars resolvable, not black) — the floor
works. Numeric: `gradeAt` with `W._finaleWarm` at L4 === L1 identity
(`warmEqualsL1: true`) — finale provably unaffected; L4-curdled skyTop
[.054,.109,.258] vs L1 [.042,.195,.479]. Zero console errors; 242–486 fps.

**Debt:** none added. The Art Director's remaining note — ONE warm key light at
the deepest level — is folded into #15 (Keeper's Quarters), the next tick, not a
gradeBias concern.

**Next tick suggestion:** **#15 — The Keeper's Quarters** (panel critical-path
step 5). The first real ENVIRONMENT, and only now earned: the player can descend
(#33), there's a someone at the bottom (#14), the ending resolves (#22), and the
levels read (#36). Build the inhabited room mid-descent — a cot, a cold stove, a
chart in progress, the wall papered in nested island sketches shrinking toward a
single dot — with the ONE warm lamp-oil point-light that makes every cold room
frightening by contrast (the Art Director's deep-level key light, folding in #19).
It converts the nestedGlint secret into a wound: the keeper KNEW where the descent
led and drew himself down it anyway. Reuse the cellar BackSide-box recipe; keep
collision + wedge-net safe; do NOT half-ship a walkable space (a sealed vista
slice is acceptable if it can't finish cleanly).

---

## 35 — 2026-06-19 — story (the finale forks — the bottom withholds) — #22 · batch-7 push

**Shipped:** The ending no longer plays the old golden victory parade at the
floor of a grief, and no longer inherits the descent's decay curdle (#22, panel
critical-path step 3). Two fixes, one beat:
- **Exempt the finale from `gradeBias`** (`world.js`): a new transient
  `W._finaleWarm` forces the clean (level-1) grade during the finale, so the
  resolution lands warm — never desaturated by how deep you rang the bell.
- **Fork the finale TONE by depth** (`main.js` startFinale/tickFinale,
  `audio.js bellToll(withhold)`):
  - **Surface (level 2)** — the loved ending, preserved and now un-curdled: the
    day wheels to a clean night, the score gathers its earned stems, the 5-star
    constellation completes. Card: "the tide brought you back".
  - **Deep (level ≥ 3)** — the bottom WITHHOLDS: the day holds at a bittersweet
    golden hour the night (and its stars) never reaches, the constellation never
    lights, `bellToll(true)` thins the gathered score to a lone tonic + a single
    falling figure (the drones fade, the leitmotif/pulse/shimmer intervals stop),
    and the keeper murmurs once from below. Card: "you keep the light now".

All metaphor, no biography, no JS dep, no asset. "Awe and dread live in subtraction."

**Evidence:** in-play (`?debug`) — drove the bell hotspot's `onClick` at L4 →
deep branch (`W._finaleWarm` true, card "you keep the light now", `uConstelGlow`
all 0, card shown) + **screenshot**: warm pink/lavender/peach golden-hour sky,
NO stars, NOT the L4 isolation-blue curdle. Then reloaded, L2 → surface branch
(card "the tide brought you back") + **screenshot**: clean night, full 5-star
constellation lit, moon + Milky Way — the loved ending intact and un-muddied.
Zero console errors; 60 fps.

**Debt:** the withheld toll + keeper murmur are synthesized and verified
ERROR-FREE but **not auditioned** (muted headless), as with all `audio.js` work.
Still open from the arc: the UP/ascent (#12 remainder — running the dive
backward), and the don't-ring / climb-out terminal branch (#22 full / SPINE
endgame step 5) — this tick forked the RING-at-depth tone, not the ring-vs-leave
choice.

**Next tick suggestion:** **#13 redux — make the descent's color actually READ**
(panel critical-path step 4). Now that the levels are reachable AND the finale is
protected, fix the era-grade legibility the Art Director flagged: in
`world.js gradeBias`, reorder to **tint the cast onto the full-chroma color
FIRST, then desaturate the result, then darken** (today desat runs first and
kills the hue before the cast applies — a neutral wall at L2 lands one 8-bit
value off grey), and re-author the four casts as saturated, separated hues
(emotion via chroma, depth via the dark multiplier) with a per-channel darkness
floor so night×depth isn't unreadable black. Verify on-screen as an L1–L5 strip
a stranger could name without labels.

---

## 34 — 2026-06-19 — story (the keeper — a second person at the bottom) — #14

**Shipped:** The descent now descends TOWARD someone. Grief is transitive (panel
#2's sharpest point); loops 30–33 rendered an absent keeper's *belongings*, so
this iteration gives the keeper a voice and a face — the cheapest possible
second person, no human mesh, all synthesis (#14, panel critical-path step 2):
- **The keeper's voice** (`audio.js keeperVoice`): a band-limited, formant-based
  *drowned voice* — a glottal sawtooth through two vowel formants, low-passed to
  a murmur and echoed as if rising through the floor. NOT words (the whisper text
  carries those); a vocal TIMBRE that makes the floor below feel inhabited.
  Register bends the contour (curious rises / pleading wavers / resigned falls).
- **He answers your arrival** (`main.js` post-dive): from L3 down, a few seconds
  after you land deeper, the keeper speaks — his words in quotes ("Oh. You came
  down too." → "There is no bottom. I looked.") over the voice murmur. The first
  "I/you" in the game, and unmissable.
- **The doll's house looks back** (`puzzles.js` + `props.js`): the model figure
  (`tinyFigure`) — restructured to pivot at its feet, with a brow giving it a
  FRONT — now turns to face you, tips its head up to your giant eye, and flares
  as you lean over the chart-table model at L3+. Surf ducks for a breath; the
  keeper speaks ("Oh. Not again." → "You're faster than I was…"). Once per level.
  Also: the figure breathes (subtle emissive) and the coat-style look eases back
  to rest when you step away.

All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`) — figure look mechanic verified numerically at
look=1 (faces player rotY, tips head rotX −0.6, body emissive 1.8→3.57, head
1.0→2.3, brow child present) and the proximity beat FIRED (`keeperLook3` once-key
set → voice+whisper+duck ran); `keeperVoice` runs error-free; look eases back to
0 (upright, emissive 1.8) when you step away; **close-up screenshot** of the
keeper standing on the model beach, head tipped up, brow toward the eye, glowing.
Arrival beat verified by composition (dive→L3 reachable since #33; the post-snap
block calls the verified voice+whisper gated `level>=3`). Zero console errors;
272–530 fps, draws ≤180.

**Debt:** the keeper voice is synthesized and verified ERROR-FREE but **not
auditioned** (headless `?debug` session is muted; no audio out) — same honest
limitation as all `audio.js` work this loop. Timbre is documented in code; an
owner listen is the real test. Still open from the critical path: finale
double-booking (#22) and the UP/ascent (#12 remainder).

**Next tick suggestion:** **#22 — the finale fork + exempt the finale from
`gradeBias`** (panel critical-path step 3). Today the bell fires the old golden
victory parade at the floor of a grief, AND that finale inherits a d=1 decay
curdle. Fork `startFinale` by depth: the surface bell stays golden; the bell rung
at depth WITHHOLDS (stems thin instead of gather, the constellation hesitates,
the keeper-glint pulses alone) and renders at a clean warm grade, not decay math.
"Awe and dread live in subtraction" — the bottom must sound like the bottom.

---

## 33 — 2026-06-19 — story (persona panel #2 → the descent becomes reachable) — #12 keystone

**Shipped:** Persona panel #2 (skeptic / art director / narrative architect / finisher →
showrunner) on the decay shipped in loops 30–32 — and **acted on its verdict the same iteration.**
The panel's unanimous, code-verified finding: the entire five-era decay was **unreachable** —
`W.level` was only ever set to `2` (`main.js:300`), so L3–L5 (false-gold / isolation-blue /
near-dark) lived behind a debug flag, "a five-octave instrument playing one quarter-tone." And the
dive cost nothing ("a slide, not a leap"). So I built the keystone (#12 minimal, = SPINE endgame
step 1):
- **The dive is a committed *brink ritual*** (`puzzles.js` plate): first touch brings you to the
  brink — `A.duckAmbient(true)` drops surf/wind to near-silence, a loss-whisper names the cost
  ("The journal will not follow you down." / "The way back closes behind the light.") — and a
  **second deliberate touch** commits. Step off the plate and the brink lets go ("You step back from
  the edge."). Autosave pauses at the brink (`game.atBrink()` gate in `main.js`).
- **The dive now increments the level** (`main.js` tickDive: `W.level = Math.min(W.level+1, MAX_DEPTH)`,
  was hardcoded `2`), repeatable, capped at `MAX_DEPTH = 4` (new in `world.js`). L5 (the keeper's
  near-dark floor) is reserved until a keeper + warm lamp inhabit it — an empty near-black room ships
  with #14/#15, not before. **The decay is reachable for the first time.**
- **Panel coat fix:** the coat no longer vanishes at L4+ (it slumps but stays) — it's the
  climb-out "it was always yours" reveal; deleting it builds against the SPINE.

All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`, muted) verification — decay reachable & **progressive** L1→L4
at fixed noon vantage (4 screenshots: bright→subtly-muddier→duller-grey→cold-dim-hazy); brink ritual
verified by driving the plate hotspot in play — arm (`atBrink` true, not committed, movement free) →
commit (`dove` set, player locked, dive cinematic runs); brink-cancel watchdog (step off → released);
re-divable at L2 (`when()` true); cap at L4 refuses; **save/load round-trip** (reload→Continue
restores level 2 via the dove-load rule). Zero console errors. fps 275–466, draws ~180–204, tris 519k.

**Debt:** **NEW VISUAL DEBT (panel, deferred by design):** `gradeBias` desaturates before tinting,
so the era *casts don't read as their named hues* (L3 "false-gold" reads grey, not gold) — the decay
is a value-ramp, not yet a color-arc. The fix (tint→desat→darken reorder + re-author casts as
saturated separated hues + darkness floor + warm key light) is **#13 redux**, the panel's step 4 —
deliberately NOT half-fixed here (reachability before refinement). Also open: finale double-booking
(step 3) and the UP/ascent (step 4).

**Next tick suggestion:** **#14 the Keeper voice + promote the figure** (panel critical-path step 2) —
the cheapest second person: a band-limited synthesized line keyed off existing chain flags ("Oh. Not
again." on the second dive) + promoting `tinyFigure`/`nestedGlint` from a 1mm speck to a met, facing
presence at the deepest reachable level. Grief is transitive; now that the player can descend, they
must descend TOWARD someone. (#13 redux is also strong, but a person at the bottom outranks legibility.)

---

## 32 — 2026-06-19 — story (the trail washes away, the bell stirs) — closes #13

**Shipped:** The last two prop-divergence beats, completing #13 (grade +
coat + window + footprints + bell all diverge by depth now):
- **The keeper's footprints wash away** with the descent — the trail's shared
  material fades L2 0.5 → L3 0.29 → L4 0.08 → L5+ 0.06 (`puzzles.js _apply`).
  The path that led in is erased the deeper you are.
- **The bell stirs faintly**, growing with depth — still at the surface, then
  a slow `sin(elapsed)` sway scaled by level (0 → ±0.022 → … → ±0.088 rad,
  capped), as if something below keeps disturbing it.

Both metaphor, no biography, no dep, no asset.

**Evidence:** numeric sweep L1–L5 — footprints opacity 0.5/0.5/0.29/0.08/0.06,
bell rotZ 0/−0.022/−0.043/−0.065/−0.086; L1 untouched (bell still, prints
hidden). Visual: the bell + maker's-pair signature render correctly in the
annex at L2 (footprints are deliberately faint dark prints on sand — their
fade is numeric-verified, as with the grade work). Zero console errors.

**Debt:** none — **#13 fully closed** (the descent now decays in light AND
every object: sky/fog/water/sun, coat, window, footprints, bell).

**Next tick suggestion:** environment **#16 The Drowned Gallery** — a proper
dedicated build (the first sunless, low-ceiling interior the drained tide
reveals; cellar BackSide-box recipe, knee-deep water keyed to W.tide). It is
"large" — give it a full, carefully-verified iteration; do not half-ship a new
walkable space. Persona panel due ~iteration 34 (next).

---

## 31 — 2026-06-19 — story (the descent decays in objects too) — #13 prop divergence

**Shipped:** The era-color descent (iteration 30) now has matching *object*
decay — the keeper and the partner fade as you go down, keyed off `W.level`:
- **The keeper's coat** (annex): on its hook at level 2 → slumped to the floor
  at level 3 → gone at level 4+ (`puzzles.js _apply`, translation-only on the
  coat group so the stitched maker's-mark marginalia stays with it).
- **The partner's warm window** (the study glow): full at level 2, fading with
  depth (`windowFade` on `studyLight`: L2 1.0 → L3 0.58 → L4 0.16 → L5+ 0.12) —
  the lit study going cold the deeper you are.

Both metaphor, no biography. No new dep, no asset.

**Evidence:** coat numeric (L2 on-hook visible → L3 y−0.95 visible → L4 hidden)
+ visual (L2 upright on hook with stitches → L3 pooled on the floor and dimmer);
window numeric (windowFade L2→L5 = 1/0.58/0.16/0.12) + visual (study warm and
glowing at L2 night → markedly dim at L4 night). Zero console errors. Levels
3–5 via debug `W.level` (reachable once the ascent/multi-dive ships). Note:
the per-frame JS read of studyLight reads stale between hidden-tab rAF frames
— the screenshot path renders live, so visuals are the source of truth.

**Debt:** #13's remaining slivers — footprints (out-of-sea → into-sea reversal)
and the bell's faint deepening sway — left as small follow-ons; the coat +
window carry the emotional load. Kept #13 open.

**Next tick suggestion:** environment #16 (The Drowned Gallery) — the first
sunless, low-ceilinged interior, revealed when the tide drains; reuses the
cellar's BackSide-box recipe and reframes descent as the real direction. Or
finish #13's footprints/bell slivers for a quick close. Persona panel due
~iteration 34.

---

## 30 — 2026-06-19 — story/graphics (the descent decays — era color-psychology) — #13

**Shipped:** The keystone of the integration arc: descending the recursion now
*curdles through emotional eras*. A `gradeBias(level)` in `world.js` applied
inside `gradeAt` (one caller, so it propagates to sky, fog, water, and lights
at once) desaturates toward luminance, blends a per-depth era cast, darkens,
and thickens fog — all scaling with `W.level`. Level 1 (the surface) is exact
identity, so the normal game is untouched; every level down compounds. Era
casts: L2 streetlight green → L3 sickly false-gold → L4 isolation blue → L5+
near-dark, bottoming out toward the keeper. The model and world bias together
(one WorldState). Pure scalar/color math — no per-frame allocation, no
dependency, no asset (constraint honored).

**Evidence:** numeric sweep at fixed noon — L1 identity, then monotonic decay
L1→L5: sky luminance 0.182→0.063, saturation 0.91→0.56, sunInt 1.25→0.70,
fogDen 0.003→0.0064. Visual triplet (same vantage/time): L1 bright normal noon
→ L2 subtly muddier/dimmer (intended faint first step) → L4 cold grey-blue and
dim. Zero console errors; draws/tris unchanged (grade math only). Levels 3–5
verified via debug `W.level` (not yet reachable in play — they come online with
the ascent #12 / multi-dive; the system is ready for them).

**Debt:** #13's *prop* divergence remains (coat on hook→floor→gone, footprints
reversed, window dark, bell swinging) — a natural follow-on, smaller than the
grade keystone. Kept #13 open for it. NOTE: the finale runs at level 2, so it
now carries a faint d=1 curdle — acceptable (the deep levels *should* feel
different), revisit if the integration finale wants the pure golden grade.

**Batch 6 pushed** (26–30): ?debug mute, the narrative reframe, the Truth +
constraint, the wedge net, and this divergence.

**Next tick suggestion:** #19 (the explicit "deep" grade as a named sixth
palette) is now partly subsumed by gradeBias — re-scope it toward the
*deepest* level's bespoke look (the keeper's near-dark with the one warm lamp),
or pivot to the prop-divergence half of #13, or environment #16 (the Drowned
Gallery). All serve the descent.

---

## 29 — 2026-06-19 — movement/safety (the wedge net) — closes #3

**Shipped:** A general "stuck in a wall" fix. The owner hit it twice (drained
bay, water-filled chasm rim); the iteration-3 rim clamp only covered the
drained case. Now `player.js` carries a conservative wedge-escape net: if the
player is *pushing* but fully pinned for >0.6s **and** a 16-direction ring
test finds no walkable heading out, they're set back on the nearest dry,
gently-sloped ground (`_escapeWedge` spiral search), with a diegetic whisper —
"The ground gives you back." The ring test is the guard: against a normal
wall some heading is always open, so it never fires for ordinary walking.
Catches any wedge regardless of cause (rim, stale save, forced input).

**Evidence:** four checks, zero console errors —
- TRUE WEDGE (chasm floor, terrain −8.5, underwater): held W → detected after
  ~0.6s, escaped to dry ground (18.0), exactly **1** rescue, whisper shown.
- NORMAL WALL (lighthouse exterior, held W 2s): **0** rescues — player just
  stops at the wall, free to turn away (the safety-critical case).
- OPEN-GROUND WALK (beach, held W): moved 3.49 m normally, 0 rescues.
- DIRECT unit test of `_escapeWedge` from the chasm rim: repositions above
  water (gradient 0.87 < 0.9), zeroes velocity, fires `onRescue`.

No new dependency, no asset — pure logic. `TAU` added to player.js imports.

**Debt:** none.

**Next tick suggestion:** the keystone — **#13, diverge every level** as the
era color-psychology descent the integration reveal needs (saturated gold →
streetlight green → sickly false-gold → isolation blue → golden-hour
bittersweet). Pure grade/shader work, no dep, no asset, high wow. Drive a
`gradeBias(level)` so descent reads as decay, then one prop change per level.

---

## 28 — 2026-06-19 — story/process (the Truth is chosen; the constraint reframes)

**Shipped:** Two owner decisions, encoded.
- **The One Truth = GRIEF → INTEGRATION.** Grief is the descent (the keeper's
  refusal rendered as nested geometry); the figure at the bottom is the
  *wounded self*, and the true ending is **integration** — embrace it and
  ascend whole, not loop-forever or abandon-the-light. This dissolves the
  down-vs-up tension (up, *by integration*). The emotional architecture is
  drawn — **as pure metaphor** — from the owner's personal narrative
  (`~/code/MyStory`, private); **no biography enters committed docs or the
  deployed game.** SPINE.md rewritten: Truth chosen, the deepening added, the
  three alternatives demoted to "roads not taken — do not build." #9 closed.
- **Constraint reframe.** The real rule is **no external JS dependencies**
  (three.js is the one sanctioned exception; lodash/React/etc. are
  non-starters). The old "zero-asset / everything is math" rule is *relaxing*
  — meshes/textures/audio may now come from Bender or open-source, with
  restraint. MISSION.md Hard rules updated; voice issue #4 no longer needs
  opt-in for purity. When the first non-generated asset ships, README + the
  title "everything you will see and hear is made of math" line must change.

**Evidence:** SPINE.md + MISSION.md committed; #9 closed with the decision;
#4/#13/#22 annotated with the deepening; narrative epic #25 ticked + bannered.
No game code touched.

**Debt:** README still claims zero-asset (currently still true — no asset has
shipped). Flagged in MISSION to update at first asset.

**Next tick suggestion:** now build *toward the chosen arc*. #13 (diverge
every level) is the strongest first move — it's the era-colored descent the
integration reveal needs, pure shader/grade work (no new JS dep, no asset),
high wow. #3 (movement safety) still queued ahead of it. Hold the Keeper
voice (#14) until there's a divergence to speak over.

---

## 27 — 2026-06-19 — story/process (the reframe — the loop stops fleeing story)

**Shipped:** The narrative foundation. Owner reframed ABYME as Myst-*inspired*,
not a clone (Journeyman Project / Phantasmagoria / 7th Guest) and asked the
real questions: what's the story, the reveal, and what happens when you leave?
A persona panel (skeptic, art director, narrative architect, genre historian,
finisher → showrunner) answered. Three artifacts committed:
- **SPINE.md** — the working bible: recommended direction (**grief rendered as
  recursion** — the keeper's refusal to let go; the "light still lit far down"
  IS the keeper), the candidate **One Truth** (grief / quarantine / transmission
  / watched-loop — owner's call, NOT canon yet), the *leaving* endgame (down is
  the trap, **up** is the story), five new environments, borrowed techniques,
  and the live tensions kept un-flattened.
- **CRITIQUES.md** — the panel's full pushback, establishing the persona-review
  convention in the shared dev markdown (the owner's ask).
- **MISSION.md** — amended: story now gates graphics (a pretty tick that dodges
  the thesis can be *rejected*); story/puzzle/environment ticks must cite a SPINE
  beat; persona iterations defined (~every 5 builds).

16 issues (#9–#24) + narrative epic (#25) filed under the `abyme`/`story` labels.

**Evidence:** SPINE.md 107 lines / CRITIQUES.md 137 lines committed; 16 issues +
epic created and verified in the tracker (the gh-in-detached-shell keyring hang
was the only snag — foreground batches fixed it). No game code touched; build
unaffected.

**Debt:** none. The headline blocker is now **owner-facing**: pick the One Truth
(#9). Until then the loop builds truth-agnostic work (environments, the ascent,
level divergence, the deep grade) that pays off under any reveal.

**Next tick suggestion:** #3 (movement wedge-escape — safety, already queued),
then truth-agnostic story structure: #13 (diverge every level — highest wow,
turns the recursion into a felt decay) or #19 (the deep grade, the mechanism
every dark room needs). Hold the reveal-dependent beats (#14 Keeper voice, #22
finale fork) until the owner picks the Truth.

---

## 26 — 2026-06-19 — UX/dev (the test builds stay quiet) — closes #5

**Shipped:** `?debug` builds now start muted unless the player has
explicitly unmuted (`abyme-muted === '0'`), and a new `?mute` param forces
silence. So agent/developer test sessions are quiet by default while the
deployed game (no `?debug`) is untouched. Completes the sound-toggle story:
M-key toggle + persistent pref + the "M sound" controls hint (iteration 8)
+ this default-muted dev behaviour.

**Evidence:** predicate verified across all four cases — `?debug` no-pref →
muted; `?debug` + explicit unmute → unmuted (choice wins); plain player →
unmuted; `?mute` → muted. Live `?debug` session confirmed muted at boot,
no stored pref. One line of logic in `audio.js`, zero errors.

**Debt:** none. (The "subtle on-screen affordance" the issue floated is
already served by the controls-hint line; no new HUD chrome added.)

**Next tick suggestion:** #3 — movement wedge-escape. The owner hit
"stuck in a wall" at the water-filled chasm rim; the iteration-3 clamp only
covers the drained bay. A general wedge detector (or relaxed climb-out
below the safety line) protects every future player. Safety > flash.

---

## 25 — 2026-06-19 — performance (the jitter goes) — closes #1, #2

**Shipped:** Fixed the stutter, which was self-inflicted by iteration 12's
power pass. Two changes in `main.js`: (1) the adaptive-DPR logic called
`renderer.setPixelRatio()` on every move-start and ~1.2s after every stop —
each call reallocates the drawing buffer, a per-transition frame hitch.
Removed it entirely; resolution is now a fixed DPR 1.5. (2) the 60fps
governor's 15.5ms gate sat against the 60Hz vsync interval (16.7ms) — any
slightly-early frame got dropped → micro-stutter. Lowered to 12.5ms, which
sits safely between the 60Hz and 120Hz intervals so a 60Hz display never
drops a frame and 120Hz still halves.

**Evidence:** passive frame-timing over 148 frames at the beach (no input):
mean 16.67ms = **60.0fps, stddev 0.39ms, zero spikes >25ms, DPR constant**
(was a razor-thin 0.1ms margin under the old gate). Crispness preserved —
golden-hour lighthouse/study/glyphs read clean at 1.5. Zero console errors;
boot, intro-skip, teleports all fine.

**Debt:** POWER TRADE, flagged for the owner: rest no longer downscales to
1.3 (so pure-standing rest renders ~33% more pixels than iteration-12), but
motion is cut (1.75→1.5) and the realloc waste is gone. The 60fps cap +
1024 shadows remain the primary power levers, so fans should stay quiet.
The owner's fresh "jittery / performance tuning" directive refines the
older power one: smoothness + crispness over the marginal rest-DPR saving.
Dial: BASE_DPR is one constant (drop to 1.4/1.3 if fans return).

**Next tick suggestion:** #5 (sound-toggle discoverability + `?debug`
starts muted) — tiny, and makes the agent's own test sessions silent for
real. Then #3 (movement wedge-escape) for safety, then #4 (the voiced
layer) as the big wow.

---

## 24 — 2026-06-19 — story (the coat remembers its keeper)

**Shipped:** The cartographer's throughline closes on the last object that
was theirs: the maker's pair (triangle + ringed dot) is stitched small and
worn into the annex coat's hem — the same hand that signed the chart table
and the bell wore this coat. Standing close to it at level 2 earns one
quiet whisper, once per save: "Salt and lamp oil, still." Table → bell →
coat: three echoes of one person, found only by leaning in.

**Evidence:** lean-in screenshot — both glyphs legible on the hem at
opacity 0.45 in dim dawn light; the `coatScent` once-key fired exactly
once and the whisper rendered ("Salt and lamp oil, still."). Level-2 only
(R.coat.visible gates it); not a raycast target; zero console errors.

**Debt:** none added. NEAR-MISS recorded: COAT_POS was first built from
`LH`, which main.js declares far below in the lighting section — a TDZ that
white-screened the whole module. Rebuilt from `SPOTS` (imported at top).
LESSON: module-top consts must only reference top-level imports, never
section-local declarations. (This is the crash class to grep for.)

**Next tick suggestion:** the perf jitter (issues #1 + #2) — the
adaptive-DPR pass reallocates the framebuffer on every move/stop and the
60fps governor sits against the 60Hz vsync interval; both stutter. Highest
felt-wow because it smooths the whole game.

---

## 23 — 2026-06-12 — weather (the sky agrees with the ground)

**Shipped:** The weather feature completes: a `uMist` uniform in the sky
shader lifts a pale fret band off the horizon as mist thickens
(width grows with density, dimmed at night so it veils stars without
glowing), driven from the same eased `mistCur` as fog, sun and
drizzle — one scalar, five effects. On a heavy fret day the sea and
sky now meet in a single milk band with no horizon line; clear days
keep their crisp edge.

**Evidence:** heavy-fret beach pair — toward the island (washed tower,
pale low sky grading to blue) and the money shot toward open sea
(horizon fully dissolved); clear-slot regression (mist 0): crisp line,
natural thin horizon glow only, byte-identical path. Zero errors;
sky cost is two mix lines in the existing fragment.

**Debt:** cleared the sky-dome backlog item from 21. The weather system
is now whole: deterministic clock → fog + sun + drizzle + sky.

**Next tick suggestion:** owner direction still pending. Iteration 25
pushes batch 5 in two ticks. Remaining named survivor: tree-LOD vertex
half (power headroom is fine, so it's optional polish). Consider a
"state of the island" tick at 25: replay the full chain end-to-end via
debug walkthrough as a regression sweep before the push — 23 ticks of
changes deserve one integration pass.

---

## 22 — 2026-06-12 — close-look (the gulls get bodies — and stop flying sideways)

**Shipped:** The gulls are birds now: a cone body and sphere head (the
songbird's recipe at gull proportions) between the flapping wing quads —
the dawn percher reads as a creature on the rail, not two cards. And
the body exposed a day-one quirk invisible in the abstract chevrons:
the gulls flew SIDEWAYS — `rotation.y = -a - π/2` pointed local +z at
the gyre's center, with the wing quads' long axis along the tangent.
Heading fixed to `-a` (nose along the flight tangent, wings spanning
across it) and the perch's face-the-dawn target flipped to +π/2 (east,
as written) — it had been facing the lamp room. +4 draws (2 meshes × 2
gulls, shared material).

**Evidence:** heading verified two ways — a motion-vs-nose sampling
that returned garbage under tab suspension (matrix-update gremlin,
recorded as a verification trap: prefer DIRECT relation probes), then
the conclusive one: ry ≡ −a exactly in-page, and nose(−a) ≡ tangent(a)
by identity. Visuals: perched body-and-head profile on the east rail at
dawn from below; flight silhouette with body mass between banking
wings. Zero errors; draws within budget at all checked vantages.

**Debt:** "gulls are two quads" fully cleared (the landing was tick 9,
the body is this tick).

**Next tick suggestion:** owner direction still pending (asked at 21).
Strongest survivors: sky-dome mist awareness (new, from 21), tree-LOD
vertex half. Suggest sky-mist — it completes the weather feature and
the uMist uniform slot is one edit in the sky shader's horizon band.

---

## 21 — 2026-06-12 — weather (the day gets its arc)

**Shipped:** The mist curve tuned against the ACTUAL seeded slot rolls —
computed offline in node with the game's own mulberry32/SEED before
choosing constants (threshold 0.45→0.38, slope 1.1→1.35). The day now
arcs: thick sea-fret dawn (0.58), late-morning burn-off (0.22), a
midday 0.51 that crosses the drizzle threshold — the rain bed finally
plays in natural rotation, not just under debug forcing — then a
clearing afternoon, protected golden (max 0.000 across the window,
re-measured), clear evening, misty nights at the ceiling.

**Evidence:** offline candidate table vs in-page mistTargetAt sweep —
identical (0.45/0.45/0.58/0.22/0.51/0/0/0.45); the dawn-bird moment
verified under the new 0.58 fret: the bluff across the water dissolves
but all five stone glyphs blaze through and the songbird hangs clear
(screenshot — the 15-tick worry resolved: mist and the music moment
coexist); midday marine haze visual; drizzle gain measured 0.0066 ==
(0.51−0.45)×0.11 exactly. Zero errors; save restored. Noted, not
chased: the sky dome ignores mist (fog is geometry-only) — a
mist-aware horizon would deepen heavy fret days.

**Debt:** the 15-tick "mild day" note cleared. Sky-dome mist awareness
added as a small backlog idea below.

**Next tick suggestion:** ASK THE OWNER first — twenty-one iterations
in, the original backlog is nearly spent; the loop should learn where
to lean: more soul (story/secrets), more polish (gull geometry, tree
LOD verts, sky-mist), Ember parity, or something new entirely. Pending
their answer: gull close-up geometry is the strongest survivor.

---

## 20 — 2026-06-12 — graphics wow (the beam becomes light)

**Shipped:** The night beam no longer reads as two hard streaks. Two
composed fixes in the shared beam material family: a view-facing fade
in the fragment shader (glancing silhouette walls — the streak makers —
feather out; face-on body fills in), and a hot inner shell at ~55%
radius sharing the SAME material instance, so it follows `uIntensity`
and the model clone for free. The study's oculus shaft and the cellar's
hatch spill inherit the improvement automatically — one factory, three
beams. +1 draw call total.

**Evidence:** night side-on vantage from the south bay: the beam sweeps
the pines as a filled, graded wedge — hot at the lamp, feathered wide,
no parallel rails (screenshot; compare the backlog's wording against
it). draws 190 < 200 with the beam live; zero console errors. Save
restored to canonical afterward (lensPlaced was a RAM-only test flag;
restore keeps tick-17's migrated chestOpen=true).

**Debt:** cleared "beam reads as two streaks".

**Batch 4 pushed with this entry** — nested light, chest persistence,
credits constellation + gaze lift, journal marginalia + load re-render
fix, the beam. Twenty iterations, four batches.

**Next tick suggestion:** the backlog's survivors are thinning: gull
close-up geometry ("still two quads"), tree LOD's vertex half, weather
mild-day tuning + dawn-bird check, story umbrella close-out. Suggest
the weather tuning + dawn-mist songbird verification as one
mood-coherence tick — it touches the most-seen hours of play and pays
the 15-tick note. Then consider asking the owner where the loop should
lean next: more soul, more polish, or a pass through Ember parity.

---

## 19 — 2026-06-12 — story (the journal learns to draw)

**Shipped:** Field Notes is a keepsake: fifteen tiny ink sketches — the
keeper's marginalia — one for every journal entry, from the chart table
with its island to the crossed valve wheel to the nested-rectangles
recursion of "one level down." All code-generated inline SVG (zero
assets), stroke supplied by CSS in the marginalia teal, matched at
render time by each entry's own words — the stored `sketch` field stays
untouched, so every save old and new gets its pictures retroactively.
Bonus kill: a real pre-existing bug exposed by verification — the
journal rendered once at boot (empty) and NEVER re-rendered after a
save loaded, so Continue-players always opened an empty journal until
a new entry arrived. toggleJournal now re-renders on open.

**Evidence:** real-input J keydown after Continue on the owner's save:
3 entries, 3 sketches (screenshot — table, valve, recursion all
legible at 46 px in the journal's ink palette); before the re-render
fix the same flow showed 0 entries (the exposed bug, captured in the
numbers); zero console errors; no state mutation (J never saves).

**Debt:** none added. The remaining unsketched entries ship art the
moment those entries are earned — same dictionary.

**Next tick suggestion:** iteration 20 closes batch 4 — PUSH (MISSION
step 3: submodule then parent; nested light, chest persistence,
constellation, journal sketches + this tick's). For the work: the
"Story axis is thin" umbrella item — the journal now draws, the
marginalia signs, the annex echoes; consider closing that backlog
bullet with a final pass: ONE more environmental beat tying the
cartographer to the recursion (the coat's pocket? initials under the
table?) — or simply promote the dawn-mist/songbird + mild-day weather
tuning if the story feels complete enough.

---

## 18 — 2026-06-12 — finale (the credits sky spells the leitmotif)

**Shipped:** The finale resolves in the sky now. Five warm stars — set
in the standing stones' own arc shape — wait dark among the starfield
and ignite one per note of the leitmotif as the day-wheel turns through
night (cues at t=6+0.9i, 1.2 s blooms, `uConstelDir/uConstelGlow`
uniform arrays in the sky shader, gated by the existing uNight so they
live wherever the wheel brings darkness). And the missing
cinematography: after the credits land (t>8) the camera's gaze lifts
from the lighthouse to the north sky over six seconds — the island
sinks away and the constellation hangs above the title card. Zero new
draws; shader cost is five dot-products inside the existing night
branch.

**Evidence:** tuning pass photographed — first placement sat in the
southern sky behind the camera (the finale gazes NORTH; fixed), first
magnitudes read as streetlights (pow 5200/700 → 60000/9000; now
star-sized, clearly brighter than the hash stars, unmistakably an arc);
final frame: the five-star arc among the field with the milky way
right and moon left; credits-card composition over the night island;
save verified untouched through all runs (finale mode never autosaves;
`game.onFinale()` bypasses the bell flag — bellRung false, pos intact).
setFinaleT debug knob added. Zero console errors.

**Debt:** "finale could resolve more" — both halves now done (bell
gathers stems, sky spells the arc). Cleared.

**Next tick suggestion:** iteration 20 next-but-one pushes batch 4.
For 19: dawn-mist × songbird interplay check + the 15-noted mild-day
tuning in one weather-polish tick, OR the journal's empty sketch field
(every entry carries `sketch: ""` — tiny line-art sketches per entry
would make J a keepsake; story axis, contained).

---

## 17 — 2026-06-12 — code health (the chest remembers)

**Shipped:** `chestOpen` moved from session-local Game state into
`W.flags` — the looted chest no longer re-seals itself on reload. Done
the save-rule way: flag declared with a false default, written through
the existing `flag()` (which force-saves on set, so the open lid is
durable the moment the hinges move), lid ease reads the flag, and
`load()` carries a one-line migration: a pre-fix save with `rulerTaken`
but no `chestOpen` key infers the lid open — the taken ruler proves it.

**Evidence:** the owner's REAL save was the legacy case (rulerTaken
true, no chestOpen key): after load, `W.flags.chestOpen === true` via
the migration, and the chest renders lid-up at the drained shore
(screenshot — with tick 15's midday mist over the water behind it, a
nice compounding). Forced save shows the flag persisted in the JSON.
Zero console errors. This closes the backlog's last continuity nit.

**Debt:** cleared "chest lid state is session-local".

**Next tick suggestion:** finale's visual half from the backlog — "the
credits sky could spell the constellation/leitmotif." Sketch: during
the credits, five stars among the existing starfield brighten in the
leitmotif's rhythm (E G A D C timing), tracing the same five-dot
pattern the stones carry — sky shader already has stars; a uniform
array of five brightened directions driven by the finale clock. Story
+ sky in one; verify with the finale path (stash/restore the save
around it — endFinale force-saves like endIntro).

---

## 16 — 2026-06-12 — secret (far down, a light is still lit)

**Shipped:** The first secret. At night the model's model — the speck
impostor on the model's chart table — keeps a pinprick of warm light
where the next lighthouse down would stand (~1 mm in world space,
additive, gently pulsing, exactly invisible by day). Walk in close over
the chart table at night and a whisper lands, once per save: "Far down,
a light is still lit." The recursion is inhabited all the way down.
Implementation: one tiny mesh on the nested impostor (`nestedGlint`,
driven in applyAtmosphere — refs can't reach inside modelAnchor by
design, so main.js holds a direct handle), proximity 1.5 m via the
existing `once()`/onceKeys persistence — zero schema change, zero chain
contact, one draw call.

**Evidence:** night lean-in screenshot with the whisper ON SCREEN over
the model; glint opacity 0.70 at night (the 0.55±0.25 pulse), exactly 0
at noon (visual + numeric); onceKeys gained `nestedLight` on approach
and the whisper fired exactly once; threshold corrected mid-tick from
0.75 m (unreachable: eye-to-table-center is ≥1.35 m from any rim — the
camera never lowers when "leaning") to 1.5 m, with the crank (1.73 m)
and valve (2.9 m) stations verified outside it. Owner's save restored
WITHOUT the once-key — their first discovery is still ahead of them.
Trap recorded: window.__ stashes die on reload; the context-held
verbatim stash is the durable one.

**Debt:** secret axis opened; "the model's model is begging" cleared.

**Next tick suggestion:** the chest-lid continuity fix deferred from
last tick (chestOpen → save/load with backward-compatible default), OR
if the owner has played the new batch, fold their feedback first. Also
worthy: dawn-mist × songbird interplay check (15's note).

---

## 15 — 2026-06-12 — weather (mist on its own slow clock)

**Shipped:** The island has weather now. Mist is a pure function of the
clock (`world.mistTargetAt`): a seeded deterministic roll per 3-hour slot
— no save state, scrub the sun and the weather scrubs with it, identical
on every machine. The renderer eases toward the target (τ≈16 s roll-in),
thickening fog (×1 + mist×2.4), dimming the sun (−30 % at full), and a
soft drizzle bed rises on the ambience bus once mist passes 0.45
(muffled indoors). Protections by construction: golden hour ceiling 0.08
(the stone-shadow puzzle keeps its sun — measured max 0.00 across the
window), night ceiling 0.45 (the beam still writes). Zero new draw
calls — the power directive holds.

**Evidence:** full-day weather map probed (misty nights at the ceiling,
clear morning, 0.39 midday mist, clear golden); beach-vantage pair —
crisp tick-13 shot vs milky 0.39 mist vs heavier 0.8 veil, all same
vantage; fog density formula confirmed numerically (0.00873 at 0.8);
drizzle gain measured at exactly (mist−0.45)×0.11 = 0.038; draws 189
unchanged; zero console errors. Debug knobs setMist/getMist added.

**Debt:** weather axis opened, "Weather axis absent" cleared. This
seed's daytime rolls are mild (max 0.39); if a moodier day is wanted,
the roll range is one constant. Dawn mist coexists with the songbird —
intentional; revisit only if the owner finds the bird moment muddied.

**Batch 3 pushed with this entry** — bell signature, power tick, tree
haze + index relabel, the bell's stem-gathering, weather.

**Next tick suggestion:** the chest-lid continuity nit (backlog:
`chestOpen` is session-local — reload after taking the ruler shows a
closed chest). Small, surgical, save-schema touch done the
backward-compatible way (`save()/load()` default). Pair with a look at
the secret axis if appetite: the model's model speck at night.

---

## 14 — 2026-06-12 — audio (the bell gathers its stems)

**Shipped:** The finale's bell now explicitly gathers every stem the
player earned into its final chord: the A2/E3 drones swell against the
toll (2.4× for a long breath, stem gains now kept in `_stemGains`),
stem 3 strikes the actual five-note leitmotif (E G A D C) as a strummed
chord at +0.6 s, stem 4 lands one deep 55 Hz gathered beat, stem 5
crowns it with three high bells at +2.2–2.9 s — each conditional on
`stems.includes(n)`, so partial playthroughs resolve with exactly the
voices they earned. The bell's own vast toll and rising farewell are
unchanged. Wiring untouched: `A.bellToll()` was already the finale call.

**Evidence:** synthesized audio verified WITHOUT ears — an AnalyserNode
tapped on the music bus (pre-master, so the owner's mute doesn't blind
it; the audio clock runs even in hidden tabs). Partial set [1,3,4] from
the owner's real flags: all five leitmotif bins ignite in the chord
window (171–184), A2 drone-swell becomes the strongest bin by mid-decay
(224), RMS arcs 4→18→6, shimmer bins stay quiet (stem 5 absent ✓).
Full set after RAM-only addStem(2,5): RMS peaks 22.4, E3 swell 196, and
the crown bins jump 4→122–127 exactly in their window. Zero console
errors; save untouched this tick (audio-only verification, no movement).

**Debt:** none added. The other finale half ("credits sky could spell
the constellation/leitmotif") remains in backlog.

**Next tick suggestion:** iteration 15 closes batch 3 — PUSH per
MISSION step 3 (submodule then parent; five commits waiting: bell
signature, power tick, tree haze + relabel, this, plus 15's own). For
the work: weather axis is the last untouched one — a slow mist roll-in
on the existing fog density (grade-consistent, power-safe: fog is
already in every shader) with a synth drizzle on the amb bus only while
overcast. Verify fps + the power directive (no new draws), screenshots
across grades, analyser for the rain bed.

---

## 13 — 2026-06-12 — close-look at distance (the tree line melts, not pops)

**Shipped:** Distant canopies no longer cut hard low-poly silhouettes:
a fragment-only patch in the canopy material blends them toward the
grade's haze color (45 % max, smoothstep 120→300 m, `uHaze` follows
`scene.fog.color` per grade) before global fog touches them. Zero new
draws or geometry — the power directive holds (draws/tris byte-identical
at matched vantages). Near trees (<120 m) untouched. Rider: the Pages
root card now says "Play ABYME" / "ABYME Source" instead of the stale
"Vanilla" labels (docs/index.html — the owner noticed).

**Evidence:** noon beach vantage — near trees crisp (inside threshold);
islet→main-island sightline (250 m+) — ridge pines melt into pale haze
at noon and into the rose sunset haze at golden (grade-correct), while
the islet's own pine stays sharp in the same frame; draws 189/200 and
tris 519k unchanged at matched vantages (200 is a pre-existing golden
vantage peak, not from this change). Zero console errors.

**Debt:** none added. Backlog's "trees pop flat" is half-cleared: the
POP is fixed; true LOD/billboards (the "cheaper" half) remain unclaimed
— only worth it if the power directive ever needs vertex savings.

**Next tick suggestion:** iteration 15 next-but-one closes batch 3 —
keep 14 substantive: the finale resolution items (backlog: "the credits
sky could spell the constellation/leitmotif; the bell could audibly
gather all five stems") — the audio half is synth-only work in audio.js
(the bell chord gathering the stems), verifiable by ear-proxy (waveform
peaks/oscillator graph via eval) plus the existing finale path. Story+
audio axes both underfed.

---

## 12 — 2026-06-12 — performance (the power tick — owner directive)

**Shipped:** Three multiplier cuts, look held: (1) **60 fps frame
governor** — setAnimationLoop skips vsync ticks under 15.5 ms (halves
everything on 120 Hz ProMotion displays, no-op at 60 Hz; timestamp belt
`tMs ?? performance.now()`); (2) **adaptive resolution** — full
DPR 1.75 while the hand is on the world (keys/drag/cinematics), easing
to 1.3 after 1.2 s of stillness: 55 % of the pixels for the posture a
Myst-like spends most of its time in (the dive's DPR-drop precedent,
generalized; dive transitions keep `dprNow` truthful); (3) **shadow map
2048→1024**, PCFSoft kept.

**Evidence:** rest 1.3 organically engaged at boot (probe), snapped to
1.75 on a real held W (probe + walking capture), rest/active stills at
the golden stones are visually indistinguishable; long stone shadows
clean at 1024 (golden) and interiors clean (study noon); zero console
errors. Honest limits recorded: my preview tab runs ~60 Hz so the
governor's 120→60 halving is proven by arithmetic, not measurement —
the owner's fans are the real instrument; the rest-return transition
was verified at boot rather than post-keyup (capture windows advance
only ~0.2 s each — the gull lesson applies to every ease).

**Debt:** standing OWNER DIRECTIVE noted in backlog stays open as
policy: future graphics ticks ride inside freed budget. Candidate next
lever if fans persist: water fbm2 octaves at rest, or REST_DPR 1.15.

**Next tick suggestion:** the index card on the Pages root labels the
ABYME build "Vanilla" (owner noticed) — tiny copy fix in
docs/index.html (outside the-island/, same repo) plus consider a
"What's new" line. Pair it with the trees-pop-flat LOD softening if
there's appetite for a second slice — or keep the tick small ahead of
the batch-3 push at iteration 15.

---

## 11 — 2026-06-12 — story/worldbuilding (the same hand built the way out)

**Shipped:** The cartographer's throughline closes: the maker's pair from
the chart table's south-east corner appears once more, small and worn,
on the annex floor beside the bell stand — the object that ends the game.
Same glyphs (triangle + ringed dot), same burnish, lower opacity (0.5 —
floor wear, not fresh etching). A player who leaned over the model and
noticed the signature finds it again at the journey's end: the same hand
made everything, including the way out. No words, no state, two sprites.

**Evidence:** noon close-look in the annex — bell above, signature below,
sitting in the doorway's light patch; reads subtle but unmistakable at
lean-in. Zero console errors; marks are not raycast targets (bell hotspot
untouched). Owner save re-seeded this tick: the preview tab arrived with
a FRESH browser profile (no Continue button — first time the tool has
done this) — restored verbatim from the tick-7 stash plus abyme-muted,
verified level-2 Continue works. The stash-in-context practice earns
its keep again.

**Debt:** none added.

**Next tick suggestion:** trees pop flat at distance (backlog) — distant
canopies could be cheaper AND prettier. Sketch: a billboard ring at the
far LOD (impostor quad per tree past ~120 m, swapping by camera distance
in the canopy shader via the same derivative/scale trick family), or
simply fade distant canopy color toward the terrain palette to soften
the pop. Perf axis not yet visited by the loop; budget headroom exists
(draws ≤166, tris ≤519k) but the win is visual softness at the horizon.

---

## 10 — 2026-06-12 — graphics wow (the model sea learns its scale)

**Shipped:** The chart-table sea no longer reads as chalk. The water
shader now senses its instance scale per-pixel — the ratio of world-space
to object-space screen derivatives (`fwidth(vWorld)/fwidth(vLocal)`),
~1.0 on the real sea, ~1/240 on the model — and at miniature scale damps
the sun/moon glitter to a sheen (×0.16) and gentles the ripple normals
(×0.55). One shared material, as the hard rule demands: no clone, and
the discriminator is view-independent so the world ocean's grazing-angle
glitter path keeps full sparkle at every distance. WebGL1 fallback
covered (`extensions.derivatives`).

**Evidence:** noon over the table — the model sea is a calm blue-green
BODY with readable shallows around both islands (vs the white speckle
storm in tick 5's screenshots of the same vantage); golden-hour beach
horizon — world ocean sheen rich and unchanged out to the horizon
(the regression risk: an fwidth-only fade would have gutted exactly
this, which is why the ratio discriminator, not raw fwidth). Zero
console errors, draws/tris unchanged. Owner save restored, muted.

**Debt:** cleared "model sea reads chalky up close".

**Batch 2 pushed** (this entry rides in it): stone glyphs inboard,
intro flight, M sound toggle, the dawn gull, the model sea — five
iterations, submodule then parent, per the every-5 cadence.

**Next tick suggestion:** story axis again — the cartographer needs a
THROUGHLINE, not just marks: candidate is "the same hand" motif
completing in the annex (the coat, the bell): a final marginalia mark
ON the bell stand matching the maker's pair, or footprint wear at the
chart table's south margin (where someone stood for years). Quiet,
two-object echo, closes the loop the marginalia opened. Alternative:
trees pop flat at distance (LOD billboards) if feeling technical.

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

- ~~Sky dome ignores mist~~ — iteration 23: uMist fret band, night-dimmed,
  driven from the same eased scalar as fog/sun/drizzle.

- **OWNER DIRECTIVE (2026-06-12): power efficiency** — "improve the
  graphics while reducing the power load; this game causes my fans to
  kick in." Standing policy, not one tick: every graphics tick should
  leave power flat or lower. Known multipliers: uncapped rAF (120 Hz on
  ProMotion = 2× everything), DPR 1.75 + MSAA (~3× pixels), 2048² PCFSoft
  shadows every frame. Levers: 60 fps frame governor, adaptive DPR
  (full while moving, ~1.3 at rest — the dive already drops DPR, pattern
  exists at main.js setPixelRatio calls), shadow map 1024/PCF, water
  fragment cost. Claimed first by iteration 12.

- ~~Audio mute UX~~ — done in iteration 8: `M` toggles via `A.setMuted()`,
  whisper feedback, hint line updated.

- **Grass inside structures** — blades spawn inside the lighthouse study and
  annex (scatter lacks exclusion radii that the tree scatter has). The
  owner's literal example of the jank class.
- ~~Drained-seabed softlock~~ — fixed in iteration 3 (rim clamp at −2.2 +
  Continue-time rescue).
- ~~Model sea reads chalky up close~~ — iteration 10: per-pixel instance
  scale from the world/object derivative ratio; glitter ×0.16 and ripple
  ×0.55 at 1:240, shared material intact, world ocean untouched.
- ~~Chest lid state is session-local~~ — iteration 17: persisted via
  W.flags + load-time migration (rulerTaken implies the lid).
- ~~Beam reads as two streaks~~ — iteration 20: view-facing fade + hot
  inner shell; the shaft and cellar spill inherit the fix.
- ~~Cellar is flat~~ — fixed in iteration 4 (fill light, carve halo, light
  shaft, motes).
- ~~Stone glyphs barely visible~~ — fixed in iteration 6: they were facing
  the open sea; flipped inboard, brightened, halo'd, tone-pulsed.
- **Trees pop flat at distance** — no LOD/imposters; distant canopies could
  be cheaper AND prettier (billboard ring?).
- ~~Gulls are two quads / never land~~ — iteration 9 (the dawn perch) +
  iteration 22 (bodies, and the sideways-flight quirk the bodies exposed).
- **Intro dolly underuses the sea** — the approach should skim wave-top
  with spray before rising to the beach; title timing could breathe more.
- **Story axis is thin** — who was the cartographer? The coat, the
  footprints, the warm window are beats without a throughline. Journal
  pages / etched marginalia on the chart table / a name somewhere.
- ~~Secret axis unexplored~~ — iteration 16: the nested speck keeps a
  night pinprick lit; leaning in earns a once-per-save whisper.
- ~~Finale could resolve more~~ — iteration 14 (the bell gathers its
  stems) + iteration 18 (the credits sky spells the arc, gaze lift).
- ~~Weather axis absent~~ — iteration 15: deterministic per-slot mist on
  the clock, fog/sun/drizzle integration, golden+night ceilings, zero new
  draws.
