# Local browser evidence

Install test dependencies with `npm ci` in `presentation-kit/`. The audience kit has no npm dependency. The pinned Playwright package launches the installed Chromium binary at `/home/bluestar/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`; set `CHROMIUM_PATH` to use another explicitly installed browser.

Build and extract the kit as described in the parent README. Run from `presentation-kit/`:

```sh
taskset -c 11 unshare -rn env OMP_NUM_THREADS=1 npm test
```

`KIT_DIR` defaults to the lane's `out/kit-extracted-final/`; `QA_OUTPUT` defaults to `out/`. The network namespace has no network interface access. The suite additionally rejects every browser request whose URL is not `file:`, every console error, every uncaught page error and every failed local resource. It follows local HTML links, including all launcher destinations and speaker notes.

For all scenes at 1440×1000, 1024×768 and 390×844, the suite traverses next/back using mouse, keyboard and emulated touch, checks boundaries, compares exposed reset state after a real intervention (including Camel camera drag/zoom and Rhine playback preference), resizes active renderers, checks visible headings/controls/canvases for horizontal overflow and clipping by ancestors, verifies that Camel controls remain below the main visual, and saves full-page screenshots. The phone viewport and touch are Chromium emulation, not a physical-device test. The suite also verifies actual Rhine video decoding and playback, Camel and Rhine illustration WebGL contexts and draw commands, the lattice round-trip result and all toy half-steps, the complete instructed circulation contour inside its canvas, rendered lattice image pixels, and one A4 printed page per speaker guide. Local requests and HTML links must remain inside the extracted kit, so neighboring working directories cannot hide a missing bundled dependency.

The JSON report is `out/evidence/playwright-results.json`; per-presentation JSON provides exact state snapshots, renderers, viewport measurements, interactions and captured errors. Screenshots are `out/screenshots/<viewport>/`. Failure traces and screenshots remain in `out/evidence/playwright-artifacts/`. A passing software-rendered run does not establish real-GPU frame rate, pacing or physical-device behavior.

Record one uninterrupted rehearsal, visiting the launcher and all three presentations in a single page:

```sh
taskset -c 11 unshare -rn env OMP_NUM_THREADS=1 REHEARSAL_LABEL=before SCENE_SECONDS=12 node tests/rehearsal.mjs
taskset -c 11 env OMP_NUM_THREADS=1 node tests/extract-frames.mjs ../../out/rehearsals/before/rehearsal-before.webm
```

Watch the extracted regular-interval frames and inspect full-size frames for text and visuals; record the problems and concrete fixes in STATUS.md. Rebuild into a fresh extraction, then repeat using `KIT_DIR=/path/to/fresh-extraction REHEARSAL_LABEL=after SCENE_SECONDS=20` and the corresponding `after` video path. The final lattice establishment and Rhine evidence scenes hold for at least 30 seconds; the opening field clip plays for at least 8 seconds before comparison. `events.json` records scene times, planned holds, intervention times and browser errors; `frames.json` records video duration, hash and regular sampling times. The video is a silent operator rehearsal; the speaker guides provide narration for a live presentation. Keep the first recording even when it reveals failures. Scripts do not use GitHub CI.
