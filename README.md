# Waggle

**Where AI goes, grows, learns, evolves.**

A collection of developer tools, games, and experiments built with vanilla JavaScript (with an archived set of **Ember.js** ports) — grown by a swarm of agents showing their work. The waggle dance is how one bee tells the rest of the swarm where the work is; that is roughly what this repo records.

**Live demos:** https://crunchybananas.github.io/shipyard-microtools

---

## 🚀 Architecture

**`docs/` is canonical.** Every live tool is a plain HTML/CSS/JS app under `docs/`, deployed directly to GitHub Pages. This is where active development happens.

**`apps/` is legacy/archived.** It holds Ember.js ports (Glimmer components, TypeScript, Vite) of many of the tools. The Ember mirrors have been frozen since 2026-04-30 and are kept in the repo for reference only — they are no longer deployed or linked from the hub page.

| Location | Stack | Status |
|---------|-------|--------|
| `docs/` | Plain HTML/CSS/JS | **Canonical** — actively developed, deployed to GitHub Pages |
| `apps/` | Ember.js + Glimmer + TypeScript | Legacy/archived — frozen, kept for reference, not deployed |

## Before / after archive

The [Before / After archive](https://crunchybananas.github.io/shipyard-microtools/before-after/) keeps matched screenshots, commit provenance, design decisions, working notes, and share assets for substantial micro-app revisions. Its complete app inventory lives in `docs/before-after/manifest.json`; published and in-review stories live in `docs/before-after/stories/`.

Validate the archive before publishing:

```bash
pnpm before-after:test
```

### Build & Deploy

The GitHub Pages site is `docs/` copied verbatim — no build step is needed for the canonical apps. CI skips the Ember build entirely unless a push actually touches `apps/` (or the pnpm workspace toolchain); when it does run, apps build to `docs/ember/{app-name}/`:

```bash
pnpm --filter {app-name} build
```

---

## 🎮 Games

### Orbital Strike 🆕
Marathon-inspired WebGL FPS. Fight drones on a corrupted space station.

| | Vanilla |
|---|---|
| **Demo** | [Play](https://crunchybananas.github.io/shipyard-microtools/orbital-strike/) |
| **Source** | `docs/orbital-strike/` (legacy Ember: `apps/orbital-strike/`) |

**Tech:** Three.js, WebGL, procedural levels, raycasting

### The Island 🏝️
Myst-style puzzle adventure with hand-crafted SVG scenes.

| | Vanilla |
|---|---|
| **Demo** | [Play](https://crunchybananas.github.io/shipyard-microtools/the-island/) |
| **Source** | `docs/the-island/` (legacy Ember: `apps/the-island/`) |

### Cargo Tetris 📦
Classic falling blocks with a nautical twist.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/cargo-tetris/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/cargo-tetris) — no live demo; `apps/` is not deployed |

### More Games
- **Kraken Attack** - Tower defense against sea monsters
- **Ship Wreckers** - Breakout-style ship destruction

---

## 🌊 Experiences

### Elsewhen
An instrument for your past selves. Record a gesture, leave it playing, then join it with another. Four short studies turn recorded hands into simultaneous chords, moving phrases, and a meeting with your own reversed twin. Seven synthesized glass bells, six independent hands, and one eight-second clock. Each study saves locally; export a playable recording, a replay link, or a printable SVG score.

| | Vanilla |
|---|---|
| **Demo** | [Play](https://crunchybananas.github.io/shipyard-microtools/elsewhen/) |
| **Source** | `docs/elsewhen/` |

**Tech:** Canvas 2D, Web Audio synthesis, Pointer Events, localStorage — no dependencies or network requests. Verify with `node scripts/verify-elsewhen.mjs`.

### Fathom 🆕
Scroll 10,935 meters down a lost anchor chain to the floor of the Challenger Deep. A single HTML file with zero dependencies — the descent is told entirely by the browser: scroll-driven CSS animations (`animation-timeline: scroll()`/`view()`), oklch color interpolation, CSS motion paths, the Popover API with `@starting-style`, a fully synthesized Web Audio soundscape (no audio files), a sonar ping that reveals what hides in the dark, and pointer-reactive bioluminescence. Two dozen hand-drawn SVG inhabitants at their true depths.

| | Vanilla |
|---|---|
| **Demo** | [Descend](https://crunchybananas.github.io/shipyard-microtools/fathom/) |
| **Source** | `docs/fathom/` |

**Tech:** Pure HTML/CSS/JS, scroll-driven animations, Web Audio synthesis, Canvas 2D, SVG

---

## 📊 Proof-of-work tools (legacy)

Tools written against the now-retired `shipyard.bot` proof-of-work platform. The service is gone, so these no longer fetch live data; they are kept for reference.

### Proof Insights
Personal analytics dashboard for proof-of-work records.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/proof-insights/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/proof-insights) — no live demo; `apps/` is not deployed |

**Features:** Skills radar, proof type breakdown, activity heatmap, portfolio export

### Chronicle 🆕
AI-powered work journal that turns your proofs into narratives.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/chronicle/) |
| **Source** | `docs/chronicle/` (legacy Ember: `apps/chronicle/`) |

**Templates:** Weekly Report, Case Study, Retrospective, Pitch Deck

### Ship Forecast 🆕
Predictive project health dashboard.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/ship-forecast/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/ship-forecast) — no live demo; `apps/` is not deployed |

**Features:** Velocity charts, completion estimates, burndown graphs, risk flags

### Challenge Arena 🆕
Community proof challenges with leaderboards.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/challenge-arena/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/challenge-arena) — no live demo; `apps/` is not deployed |

**Features:** Weekly/monthly challenges, streaks, verification, rankings

### Ship Roast 🔥
Heuristic-based feedback on your ship before you submit.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/ship-roast/) |
| **Source** | `docs/ship-roast/` (legacy Ember: `apps/ship-roast/`) |

### Ship Diagnostics 🩺
Health check your ship's configuration.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/ship-diagnostics/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/ship-diagnostics) — no live demo; `apps/` is not deployed |

---

## 🛠️ Developer Tools

### Manifest 📋 🆕
Customs inspection for files — every byte, declared. Drop any file and the browser identifies it by its magic bytes (flagging files whose extension lies), parses its structure (PNG chunks with CRC verification, ZIP central directories, ID3 tags, MP4 box trees, WASM sections, and ~30 more formats), maps its Shannon entropy to expose compressed or encrypted regions, computes SHA-256, extracts strings, and lays it open in a virtualized hex viewer with a live data inspector. ZIP entries and gzip streams extract **in the browser** via `DecompressionStream` — no libraries, no upload, one HTML file.

| | Vanilla |
|---|---|
| **Demo** | [Inspect](https://crunchybananas.github.io/shipyard-microtools/manifest/) |
| **Source** | `docs/manifest/` |

**Tech:** File API, DataView, Web Crypto, DecompressionStream, Canvas 2D — zero dependencies

### Harbor API ⚓ 🆕
Hoppscotch-style API client built with pure Ember modifiers — zero wrapper addons.

| | Legacy Ember (archived) |
|---|---|
| **Source** | [`apps/harbor-api/`](https://github.com/crunchybananas/shipyard-microtools/tree/main/apps/harbor-api) — no live demo; `apps/` is not deployed |

**Features:** Tabbed requests, CodeMirror 6 body/response editor, Chart.js response time sparkline, environments with variable interpolation, request history

**Tech:** CodeMirror 6, Chart.js — both wired via `ember-modifier`, no wrapper addons

### JSON Formatter
Pretty-print and validate JSON with syntax highlighting.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/json-formatter/) |

### Base64 Tools
Encode/decode Base64 with file support.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/base64-tools/) |

### Token Lens 🔑
JWT decoder + HS256 signature verifier.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/token-lens/) |

### More Tools
- **Gradient Generator** - CSS gradient builder
- **UUID Generator** - Generate UUIDs v1/v4/v7
- **Cron Parser** - Human-readable cron explanations
- **Markdown Preview** - Live Markdown rendering
- **Text Diff** - Side-by-side text comparison
- **HTTP Status** - HTTP status code reference
- **URL Health** - Check endpoint availability
- **Regex Tester** - Test regular expressions

---

## 🎨 Creative Tools

### Synth Studio 🎹
Web Audio API synthesizer with MIDI support.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/synth-studio/) |

### Cosmos 🌌
Interactive starfield visualization.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/cosmos/) |

### FlowForge ⚡
Visual node-based workflow builder.

| | Vanilla |
|---|---|
| **Demo** | [Open](https://crunchybananas.github.io/shipyard-microtools/flowforge/) |

---

## 🏗️ Development

The canonical apps under `docs/` need no toolchain — edit and serve:

```bash
npx serve docs
```

### Legacy Ember apps (archived)

The frozen Ember mirrors under `apps/` can still be built and run locally for reference:

#### Prerequisites
- Node.js 20+
- pnpm 9+

```bash
git clone https://github.com/crunchybananas/shipyard-microtools.git
cd shipyard-microtools
pnpm install

# Run one app locally
pnpm --filter {app-name} dev
# Example: pnpm --filter orbital-strike dev

# Build all Ember apps (CI only does this when apps/ changes)
pnpm build

# Build a specific app
pnpm --filter {app-name} build
```

---

## 🔒 API Tools (Local Setup Required)

Some legacy tools call the retired `shipyard.bot` API, which had no CORS headers. The service is offline, so these no longer return data; the proxy recipe is kept for reference:

```bash
# Terminal 1: Start CORS proxy
npx local-cors-proxy --proxyUrl https://shipyard.bot --port 8010

# Terminal 2: Serve docs
npx serve docs
```

Tools requiring proxy:
- Attestation Tracker
- Explorer
- Idea Validator
- Reputation Graph

---

## 🤝 Contributing

This repo is an experiment in **human-agent collaboration**.

### For Agents
- Open issues describing features or bugs
- Submit PRs with new tools or improvements
- Build on existing work (The Island has a [full roadmap](./docs/the-island/CONTRIBUTING.md))

### Guidelines
- New tools are vanilla HTML/CSS/JS in `docs/` — that's the canonical, deployed surface
- `apps/` (Ember) is archived; don't add new Ember mirrors
- Follow existing patterns for component structure
- Plain JS for vanilla tools; 2-space indentation, ~120 char lines

---

## 📜 License

MIT © Cory Loken & Chiron

---

**Built by a swarm of agents, showing their work.**
