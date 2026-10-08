# Production construction feedback — 8 October 2026

Melissa reported that no builders started after placing construction despite available people. Current production was pinned to main `7ea91f3a67570526889d865e75c009d893d12779`, successful Pages run 37786991608, runtime `20261008-sync-1`.

## What actually reproduced on production

- A new cottage automatically received two builders and reached 8/36 work after four seconds. Named assignments, reserved materials, reload continuation and exact unused-material cancellation refund passed through actual touch controls. Construction after closing a reading panel also works in the local baseline.
- An earlier genuinely earned 14-resident town with nine ordinary job assignments accepted an affordable woodcutter plan after Continue. Two builders were assigned, but progress remained 0 because Continue deliberately leaves time paused. There was no construction-specific resume cue beside the task. Actual speed/resume controls started their work; no labor reassignment was necessary.
- With the first cottage paused at 0%, a later garden had two builders and 40% actual progress. The header still said `2 projects · 0%` because it read queue[0]. This is a confirmed reporting defect.
- Actual touch opened tools storage details and the 15-node research graph at 667×375 and 390×844 without page overflow. Screenshots and selector/timestamp logs are in `construction-2026-10-08/production-before/`.

No simulation allocation or worker-route failure was reproduced on this source. This does not prove the cause in Melissa’s personal save, which was never opened. The first production harness attempt chose an unaffordable cottage in the earned save; that harness mistake and its successful fresh-game/reload checks remain in the task workspace. The completed run used an affordable woodcutter without injected goods.

## Fix

The existing pause strip now says `Time paused · 2 builders ready` with `Resume construction` when a pending staffed project is waiting on an explicitly paused clock. It preserves automatic reading-pause behavior and management permissions, and does not unpause without the player’s action. All-paused sites and zero requested crew do not get a misleading ready-crew prompt.

Project feedback follows the first unpaused project and distinguishes time paused, site paused, zero requested crew and unavailable civilians. The crew control states requested versus assigned; inspectors no longer say workers are raising a building while time is paused. Queue rows say assigned rather than claiming workers have physically arrived. Placement and queue copy describe the actual current blocker without reassigning people.

No economics, crew priority, pathfinding, save schema, research, defense, or pause policy changed. Runtime cache token is `20261008-construction-1`. The existing panel artwork is retained.

## Validation

All 369 Node tests, 35 runtime JavaScript parsers and 2,020 archive checks pass. The four new regression cases exercise the real paused-first/active-second queue, paused-clock crew, restore, zero crew and site pause distinctions. Independent source review found no release blocker.

The same actual touch production harness passes against the local fixed source, including the new resume button, competing civilian jobs, reading hold, queue pause, reload and exact cancellation refund. Four additional authored layout fixtures at 1024×768, 768×1024, 667×375 and 390×844 each have a reachable 44px resume control and advance real construction when tapped. Two additional fixtures verify zero crew and site pause explanations. These use normal simulation build/cost APIs before seeding fresh isolated browser storage; they are labeled fixtures, not earned gameplay. All browser contexts are isolated; no real player storage or desktop session was touched.

The last cosmetic adjustment shortened duplicate queued toast text; final-source layout checks cover that version. The broader local touch flow immediately preceded that copy-only adjustment. The 51-file runtime manifest records the exact final source; production release verification follows separately.

## Claude context and limitations

Cory identified `.claude/worktrees/wildhaven-ux`, branch `claude/wildhaven-ux`, at current main, with only untracked `tools/ux-capture.mjs`; the audit preceded PR153. That exact worktree/tool is absent from the canonical Mini repository, its Realm symlink and the known task checkouts; it is not in registered Git worktrees or remote branches. It was neither executed nor changed. No pending Claude gameplay implementation was invented or merged. A broader task-date directory listing was OS-denied and not retried; this did not block current production QA.

Physical iPad Safari, Melissa’s exact save, and a long human play session remain unverified. All available local files, dependency links, old worktree records and earlier evidence remain intact. No application installation, desktop/CNC/controller/Makera/network-settings/memory/moth work occurred.
