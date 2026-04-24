# audio-surfaces.md

**Status:** Written in tick 112. Updated 113, 115, 123.
Sibling to `narrative-surfaces.md` (075). Maintained by
subsequent audio ticks.
**Sources:** 106 opened the axis (nightmare sound cue in
new loop protocol); 111 added requiem bell-toll and
established the NARRATIVE_BEATS dispatch-loop pattern for
tag-specific sound fires. 112 captured the design
philosophy + 2-cue catalog. 113 shipped stone chime (3rd
cue). 115 shipped founders three-note minor-triad —
**first use of the-composer challenge added by tick 114's
expansion**. 121 migrated first-snow into NARRATIVE_BEATS
and surfaced a flag-vs-tag problem in Pattern 2's tag-
specific branch. **123 refactored Pattern 2 to a per-entry
`onFire` string field** — tag-branch no longer needed; any
NARRATIVE_BEATS entry with `onFire: 'soundName'` plays
that sound on fire. Pattern 1 count: 3 (nightmare, stone,
founders); Pattern 2 count: 1 (requiem); first-snow/
constellation/stone-weathers now unblocked for Pattern 2
audio since tags are no longer distinguishing.

## why this exists

Before 106, the new loop protocol had not touched audio
in 105 ticks. The OLD 3-agent loop (pre-001, see
`archive/LOOPS.md` around loops 81-120) had extensively
developed build/voice/music SFX in `js/audio.js`, but no
beat-specific cues existed for the narrative systems that
039/043/056/072/079/088/093/097/103 built.

106 + 111 opened a new category: **beat-tagged sound
cues** — one-shot audio tied to specific chronicle
events. This doc is the spec for that category so
future audio-ticks don't re-derive the shape.

## design philosophy (from 106 + 111)

1. **Silent by default.** Beats have always been prose-
   first. Audio adds a second channel but doesn't
   replace; a player reading the chronicle should still
   get the full beat.

2. **Miss-able.** Gain is deliberately low (≤0.10 peak).
   A player absorbed in the UI might not consciously
   hear the cue, which fits "rarest moment" philosophy —
   the sound IS the beat's weight, not its announcement.

3. **Once-per-realm.** Every cue so far is tied to a
   beat that fires at most once per realm's lifetime.
   This is the right scale: audio-every-dawn would
   saturate; audio-once feels earned.

4. **Distinct acoustic fingerprints.** Each cue is
   sonically non-overlapping with every other. If you
   heard ONLY the audio (no chronicle), you'd know
   which beat fired.

5. **No UI indicator that audio exists.** The only way
   to discover the cues is to play and listen. This is
   intentional — if the game told you "nightmare will
   play a sound," the sound becomes an expectation.
   Undiscovered beats keep their surprise.

## current catalog (6 cues — closes original 106 list)

### `nightmare` — loop 106

**Trigger:** `checkNightmareBeat` at story.js fires; the
nightmare_fired flag transitions false→true exactly once
per realm.

**Sound design:** 64 Hz + 68 Hz triangle waves (minor-
second interval producing 4 Hz beating/tremolo), plus a
384 Hz sine overtone at +150ms offset. Long attack 0.5s
(sneaks in), long decay 2.2s (lingers). Gain 0.10 peak.

**Affect:** dissonant, unstable, ominous. "Something
is wrong but you can't quite locate it."

**Code:** `js/audio.js` switch case, plus late-bound
import + fire in `story.js:checkNightmareBeat` (mirrors
the existing `_NIGHTMARE_NOTIFY` pattern).

### `requiem` — loop 111

**Trigger:** `realm_fell` NARRATIVE_BEATS entry (added
by 103); fires when `G.population === 0 && G.day > 1`.
Fires inside the dispatch loop at
`story.js:checkStoryBeats` — tag-specific inline branch.

**Sound design:** 196 Hz + 392 Hz + 588 Hz sine waves
(G3 fundamental + G4 + D5 harmonic overtones — bell-like
partial profile, consonant). Short attack 0.02s (bell
strike), long decay 5.0s (rings away). Gain 0.08 peak.

**Affect:** clean, mournful, final. Single toll, not a
sequence — the realm is over, not mid-story.

**Code:** `js/audio.js` switch case, dispatch-loop
inline branch in `story.js:checkStoryBeats` using the
111-added `if (beat.tag === 'requiem')` check.

### `stone` — loop 113

**Trigger:** `checkStoneBeat` at story.js fires; the
`stone_found` flag transitions false→true exactly once
per realm (seeded day [30, 200], dawn-only gate).

**Sound design:** ascending perfect fifth — 659 Hz (E5)
+ 988 Hz (B5, at +80ms) + 1976 Hz (B6 shimmer overtone,
at +120ms). All pure sine waves. Short attack 0.01s
(chime struck). Mid decay 1.3-1.5s. Gain 0.07 peak.

**Affect:** bright, consonant, discovery-coded. "A thing
was found that was not placed." Contrasts both prior
cues: warmer than nightmare's dissonance, higher than
requiem's low bell.

**Code:** `js/audio.js` switch case, Pattern 1 fire at
the end of `story.js:checkStoneBeat` (dedicated check-
function).

### `founders` — loop 115

**Trigger:** `checkFounderBeat` at story.js fires; the
`founders_named` flag transitions false→true exactly once
per realm (seeded day [3,6], dawn-only).

**Sound design:** three ascending sine notes forming a
C minor triad — C5 (523 Hz), E♭5 (622 Hz), G5 (784 Hz) —
spaced 0.25s apart for ~0.75s total phrase. Each note
has a soft attack (0.05s) and ~0.9-1.1s decay. Gain 0.06.

**Affect:** ceremonial, slow, three-beat structure. One
note per founder slot. The minor-third + perfect-fifth
interval set is solemn but not mournful — a "three
settlers arrive, name each other" moment.

**Code:** `js/audio.js` switch case, Pattern 1 fire at
the end of `story.js:checkFounderBeat`. First cue added
under the `the-composer` challenge slot (tick-114
expansion).

### `first-snow` — loop 124

**Trigger:** `first_snow_seen` NARRATIVE_BEATS entry
(table-dispatched, post-121 migration). Tag: milestone.
Fires once per realm when `G.season === 'winter' &&
G.day >= 10`.

**Sound design:** two overlapping high-frequency noise
bursts (8 kHz + 6 kHz cut), staggered 150ms apart; plus
a single high sine at 1568 Hz (G6) for a distant-bell
overtone. Duration ~0.9s primary + 0.7s secondary burst.
Gain 0.04 peak — quietest cue yet. Noise-based texture
(vs all prior tonal cues) reads as "snow landing."

**Affect:** whispering, nearly-subliminal. The sound is
"felt more than heard" — fits the "miss-able" invariant
strongly. Distinct from every prior cue: first noise-
based entry breaks the pure-sine pattern deliberately.

**Code:** `js/audio.js` switch case, Pattern 2 via
`onFire: 'first-snow'` field on the NARRATIVE_BEATS
entry (first new cue shipped under the 123 refactor —
validates `onFire` in practice).

### `offering` — loop 125

**Trigger:** `checkOfferingBeat` at story.js fires;
`offering_made` flag once-per-realm when stone + happy-
peak + 15% probability intersect (079 original design).
Tag: stone.

**Sound design:** minor→major resolution chord. D4 (293
Hz) sustained throughout. F4 (minor 3rd, 349 Hz) fires
briefly at t, decaying as F#4 (major 3rd, 370 Hz) and
A4 (perfect 5th, 440 Hz) arrive at t+0.3s. The ear
perceives "minor → major lift" within 0.3s. Pure sines;
gain 0.05 (between stone's 0.07 and first-snow's 0.04).
Duration ~1.8s total.

**Affect:** lifting, resolving. Sibling to 106
nightmare's dissonance — same minor-interval opening,
but resolves to major instead of beating into unease.
"A quiet offering received; the weight lifts."

**Code:** `js/audio.js` switch case, Pattern 1 fire at
the end of `story.js:checkOfferingBeat` (dedicated
check-function). **Closes the original 106-filed audio
cue list** — all 6 cues (nightmare/requiem/stone/
founders/first-snow/offering) now shipped.

## acoustic contrast

Nightmare and requiem are deliberately opposite on every
axis — the realm's two "rarest" beats should sound as
different as possible:

| Axis | nightmare (106) | requiem (111) | stone (113) | founders (115) | first-snow (124) | offering (125) |
| --- | --- | --- | --- | --- | --- | --- |
| Wave | triangle | sine | sine | sine | **noise + sine** | sine |
| Root | 64 Hz (C2) | 196 Hz (G3) | 659 Hz (E5) | 523 Hz (C5) | 8 kHz cut + 1568 Hz sine | 293 Hz (D4) |
| Interval | minor-2nd dissonant | harmonic consonant | perfect-5th ascending | minor triad ascending | non-tonal texture | **minor→major resolution** |
| Structure | sustained chord | single toll | quick chime | 3-note sequence | overlapping bursts | chord morph |
| Beating | 4 Hz tremolo | none | none | none | none | brief clash then lift |
| Attack | 0.5s (sneaks in) | 0.02s (bell strike) | 0.01s (chime struck) | 0.05s soft | 0s (noise-gate) | 0.03s |
| Decay | 2.2s | 5.0s | 1.3s | 0.9-1.1s per note | 0.9s | 1.5-1.8s |
| Character | unstable, buzzy | clean, mournful | bright, discovery | ceremonial, solemn | whispering, barely-heard | lifting, resolving |
| Gain peak | 0.10 | 0.08 | 0.07 | 0.06 | 0.04 | 0.05 |

If future cues land, document their coordinates on this
grid so each stays perceptually distinct.

## integration patterns

### Pattern 1: dedicated check-function (nightmare)

106 used this for `checkNightmareBeat`. Import is late-
bound at module load, local `_PLAY_SOUND` variable holds
the reference, try/catch guards the call site.

```js
let _PLAY_SOUND = null;
import('./audio.js').then(m => { _PLAY_SOUND = m.playSound; }).catch(() => {});

// inside checkNightmareBeat, after chronicle():
try {
  if (_PLAY_SOUND) _PLAY_SOUND('nightmare');
} catch (_e) {}
```

Use when: the beat already has a dedicated function (043
nightmare, 056 stone, 072 founders, 079 offering).

### Pattern 2: NARRATIVE_BEATS `onFire` field (requiem, 111 + 123)

111 shipped this as an inline `beat.tag === 'requiem'`
branch. 123 generalized to a per-entry `onFire` string field
when first-snow + constellation + stone-weathers all needed
audio but shared the `milestone`/`stone` tags with other
beats. The tag-based branch couldn't distinguish.

Current shape (post-123):

```js
{ flag: 'realm_fell', tag: 'requiem', onFire: 'requiem',
  trigger: ..., text: ... },

// Dispatch loop:
for (const beat of NARRATIVE_BEATS) {
  if (!hasFlag(beat.flag) && beat.trigger(G)) {
    setFlag(beat.flag);
    chronicle(text, beat.tag);
    if (beat.onFire) {
      try { if (_PLAY_SOUND) _PLAY_SOUND(beat.onFire); } catch (_e) {}
    }
  }
}
```

Use when: the beat lives in NARRATIVE_BEATS. Entry gets a
1-word-string `onFire` field; entries without it fire silently
(backward compatible).

### Historical: "When to refactor to onFire" — triggered at 123

Earlier versions of this doc said "wait until the 3rd tag-
branch lands." 123 is when that landed. Pattern 2 is now
the `onFire` field shape (no longer inline-branch). Future
audio cues for NARRATIVE_BEATS entries just add an `onFire`.

## invariants

These are rules established by the 2-cue catalog; subsequent
audio ticks should respect them:

- **Every cue is once-per-realm.** Recurring audio (every
  raid, every season) belongs to a different category
  (the existing pre-loop SFX for build/produce/combat).
- **Every cue has `gain ≤ 0.10`.** Loud cues disrupt
  the "miss-able" philosophy.
- **Every cue is short (< 6s total).** No musical
  phrases; these are events, not cues for state-change
  tracks.
- **No cue has a UI indicator.** No toast saying "sound
  played." No settings entry unless mute-all is needed.
- **Late-bound `_PLAY_SOUND` import or direct
  `playSound` import — consistent per-file.** story.js
  uses late-bound (load-order defensive); other files
  can import directly if their load order is stable.
- **Try/catch around every `_PLAY_SOUND` call.** Chronicle
  is the contract. Audio is garnish. If audio throws,
  the beat still records.
- **No audio cue in `checkStoryBeats` outside the
  dispatch loop.** Inline beats (happiness, first-snow)
  deliberately have no audio yet; if one gets audio, add
  it to the same tag-dispatch pattern once it can be
  migrated to NARRATIVE_BEATS.

## open ideas (as of 112)

- ~~**Stone chime**~~ (106 + 111 filed) — **DONE → 113**:
  ascending fifth E5→B5 + B6 shimmer overtone, short
  attack, mid decay. Pattern 1 via `checkStoneBeat`.
- ~~**Founders-named phrase**~~ (106 filed) — **DONE → 115**:
  3-note C-minor-triad ascending (523/622/784 Hz), 0.25s
  pacing. Pattern 1 via `checkFounderBeat`. Syllable-count-
  hash variant not shipped; kept constant phrase.
- ~~**Offering chord**~~ (106 filed) — **DONE → 125**:
  minor→major resolution chord on D root; sibling to
  106 nightmare dissonance but resolves instead of
  beating. Pattern 1 via `checkOfferingBeat`. Closes
  original 106-filed cue list.
- ~~**First-snow shimmer**~~ (106 filed) — **DONE → 124**:
  8 kHz + 6 kHz noise bursts + 1568 Hz sine overtone.
  Pattern 2 via `onFire: 'first-snow'` on the 121-
  migrated entry. First audio cue to use 123's onFire
  refactor.
- **Per-kingdom bell-pitch variation** (111 filed): hash
  kingdom name to pick requiem fundamental from a minor-
  scale set (A2, D3, G3, B♭3, …). 5 lines in the
  requiem case. Sonic fingerprint per realm.
- **Nightmare-approach cue** (064 + 106 filed): softer,
  less-decayed version of 106's nightmare chord, fires
  on the 10 days before nightmare-day. Pattern 1.
- **Live-audition review** (106 + 111 filed): verify on
  real speakers (not chrome-mcp suspended context) that
  gain/timbre land. Possibly tune down.

## related loop references

- **106** — opened the audio axis in the new loop
  protocol with the nightmare sound cue. First audio
  tick since loop-001 began.
- **111** — requiem bell-toll. Established Pattern 2
  (dispatch-loop tag branch). Defined acoustic-contrast
  invariant.
- **112** — this doc's first version.
- **113** — stone chime. 3rd cue; 2nd Pattern 1 usage
  (alongside nightmare). Pattern 2 count stays at 1, so
  no `onFire` callback refactor pressure per 112's
  threshold. Contrast table extended to 3 columns.
- **115** — founders minor-triad phrase. 4th cue; 3rd
  Pattern 1 usage. **First cue shipped under the tick-
  114 expanded challenge pool (`the-composer`).**
  Contrast table extended to 4 columns; added
  `Structure` row (first multi-note cue).
- **121** — first-snow migrated to NARRATIVE_BEATS.
  Surfaced Pattern 2 flag-vs-tag distinguishability
  problem — blocked further audio cues for table-
  dispatched beats.
- **123** — Pattern 2 refactored to `onFire: 'name'`
  field. Inline `beat.tag === 'requiem'` branch
  replaced; requiem entry gains `onFire: 'requiem'`
  field. Pattern 1 usage stays at 3. Future
  NARRATIVE_BEATS audio cues just add `onFire`;
  unblocks first-snow/constellation/stone-weathers.
  Refactor-only — zero user-visible change.
- **124** — first-snow shimmer. 5th cue; **first audio
  to ship under 123's `onFire` refactor**. First non-
  tonal cue (noise-based) — breaks pure-sine pattern.
  Acoustic-contrast table gets a 5th column; adds
  "noise + sine" wave type, non-tonal texture,
  whispering character. Validates the refactor in
  practice.
- **125** — offering resolution chord. 6th cue;
  **closes the original 106-filed audio cue list
  entirely**. Sibling to nightmare (same D-root minor
  opening) but resolves to major within 0.3s. Pattern
  1 via checkOfferingBeat. All 6 original cues shipped:
  nightmare / requiem / stone / founders / first-snow /
  offering — spanning sub-bass dissonance to mid-
  register resolution.

## how to update this doc

When a new audio cue ships:
1. Add entry to `current catalog` with trigger, design,
   affect, code-location.
2. Add row to `acoustic contrast` table.
3. Document integration pattern if new.
4. Mark any open-idea closed.
5. Extend related-loops.
