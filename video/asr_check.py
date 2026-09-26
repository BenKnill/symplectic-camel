import json, re, sys, difflib
from pathlib import Path
sys.path.insert(0, '/Users/boxer/Documents/Codex/2026-09-09/turn-x20/work/ch6')
import local_asr
HERE = Path(__file__).resolve().parent
T = json.loads((HERE / 'timing.json').read_text())
norm = lambda s: re.sub(r"[^a-z0-9' ]", ' ', s.lower().replace('-', ' ')).split()
rep = []
for l in T['lines']:
    wav = HERE / f"clips/{l['clip']}-seed42.wav"
    r = local_asr.transcribe(wav, destination=wav.with_suffix('.asr.json'))
    a, b = norm(l['say']), norm(r['text'])
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    rep.append(dict(i=l['index'], ratio=round(ratio, 3), say=l['say'], heard=r['text']))
    if ratio < 0.97: print(f"{l['index']:02d} {ratio:.2f}\n  say:   {l['say']}\n  heard: {r['text']}", flush=True)
(HERE / 'asr-report.json').write_text(json.dumps(rep, indent=1))
print('checked', len(rep))
