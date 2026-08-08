# Releasing ABYME (#141, AAA-C3) — everything prepared, each gate one click

## 1. itch.io (the web build is already the build)

The game is a static page — the itch zip is `docs/the-island/` minus dev-only dirs:

```
cd docs/the-island
zip -r ../abyme-itch.zip . -x "tools/*" "loop/*" "release/*"
```

Then on itch.io: new project → HTML → upload the zip → "This file will be played
in the browser" → viewport 1280×800, fullscreen button ON, mobile friendly ON
(touch shipped in #60). SharedArrayBuffer/CORS special-casing: none needed.

- **Capsule**: `capsule_630x500.png` (the night beam).
- **Screenshots**: `screenshot_breach.png` + pull more from `loop/goldens/` or the
  trailer frames.
- **Trailer**: upload `tools/trailer/out/master.mp4` AFTER the shot-list sign-off.
- **Page copy**: `itch_page.md` (canon-safe: no twist, no endings, no biography).
- **Pricing**: suggest free / pay-what-you-want at first (proof-of-play beats
  revenue while the board watches wishlists).

`manifest.webmanifest` ships beside index.html (installable identity; theme color
matches the night sky). No service worker by design: itch serves from its CDN and
GitHub Pages stays cache-honest — offline play arrives with the Tauri wrap instead.

## 2. Tauri desktop wrap (for Steam) — config prepared, build is owner-run

`tauri/` holds `tauri.conf.json5` + notes. The wrap is a thin shell over the same
static files; file-based saves and a quit item are the only shell duties. Build
needs the Rust toolchain + platform signing (macOS notarization / Windows cert),
so it is owner-run:

```
cargo install tauri-cli
cd docs/the-island/release/tauri && cargo tauri build
```

Acceptance for the wrap: the full walk green against the built app on macOS and
Windows — run `tools/harness/walk.mjs` pointed at the wrapped origin. Steam then
needs: an app credit, depot upload via steamcmd, capsule set (reuse these), and
the store copy below.

## Store copy rules (canon)

The page never says: the twist, either ending, "you were/are the keeper", anything
biographical. It may say: a drowned island that repeats, letters in more than one
hand, an inspection, a light kept for someone. `itch_page.md` follows these rules;
edit freely inside them.
