# Wildhaven worktree reconciliation — 8 October 2026

Cory requested that Wildhaven be on main with intended worktree changes synchronized. This reconciles the unmerged first-bread PR153 with released PR159, sapling PR160, resources/seasons PR161 and defense PR162. It also preserves the original 43-file opening playthrough from the assessment checkout. Historical evidence remains labeled with its original revision; it is not current-release validation.

## Combined behavior

The optional Food-town goal carries the player from school and research to farm, mill, bakery and actual food output. Research marks the three bread discoveries; learned discoveries open their building plans. Staffing shortages link to the actual People row. The goal costs nothing and does not grant charter bonuses. Actual bakery output records a durable per-town milestone once.

Integration preserves the released objective checklist under Town ambition while following bread, then restores its normal position when the goal ends. Dates use the displayed calendar and rates use real minutes at 1×. Modern panel coordination, touch press protection, reading pause, resource details, seasons, sapling growth, coastal pressure and saved squads remain intact. Runtime graph is versioned `20261008-sync-1`.

## Verification

- All 365 Node tests pass, including migration, real-output proof, companion isolation, seasons, woodland and defense.
- All 35 runtime JavaScript modules parse; all 2,020 before/after archive checks pass.
- One serial isolated headless Chrome check uses the earlier genuinely earned bell save and a separately labeled priority-staged bakery checkpoint. Actual touch controls select the free goal, reveal its action and retained checklist, traverse the 15-node research graph, reach the exact workplace priority control, assign actual workers, resume real production, finish the goal and open a learned bakery plan without spending.
- Layout checks cover 1024×768, 768×1024, 667×375 and 390×844. Research clicks work after rotation without document overflow. Both ImageGen illustrations load; Stores → Food, calendar and Watch → Company links work. Zero application or failed-load errors.
- Independent read-only source review found no integration blocker.
- `worktree-sync-2026-10-08/` contains current harness, logs, unedited captures, checks and the 51-file runtime manifest. All four runtime GLBs, resource icons and panel illustrations are real assets, not LFS placeholders.

This is bounded integration verification, not a fresh end-to-end campaign or a claim of physical iPad/Safari perfection. The original longer bread journey is retained separately with its original provenance. No package installation, large build, desktop interaction, controller/network changes or unrelated project edits were performed.

## Visual library direction

Continue the established ImageGen panel library: warm, playful illustrations tied to each panel’s purpose; reuse shared images where appropriate, preserve generation provenance in ASSETS.md, and keep art compact or hidden on short landscape screens so it never displaces essential controls. The released pantry and defense illustrations are retained unchanged in this reconciliation.
