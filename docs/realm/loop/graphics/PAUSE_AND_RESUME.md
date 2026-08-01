# Realm Graphics Pause And Resume Playbook

Date paused: 2026-08-01

Live checkpoint: Realm `184`

Production checkpoint commit: `c28a5affff7a1fd0386dbd74dada3183588125ca`

This is the canonical restart document for Realm graphics work. Read this file
before `CURRENT.md` when the owner asks to resume the art push. The graphics
track is deliberately paused while work returns to gameplay, responsive UX,
movement, and general cleanup.

## Durable Renderer Decision

- The live game stays on a two-dimensional plane.
- Painted raster atlases drawn through Canvas2D are the production image
  authority. WebGL2 is used only for fullscreen post-processing; it is not a
  3D scene or a second world renderer.
- The former WebGL/Three.js-style diorama path was an experiment. Its live
  renderer, toggle, input mapping, and critic path were removed in graphics
  round 002. Historical journal and render-layer notes are evidence, not an
  active implementation.
- Do not revive Three.js, SVG actor/building fallbacks, procedural building
  line art, runtime skeletal deformation, or a second live renderer as part of
  ordinary cleanup.
- A future GPU renderer is only reconsidered after the Canvas2D renderer is a
  pure presentation consumer and a feature-equivalent benchmark shows a
  measured win without a visual regression.

## What Is Live At The Pause

- The production actor atlas contains `224` accepted rows and `0` candidates.
- Nine role families use the modular production system: guard, farmer,
  lumber, builder, blacksmith, miner, stonecutter, fisher, and settler.
- Each complete family owns `16` action/direction rows and `128` frames.
- A6 cargo owns baked payload alignment for those nine roles across nine
  resources and four directions.
- A14 settler is the newest family. Its ordinary-world and live carry tests
  prove that the production game—not a query-gated preview—uses the promoted
  rows.
- Remaining older actor families are rancher, trader, innkeeper, scholar, and
  forager. A15 rancher is the single restart target.

## The Production Process We Used

### 1. Choose one complete family

Replace one role across `idle`, `walk`, `work`, and `carry`, in all four
directions. Do not promote a mixture of old and new rows for that role. Define
the identity, clothing, role equipment, palette, handedness, target body
height, root, ground row, and runtime scale before generating motion.

### 2. Author reusable source authorities

Image generation supplies source material, not finished runtime atlases.
Create separate boards for:

- identity/body parts;
- hollow garment parts;
- directional role equipment;
- any workstation or role-specific prop.

Use a flat `#ff00ff` chroma background, no floor or shadow, and generous
separation. Preserve the original generated file, the keyed file, the
transparent derivative, and a prompt/provenance JSON companion under
`assets/sprites/prototypes/actor-pose/references/<family>-source/`.

The prompt companion must record the full prompt, generator/source identity,
reference roles, chroma-removal settings, crop boxes, and SHA-256 hashes. A
future compiler must be able to reject an altered source rather than silently
accepting it.

Visually inspect transparency before motion work. Garment face, neck, cuff,
and waist openings must be truly transparent; dark paint inside a supposed
opening is a source defect. A14's opaque hood cavity was caught in its first
compiled contact sheet and became a strict regression test.

### 3. Declare a family contract

Create `assets/sprites/prototypes/actor-pose/source/<family>/parts.json`.
The contract binds source hashes, crops, landmarks, sockets, palette, target
scale, action cadence, directions, and output locations. Treat it as source
authority, not a loose configuration file.

Use these fixed runtime row constraints unless a later architecture decision
explicitly replaces them:

- one row is `512x84` RGBA;
- eight chronological `64x84` cells;
- nonblank, distinct motion frames;
- consistent identity, costume, palette, handedness, and ground anchor;
- target body around `76px` for the current modular families;
- root/ground row `79`, with rows `80–83` clear;
- deterministic `27x35`, `35x46`, `54x70`, and `64x84` runtime tiers;
- binary runtime alpha and no smoothing at integer display scale.

### 4. Compile motion deterministically

Add a family compiler under `scripts/actor-pose-prototype/` and a strict,
independent verifier beside it. The compiler should compose source parts from
semantic joints, landmarks, sockets, and explicit far/body/near occlusion,
then emit flattened review rows. Do not animate by scaling whole frames, draw
live bones, or mirror a final row when equipment handedness would flip.

The output must include review contacts and machine-readable evidence for
body, identity, garment, equipment, semantics, landmarks, quality, palette,
and every runtime tier. Two clean builds must be byte-identical.

A14 is the current concrete example:

```sh
python3 scripts/actor-pose-prototype/a14_settler_actions.py --verify
python3 scripts/actor-pose-prototype/verify_a14_settler_actions.py
node scripts/verify-a14-settler-actions.mjs
```

### 5. Review the family as motion and at gameplay scale

Inspect the exact `1x` row, enlarged contact sheets, animated action
transitions, all directions, contribution planes, and the `27x35` gameplay
sample. Reject identity drift, palette flicker, body-scale pumping, foot/root
drift, loose fragments, clipping, changing handedness, duplicate frames, and
work motion that does not communicate the profession.

Tools may legitimately widen a frame. Tool reach never excuses body-scale,
palette, or ground-anchor drift. Prefer zero warnings and do not use waivers to
force a milestone through.

### 6. Stage all rows, then promote atomically

Stage generated rows through `scripts/sprite-row`; never copy directly into a
compiled role sheet or atlas. Staging runs row-local and cross-direction
quality checks and keeps candidates out of ordinary gameplay.

Example for one A14 row:

```sh
scripts/sprite-row stage \
  --role settler --action idle --dir down \
  --input assets/sprites/prototypes/actor-pose/output/a14-settler-actions/rows/wayfarer/hearth-indigo/idle-down.png \
  --provenance a14-modular-settler-actions
```

Repeat for all 16 rows, re-stage after peer directions exist so family checks
see the complete set, then promote in one manifest transaction:

```sh
scripts/sprite-row promote-family \
  --role settler \
  --note "Promote the complete A14 modular settler family."
```

Accepted production rows are content-addressed and SHA-256 locked. Compiled
role sheets copy accepted rows over the inherited base, including transparent
pixels, so deleted legacy pixels cannot bleed through.

### 7. Rebuild and prove the real game

Rebuild the motion atlases, run source/frame/gait/direction audits, and add a
role-specific browser vertical slice. The vertical slice must prove every
action and direction, normal production atlas selection, ordinary URLs with no
preview requests, and at least one actual in-world actor at gameplay scale.

For the A14 checkpoint:

```sh
scripts/sprite-row verify
node scripts/build-motion-atlases.mjs
node scripts/verify-settler-vertical-slice.mjs
node scripts/verify-guard-cargo-browser.mjs
node scripts/verify-actor-row-candidate-browser.mjs
node scripts/verify-realm.mjs
```

`verify-realm.mjs` is the release gate; Realm 184 passed all `47` checks.
When runtime files change, bump the canonical module revision once with
`node scripts/runtime-revision.mjs --write <next>` and update intentional
revision sentinels. Never hand-edit cache-query revisions across the graph.

### 8. Publish only a complete checkpoint

Commit generated sources, prompt provenance, contracts, compiler, verifier,
proofs, promoted rows, manifests, compiled sheets, atlases, runtime revision,
and the round handoff together. Rebase onto the latest `origin/main`, rerun the
relevant focused gates, push to `main`, wait for Pages and CodeQL, and confirm
the public Realm HTML serves the new module revision.

## Resume Checklist

When graphics resumes:

1. Read this file, `LOOP.md`, `CURRENT.md`, and the newest round handoff.
2. Confirm the current live revision and production/candidate counts; do not
   assume Realm is still at 184.
3. Confirm the owner still wants A15 rancher. If gameplay work changed actor
   scale, snapshots, cargo, navigation, or renderer ownership, reconcile those
   contracts first.
4. Generate one rancher identity/garment/equipment source set and review its
   transparency before compiling motion.
5. Complete, stage, and atomically promote all 16 rows; never leave a partial
   production family.
6. Add a rancher browser vertical slice and the next numbered graphics round.
7. Run the full release gate and inspect the live deployed game.

## Work Deliberately Left For Later

- A15 rancher, then trader, innkeeper, scholar, and forager.
- Dedicated painted service-walker art.
- Building upgrade and construction-state paintings.
- Dedicated wall junction variants and terrain/building grounding.
- UI icon crop polish and world-art source discipline.

Do not restart this queue merely because a gameplay cleanup touches
`render.js`. Resume only when the owner explicitly returns to production art.
