# Presentations lane status

Goal audit: work in progress. Initial inspection found clean reviewed source branches and no lane browser/recording evidence. No previous goal turn is available to classify; this turn has made progress by inspecting authoritative sources and starting implementation.

1. FAIL — offline zip and SHA-256: build and fresh extraction pending. Evidence will be `../out/build.json` and `../out/kit.sha256`.
2. FAIL — the initial `unshare -rn` browser run is preserved under `../out/qa-before/` and was intentionally superseded after the visual/reset fixes. Complete final run pending; output `../out/evidence/playwright-results.json`.
3. FAIL — representative scene screenshots: pending; destination `../out/screenshots/`.
4. FAIL — first uninterrupted recording completed and its regular-interval frames watched. Findings and fixes are recorded in `../out/reviews/first-rehearsal-review.json`; the after recording is running. Commands: `tests/rehearsal.mjs` and `tests/extract-frames.mjs`.
5. PASS — recovered original footage: `sha256sum -c from-mac/live-media/SHA256SUMS` and full local decode verified; source paths and hashes in `../out/rhine-footage/recovery.json` and `rhine-dimples/FOOTAGE-MANIFEST.json`. The coordinator supplied the Mac transfer after the bounded search started; partial search evidence is preserved.
6. FAIL — QA report with passed/failed/untested: final evidence pending. Real-GPU rendering/pacing and physical devices remain untested.
7. FAIL — concise kit speaker notes and all three branch pushes: source adaptation underway; remote branch verification pending.

## Changes this checkpoint

- Read the lane brief and shared rules; retained all reviewed numerical/controller fixes.
- Assigned separate source, footage and browser-validation work within the lane.
- Chose a self-contained, committed kit source snapshot and build script in `presentation-kit/`, with direct `file://` entry points. Runtime dependencies are vendored with licence notices.

## Decisions and scope

- The coordinator recovered the original Rhine bookends from Ben’s Mac. Use the verified local media, retain labelled model illustrations, and exclude the private footage and large source frames from public Git commits as the transfer note requires.
- Chromium SwiftShader is correctness/screenshot evidence only. Real-GPU rehearsal on Ben's Mac and physical mobile devices are untested; narrated videos remain unavailable.
- Use CPU 11 for heavy local work, no GitHub CI, no deployment and no messages to others. Only the three `codex/oliver-live-cloud-review-oct3` branches may be pushed.

Baseline ZIP built successfully: `/home/bluestar/lanes/presentations/out/presentations-before.zip`, SHA-256 `86f52c1410d0b977a560a581bb7f9cee1fdb49c940851110c94e1129ed8939e7`. The first uninterrupted visual rehearsal is running against its fresh extraction. Browser completion remains unproven.

## Next

Finish compact guided sources and notes, assemble and extract the kit, run offline browser checks, record/watch/fix/re-record the full sequence, then commit and push tested sources and audit all checks.

## Rehearsal-fix checkpoint

- Watched the before contact sheet and full-size frames; fixed clipped Camel trace/redundant counter, blank Rhine startup, below-fold navigation and oversized closing clip. Corrected operator interventions and increased reading time.
- Strengthened reset coverage with real camera drag/zoom and a single playback toggle; preserved automatic rehearsal behavior.
- Rebuilt final private ZIP under `unshare -rn` and extracted into `../out/kit-extracted-final/`. A second offline build is byte-identical (evidence `../out/evidence/reproducibility.json`).
- Final ZIP SHA-256: `8840803dc3cdb89d8e9025349adbef68ed98d033b1cad52ad0c3df7e36e275c1`. Final browser checks, after-video inspection and final report generation remain.
