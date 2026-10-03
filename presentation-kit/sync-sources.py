#!/usr/bin/env python3
"""Refresh committed kit source from the four sibling presentation checkouts."""
from pathlib import Path
import hashlib, json, re, shutil, subprocess

HERE = Path(__file__).resolve().parent
LANE = HERE.parents[1]
SOURCES = {
    'camel': ('symplectic-camel', ['index.html', 'presenter.js', 'presenter.css', 'live-guide.html', 'vendor/three-r128.min.js', 'vendor/THREE-LICENSE.txt']),
    'lattice': ('lattice-echo', ['live.html', 'live.js', 'live.css', 'lattice.js', 'camel.js', 'live-guide.html']),
    'rhine': ('rhine-dimples', ['live.html', 'live.js', 'live.css', 'live-story.js', 'vortex.js', 'water.js', 'figs.js', 'live-guide.html']),
    'soap': ('soap-films', ['live.html', 'live.css', 'live.js', 'live-model.js', 'live-guide.html', 'steiner.js', 'surface.js', 'film3d.js', 'filmcolor.js']),
}
manifest = {'purpose': 'Exact source hashes identify the worktree content copied; git HEAD is context, not a claim that the worktree was clean.', 'sources': {}}
for slug, (repo, names) in SOURCES.items():
    source = LANE / repo
    for name in names:
        if not (source / 'docs' / name).is_file():
            raise SystemExit(f'Missing required source: {source / "docs" / name}')
    dest = HERE / 'src' / slug
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    source_hashes = {}
    for name in names:
        f = source / 'docs' / name
        raw = f.read_bytes()
        source_hashes['docs/' + name] = hashlib.sha256(raw).hexdigest()
        output_name = 'index.html' if name == 'live.html' else name
        target = dest / output_name
        target.parent.mkdir(parents=True, exist_ok=True)
        if f.suffix == '.html':
            html = raw.decode()
            html = re.sub(r'<link\b[^>]*https://fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*', '', html, flags=re.I)
            for other_slug, (other_repo, _) in SOURCES.items():
                entry = 'index.html?present=1' if other_slug == 'camel' else 'index.html'
                html = re.sub(r'\.\./\.\./' + other_repo + r'/docs/(?:index|live)\.html(?:\?present=1)?', '../' + other_slug + '/' + entry, html)
                html = html.replace('https://benknill.github.io/' + other_repo + '/', '../' + other_slug + '/' + entry)
            html = html.replace('href="live.html"', 'href="index.html"')
            # Standalone live sources have no need for old exploratory article dependencies.
            if slug != 'camel':
                html = html.replace('href="../LIVE-SOURCE-CHECKPOINT.md"', 'href="../provenance.json"')
            if output_name == 'index.html':
                html = html.replace('<header>', '<header><a href="../index.html" class="kit-home">All four presentations</a>', 1)
            target.write_text(html)
        else:
            target.write_bytes(raw)
    manifest['sources'][repo] = {
        'head_at_sync': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip(),
        'files_sha256': source_hashes,
    }
media = LANE / 'rhine-dimples' / 'docs' / 'live-media'
expected = {}
for line in (LANE / 'from-mac/live-media/SHA256SUMS').read_text().splitlines():
    digest, name = line.split(maxsplit=1)
    expected[name] = digest
for name, digest in expected.items():
    data = (media / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit('Recovered media hash mismatch: ' + name)
    dest = HERE / 'src/rhine/live-media' / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
manifest['recovered_footage'] = {'source': str(LANE / 'from-mac/live-media'), 'files_sha256': expected, 'rights': 'Ben’s own boat footage, 1 June 2026. Local authorized review only; media excluded from public Git commits.'}
(HERE / 'src' / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
