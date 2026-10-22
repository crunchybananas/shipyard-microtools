# The player walk — October 6, 2026

The whole game, played in order, judged by one question at every frame: *what does a
person think they are looking at?* Not "is the asset authored", not "does the gate pass":
what the picture says. Every frame below was captured from the running game at player
height (1440 × 900, the shipped renderer, real GPU) with `tools/harness/cdp.mjs`.
`before/` is the build this pass started from; `after/` is the same pose at the end.

## How the game reads, beat by beat

**Title.** A dark card, a single word. Reads as a quiet game. Fine.

**The approach.** Nineteen seconds over open sea to the beach. The sea surface and sky
are the only things on screen for eight of them, and the sea was separated from the sky
by a hard white bar at the horizon in every light: the far sea fogged to 100 % haze while
the sky above it only blended to 60 %, so the brightest thing in the frame was a ruler
line. Fixed in the sky shader (`uHorizonHaze` now full at the horizon, feathered a little
higher). `before/hall-and-horizon.jpg` → `after/hall-and-horizon.jpg`.

**The landing.** You wake on a pebble beach with two gulls, a net rack, the dory, and the
lighthouse up the slope. This is the strongest frame in the game and it held up: the
pebbles, the rack and the open boat all read as real things at hand scale. What did not:
ten metres offshore, four black boxes on stubs. A player reads them as a concrete pier
left in by mistake, not as "the capitals of a drowned hall" — nothing about them is old,
wet or stone. They are now weathered limestone with the shared mineral relief, lichen on
the dry tops and an algae band at the tide line that rides up with the breach at the third
stratum. `before/hall-and-horizon.jpg` → `after/hall-and-horizon.jpg`.

**The path up.** The whisper promises "a path leads up from the beach". There was no path
a player could see: the worn-turf mask ran at 22 % on the surface, which is invisible
foreshortened at eye height. It now starts at 42 % and still deepens with the strata.
`before/beach-path.jpg` → `after/beach-path.jpg`.

**The forest and the meadow.** The pines are the most "authored" thing on the island and
they read as trees from forty metres. Inside the stand, each bough is a flat green spray —
a player sees folded paper. Left as is (ART_DIRECTION calls it deliberate; a needle-card
pass is the next job). The meadow was one ochre carpet from the tower to the bluff; its
green and heather anchors only landed where the damp noise exceeded 0.86, so the
"patchwork" was a rumour. The green patch coverage was widened and a peat anchor joined
at the 25 m scale. `before/meadow.jpg` → `after/meadow.jpg`.

**The headland.** From the west, the lighthouse stood in a nest of marshmallows: every
rock on the island was one displaced icosphere, smooth and egg-shaped at every size, and
two landmark erratics sat in the tower's lap hiding its door. A player's eye went straight
to the eggs. A Blender boulder kit replaces them (`tools/blender/boulders.py`): fractured
blocks with bevelled weathered edges, a baked cavity term and a lighter tint on fresh
fracture faces, instanced into every existing position and collider. No erratic now lands
inside 16 m of the tower axis. `before/meadow.jpg` → `after/meadow.jpg` (the headland
from the meadow); the three stones alone are `boulders-kit.jpg`.

**The tower, outside.** Clean white render over coursed stone. It read as a toy because it
was *uniformly* white. It now carries rain streaks running down from the gallery, a damp
dark foot, and a windward salt bloom, all keyed on the shaft's own height.

**The study.** The chart table, the model, the brass wheel and the signal shelf read
exactly as intended: a working room. The wall behind them was one flat beige from floor to
joists, the biggest surface in the room with nothing on it. Limewash mottle at hand scale
and rising damp at the skirting now sit on it. `before/study.jpg` → `after/study.jpg`.

**The east room.** Looking up from the bed, the room had no ceiling — the cone roof's unlit
underside was a black pit — and a sliver of sky showed over the doorway, because the
annex wall's opening was 80° wide for a 2 m throat. The walls were bare coursed brick on
every side, like a cistern. It now has a boarded, joisted ceiling, a limewash liner with
trowel mottle, damp and scuffs back to brick behind the furniture, a closed roof valley,
and a 40° opening that matches the door. The pendant globe clipped to a white disc
(emissive 2.4) and is amber again at 1.35. `before/east-room.jpg` → `after/east-room.jpg`.

**The gallery at night.** The payoff of the 115-step climb was a white screen. Three
things stacked: the GLB rails and the lantern astragals were authored gold, the 220-
intensity lamp spill lit them from a metre away, and the beam volume's apex sat at the
camera. The bloom took the rest. Rails and cage are now painted iron (what a lantern is
made of), the spill fades out inside 8 m of the lamp, and the beam volume fades when the
eye is at its source. You can now stand up there and watch the beam sweep the island.
`before/gallery-night.jpg` → `after/gallery-night.jpg`.

**The grass at dawn and golden hour.** Every tuft read as a black twig against lit sand.
The blades take the meadow's up-normal for lighting, but their vertex colours ran
0.12–0.41 in luminance from a dark root, so at low sun they went to black while the sand
stayed bright. Root colour lifted to the meadow's own value. `before/beach-golden.jpg` →
`after/beach-golden.jpg`.

**The standing stones.** Read well in raking light: quarried granite, not brickwork.
Unchanged.

**The drained bay.** The valve's first consequence is the sea going down, and the floor it
exposed was painted as if it were still underwater: a dark teal shelf that read as a cliff
face, so the islet looked like a saucer hovering over the sea. The water's own shader owns
the underwater look; the floor is now wet mud-sand with a seabed-green below the lowest
tide. `before/drained-bay.jpg` → `after/drained-bay.jpg`, `before/causeway-drained.jpg` →
`after/causeway-drained.jpg`.

**The bluff, the chasm, the sea cliffs.** Every steep face was vertex colour stretched
over 2.4 m cells: diagonal bands like a dragged photograph, at every distance. Two
causes. The mineral height map that was meant to give rock faces their surface was
declared sRGB, so its 0.35–0.68 band was decoded to 0.10–0.42 and the multiply landed
within a few percent of 1.0; it is a height field and is now sampled linear. And the
per-vertex hue jitter that makes the meadow a patchwork becomes streaks on a 20 m wall;
on rock faces the hue is now pulled to one rock base per fragment while each vertex keeps
its value (the AO bake and the bedding). The cliffs read as granite at arm's length and
at the 170 m glyph-puzzle range. `before/east-bluff.jpg` → `after/east-bluff.jpg`,
`before/chasm-wall.jpg` → `after/chasm-wall.jpg`.

**The drain, the cellar, the western study.** Readable, dim, and honest about being
rooms. The vault ribs and basalt pick up the corrected mineral map. The cellar's flat
limewash is the next weakest interior but it is not a mess.

**The three strata.** The arrival stratum (green, raised water, kelp, the figure in the
coat) is the best-looking place in the game: the colour script works and the tide figure
reads as a person. The inspection stratum's grey is correctly oppressive; its one landmark
on the water, the bell-buoy, is a red block with a black fin — the smallest fix for the
largest gap and still open. The last winter strips the trees and that reads as loss, as it
should; the lower keeper at the model is a gesture, legible at its scale.

**The model on the table.** Looking down at the island from a hand's breadth away is the
game's thesis and it still lands: the sea, the stones, the lit tower, the hatch. The
boulder kit improved it twice over, since every stone appears at 1:240 too.

## Three.js tricks tried, kept and rejected

- **Kept:** sky/sea horizon fusion; per-material `onBeforeCompile` detail (limewash,
  plaster, tower weathering, cliff mineral) at +0 draws; camera-distance fades on the beam
  and the lamp spill (uniforms, not visibility flips); a linear colour space on the height
  map; shadow `normalBias` 0.5 → 0.12 so shadows meet their casters.
- **Measured and rejected:** a 4× MSAA half-float composer target. It gives the bloom
  hours the antialiasing daylight keeps, and it costs 84.8 ms against 19.6 ms at the night
  bench on an M4 — a four-times frame. Not shippable under the power policy. Daylight
  still renders direct with native MSAA.
- **Checked, not worth it:** AgX vs ACES tone mapping. Side-by-side at the beach and in
  the study, AgX reads flatter and greyer here; the ACES grade is part of the look.

## Where it still reads as "basic"

1. Close conifer boughs: flat sprays. A Blender needle-card pass on the four profiles.
2. The bell-buoy at the third stratum: a red block.
3. The cellar's limewash: flat; it wants the same mottle as the study.
4. The Watcher and Tide-Figure: untouched this pass, adequate.

## Validation

- `node --test test/*.test.mjs`: 116 / 116.
- Asset contract: 19 manifest rows, every file owned.
- Console clean on every capture in this folder.
- `bash tools/harness/run.sh`: four full runs. The first caught a real regression (the
  420-triangle boulder kit over the power ceiling) and the fixture below; the remaining
  three each passed every script up to a *different* timing-sensitive "rendered state"
  wait (reduced-motion stills, the chair hover, the controls hint's fade), which then
  passed when its script was run alone with margin. `gate-summary.txt` beside this report
  lists every script's result on the final code: all 25 have a passing run, the last full
  run holds the upstream-hand power ceiling (32 / 32), and no full run has yet completed
  end-to-end in one go on this machine. Treat the long run's timing waits as the next
  harness job, not as evidence against the frames.
- `tools/harness/encounters.mjs`: the shore-rock occlusion fixture stood the Watcher at a
  fixed coordinate one old egg-shaped rock happened to cover. It now searches for a stone
  that really blocks the eye-to-head ray, the way the canopy probe already did.
- The boulder kit's first cut was 402–420 triangles per stone and the release gate caught
  it: the upstream-hand peak frame went to 1,058k triangles against the 1,000k ceiling,
  because every instance is drawn twice (island + model) and there are ~300 of them. The
  old displaced icosphere was 180 faces, not the 320 its comment claimed, so the kit was
  regenerated at 180 — the same budget to the triangle — and the gate passes again. Nothing
  else in the pass adds a draw call or a light.


## Day two — October 7, 2026

The three things the walk left as "basic", in order, with frames in `day2/`.

**The conifer crowns.** The closed sprays read as folded green paper from anywhere
inside the stand, and the stand is on screen in half the frames of the game. Every bough
is now three crossed, alpha-tested card strips mapped to a drawn needle bough
(`day2/needle-card.png`), on the same skeleton: same positions, colliders, litter and
wind. The first cut was too sparse (fishbones), the second too bright and dense (lime
cabbages); the third darkens the card to the island's blue-green, thins the needles a
little and narrows the tilted cards so the horizontal bough layering shows with shade
between the whorls. Inside the stand a tree is now twig and needles with sky through it;
from the beach the ridge is a conifer skyline; at golden hour the boughs catch the low
sun in layers. Near crowns cost fewer triangles than the sprays did. The model crowns
keep the opaque lobes. `day2/before/forest.jpg` → `day2/after/forest.jpg`,
`day2/after/tree-close.jpg`, `day2/after/stand-golden.jpg`.

**The bell-buoy.** The inspection stratum's one landmark on the water was a red block
with a black fin. It is a channel buoy now: float, skirt and rubbing strake, a four-post
lattice tower with its braces, the bell under its cap, a dead lamp in a cage, and the
mooring chain going down into the dark, with rust bled down from every fitting. One draw.
`day2/before/bell-buoy.jpg` → `day2/after/bell-buoy.jpg`.

**The cellar and the drain.** One flat grey-green plane. The limewash now carries trowel
mottle at hand scale, water staining run down from the vault in streaks along the
courses, and a tide mark where the drowned years stood. `day2/before/drain-chamber.jpg`
→ `day2/after/drain-chamber.jpg`.

Also fixed on the way: the regard sightline treated a card's transparent texels as
solid, so a figure seen through the gap between two twigs would not have counted as
seen. It reads the card's coverage at the hit now.

**The title screen.** The first thing a player saw was a flat navy rectangle: behind the
card the renderer drew from the camera's default position, underground, behind an opaque
black curtain. The card is a window now. The camera holds at the approach's first frame,
riding the swell on the open sea at dawn with the islet and its stones low in the haze,
and the card only dims it enough to carry the type; Begin continues from exactly that
frame with no cut, and Continue closes the curtain for half a second so the jump to the
saved stance never shows through the fading card. Because a title can sit for minutes,
it idles cheaply: every crown at its far LOD for a camera 300 m out, the drawing buffer at
DPR 1, the chart-table clone hidden, and only every other tick rendered. Measured on the
M4 at DPR 1.5 the title's rendered frame is cheaper than standing on the beach, and it
renders half as often. `day2/before/title.jpg` → `day2/after/title.jpg`,
`day2/after/title-begin.jpg`.

**The trunks.** Per-trunk bark lightness ran to 0.6, and the lightest trunks beside the
new dark crowns read as bleached driftwood poles. The range is 0.33–0.48 now.

**Two species.** One drawn bough for all four silhouettes made the stand read as one
tree repeated. A second card draws a spruce bough — forty shorter twiglets hanging back
toward the root, stiffer blue-green needles — on the same routine, and each silhouette
names its card: the broad fir and the sapling wear the fir fan, the slim spruce and the
storm elder the spruce. Same card geometry, different material; the ridge from the beach
is now firs and spruces. `day2/needle-card-spruce.png`, `day2/after/path-midslope.jpg`.

**Grass distance cut.** A tuft is half a metre tall, under two pixels past 150 m, and the
island's nine grass chunks were drawn from everywhere. They switch off by distance from
the eye on the tree-LOD clock (never the model's, which sit a metre away on the table).
The title's sea view lost a fifth of its triangles; nothing visible changed.


## Day three — October 14, 2026

The three things day two left, with frames in `day3/`.

**The meadow.** Between the tall tufts (a four-and-a-half-thousand-tuft scatter over a
150 m disc, so each stood metres from the next) the ground read as suede, and it is the
largest surface in the game. More scatter would cost the whole island everywhere, so the
new turf (`js/turf.js`) is one instanced field that follows the camera: a dense ring of
five-blade tufts out to 10 m and a thinner, shorter ring of three-blade tufts out to 30 m
that cross-fades into it. Each square is snapped to its world grid and every tuft is owned
by a world cell, so the grass never swims as you walk. Height and colour come from the
terrain grid that `buildTerrain` now publishes (`TERRAIN_GRID`), so the blades stand on
the real surface in the ground's own meadow tone; density comes from how much of each
vertex the meadow colour owns, so turf stops where the ground turns to sand or rock. It is
bare under the conifers' needle litter, thin on the keeper's worn paths, clumped by a slow
noise, and never below the live waterline. Sparse drifts of sea thrift, tormentil and
eyebright sit in it, one colour per drift. Hidden on the title, in the dive, at the last
winter, indoors, up the stair and underground. `day3/before/meadow-low.jpg` →
`day3/after/meadow-low.jpg`.

**The clouds.** They were soft noise blobs, one grey smudge at every hour. They are
warped cumulus now, read from the baked noise tile the sea already used (three fetches,
cheaper than the old 16-hash noise): firm eroded edges, thick middles, one sun-side
sample for self-shadow so sunward flanks are bright and bellies dark, silver edges near
the sun, more cover low in the sky. Their light follows the sun: at dusk they dim and
redden instead of staying white paper on a dark sky. `day3/before/sky-noon.jpg` →
`day3/after/sky-noon.jpg`, `day3/after/sky-dusk.jpg`.

**The lighthouse on the title.** The title camera sits 330 m out at sea and the dawn fog
hid the main island entirely. The fog thins to half while the title holds and eases back
over the approach's first seconds, so the headland and its tower stand behind the islet
on the title and Begin has no visible step. `day3/before/title.jpg` →
`day3/after/title.jpg`.

**Gate.** All 25 scripts pass. `vault-outcrop.mjs` now waits for the slab's real ease
instead of a fixed 4.2 s of wall clock: dt is clamped per frame, so a loaded headless run
falls behind the clock and the slab was still easing when the test looked.

## Day four — October 21, 2026: the sound world

The walk had only looked. Listening to the same route, the island was mostly silent:
a footstep was one 90 ms puff of filtered noise in three flavours, every room had the
same dry air, the surf was a steady white hiss with no waves in it, and opening a book
made no sound at all. Everything below is still synthesized in the browser with Web
Audio. Nothing is downloaded, so it stays inside the asset contract and the power
budget: one-shots are a few short-lived nodes, and the two reverbs are fixed convolvers.

**Footsteps per surface** (`js/audio-kit.js`, picked by `surfaceAt` in `js/main.js`).
Each step is a heel and then a toe 35–60 ms later. The surfaces:
- **pebble:** a crunch of bright grains on a light thud. Used on the landing beach's
  shingle band.
- **sand:** a soft, dark compression.
- **grass:** a swish.
- **wood:** a hollow knock with a board resonance and an occasional creak. Used indoors,
  on the stair, the jetty and the bridges.
- **stone:** a hard click on a low thud. Used in the vaults and cellars.
- **iron:** a ringing click. Used on the lantern gallery.
- **water:** a splash that drops in pitch, with bubbles. Used when wading.

Steps alternate slightly left and right. `day4-sound/footsteps.m4a` plays all seven,
four steps each, in that order. `footsteps-spectrogram.jpg` shows them: tonal lines
for iron, a low knock for wood, a mid splash for water.

**Waves that break.** The sea already rendered a wave phase. The sound now finds the
open water nearest the player (`nearestSea`, refreshed twice a second). Each time the
crest peaks, a wave breaks there, panned to where it is. The break is a rising roar, a
foam hiss, then the retreat drawing back over stones. Its size follows distance, tide
and the swell set. The constant surf hiss is narrower and quieter, so steps on the
beach are not masked. `day4-sound/shore.m4a`.

**Rooms.** Two generated impulse responses: open air (3.2 s, bright, no early reflections) and a
room (1.6 s, with early reflections). Effects, music and the music bed all send into
whichever one fits. The mix crossfades to the room when you go indoors or underground.
The tower stair and the music box now have a tail. `day4-sound/tower.m4a`.

**Handling.** Distinct paper sounds for a book, a letter, a carved inscription and a
shelf; a page sound on each page turn; a softer close. Also a drawer in the record
cabinet, a glass chink at the reading glass, a rope creak climbing up and a hatch
creak climbing down. `day4-sound/handling.m4a`.

**Music.** The generative bed's melody notes are now struck bells (three partials, a
fast attack, a long decay) instead of plain swells, so the tune reads as notes over
the drone. `day4-sound/music-surface.m4a`, `music-winter.m4a`.

**Listening.** `day4-sound/sound-tour.m4a` (2:26) plays every sheet back to back.
Each sheet is the real `js/audio.js` rendered offline, lifted by one common +11 dB so
the balance between sheets matches the game and is audible on a phone speaker.

**The audio gate** (`tools/harness/audio.mjs`, in `run.sh`). Every other gate runs
muted, so nothing had proved the game is audible. The harness loads `js/audio.js` into
an OfflineAudioContext, plays scripted sheets of events at exact times, and measures
the output. It checks 12 things:
- every surface is audible and unclipped;
- pebble, sand and grass differ by more than 8% in spectral centroid, and so do wood,
  stone and iron;
- water is darker than pebble, and pebble is brighter than sand;
- where a shingle step lands on the beach, it stands more than 3 dB above the surf in
  the 1.5–6 kHz band. Every render is seeded, so the shore rendered with and without
  steps has an identical bed, and the difference is the steps alone. The first full gate
  run measured this at +2.1 dB, so beach steps were raised by 3 dB. It is now +5.4 dB;
- every handled object is audible;
- the shore is audible and has at least three discrete wave events;
- the tower has a reverb tail and stays unclipped indoors;
- both music beds are audible.

Result: **AUDIO 12 / 12**. Set `AUDIO_DIR` to write each sheet as a WAV. With the
audio stage added, the full gate passes all 26 scripts, including walk 69/69.
