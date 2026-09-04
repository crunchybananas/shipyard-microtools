# Shipyard Before / After

This directory is the durable, shareable record of how the Shipyard micro apps evolve. It keeps the pictures, the product reasoning, the owner’s reaction, and the verification evidence together instead of leaving that context in a transient task or chat.

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
