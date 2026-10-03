# Offline presentation kit

This directory contains the four-presentation kit (Camel, Lattice, Rhine and The Soap Computer), notes and vendored dependency under `src/`, a deterministic standard-library build script, and local browser validation. A consumer only extracts the ZIP and opens `index.html` from `file://`; there is no installation or server requirement. Three.js r128 is vendored with its MIT notice. The browser test dependency is development-only and excluded from the ZIP.

Create `../out/wave2/` if needed and use a fresh `../out/wave2/kit-extracted-final/` directory. Wave 1 is preserved separately in `../out/wave1/`; do not overwrite its recordings or evidence. Build from the committed kit source plus the recovered private media with the machine's uv-managed Python (no project dependencies):

```sh
python3 presentation-kit/build.py --output ../out/wave2/presentations-kit.zip > ../out/wave2/build.json
python3 -m zipfile -e ../out/wave2/presentations-kit.zip ../out/wave2/kit-extracted-final
cp ../out/wave2/presentations-kit.zip ../out/presentations-kit.zip
sha256sum ../out/presentations-kit.zip > ../out/kit.sha256
```

When adapting the sibling reviewed checkouts, update their `docs/` sources first, then run `python3 presentation-kit/sync-sources.py`. It snapshots only the live entry points, assets and notes, rewrites internal links for the kit, and removes optional Google Fonts requests. `src/provenance.json` records exact original hashes and the Git HEAD at the time of copying. Commit the updated snapshot. A build does not read sibling checkouts or use networking. The recovered footage is deliberately ignored by Git: the transfer note permits local review and forbids publication. On a fresh checkout, restore the four files from the verified `from-mac/live-media/` transfer to `presentation-kit/src/rhine/live-media/`; `src/provenance.json` pins every hash, and the build rejects missing or altered media. Large source frame folders are not copied into the kit.

Local browser and rehearsal commands are documented in `tests/README.md`. Run the browser checks under `taskset -c 11 unshare -rn`; do not use GitHub CI. Browser rendering uses software SwiftShader here and cannot establish real-GPU performance or physical-device behavior.

Audit all delivery checks and regenerate the lane reports from actual artifacts with `python3 presentation-kit/audit-wave2.py --write-reports` from the repository root. This checks the ZIP and extracted source hashes, unchanged soap engines, all-four final browser coverage, screenshots and manual visual review, four-app before/after recordings and sampled frames, one-page notes, the bounded Windows GPU attempt and pushed branch heads. `audit-delivery.py` is the historical Wave 1 checker and does not audit the four-presentation release. It fails closed when evidence is missing.

The Soap Computer reuses `steiner.js`, `surface.js`, `film3d.js` and `filmcolor.js` without changes. Its live adapter selects reproducible runs of the existing solvers. Plateau’s laws and Taylor’s interior local classification are theorem claims; mesh relaxation, selected network outcomes and rendered colours are illustrations. No new physics or Blender render is included. The upstream soap checkout had no top-level README; its `PLAN.md`, `RESEARCH.md`, existing page and Blender README were inspected. `soap-films/LIVE.md` now documents the live page and its local checks.

The Windows real-GPU experiment has its own isolated profile and evidence under `../out/wave2/real-gpu/`. A successful record must identify NVIDIA RTX 2070 WebGL contexts, include frame-timing evidence, and cover all four presentations from the final kit. A failed bounded attempt is documented as failed GPU validation even when the attempt requirement itself is complete. No existing browser profile is used.
