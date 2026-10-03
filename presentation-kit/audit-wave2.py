#!/usr/bin/env python3
"""Audit the full Wave 2 delivery; generate reports only from inspected local artifacts."""
import argparse
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO, LANE = HERE.parent, HERE.parent.parent
OUT = LANE / 'out' / 'wave2'
COUNTS = {'camel': 5, 'lattice': 4, 'rhine': 6, 'soap': 4}
VIEWPORTS = ('desktop-1440', 'tablet-1024', 'phone-emulation-390')
BRANCHES = {name: 'codex/oliver-live-cloud-review-oct3' for name in ('symplectic-camel', 'lattice-echo', 'rhine-dimples')}
BRANCHES['soap-films'] = 'codex/oliver-live-soap'
ERRORS = ('nonFileRequests', 'outsideKitRequests', 'consoleErrors', 'pageErrors', 'failedFileRequests')
FINAL = OUT / 'kit-extracted-final'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--write-reports', action='store_true')
a = p.parse_args()
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'evidence').mkdir(exist_ok=True)

def read(path):
    return json.loads(Path(path).read_text())
def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def require(condition, message):
    if not condition:
        raise ValueError(message)
def run(command):
    return subprocess.check_output(command, text=True, timeout=35).strip()
def local_git(repo, *args):
    return run(['git', '-C', str(LANE/repo), *args])
def archive_check(archive, extraction):
    manifest = read(extraction/'manifest.json')['files_sha256']
    with zipfile.ZipFile(archive) as z:
        require(set(z.namelist()) == set(manifest) | {'manifest.json'}, 'ZIP file set differs from manifest')
        require({str(f.relative_to(extraction)) for f in extraction.rglob('*') if f.is_file()} == set(z.namelist()), 'Extraction file set differs from ZIP')
        for name in z.namelist():
            data = z.read(name)
            require((extraction/name).read_bytes() == data, 'Archive/extraction mismatch: '+name)
            if name != 'manifest.json':
                require(hashlib.sha256(data).hexdigest() == manifest[name], 'Manifest hash mismatch: '+name)
    return manifest

def source_check():
    manifest = archive_check(OUT/'presentations-kit.zip', FINAL)
    for slug in COUNTS:
        for page in ('index.html', 'live-guide.html'):
            require(slug+'/'+page in manifest, 'Missing presentation or notes: '+slug+'/'+page)
    for name, expected in manifest.items():
        require(sha(HERE/'src'/name) == expected, 'Current committed snapshot differs from delivery: '+name)
    provenance = read(FINAL/'provenance.json')
    require(set(provenance['sources']) == set(BRANCHES), 'Kit provenance omits a repository')
    for repo, source in provenance['sources'].items():
        for name, expected in source['files_sha256'].items():
            require(sha(LANE/repo/name) == expected, 'Kit stale relative to source: '+repo+'/'+name)
    engines = {}
    for name in ('steiner.js', 'surface.js', 'film3d.js', 'filmcolor.js'):
        original = subprocess.check_output(['git', '-C', str(LANE/'soap-films'), 'show', 'f774ba5:docs/'+name], timeout=15)
        expected = hashlib.sha256(original).hexdigest()
        require(sha(LANE/'soap-films/docs'/name) == expected, 'Existing soap engine changed: '+name)
        engines[name] = expected
    notes = read(OUT/'evidence/speaker-notes-pages.json')
    require({x['presentation'] for x in notes} == set(COUNTS), 'Incomplete speaker notes print evidence')
    require(all(x['pages'] == 1 and Path(x['file']).is_file() for x in notes), 'Notes exceed one page or PDF absent')
    branch = BRANCHES['soap-films']
    require(local_git('soap-films', 'branch', '--show-current') == branch, 'Wrong soap review branch')
    soap_head = local_git('soap-films', 'rev-parse', 'HEAD')
    soap_remote = run(['git', '-c', 'http.version=HTTP/1.1', '-C', str(LANE/'soap-films'), 'ls-remote', '--heads', 'origin', 'refs/heads/'+branch]).split()[0]
    require(soap_head == soap_remote, 'Soap branch not pushed')
    return {'engines_unchanged_from': 'f774ba5', 'engine_hashes': engines, 'notes': notes, 'manifest_sha256': sha(FINAL/'manifest.json'), 'soap_branch': branch, 'soap_head': soap_head, 'soap_remote': soap_remote}

def browser_check():
    report = read(OUT/'evidence/playwright-results.json')
    require(int((OUT/'runs/final/exit-status').read_text()) == 0, 'Final browser process did not exit successfully')
    stats = report['stats']
    require(stats['expected'] == len(VIEWPORTS)*(len(COUNTS)+1)+1 and stats['skipped'] == len(VIEWPORTS)-1, 'Incomplete browser matrix')
    require(stats['unexpected'] == stats['flaky'] == 0, 'Browser failures or retries present')
    rows = []
    def walk(suites):
        for suite in suites:
            for spec in suite.get('specs', []):
                rows.extend((t['projectName'], spec['title'], t['results'][-1]['status']) for t in spec['tests'])
            walk(suite.get('suites', []))
    walk(report['suites'])
    expected = {(v, name+': every scene, input, reset, render, resize', 'passed') for v in VIEWPORTS for name in COUNTS}
    expected |= {(v, 'launcher and all local HTML links navigate offline', 'passed') for v in VIEWPORTS}
    expected |= {(v, 'speaker notes each print on one A4 page', 'passed' if v == VIEWPORTS[0] else 'skipped') for v in VIEWPORTS}
    require(len(rows) == len(expected) and set(rows) == expected, 'Unexpected test names, projects or terminal outcomes')
    screenshots, records = [], []
    for viewport in VIEWPORTS:
        for name, count in COUNTS.items():
            data = read(OUT/f'evidence/{viewport}-{name}.json')
            require(data['kitManifestSHA256'] == sha(FINAL/'manifest.json'), 'Browser evidence belongs to another kit')
            require(len(data['scenes']) == len(data['resets']) == count and all(x['pass'] for x in data['resets']), 'Incomplete scene/reset coverage')
            require({x['method'] for x in data['inputMethods']} == {'mouse', 'keyboard', 'touch'}, 'Missing input method')
            require(all(x['forward'] and x['backward'] and x['scenes'] == count for x in data['inputMethods']), 'Incomplete forward/back traversal')
            require(all(data[x] == [] for x in ERRORS), 'Browser errors or resources outside the extraction')
            require(not any(not x['internal'] for xs in data['networkInterfaces'].values() for x in xs), 'External network interface available during test')
            require(len(data['resize']) >= (6 if name == 'soap' else 3), 'Active renderer resize coverage absent')
            for entry in data['scenes'] + data['resize']:
                layout = entry['layout']
                require(layout['clipped'] == layout['clippedByAncestor'] == [], 'Clipped content')
                require(layout['scrollWidth'] <= layout['width']+2 and layout['traceFits'] and layout['controlsClearMain'], 'Layout overflow or overlap')
            if name != 'lattice':
                require(any(w['drawCalls'] > 0 for w in data['webgl']), 'No actual WebGL drawing')
            if name == 'soap':
                require(len(data['soapResults']) == count, 'Missing actual soap interventions')
                for s in data['soapResults']:
                    require(s['before'] != s['after'] and s['pixelsBefore']['digest'] != s['pixelsAfter']['digest'] and s['pixelsAfter']['colors'] > 10, 'Soap intervention lacks state/pixel evidence')
                    if s['scene'] < 2:
                        require(s['network']['connected'] and abs(s['network']['competitorLength']-5) < 1e-8, 'Soap comparison geometry not verified')
            if name == 'rhine':
                require(len(data['videos']) == 2 and all(v['played'] and v['decodedFrames'] > 0 for v in data['videos']), 'Recovered video decoding unverified')
                loop = data['closedContour']; bounds = loop['viewport']['contour']
                require(abs(loop['measured']) < 1e-6 and bounds['left'] >= 6 and bounds['top'] >= 6 and bounds['right'] <= loop['viewport']['width']-6 and bounds['bottom'] <= loop['viewport']['height']-6, 'Closed measuring contour cancellation/visibility failed')
            for scene in range(1, count+1):
                file = OUT/f'screenshots/{viewport}/{name}-{scene:02}.png'
                require(file.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), 'Missing scene screenshot: '+str(file))
                screenshots.append(str(file))
            records.append(data)
    review = read(OUT/'reviews/final-visual-review.json')
    require(review['status'] == 'PASS' and set(review['viewports_reviewed']) == set(VIEWPORTS), 'Manual viewport review incomplete')
    require(review['kit_manifest_sha256'] == sha(FINAL/'manifest.json'), 'Visual review is for another kit')
    return {'stats': stats, 'app_viewport_records': len(records), 'representative_screenshots': len(screenshots), 'renderers': sorted({w['renderer'] for d in records for w in d['webgl']}), 'review': review}

def rehearsal_check():
    videos = []
    for label in ('before', 'after'):
        folder = OUT/'rehearsals'/label
        events, frames = read(folder/'events.json'), read(folder/'frames.json')
        source = FINAL if label == 'after' else OUT/'kit-extracted-before'
        archive = OUT/('presentations-kit.zip' if label == 'after' else 'presentations-before.zip')
        archive_check(archive, source)
        require(Path(events['kit']) == source and events['kitManifestSHA256'] == sha(source/'manifest.json'), 'Rehearsal source binding failed: '+label)
        require(all(events[x] == [] for x in ERRORS), 'Rehearsal browser errors: '+label)
        require(events['events'][-1]['event'] == 'complete' and not any(e['event'] == 'failure' for e in events['events']), 'Rehearsal incomplete: '+label)
        require({(e['presentation'], e['scene']) for e in events['events'] if e['event'] == 'scene'} == {(name, scene) for name, count in COUNTS.items() for scene in range(count)}, 'Rehearsal omitted a scene or presentation')
        video = folder/f'rehearsal-{label}.webm'
        require(Path(frames['video']) == video and sha(video) == frames['sha256'], 'Rehearsal video hash/path mismatch')
        require(frames['intervalSeconds'] > 0 and len(frames['frames']) >= frames['durationSeconds']//frames['intervalSeconds'], 'Regular frame sampling incomplete')
        require(all(Path(f['file']).is_file() for f in frames['frames']), 'Sampled frames missing')
        videos.append({k: frames[k] for k in ('video', 'sha256', 'durationSeconds', 'intervalSeconds')})
    before = read(OUT/'reviews/before-rehearsal-review.json')
    after = read(OUT/'reviews/final-visual-review.json')
    require(before['watched'] and before['findings'], 'Before review/findings missing')
    require(after['status'] == 'PASS' and after['after_recording_watched'], 'After rehearsal not watched')
    require(after['after_video_sha256'] == videos[1]['sha256'] and videos[0]['sha256'] != videos[1]['sha256'], 'Before/after recording binding failed')
    require(all(f['resolved'] for f in before['findings']), 'Unresolved rehearsal finding')
    return {'videos': videos, 'findings': before['findings']}

def gpu_check():
    result = read(OUT/'real-gpu/result.json')
    require(result['attempted'] is True and result['outcome'] in ('recorded', 'impossible'), 'GPU attempt has no terminal result')
    require(0 < result['duration_seconds'] <= 2700, 'GPU attempt missing duration or exceeded its 45-minute bound')
    require(result['profile_isolated'] and result['owned_processes_closed'], 'GPU attempt isolation/cleanup not confirmed')
    require(result['evidence'] and all(Path(x).is_file() for x in result['evidence']), 'GPU raw evidence missing')
    if result['outcome'] == 'recorded':
        require('NVIDIA' in result['renderer'] and '2070' in result['renderer'], 'Real RTX renderer not established')
        require(result['raf_unthrottled'] is True and result['frame_timing'], 'Unthrottled frame timing not established')
        require(result['kit_manifest_sha256'] == sha(FINAL/'manifest.json'), 'GPU recording source is not the delivered kit')
        require(sha(result['recording']) == result['recording_sha256'], 'GPU recording missing or hash mismatch')
        require(set(result['presentations_recorded']) == set(COUNTS), 'GPU recording omitted a presentation')
    else:
        require(result['reason'].strip() and result['observed_failures'], 'GPU impossibility lacks observed reason/evidence')
    return result

def delivery_check():
    build = read(OUT/'build.json')
    require(sha(OUT/'presentations-kit.zip') == build['sha256'], 'Final archive differs from build result')
    require(sha(LANE/'out/presentations-kit.zip') == build['sha256'], 'Top-level delivered ZIP was not updated')
    require((LANE/'out/kit.sha256').read_text().split()[0] == build['sha256'], 'Published local checksum is stale')
    branches = []
    for repo, branch in BRANCHES.items():
        require(local_git(repo, 'branch', '--show-current') == branch, 'Wrong review branch: '+repo)
        local = local_git(repo, 'rev-parse', 'HEAD')
        remote = run(['git', '-c', 'http.version=HTTP/1.1', '-C', str(LANE/repo), 'ls-remote', '--heads', 'origin', 'refs/heads/'+branch]).split()[0]
        require(local == remote, 'Review branch not pushed: '+repo)
        dirty = subprocess.check_output(['git', '-C', str(LANE/repo), 'status', '--porcelain', '--untracked-files=all'], text=True).splitlines()
        require(all(line[3:] in ('STATUS.md', 'QA-REPORT.md') for line in dirty), 'Uncommitted implementation: '+repo)
        branches.append({'repo': repo, 'branch': branch, 'local': local, 'remote': remote})
    return {'build': build, 'branches': branches}

checks, evidence = {}, {}
for n, fn in ((1, source_check), (2, browser_check), (3, rehearsal_check), (4, gpu_check), (5, delivery_check)):
    try:
        evidence[str(n)] = fn(); checks[str(n)] = 'PASS'
    except Exception as exc:
        evidence[str(n)] = {'error': str(exc)}; checks[str(n)] = 'FAIL'

TITLES = {1: 'Soap presentation, one-page notes and source integrity', 2: 'All-four isolated offline browser suite and screenshots', 3: 'All-four before/after rehearsals, watched and fixed', 4: 'Bounded real-GPU attempt with a verified terminal result', 5: 'Updated ZIP, checksum, reports and pushed review branches'}
REFS = {1: 'soap-films/validation/; out/wave2/evidence/speaker-notes-pages.json; kit provenance', 2: 'out/wave2/evidence/playwright-results.json; out/wave2/screenshots/; out/wave2/reviews/final-visual-review.json', 3: 'out/wave2/rehearsals/{before,after}/; out/wave2/reviews/before-rehearsal-review.json', 4: 'out/wave2/real-gpu/result.json and its referenced raw evidence', 5: 'out/wave2/build.json; out/kit.sha256; out/wave2/evidence/delivery-audit.json'}
if a.write_reports:
    status = ['# Presentations lane — Wave 2', '', 'Evidence paths below are relative to the presentations lane root.', '']
    for n in range(1,6):
        status.append(f'{n}. {checks[str(n)]} — {TITLES[n]}. Command: `python3 presentation-kit/audit-wave2.py --write-reports` (repository root). Evidence: `{REFS[n]}`.')
    if (OUT/'build.json').is_file():
        build = read(OUT/'build.json'); status += ['', 'Kit: `'+str(LANE/'out/presentations-kit.zip')+'`', 'SHA-256: `'+build['sha256']+'`']
    status += ['', '## What changed', '', '- Added The Soap Computer as the fourth compact presentation with one-page notes, using the existing network and surface engines; no new physics or Blender rendering.', '- Extended offline navigation, scene/input/reset/render/resize checks and continuous rehearsals to all four presentations. Wave 1 remains archived under `out/wave1/ARCHIVE.json`.']
    if 'findings' in evidence['3']:
        status += ['- Watched-before finding: '+f['problem']+' Fix: '+f['fix']+' Evidence: `'+f['evidence']+'`.' for f in evidence['3']['findings']]
    if checks['4'] == 'PASS':
        g=evidence['4'];status += ['- Windows GPU attempt: '+g['outcome']+'. '+g.get('reason',g.get('renderer',''))+' Evidence: `out/wave2/real-gpu/result.json`.']
    status += ['', '## Decisions and limits', '', '- Theorem, numerical model and rendering claims remain separate. Soap mesh topology is prescribed; two selected network outcomes do not measure success rates or prove global optimality.', '- Recovered Rhine footage remains private local media with pinned source hashes; it is not committed or published.', '- CPU 11 for heavy Linux work. Local checks only; no GitHub CI, deployment, public distribution or Ben browser profile use.', '- Phone and tablet checks are emulation. Physical devices, Ben’s Mac and narrated delivery remain untested.', '', '## Next', '', 'All Wave 2 delivery checks are complete.' if all(x=='PASS' for x in checks.values()) else 'Resolve the remaining failing checks in out/wave2/evidence/delivery-audit.json.']
    qa = ['# Wave 2 local QA report', '', '## Passed', '']
    qa += ['- '+TITLES[n]+'. Evidence: `'+REFS[n]+'`.' for n in range(1,6) if checks[str(n)]=='PASS']
    if checks['2']=='PASS':
        qa += ['', 'Browser result, copied from the final generated report: `'+json.dumps(evidence['2']['stats'],sort_keys=True)+'`.', 'Software renderer: '+', '.join(evidence['2']['renderers'])+'.', 'Every scene has mouse, keyboard and emulated-touch forward/back traversal, a real state-changing intervention followed by reset, visible rendering, resize checks and screenshots. No requests outside the file-only extracted kit, console errors, uncaught errors or failed local resources were observed.']
    qa += ['', '## Failed / historical findings', '']
    fails=[f'- Check {n}: '+evidence[str(n)]['error'] for n in range(1,6) if checks[str(n)]!='PASS']
    qa += fails or ['No unresolved delivery failures.']
    if 'findings' in evidence['3']:
        qa += ['- '+f['problem']+' '+f['fix']+' Retained evidence: `'+f['evidence']+'`.' for f in evidence['3']['findings']]
    if checks['4']=='PASS':
        g=evidence['4'];qa += ['', 'Real-GPU outcome: **'+g['outcome']+'**. '+g.get('reason',g.get('renderer',''))+' The attempt result includes duration, owned profile/process cleanup and raw evidence. A documented impossible attempt satisfies the attempt requirement; it does not count as a successful GPU rehearsal.']
    qa += ['', 'Wave 1 history is retained separately under `out/wave1/`; its three-app results do not establish this four-app delivery.', '', '## Untested', '', '- Physical phones, tablets and touch hardware: Chromium viewport/input emulation only.', '- Ben’s Mac, other browser engines and OS-specific file policies beyond the recorded environments.', '- Narrated performance: the recorded operator rehearsals are silent; the speaker guides supply the spoken explanation.', '- New formal proof replay, global optimization certification, solver convergence certification and rendered-pixel verification by theorem.', '- Public deployment and GitHub CI were not performed.']
    if checks['4']!='PASS' or evidence['4'].get('outcome')!='recorded':
        qa += ['- Real-GPU presentation playback/performance was not successfully validated; see the observed Windows-attempt result, not the software renderer result.']
    qa += ['', '## Reproduce', '', 'Use `presentation-kit/README.md` and `presentation-kit/tests/README.md`. The full browser command runs under `taskset -c 11 unshare -rn` with explicit Wave 2 kit/output paths. Windows-attempt scripts and raw logs are in `out/wave2/real-gpu/`. Run `python3 presentation-kit/audit-wave2.py` for a read-only delivery audit; `--write-reports` regenerates the reports.']
    status_text, qa_text = '\n'.join(status)+'\n', '\n'.join(qa)+'\n'
    (REPO/'STATUS.md').write_text(status_text)
    (LANE.parent/'status/presentations.md').write_text(status_text)
    for path in (REPO/'QA-REPORT.md',OUT/'QA-REPORT.md',LANE/'out/QA-REPORT.md'):
        path.write_text(qa_text)
try:
    qa=(REPO/'QA-REPORT.md').read_text()
    require(all(x in qa for x in ('## Passed','## Failed / historical findings','## Untested')), 'QA sections missing')
    require('Physical' in qa and 'emulation' in qa, 'Physical-device boundary missing')
    require((REPO/'STATUS.md').read_bytes() == (LANE.parent/'status/presentations.md').read_bytes(), 'Mirrored status differs')
    require((REPO/'QA-REPORT.md').read_bytes() == (OUT/'QA-REPORT.md').read_bytes() == (LANE/'out/QA-REPORT.md').read_bytes(), 'QA delivery copies differ')
except Exception as exc:
    checks['5']='FAIL'; evidence['5']['report_error']=str(exc)
report={'checked_utc':datetime.now(timezone.utc).isoformat(),'checks':checks,'evidence':evidence}
(OUT/'evidence/delivery-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(checks,indent=2))
raise SystemExit(any(x!='PASS' for x in checks.values()))
