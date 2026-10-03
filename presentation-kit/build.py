#!/usr/bin/env python3
"""Build a deterministic offline ZIP from this source snapshot and verified local private media (stdlib only)."""
from pathlib import Path
import argparse, hashlib, json, zipfile

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--output', type=Path, default=HERE.parents[1] / 'out' / 'presentations-kit.zip')
a = p.parse_args()
files = {str(f.relative_to(HERE / 'src')): f.read_bytes() for f in sorted((HERE / 'src').rglob('*')) if f.is_file()}
for required in ['index.html', 'camel/vendor/THREE-LICENSE.txt', *[x + '/' + page for x in ['camel','lattice','rhine','soap'] for page in ['index.html','live-guide.html']]]:
    if required not in files:
        p.error('Missing kit source: ' + required + '; run sync-sources.py after sibling sources are ready')
provenance = json.loads(files['provenance.json'])
for name, digest in provenance['recovered_footage']['files_sha256'].items():
    key = 'rhine/live-media/' + name
    if key not in files or hashlib.sha256(files[key]).hexdigest() != digest:
        p.error('Recovered private media missing or changed: ' + key + '; restore verified local media before building')
manifest = {'files_sha256': {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}}
files['manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
a.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(a.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(files.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 3, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
print(json.dumps({'archive': str(a.output.resolve()), 'sha256': hashlib.sha256(a.output.read_bytes()).hexdigest(), 'bytes': a.output.stat().st_size, 'files': len(files)}, indent=2))
