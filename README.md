# The Symplectic Camel

An interactive WebGL animation of Gromov's non-squeezing theorem: a 4-ball B⁴(r) cannot be moved symplectically into a cylinder B²(R) × ℝ² unless r ≤ R.

It has four scenes: a volume-preserving squeeze (fits, but isn't symplectic), a linear symplectic squeeze, a nonlinear Hamiltonian flow, and a cylinder over a Lagrangian plane (fits). In every scene, the shadow on the (x₁, y₁) plane is measured live.

Open `docs/index.html` in a browser. It needs no build step. Three.js r128 is included locally in `docs/vendor/`, with its MIT notice; optional web fonts have system fallbacks.


## Live rehearsal edition

Open `docs/index.html?present=1` (through a local HTTP server if your browser needs it). Five guided beats take about two minutes, with prediction, next/back, deterministic scene reset, speaker notes, keyboard shortcuts and optional fullscreen. `docs/live-guide.html` records the claim/measurement boundaries.

Run `node tests/live-models.mjs` and `node tests/live-controls.mjs`. The controller test uses a minimal DOM harness, not a browser rendering check. The sampled shadow does not certify the theorem; linear containment badges use the analytic map.

## Offline three-presentation kit

`presentation-kit/` contains the source snapshot, deterministic builder, local Playwright suite and rehearsal tools for Camel, Chaos backwards and Rhine. See `presentation-kit/README.md` for the verified private-media restore and build commands; `STATUS.md` and `QA-REPORT.md` record delivery evidence and its limits. The consumer ZIP opens directly from a freshly extracted folder with networking disabled.
