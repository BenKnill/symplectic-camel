# Presentations lane status

Goal audit: work in progress. Initial inspection found clean reviewed source branches and no lane browser/recording evidence. No previous goal turn is available to classify; this turn has made progress by inspecting authoritative sources and starting implementation.

1. FAIL — offline zip and SHA-256: build and fresh extraction pending. Evidence will be `../out/build.json` and `../out/kit.sha256`.
2. FAIL — isolated browser suite: pending `unshare -rn` Playwright run against extracted kit. Evidence will be `../out/evidence/browser-qa.json`.
3. FAIL — representative scene screenshots: pending; destination `../out/screenshots/`.
4. FAIL — uninterrupted before/after rehearsals and watched-frame fixes: pending; destination `../out/rehearsals/`.
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
