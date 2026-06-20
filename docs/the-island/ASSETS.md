# ABYME — asset style guide & ledger

ABYME pivoted from "everything is math" to a rich, asset-driven world (the tag
`abyme-pure-math-v1` marks the old era). Generated assets — textures, voice, music,
meshes — are now first-class. This file is the **one place** that governs how they are
made, so a year of batches still share one look, stay power-safe, and stay honest about
their provenance. Every asset is declared in `js/assets.js` `MANIFEST` and loaded through
it (never hand-loaded inline).

> **Hard rules that never bend:** (1) **No biography, ever** — ABYME is an abstract
> lighthouse poem; a generation prompt must contain no real event, person, place, or
> company. (2) **Power holds or cuts** — every visual asset ships with a Power Ledger
> (below). (3) **three.js only** — assets are welcome, JS libraries are not.

---

## The look (so a batch reads as ONE place)

ABYME is a Myst-lineage island under a cinematic ACES grade that shifts by time of day and,
on the dive, **curdles through five color-psychology eras**. The world's color comes from
that grade — so **assets are achromatic / low-chroma wherever possible** and let the grade do
the coloring. An asset that bakes in its own strong hue will fight the eras and read wrong at
depth.

**The five era anchors** (from `world.js` `ERA_CASTS` / master grades — the mood an asset is
seen under, not a color to paint in):

| Level | Era | Cast |
|------:|-----|------|
| L1 (surface) | saturated golden / warm daylight | the clean `noon`/`golden` grade |
| L2 | sodium streetlight green-yellow (false comfort) | `0x8aa830` |
| L3 | sickly jaundice / fluorescent gold | `0xc29a1c` |
| L4 | cold isolation blue | `0x2f6cc8` |
| L5+ | dead violet — the keeper's near-dark floor | `0x573a72` |

Material vocabulary already in code (match it; `props.js` top): bone `0xcfc8b8`, aged copper
`0x4e9e88` (the painted lighthouse band — a deliberate fixed hue), brass `0xb08d4f`, wood
`0x6b4a2f`, old stone `0x9b9484`, ink `0x20242c`, cloth `0x355560`. Flat-shaded, weathered,
hand-built — never glossy or photoreal.

### Prompt preamble (prepend to every texture/image prompt)

> *seamless tileable PBR albedo, hand-built weathered surface, matte, soft overcast daylight,
> low saturation near-neutral, gentle grain, no text no logo no watermark, orthographic
> top-down, painterly-realistic —*

…then the specific surface (e.g. *"aged vellum chart paper, faint fold creases"*). **Frequency
matters more than detail**: scale the grain so the 1:240 model clone reads as chalk, not noise
mush. Albedo first; normal/roughness maps are a *separate* gated tick only if the budget holds.

### Voice (Kokoro) & music

- **Keeper voice:** timbre **bm_george** (owner-chosen). Always routed through the existing
  "drowned bus" (`audio.js` — lowpass ~1500 Hz + ~0.19 s feedback delay) so real speech still
  sounds *overheard through a floor of water*, never a clean TTS narrator. Lines are spare,
  curious→pleading→resigned; never address the player as an audience.
- **Music:** five short loopable ambient stems, one per era, **all seeded from the E-G-A-D-C
  leitmotif** (`props.js` `BOX_MELODY`) so they are family, not strangers. Keep the **surface
  (L1) stem warm** — the cozy-that-wounds tone means the bite is reserved for depth.

---

## Power & memory budget (per asset class)

Ceilings (bench pose, noon **and** night): **draws < 360**, **tris < 800k**, **60 fps**, adaptive DPR.

| Class | Cost it adds | Budget / rule |
|-------|--------------|---------------|
| texture | GPU fragment fetches + VRAM; **no** geometry/draws | ≤ 512² albedo, **≤ 256 KB** compressed; reuse one material across props; verify the model clone reads clean |
| mesh | draws + tris | must fit the draw/tri ceiling; pay back any new draw the same tick (gate a dormant light, merge a mesh) |
| voice | heap (decoded buffer) | mono ~24 kHz, short; lazy-fetch on first depth; free when far |
| music | heap (decoded buffer) | short loop; **decode lazily by level** (current + adjacent only) |

> **Memory, not GPU, is the real ceiling for voice+music.** The Power Ledger needs a
> resident-buffer column and a lazy/free policy, not just draws/tris/ms.

**Debt:** `driftwood.png` is **1.05 MB** — oversized for a tileable texture. Re-export ≤ 256 KB
in the next texture batch (the budget above is the target, not the current state).

---

## Per-asset acceptance test (before it ships)

1. **Provenance** — a `MANIFEST` row with `license`, `source`, and an abstract `prompt` (no biography).
2. **The look** — reads as the same place as its neighbours; achromatic enough that the five grades still color it; the **1:240 model clone** reads clean (chalk, not noise).
3. **Power Ledger** — draws/tris/GPU-ms at the bench pose, **noon and night**, net hold-or-cut. Audio: resident-buffer count under the lazy policy.
4. **In-register** — voice "still feels overheard, not addressed"; music keeps the surface warm; a texture doesn't fight the era casts.
5. **Honesty** — if it changes the truth of the title-screen claim, update `index.html` (the "…made of math" line) in the same tick.

---

## Generating on Bender (the pipeline)

Assets are generated on the big node ("Bender") via Peel: `asset_texture_generate`
(FLUX.1-schnell), `asset_voice_generate` (Kokoro-82M), `asset_music_generate`,
`asset_mesh_generate`. Outputs land in `~/.peel/assets/`; copy the chosen file into
`docs/the-island/assets/` and add its `MANIFEST` row. **Voice/music come back as WAV** —
transcode to a compact mono mp3 before shipping (`ffmpeg -i in.wav -ac 1 -ar 24000 -b:a 64k
out.mp3` — ~6× smaller, and mp3 is WKWebView-safe for `decodeAudioData`, unlike Opus). The
keeper's 6 lines shipped this way at ~148 KB total (`assets/voice/`).

> **Dispatch note:** `asset_voice_generate` / `asset_texture_generate` default to the LOCAL
> backend, which lacks the ML venvs and fails instantly. Pass **`node: "tree"`** to route the
> job to Bender (the heavy node) — that is what actually generates.

> **First troubleshooting line:** if jobs fail around ~40 s with *"Identity not verified,"*
> **restart Peel ON Bender** (not the local Mac) — it's a peer-trust handshake, not a prompt error.

**Sequence rule:** lock the look (this file) *before* asset volume, so early assets in a batch
don't get redone. Generate a small coordinated batch sharing the preamble; accept per the test above.
