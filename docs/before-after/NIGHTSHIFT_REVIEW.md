# Nightshift review

Synth Studio now opens as an authored electronic composition you can perform, edit, and take away. The new source is pinned at `b05dc8d5680206e9cafaa27f4f52982b02b80dd1`, credited to GPT-6 Astra.

Open the [instrument](../synth-studio/) and press Play. Launch Night drive, move the color/space pad, and capture a bar of movement. Select Bass or Arp to change notes. Song follows the editable arrangement; a manually launched scene switches on the next bar and loops. The three original sessions each contain six voices, four scenes, and 32 bars. The score, mix, and captured motion survive reload and project-file round trips.

The [comparison record](./synth-nightshift-astra/) preserves four revisions: original `fe30da1d`, Claude Fable 5's export/persistence update `8022d20b`, the previously verified deployed baseline `d88602aa`, and Nightshift `b05dc8d5`. Original and composite-baseline model provenance remain unrecorded. The Fable and Astra credits are exact commit trailers. No owner endorsement has been added; the record remains in revision.

Eight real screenshots show those four revisions at 1440×900 and 390×844. Every capture starts with a fresh page, empty storage, audio stopped, and scroll position zero. The older rack and the new authored score have different default content, explicitly described in the captions. Screenshots are neither reconstructed nor retouched. [Capture receipts](assets/synth-nightshift-astra/capture-receipt.json) record source hashes, Chromium version, image dimensions, and SHA-256 hashes. The [montage](assets/synth-nightshift-astra/montage.png) and [social image](assets/synth-nightshift-astra/social.jpg) compose those actual screens.

Verification:

- Six score tests pass: authored sessions, timing and swing, scale/harmony bounds, mix and motion, malformed imports, and arrangement limits.
- 78 browser/DSP checks pass: desktop/mobile layout, explicit audio activation, quantized scene launch, captured movement, note edits, reload, Undo, project download/import, invalid and literal-text imports, WAV download, song completion with effect tail, reduced motion, and Classic rack access.
- All three authored sessions render finite musical signals. Their measured peaks are approximately 0.403, 0.452, and 0.484. A dense maximum-volume score peaks at 0.954; none clip. Final tails fall below 0.00001 RMS. Muting all tracks yields silence; captured motion changes the actual samples; Stop retires the actual audio sources.
- The archive passes 2,731 static checks and 147 browser checks across all nine stories. Canonical demo discovery now ignores nested entry points such as the Classic rack, preserving the 32-app inventory.
- Equivalent renderings agree within browser DSP floating-point tolerance. The measured repeat RMS difference is approximately 4×10⁻⁹, with a maximum sample difference below 10⁻⁶. Musical timing and the compiled score are deterministic; bit-identical audio across all browsers is not promised.

The original synth and its storage remain in the [Classic rack](../synth-studio/classic/). Nightshift uses a separate storage key. Live keyboard improvisation is ephemeral; its notes must be entered in the grid to appear in a rendered WAV. Exports snapshot the current arrangement, mix, effects, and motion at 44.1 kHz / 16-bit stereo, followed by six seconds of effect tail. Projects are limited to 64 bars and 70–160 BPM. Audio stops when the tab is hidden or its clock is interrupted.

The implementation is committed locally. It has not been pushed or deployed. All prior stories, their screenshots, and the other 31 applications remain intact. The hub's Synth Studio description and preview now point to Nightshift. The Island and Realm are unchanged.

Reproduce from the repository root:

```sh
node scripts/nightshift-score.test.mjs
node scripts/verify-nightshift.mjs
node scripts/capture-nightshift-lineage.mjs
node scripts/render-workbench-share.mjs synth-nightshift-astra
node scripts/verify-before-after.mjs
node scripts/verify-story-lineage.mjs
```

Browser scripts accept `PLAYWRIGHT_MODULE` for an installed Playwright path. Use `NIGHTSHIFT_REPORT_DIR` for runtime screenshots, a real performed-scene WAV, and the audio measurements. Published capture/share assets are protected; comparison reruns must use `CAPTURE_OUTPUT_DIR` and `SHARE_OUTPUT_DIR`. `CAPTURE_REPO` optionally selects the checkout containing the pinned source objects.
