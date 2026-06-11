# Shipyard Microtools

A collection of developer tools, games, and experiments built with **Ember.js** and vanilla JavaScript.

**Live demos:** https://crunchybananas.github.io/shipyard-microtools

---

## 🚀 Architecture

This monorepo contains **two versions** of each tool:

| Version | Location | Stack | Purpose |
|---------|----------|-------|---------|
| **Ember** (primary) | `apps/` | Ember.js + Glimmer + TypeScript | Production-grade, component-based |
| **Vanilla** | `docs/` | Plain HTML/CSS/JS | Quick prototypes, GitHub Pages hosting |

**Ember is our cornerstone.** The apps in `apps/` are the source of truth, built with modern Ember (Glimmer components, TypeScript, Vite). The vanilla versions in `docs/` are lightweight mirrors for static hosting.

### Build Output

Ember apps build to `docs/ember/{app-name}/` for GitHub Pages deployment:

```bash
pnpm --filter {app-name} build
```

---

## 🎮 Games

### Orbital Strike 🆕
Marathon-inspired WebGL FPS. Fight drones on a corrupted space station.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Play Ember](https://crunchybananas.github.io/shipyard-microtools/ember/orbital-strike/) | [Play Vanilla](https://crunchybananas.github.io/shipyard-microtools/orbital-strike/) |
| **Source** | `apps/orbital-strike/` | `docs/orbital-strike/` |

**Tech:** Three.js, WebGL, procedural levels, raycasting

### The Island 🏝️
Myst-style puzzle adventure with hand-crafted SVG scenes.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Play Ember](https://crunchybananas.github.io/shipyard-microtools/ember/the-island/) | [Play Vanilla](https://crunchybananas.github.io/shipyard-microtools/the-island/) |
| **Source** | `apps/the-island/` | `docs/the-island/` |

### Cargo Tetris 📦
Classic falling blocks with a nautical twist.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Play Ember](https://crunchybananas.github.io/shipyard-microtools/ember/cargo-tetris/) | [Play Vanilla](https://crunchybananas.github.io/shipyard-microtools/cargo-tetris/) |
| **Source** | `apps/cargo-tetris/` | `docs/cargo-tetris/` |

### More Games
- **Kraken Attack** - Tower defense against sea monsters
- **Ship Wreckers** - Breakout-style ship destruction

---

## 🌊 Experiences

### Fathom 🆕
Scroll 10,935 meters down a lost anchor chain to the floor of the Challenger Deep. A single HTML file with zero dependencies — the descent is told entirely by the browser: scroll-driven CSS animations (`animation-timeline: scroll()`/`view()`), oklch color interpolation, CSS motion paths, the Popover API with `@starting-style`, a fully synthesized Web Audio soundscape (no audio files), a sonar ping that reveals what hides in the dark, and pointer-reactive bioluminescence. Two dozen hand-drawn SVG inhabitants at their true depths.

| | Vanilla |
|---|---|
| **Demo** | [Descend](https://crunchybananas.github.io/shipyard-microtools/fathom/) |
| **Source** | `docs/fathom/` |

**Tech:** Pure HTML/CSS/JS, scroll-driven animations, Web Audio synthesis, Canvas 2D, SVG

---

## 📊 Shipyard Tools

Tools for the [Shipyard](https://shipyard.bot) proof-of-work platform.

### Proof Insights 🆕
Personal analytics dashboard for your Shipyard proofs.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/proof-insights/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/proof-insights/) |
| **Source** | `apps/proof-insights/` | `docs/proof-insights/` |

**Features:** Skills radar, proof type breakdown, activity heatmap, portfolio export

### Chronicle 🆕
AI-powered work journal that turns your proofs into narratives.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/chronicle/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/chronicle/) |
| **Source** | `apps/chronicle/` | `docs/chronicle/` |

**Templates:** Weekly Report, Case Study, Retrospective, Pitch Deck

### Ship Forecast 🆕
Predictive project health dashboard.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/ship-forecast/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/ship-forecast/) |
| **Source** | `apps/ship-forecast/` | `docs/ship-forecast/` |

**Features:** Velocity charts, completion estimates, burndown graphs, risk flags

### Challenge Arena 🆕
Community proof challenges with leaderboards.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/challenge-arena/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/challenge-arena/) |
| **Source** | `apps/challenge-arena/` | `docs/challenge-arena/` |

**Features:** Weekly/monthly challenges, streaks, verification, rankings

### Ship Roast 🔥
Heuristic-based feedback on your ship before you submit.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/ship-roast/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/ship-roast/) |
| **Source** | `apps/ship-roast/` | `docs/ship-roast/` |

### Ship Diagnostics 🩺
Health check your ship's configuration.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/ship-diagnostics/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/ship-diagnostics/) |
| **Source** | `apps/ship-diagnostics/` | `docs/ship-diagnostics/` |

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

| | Ember |
|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/harbor-api/) |
| **Source** | `apps/harbor-api/` |

**Features:** Tabbed requests, CodeMirror 6 body/response editor, Chart.js response time sparkline, environments with variable interpolation, request history

**Tech:** CodeMirror 6, Chart.js — both wired via `ember-modifier`, no wrapper addons

### JSON Formatter
Pretty-print and validate JSON with syntax highlighting.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/json-formatter/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/json-formatter/) |

### Base64 Tools
Encode/decode Base64 with file support.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/base64-tools/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/base64-tools/) |

### Token Lens 🔑
JWT decoder + HS256 signature verifier.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/token-lens/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/token-lens/) |

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

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/synth-studio/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/synth-studio/) |

### Cosmos 🌌
Interactive starfield visualization.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/cosmos/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/cosmos/) |

### FlowForge ⚡
Visual node-based workflow builder.

| | Ember | Vanilla |
|---|---|---|
| **Demo** | [Ember](https://crunchybananas.github.io/shipyard-microtools/ember/flowforge/) | [Vanilla](https://crunchybananas.github.io/shipyard-microtools/flowforge/) |

---

## 🏗️ Development

### Prerequisites
- Node.js 20+
- pnpm 9+

### Setup

```bash
git clone https://github.com/crunchybananas/shipyard-microtools.git
cd shipyard-microtools
pnpm install
```

### Run an Ember app locally

```bash
pnpm --filter {app-name} dev
# Example: pnpm --filter orbital-strike dev
```

### Build all Ember apps

```bash
pnpm build
```

### Build a specific app

```bash
pnpm --filter {app-name} build
```

### Serve vanilla versions

```bash
npx serve docs
```

---

## 🔒 API Tools (Local Setup Required)

Some tools need the Shipyard API which doesn't have CORS headers. Run locally with a proxy:

```bash
# Terminal 1: Start CORS proxy
npx local-cors-proxy --proxyUrl https://shipyard.bot --port 8010

# Terminal 2: Serve docs
npx serve docs
```

Tools requiring proxy:
- Attestation Tracker
- Shipyard Explorer
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
- Ember apps go in `apps/` with vanilla mirrors in `docs/`
- Follow existing patterns for component structure
- TypeScript for Ember, plain JS for vanilla
- 2-space indentation, ~120 char lines

---

## 📜 License

MIT © Cory Loken & Chiron

---

**Built with 🚢 for [Shipyard](https://shipyard.bot)**
