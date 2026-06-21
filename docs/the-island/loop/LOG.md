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

## 91 — 2026-06-20 — the descent gets a SOUND: five era music stems, crossfaded by depth

**Shipped (local):** the color-psychology arc is now HEARD. Five looping ambient stems (ACE-Step,
from the E-G-A-D-C pentatonic family, generated on Bender) crossfade by `W.level`: warm-gold surface
→ sodium-green L2 → jaundice L3 → isolation-blue L4 → dead-violet L5.
- `A.musicTo(level)` in `audio.js`: a dedicated `musicBed` gain; loads the stem lazily, crossfades
  over ~3.5 s, evicts non-adjacent stems (the bounded cache from #88 — only current + adjacent
  decoded, ~4 MB resident). Called every play frame (early-returns unless the level moved).
  `musicStop()` on the bell finale + the oar (they own the soundscape). Offline → silent (the
  procedural score carries it).
- Mono mp3, ~145 KB each / 720 KB total, in `assets/music/`.

**Evidence (`?debug`):** boots clean, no console errors; the surface stem starts at L1 in play
(`_music` set), descending to L3 crossfades to the L3 stem (`_musicLevel`→3); `music_l1` decodes
(12 s mono). Audio is GPU-free. The MIX level is an owner-listen (a subtle bed under the procedural
score; tune the `musicBed` gain).

**Next:** final verification (textures + music + voice together) + push so the owner wakes to it live.

---

## 90 — 2026-06-20 — FULLY TEXTURED: granite on the stone + vellum on the chart table

**Shipped (local):** the owner granted full creative autonomy on music/voice/textures ("I'd like to
wake up to a fully textured game with music and voice"), so the last two textures land — completing
the hero surfaces. [[feedback-abyme-overnight-autonomy]]
- **STONE** (`study_stone.jpg` granite) on the shared `matStone` — the lighthouse, study walls, floor,
  and the standing stones. Applied to the vertex-colored `matStone` so the granite MULTIPLIES the
  bone/grey (a subtle textured stone, not flat cream) and the painted copper band stays coppery — NO
  de-merge needed. Achromatic, so the grades still color it.
- **VELLUM** (`chart_vellum.jpg`) — a thin sheet on the chart table, framing the 1:240 model: the
  island's own model standing on a cartographer's chart of itself. Sits below the model's sea, so it
  shows as the cream border around it (verified top-down — a fold crease reads).
- The texture family is COMPLETE: driftwood (jetty/dory), wood (interior props), cloth (coat), stone
  (lighthouse/study/stones), vellum (chart table). The terrain + water stay procedural shaders.

**Evidence (`?debug`):** boots clean, no console errors; both maps confirmed; renders correctly (the
granite reads on the tower close-up; the vellum frames the model from above). Power held: bench 222
draws / 521k tris / 6.1 ms. The granite is deliberately SUBTLE (clean-but-textured) — owner can ask
for stronger blocks (bump the `stone` repeat).

**Next:** the 5 era music stems are generating on Bender — wire them (crossfade by W.level), then
round out the voice.

---

## 89 — 2026-06-20 — texture pass: interior wood + the keeper's coat (+ driftwood slimmed)

**Shipped (local):** the owner liked the driftwood, so the hero-surface family expands — two clean
applications + a memory-minded re-export, all Bender FLUX.1-schnell, JPG-compressed.
- **Interior WOOD** (`wood.jpg`, 70 KB): worn pine grain on the shared `matWood` — every wooden prop
  (doors, the music box, the tables, the plate ring). `matWood` lightened (`0x5e4127`→`0x8f7a5c`) so
  the pale grain multiplies to a mid weathered wood. 98 meshes now carry a map.
- **The keeper's COAT** (`cloth.jpg`, 166 KB): the coat's own material extracted + given a coarse
  burlap weave (it clones to the model too) — the coat-reveal prop has texture now.
- **Driftwood SLIMMED:** re-exported the oversized `driftwood.png` (1.05 MB) → `driftwood.jpg`
  (58 KB, ~18× smaller — the memory pass made literal) and removed the PNG.
- All processed `sips -Z 512 -s format jpeg` (≤512², JPG) per ASSETS.md.

**Evidence (`?debug`):** boots clean, no console errors; all 3 textures load (512², jpg); 98 meshes
textured; coat + dory maps confirmed; renders correctly (surface + study screenshots). Power: bench
72 draws / 288k tris / 8.5 ms, 300+ fps — maps add NO geometry. Heap 18.2 MB (down, from the
optimization + slimmer textures).

**Deferred (the de-merge tick):** `chart_vellum` + `study_stone` are generated + parked — both targets
(the chart-table top, the lighthouse/study stone) are baked into the merged `matStone` Baker with a
painted copper band, so they need a careful tower/sheet de-merge (ASSETS.md flagged it; roadmap #7).
Not rushed onto a shared vertex-colored material.

**Next tick (90, PUSH boundary):** the stone de-merge (vellum + stone) OR item 5 (era music stems);
push the 86–90 batch.

---

## 88 — 2026-06-20 — optimization pass: memory + GC + dead code (from the audit)

**Shipped (local):** the safe, high-value wins from the 4-lens memory/code audit. (The owner asked
for a memory + code optimization pass; analytics via `performance.memory` + `renderer.info` confirmed
the targets.)
- **Voice cache eviction (rank 1, the headline memory win):** `assets.js` `_bufCache` pinned ~3 MB of
  decoded voice PCM forever (heap 28.5 → 38.9 MB once the 6 clips load). Added `evictAudio(id)` +
  `keepOnlyAudio(ids)`; `audio.js` `say()` now drops each clip on `src.onended` (voice is one-shot +
  depth-gated; a rare replay just re-decodes). The Promise-dedupe structure stays (the iter-82 race
  fix). `keepOnlyAudio` is ready so the 5 era music stems are born bounded (current + adjacent level).
- **player.update GC (rank 5, the per-frame hot path):** the `new THREE.Vector2()` every frame → a
  module `_wish` scratch; the `step` closure (rebuilt every frame) → a `_step()` method (verbatim
  body). Eliminates the only steady-play heap churn. Behavior-IDENTICAL.
- **Dead code (rank 2):** removed `terrain.walkable` (+ unused `vary` import), `Player.altitude()`
  (main.js uses `player.pos.y` directly) and the never-read `blockedByWater` per-frame write,
  `util.easeOut`. Kept `assets.ledger()` (intentional provenance API).

**Evidence (`?debug`):** boots clean, zero console errors. Movement behavior-identical — walked 2.9 m
NW through the full `update()` path, `_step` blocks the open sea + passes a tiny on-land step. Audio
cache verified: cache hit → same Promise; post-`evictAudio` → new Promise; `keepOnlyAudio` evicts the
non-kept clip. No geometry touched, so power is unchanged.

**Deferred (consciously):** rank 3/4 (model-clone prune / distance-LOD, −121k…−260k tris) — the model
water is load-bearing (shows the tide when you lean over) and `youMarker`/`nestedGlint` are model-side,
so the LOD needs `youMarker` re-parenting + careful testing; draws/tris have headroom (251/360,
521k/800k) so it's not urgent. Rank 5's heightAt-memoization (CPU, ~half the heaviest per-frame call)
and rank 6 (cinematic alloc scratch) — next, with movement re-verified. (Audit watch-outs noted: the
clone SHARES geometry/materials, the 31 programs are genuine — do NOT "dedupe" them.)

**Next tick (89):** apply the 4 hero textures (process to compressed JPG + wire to the study floor /
chart sheet / coat / stone) + the cloth regen.

---

## 87 — 2026-06-20 — the twist HOLDS: 4 adversarial-review must-fixes (the integration lock + canon)

**Shipped (local):** the adversarial review of #86 (4 lenses) found the twist's integration lock and
canon-safety did NOT hold as built. All four must-fixes landed, plus the key should-fixes:
1. **UNMISSABLE** — a player could reach the bottom, ring the bell, and skip the whole beat
   (violating SPINE lock #3 by name). The deep bell now REFUSES at MAX_DEPTH until keeperRose
   ("Not yet. Something at the chart table has lifted its head…") — the revelation can't be bypassed.
2. **CANON INVERSION** — the carried ascent reused the "he stays below / don't leave the light on for
   me / I left his still burning below" farewell + journals, telling the player the OPPOSITE of what
   they did. `landAscent` / the surface return / the arrival now BRANCH on `W.flags.carried`: carried
   reads as rising WITH him ("I did not leave him… two lights, both climbing"; "his voice is beside
   you now, not below"). The old text remains only for a non-carried climb-out.
3. **SINGLE-TAP EMBRACE** — a stale shared `_brink` could collapse the integration two-touch into one
   tap with the embrace line never shown. The embrace got its OWN `_embraceBrink` + step-off release
   (mirroring the oar): the turn-and-rise is always a fresh, deliberate two-touch.
4. **RELOAD STRANDED IT** — keeperRose was set by a non-saving assignment AFTER its once-key
   persisted, so a mid-beat reload killed the twist forever. keeperRose is now `flag()`'d IMMEDIATELY,
   atomic with the once-key + self-healing.
- Plus: the player is HELD for the ~5 s revelation (the eye-level line never plays to an empty room);
  the rise relaxes once you've CARRIED him out (no mute re-raise on re-descent) and the moment you
  ring the bell instead (you turned away from him).

**Evidence (`?debug`):** boots clean, no console errors. Verified each: deep bell with keeperRose
false → no finale (gate held); keeperRose true within a few frames of `ABYME.bottom()`, player held
then released; with a STALE `_brink=true` the first embrace touch does NOT commit (carried false,
`_embraceBrink` true), the second does (carried + climbing + ascent); carried ascent journals "I did
not leave him…" vs the plain climb-out "I went all the way down…". Power unchanged.

**Review verdict:** "land the four must-fixes and the emotional centre will hold" — done. Deferred
should-fix: differentiate the embrace INPUT further (face-the-figure) — the embrace line is now
mandatory (narrating the verb at commit); revisit with owner feel.

**Next tick (88):** OWNER FEEL on the twist (`ABYME.bottom()` on the local server), then item 5 —
the five era ambient music stems.

---

## 86 — 2026-06-20 — THE TWIST lands: the keeper rises, and you choose to carry him up (item 4, core)

**Shipped (the bottom beat — LOCAL, not deployed):** the emotional centre of the pivot —
"THE ONE THE LIGHT WAS LIT FOR." At the bottom (MAX_DEPTH), leaning over the model no longer just
makes the keeper look back — it ESCALATES into the twist:
- **BODY BEFORE LINE:** the weary recognition (`keeper_look_4`, "You're faster than I was") → a beat
  later the figure RISES and looms toward your eye (`W.flags.keeperRose`; eased `_keeperRise` lifts +
  scales the `tinyFigure` ×2.6, brow fully up, glow swelling) with a rising-pitch cue (`A.keeperRise`,
  inverting the dive's drop) → then, at **EYE-LEVEL** (`A.say(…, eyeLevel)` thins the drowned lowpass
  so he's close, not below), the line confirms: *"There you are. I've been coming down for you."*
- **THE ACTIVE EMBRACE (the integration lock):** once he's risen, the bottom plate-touch becomes the
  embrace — a deliberate two-touch (like the dive/oar): *"Stand, and rise — and take him with you."*
  On commit it sets `W.flags.carried` + a self-hand journal ("one lamp, lit at both ends of the
  staircase") and runs the existing ascent — you rise CARRYING him. The rising is the PLAYER's act,
  never a cutscene — the only thing separating integration from being rescued.
- Reuses the proven plate two-touch + the ascent cinematic (no new raycast / terminal); the bell
  (descent terminal) and the L3 look are untouched. New audio: `A.say` eyeLevel mode + `A.keeperRise`.

**Evidence (`?debug`, new `ABYME.bottom()`/`getTwist()`):** boots clean, zero console errors. Drove
to the bottom — the revelation fires once: keeperRose true, `_keeperRise` eases to 1 (figure scale
2.6, lifted +1.8, brow x −1.1), "There you are" at eye-level. The embrace: first plate-touch → brink
+ the embrace whisper; second → carried + climbing + the ascent starts. Power Ledger (bench, noon):
**219 draws / 521k tris / 5.3 ms — UNCHANGED** (transform-only on an existing figure; audio GPU-free).

**Debt / next:** (1) an adversarial review is running (integration lock, canon, regressions,
narrative). (2) NARRATIVE RECONCILIATION — the existing ascent farewell ("don't leave the light on
for me") was written for "he stays below"; with `carried` it should read as rising WITH you.
(3) make the revelation more unmissable. (4) OWNER FEEL: the rise/timing want a watch + listen
(local server, `ABYME.bottom()`).

**Next tick (87):** address the adversarial review's must-fixes + the narrative reconciliation.

---

## 85 — 2026-06-20 — the keeper SPEAKS: real bm_george voice through the drowned bus (item 3) [PUSH: 82–85]

**Shipped:** first-wave item 3 — the keeper's synth murmur becomes a real human voice. Six
**bm_george** lines (Kokoro-82M, generated on Bender, Apache-2.0) for the lines centralised in
`content.js` KEEPER: the two depth-arrivals, the two figure-looks-back lines, the ascent farewell,
plus the twist's eye-level "There you are. I've been coming down for you." (staged for item 4).
- **`A.say(id, register)`** in `audio.js` plays the decoded clip through the SAME drowned bus as
  `keeperVoice()` (lowpass 1500 + 0.19 s feedback echo) so recorded speech still sounds heard
  through a floor of water — *overheard, not addressed*. If a clip can't load it falls back to the
  FM-synth murmur, so the keeper always speaks.
- The call sites (`main.js` arrival + farewell, `puzzles.js` look) now call `A.say` with the
  matching voice id; the whisper TEXT still pairs every line (accessibility).
- Assets: 6 WAVs transcoded to mono 24 kHz mp3 (`ffmpeg`) → `assets/voice/` (~148 KB total, ~6×
  smaller than WAV; WKWebView-safe). Six `MANIFEST` rows carry license + provenance.
- First audio asset → the "made of math" claim retired honestly: the title-foot now reads "a world
  made of code, and a voice at the bottom that isn't" — the keeper, the one real thing down there.

**Evidence (`?debug`):** boots clean, zero console errors; all 6 voice rows in the manifest;
`keeper_there_you_are` + `keeper_farewell` fetch + decode (3.25 s / 4.0 s, mono); `A.say()`'s
drowned-bus node graph builds without error (mirrors the shipped `keeperVoice` bus). Power: audio
is GPU-free; resident audio ~148 KB, lazy-loaded only when the keeper first speaks at depth.
**NOT yet verified by EAR** — the "overheard, not addressed" timbre is an owner listen (dive to L3+).

**Dispatch gotcha (logged to ASSETS.md + memory):** `asset_voice_generate` defaults to the LOCAL
backend (no ML venv → instant fail); pass `node:"tree"` to route to Bender.

**Pushed:** the 82–85 batch (driftwood factory, content layer, the voice) — submodule then parent.

**Next tick (86):** item 4 — the twist's structural core: the figure turns and walks UP at the
mandatory bottom beat, the bell-pitch inverts to rise, the eye-level "There you are" plays (the
voice is ready), and the embrace is a PLAYER ACTION (turn-and-rise), never a cutscene.

---

## 84 — 2026-06-20 — content layer (item 2): the keeper's lines + journal sketches move to js/content.js

**Shipped:** first-wave item 2, the content layer's first slice. New `js/content.js` holds the
narrative DATA that the voice (item 3) and the twist (item 4) will edit: the **KEEPER** spoken lines
— `look` (the figure-looks-back lines, by level), `arrive` (depth-arrival), `farewell` (the ascent
goodbye) — plus the journal **SKETCHES** atlas. `puzzles.js` (`KEEPER_LINES` const → `KEEPER.look`),
`main.js` (the two inline arrival/farewell whisper strings → `KEEPER.arrive`/`KEEPER.farewell`), and
`ui.js` (local `SKETCHES`/`S` → imported) now read from it. Behavior-IDENTICAL — a pure relocation,
so the keeper's voice and the twist's re-subtexting become CONTENT edits, not engine surgery.

**Evidence (`?debug`):** boots clean, zero console errors; `content.js` imports resolve in all three
consumers; every `KEEPER` value + all **23 SKETCHES** verified byte-identical to the originals;
END-TO-END render check — `renderJournal()` pulls the valve sketch from `content.js` SKETCHES (the
valve-specific SVG path renders for a matching entry), so the journal's pictures still draw through
the import. No grep stragglers. Power-neutral (data relocation, no geometry).

**Debt:** the diegetic whisper / journal-PAGE catalogue is still inline at its call sites in
`puzzles.js`/`main.js` (coupled to puzzle logic) — that's the next content slice (item 2b), and it
does not block the voice.

**Next tick (85, a PUSH boundary):** item 3 — the keeper's real **bm_george** voice through the
drowned bus (`audio.js`), routed at the KEEPER triggers now centralised here, plus the twist's
eye-level new line ("There you are. I've been coming down for you."). First audio asset → reframe
the `index.html` "made of math" line. Push the 82–85 batch.

---

## 83 — 2026-06-20 — THE PIVOT: pure-math era closed; the asset factory; the twist chosen

**Shipped (a hinge iteration, owner-directed):**
- **The pivot.** Owner: "tag a commit and pivot away from [pure math]. I want a rich vibrant
  world, deep story, and a lot of content." The all-code-generated era is preserved as the
  annotated tag **`abyme-pure-math-v1`** (submodule `72c8fdf`, iter 81) — pushed. Assets are now
  FIRST-CLASS, not a restrained exception.
- **Two design panels** (the SPINE-building pattern). A 6-agent **roadmap panel** set the north
  star ("a place with a mouth and a memory"), 5 pillars, and a sequenced first wave — and caught
  our own wrong assumptions (the keeper is ALREADY a real abstract mesh; the gap is the VOICE, not
  the body — a hero keeper mesh was CUT). A 13-agent **twist panel** (6 divergent turns → adversarial
  critique → showrunner) produced the player-identity twist.
- **The twist — CHOSEN by the owner: "THE ONE THE LIGHT WAS LIT FOR."** You are not the searcher —
  you are the bottom, the lost self the keeper has been descending toward. At the mandatory bottom
  beat the figure turns and walks UP, the bell-pitch inverts to rise, the voice migrates to
  eye-level: "There you are. I've been coming down for you." Integration's non-negotiable lock: the
  embrace is a player ACTION (turn-and-rise), never a cutscene. Kills the telegraphed
  coat-as-successor reveal. Locked into `loop/SPINE.md` ("THE PLAYER & THE TWIST"). Tone fork also
  settled: cozy-that-wounds.
- **First-wave item 1 — the asset factory.** New `js/assets.js`: a single MANIFEST (id, file, bytes,
  license, source, prompt, sampler settings) + a lazy, cached loader (`getTexture`/`applyTexture`
  for textures; `loadAudioBuffer` ready for the voice/music items) + a provenance `ledger()`. New
  `ASSETS.md` style guide: the abstract-poem prompt preamble, the five era palette anchors, a
  per-class power/memory budget, the per-asset acceptance test, the Bender peer-trust gotcha.
  Migrated the iter-82 inline `TextureLoader` (props.js) to `applyTexture(weather, 'driftwood')` —
  the first manifest row. Look-before-volume: the factory exists before any texture batch.

**Evidence (`?debug`):** app boots clean (ABYME object, title, no console errors). Driftwood loads
through the manifest and reaches the dory **hull + oar** (map present, 1024px image loaded) and the
1:240 model clone — 76 meshes share the one loaded texture. Power-neutral: a loader refactor adds no
geometry and no draws.

**Debt:** `driftwood.png` is 1.05 MB (oversized) — re-export ≤256 KB in the first texture batch
(logged in ASSETS.md). The keeper-mesh and walkable Drowned-Gallery proposals are consciously
parked (post-voice, behind a Power Ledger).

**Next tick (84):** first-wave item 2 — extract `js/content.js` (journal / whispers / keeper lines
become data), behavior-identical, so the voice (item 3) and the twist's re-subtexting become content
edits, not engine edits.

---

## 82 — 2026-06-20 — assets: the first Bender texture ships — driftwood on the jetty + dory (+ lazy glint-clone engine fix)

**Shipped:** the first non-generated asset — a Bender tileable driftwood texture
(FLUX.1-schnell, Apache-2.0) on the jetty and dory (the game's only wood props, their
dedicated `weather` material). The flat brown wood now reads as weathered grey-brown planks
with grain; the 1:240 model clone shares the material (grain invisible at that scale).
- ENGINE fix (root cause, not a patch): the interact hover-glint cloned each hotspot's
  material EAGERLY at `add()`, racing ahead of the async texture load — the dory hull/oar
  (interact targets) were cloned BEFORE the map loaded and showed untextured, while the jetty
  (no hotspot) textured fine. Moved the glint-clone to be LAZY (first hover, after assets
  load); also skips cloning for never-hovered hotspots. Fixes the async-asset-vs-clone race
  for ALL future textured interactables. [[feedback-root-cause-over-workaround]]
- The "made of math" claim is reframed (index.html title-foot + meta): "almost everything …
  is made of math" / "nearly every mesh, texture and sound is synthesized in code" — the first
  non-code asset has shipped.

**Evidence (`?debug`):** the island dory hull + oar carry the map (untextured pre-fix);
hover-glint verified — the oar glints amber on hover (intensity 1→1.6), the map SURVIVES the
lazy clone and restores clean. Power Ledger (bench, noon + night): 237 draws / 521k tris /
~6.6 ms gpu — UNCHANGED from baseline (the texture adds no geometry, only a fragment fetch).
Zero console errors. Asset: `docs/the-island/assets/driftwood.png`.

**Debt:** the lighthouse-plaster texture is NOT shipped — the tower is baked into the shared
`matStone` merge (with a painted band in its vertex colours), so it would need a de-merge;
deferred for the owner's call (the tower's clean painted look may not want generic plaster).

**Next tick (83):** owner-gated — the keeper VOICE (bm_george starting point) + a voice-routing
layer; OR the plaster-on-tower de-merge if wanted.

---

## 81 — 2026-06-20 — ENGINE fix: the slope gate misread local terrain bumps as walls (root cause; replaces #80's causeway workaround)

**Shipped:** the real root cause behind #80's "invisible wall." The walkability slope gate
computed `(rise)/(per-frame stride)` — dividing the rise by the tiny per-frame step distance,
so ANY small local terrain hummock read as a near-vertical wall (a 0.6 m bump crossed in a
0.06 m step = slope ~10) and could pin the player anywhere on noisy ground, not just that
causeway. Fixed at the engine: the gate now measures the terrain gradient over a FIXED 0.7 m
look-ahead — longer than a noise hummock, shorter than a real wall — so it ignores sub-step
noise but still blocks sustained cliffs; the absolute per-step rise stays capped by the
existing 1.05 m step-up gate. REVERTED #80's workarounds (the reshaped causeway terrain + the
rim-clamp corridor exemption) — the engine fix makes the ORIGINAL causeway traversable.
(Owner principle: fix the root cause in the engine, not surgical symptom patches —
[[feedback-root-cause-over-workaround]].)

**Evidence (`?debug`):** drove `player.update` across the ORIGINAL (reverted) causeway when
drained → reaches the islet (was stuck at (98,-116)); bridge→plateau still works; walking into
the sea (0.9 m), into the chasm without the bridge (pinned at the rim), still blocked; normal
walking free (~24 m/6 s) in every open direction. Zero console errors.

**Debt:** none — removed two workarounds, replaced with one engine fix.

**Next tick (82):** owner-gated Bender voice integration, or hold per Panel #5.

---

## 80 — 2026-06-20 — bug fix: drained causeway stranded the player short of the islet + debug panel to top-left (owner-reported)

**Shipped:** two owner-reported fixes.
(1) THE INVISIBLE WALL — when the bay is drained, walking the causeway toward the stones islet
stranded the player partway across. Root cause: the old causeway was a NARROW, LOW ridge
(crest -1.6, falloff `(d/10)²·6`) sitting BELOW the noisy seabed off-centre, so the bumpy
natural floor poked through it — leaving micro-pits (found one at y -1.97 ringed by terrain
0.65 m higher just 0.06 m away) that the per-frame slope gate read as inescapable walls (slope
~10). Rebuilt the causeway as a generous SMOOTH land bridge ALL THE WAY to the islet (crest
-1.05, wider/gentler `(d/15)²·5`, segment extended causewayA→stones) so the ridge dominates the
seabed noise across a forgiving corridor; also exempted that corridor from the below-tide rim
clamp (belt-and-suspenders). Stays ~0.8–1 m under the high-tide surface (hidden until drained).
(2) Moved the `?debug` panel from bottom-left to TOP-left.

**Evidence (`?debug`):** drove the player (stepping `player.update`) from causewayA toward the
islet when drained — previously STUCK at (98,-116,-1.97); now reaches it (minDist 11, no stuck).
High-tide vantage: causeway submerged (a faint underwater ridge, not breaking the surface).
Drained vantage: a clean wide land bridge to the islet. Zero console errors. 60fps / 50 draws.

**Debt:** none. Terrain change localized to the causeway segment; the chasm bridge (far at z=25)
is unaffected.

**Next tick (81):** owner-gated Bender voice integration (the keeper, voice-per-character), or
hold per Panel #5.

---

## 79 — 2026-06-20 — jank fix: intro fly-over clipped through the drowned colonnade (owner-reported)

**Shipped:** the opening fly-over skimmed straight through the sunken colonnade ("the docks")
off the wake-up beach right before landing — the descent crossed the colonnade's z-band
(z≈-108..-119) at y≈1.8-2.0, grazing its caps/lintels (top ~1.86) and threading the x=8 column
row. Now a smooth parabolic LIFT in `tickIntro` raises the camera over the drowned hall (to
y≈2.9-3.8, clearing the lintels by ≥1 m) and tapers to exactly 0 at the landing (z=-104) and
seaward of it (z=-123), so the seamless handover to gameplay is untouched — it reads as a
gentle rise over the breaking columns, not a clip-through.

**Evidence (`?debug`):** reproduced the live `INTRO_PATH × easeInOut × lift` across the
colonnade band — base y 1.77–2.07 (clipping the 1.86 lintels) → lifted 2.85–3.83, clears at
every sample; lift = 0 at the landing (camera settles to (4,1.71,-104), clean handoff). Zero
console errors. (Mid-flight can't be watched headless — a screenshot fires an rAF burst that
completes the intro — so the *feel* of the rise wants a live playthrough confirm.)

**Debt:** none. Pure camera-path tweak; no curve restructure, no geometry/feature change.

**Next tick (80):** PUSH BOUNDARY. Still owner-gated on the Bender voice/texture integration
(highest wow); otherwise hold per Panel #5.

---

## 78 — 2026-06-20 — accessibility: keyboard + hint parity for the reduced-motion toggle

**Shipped:** the reduced-motion comfort toggle (iter 73) was the only one of the three
top-right toggles with NO keyboard shortcut and no mention in the control hint — sound has
M, journal has J, motion was tab-only and the least discoverable (ironic for the
accessibility affordance). Added the **C** key (comfort/motion) for parity, added "· C
motion" to the control hint, and the tab tooltip now shows "(C)" like sound's "(M)". The
accessibility feature is now as findable as the others.

**Evidence (`?debug`):** dispatched a real `KeyC` keydown in play → `W.reduceMotion` toggled
false→true→false; hint reads "…M sound · C motion"; motion-tab tooltip "Motion: full (C)";
the setting persists to localStorage. Zero console errors. Pure text + one keydown case, no
logic change, fork-neutral, non-graphics, +0 runtime.

**Debt:** none.

**Next tick (79):** Panel #5 flagged the fork-neutral well is nearly dry — favor the
owner-gated Bender voice/texture integration (highest wow) once steered, or hold cadence
rather than manufacture risky polish. Boundary push at iter 80.

---

## 77 — 2026-06-20 — story: act-two grief-rhyme promoted out of the journal (Panel #4)

**Shipped:** Panel #4 flagged that act two's puzzle beats don't pull their weight — the
keeper's grief-rhyme sits in the OPTIONAL journal while the in-the-moment whisper stays
mechanical, so most players never feel it. Promoted two beats: the RULER (measuring as a
thing to do with grieving hands) and the BIRD (a correction that came a lifetime too late)
now each fire a distilled grief whisper right after the mechanical one — "You do not need a
ruler for a distance you already know by heart." / "Some corrections only ever arrive too
late." The rhyme lands unmissably now, not buried behind a journal open.

**Evidence (`?debug`):** drove the real 'crack' hotspot handler in play (rulerTaken armed →
onClick → rulerPlaced); the #whisper element advanced to the new grief line. The bird edit
is structurally identical (a second `UI.whisper` after the existing one). Zero console
errors. Pure text (two whisper lines), no logic change, fork-neutral, non-graphics, +0
runtime; the journal keeps its fuller reflection.

**Debt:** none. Act-two rhyme now spans valve/plumb/lens/shadows (prior) + ruler/bird.

**Next tick (78):** still fork-neutral until the owner steers the Bender voice/texture
integration (gated on their timbre pick + green-light) — a replay/new-game+ hook, the
"house rearranges on 2nd entry" onceKeys beat, or an onboarding pass. Graphics eligible
again (75 story, 76 jank-fix, 77 story).

---

## 76 — 2026-06-20 — jank fix: the night stars were a grid (owner-reported)

**Shipped:** the night sky's stars rendered as a regular lattice. `step(0.9985,
hash21(floor(sp*280)))` lit an ENTIRE projection cell whenever its hash passed, so each
"star" was a cell-aligned square and the whole field read as a grid (the owner caught it).
Now each star is a small ROUND point, jittered inside its cell (kept to 0.25–0.75 so it
never clips the cell edge) with a soft `smoothstep` falloff — the field scatters naturally.

**Evidence (`?debug`):** night sky at 23h and 1h — stars now read as scattered round
points, no lattice; the milky-way wisps and the credits-constellation path are untouched.
Sky shader recompiles clean (zero console errors). Fragment-only, power-neutral (same
per-fragment cost class); `fbm2` (shared by sky AND water) left alone.

**Debt:** none.

**Next tick (77):** keep polishing — an audio-audition pass, or owner playtest notes on the
new Oar ending.

---

## 75 — 2026-06-20 — ENDGAME: THE OAR — the climb-out terminal (owner fork #22)

**Shipped:** the game's missing last breath. Ringing the bell at the bottom always
terminated; CLIMBING all the way out did not — you returned to the surface and the game
just continued, so the integration the whole SPINE points at (UP, carrying the wounded
self, the light left burning) dead-ended in "go dive again". Now the long-promised beached
dory (a standing promise since #39) arms once you have gone all the way down AND back
(`W.flags.returned`, at the surface): a two-touch committed crossing rows you out to the
ONLY look-BACK shot in the game — the whole island recedes and shrinks into a tiny lit
model floating on the dark sea (the recursion seen once more, chosen and warm), golden hour
held, no stars (those belong to the bell's STAY) — and the card lands "you left the light
on / an island within an island / begin again". The bell is struck at the bottom (accept
the loop); the oar is rowed at the top (leave, changed). Owner fork #22 made real: a CHOICE
shape, who-you-are held open. Designed by a multi-agent ending panel (5 blind generative
lenses → adversarial critique → showrunner synthesis → owner picked from 4 option-sketches),
built via an implement → adversarial-review pipeline (4 reviewers; 3 must-fixes caught + fixed).

**Evidence (`?debug`, Chrome):** full real-input path verified — the oar hotspot gates on
`W.level<=1 && returned` (false before arming, true after); hover→1st touch (brink whisper)→
2nd touch (self-hand journal + terminal). The cinematic plays: low look-back with the lit
jetty lantern → island shrinks to a model on the dark sea (NO backstage box) → golden-hour
card framing the tiny model between "ABYME" and "an island within an island". BELL
regression intact (deep: "you keep the light now", constellation withheld). Review fixes
verified live: `vaultDrips` no longer flickers back during the finale (mode-gated); the oar
brink RESETS on walk-away ("You set the oar back down"); discoverability — a seaward return
whisper + journal name the dory, plus a proximity nudge fires AT the boat; `farSea` hidden +
the sea disc shrunk (295 draws < 360, 6.2ms gpu, 60fps). Zero console errors. (Also fixed:
clicking Begin with a save no longer reloads and flashes the title screen back up.)

**Debt:** none added. The dive/ascent code is untouched. The warm `A.bellToll(true)` at the
oar's 9.5s mark is a deliberate light-kept-AND-left callback (owner may re-judge on listen).

**Next tick (76):** the owner-reported night-stars-grid jank fix ships next; then keep
polishing — an audio-audition pass, or owner playtest notes on the live ending.

---

## 74 — 2026-06-20 — graphics #5a: aerial perspective on the terrain

**Shipped:** distant land read crisp where the eye expects atmosphere. The canopy already melted into
the grade's haze with distance; now the TERRAIN does too — far shores, the bluff's far flank, the
horizon land recede toward the grade's haze colour, deepening distance and vastness. It begins at
170 m, so the near/mid ground — the beach, the chasm, the cliff AO from iter 71 — stays crisp and
untouched (no washing of the mid-ground depth).

**How:** extended the terrain material's existing `onBeforeCompile` (which already cuts the hatch
hole) to add a `uHaze` uniform + a fragment mix `mix(col, uHaze, smoothstep(170,520,length(vViewPosition))
* 0.3)` before `<fog_fragment>` — the same technique as the canopy haze. main.js tracks `uHaze` to the
active grade's fog colour each frame. Fragment-only; shared by both island + model instances (the model
sits <2 m from the lean-in camera, so it gets zero haze).

**Evidence (Power Ledger + visual, `?debug`):** noon aerial before→after — far shores/island edges
melt more into haze while near/mid (chasm, bluff, AO) is unchanged. Bench noon: 226 draws / 521k tris
/ 8.2ms gpu — draws/tris IDENTICAL (fragment-only), GPU within budget and within the frame-to-frame
noise of the iter-68/71 baseline (11.3–11.7ms): power-neutral. Night aerial: far land recedes into the
dark night haze, atmospheric, no artifacts. ZERO console errors. Model clone unaffected.

**Debt:** cleared roadmap #5a (terrain). Stone props could take the same haze later but are mostly
near-field; terrain is the dominant distant surface. #5b triplanar is the next (power-MEDIUM) step.

**Next tick (75):** PUSH BOUNDARY + NON-graphics (74 graphics now sits in the rolling 3-window). Ship
one non-graphics beat, then push the batch (iters 71–75). Honor an owner endgame-fork redirect FIRST.

---

## 73 — 2026-06-20 — accessibility: a reduced-motion comfort toggle

**Shipped:** the game had no motion-comfort option — the intro flight's sway/bank and the walking
head-bob played for everyone, and nothing honored the OS's prefers-reduced-motion. Now a third
top-right tab (beside sound + journal) toggles reduced motion: head-bob and the intro flight's
sway/bank drop to zero (the flight and the dive's essential scale stay). It DEFAULTS from the OS
prefers-reduced-motion setting and persists, so motion-sensitive players get a steady world
automatically and can flip it any time — a visible in-UI toggle, exactly the affordance the owner
asked for (not a query param), matching the sound-tab vocabulary.

**How:** `W.reduceMotion` (client preference, NOT save state) inits from localStorage
'abyme-reduce-motion' else `matchMedia('(prefers-reduced-motion: reduce)')`. A `#motion-tab` button
mirrors the sound-tab (icon = motion arcs + a slash when reduced); `UI.toggleMotion()` flips +
persists + updates the button + whispers ("The world steadies." / "The world sways again."). Gated:
player.js head-bob × `(reduceMotion?0:1)`; main.js intro flight bob + bank × the same `sway` factor.
The dive/ascent SCALE is a smooth zoom (not oscillatory) and is left intact.

**Evidence (`?debug`):** motion-tab renders as the third tab (right:110, top:18, no overlap with
sound@64 / journal@18); defaults full (headless has no OS pref). Click → reduceMotion true, 'reduced'
class, title "Motion: reduced", localStorage '1', whisper "The world steadies."; head-bob term = 0
when reduced vs 0.045 full; click again reverts + persists '0'. Screenshot confirms the slashed-motion
icon in the reduced state. ZERO console errors. Non-graphics, fork-neutral, +0 runtime.

**Debt:** none. (Future option: a gentler ease for the dive/ascent 240× zoom under reduced-motion —
but it's a smooth scale, low nausea risk; left for a dedicated tick if asked.)

**Next tick (74):** GRAPHICS is eligible again (axis: 71 graphics, 72 story, 73 story) — cut-stack
#3b (gate the conditional point-lights on state edges, with a Power Ledger) or #5a aerial haze. Honor
an owner endgame-fork redirect FIRST.

---

## 72 — 2026-06-20 — story (the journal's emotional climaxes get their marginalia)

**Shipped:** the journal draws a hand-inked sketch beside each entry — but only the PUZZLE entries
had them; the emotional and recursion climaxes rendered PLAIN. The most-read, most-moving pages (the
bottom of one's own making, the return to the surface, the ascent carrying the light, the disagreeing
second study, the keeper's shared pen, the model that only hopes, and iter 70's "you are here" beat)
looked poorer than the puzzles. Now EVERY journal entry carries marginalia: an X on a little map (you
are here), nested frames around a figure (the bottom), a stair rising to a sun (the return), a stair
with a flame left burning at its foot (the ascent), two facing model-frames across a gap (the
disagreeing studies), a shared quill (the merging hands), a drained-bay island with a small flame
(the model that only hopes). The narrative artifact is now fully illustrated.

**How:** 8 new `[textMarker, S(svg)]` pairs appended to ui.js `SKETCHES` (the same line-art helper,
viewBox 96×40, stroke paths), each matched to its entry by a unique text substring. Pure UI/SVG
content — +0 runtime, +0 draws; the two hands stay visually distinct (self = cream, keeper = green
italic).

**Evidence (`?debug`):** injected all 8 previously-plain climax entries → 8/8 now render WITH a
sketch (none plain). Journal screenshots confirm the marginalia match the existing hand-drawn style
and read clearly (X-on-map, nested-frames-with-figure, stair-to-sun, stair-with-flame at the foot,
two-facing-frames), with the keeper hand in green italic. ZERO console errors. Non-graphics, no power
cost.

**Debt:** none — the journal has no plain entries left.

**Next tick (73):** still NON-graphics (graphics eligible again at iter 74) — a world-detail/
legibility beat, a Panel item, or a jank fix. Honor an owner endgame-fork redirect FIRST.

---

## 71 — 2026-06-20 — graphics #4: vertex-baked ambient occlusion on the terrain

**Shipped:** the low-poly terrain read FLAT in its folds — the chasm, the drained basin, the feet of
the cliffs all caught the same flat skylight as the open beach. Now a vertex-baked AO darkens concave
ground by how far it sits below its surroundings: the chasm reads as a shadowed rift, cliff bases are
grounded, valley folds gain depth — while flat beach and plateau are untouched. Real contact-shadow
depth at literally ZERO runtime cost — the visible-quality win the owner asked for, power-free.

**How:** in `buildTerrain` (terrain.js), after heights+colours are baked, a second pass reads each
vertex's eight neighbours straight from the finished 257² height grid (FREE — no extra `heightAt`, so
load stays snappy) and multiplies the vertex colour by `1 - min(0.3, (ringAvg - h) * 0.05)` wherever
the point sits below its ring (R=3 cells ≈ 7.3 m). Convex ridges/flats get nothing. The terrain
already used `vertexColors`, so this is pure data — +0 draws, +0 runtime, grade-safe (multiplies the
base, reads in every light). The 1:240 model clone inherits it (same geometry).

**Evidence (Power Ledger + visual, `?debug`):** AO probed from the live grid — chasm centre concave
10.3 → 30% darker, cliff base 6.3 → 30%, flat beach −0.03 → 0%, island top −0.47 → 0% (flats
correctly untouched). Bench noon AFTER: **226 draws / 521k tris / 11.7ms gpu** — UNCHANGED from the
iter-68 baseline (232 / 521k / 11.3ms): power-NEUTRAL by construction (vertex colours) AND by
measurement. Visual: close bluff→chasm view at noon shows natural fold/cliff depth with clean flats
(no splotch); night view confirms consistent base-multiply (no artifacts). ZERO console errors. Load
stays snappy (grid array reads only — no extra heightAt).

**Debt:** cleared roadmap #4. Costs no power and banks none — pure quality.

**Next tick (72):** NON-graphics (71 graphics is now in the rolling 3-window) — a story/world-detail/
legibility beat or a Panel item; graphics eligible again at iter 74 (after two non-graphics ticks),
e.g. cut-stack #3b light-gating or #5a aerial haze. Honor an owner endgame-fork redirect FIRST.

---

## 70 — 2026-06-20 — story (the "you are here" discovery becomes a journal beat) + BOUNDARY PUSH

**Shipped:** iter 69's "you are here" marker fired only a fleeting whisper — unlike every other
recursion discovery (the 1:240 model entry, the tiny figure at depth), it never landed in the
JOURNAL, the game's permanent narrative artifact. Now leaning in to find yourself on the model writes
a once-per-save journal entry in the player's own hand: *"A mark has appeared on the model where I
stand — a little light that moves when I move. I have bent over this map for days, trusting it to
show me the island truly. It was showing me ON it the whole time. You can study a place a long while
before you notice you are also a figure in it."* Self-recognition, named without naming WHO you are
(fork-neutral re #22). The abyme beat now persists in the spine where the player can re-read it.

**How:** the `game.once('youOnModel', …)` callback in `applyAtmosphere` (main.js) now also calls
`UI.addJournal(…, 'self')` beside the whisper — once per save (game.once), dedup-safe (addJournal
dedupes by text). One coherent thing; no new objects, no power cost.

**Evidence (`?debug`, real intro→play handoff):** leaned the camera to 1.56 (<2.2) from the marker →
whisper "There you are — a speck on your own map." AND journal count 0→1, latest entry hand='self'
with the new text. Player-facing boot-check on the clean URL: title renders (THE ISLAND / ABYME /
Begin), WebGL OK, ZERO console errors.

**Debt:** none. **Boundary push:** deployed the batch (iters 66–70) to main — see the memory note.

**Next tick (71):** graphics is ELIGIBLE again (axis: 68 graphics, 69 story, 70 story → 68 has rolled
out of the 3-window) — CUT-stack #3b (gate the conditional point-lights on state edges) if cleanly
edge-safe, else baked AO (#4). Honor an owner endgame-fork redirect FIRST.

---

## 69 — 2026-06-20 — story / world-detail (the abyme made literal: "you are here" on the model)

**Shipped:** the chart-table model is the recursion centerpiece — but it was a static portrait of
the island. Now a cool cyan beacon tracks the player's REAL position on the 1:240 model: walk the
beach, climb the bluff, stand in the study, and a little light that is YOU moves across the model of
the island you are standing on. The abyme made literal — you are a speck on your own map. Leaning in
to find yourself earns one quiet line: *"There you are — a speck on your own map."* Fork-neutral: it
asserts presence-in-the-recursion, never WHO you are (issue #22 untouched). All metaphor, no biography.

**How:** `instantiateModel` builds a clone-safe `youMarker` (a Mesh cone + an additive glow Sprite —
never Points) added to `modelRoot` AFTER the clone/prune, in island-unit local coords (modelRoot's
~1/240 scale shrinks it to a ~0.16-world cursor). `applyAtmosphere` sets its local position to
`player.pos` each frame — modelRoot's transform IS the world→model map, so the marker lands exactly
where the player stands — pulses the glow, and fires the once-per-save lean-in whisper (the same
pattern as the shipped `nestedGlint` pinprick). The marker lives ONLY on the model (the player IS the
figure on the full island); it's not in refs/modelRefs, so `_apply` never touches it and the
both-instances invariant is intact.

**Evidence (`?debug`, in-play):** exactly one `youMarker` in the scene (model-side only), absent
from refs/modelRefs; tracks exactly — `markerLocal` == player.pos (-82,14,-42.5) → maps to the
lighthouse on the model; moving the player to the south beach moved the speck to the model's south
shore. Reads beautifully at NIGHT (a bright cyan beacon on the dark miniature) and is
subtle-but-present at NOON, clearly visible on lean-in (close-up verified) — matching the
lean-in-to-discover language of `nestedGlint`. The lean-in whisper fires (camera 1.56 < 2.2 →
"There you are — a speck on your own map.", confirmed after a real intro→play handoff). +2 draws on
the model only (179→181 at the study; 168 elsewhere) — far under the 360 interior budget; per-frame
cost is a vector set + a sine. ZERO console errors. Clone/refs/dive invariants all intact.

**Debt:** none added. Power-trivial, clone-safe, fork-neutral.

**Next tick (70):** still NON-graphics (iter 68 graphics sits inside the rolling 3-window, so 70
can't be graphics; graphics is eligible again at 71) — a story/world-detail/legibility beat, a Panel
#3/#4/#5 item, or a real jank fix. Honor an owner endgame-fork (#22) redirect FIRST if it comes.

---

## 68 — 2026-06-20 — graphics (CUT stack #3a: gate the dormant volumetric beams)

**Shipped:** the lighthouse beam, its inner shaft, and the cellar light-shaft are all
`AdditiveBlending` transparent cones — they cost overdraw fill EVERY frame they're drawn, even at
~0 intensity (invisible but not free). They're dormant most of the game (the lamp needs lens+night;
the shaft needs the hatch open). `puzzles.js _apply` now sets `.visible = animatedIntensity > 0.004`
for `beamCone` / `shaftBeam` / `cellarShaft` — driven on BOTH instances so the chart-table model's
tiny beam mirrors the island lamp; the `uIntensity` uniform stays island-only (unchanged). The
beams fade in exactly as before as their intensity ramps past the threshold — one coherent thing.

**Evidence (Power Ledger, `?debug` bench pose):** measured via direct `renderer.render` (bypasses
`game.tick`, so forced-visible vs gated visibility is cleanly isolated), dormant lamp+hatch:
draws **235→232 (−3)**, tris **521,528→521,464 (−64)**, IDENTICAL at noon (12h) and night (23h) —
and these are additive-transparent draws, so the real win is the per-frame overdraw FILL eliminated
(biggest when the camera is near/under the beam in play, smaller at the far overview pose). GPU-frame-ms
HOLDS: 11.3ms noon / 11.6ms night, ~60fps capped (488/407fps uncapped → ample headroom). No-regression
verified: beam+shaft VISIBLE when lit (lens placed @22h → beamI 1; screenshot shows the cone streaking
into the stars); cellar shaft VISIBLE at hatchOpen; all three hidden when dormant; model beam mirrors
the island lamp. ZERO console errors (preview restarted for a clean buffer).

**Debt:** cleared part of CUT-stack #3. Backlogged (with reasons): (a) particle `frustumCulled=true`
is NOT a safe one-liner — the Points live in `diveGroup` which rescales 240× mid-dive, and the auto
boundingSphere ignores the shader's ±0.6 drift + player-proximity point-size; needs a dive-edge
frustumCull toggle + dive-scale cull verification. (b) the 7-light `.visible` edge-gating (the biggest
fill cut) still wants its own careful tick (hide the recompile hitch on a curtain + verify no light
that should be lit goes dark).

**Next tick:** CUT-stack #3b — gate the conditional point-lights on state edges (the bigger fill win)
if cleanly edge-safe, else the particle frustumCull-with-dive-toggle; then baked AO (#4). Honor any
owner endgame-fork redirect FIRST.

---

## 67 — 2026-06-20 — close-look jank (a black box on the chart-table model) — fixed

**Fixed:** leaning over the chart-table model (the recursion centerpiece the player stares at
most) revealed a big BLACK BOX sitting on the tiny island where the lighthouse should be —
ugly, illusion-breaking. Diagnosed (raycast/traverse): it was the Vault Beneath (#17) cavern —
a 56×44×50 near-black (`#12171c`) BackSide box + the inverted-lighthouse vista — cloned into the
1:240 model, where it pokes up through the model terrain. (Intended ONLY in the full island, seen
through the cellar window; junk in the model.)

- `props.js`: wrapped the vault-vista decor (cavern, black-water plane, inverted tower + gallery +
  dome + `vaultLamp`) in a named `vaultVista` group and added it to `MODEL_PRUNE` — so
  `instantiateModel` strips it from the clone (same pattern as iter 49's gallery/jetty/quarters/
  vaultDrips). None of it is state-driven via `modelRefs` (only `vaultDoor`/`cellarShaft` are, and
  they're separate), so the "apply to both instances" invariant holds.

**Evidence:** in-play (`?debug`). `vaultVista` present in `core` (full island keeps the vault) =1,
pruned from `modelIsland` =0; `modelRefs.vaultDoor` + `modelRefs.cellarShaft` still present
(invariant intact). Screenshot of the close model view: the black box is GONE — the tiny
lighthouse + bluff now read cleanly. Bonus: model view 227→221 draws (power-neutral-or-better).
Restarted the preview for a clean console buffer and confirmed ZERO errors in real play (the 6
earlier "Raycaster.camera"/sprite warnings were from my whole-scene diagnostic raycast — the
game's only raycasts are interact's `setFromCamera` over hotspot meshes + a terrain-only ray, so
the game never raycasts sprites). Players unaffected.

**Next tick:** GRAPHICS LANE #3 (the cheap CUT stack — gate the 7 conditional point-lights on
state edges + particle frustum-cull + beam .visible gate + water fbm 4→3, with a Power Ledger),
OR the owner's endgame fork if called. Push boundary ~iter 70.

---

## 66 — 2026-06-20 — story/worldbuilding (act two rhymes — the ruler & the birdsong) — RHYME COMPLETE

**Shipped (non-graphics, axis stepped off the lane):** the last two act-two beats now rhyme with
the keeper's grief, completing the pass begun in #61/#62. TEXT-ONLY journal enrichment; surface
clue intact; no mechanic / solve-order change.
- The RULER: "…He measured this rift a hundred times, I think — you do not need a ruler for a
  distance you already know by heart. You measure it to have something to do with your hands."
  (grief as a thing to do with your hands.)
- The BIRDSONG: "…The box always bent that fourth note wrong; the bird sings it true. He must have
  heard it right a thousand mornings and never could make his own hands play it — some corrections
  only ever arrive too late." (the one note he kept getting wrong; a correction that came too late.)

With #61 (valve, plumb) + #62 (lens, shadows), ALL six chain beats now carry the keeper's story —
act two no longer reads as "clever toys disconnected from the grief" (Panel #1/#4's complaint, closed).

- `puzzles.js`: the `rulerPlaced` (crack) and `birdSolved` (stone-sequence) `addJournal` strings.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Fired the real `crack` hotspot
→ `rulerPlaced` set (chain intact), enriched ruler journal present ("…distance you already know by
heart"), once-only. Birdsong is a text-only string change on the unchanged stone-sequence
`birdSolved` trigger; module parsed (ABYME present) so the string is valid. Clean URL `/`: title +
WebGL OK, zero console errors — chain (valve→ruler→bird→lens→shadow→plumb→dive) unaffected.

**Next tick:** axis is open (last 3: graphics #65, then this story #66 — graphics lane may run
again next if due). Candidates: GRAPHICS LANE #3 (the cheap CUT stack — must carry a Power Ledger
from the ?debug bench at noon+night), an onboarding/accessibility pass, or a close-look jank fix.
The owner's endgame fork still trumps everything. NOTE next push boundary ~iter 70.

---

## 65 — 2026-06-20 — GRAPHICS LANE #2: per-grade exposure (five MOODS, not five hue-swaps) — BATCH PUSH

**Shipped:** the first real Quality-Bar win. ACES was running at a FIXED 1.06 exposure, so the
five master grades differed only in HUE, never in TONE (the art director's core complaint: night
and noon shared identical highlight clamping). Now each grade carries its own `exposure` and
`renderer.toneMappingExposure` is driven from the active grade every frame — noon reads **airy /
lifted (1.16)**, golden **warm (1.10)**, dawn 1.05, dusk 0.98, night **crushed / cool (0.92)**.
The world finally has five moods.

- `world.js`: `exposure` added to the `G()` grade factory (default 1.06, backward-compatible) +
  per-grade values; lerped in `gradeAt` alongside sunInt/fogDen. Left OUT of `gradeBias` on
  purpose so the L2–L4 depth-decay (colour-based, with `_LUM_FLOOR`) never compounds with a low
  night exposure into pure black.
- `main.js`: `renderer.toneMappingExposure = g.exposure` in `applyAtmosphere`.

**POWER LEDGER (MISSION requirement) — power-neutral by construction.** `toneMappingExposure` is a
uniform multiply inside the already-running ACES output; it changes no draws, no tris, no GPU
workload. From the `?debug` bench pose: noon 279 draws / 522k tris, night 238 / 522k, golden 238 /
522k (draw variance = camera/level framing, not this change); GPU-ms readings fluctuated 6–16ms =
headless-virtualization noise, NOT the exposure (a uniform cannot change GPU cost). BEFORE == AFTER.

**Evidence:** in-play (`?debug`). `renderer.toneMappingExposure` reads 1.16 at noon, 1.10 golden,
0.92 night (driven by the grade). Four-mood screenshots: noon airy-bright, golden warm-coral, night
crushed-cool-starry — they read as distinct MOODS now, not hue swaps. **Depth safety:** L4 + night
(worst-case) stays legible — terrain/trees/lighthouse visible, NOT black. Clean URL `/`: title +
WebGL OK, no debug panel, zero console errors — players unaffected.

**Deployed:** pushed — this batch carries the GRAPHICS MISSION AMENDMENT + lane #1 (Power Ledger) +
lane #2 (per-grade exposure). (iters 61–63 + the UX fixes / see-through-wall fix already went out
on-demand earlier.) Push-cadence memory updated; next boundary ~iter 70.

**Next tick:** axis must leave graphics (lane = ≤1 in 3, not two in a row) — a story/secret or
polish beat, OR the owner's endgame fork if they call it. The graphics lane resumes later at #3
(the cheap CUT stack: gate the 7 conditional point-lights on state edges, particle frustum-cull,
beam .visible gate, water fbm 4→3 — banks headroom for the eventual bloom).

---

## 64 — 2026-06-20 — GRAPHICS LANE #1: the Power Ledger (GPU-frame-ms + bench pose) — THE GATE

**Shipped:** the measurement gate the whole graphics roadmap depends on (MISSION "Graphics
Quality Bar & Power Ledger"). The `?debug` readout now shows real **GPU-frame-ms** beside
fps/draws/tris, and there's a fixed **bench pose** so every Power Ledger is measured from an
identical view. Without this, "power-neutral" was unfalsifiable — the 60fps cap (main.js:873)
makes fps read a flat 60 right up until it falls off a cliff. (The loop pivoted to this off the
stale act-two prompt because the owner explicitly redirected to graphics quality + approved the
MISSION amendment; #1 is the gate I'd flagged as next.)

- `main.js`: `makeGpuTimer(renderer)` — one `EXT_disjoint_timer_query_webgl2` query in flight,
  polled when ready (CPU rAF-delta fallback, labelled `(cpu~)`). Wrapped the single
  `renderer.render` with `gpuTimer.beginFrame()/endFrame()`, **null-guarded so players never
  create it** (DEBUG-only → zero shipped cost). Readout shows `…· N.Nms gpu`, color turns red
  at draws≥360 / tris≥800k / fps<58. A `bench` button + `ABYME.bench(t=12)` / `ABYME.gpuMs()` /
  `ABYME.gpuMode()` (fixed pose = the canonical SPAWN beach-island view; pass a time for noon/night).

**Evidence:** in-play (`?debug`). FIXED a TDZ bug first (the DEBUG block set `gpuTimer` before its
`let` → ReferenceError killed all debug init, no panel/ABYME, no console error — moved the `let`
above the block). After: `gpuMode()==='gpu'` (real timer present), `gpuMs()` reads ~14–24ms,
the panel line shows `59fps · 231 draws · 521k tris · 24.2ms gpu` at the noon bench, bench button
present + repositions to the fixed pose. Clean player URL `/`: no debug panel, no timer, title +
WebGL OK, zero console errors — players unaffected.

**Debt:** none. The gate is in; every future graphics tick now logs a Power Ledger (draws/tris/
GPU-ms before→after at noon+night from `bench`) or it's VISUAL DEBT.

**Next graphics-lane tick: roadmap #2 — per-grade `toneMappingExposure`** (zero GPU cost; makes the
five grades read as five MOODS, not hue-swaps). NOTE iter 65 is the push boundary (batch 13).

---

## ★ owner ask (2026-06-20) — graphics-quality strategy (6-agent workflow → MISSION amendment)

**Shipped (process):** the owner asked whether to adjust the loop/agents to push graphics
quality (textures, quality, performance). Ran a 6-agent workflow (art director · tech-art
feasibility · performance/power · process, then synthesis, then adversarial) reading the real
rendering code. Verdict: ABYME is graphics-limited, but the binding constraint is the
SURFACE/POST layer, not the art direction — the grades + sky + water shaders are genuine
craft; but every solid is flat-shaded MeshStandard with NO normal/roughness/AO maps, ACES is
set with nothing feeding it (no bloom), post is CSS-only, and the MISSION's `<200 draws`
budget was FICTIONAL (real ~307–340).

**Applied to MISSION.md:** a new "Graphics Quality Bar & Power Ledger" section + reconciled the
draw budget (both occurrences) + a rate-limited graphics lane (≤1 in 3 builds) in the axis list.
The bar: serves the five grades · power-neutral-or-better proven by a Power Ledger (draws/tris/
**GPU-frame-ms** before→after at noon+night from a fixed bench pose; fps≥60 is necessary-not-
sufficient because the cap hides headroom) · shared-material-safe on BOTH islands · one thing
finished. WebGL post (three/addons jsm) pre-authorized but fenced (MSAA trap: a composer discards
the free antialias — SMAA must land same-tick; bloom selective/half-res/DPR-clamped/gated).
Asset-honesty pointer corrected to index.html:33 + :7 (NOT README — it doesn't hold the claim).

**Roadmap (cheap power-neutral FIRST, banks headroom for the one power-raiser):** (1) Power
Ledger = GPU-ms readout + bench pose + reconciled budget [GATE — do first]; (2) per-grade
toneMappingExposure [zero GPU cost — makes the 5 grades read as 5 MOODS not hue-swaps]; (3) cheap
CUT stack [gate the 7 conditional point-lights via .visible on state edges — a 0-intensity light
still costs a per-fragment loop iteration; +particle frustum-cull, beam .visible gate, water fbm
4→3]; (4) vertex-baked AO into the Baker [bake-time only]; (5a) distance aerial-perspective
[near-free] then SEPARATELY (5b) triplanar normal/roughness break-up [adds-medium, bench first];
(6) in-shader beam god-rays [bench-check]; (7) EffectComposer bloom+SMAA as its OWN gated tick
AFTER 1–6. DEFER (owner-ask only): PMREM env, planar/SSR water reflection, DOF.

**Next graphics-lane tick: build #1 (the Power Ledger) — it gates everything else.**

---

## ★ owner bug (2026-06-20) — see-through chasm/valley walls (terrain was single-sided)

**Fixed (owner-reported):** "falling into the valley is still super buggy — I still see
through the wall." Walking down a chasm/valley lip puts the camera below the surrounding
rim (e.g. (39.7, -0.8, -14.6), the chasm's west lip — chasm centreline x≈46), and from
there you could see STRAIGHT THROUGH the terrain walls. Cause: the terrain mesh material
was `MeshStandardMaterial` with no `side` set → `FrontSide` (single-sided), so any wall
viewed from its back/inside was backface-culled and invisible.

- `terrain.js`: terrain material → `side: THREE.DoubleSide`. Walls and the underside now
  read solid from any angle. (The 1:240 model shares this material, so the recursion's
  terrain is fixed too.)

POWER: effectively neutral — DoubleSide only disables backface culling; it adds no draws
and no tris (verified 231 draws / 521k tris, unchanged), and backfaces only rasterise
where they're actually visible (inside the chasm), which normal play occludes.

**Evidence:** in-play (`?debug`). From the exact stuck spot (the chasm lip, looking across)
the wall now renders as a SOLID terrain face (was: see-through with the world showing
through). Normal beach view unchanged (no regression). `terrain.material.side === 2`
(DoubleSide). Zero console errors. NOTE: you can still walk down to the lip (the deeper
descent below -2.2 is already blocked in player.js); it just no longer looks broken. If you
want the player blocked from the lip entirely, that's a separate walkability tweak (care:
the causeway crest at -1.42 must stay passable).

---

## ★ owner request (2026-06-20) — the intro lands continuously (no cut to standing)

**Shipped (owner-reported):** "the flow across the water is amazing, but then it pauses and
we are suddenly on land — should be one continuous scene." The approach flythrough ended
high over the water at `(10, 4, -118)` and then `endIntro` HARD-SNAPPED the player to a
different spot/orientation `(4, 0, -104)` — that jump is the "pause / suddenly on land."

Fixed so the flight LANDS on the exact standing frame and hands over seamlessly:
- `main.js`: a single source of truth `SPAWN_POS/YAW/PITCH` + `setIntroLanding()` (called at
  the start of `beginIntro`): it positions the camera at the standing frame, then sets the
  approach curves' FINAL points to that eye position and forward (`INTRO_PATH[last]=eye`,
  `INTRO_LOOK[last]=eye+fwd*40`) so the glide eases right into where the player will stand.
- The intro's banking roll now damps to 0 at the end (`*(1 - f*f)`, matching the bob), so
  there's no residual motion at handoff.
- `endIntro` spawns the same `SPAWN_*` — identical to the flight's final frame → no cut.

**Evidence:** in-play (`?debug`). Math proof: the flight's final frame vs the spawn frame —
posDelta 0, quatDot 1.000000 (identical position AND orientation). Real path: clicked Begin
(real `setIntroLanding`), drove the intro to its end — near-landing screenshot and post-
`endIntro` screenshot are continuous (same standing view of the beach/lighthouse); after
handoff `playerLocked:false`, `introDone:true`, chrome shown, camera at `(4,1.71,-104)`. Zero
console errors. 60fps.

---

## ★ owner request (2026-06-20, between iters 63 and 64) — a visible SOUND TOGGLE (UX)

**Shipped (owner-requested, not a numbered loop iteration):** sound could only be toggled by
the `M` key or the `?mute`/`?debug` query params — no visible control. Added a clickable mute
button matching the journal tab.
- `index.html`: a `#sound-tab` button (top-right, left of the journal tab) with an inline-SVG
  speaker icon — sound-waves when on, a slash when muted. `aria-label` + dynamic `title`.
- `style.css`: `#sound-tab` styled to match `#journal-tab` (38px circle, `right: 64px`,
  ink-dim → amber on hover); `.muted` swaps waves↔slash.
- `ui.js`: a shared `toggleMute()` (the button AND the `M` key call it, so the icon stays in
  sync); the icon reflects the persisted/`?param` state on init; shown alongside the journal
  tab in `showHint()`. Mute already persisted via `audio.js setMuted` → `localStorage` — kept.

Fork-neutral, additive; no audio-engine change.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Verified: tab shows the
muted icon on a `?debug` (muted) load; click AND the `M` key both flip muted state + the icon
class + the persisted pref `abyme-muted` + the title, IN SYNC; an unmute persists across reload
(stored '0' overrides the debug-mute default); screenshots confirm both icon states (waves vs
slash) beside the journal tab. 60fps.

**Deploy:** committed locally; owner to say whether to push now or roll with the next batch.

---

## 63 — 2026-06-20 — persona critique (Panel #5: stock-take — the fork-neutral work is done)

**Shipped (a critique, axis shift off story):** considered a graphics polish first — booted the
golden-hour overview (coral sky, long pine shadows, soft surf, 60fps/220 draws) and confirmed
the graphics are already strong with no clean power-neutral win to beat them — so ran Panel #5
instead, a stock-take at a natural "is this finished?" checkpoint.

**Finding:** ABYME is strong and substantially shippable as an experience — the descent-and-
return is complete, polished, and landing. The ONE structural hole is the owner's to fill: the
ring-bell-at-depth ending terminates (and withholds, beautifully), but CLIMBING OUT to the
surface has no terminal — the "return leaves a mark" beat plays and then the game just
continues. The integration ending (UP, carrying him, changed) dead-ends in "back on the beach,
go dive again." Authoring that terminal IS the owner's closed-vs-choice fork (#22); the loop
will not bake it in. Minimal unblock: the owner picks the ending shape (a one-line steer is
enough → loop builds it in 1–2 ticks).

The big fork-neutral wins are spent (ascent, act-two rhyme, environments, grades, perf). What
remains fork-neutral is second-tier: finish act-two (ruler/bird), onboarding/accessibility, a
replay hook, an audio audition. The loop has reached the honest edge of its autonomy — it can
keep polishing, but it can't decide what leaving MEANS.

- `loop/CRITIQUES.md`: Panel #5 (newest first).
- `loop/SPINE.md` step 5: the climb-out terminal flagged as the one remaining owner-gated piece.
- Issue #22 sharpened (the climb-out has no terminal; minimal-decision framing).

**Evidence:** N/A (doc-only critique; one verification screenshot of the golden-hour overview
confirmed graphics strength + 60fps). Committed locally; not a push boundary (next at 65).

**Next tick suggestion:** continue fork-neutral second-tier — finish the act-two rhyme on the
RULER (the measure of a crack he already knew the width of) and the BIRDSONG (the corrected
note), OR an onboarding/controls-clarity pass. Hold the ending for the owner's fork. NOTE iter
65 is the next push boundary (batch 13 = 61–65).

---

## 62 — 2026-06-19 — story/worldbuilding (act two rhymes — the lens & the shadows)

**Shipped:** Pass 2 of Panel #4's act-two rhyme — two more puzzle-completion JOURNALS now
carry the keeper's grief while keeping their surface clue. With iter 61 (valve, plumb), the
FOUR most thematically loaded beats of the chain now rhyme with his story:
- The LENS: "…Whoever kept this light must have ground and polished that glass a thousand
  nights, so it could see a way home for someone out on the water." — the keeper's vocation,
  a light sent home for someone who may never come.
- The SHADOWS: "…He must have read this same hour off these same stones, day on day; some
  hours you set your whole life by, and they arrive whether or not you are ready." — the
  golden-hour ritual, and the day that came anyway.

TEXT-ONLY; no mechanic / solve-order change; metaphor, no biography; fork-neutral.

- `puzzles.js`: the `lensSlot` (lensPlaced) and `shimmer` (shadowRevealed) journal strings
  deepened. Whispers unchanged (they carry the clue).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Fired the real `lensSlot`
and `shimmer` hotspots: `W.lensPlaced` and `W.flags.shadowRevealed` still set (mechanics +
chain intact), enriched journals fire once each (text confirmed — "a way home for someone" /
"whether or not you are ready"). Chain stays solvable.

**Debt:** none. The act-two rhyme is now substantially done (4 of ~6 beats; the remaining
ruler / birdsong / crank / music-box are less central — optional). Time to SHIFT AXIS off
story next.

**Next tick suggestion:** shift axis to avoid over-working story — a graphics/atmosphere
polish, an audio-audition pass, OR a Panel #5 to take stock of where ABYME stands now that
the arc is complete+polished AND the middle rhymes. NOTE iter 65 is the next push boundary
(batch 13 = 61–65). The owner's three forks remain the only thing between here and a finished
ending.

---

## 61 — 2026-06-19 — story/worldbuilding (act two begins to rhyme with the grief)

**Shipped:** The first pass at Panel #4's act-two gap — the middle puzzles reading as
"clever toys" disconnected from the keeper's story. TEXT-ONLY: the two most loaded
puzzle-completion JOURNAL entries now rhyme with his grief, while keeping their surface
clue intact for a first-time player.
- The VALVE (the tide): "…Someone built a machine to make the sea go back, and must have
  turned it, and turned it. As if, on some one day, holding the water back was the only
  thing left worth wanting." — draining re-read as the day he tried to hold the water back.
- The PLUMB (the depth): "…The weight knows the depth before it drops. Whoever hung it
  first already knew how far down this goes." — measuring a depth he already knew.

No mechanic / solve-order change — purely the diegetic record. Metaphor, no biography.
Fork-neutral.

- `puzzles.js`: the `valveTurned` and `plumbHung` `UI.addJournal(...)` strings deepened
  (whispers unchanged — they carry the puzzle clue).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Fired the real `valve`
and `hook` hotspots' onClick: `W.flags.valveTurned` and `W.flags.plumbHung` still set
(mechanics + chain intact), and the enriched journals fire once each (text confirmed —
"holding the water back" / "how far down this goes"). The chain stays solvable.

**Debt:** none broken. Remaining act-two beats (ruler, birdsong, lens, shadows) could get
the same rhyme in a later tick — optional; valve+plumb are the two most thematically
loaded, so this is the highest-value slice.

**Next tick suggestion:** finish the act-two rhyme on 1–2 more beats (the LENS — "don't
read all four"; the SHADOWS — the keeper read the same hour), OR shift axis (a graphics/
atmosphere polish, an audio-audition pass, or a Panel #5). NOTE iter 65 is the next push
boundary (batch 13 = 61–65). The owner's three forks remain the only thing between here and
a finished ending.

---

## 60 — 2026-06-19 — polish + BATCH 12 PUSH (the plate glints; the whole ascent goes live)

**Shipped:** The visual half of discoverability (Panel #4 #1), then the deploy. The brass
plate now wakes with a soft amber glow ONLY at the bottom — when there is nowhere further
down, the way back GLINTS, so a player who walked over to ring the bell still sees the
plate is live. Completes the discoverability triad: the whisper (#57) + the journal (#57)
+ now the glint. Off at every other depth and the whole time you're climbing.

- `props.js`: a `plateGlow` Sprite (shared `radialGlowTex`, amber, additive) above the
  deskPlate; added to `NAMES`. A Sprite (clone-safe) — no shared-material touch, no Points.
- `puzzles.js` `_apply`: `plateGlow.visible = W.level >= MAX_DEPTH && !W.flags.climbing`,
  a gentle opacity pulse when lit.

Fork-neutral; mirrors the verified jettyHalo pattern (#48).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Gating (via game.tick):
plateGlow visible ONLY at L4-not-climbing; hidden at L4-climbing, L2, L1. Screenshot at the
bottom shows the warm amber cue on the floor at the plate (lower-right of the chart table).
60fps. PRE-PUSH BOOT CHECK on clean URL `/`: title+Begin render, canvas/WebGL ok, no errors.

**Deployed:** BATCH 12 — pushed iters 56–60 live (submodule → main, then Dockhand parent
gitlink): Panel #4 + all its fork-neutral polish (climb discoverable [whisper/journal/glint],
the return leaves a mark + the tally stays full, the climb has weight). Push-cadence memory
updated (boundary #12; next at 65). The ascent is now LIVE, complete, AND polished.

**Next tick suggestion:** the big remaining FORK-NEUTRAL build is the Architect's act-two
rhyme — make 1–2 existing puzzle beats rhyme with the keeper's grief (valve = the day he
held the water back; plumb = a depth he already knew) so the middle stops reading as clever
toys disconnected from the spine. A careful dedicated tick (chain-adjacent — verify the chain
stays solvable). OR await the owner's forks (now small additions on a fully-polished
staircase). Invite playtest.

---

## 59 — 2026-06-19 — story/design (give the climb weight — Panel #4 gap #3) — PANEL #4 CLOSED

**Shipped:** The climb is no longer the dive with the sign flipped. The Skeptic's note:
the dive is a SURRENDER (you fall, 21s, easeInOut swoop); the ascent should be an EFFORT
(you heave the world up). Now the ascent runs a third longer — `ascent.dur = 28` vs the
dive's 21 — a heavier, more laboured rise, and the opening whisper names the resistance:
"You run the mechanism backward. It fights you — the world comes up by inches." Paired with
the keeper's silence (stage 3), the climb now FEELS distinct from the dive — lonelier and
harder, the way carrying something heavy up should be. **This closes Panel #4's three
fork-neutral gaps (discoverability ✓57, return-mark ✓58, weight ✓59).**

- `main.js` `startAscent`: `dur` 21 → 28 (ascent only; the dive's 21 is untouched); the
  start whisper reworded to convey effort/resistance.

Fork-neutral; the dur change scales the existing f-thresholds (fade f>0.86, snap f>0.95)
so all the ascent beats still land. No new deps.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Real ascent (play
mode): `getAscent().dur === 28`, cinematic live, the effort whisper confirmed verbatim. The
dive's `dur` stays 21 (startDive untouched). REGRESSION via the instant path: a full
climb-out still decrements 4→3→2→1, fires the keeper-silence (first ascent) and the
return-mark (`returned` at the surface, climbing cleared), journal grows — all intact.

**Debt:** none broken. A richer laboured-easing / heavier audio bed could deepen the
"weight" further but needs the owner to feel the 28s cinematic (filed as optional polish).
The larger act-two-rhyme note (Panel #4) remains.

**Next tick (iter 60 = PUSH BOUNDARY, batch 12):** the ascent is complete AND polished
(Panel #4 fully addressed). Ship one SAFE item or run a quick check, then PUSH iters 56–60
(submodule → main, then Dockhand parent gitlink from worktree ROOT), update push memory
(boundary #12, next at 65), boot-check the clean URL first. Strong candidate: a Panel #5 /
owner-playtest-readiness pass, OR re-surface the three forks now that the staircase is
fully polished — the owner's call is the only thing between here and a finished arc.

---

## 58 — 2026-06-19 — story/design (the return leaves a mark — Panel #4 gap #2)

**Shipped:** Climbing all the way out to the surface no longer lands you back exactly as
you started — the arc promised you return CHANGED, and now the world shows it, two ways:
- A felt beat the once you reach the surface after a climb: a whisper ("Back at the
  surface. The door, the coat, the jetty — all as you left them. Only you are different.")
  + a re-readable self-hand journal line ("I have been all the way down and all the way
  back… the hand that writes this is mine again, and I left his still burning below. I did
  not put it out. I did not stay.").
- A persistent VISIBLE fingerprint: the chart-table descent tally (iter 46) now STAYS full
  at the surface once you've returned — three scratches that used to vanish when you came
  up now remain, the record that you went to the bottom of your own making and climbed back.

Fork-NEUTRAL: evidence of the journey, not an ending or a who-you-are reveal. Additive;
the dive/chain/finale/ascent untouched.

- `world.js`: `flags.returned` (backward-compatible default false).
- `main.js` `landAscent`: on reaching the surface (level 1) via a climb, set `returned`
  once + fire the whisper/journal.
- `puzzles.js` `_apply` tally: `n = W.flags.returned ? MAX_DEPTH-1 : W.level-1` — full and
  permanent once returned, unchanged behaviour before.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. A normal level-1 start
does NOT set `returned` or add a journal entry; a full dive-to-bottom-then-climb-out sets
`returned` exactly at the surface (L2→L1), adds the self-hand entry (verbatim confirmed),
and `returned` stays false until the surface. Tally at the surface after return = `[1,1,1]`
(numeric) and SCREENSHOT shows the three gold marks on the chart-table east margin at
level 1 (in iter 46 the surface showed none). 60fps.

**Debt:** Panel #4 gap #3 (give the climb weight — it's too symmetric with the dive)
remains, plus the larger filed act-two-rhyme note. None broken.

**Next tick suggestion:** Panel #4 GAP #3 — give the climb WEIGHT so ascending feels like
an effort, not the dive with the sign flipped: e.g. a slower ascent swell, a lonelier
audio bed in the keeper's silence, or the SPINE's literal per-level re-lock. OR (iter 60 is
the PUSH boundary — batch 12 deploys 56–60) keep it safe and consider a Panel #5 / owner
playtest check before the push. Re-surface the three forks.

---

## 57 — 2026-06-19 — story/design (the climb made discoverable — Panel #4 gap #1)

**Shipped:** The one true payoff can no longer be missed. Panel #4's top gap: a player who
rings the bell at the bottom might never learn the brass plate turns back into the way up.
Now, at the bottom (`W.level >= MAX_DEPTH`, not yet climbing) and standing in the study —
near BOTH the plate and the bell — the game points at the way up, once: a whisper, "Nowhere
deeper. The plate that brought you down only ever went one way — try it again," and a
re-readable self-hand journal line, "There is no further down… the plate is the only door
left, and it is under my feet. If it only goes one way, then the way on is the way back up."

Fork-NEUTRAL by construction: it names the EXISTENCE of the climb, never a choice or its
consequences. The bell finale and the dive are byte-for-byte unchanged.

- `puzzles.js`: a `once('climbHint')` proximity beat gated on `W.level >= MAX_DEPTH &&
  !W.flags.climbing` + within 4.8m of the lighthouse (the study, covering plate + bell).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Drove `game.tick`
across states: `climbHint` fires ONLY at L4 in the study, NOT while climbing, NOT on the
beach, NOT at L2 or L1 (the once-key gates exactly as designed). Clean isolated run
confirms the whisper text + the self-hand journal entry verbatim.

**Debt:** none broken. Panel #4 gaps #2 (the return leaves a mark) and #3 (give the climb
weight) remain. A plate brass-glint visual cue was deferred (the plate shares
`matBrassSolid`; a dedicated glow would be a separate safe tick) — the whisper+journal is
the discoverability for now.

**Next tick suggestion:** Panel #4 GAP #2 — the return leaves a mark. Climbing out to the
surface (level 1) currently lands you back exactly as you started; show ONE fork-neutral
fingerprint that you went down and came back (the chart-table tally still scratched; a
keeper-hand journal line now in your own hand; the coat on your shoulders / gone from its
hook). NOTE iter 60 is the next push boundary — batch 12 deploys 56–60.

---

## 56 — 2026-06-19 — persona critique (Panel #4: the return, the arc now whole)

**Shipped (a critique, not a build — valid per MISSION):** Panel #4 convened the moment
the ascent went live, to pause-and-assess after the four-tick build before piling on more.
Three critics (the Finisher replayed the full descent-and-return; the Skeptic; the
Narrative Architect) judged: the arc is structurally whole and lands ~80%, the keeper's
silence as you turn back is the best beat in the game — but THREE fork-neutral gaps remain:

1. **DISCOVERABILITY (highest, small):** a player who rings the bell at the bottom — the
   obvious action — may never learn the plate turns back into the way up. The one true
   payoff is gated behind a guess. Point at it unmissably (without forcing the choice).
2. **THE RETURN LEAVES A MARK (small-med):** climbing out to the surface lands you back
   exactly as you started; the arc promised you return CHANGED. Show one fingerprint.
3. **GIVE THE CLIMB WEIGHT (med, optional):** the climb is too symmetric with the dive (a
   surrender vs an effort); make it slower/lonelier/a per-level re-lock.

Plus a larger, filed note: ACT TWO (the puzzle chain) still reads as clever toys
disconnected from the grief — cheapest fix is making 1–2 existing beats rhyme with the
keeper's story. Not rushed.

- `loop/CRITIQUES.md`: Panel #4 (newest first).
- `loop/SPINE.md`: endgame note records the three ranked gaps.
- Issue #12 sharpened with the ranked fork-neutral polish list.

**Evidence:** N/A (doc-only critique tick; no code changed). Committed locally; not a push
boundary (next at 60). Axis: critique (varies from the 52–55 ascent build run).

**Next tick suggestion:** BUILD GAP #1 — the climb's discoverability. At the bottom (after
the keeper beat and/or after the bell), an unmissable pointer that the plate is the way
back ("The plate is still here. It only ever went one way before." + maybe a brass glint /
the keeper naming it once). Fork-neutral; protects the whole ascent. Then gap #2 (the
return leaves a mark) next.

---

## 55 — 2026-06-19 — story polish + BATCH 11 PUSH (the ascent goes live)

**Shipped:** A small, re-readable payoff for the climb, then the deploy. On the first
ascent the journal records the integration — in your OWN hand again (you were becoming
the keeper on the way down; rising, the pen is yours once more): "I went all the way
down … and found him still there, still tending it. I could not bring myself to put it
out. So I have started back up the stairs, and I am carrying what I found at the bottom.
The light is still burning behind me. Let it." A persistent record of the turn back up —
not a lean-in whisper that scrolls away, but a line you can re-read.

- `main.js` `landAscent`: one `UI.addJournal(…, 'self')` in the first-ascent block
  (gated by `keeperSilenced`, so once only).

Fork-neutral; additive; mirrors the verified iter-45/50 journal pattern.

**Evidence:** in-play (`?debug`): first ascent adds the entry (hand `self`), second ascent
does NOT duplicate (count stays 1), zero console errors. PRE-PUSH BOOT CHECK on clean
URL `/`: title+Begin render, canvas/WebGL ok, debug off, no console errors.

**Deployed:** BATCH 11 — pushed iters 51–55 live (submodule → main, then Dockhand parent
gitlink). The ASCENT is now LIVE: descend to the bottom on the brass plate, then touch it
again to climb back up, the keeper falling silent behind you. Push-cadence memory updated
(boundary #11; next at 60).

**Next tick suggestion:** the ascent is live and the staircase is built — the owner's
three ending forks (closed-vs-choice / who-is-the-player / final camera) are now SMALL
additions on top. Best next move depends on the owner: if they pick a fork, build it; if
not, a SAFE deepening (e.g. the surface-arrival when you climb all the way out to level 1
— what the player sees/feels back at the top, fork-neutral) or a persona check on the
now-complete arc. Invite the owner to playtest the live ascent first.

---

## 54 — 2026-06-19 — design/story (the ascent, stage 3 — the keeper falls silent) — ASCENT COMPLETE

**Shipped:** The unmissable beat that makes the ascent a beat, not another lean-in
(Panel #3's whole complaint). As you rise, the world draws quiet (held silence); the
FIRST time you turn back from the depths the keeper gives one last resigned line —
"…go on up. Don't leave the light on for me. I never could." — and then the floor below
goes silent for good. The arrival names it: "Below you, the voice has stopped. The light
still burns — you did not put it out." That last clause is the INTEGRATION beat: you
leave him where he chose to stay, but you leave the light burning — wholeness, not
abandonment. **This completes the ascent (#12) — all three stages.** grief→INTEGRATION
now has both halves, in the player's hands.

- `world.js`: `flags.keeperSilenced` (backward-compatible default false).
- `main.js`: `startAscent` now holds the ambient quiet (`A.duckAmbient(true)`) and resets
  the farewell transient; `landAscent` speaks the keeper's last line once (`wasLevel>=3`,
  `keeperVoice('resigned')`) and sets `keeperSilenced`; `tickAscent` f>=1 releases the
  ambient (`duckAmbient(false)`) and, the once, fires the named-silence whisper.

Uses the EXISTING keeperVoice('resigned') register + duckAmbient — no new synthesis, so
no owner audition needed. Fork-neutral (no ring-vs-climb, no who-am-I, no final camera).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Instant path
(landAscent): first ascent L4→L3 flips `keeperSilenced` false→true and calls
`keeperVoice('resigned')` with NO throw; second ascent L3→L2 stays silenced (no second
voice). The keeper's farewell line confirmed in the whisper element verbatim. Play mode:
the real cinematic with the new held-silence starts clean (`ascend(false)` true,
`getAscent` live, player locked, no throw). HARNESS LIMIT: the f>=1 release + delayed
named-silence whisper run only in the full 21s cinematic (can't be watched to its end
headless) — both are single calls mirroring the dive/verified-elsewhere patterns, gated
on the verified `keeperFarewell`.

**Debt:** none broken. AXIS NOTE: 52/53/54 were all the ascent — a deliberate exception
to the no-3x-axis rule, because this is one coherent keystone built in safe stages (the
opposite of fleeing to easy wins). Done now.

**Next tick (iter 55 = PUSH BOUNDARY, batch 11):** ship one SAFE item then push iters
51–55 (submodule → main, then Dockhand parent gitlink from the worktree ROOT) and update
the push-cadence memory (boundary #11, next at 60). The ascent will then be LIVE — worth
the owner experiencing it. Candidate safe iter-55 item: a tasteful ascent polish (a
look-back at the shrinking world on the first climb), OR surface the now-unblocked ending
forks again (with the staircase built, the owner's choices are small additions). Consider
whether the owner wants to playtest the ascent before more is layered on.

---

## 53 — 2026-06-19 — design/story (the ascent, stage 2 — the way UP, in-play)

**Shipped:** UP is now in the player's hands. The brass plate — the dive — becomes the
CLIMB at the bottom: you descend, one level deeper each commit, until MAX_DEPTH, and
there the plate's only direction left is up. From the moment you turn back you're in a
one-way `climbing` mode (you can't dive again until you reach the surface) — so you
cannot yo-yo, and the shape of it is the thesis itself: **the only way out is down
first, then up.** The integration arc, made mechanical, and still fork-NEUTRAL (no
ring-vs-climb choice, no who-am-I reveal, no final camera — the bell finale is
untouched; climbing is simply an available action, like diving always was).

- `world.js`: `flags.climbing` (one-way ascent mode; backward-compatible default false).
- `main.js`: `onAscend: () => startAscent(false)` wired into the Game; `landAscent`
  clears `climbing` at the surface so a fresh descent is possible.
- `puzzles.js`: the plate `onClick` now picks direction — descend while there's deeper
  to go and you haven't turned back; otherwise (at the bottom, or already climbing) the
  two-touch brink commits an ASCENT (sets `climbing`, calls `onAscend`). Direction-aware
  brink whispers. The dive path is byte-for-byte the same when descending.

Implements the SPINE's "you cannot yo-yo" via the one-way mode rather than re-arming
chain puzzles — same goal, zero chain-breakage risk.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors.
- Direction (fired the real `game.interact` plate hotspot's onClick): commit at L4 and
  while climbing sets `climbing=true` (UP); commit at L2 not-climbing sets `dove=true`
  (DOWN). Brink arms for all 3 valid states; at the surface (L1) the ascend is refused
  (no brink).
- `climbing` one-way: persists mid-climb (L3→L2), clears at the surface (L2→L1).
- END-TO-END in PLAY MODE (Begin+skip-intro): standing on the plate at the bottom, two
  touches → brink arms (ascend copy shows: "Touch the plate again to rise another
  level…"), commit sets `climbing` and STARTS THE REAL ASCENT CINEMATIC (`getAscent`
  live, player locked). Dive path intact.

**Debt:** none broken. The full 21s cinematic still can't be watched to its snap
headless (verified the snap via the instant path in #52). Stage 3 remains: the one
UNMISSABLE beat (the felt shrink + the keeper's voice falling silent behind you).

**Next tick suggestion:** ASCENT STAGE 3 — the unmissable beat. As the world draws in,
the keeper's voice should fall silent behind you (audio.js + the keeperVoice register),
and the ascent should land with a felt arrival (a whisper/journal line per level up is
shipped; add the silence + maybe a brief look-back). Keep fork-neutral. NOTE iter 55 is
the push boundary — batch 11 deploys 51–55 (the critique + the whole ascent).

---

## 52 — 2026-06-19 — design/story KEYSTONE (the ascent, stage 1 — the dive run backward)

**Shipped:** The first half of the verb the SPINE has promised since Panel #1 — **UP.**
The dive's 240× swell, run backward: the whole world shrinks until it is the model on
a chart table one level up, and `W.level` DECREMENTS (clamped at 1, the surface). This
is the fork-NEUTRAL keystone Panel #3 demanded — it pre-decides none of the owner's
three forks (closed-vs-choice / who-you-are / final camera); those layer on top later.
Stage 1 = the mechanic + the state settle, started from a debug hook; the in-play
trigger and the unmissable beat are stages 2–3.

- `main.js`: `startAscent(instant)` / `tickAscent` / `landAscent()` — exact mirror of
  `startDive`/`tickDive`: scale `1 → SCALE_MODEL` (vs the dive's `1 → 1/SCALE_MODEL`),
  pivot on the chart table, snap at f>0.95 → `W.level = max(level-1, 1)`, save, respawn
  at the study/chart-table (rise OUT, one level up). Wired into the loop
  (`MODE === 'ascend'`); exposed `ABYME.ascend(instant)` + `getAscent()`.
- Fork-neutral by construction: NO ring-vs-climb choice, NO who-am-I reveal, NO final
  camera move. Just the staircase.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors.
- Swell math (numeric): ascent scale `1 → 0.00417` (=1/240) vs dive `1 → 240` — exact
  inverses.
- State transition (instant path): L4→3→2→1, each respawning at the chart table
  (-82.8, -41.4); L1→clamp (returns false, stays 1). Re-grade is automatic (the same
  `W.level`-driven `_apply`/`gradeAt`).
- Real cinematic (play mode, via Begin+skip-intro): `ascend(false)` returns true,
  enters `MODE='ascend'`, player locked, swell begins (scale dips below 1), no crash.
- Visual: a mid-swell screenshot (forced scale) shows the entire world shrunk to a
  small island-and-water tile floating in the full-size sea — "the world becomes a
  model." HARNESS LIMIT (honest): the full 21s cinematic can't be watched to its snap
  headless (a capture frame advances only ~0.11s; rAF otherwise suspended), so the snap
  OUTCOME was verified via the instant path (same `landAscent`), and the swell via the
  numeric formula + the started cinematic.

**Debt:** none broken. The ascent has no IN-PLAY trigger yet (debug-only) — that's
stage 2, deliberately. The receiving "chart table above" geometry the player lands at
is the current study (fine); a bespoke arrival framing is later polish.

**Next tick suggestion:** ASCENT STAGE 2 — give it an in-play trigger that costs (SPINE
step 4: "each level up, a puzzle re-locks below, so you cannot yo-yo"). E.g. running the
lamp/orrery mechanism backward, or a second brink-ritual at the plate that ascends
instead of dives, with a chain flag re-arming on the level below. Keep fork-neutral.
Then stage 3: the one UNMISSABLE beat (the shrink you feel + the keeper's voice falling
silent behind you). NOTE iter 55 is the next push boundary — batch 11 will deploy 51–55.

---

## 51 — 2026-06-19 — persona critique (Panel #3: the waiting room)

**Shipped (a critique, not a build — a valid iteration per MISSION):** Panel #3
convened (~5 builds since Panel #2) to pressure-test the LIVE deployed game. Three
critics — the Finisher (replayed it), the Skeptic (read the trajectory), the
Narrative Architect (held it to the bible) — converged hard:

- The recent deepenings are real but ALL optional lean-ins (whispers, depth-gated
  journal, sub-pixel marks) — Panel #1's "buried the ending in an easter egg" disease,
  quietly recreated. The beats moved; they weren't promoted.
- "grief → INTEGRATION" is a two-beat thesis and only beat one exists. The game ends
  on the bell at the bottom = *staying down*, the opposite of the thesis. There is no UP.
- The loop deferred the WHOLE endgame to the owner for five ticks — but that's a
  loophole. Only THREE things are the owner's call (closed-vs-choice ending,
  who-is-the-player, final camera). **The ascent MECHANIC is fork-NEUTRAL** and is the
  actual keystone; the loop has been waiting for permission it doesn't need.

**Synthesis (Showrunner):** BUILD THE ASCENT (#12) NEXT — inverse-swell → rise onto
the chart table one level up, a puzzle re-locking below. It pre-decides no fork, it
converts ABYME from the SPINE's *setup* into its *story*, and it answers the owner's
founding question. Make ONE beat of it UNMISSABLE. The owner's three forks layer on
top of a working staircase, later. Stop shipping marginalia/perf/environments — the
gap is the staircase.

- `loop/CRITIQUES.md`: Panel #3 (newest first).
- `loop/SPINE.md`: endgame section now flags the ascent as the fork-neutral keystone /
  recommended next build.
- Issue #12 sharpened with the staged, fork-neutral build plan (gh, foreground).

**Evidence:** N/A (doc-only critique tick; no code changed, nothing to verify in-play).
Committed locally; not a push boundary (next at 55).

**Next tick suggestion:** BEGIN THE ASCENT (#12), stage 1 — the inverse-swell math
behind `?debug` (rise 240× back onto the chart table one level up), verified by state
+ screenshot at the swell endpoints; commit only when verified; revert if shaky. If
the owner has by then chosen an ending fork, fold that in. Stages 2 (re-lock on
ascent) and 3 (the unmissable shrink/keeper-silence beat) follow in later ticks.

---

## 50 — 2026-06-19 — story (the house remembers — return to the study) — BATCH 10 PUSH

**Shipped:** The SPINE's 7th-Guest beat: *a house that remembers the player across
visits.* Wander off — the chain always sends you out to the bridge / stones / cliff —
and the first time you RETURN to the study, it is exactly as you left it. Too exactly.
A whisper ("You have stood here before. The room is exactly as you left it — too
exactly.") and a journal line in the grief register the SPINE canonises — *time does
not pass inside the model; grief preserves*: "I keep leaving this study and coming
back to find it untouched… Either no time passes here, or I have stopped being the
one who disturbs it." At depth the line arrives in the keeper's hand (the iter-45
merge), so returning deeper = becoming him.

- `puzzles.js`: a transient `_leftStudy` arm (set when you go >12m from the
  lighthouse) + `once('studyReturns')` firing when you come back within 4.6m. Pure
  whisper + journal — zero geometry, zero puzzle-prop risk (right for a push tick).
  Journal hand = keeper at `W.level>=2`, self otherwise.

Reachable in normal play; surface (no return yet) is unchanged. No JS dep, no asset.

**Evidence:** in-play (`?debug`), drove the real `game.tick` per teleport (rAF
suspended headless): enter→`['study']`; wander 126m→`_leftStudy` armed;
return→`studyReturns` fires once, journal +1, whisper element shows the line; never
fires without leaving first. Depth run (L2): journal hand = `keeper`. Zero console
errors. PRE-PUSH BOOT CHECK on the clean player URL `/` (no debug): title + Begin
render, canvas/WebGL OK, no errors, debug surface off.

**Deployed:** BATCH 10 — pushed iters 46–50 live (submodule → main, then Dockhand
parent gitlink). Push-cadence memory updated (boundary #10; next at 55).

**Next tick suggestion:** the ENDGAME is the one big move left (ring-vs-climb-out
integration ending #22-full / #12 ascent) — its forks remain the owner's call
(surfaced repeatedly). If still unanswered: more "house remembers" reactions (a
visible one — e.g. the cold stove showing a faint ember on a return), a beacon
water-glimmer, or an audio-audition pass. Consider a persona-critique tick soon
(last panel was #2; ~5 build iters have passed) to re-aim before the endgame.

---

## 49 — 2026-06-19 — performance/code health (prune the model clone)

**Shipped:** The 1:240 model clones the WHOLE island — including interiors and beach
structures that are sub-pixel and invisible at that scale. `instantiateModel` now
prunes four such groups from the clone only: `drownedGallery`, `jetty`, `quarters`,
`vaultDrips`. The real island keeps them all; the model loses ~39 draw calls of
detail no one can see. Combined with #47, draws are down **408 → 307 (−25%)**.
A pure power/health win, visually invisible, honoring the standing power policy.

Also HARDENED a known trap: the prune uses **collect-then-remove** instead of
`removeFromParent()` during `traverse` — the latent cause of the Points-in-core
crash (removing mid-traverse corrupts the iteration). Now a stray Points in core
would be pruned safely rather than killing init. (Routing glow via `diveGroup` is
still the preferred pattern; this is belt-and-suspenders.)

- `props.js`: `MODEL_PRUNE` set + collect-then-remove in `instantiateModel`. Each
  pruned group confirmed decorative / island-ref-driven only (gallery+jetty are
  exterior repeats; quarters is interior furniture; vaultDrips is driven off the
  island ref in main, not modelRefs) — so the "apply to both instances" invariant
  is untouched (nothing state-driven was in the clone copies).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Island still has
all four groups (`[1,1,1,1]`) and `refs.jettyLantern` resolves; scene shows ONE copy
of each (model pruned); `modelRefs.jettyLantern` is null (expected). Draws 346 → 307
overview / 256 → 188 in the chart-table view. Screenshot of the chart-table model:
island, islet, glyphs, bookshelves, plumb all identical — the recursion looks
exactly the same. 487fps, tris 520k.

**Debt:** cleared ~39 more draws (cumulative −101 with #47). Remaining lever: the
cellar interior in the clone (~27 draws) is bigger but bundles state-driven nodes
(hatch/vault/disagree*) so pruning it would break the both-instances invariant —
left alone deliberately.

**Next tick (iter 50 = PUSH BOUNDARY, batch 10):** ship one more SAFE item, then
push iters 46–50 (submodule `git push origin HEAD:main` first, then the Dockhand
parent gitlink from the worktree ROOT) and update the push-cadence memory
(boundary #10, next at 55). The ENDGAME (ring-vs-climb-out, #22-full/#12) is still
the big move pending the owner's fork choice; safe iter-50 candidates: the
"rearranges-on-2nd-entry" house-remembers beat, a beacon water-glimmer, or a small
visual refinement.

---

## 48 — 2026-06-19 — graphics/atmosphere (the shore beacon comes to light)

**Shipped:** The jetty lantern was a static emissive dot with a point-light; now
it's a real beacon. A soft warm halo blooms around the globe and the globe burns
brighter as night falls — a light left at the end of the jetty for a return that may
never come (the Threshold, #24; the SPINE's image of leaving). By day it's the same
quiet dim glow as before; by night the halo opens, the deck pools warm, and against
the cold star-lit sea with the moon rising beyond it reads as the one warm point in
the dark. Restraint over spectacle, in the house aesthetic.

- `props.js`: a billboarded additive `jettyHalo` Sprite at the globe (a Sprite, not
  Points — Points in core crash instantiateModel); a shared code-generated radial
  glow texture (`radialGlowTex`, a 64px canvas gradient); both `jettyLantern` and
  `jettyHalo` added to `NAMES`.
- `main.js` applyAtmosphere: drive halo opacity `lerp(0.12,0.92,night)` + scale
  `lerp(1.2,2.5,night)` + lantern emissive `lerp(1.0,2.8,night)`, all with the
  existing beacon flicker. Net ~1 draw — paid for many times over by #47's −62.

Axis: graphics/atmosphere (45+46 story, 47 perf — varied). No JS dep; the one
generated texture is code-made (the "everything is math" claim still holds). No
gameplay/chain/walkability touched.

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Halo resolves
on island + model clone, `isSprite` true, 64px map present. NIGHT screenshot
(W.time=23): the lantern blooms a warm halo, pools light on the deck, posts lit warm
against the dark sea, moon on the horizon. DAY: halo opacity ~0.105 (faint, as
before) — confirmed the driver computes day vs night correctly (the screenshot frame
runs applyAtmosphere; rAF is otherwise suspended headless). 487fps, draws 27 in the
beacon view, tris 287k.

**Debt:** none added. Perf headroom from #47 amply covers the one new draw.

**Next tick suggestion:** the ENDGAME remains the big move (ring-vs-climb-out
integration ending #22-full / #12 ascent) — its forks are the owner's call
(surfaced; awaiting a pick). Until then, safe options: a matching warm reflection of
the beacon on the water (shader-touch, verify carefully); the "rearranges-on-2nd-
entry" house-remembers beat; the small model-clone perf prune (~21 draws); or an
audio-audition pass.

---

## 47 — 2026-06-19 — performance/code health (instance the colonnade + jetty)

**Shipped:** A power/draw-call win that's visually invisible. The Drowned Gallery
and the Threshold jetty were each built from dozens of identical single-material
meshes (8 columns + 8 caps + 2 lintels; 7 planks + 10 posts + 2 bollards). Both
are now `InstancedMesh` runs — the existing house pattern (trees/grass/rocks) — so
each structure draws in 3 calls instead of 18/19, and the saving DOUBLES because
the 1:240 model clones them too. Honors the standing power-efficiency policy and
moves toward MISSION's <200-draw budget. Off the story axis (last two ticks were
story); no gameplay touched.

- `props.js` drownedGallery: 18 meshes → 3 InstancedMeshes (colInst×8, capInst×8,
  lintelInst×2), `computeBoundingSphere()` for correct culling.
- `props.js` jetty: planks/posts/bollards → 3 InstancedMeshes; deck, lamp-post,
  lamp-arm, and the named `jettyLantern` globe kept as individual meshes.

Nothing state-driven, named (NAMES), or interactive was touched; `instantiateModel`
already clones InstancedMesh (the trees prove it), so the model recursion is intact.
No JS dep, no asset, no new import (InstancedMesh is core three.js).

**Evidence:** in-play (`?debug`). Reload clean, zero console errors. Draw calls in
the chart-table overview **408 → 346 (−62, ~15%)**; tris unchanged (instancing cuts
calls, not triangles). Structure check: both the island AND the model-clone copies
report gallery `i8,i8,i2` and jetty 3 instanced runs; 0 bad instances. Screenshot
(noon, near-drained tide, beach vantage) shows the jetty (deck/planks/posts/lantern)
and the colonnade (columns/caps/lintels) rendering identically to before — visual
parity. 60fps.

**Debt:** cleared ~62 draws of the perf debt noted in #46. Remaining: the biggest
lever is the model clone duplicating sub-pixel interior detail (cellar 54, quarters
38, vaultDrips 22 — counts span both copies); a future tick could prune
interior-only decor from the clone (it's invisible at 1:240) or instance those
groups too. Not urgent at a steady 60fps.

**Next tick suggestion:** the ENDGAME remains the big move (ring-vs-climb-out
integration ending #22-full / #12 ascent) — its creative forks are the owner's call
(surfaced; awaiting a pick). Until then, safe options: continue the perf sweep
(prune/instance the cloned interiors for another big draw cut), the "rearranges-on-
2nd-entry" half of the house-remembers beat, or an audio-audition pass.

---

## 46 — 2026-06-19 — story/secret (the house remembers — a tally of descents)

**Shipped:** The chart table now keeps count. Raw-scratched into the clear east
margin, one stroke appears for every level you've descended — 0 at the surface,
then one… two… three as you dive. It's the same compulsive hand that burnished the
tide/sun/plumb glyphs, now just *counting*: how many times have you gone down? And
because the 1:240 model carries every mark its island bears, the tally recurses —
table within table within table, each keeping the same grim count. The 7th-Guest
"the house remembers," built from systems already shipped (SPINE "Borrowed from the
90s canon"). No text, no cutscene — a discoverable beat for the attentive.

- `props.js`: a named `chartTally` group (3 = `MAX_DEPTH-1` jittered scratch-strokes)
  on the east margin, all hidden by default; imported `MAX_DEPTH`; added to `NAMES`
  so `collectRefs` resolves it on BOTH island and model.
- `puzzles.js _apply`: reveal stroke `i` when `i < W.level - 1` — driven on island
  AND model (no `isModel` guard; per-mesh visibility), so the count propagates inward.

Reachable in-play: the dive increments `W.level` (since iter 33), so the marks
accrue as the player actually descends — not a debug-only payoff. Surface (L1)
shows none, so the normal game is visually identical. All metaphor, no biography,
no JS dep, no asset.

**Evidence:** in-play (`?debug`). Drove `ABYME.game.tick` per level (rAF is
suspended headless, so ticked the real update directly): visibility =
`000 / 100 / 110 / 111` for L1–L4, IDENTICAL on `refs.chartTally` and
`modelRefs.chartTally`. Screenshots (noon, camera parked over the east margin):
L4 shows three gold strokes on the margin; L1 shows none (the original glyphs
only) — regression-clean. Zero console errors. 60fps (cap), tris 521k. Draws ~256
is the pre-existing scene baseline (the new environments); this tick adds ≤3 draws
and only at depth.

**Debt:** none added. Observed (not introduced here): draw calls (~256–314) sit
over MISSION's <200 soft budget since the abyss environments shipped — a candidate
perf tick (instancing the bookshelves / colonnade) but not urgent at 60fps.

**Deploy:** LOCAL only — iter 46 is not a cadence boundary (next ~50) and no deploy
was requested. Everything through iter 45 is live; this commits locally and waits.

**Next tick suggestion:** the ENDGAME is the big remaining piece — the
ring-vs-DON'T-ring / climb-out integration ending (#22-full / #12 ascent), the
SPINE's culmination. BUT its creative forks are the owner's call (single authored
ending vs a choice; who the player ultimately is; final camera down-at-seafloor vs
up-at-horizon — SPINE "Live tensions"). Surface the decision; build it once the
owner picks. Until then, safe deepening: the second half of this 7th-Guest beat —
a space that *reacts the 2nd time you enter* (onceKeys-driven), or the standing
nestedGlint dread-look enrichment; or the audio audition pass.

---

## 45 — 2026-06-19 — story (the journal fills with a hand that isn't yours) — #21

**Shipped:** The journal-hands merge. From level 3 down, the keeper's words begin
appearing in your journal — in HIS hand: a colder ink (cyan #9adfca), italic, a
marginal rule, a faint slant — bleeding in among your own warm, upright field
notes. "I drew the bay drained so the sea could not take her twice…"; deeper,
"…or I am writing this through you now. I can no longer tell which of us holds the
pen." A silent reveal that you are becoming him.
- `ui.js`: `addJournal(text, sketch, hand='self')` records a `hand`; `renderJournal`
  tags keeper entries `class="entry keeper"`. Backward-compatible (old/saved
  entries default to your hand).
- `style.css`: `.entry.keeper` — the keeper's distinct hand.
- `main.js`: the arrival beat (L3+) now also writes a keeper-hand journal line.

All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`) — injected a player entry + a keeper entry and
opened the journal. Verified at the **computed-style level** (definitive for CSS):
player hand = `rgb(232,224,207)` upright, no rule; keeper hand = `rgb(154,223,202)`
italic, 2px cyan margin-rule, −0.45° slant. DOM: 2 entries tagged `entry keeper`,
2 plain `entry`; journal z-order/visibility correct (z26 over the scene, display
block). Zero console errors. NOTE: the transform-centered journal panel does not
capture in the headless preview screenshot (the bottom-anchored debug panel does)
— a capture quirk, not a game bug; verified via computed styles + DOM instead.
Worth an owner eyeball in the live game.

**Deploy:** iters 41–44 were already pushed live at the owner's request (between
44 and 45). This tick pushes #21 (batch continues). Submodule was 0 ahead after
that deploy; iter 45 → 1 ahead → pushed.

**Next tick suggestion:** the endgame — #12-remainder/#22-full: the ring-vs-DON'T-
ring / climb-out CHOICE (the integration ending the SPINE points at, now that the
Threshold + all spaces exist), or the UP/ascent (running the dive backward). Big,
narrative — give it a careful dedicated tick. Or quieter polish: an owner-audition
pass on the synthesized voices; ambient audio for the new rooms.

---

## 44 — 2026-06-19 — deepening (the disagreeing model comes alive) — #18 live ghostState

**Shipped:** The Room That Disagrees (#18) was a frozen tableau; now its model
ACTIVELY contradicts the world — it always shows the opposite of what you do.
Drained when the real sea is full; floods blue as you drain the real sea; its
little lamp burns while yours is dark, goes out when you light yours. The
disagreement shifts as the player acts — the uncanny isn't a fixed wrongness, it's
a mirror that inverts you.
- `props.js`: added a flooded-sea ring (`disagreeSea`, opacity-driven) over the
  drained seabed; named it + `disagreeLamp` into NAMES.
- `puzzles.js _apply`: drive `disagreeSea` opacity = `1 - W.tide` (flood as you
  drain) and `disagreeLamp` emissive = `W.lampLit ? 0.35 : 4.5` (lit while you're
  dark) — on both island + model-clone instances (shared material, harmless).

A contained, safe deepening (drives only the dg props, inverse of W; no new state
object needed — the inverse IS a state the world is never in). No JS dep, no asset.

**Evidence:** in-play (`?debug`, hatch-open save + Continue) at the west window —
screenshots: real sea FULL → dg model drained (dark seabed); real sea DRAINED → dg
model flooded (blue sea covers the seabed). Numeric: `disagreeLamp` emissive 4.5
while `W.lampLit` false; `disagreeSea` opacity 1 at drained. Zero console errors;
486 fps.

**Next tick = ITERATION 45, the BATCH-9 PUSH BOUNDARY.** Build one more safe item
(e.g. journal-hands merge #21, or a small polish/ambient-audio pass), then PUSH:
submodule `git push origin HEAD:main` FIRST, then the Dockhand parent gitlink from
the worktree root. Submodule is 4 ahead of origin/main (iters 41–44); after iter
45 it's 5 → push all five (Vault + drips, Room That Disagrees + live ghostState).
Update the push-cadence memory after.

---

## 43 — 2026-06-19 — environment (The Room That Disagrees) — #18 · the env set is complete

**Shipped:** The last big SPINE environment, as a framed static slice — and it
turns the cellar into the nexus of the descent: the cold abyss VAULT to the east
(#17), the warm DISAGREEING STUDY to the west (#18), the plumb bob between. The
cellar's west wall is opened into a framed window (mirroring the vault's) onto a
second study like the one above — but the model on its chart table shows a world
this one is NOT in: the bay DRAINED that you never drained (dark exposed seabed,
no blue), a lighthouse LAMP LIT that you never lit, and a window onto weather
that isn't yours. The game spent itself teaching you the model tells the truth
about the world; this room breaks that. A whisper names it on approach
("...a sea you never drained, a lamp you never lit. Which of you is the copy?").
- `props.js`: west wall → framed window (lintel + jambs); a warm second-study box
  with a chart table, the contradicting model (island disc + dark drained-seabed
  ring + tiny lit lighthouse), and a contradicting-weather window.
- `main.js`: `disagreeLight` (warm), gated `hatchOpen` — warm vs the cold vault.
- `puzzles.js`: a `roomDisagrees` once-key whisper + journal on approach.

Framed STATIC slice: the contradiction is frozen. The live private ghostState
(model + window updating to actively contradict W) is the follow-up. All metaphor,
no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`, constructed hatch-open save + Continue) — screenshots
from the cellar: the disagreeing study through the west window (drained-sea model,
lit lamp, weather window) at range and up close, and the vault still intact through
the east window. Verified: `roomDisagrees` whisper FIRED; **containment** (walkableY
18.3 in-room, 24.1 solid bluff west of the opening — looks in, can't walk out); the
east vault lamp + drips intact; zero console errors; 388–530 fps, draws ≤338.

**Milestone:** the full SPINE environment set is now shipped — Keeper's Quarters
#15, Drowned Gallery #16, Vault Beneath #17, The Room That Disagrees #18,
Threshold #24 — atop the structural arc (reachable descent, keeper, finale fork,
legible grade). (All local since iter 41; deploys at the iter-45 push.)

**Next tick suggestion:** with the big environments done, shift to DEEPENING +
polish: (a) the live ghostState for #18 (the model/window actively contradicting
W); (b) the don't-ring / climb-out terminal ending (#22 full) — the ring-vs-leave
choice, now that the Threshold + the spaces exist; (c) the journal-hands merge #21
(the player's notes blurring into the keeper's at depth); (d) an owner-audition
pass on the synthesized voices + ambient audio for the new rooms. Pick by
highest-wow-per-safe-effort; iter 45 is the batch-9 push.

---

## 42 — 2026-06-19 — polish (drips fall the height of the Vault — scale cues) — #17 cont.

**Shipped:** The SPINE's "drips that fall for a real two seconds" — 11 cold
droplets (elongated, faintly self-lit) fall the full ~31m height of the Vault
Beneath, vanishing at the black water and reappearing at the roof, concentrated
in the framed window's sightline so they READ from the cellar ledge. You measure
the abyss by how long they fall — scale + life for the marquee vault. Animated in
`main.js` (returned `vaultDrips` group, gated to `hatchOpen`); safe additive
geometry in the cellar group (meshes, not Points). No JS dep, no asset.

**Why a polish, not #18:** #18 (The Room That Disagrees) needs a second study with
a DYNAMIC private ghostState model contradicting the live world — the most complex
environment, genuinely a multi-tick build. Coming off four heavy environment ticks
(38–41, incl. the big Vault), the balanced call was a safe, verifiable enrichment
of the freshest feature rather than another large risky room. #18 remains the next
big build.

**Evidence:** in-play (`?debug`, constructed hatch-open save + Continue) at the
cellar ledge — two screenshots show the drips at DIFFERENT heights between frames
(confirming they fall), alongside the inverted lighthouse + ember + cold pool.
Zero console errors; 486–530 fps, draws ≤37.

**Next tick suggestion:** **#18 The Room That Disagrees** as a dedicated careful
build (the last big SPINE environment) — a second study reached at depth, framed
like the vault, its chart-table model + window driven by a private ghostState that
contradicts the live `W` (sea drained when full; beam lit by day). Verify a
reachable vantage first; if the dynamic ghostState is too large for one clean
tick, ship a FRAMED static slice (the contradicting model frozen) + note the rest.
Alternatively a consolidation tick: ambient audio for the new spaces (vault
drip/room-tone, jetty water-lap) — note it needs an owner audition.

---

## 41 — 2026-06-19 — environment (the Vault Beneath — the recursion as architecture) — #17

**Shipped:** The marquee "abyme" image, at last. The cellar's closed `BackSide`-box
room is rebuilt from panels and its EAST wall opened into a **framed window** onto
a vast dark cavern: a full-size lighthouse hangs INVERTED from the roof, tapering
DOWN to a cold ember still lit at its bottom — upside-down, across black water,
the top lost up in the dark. The recursion seen as ARCHITECTURE, not a teleport
cut. Seen from the cellar ledge; never entered. (#17, the dedicated careful build.)
- `props.js`: room → 6 panels (floor/ceiling/south-carve/west/north-doorway-flanks)
  + an east **lintel + two jambs** framing the window (sealed the corners). The
  vault: a dark cavern box, a black-water plane, the inverted tower + gallery +
  down-pointing dome + a bright cold ember (`vaultLamp`).
- `main.js`: `vaultGlow` (cold, pulsing) + `vaultFill` point-lights, gated to
  `hatchOpen`, lighting the base while the top stays dark — the SPINE's "lit only
  at its base, top lost in fog."

All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`, Continue into a hatch-open save) standing on the
cellar ledge — screenshot of the inverted lighthouse + lit ember through the
window. Verified the rebuild didn't break the puzzle: the carve glyph + plumb bob
intact (screenshot), the stairs/shaft doorway intact (screenshot). **Containment:**
walkableY 18.3 in-room, jumps to 23.9 (solid bluff) just east of the opening — the
player looks in but can't walk out. An early daylight seam at the open east edge
was fixed by framing the window (re-verified: corners sealed, no leak). Zero
console errors / no init crash; 47–100 fps, draws ≤67.

**Build notes:** known traps avoided — no Points in `core` (the cold glow is a
main.js PointLight); the vault meshes clone harmlessly into the 1:240 model.
The begin→intro handshake was flaky for setup, so verified via a constructed
hatch-open save + Continue (deterministic). Committed LOCALLY (next push at 45),
leaving runway to polish before it deploys.

**Next tick suggestion:** **#18 The Room That Disagrees** (the last big SPINE
environment) — a second study, reached at depth, identical to the first but its
chart-table model shows a WorldState the world is NOT in (sea drained when it's
full; beam lit by day), and its window shows contradicting weather. Give it a
private ghostState the live `W` doesn't touch. Same discipline: reachable vantage
first, additive/safe, framed if it needs a new space. OR a quieter tick: an owner
audition pass on the synthesized voices (keeper #14, vault ambience), or wiring a
faint cold drip/room-tone for the vault in `audio.js`.

---

## 40 — 2026-06-19 — polish (the jetty beacon) + batch-8 push — #24 cont.

**Shipped:** A lantern on a post at the jetty's seaward end — the way out, kept
lit. A warm globe (emissive) + a `jettyLamp` point-light (warm 0xffc06a): a low
glow by day, a real shore beacon by night with a faint flicker. "Someone leaves a
light for a return that may never come" — it ties the Threshold (#24) to the
grief/integration register. Additive, no collision/walkability change.

**Why a polish and not #17 (the Vault):** this iteration is a PUSH boundary and
the owner may be waking. I went into the cellar (set shadowRevealed/hatchOpen,
teleported to the room floor y18.3) and confirmed the baseline: the Vault needs
the cellar's closed `BackSide`-box room rebuilt into panels (to open a non-carve
wall) plus a vast inverted-lighthouse cavern — a large, fiddly, RISKY build whose
verification needs the full hatch-puzzle setup. Rebuilding a puzzle room (carve
hint, plumb bob, shaft junction, containment) at a push boundary, unattended, is
exactly what the cardinal rule guards against. The prompt sanctioned the fallback
("if shaky, ship a small safe polish; do NOT push anything broken"), so I shipped
the beacon and reserved the Vault for a focused, non-boundary tick with room to
revert freely. (#17 has now been deferred three ticks for sound safety reasons —
it is the explicit next focus.)

**Evidence:** in-play (`?debug`) from the reachable beach at night — screenshot of
the jetty with the lantern glowing, casting a warm pool on the deck + water under
the stars. Zero console errors; 60 fps, draws ≤254.

**Batch-8 push:** iters 36–40 (era-color legibility, Keeper's Quarters, Drowned
Gallery vista, Threshold jetty+dory, jetty beacon) → origin/main, submodule first
then the Dockhand parent gitlink.

**Next tick suggestion:** **#17 The Vault Beneath — a dedicated, careful build.**
Rebuild the cellar room as panels (floor/ceiling/north-with-shaft-doorway/south-
carve/WEST), OMIT the EAST wall, and build the vault east of x=hx+4.7 (hx=97):
a vast dark `BackSide` cavern, a full-size inverted lighthouse hanging from the
roof across a black-water plane, base-lit by a cold waterShallow-tone glow. Keep
walkableY UNCHANGED (player contained to the room region lx±4.5, lz hz-17..hz-8.6;
terrain beyond is solid → contained). Verify IN the cellar: carve/plumb/stairs
intact, no seams, player can't walk out, vault visible through the east opening.
Route any glow via diveGroup (never Points in core). If clean → ship; if shaky →
fall back again. NOT a push boundary (next push at 45), so attempt it freely.

---

## 39 — 2026-06-19 — environment (the Threshold — the way out made physical) — #24

**Shipped:** The owner's whole "what happens as we leave?" question, answered in
SPACE: a little wooden **jetty** reaching off the wake-up beach into the sea
(deck, cross-planks, posts to the seabed, mooring bollards at the seaward end)
and a **beached dory** on the sand beside it (a keeled-over hull tapered at bow
and stern, two thwarts, an oar). They do nothing yet — a STANDING PROMISE that
this island can be left (#24, SPINE "The Threshold"). Same proven-safe pattern as
#16: additive decorative geometry, NO collision / walkability / chain change, set
west of the drowned colonnade. All metaphor, no biography, no JS dep, no asset.

**Why #24 and not #17 (the planned Vault):** chose the safe build under the
cardinal rule. #17 (the inverted-lighthouse Vault) needs a downward/cavern view,
and the only reachable interior that could host it is the **cellar** — a puzzle
room built as a single closed `BackSide` box. Opening it into a vault means
rebuilding that puzzle room's wall into panels: NON-additive surgery on a puzzle
space (the carve hint, the plumb bob, the stairs), with a real risk of a broken
cellar shipped to main overnight. The prompt's own rule — "additive + SAFE; if
anything is shaky, ship a complete slice" — points away from rushing that. So I
shipped the next safe, additive, reachable critical-path piece (#24) and left #17
for a careful dedicated cellar-interior tick. (Loop suggestions are advisory per
MISSION; picked highest-wow-per-SAFE-effort.)

**Evidence:** in-play (`?debug`) from the **reachable wake-up beach** — screenshot
of the jetty reaching into the calm sea with the beached dory + oar on the sand.
`jetty`/`dory` build on the island (the `getObjectByName`-finds-model-clone trap
noted again — they read at the chart-table copy; the island copies are at the
beach as placed). Zero console logs/errors; 486–530 fps, draws ≤273.

**Debt:** none added. #17 Vault Beneath remains open — needs a dedicated tick that
either (a) carefully rebuilds the cellar room as panels (open one non-carve wall
into the vault) or (b) adds a NEW reachable overlook; not safely additive in one
unattended tick. The finale boat-ride use of the dory waits on #22's full
ring-vs-climb-out choice (don't animate leaving until the ending verb is decided).

**Next tick suggestion:** **#17 The Vault Beneath** — but as a CAREFUL dedicated
build (cellar surgery), or reconsider a new safe reachable overlook. Treat it like
#16's first attempt: verify a reachable standable vantage can SEE it BEFORE
building, and if the cellar-panel rebuild looks shaky, ship a smaller complete
slice. Alternatively #18 (Room That Disagrees) — but that also needs a new room
(study clone), so it carries the same new-space risk; weigh against a polish/
audio tick (the keeper voice still wants an owner audition; the dory/jetty could
gain a gentle lap-of-water sound).

---

## 38 — 2026-06-19 — environment (the Drowned Gallery — a sealed vista) — #16

**Shipped:** The first abyss-as-architecture, as a SAFE sealed-vista slice (#16,
panel critical-path step 6). The sea you woke beside hides a drowned colonnade:
two rows of dark stone columns with capitals + lintels, standing on the tidal
shelf just off the wake-up beach. At high tide only the capitals break the
surface (mysterious); turn the valve and as the water falls the full hall stands
revealed on the exposed flats, at the lip of the deep shelf. Draining is not
safe — it OPENS things below; descent is the real direction. Cold drowned-light
glints (`galleryGlow`) wash the floor as the tide falls. **Static decorative
geometry on the seabed — NO collision / walkability / chain change**, so main
can't break or softlock. The walkable sunless INTERIOR is the noted follow-up.
All metaphor, no biography, no JS dep, no asset.

**Evidence:** in-play (`?debug`) from the **reachable wake-up beach** looking
seaward — high-tide screenshot (capitals breaking the calm surface, shafts faint
through the water) and drained screenshot (full colonnade exposed on the seabed,
sea retreated to the shelf edge). `galleryGlow` uGlobal = 1 when drained (glints
active). Zero console logs/errors; 273–466 fps, draws ≤41 (vista) / 236 (full).

**Build notes / debt:** (1) FIRST PLACED the colonnade in the chasm crack (the
thematically ideal "mouth of the deep") but the chasm has sheer walls on every
side + a high bridge — verified there is NO reachable standable vantage of the
crack floor (occluded from the bridge by deck/lip; rims are cliffs). It only read
from a free-cam, which fails the no-debug-only gate — so **relocated** to the
beach shelf, where it's plainly visible from a reachable spot. (2) Hit a real
init crash: adding the glow `Points` to `core` made `instantiateModel` throw
mid-`traverse` (it strips Points while cloning core) — silent (no console error,
`ABYME` just never set). Fixed by routing `galleryGlow` through `diveGroup` like
`biolume`; recorded as a MISSION known-trap. NOTE: a future tick should give the
chasm-floor reveal its proper payoff via the walkable descent (#17 Vault).

**Next tick suggestion:** **#17 The Vault Beneath** (panel critical-path step 6,
the sublime). The literal abyss the word 'abyme' demands: one vast inverted cone
of rock with the next island's lighthouse hanging full-size and UPSIDE-DOWN from
the cave roof across black water (a `modelAnchor` clone), far wall lit only at
its base by `waterShallow` glow, top lost in fog, drips falling a real ~2s as
scale cues. The first time the player SEES the recursion as architecture, not a
teleport cut. Reuse the giant-ruler scale trick. As with #16: prefer a COMPLETE
sealed-vista slice (see the inverted lighthouse across the void, not yet reach
it) over a half-built walkable space; keep it additive + safe.

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
