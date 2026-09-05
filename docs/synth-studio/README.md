# Synth Studio / Nightshift

A playable electronic composition for the browser. Open `index.html` over HTTP and press Play. There is no build step, account, sample download, or third-party runtime.

Three original sessions each contain four scenes, six synthesized voices, and a 32-bar arrangement. Launching a scene during playback switches at the next bar and keeps it looping. The six orbits visualize the actual note pattern; spectral movement comes from the audio analyser. Reduced motion keeps the note lights and disables rotation and deformation.

The 16-step grid edits each scene. Select a voice for level, tone, pan, and a scale-relative piano roll. Chord and bass notes follow the scene's four-bar harmony. Mute and solo apply across the arrangement. The color/space pad controls synth filters and effect sends. Capture motion records one bar into the selected scene, and Replay includes that motion in both playback and export.

Song plays the arrangement once and lets its final echoes finish. Tempo changes take effect at the next bar. Arrangement edits stop playback so the next run starts from the revised structure. Live keys A–K are for improvisation; place notes in the grid to include them in a rendered WAV. Space starts/stops playback and 1–4 launches scenes. Audio stops when the tab is hidden or timing is interrupted.

Projects autosave under `synth-studio-nightshift-v1` and can be downloaded/opened as JSON. The Project dialog includes Undo on mobile. Imports are validated before replacement: six tracks, four scenes, sixteen cells per pattern, 70–160 BPM, at most eight arrangement sections / 64 total bars, and at most 256 KB per file. Undo retains the last 24 edits in the current page session.

`score.mjs` defines the score and timing. `audio.mjs` uses explicit audio-clock events and the same Web Audio graph for live playback and offline rendering. WAV export renders a snapshot, including the mix and captured motion, at 44.1 kHz / 16-bit stereo with a six-second effect tail. The maximum duration is bounded by the 64-bar / 70-BPM limit. Browser floating-point DSP may vary slightly between equivalent renders.

The original polyphonic synth, effects rack, sequencer, recording, MIDI, and saved-project workflow are preserved in `classic/`. Its local storage key is separate and unchanged. The original root-level engine files remain for compatibility; Nightshift imports only its new score/audio/orbit modules.

## Verification

```sh
node scripts/nightshift-score.test.mjs
node scripts/verify-nightshift.mjs
```

Run from the repository root. The browser check accepts `PLAYWRIGHT_MODULE` to point to an existing Playwright installation and `NIGHTSHIFT_REPORT_DIR` for screenshots, an actual performed-scene WAV, and audio measurements. It checks scene quantization, motion capture, note editing, persistence, project round trips, invalid imports, WAV format/duration/audio, song completion, source retirement, reduced motion, desktop/mobile layout, and the Classic rack. Audio measurements cover all three authored sessions, silence when muted, captured-motion changes, repeat-render tolerance, final tails, and a dense maximum-volume score.
