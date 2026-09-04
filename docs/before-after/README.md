# Waggle Before / After

This directory is the durable, shareable record of how the Waggle micro apps evolve. It keeps the pictures, the product reasoning, the owner’s reaction, and the verification evidence together instead of leaving that context in a transient task or chat.

The archive is data-first:

- `manifest.json` is the inventory and publication index.
- `stories/<slug>.json` contains one public before/after narrative.
- `assets/<slug>/` contains the source captures and share artwork for that narrative.
- `index.html` renders the records; it should not be the source of story copy.
- `scripts/verify-before-after.mjs` checks the inventory, schema, refs, links, assets, and paired image dimensions.

An app’s `status` describes its **before/after coverage**, not whether the demo itself is live. The current statuses are:

- `published`: a reviewed story is ready to share.
- `in-revision`: the record is intentionally candid and still changing.
- `queued`: the live app has not received its archive story yet.
- `separate-workstream`: another owner or task controls that app; do not fold it into a gallery-wide pass.

## Add

1. Add or update the app in `manifest.json`. Keep its slug identical to its tracked `docs/<slug>/index.html` directory.
2. Add a story record to `manifest.stories`, then create the matching `stories/<story-slug>.json` file. Repeat ownership in both places: app stories use `appSlug` and set `surfaceSlug` to null; surface stories use `surfaceSlug` and set `appSlug` to null.
3. Point the app or surface `story` field at the newest record for that owner. Use `kind: "app"` for a demo and `kind: "surface"` for a collection-level page such as the demo hub. Older records stay in `manifest.stories` without remaining the current pointer.
4. Write for a public reader: state the design thesis, what materially changed, what was verified, and what remains unresolved. Do not turn owner feedback into a stronger endorsement than it was.

All asset paths in story data are relative to `docs/before-after/`, for example `assets/orbital-strike/after-gameplay.jpg`.

## Capture

1. Resolve the exact `before` and `after` commits recorded in the story. Capture from isolated worktrees so the current checkout and other workstreams remain untouched.
2. Use the same browser, viewport, pixel ratio, zoom, and representative app state for both sides of each comparison.
3. Capture real rendered UI. Do not reconstruct an old screen or silently retouch away product behavior.
4. Export comparison frames as JPEG and montage/share artwork as PNG or JPEG. Give each image useful alt text in the story JSON.
5. Keep each before/after pair at exactly the same pixel dimensions. The verifier rejects mismatched pairs.

## Review

Run:

```sh
node scripts/verify-before-after.mjs
```

Then inspect every image at full size and on the rendered archive page. Confirm that:

- the screenshots correspond to the recorded commits;
- captions describe visible, material changes;
- quoted feedback is exact and its context is honest;
- proof statements are supported by checks from that revision;
- live, source, download, and share links point to the intended destinations;
- unfinished work is labeled `in-revision`, not presented as a finished success.

## Share

Each story has a stable relative route in its manifest `href`, such as `./orbital-strike/`; the deployed canonical URL is `https://crunchybananas.github.io/shipyard-microtools/before-after/orbital-strike/`. Use `share.summary` as the short post description and `share.image` as the social card. When a downloadable montage exists, expose it through `links.download`; use `null` when there is no download rather than inventing one.

## Append-only story policy

Once a story becomes `published`, treat its JSON, captures, quotes, and commit refs as historical evidence:

- Do not replace a published capture with a newer state under the same filename.
- Do not rewrite an earlier reaction to match later sentiment.
- Do not remove an older published story when a new redesign lands.
- Corrections should be explicit additions. A materially new pass gets a new story slug and new asset directory; update the owning app or surface’s `story` pointer to the newest record while leaving the earlier record in `manifest.stories`.
- `queued` and `in-revision` records may change during review. The append-only boundary begins when their status changes to `published`.

This policy keeps links trustworthy and lets the archive show iteration—including directions that were promising but not yet right.


## Model lineage (schema 2)

New stories can record more than two revisions. Existing schema-1 stories, route slugs, scene hashes, source refs, and captures remain valid and unchanged.

A schema-2 story keeps `versions.before`, `versions.after`, and each comparison's `before` and `after` images as aliases of its lineage endpoints. This allows existing consumers to keep reading a binary pair. The additional fields are:

- `lineage`: an ordered array of revisions with unique `id`, `label`, full `commit`, product `summary`, and `provenance`.
- `provenance.model`: the exact credited model name, or `null` for unrecorded provenance. Never infer attribution from a date, writing style, author account, or the name of the current task.
- `provenance.evidence`: either `unrecorded`, or `commit-trailer` with the exact `quote` and its source `commit`. The verifier checks the complete trailer against Git and requires that evidence commit to be an ancestor of the captured revision. This records repository credit; it does not independently verify a historical model run.
- `comparisons[].viewport`: the capture width and height. `frames` maps every lineage ID to a real image at those exact dimensions. Desktop and mobile are separate capture scenes.
- `captureProtocol`: the actual input and interaction recipe. `captureReceipt` links to the browser, commits, scroll offsets, dimensions, and SHA-256 image hashes produced by the capture script.
- `updatedAt`: the dated review update, used to put current in-review work in the archive without falsely marking it published.
- `builderNote`: may be `null` in schema 2. Do not fabricate owner feedback to fill a template.

The viewer supports one complete revision, a wipe between any two revisions, and side-by-side frames (stacked on a phone). Revision IDs, comparison mode, and capture scene persist in the share URL. Native controls and arrow/Home/End navigation make the sequence usable with a keyboard. The sidebar follows an app's current story pointer, while older records remain indexed.

### Reproduce the workbench evidence

The source of each revision is extracted with `git archive` into an isolated temporary directory. No historical checkout, Realm directory, or Island directory is changed.

```sh
node --test scripts/workbench-engine.test.mjs
node scripts/verify-workbenches.mjs
node scripts/capture-workbench-lineage.mjs json-workbench-astra text-diff-astra
node scripts/render-workbench-share.mjs json-workbench-astra text-diff-astra
node scripts/verify-before-after.mjs
node scripts/verify-story-lineage.mjs
```

The browser tools use the existing `@playwright/test` dependency. `PLAYWRIGHT_MODULE` can point at an installed module when using a linked dependency environment. Optional `WORKBENCH_REPORT_DIR` and `LINEAGE_REPORT_DIR` save QA screenshots outside the source tree.

Capture source JPEGs are 1440×900 and 390×844, at device scale 1. Transient success notifications settle before capture, every source editor starts at its top, and the mouse is moved away. Mobile aligns the result panel near the top to keep it readable. Exact scroll offsets are retained in the receipt. Share cards are 1200×630; four-revision montages are 1800×1480. They are HTML compositions of the actual captures, with labels outside the screenshots.

Use `CAPTURE_OUTPUT_DIR` and `SHARE_OUTPUT_DIR` for comparison runs that must not replace evidence. Both generators refuse to overwrite a published story's assets without an alternate output directory. Keep the story in revision until its owner reviews it.
