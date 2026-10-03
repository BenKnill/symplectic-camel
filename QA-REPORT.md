# Local QA report

## Passed

- Offline ZIP, hash, fresh extraction and file launcher. Evidence: `../out/build.json; ../out/kit-extracted-final/manifest.json`.
- Isolated real-browser rendering and interaction suite. Evidence: `../out/evidence/playwright-results.json; ../out/evidence/*-camel.json, *-lattice.json, *-rhine.json`.
- Representative screenshots for every scene. Evidence: `../out/screenshots/; ../out/reviews/final-visual-review.json`.
- Two uninterrupted rehearsals, watched frames and fixes. Evidence: `../out/rehearsals/before/; ../out/rehearsals/after/; ../out/reviews/first-rehearsal-review.json`.
- Rhine footage recovery and provenance. Evidence: `../out/rhine-footage/recovery.json; ../rhine-dimples/FOOTAGE-MANIFEST.json`.
- QA report with passed, failed and untested boundaries. Evidence: `QA-REPORT.md; ../out/evidence/delivery-audit.json`.
- One-page speaker notes and all review branches pushed. Evidence: `../out/evidence/speaker-notes-pages.json; ../out/evidence/delivery-audit.json`.

Browser results (generated from Playwright): `{"duration": 937574.7080000001, "expected": 13, "flaky": 0, "skipped": 2, "startTime": "2026-10-03T15:12:53.955Z", "unexpected": 0}`.
Recorded renderer(s): `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
All scenes were traversed both ways using buttons, keyboard and emulated touch at each viewport. Reset comparisons follow real parameter, motion and camera changes. Original Rhine videos decode/play from local files; the switchable illustration exercises WebGL2. No non-file requests, console errors, uncaught errors or missing local resources occurred in the passing suite.

## Failed / historical findings

No unresolved delivery failures.

The first rehearsal revealed clipped Camel measurements, blank Rhine startup text, off-screen Rhine controls, an oversized closing clip and operator actions that did not match the prediction prompts. The source/rehearsal corrections and retained recordings are verified only when delivery check 4 is PASS. `../out/reviews/first-rehearsal-review.json` records the findings; `../out/reviews/final-visual-review.json` records the after review. Initial browser-run artifacts are retained under `../out/qa-before/`; that optional run was intentionally superseded, not counted as a full pass. The intermediate after recording then exposed a clipped closed measuring contour. Its view scale was corrected without changing the integral, and the entire recording/suite was repeated. That intermediate recording and intentionally interrupted partial browser run remain under `../out/rehearsals/after-v1/` and `../out/qa-final-v1/`.
A later tablet screenshot review found Camel controls overlapping the main panel despite the existing automated assertions passing. The content-sized grid fix and new explicit sibling-separation assertion close that coverage gap. The historical run and its images are retained under `../out/qa-final-v2/`; the matching recording is under `../out/rehearsals/after-v2/`.
The initial snapshot whitespace check flagged trailing blank lines copied unchanged from vendored Three.js and the reviewed figure source. Their bytes were deliberately preserved; this was not a rendering/model failure.

## Untested

- Real-GPU rendering, frame rate and pacing on Ben’s Mac: this environment uses software SwiftShader; the Mac rehearsal is a separate later step.
- Physical phones, tablets and touch hardware: the three viewports and touch events use Chromium emulation.
- Other browser engines and OS-specific file-origin policies: the kit was exercised in the recorded Chromium build on this machine.
- New HOL Light proof replay or native-kernel comparison: numerical/controller regressions are local evidence; the presentation does not broaden the existing formal kernel proof to JavaScript or rendered pixels.
- Narrated delivery and unavailable narrated-video originals: the recordings are continuous silent operator rehearsals; one-page notes supply the spoken explanation.
- Deployment, public distribution of private footage and GitHub CI were not performed.

## Reproduce

Use `presentation-kit/README.md` and `presentation-kit/tests/README.md`. Restore the hash-pinned private media for a new checkout, build the ZIP, extract to a fresh directory, then run the local suite with `unshare -rn`. `audit-delivery.py` verifies current artifact hashes and remote branch equality without relying on CI.
