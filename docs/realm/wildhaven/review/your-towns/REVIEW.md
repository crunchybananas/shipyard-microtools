# Your towns and compact HUD review

Save library and research allocation implementation, 2026-10-14.

- Named towns with New, Continue, Rename, Duplicate, and Download; one card per home or local companion.
- The library wraps the existing atomic companion-pair journal. It never rewrites or removes original `wildhaven.v1` through `v4` or companion records. Migration, new saves, and selection use one atomic library record and the existing origin-wide Web Lock.
- Duplicate copies all gameplay progress but assigns a fresh co-op identity, clears partnership/delivery authority, and retains earned storehouse capacity. Local offers remain with the original pair.
- Failures (invalid data, quota, unavailable storage, and stale writers) leave stored towns intact. New-game controls create another town instead of replacing one.
- Research uses 0/25/50/100 percent of newly produced materials needed by the current stage. Default 25 percent for new projects; older manual projects remain at zero. Pausing stops collection, full stages stop drawing supplies, and cancellation returns current-stage materials. Existing stock can be supplied explicitly with Fund now.
- Resource HUD shows the project, percentage, and funding/work status. The desktop dock is 420 by 44 CSS pixels (previously up to 900 by 56); touch targets stay 44 pixels. Clock has pause/resume and one 1x/3x switch. More holds saves, trade, journal, and co-op.

Design: retain the game's paper, fern, and harbor colors (#edf0e3, #345e50, #b7c69b, #81aaa3, #a97958), Georgia town names, and system UI controls. Maps show the actual saved building positions. No additional library or framework.

## Evidence

- 452 Node tests passed before placement integration, including 18 new persistence/allocation tests.
- Background MCP review at 1280x720, 1024x768, and 390x844. Created and duplicated a new town; switched to the copy and reloaded; verified the remembered selection.
- On a separate test origin, installed a prepared legacy companion pair, migrated both names and saves, set a 100 percent research allocation, funded stage one, resumed work, and observed automatic knowledge delivery in stage two. Duplicated the developed town; browser-audit.json shows equal gameplay state in the copy and `legacyUnchanged: true`.
- This used prepared fixtures, not a fresh campaign or the user's real saves. No desktop screen control, production account changes, or native simulator use.
- Found and fixed hidden overflow-menu labels caused by older CSS specificity. Local module-loading resets were resolved by using the repository's high-backlog preview server.
