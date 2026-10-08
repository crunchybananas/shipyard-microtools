# Short-landscape pause notice — 8 October 2026

Production QA of PR163 found that the pause notice partly covered Stores, Research and Trade tabs at 667 × 375. The gameplay interactions passed, but screenshot inspection exposed the smaller effective touch targets. The short-landscape Town book fills the space above the dock while the notice previously stayed in the HUD above it.

The existing notice now occupies its own row above the Town tabs at widths of at least 521px and heights up to 600px. Closing the book or rotating out of that layout restores it to the HUD. This reuses the same button, text, handler and focus; the reading clock, explicit pause, crew allocation, management permissions and saved state are unchanged. The runtime cache token is `20261008-construction-2`.

## Preserved work and ownership

The three-file correction and initial touch harness appeared in the shared checkout while PR163 production checks were being reviewed. Their original writer could not be verified. The coordinating parent checked accessible account threads, found no identifiable active Wildhaven owner, and explicitly assigned adoption within Cory's approved production QA, fix and release scope.

Before adoption, the exact dirty diff, three source files, original harness, logs, screenshots, failed receipt and existing untracked dependency symlink were preserved in the task checkpoint `Wildhaven-pause-panel-checkpoint-20261008T201208Z`. All ten preserved items remained unchanged across a 50-second observation. The source correction was adopted unchanged. No unknown work was reverted, deleted or overwritten.

The original harness stopped because an unscoped tab selector matched both the old HUD button and Town's actual tab. Its failed evidence remains preserved. The selector now targets `#town-tabs`; a 300ms progress assumption was replaced with bounded polling across the normal one-second simulation boundary, and the reading hold is observed for more than one second.

## Validation

All six isolated actual-touch cases pass: 667 × 375, 568 × 320, 1024 × 600, 1024 × 768, 768 × 1024 and 390 × 844. Each checks a 44px resume button, every corner of all six Town tab targets, real construction progress after resume, all six actual tab taps, reading hold, rotation in both directions, retained focus and return to the HUD after closing Town. The three short layouts have no overlap between notice and tabs. Screenshots were visually inspected; there are no page errors, failed loads or horizontal overflow.

These are clearly labeled engineering fixtures, built and charged using normal simulation APIs before loading isolated storage. No time or resources are injected during browser interaction, and no real player save or desktop browser profile is touched.

The 369-test simulation suite, 35 runtime parsers and 2,020 archive checks pass. Independent read-only review found no source blocker. `pause-panel-fit-2026-10-08/` contains local screenshots, the corrected harness, logs and the exact 51-file runtime manifest. Production verification follows the release separately.

Physical iPad Safari and sustained device performance remain unverified. Existing ImageGen pantry and Company artwork is preserved; compact screens retain space for controls. No package installation, heavy build, desktop/CNC/controller/Makera/settings/memory/moth work occurred.
