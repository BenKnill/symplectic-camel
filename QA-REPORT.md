# Wave 2 local QA report

## Passed

- Soap presentation, one-page notes and source integrity. Evidence: `soap-films/validation/; out/wave2/evidence/speaker-notes-pages.json; kit provenance`.
- All-four isolated offline browser suite and screenshots. Evidence: `out/wave2/evidence/playwright-results.json; out/wave2/screenshots/; out/wave2/reviews/final-visual-review.json`.
- All-four before/after rehearsals, watched and fixed. Evidence: `out/wave2/rehearsals/{before,after}/; out/wave2/reviews/before-rehearsal-review.json`.
- Bounded real-GPU attempt with a verified terminal result. Evidence: `out/wave2/real-gpu/result.json and its referenced raw evidence`.
- Updated ZIP, checksum, reports and pushed review branches. Evidence: `out/wave2/build.json; out/kit.sha256; out/wave2/evidence/delivery-audit.json`.

Browser result, copied from the final generated report: `{"duration": 1116416.96, "expected": 16, "flaky": 0, "skipped": 2, "startTime": "2026-10-03T17:40:07.665Z", "unexpected": 0}`.
Software renderer: ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver).
Every scene has mouse, keyboard and emulated-touch forward/back traversal, a real state-changing intervention followed by reset, visible rendering, resize checks and screenshots. No requests outside the file-only extracted kit, console errors, uncaught errors or failed local resources were observed.
Supplemental Camel result after strengthening screenshot checks: `{"duration": 409706.73400000005, "expected": 3, "flaky": 0, "skipped": 0, "startTime": "2026-10-03T18:17:47.589Z", "unexpected": 0}`. The unchanged audience ZIP was tested; the original complete suite and its harness remain preserved. All Camel scene images now pass both live WebGL and saved-PNG checks. A final capture sweep excludes DOM overlays, rechecks the unchanged reviewed images, and rejects overlay-only blank-canvas fixtures at each viewport. Evidence: `out/wave2/reviews/capture-remediation.json`; `out/wave2/qa-camel-overlay-check/evidence/overlay-check.json`.

## Failed / historical findings

No unresolved delivery failures.
- After the second soap dip, two five-edge networks with different gaps are overlaid; their union looks like a complete six-edge hexagon. The equal-length readout also says 0.00% longer. Clear the competitor overlay when changing dips, preserve a computed first-versus-second length comparison, and describe equal lengths as equal when an overlay is deliberately enabled. Retained evidence: `out/wave2/rehearsals/before/frames/frame-021.png`.
- The tetrahedral film stays at one camera angle while its cue asks the presenter to rotate; a rear triple line is occluded, making the four-line junction hard to inspect. Use a slow real camera drag before highlighting the junctions, in both Linux and native GPU rehearsal actions. Retained evidence: `out/wave2/rehearsals/before/frames/frame-022.png and before/events.json (no camera intervention)`.
- The first all-four pass moves through the dense proof/establishment panels too quickly to read them and inspect the changed wire frame. Lengthen ordinary final scene holds and keep the Lattice, Rhine and Soap establishment panels visible for at least30seconds. Retained evidence: `out/wave2/rehearsals/before/frames/frame-023.png and before/events.json planned scene holds`.
- Final manual phone review caught a black Camel nonlinear-scene capture despite successful draw-call assertions. Fresh live/capture probes did not reproduce a persistent runtime defect. The harness now brings the canvas into view and checks both live pixels and the saved PNG, with no silent capture retries. All Camel cases were rerun at all three sizes and independently reviewed. The failed image/review remain in `out/wave2/reviews/first-final-visual-failure/`; source files, ZIP and rehearsal recordings did not change.

Real-GPU outcome: **recorded**. ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 (0x00001F14) Direct3D11 vs_5_0 ps_5_0, D3D11) The attempt result includes duration, owned profile/process cleanup and raw evidence.
The complete attempt took 2579.664 seconds including preparation. Visible idle calibration: 180 samples, median 16.70 ms, p95 17.60 ms, mean 60.00 Hz. This detects idle throttling; it is not an application throughput guarantee.
Recording: `/home/bluestar/lanes/presentations/out/wave2/real-gpu/rehearsal-windows-nvidia.mkv` (275.36 seconds), SHA-256 `701412e926e8128d724490280a8e74fab1716da10b3142118abe07756396ac86`.
GPU recording limit: CDP everyNthFrame=6 plus a 95ms frame-spacing filter captures continuous rendering but may omit isolated static repaints. Contact-sheet inspection shows Soap scene0 prediction followed by scene1; the reveal action was executed but its settled-network repaint is not visibly demonstrated. Rhine opening comparison also remains footage in the sampled video. The separate full Linux rehearsal is the visual intervention evidence.
GPU recording limit: Original MP4 edit-list duration omitted its final two encoded frames. Lossless Matroska remux of those already-recorded packets restores all755 frames and final Soap scene; no native attempt was extended or restarted.

Observed scene rAF rates during native capture (includes work and capture overhead):

| App | Minimum mean Hz | Maximum mean Hz |
| --- | ---: | ---: |
| camel | 13.49 | 29.14 |
| lattice | 55.01 | 58.15 |
| rhine | 39.62 | 59.14 |
| soap | 54.82 | 60.00 |

Preserved negative evidence: the first native launch timed out while inheriting console handles; its profile was closed. The original MP4 edit list truncated playback despite retaining all packets. A lossless local Matroska remux after Windows cleanup restored the captured timeline; original files and repair evidence remain under `out/wave2/real-gpu/`.

Wave 1 history is retained separately under `out/wave1/`; its three-app results do not establish this four-app delivery.

## Untested

- Physical phones, tablets and touch hardware: Chromium viewport/input emulation only.
- Ben’s Mac, other browser engines and OS-specific file policies beyond the recorded environments.
- Narrated performance: the recorded operator rehearsals are silent; the speaker guides supply the spoken explanation.
- New formal proof replay, global optimization certification, solver convergence certification and rendered-pixel verification by theorem.
- Public deployment and GitHub CI were not performed.

## Reproduce

Use `presentation-kit/README.md` and `presentation-kit/tests/README.md`. The full browser command runs under `taskset -c 11 unshare -rn` with explicit Wave 2 kit/output paths. Windows-attempt scripts and raw logs are in `out/wave2/real-gpu/`. Run `python3 presentation-kit/audit-wave2.py` for a read-only delivery audit; `--write-reports` regenerates the reports.
