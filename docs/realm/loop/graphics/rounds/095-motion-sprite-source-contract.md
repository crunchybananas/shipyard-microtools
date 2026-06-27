# 095 - motion-sprite-source-contract

## Goal

Make the one-file-per-sprite-type workflow enforceable so future sprite work
does not drift back to the retired single combined actor atlas technique.

## Changes

- Added `scripts/sprite-source-contract.mjs` as the shared motion-sprite
  contract:
  - one actor role source PNG per file in `assets/sprites/actors/`
  - one ambient prop source PNG per file in `assets/sprites/ambient/`
  - compiled `actors-atlas.png` and `ambient-atlas.png` are runtime artifacts
    only
- Added `scripts/verify-sprite-source-contract.mjs`.
  - Fails if actor or ambient source PNGs are missing.
  - Fails if unexpected extra PNGs appear in the actor/ambient source folders.
  - Fails if retired combined source filenames such as `actors.png` or
    `motion-atlas.png` appear in `assets/sprites/`.
  - Checks source and compiled-atlas dimensions.
- Updated `scripts/build-motion-atlases.mjs` to import the shared contract and
  enforce the exact source file set before compiling.
- Updated sprite source READMEs to state the rule at the point where future
  imagegen/packing work starts.

## Verification

Commands run:

```sh
node --check scripts/sprite-source-contract.mjs
node --check scripts/verify-sprite-source-contract.mjs
node --check scripts/build-motion-atlases.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/verify-sprite-source-contract.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/build-motion-atlases.mjs
env PATH=/opt/homebrew/bin:$PATH node scripts/verify-sprite-source-contract.mjs
```

## Workflow Rule

Future motion sprite rounds must edit exactly one source sheet or prop file at a
time, then rebuild the runtime atlas:

```sh
node scripts/verify-sprite-source-contract.mjs
node scripts/build-motion-atlases.mjs
node scripts/verify-sprite-source-contract.mjs
```

Do not generate a single actor atlas and ask imagegen or an agent to repair it
as a combined sheet. That file is too complex for reliable iteration and is no
longer an editable source.
