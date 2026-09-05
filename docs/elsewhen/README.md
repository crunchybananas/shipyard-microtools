# Elsewhen

An instrument you play alongside recordings of your past gestures. Leave a still hand on a bell, trace a moving phrase, make a twin, or reverse its direction. All hands share an eight-second clock. Their overlapping positions solve four authored studies; free time opens the whole instrument.

`docs/elsewhen/` is the canonical app. It uses plain HTML, CSS, Canvas 2D, and synthesized Web Audio. No dependencies, external fonts, servers, accounts, or uploaded data. Serve the repository's `docs/` directory and visit `/elsewhen/`.

## Play

- Touch a bell to ring it. Mouse, pen, touch, and keys 1–7 work.
- Choose **Leave a hand** (or Space while the instrument is focused), then hold a bell or draw through several. Release to finish; eight seconds finishes automatically.
- Each hand repeats the gesture and holds its final position for the rest of the loop. A backward hand reverses the recorded portion, then holds its starting position. Changing speed stretches the common clock.
- **Twin**, **Forward / Backward**, **+ Beat**, and **Rest / Wake** change the recorded hands. Undo restores the previous edit. The loop resets on edits so timing is reproducible.
- The four studies demonstrate simultaneous presence, a three-hand chord, an ordered moving memory, and meeting a reversed twin. All studies are directly accessible; completing one records a keepsake in the study navigation.
- The visitor is a temporary performance. Returning restores your own study and clock. Recording starts you back in your own study.

## Persistence and portability

Each study saves independently under `waggle-elsewhen-v1` in localStorage. Storage failures leave the instrument usable and show export guidance. Playback freezes while hidden; incomplete gestures are cancelled on interruption.

**Keep this moment** exports a printable SVG, a lossless `.elsewhen.json` recording, or a replay URL containing a compact resampling of the paths. Replay links do not contact a backend. Import validates versions, dimensions, path order, count, IDs, and finite numeric bounds before replacing a study. Undo restores the replaced recording. Six hands, 161 stored points per recorded hand, and an eight-second cycle bound the workload.

## Verification

From the repository root:

```sh
node scripts/verify-elsewhen.mjs
```

`--logic` runs only the deterministic engine checks. The full command also uses the repository's Playwright installation to complete all four studies through real pointer and keyboard input, verify persistence, editing, portability, error handling, and responsive touch behavior. `ELSEWHEN_EVIDENCE=/path/to/folder` saves desktop and mobile screenshots.

## Design

The working surface is a pale-blue porcelain instrument with a readable eight-second scale. The recorded curves are the drawing: no stock imagery, idle particle field, or generated scenery. Color identifies hands; dashed paths additionally identify reverse playback. Geometric bells and echo cursors are rendered from the same coordinates used for hit testing. Playback is the primary motion; reduced-motion mode removes the expanding sound ripples.

The first study exposes the mechanism immediately: put a memory on one bell and occupy the other yourself. The concluding study makes a single gesture meet its own reversed twin. The final artifact is both a musical performance and a printable record of the user's movements.
