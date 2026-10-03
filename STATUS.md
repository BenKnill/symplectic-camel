# Presentations lane status

This checkpoint made progress: source fixes, local browser evidence and delivery artifacts are audited against the full lane brief.

1. PASS — Offline ZIP, hash, fresh extraction and file launcher. Command: `python3 presentation-kit/build.py; python3 -m zipfile -e; python3 presentation-kit/audit-delivery.py`. Evidence: `../out/build.json; ../out/kit-extracted-final/manifest.json`.
2. PASS — Isolated real-browser rendering and interaction suite. Command: `taskset -c 11 unshare -rn env KIT_DIR=/home/bluestar/lanes/presentations/out/kit-extracted-final npm test (from presentation-kit)`. Evidence: `../out/evidence/playwright-results.json; ../out/evidence/*-camel.json, *-lattice.json, *-rhine.json`.
3. PASS — Representative screenshots for every scene. Command: `the offline Playwright suite; manual three-viewport visual review`. Evidence: `../out/screenshots/; ../out/reviews/final-visual-review.json`.
4. PASS — Two uninterrupted rehearsals, watched frames and fixes. Command: `tests/rehearsal.mjs followed by tests/extract-frames.mjs (commands in presentation-kit/tests/README.md)`. Evidence: `../out/rehearsals/before/; ../out/rehearsals/after/; ../out/reviews/first-rehearsal-review.json`.
5. PASS — Rhine footage recovery and provenance. Command: `sha256sum -c SHA256SUMS; ffprobe; ffmpeg full decode; audit-delivery.py`. Evidence: `../out/rhine-footage/recovery.json; ../rhine-dimples/FOOTAGE-MANIFEST.json`.
6. PASS — QA report with passed, failed and untested boundaries. Command: `python3 presentation-kit/audit-delivery.py --write-reports`. Evidence: `QA-REPORT.md; ../out/evidence/delivery-audit.json`.
7. PASS — One-page speaker notes and all review branches pushed. Command: `offline Playwright notes print test; git ls-remote --heads origin refs/heads/codex/oliver-live-cloud-review-oct3`. Evidence: `../out/evidence/speaker-notes-pages.json; ../out/evidence/delivery-audit.json`.

Kit: `/home/bluestar/lanes/presentations/out/presentations-kit.zip`
SHA-256: `28ba324412c37198b017de7e5c2629bd602616943ed4f7354db4c97e2d12fbdc`

## Problems found by watching the first rehearsal and changes

- The Camel time trace is cut off inside its sidebar. The separate map-scene counter also competes with the guided beat count. Make the desktop main panel tall enough for all measurements, reduce shadow/trace sizes slightly, remove excess readout margins and hide the redundant map counter in presenter mode. Short windows scroll the document instead of cropping the chart. Evidence: `frames/frame-003.png` in the before recording.
- Rhine briefly opens with an empty heading and prediction, and a missing-footage message while the recovered local clip is loading. Provide meaningful initial HTML heading and prediction, an honest loading message and cached-media initialization. Evidence: `frames/frame-011.png` in the before recording.
- Rhine controls fall below the recorded viewport; clicking Next causes scrolling. The closing video grows too large because its height selector no longer matches. Place main scene navigation before the visuals and constrain the closing video explicitly while preserving the full image. Evidence: `frames/frame-014.png and frames/frame-017.png` in the before recording.
- The recorded circulation action does not perform the opposite-pair cancellation requested by the prediction. The pressure action also does not double the prompted value. Some conclusions arrive too quickly to read. Rehearse the actual prompts: circulation 40 then 80; opposite pair with centre zero and radius three; reveal spins and top view. Lengthen scene dwell and leave time after each revealed consequence. Evidence: `frames/frame-014.png and before/events.json` in the before recording.

Additional after-recording finding: After the first layout fixes, the instructed radius-three measuring loop was clipped by the shorter Rhine canvas. A closed contour should remain visibly closed during the cancellation demonstration. Scale the live circulation view to the available height while preserving the numerical integral and pointer-coordinate mapping; repeat the complete uninterrupted rehearsal and full suite. Evidence: `out/rehearsals/after-v1/frames/frame-023.png`. The intermediate recording and intentionally superseded partial run remain under `../out/rehearsals/after-v1/` and `../out/qa-final-v1/`.

Additional tablet image-review finding: At 1024×768 the fixed-height Camel app grid allocated less vertical space than its 650px main panel; the controls overlapped the lower sidebar and were partly hidden by the projection. Let the desktop/tablet app height follow content and reserve a minimum 650px grid track for the main panel; add an explicit sibling-separation browser assertion for every scene. Evidence: `out/reviews/secondary-tablet-camel-overlap.png`. The earlier automated run missed sibling overlap; its passing result remains historical under `../out/qa-final-v2/`, with the corresponding recording under `../out/rehearsals/after-v2/`.

## Decisions and limits

- Preserved reviewed numerical/controller fixes and kept theorem, numerical illustration, formally verified kernel and unverified browser-rendering scopes explicit. No new HOL replay is claimed.
- Coordinator supplied the recovered original Rhine bookends. Their exact source paths and hashes are in the recovery report. Private media is in the local ZIP, ignored by Git; the committed source and builder require restoring those verified files. No footage or large frame folders were published.
- Heavy work used CPU 11. All validation ran locally; no GitHub CI, deployment or outward messages.
- SwiftShader validates software rendering, not real-GPU frame rate or pacing. Phone/touch tests are emulation; physical devices and a real-GPU Mac rehearsal remain untested.

## Next

No remaining lane completion work. Ben’s later real-GPU and physical-device rehearsal is outside this verified local kit.
