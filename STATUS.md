# Presentations lane — Wave 2

Evidence paths below are relative to the presentations lane root.

1. PASS — Soap presentation, one-page notes and source integrity. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `soap-films/validation/; out/wave2/evidence/speaker-notes-pages.json; kit provenance`.
2. PASS — All-four isolated offline browser suite and screenshots. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `out/wave2/evidence/playwright-results.json; out/wave2/screenshots/; out/wave2/reviews/final-visual-review.json`.
3. PASS — All-four before/after rehearsals, watched and fixed. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `out/wave2/rehearsals/{before,after}/; out/wave2/reviews/before-rehearsal-review.json`.
4. PASS — Bounded real-GPU attempt with a verified terminal result. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `out/wave2/real-gpu/result.json and its referenced raw evidence`.
5. PASS — Updated ZIP, checksum, reports and pushed review branches. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `out/wave2/build.json; out/kit.sha256; out/wave2/evidence/delivery-audit.json`.

Kit: `/home/bluestar/lanes/presentations/out/presentations-kit.zip`
SHA-256: `37118c0f174c9eb338b95fd9ff30c2e3e3198b3349932a634cd7ad236f4ba85e`

## What changed

- Added The Soap Computer as the fourth compact presentation with one-page notes, using the existing network and surface engines; no new physics or Blender rendering.
- Extended offline navigation, scene/input/reset/render/resize checks and continuous rehearsals to all four presentations. Wave 1 remains archived under `out/wave1/ARCHIVE.json`.
- Watched-before finding: After the second soap dip, two five-edge networks with different gaps are overlaid; their union looks like a complete six-edge hexagon. The equal-length readout also says 0.00% longer. Fix: Clear the competitor overlay when changing dips, preserve a computed first-versus-second length comparison, and describe equal lengths as equal when an overlay is deliberately enabled. Evidence: `out/wave2/rehearsals/before/frames/frame-021.png`.
- Watched-before finding: The tetrahedral film stays at one camera angle while its cue asks the presenter to rotate; a rear triple line is occluded, making the four-line junction hard to inspect. Fix: Use a slow real camera drag before highlighting the junctions, in both Linux and native GPU rehearsal actions. Evidence: `out/wave2/rehearsals/before/frames/frame-022.png and before/events.json (no camera intervention)`.
- Watched-before finding: The first all-four pass moves through the dense proof/establishment panels too quickly to read them and inspect the changed wire frame. Fix: Lengthen ordinary final scene holds and keep the Lattice, Rhine and Soap establishment panels visible for at least30seconds. Evidence: `out/wave2/rehearsals/before/frames/frame-023.png and before/events.json planned scene holds`.
- Windows GPU attempt: recorded. ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 (0x00001F14) Direct3D11 vs_5_0 ps_5_0, D3D11) Evidence: `out/wave2/real-gpu/result.json`.
- Footage recovery: **RECOVERED** from `/Users/boxer/Documents/Codex/2026-10-02/task-4/rhine-dimples/docs/live-media/`. Source paths and verified hashes: `out/rhine-footage/recovery.json`; local copies: `rhine-dimples/docs/live-media/`.

## Decisions and limits

- Theorem, numerical model and rendering claims remain separate. Soap mesh topology is prescribed; two selected network outcomes do not measure success rates or prove global optimality.
- Recovered Rhine footage remains private local media with pinned source hashes; it is not committed or published.
- CPU 11 for heavy Linux work. Local checks only; no GitHub CI, deployment, public distribution or Ben browser profile use.
- Phone and tablet checks are emulation. Physical devices, Ben’s Mac and narrated delivery remain untested.

## Next

All Wave 2 delivery checks are complete.
