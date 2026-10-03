# Offline presentation kit

This directory contains the kit code, notes and vendored dependency under `src/`, a deterministic standard-library build script, and local browser validation. A consumer only extracts the ZIP and opens `index.html` from `file://`; there is no installation or server requirement. Three.js r128 is vendored with its MIT notice. The browser test dependency is development-only and excluded from the ZIP.

Build from the committed kit source plus the recovered private media with the machine's uv-managed Python (no project dependencies):

```sh
python3 presentation-kit/build.py --output ../out/presentations-kit.zip
python3 -m zipfile -e ../out/presentations-kit.zip ../out/kit-extracted
```

When adapting the sibling reviewed checkouts, update their `docs/` sources first, then run `python3 presentation-kit/sync-sources.py`. It snapshots only the live entry points, assets and notes, rewrites internal links for the kit, and removes optional Google Fonts requests. `src/provenance.json` records exact original hashes and the Git HEAD at the time of copying. Commit the updated snapshot. A build does not read sibling checkouts or use networking. The recovered footage is deliberately ignored by Git: the transfer note permits local review and forbids publication. On a fresh checkout, restore the four files from the verified `from-mac/live-media/` transfer to `presentation-kit/src/rhine/live-media/`; `src/provenance.json` pins every hash, and the build rejects missing or altered media. Large source frame folders are not copied into the kit.

Local browser and rehearsal commands are documented in `tests/README.md`. Run the browser checks under `taskset -c 11 unshare -rn`; do not use GitHub CI. Browser rendering uses software SwiftShader here and cannot establish real-GPU performance or physical-device behavior.
