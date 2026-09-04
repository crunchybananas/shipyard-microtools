# Astra workbench pass — review record

Two existing tools received material updates: JSON Workbench (`json-formatter/`) and Text Diff (`text-diff/`). The archive now presents an ordered model lineage while retaining every existing story and stable route.

Review branch: `codex/astra-workbench-lineage`.

Started from freshly fetched `origin/main` at `d88602aa9ebdd614b961cc773ff4ad7f2430e10c`. The app implementation is pinned at `b6d24b9b496bc52a8a33036500169064e87665c0`. The archive, hub integration, screenshots, and this review record form the following commit.

## What is strongest

- **JSON inspection without changing the data.** The source stays beside a searchable structure. Selecting a key or value exposes its JSON Pointer, source line, and exact value. Formatting preserves large integer lexemes, exponent notation, duplicate keys, and string escapes. Invalid or edited input immediately disables stale exports. File import, document download, and separate pointer/value copy actions complete the workflow.
- **A reviewable diff with a usable patch.** Word emphasis and aligned views build on the earlier Fable work. Change navigation, context expansion, and paged rendering make a long revision manageable. The worker is cancellable and bounded. Patch tests apply the actual output with Git, including final newlines, empty files, default filenames, and filenames containing spaces and Unicode. Patches update the original filename; the second input's filename does not silently become the patch target.
- **An archive that shows the work accumulating.** Each new story contains four recorded states. Readers can inspect one complete screen, wipe between any two revisions, or view two complete frames side by side. Mobile has its own full-resolution capture sequence. Shared URLs retain the selected revisions and capture size. Unknown model provenance is explicit.

## Audit and selection

The live hub, archive, JSON Formatter, Text Diff, and Gradient Generator were inspected in Chromium on September 4, 2026. Each returned HTTP 200 without page errors. The deployed hub's HTML and both selected apps' HTML matched the `d88602aa` snapshot byte for byte. The hub was already dark (`#0b1020`); the two selected tools and archive still used the pale suite styling.

The 32-app manifest, canonical `docs/` deployment, legacy `apps/` boundary, deployment workflow, existing archive records, and relevant Git history were reviewed. Gradient Generator already had dynamic stops and conic gradients; the two selected tools offered more substantial functional gains. Beacon had just received a documented WebGL pass, and Orbital Strike already had a published overhaul and control gate. Their app code is outside this pass.

The useful intermediate features were preserved: JSON's collapsible structure and error navigation, and Text Diff's word emphasis, split view, and real line numbers. No `docs/realm/`, `docs/the-island/`, legacy Ember, dependency-lockfile, or deployment-workflow edits are part of this work.

## Recorded lineage

| State | JSON Workbench | Text Diff | Attribution |
| --- | --- | --- | --- |
| Original | `7d9e4d81` | `7d9e4d81` | Model unrecorded |
| Intermediate | `3acc1c7b` | `6fb98ea9` | Exact commit trailers credit Claude Fable 5 |
| Deployed baseline | `d88602aa` | `d88602aa` | Composite state; suite refresh `13f4a628` has no model credit |
| Astra | `b6d24b9b` | `b6d24b9b` | Current source commit records GPT-6 Astra |

The archive records repository attribution. It does not claim independent verification of a historical model session. New stories remain `in-revision`, with no fabricated owner quote or endorsement. Existing published story JSON and image bytes are retained.

## Screens and share assets

There are 16 real source captures: four revisions × two apps × two viewports. Desktop is 1440×900; mobile is 390×844; all use device scale 1 and Chromium 147.0.7727.15. The same fixture is loaded through each revision's own UI. Source editors start at their top, transient banners settle, and the mouse leaves the content. Desktop starts at the page top. Mobile aligns the output near the top, subject to the original page's real scroll limits.

Each `capture-receipt.json` records the full source commit, browser, viewport, scroll positions, and SHA-256 image hash. The generators extract the exact Git revisions into temporary directories; they do not reconstruct historical UI.

| Story | Four-revision montage | Social card | Capture receipt |
| --- | --- | --- | --- |
| [JSON Workbench](./json-workbench-astra/) | [1800×1480 PNG](./assets/json-workbench-astra/montage.png) | [1200×630 JPEG](./assets/json-workbench-astra/social.jpg) | [JSON](./assets/json-workbench-astra/capture-receipt.json) |
| [Text Diff](./text-diff-astra/) | [1800×1480 PNG](./assets/text-diff-astra/montage.png) | [1200×630 JPEG](./assets/text-diff-astra/social.jpg) | [JSON](./assets/text-diff-astra/capture-receipt.json) |

The hub uses these new app captures directly. Other app preview assets are unchanged. Share artwork is composed from the real captures with labels outside the screenshots. Original JPEGs, intermediate screens, final screens, and full-size links remain available in each story.

## Validation

- `node --test scripts/workbench-engine.test.mjs`: seven passing suites, 600 randomized reconstruction cases, twelve successful Git patch applications, lossless JSON checks, pointer escaping, limits, malformed input, and a 20,000-line localized edit.
- `node scripts/verify-workbenches.mjs`: 49 browser checks at 1440×900 and 390×844; no page or console errors. Covers file import/download, clipboard, source errors, rendering untrusted strings as text, changed final newlines, off-page navigation, cancellation, and stale-output invalidation.
- `node scripts/verify-before-after.mjs`: 2,295 checks across 32 apps and eight stories. Includes exact model trailers, commit ancestry, complete frame coverage, image dimensions, capture hashes, stable shell routes, and social metadata.
- `node scripts/verify-story-lineage.mjs`: 127 checks, including six deliberately invalid provenance/capture fixtures, all eight routes at desktop and mobile sizes, legacy Orbital Strike and both hub stories, keyboard revision selection, persisted comparison URLs, mobile image aspect ratios, and the 32-app hub.
- Source captures, social cards, montages, and rendered desktop/mobile stories were visually inspected. `git diff --check` passed.

The browser scripts use the existing Playwright dependency. This host's linked-worktree setup needs `GIT_WORK_TREE` set to the repository root for Git-driven checks; the checked-in scripts use ordinary repository-relative paths. See [the archive README](./README.md) for capture and verification commands.

## Practical limits

JSON inspection accepts up to 2 MiB, 50,000 values, and 128 nesting levels. Text Diff accepts up to 2 MiB and 20,000 lines per input, with a 1,400-edit search bound and an eight-second timeout. Large unrelated revisions return an explicit limit message. Text Diff normalizes line endings to LF. Ignoring edge whitespace disables exact patch export. These browser tools keep input in the current tab and do not persist drafts.

Validation used Chromium on this host. Browser engine coverage beyond Chromium and deployment are outside this review pass. The work is committed locally for review; it is not published to the live site.
