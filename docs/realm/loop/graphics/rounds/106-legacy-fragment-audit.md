# Round 106: Legacy Fragment Audit

## Goal

Audit the current actor sprite sources for random detached parts and get a broad
cleanup pass into place without returning to a single mixed actor atlas.

## Changes

- Added `scripts/paint-cohesive-legacy-actors.mjs`, a repeatable audit-guided
  raster repaint pass for old derived actor rows with separated hands, feet,
  hair plumes, and loose props.
- Repainted 28 legacy role/action blocks across 11 per-role actor sheets:
  - farmer walk
  - fisher carry/walk/work
  - forager carry/walk/work
  - guard walk
  - innkeeper carry/walk/work
  - miner carry/walk
  - rancher carry/walk/work
  - scholar carry/walk/work
  - settler carry/walk/work
  - stonecutter carry/walk/work
  - trader carry/walk/work
- Kept newer role-specific bitmap work intact for lumber, miner, builder,
  blacksmith, farmer work, and guard work/carry.
- Tuned the generated base rows after the first proof:
  - front/back rows now alternate left/right foot weight twice across the
    eight-frame strip instead of shuffling in place.
  - side rows now use a wider contact stride so they do not read as one moving
    foot.
- Added `scripts/scrub-work-row-particles.mjs`, narrowed to the accepted
  lumber work cleanup only. A broader miner/farmer/guard particle scrub was
  proofed and rejected because miner side work scored worse after fragment
  removal.
- Rebuilt `assets/sprites/actors-atlas.png` and `assets/sprites/ambient-atlas.png`.

## Proofs

- `tmp/realm-graphics-round-106/cohesive-legacy-proof.png`
- `tmp/realm-graphics-round-106/work-particle-scrub-proof.png`
- `scripts/screenshots/sprite-audit-worst-rows.png`
- `scripts/screenshots/walk-gait-audit-worst-rows.png`

## Results

- The old separated-limb rows dropped out of the top continuity/artifact audit.
- The top continuity audit is now dominated by deliberate work/tool animation
  rows: lumber chopping, miner pick swings, guard spear work, and farmer hoeing.
- `lumber/work/up` improved from `121.1` to `115.4`.
- `lumber/work/down` improved from `107.6` to `99.7`.
- The new broad base side-walk rows sit around `16.6-16.8` in the gait audit
  after the stride tuning, no longer near the old `120+` artifact failures.

## Rejected

- A first cohesive repaint pass fixed fragments but made front/back gait too
  neutral. It was kept only after the footfall timing and boot-weight pass.
- A miner/farmer/guard particle scrub removed small pixels safely in the proof
  but worsened miner side-work audit scores from `94.5` to `152.6`, so miner
  and farmer were restored from the pre-scrub cohesive backups.

## Verification

- `node --check scripts/paint-cohesive-legacy-actors.mjs`
- `node --check scripts/scrub-work-row-particles.mjs`
- `node scripts/build-motion-atlases.mjs`
- `node scripts/verify-sprite-source-contract.mjs`
- `node scripts/audit-sprite-frames.mjs`
- `node scripts/audit-walk-gait.mjs`
- `env REALM_PORT=4923 node scripts/verify-anim.mjs`
- `env REALM_PORT=4922 node scripts/verify-logic.mjs`
- `env REALM_PORT=4921 node scripts/verify.mjs --game --logic`
- `env REALM_PORT=4924 node scripts/verify-critic.mjs`

## Next

Treat the clean cohesive rows as an artifact quarantine, not final style. The
best next pass is a dedicated imagegen repaint of the remaining high-score work
rows in one role sheet at a time, starting with miner work side/up and lumber
work up/down if the chopping debris still reads noisy in live play.
