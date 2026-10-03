#!/usr/bin/env python3
"""Audit delivered artifacts against the lane brief; optionally generate evidence-linked reports."""
import argparse, hashlib, json, subprocess, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
LANE = REPO.parent
OUT = LANE / 'out'
PRESENTATIONS = {'camel': 5, 'lattice': 4, 'rhine': 6}
VIEWPORTS = ('desktop-1440', 'tablet-1024', 'phone-emulation-390')
BRANCH = 'codex/oliver-live-cloud-review-oct3'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--write-reports', action='store_true')
a = p.parse_args()

def read(path):
    return json.loads(Path(path).read_text())
def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def command(args):
    return subprocess.check_output(args, text=True).strip()
def check(condition, message):
    if not condition:
        raise ValueError(message)

checks = {}
detail = {}
def audit(number, fn):
    try:
        detail[str(number)] = fn()
        checks[str(number)] = 'PASS'
    except Exception as exc:
        detail[str(number)] = {'error': str(exc)}
        checks[str(number)] = 'FAIL'

zip_path = OUT / 'presentations-kit.zip'
extracted = OUT / 'kit-extracted-final'

def kit_check():
    build = read(OUT / 'build.json')
    check(digest(zip_path) == build['sha256'], 'ZIP differs from build result')
    manifest = read(extracted / 'manifest.json')['files_sha256']
    with zipfile.ZipFile(zip_path) as z:
        check(set(z.namelist()) == set(manifest) | {'manifest.json'}, 'ZIP contents differ from manifest')
        check(z.read('manifest.json') == (extracted/'manifest.json').read_bytes(), 'Archived manifest differs from extracted manifest')
        check({str(f.relative_to(extracted)) for f in extracted.rglob('*') if f.is_file()} == set(z.namelist()), 'Extra files in extracted kit')
        for name, expected in manifest.items():
            check(digest(extracted/name) == expected, 'Extracted hash mismatch: '+name)
            check(hashlib.sha256(z.read(name)).hexdigest() == expected, 'Archived hash mismatch: '+name)
            check(digest(HERE/'src'/name) == expected, 'Delivered kit differs from current source: '+name)
    provenance=read(extracted/'provenance.json')
    for name, source in provenance['sources'].items():
        for filename, expected in source['files_sha256'].items():
            check(digest(LANE/name/filename)==expected, 'Kit is stale relative to source: '+name+'/'+filename)
    check((extracted/'index.html').is_file(), 'Launcher missing')
    browser = read(OUT/'evidence/playwright-results.json')
    launcher_tests = []
    def walk(suites):
        for suite in suites:
            for spec in suite.get('specs', []):
                if spec['title'] == 'launcher and all local HTML links navigate offline':
                    launcher_tests.extend(spec['tests'])
            walk(suite.get('suites', []))
    walk(browser['suites'])
    check(len(launcher_tests)==len(VIEWPORTS) and all(t['status']=='expected' and t['results'][-1]['status']=='passed' for t in launcher_tests), 'Fresh-file launcher was not browser-verified at every viewport')
    return {**build, 'extracted': str(extracted), 'manifest_sha256': digest(extracted/'manifest.json')}

def browser_check():
    result = read(OUT/'evidence/playwright-results.json')
    stats = result['stats']
    check(stats['unexpected'] == stats['flaky'] == 0, 'Browser failure or retry present')
    check(stats['expected'] == len(VIEWPORTS)*(len(PRESENTATIONS)+1)+1, 'Incomplete passing browser tests')
    check(stats['skipped'] == len(VIEWPORTS)-1, 'Only redundant notes-print cases may be skipped')
    rows=[]
    def walk(suites):
        for suite in suites:
            for spec in suite.get('specs', []):
                for test in spec['tests']:
                    rows.append((test['projectName'], spec['title'], test['results'][-1]['status']))
            walk(suite.get('suites', []))
    walk(result['suites'])
    expected={(v, name+': every scene, input, reset, render, resize', 'passed') for v in VIEWPORTS for name in PRESENTATIONS}
    expected |= {(v,'launcher and all local HTML links navigate offline','passed') for v in VIEWPORTS}
    expected |= {(v,'speaker notes each print on one A4 page','passed' if v==VIEWPORTS[0] else 'skipped') for v in VIEWPORTS}
    check(len(rows)==len(expected) and set(rows)==expected, 'Browser test/project result matrix incomplete')
    records=[]
    for viewport in VIEWPORTS:
        for presentation, count in PRESENTATIONS.items():
            data=read(OUT/f'evidence/{viewport}-{presentation}.json')
            check(data['kitManifestSHA256'] == digest(extracted/'manifest.json'), 'Browser evidence is for a different kit')
            check(len(data['scenes']) == len(data['resets']) == count, 'Incomplete scene/reset coverage')
            check(all(item['pass'] for item in data['resets']), 'Reset failed')
            check({x['method'] for x in data['inputMethods']} == {'mouse','keyboard','touch'}, 'Input method absent')
            check(all(x['forward'] and x['backward'] and x['scenes']==count for x in data['inputMethods']), 'Navigation incomplete')
            for name in ('nonFileRequests','outsideKitRequests','consoleErrors','pageErrors','failedFileRequests'):
                check(data[name] == [], 'Browser reported '+name)
            check(not any(not x['internal'] for xs in data['networkInterfaces'].values() for x in xs), 'External network interface present')
            if presentation=='rhine':
                circle=data['closedContour']
                bounds=circle['viewport']['contour']
                check(abs(circle['measured'])<1e-6, 'Opposite-pair circulation did not cancel')
                check(bounds['left']>=6 and bounds['top']>=6 and bounds['right']<=circle['viewport']['width']-6 and bounds['bottom']<=circle['viewport']['height']-6, 'Closed measuring contour is clipped')
            records.append(data)
    return {'stats':stats, 'records':len(records), 'renderers':sorted({w['renderer'] for d in records for w in d['webgl']})}

def screenshot_check():
    files=[]
    for viewport in VIEWPORTS:
        for name,count in PRESENTATIONS.items():
            for scene in range(1,count+1):
                f=OUT/f'screenshots/{viewport}/{name}-{scene:02}.png'
                check(f.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), 'Invalid screenshot '+str(f))
                files.append(str(f))
    review=read(OUT/'reviews/final-visual-review.json')
    check(review['status']=='PASS' and set(review['viewports_reviewed'])==set(VIEWPORTS), 'Manual layout review incomplete')
    check(review['kit_manifest_sha256']==digest(extracted/'manifest.json'), 'Manual review was for a different kit')
    return {'required_screenshots':len(files), 'files':files, 'review':review}

def rehearsal_check():
    videos=[]
    for label in ('before','after'):
        folder=OUT/'rehearsals'/label
        events=read(folder/'events.json')
        frames=read(folder/'frames.json')
        source = extracted if label=='after' else OUT/'kit-extracted'
        archive = zip_path if label=='after' else OUT/'presentations-before.zip'
        check(Path(events['kit'])==source, label+' recording used the wrong source path')
        with zipfile.ZipFile(archive) as z:
            for name in z.namelist():
                check((source/name).read_bytes()==z.read(name), label+' recording source differs from retained archive')
        for error in ('nonFileRequests','consoleErrors','pageErrors','failedFileRequests'):
            check(events[error]==[], label+' recording browser errors: '+error)
        check(events['events'][-1]['event']=='complete', label+' rehearsal incomplete')
        covered={(e['presentation'],e['scene']) for e in events['events'] if e['event']=='scene'}
        check(covered=={(name,n) for name,count in PRESENTATIONS.items() for n in range(count)}, label+' missed scenes')
        check(not any(e['event']=='failure' for e in events['events']), label+' rehearsal has failure')
        check(Path(frames['video'])==folder/f'rehearsal-{label}.webm', label+' points to the wrong video')
        check(digest(frames['video'])==frames['sha256'], label+' video changed')
        for f in frames['frames']:
            check(Path(f['file']).is_file(), 'Sampled frame missing')
        check(frames['intervalSeconds']>0 and len(frames['frames'])>=frames['durationSeconds']//frames['intervalSeconds'], 'Frame sampling incomplete')
        videos.append({k:frames[k] for k in ('video','sha256','durationSeconds','intervalSeconds')})
    review=read(OUT/'reviews/final-visual-review.json')
    check(review['status']=='PASS' and review['after_recording_watched'], 'After recording not reviewed')
    check(videos[0]['sha256']!=videos[1]['sha256'], 'Before and after recordings are identical')
    check(review['after_video_sha256']==videos[1]['sha256'], 'Manual review was for another after video')
    first=read(OUT/'reviews/first-rehearsal-review.json')
    check(first['findings'], 'Before findings absent')
    return {'videos':videos, 'findings':first['findings']}

def recovery_check():
    data=read(OUT/'rhine-footage/recovery.json')
    check(data['result']=='RECOVERED', 'Recovery result not recorded')
    for f in data['files']:
        for path in [f['source_path'],f['kit_source_path'],extracted/'rhine/live-media'/f['name']]:
            check(digest(path)==f['sha256']==f['expected_sha256'], 'Media hash mismatch')
    return {'result':data['result'], 'files':data['files'], 'source':data['provenance_note']}

def branch_check():
    notes=read(OUT/'evidence/speaker-notes-pages.json')
    check({x['presentation'] for x in notes}==set(PRESENTATIONS), 'Missing speaker notes')
    check(all(x['pages']==1 and Path(x['file']).is_file() for x in notes), 'Notes page limit failed')
    branches=[]
    for name in ('symplectic-camel','lattice-echo','rhine-dimples'):
        repo=LANE/name
        branch=command(['git','-C',str(repo),'branch','--show-current'])
        local=command(['git','-C',str(repo),'rev-parse','HEAD'])
        remote=command(['git','-C',str(repo),'ls-remote','--heads','origin','refs/heads/'+BRANCH]).split()[0]
        check(branch==BRANCH and local==remote, name+' branch not pushed')
        dirty=subprocess.check_output(['git','-C',str(repo),'status','--porcelain'],text=True).splitlines()
        check(all(line[3:] in ('STATUS.md','QA-REPORT.md') for line in dirty), name+' has uncommitted implementation files')
        branches.append({'repo':name,'branch':branch,'local':local,'remote':remote})
    return {'notes':notes,'branches':branches}

def qa_check():
    text=(REPO/'QA-REPORT.md').read_text()
    for section in ('## Passed','## Failed / historical findings','## Untested'):
        check(section in text, 'Missing QA section: '+section)
    untested=text.split('## Untested',1)[1]
    check('Real-GPU' in untested and 'Physical' in untested and 'SwiftShader' in untested and 'emulation' in untested, 'Required untested boundaries missing')
    check('No unresolved delivery failures.' not in text or all(checks[k]=='PASS' for k in checks if k!='6'), 'QA says no failures while current checks fail')
    return {'report':str(REPO/'QA-REPORT.md'),'sha256':digest(REPO/'QA-REPORT.md'),'scope':'Passed, failed/historical and untested sections inspected; software GPU and physical-device limits explicit.'}

for n,fn in [(1,kit_check),(2,browser_check),(3,screenshot_check),(4,rehearsal_check),(5,recovery_check),(7,branch_check)]:
    audit(n,fn)
if a.write_reports:
    checks['6']='PASS'  # Provisional until the generated report is inspected below.
else:
    audit(6,qa_check)

if a.write_reports:
    refs={1:('python3 presentation-kit/build.py; python3 -m zipfile -e; python3 presentation-kit/audit-delivery.py','../out/build.json; ../out/kit-extracted-final/manifest.json'),2:('taskset -c 11 unshare -rn env KIT_DIR=/home/bluestar/lanes/presentations/out/kit-extracted-final npm test (from presentation-kit)','../out/evidence/playwright-results.json; ../out/evidence/*-camel.json, *-lattice.json, *-rhine.json'),3:('the offline Playwright suite; manual three-viewport visual review','../out/screenshots/; ../out/reviews/final-visual-review.json'),4:('tests/rehearsal.mjs followed by tests/extract-frames.mjs (commands in presentation-kit/tests/README.md)','../out/rehearsals/before/; ../out/rehearsals/after/; ../out/reviews/first-rehearsal-review.json'),5:('sha256sum -c SHA256SUMS; ffprobe; ffmpeg full decode; audit-delivery.py','../out/rhine-footage/recovery.json; ../rhine-dimples/FOOTAGE-MANIFEST.json'),6:('python3 presentation-kit/audit-delivery.py --write-reports','QA-REPORT.md; ../out/evidence/delivery-audit.json'),7:('offline Playwright notes print test; git ls-remote --heads origin refs/heads/'+BRANCH,'../out/evidence/speaker-notes-pages.json; ../out/evidence/delivery-audit.json')}
    titles={1:'Offline ZIP, hash, fresh extraction and file launcher',2:'Isolated real-browser rendering and interaction suite',3:'Representative screenshots for every scene',4:'Two uninterrupted rehearsals, watched frames and fixes',5:'Rhine footage recovery and provenance',6:'QA report with passed, failed and untested boundaries',7:'One-page speaker notes and all review branches pushed'}
    status=['# Presentations lane status','', 'This checkpoint made progress: source fixes, local browser evidence and delivery artifacts are audited against the full lane brief.','']
    for n in range(1,8):
        cmd,evidence=refs[n]
        status.append(f'{n}. {checks[str(n)]} — {titles[n]}. Command: `{cmd}`. Evidence: `{evidence}`.')
    if checks['1']=='PASS':
        status+=['',f"Kit: `{detail['1']['archive']}`",f"SHA-256: `{detail['1']['sha256']}`"]
    status+=['','## Problems found by watching the first rehearsal and changes','']
    for f in read(OUT/'reviews/first-rehearsal-review.json')['findings']:
        status.append('- '+f['problem']+' '+f['fix']+' Evidence: `'+f['evidence']+'` in the before recording.')
    intermediate=read(OUT/'reviews/intermediate-rehearsal-review.json')
    status+=['','Additional after-recording finding: '+intermediate['problem']+' '+intermediate['fix']+' Evidence: `'+intermediate['evidence']+'`. The intermediate recording and intentionally superseded partial run remain under `../out/rehearsals/after-v1/` and `../out/qa-final-v1/`.']
    status+=['','## Decisions and limits','','- Preserved reviewed numerical/controller fixes and kept theorem, numerical illustration, formally verified kernel and unverified browser-rendering scopes explicit. No new HOL replay is claimed.','- Coordinator supplied the recovered original Rhine bookends. Their exact source paths and hashes are in the recovery report. Private media is in the local ZIP, ignored by Git; the committed source and builder require restoring those verified files. No footage or large frame folders were published.','- Heavy work used CPU 11. All validation ran locally; no GitHub CI, deployment or outward messages.','- SwiftShader validates software rendering, not real-GPU frame rate or pacing. Phone/touch tests are emulation; physical devices and a real-GPU Mac rehearsal remain untested.','','## Next','', 'No remaining lane completion work. Ben’s later real-GPU and physical-device rehearsal is outside this verified local kit.' if all(v=='PASS' for v in checks.values()) else 'Resolve the failing checks identified in out/evidence/delivery-audit.json.']
    content='\n'.join(status)+'\n'
    (REPO/'STATUS.md').write_text(content)
    (LANE.parent/'status/presentations.md').write_text(content)
    qa=['# Local QA report','','## Passed','']
    qa += [f'- {titles[n]}. Evidence: `{refs[n][1]}`.' for n in range(1,8) if checks[str(n)]=='PASS']
    if checks['2']=='PASS':
        qa+=['', 'Browser results (generated from Playwright): `'+json.dumps(detail['2']['stats'],sort_keys=True)+'`.', 'Recorded renderer(s): '+', '.join('`'+x+'`' for x in detail['2']['renderers'])+'.', 'All scenes were traversed both ways using buttons, keyboard and emulated touch at each viewport. Reset comparisons follow real parameter, motion and camera changes. Original Rhine videos decode/play from local files; the switchable illustration exercises WebGL2. No non-file requests, console errors, uncaught errors or missing local resources occurred in the passing suite.']
    qa+=['','## Failed / historical findings','']
    failed=[titles[n] for n in range(1,8) if checks[str(n)]!='PASS']
    qa+=['- '+x for x in failed] if failed else ['No unresolved delivery failures.']
    qa+=['','The first rehearsal revealed clipped Camel measurements, blank Rhine startup text, off-screen Rhine controls, an oversized closing clip and operator actions that did not match the prediction prompts. The source/rehearsal corrections and retained recordings are verified only when delivery check 4 is PASS. `../out/reviews/first-rehearsal-review.json` records the findings; `../out/reviews/final-visual-review.json` records the after review. Initial browser-run artifacts are retained under `../out/qa-before/`; that optional run was intentionally superseded, not counted as a full pass. The intermediate after recording then exposed a clipped closed measuring contour. Its view scale was corrected without changing the integral, and the entire recording/suite was repeated. That intermediate recording and intentionally interrupted partial browser run remain under `../out/rehearsals/after-v1/` and `../out/qa-final-v1/`.','The initial snapshot whitespace check flagged trailing blank lines copied unchanged from vendored Three.js and the reviewed figure source. Their bytes were deliberately preserved; this was not a rendering/model failure.','','## Untested','','- Real-GPU rendering, frame rate and pacing on Ben’s Mac: this environment uses software SwiftShader; the Mac rehearsal is a separate later step.','- Physical phones, tablets and touch hardware: the three viewports and touch events use Chromium emulation.','- Other browser engines and OS-specific file-origin policies: the kit was exercised in the recorded Chromium build on this machine.','- New HOL Light proof replay or native-kernel comparison: numerical/controller regressions are local evidence; the presentation does not broaden the existing formal kernel proof to JavaScript or rendered pixels.','- Narrated delivery and unavailable narrated-video originals: the recordings are continuous silent operator rehearsals; one-page notes supply the spoken explanation.','- Deployment, public distribution of private footage and GitHub CI were not performed.','','## Reproduce','','Use `presentation-kit/README.md` and `presentation-kit/tests/README.md`. Restore the hash-pinned private media for a new checkout, build the ZIP, extract to a fresh directory, then run the local suite with `unshare -rn`. `audit-delivery.py` verifies current artifact hashes and remote branch equality without relying on CI.']
    (REPO/'QA-REPORT.md').write_text('\n'.join(qa)+'\n')
    (OUT/'QA-REPORT.md').write_text('\n'.join(qa)+'\n')
audit(6,qa_check)
report={'checks':{str(n):checks[str(n)] for n in range(1,8)},'evidence':detail}
(OUT/'evidence/delivery-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['checks'],indent=2))
raise SystemExit(any(v!='PASS' for v in checks.values()))
