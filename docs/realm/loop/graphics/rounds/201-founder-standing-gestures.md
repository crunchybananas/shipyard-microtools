# Founder standing gestures and sole correction

Date: 2026-09-04. The owner liked the walking foundation, noticed the toes
bending incorrectly, and asked for standing key poses such as pointing out work.
This extends the isolated workshop; runtime revision remains 198.

## Delivered

- Corrected both boots: a separate neutral reference per ankle and neutral toe
  rotation replace the tilted heel-contact reference and inherited toe roll.
- Take stock: 48 poses / 4 seconds, breathing and a quiet glance across the site.
- Work over there: 48 poses / 3.2 seconds, look, gather, indicate, hold, recover.
- Come with me: 48 poses / 3.2 seconds, eye contact and two invitation sweeps.
- All four clips render eight independent directions at three sizes: 4,032
  cells. Standing feet remain planted; the three standing clips share a ready
  pose and each closes its own loop.
- `founder-actions.blend` is the new editable scene, with named pose markers.
  The existing walk's hip/knee/ankle-position/upper-body curves and the original
  scene are preserved. The new file opens on the pointing indication pose.
- The workshop adds action selection, action-specific timing and named beats,
  matching downloads and 3D playback. Automatic turns wait for a gesture to
  finish. Scrubbing updates the preview immediately.
- `founder-actions.gif` shows the two new command gestures; the updated
  `eight-directions.gif` shows the corrected walking cycle.

## Export failure caught

Blender's imported actions contain separate slots for the rig and costume.
Picking the first slot initially selected an accessory, which produced static
witnesses and an extra suffixed walk clip. The importer and exporter now select
the slot containing `pose.bones` curves. Each clip's exported time inputs get
independent normalized accessors, so shared glTF inputs cannot couple timing.

Visual review also caught Three.js's inline `display: block` overriding the
3D canvas's `hidden` attribute. A scoped hidden rule now removes that layer
when returning to sprites, and the browser gate checks all three exit modes.

The saved scene is authoritative for rebuilds. The bootstrap gesture posing
code does not overwrite later saved edits. `install_actions.py` is a one-time
migration, not the routine rebuild command.

## Pointing arm review

The owner noticed a joint intersection while reviewing Work over there. Its
hand was aimed independently in world space and turned about 48° away from
the forearm during the hold. That folded the glove through the cuff. The
revised reach moves slightly outward, with wrist and hand following the
forearm. The saved Blender action stays within about 3.1° throughout the loop.
Only the four right-arm rotation channels were applied; the earlier scene is
preserved in `founder-actions-before-arm-repair.blend`. The browser/geometry
gate now rejects that wrist fold explicitly. Unaffected walk, idle and beckon
PNG maps are checked against the earlier output hashes.

## Validation

- Saved Blender -> GLB -> sprite rebuild.
- Independent pose witnesses for every sampled bone and action, closed loops,
  common ready pose, visible hand excursion and fixed standing feet.
- A sole regression check covers both ankle-to-toe drop and the toe's upward
  normal; blank/clipped/duplicate scans decode the actual sprite maps.
- All 168 scrub positions, named beats, eight angles per action, matching
  downloads, live 3D joint agreement, full-gesture automatic turns, reduced
  motion, 390px layout and the ordinary title-screen link.
- Existing focused walking gate; runtime module graph; production sprite
  provenance; Realm game and logic smoke.
- A clean second bake checks all PNGs and both GLBs byte-for-byte.

Commands and source credit are in `assets/sprites/founder/README.md`. Reports
and full-page visual proofs live under `tmp/founder-sprites/`. There was no
production actor migration, full release suite, commit, push or deployment.

Next review: judge gesture readability and choose the first gameplay trigger.
Pointing could acknowledge a new worksite; beckoning could gather a nearby
worker. Those triggers and walk-to-stand blending are not yet integrated.
