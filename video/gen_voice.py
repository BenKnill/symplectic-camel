"""Generate one narration clip per script line with the accepted VoxCPM2 'B narrator' preset.

Resumable: existing clips whose metadata matches the line text are skipped.
Usage: gen_voice.py [--only i j ...] [--seed 42]
"""
import argparse, hashlib, json, time
from pathlib import Path
import mlx.core as mx
import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

HERE = Path(__file__).resolve().parent
CODEX = Path('/Users/boxer/Documents/Codex/2026-09-09/turn-x20')
preset = json.loads((CODEX / 'outputs/B-narrator-preset.json').read_text())
settings = preset['generation_parameters'].copy()
assert hashlib.sha256(Path(settings['ref_audio']).read_bytes()).hexdigest() == preset['reference_sha256']

script = json.loads((HERE / 'script.json').read_text())
lines = [dict(beat=b['id'], **l) for b in script['beats'] for l in b['lines']]
for l in lines:
    assert len(l['say'].split()) <= 19, l['say']

p = argparse.ArgumentParser(); p.add_argument('--only', nargs='*', type=int); p.add_argument('--seed', type=int, default=42)
args = p.parse_args()
out_dir = HERE / 'clips'; out_dir.mkdir(exist_ok=True)
model = load_model(str(CODEX / 'work/models/VoxCPM2-bf16'))
print(f'model loaded; {len(lines)} lines', flush=True)
t0 = time.monotonic()
for i in (args.only if args.only is not None else range(len(lines))):
    l = lines[i]
    stem = out_dir / f"{hashlib.sha1(l['say'].encode()).hexdigest()[:12]}-seed{args.seed}"
    wav, meta = stem.with_suffix('.wav'), stem.with_suffix('.json')
    if wav.exists() and meta.exists() and json.loads(meta.read_text())['say'] == l['say']:
        continue
    mx.random.seed(args.seed); t = time.monotonic()
    res = list(model.generate(text=l['say'], **settings))
    arrs = []
    for r in res:
        mx.eval(r.audio); arrs.append(np.asarray(r.audio, dtype=np.float32).reshape(-1))
    a = np.concatenate(arrs); sr = res[0].sample_rate
    assert np.isfinite(a).all() and len(a) > 0
    sf.write(wav, a, sr, subtype='FLOAT')
    meta.write_text(json.dumps(dict(index=i, beat=l['beat'], say=l['say'], show=l['show'], seed=args.seed, sample_rate=sr,
                                    seconds=len(a) / sr, gen_seconds=time.monotonic() - t), indent=2))
    print(f'{i:03d} {len(a)/sr:5.2f}s  ({time.monotonic()-t0:.0f}s elapsed)  {l["say"]}', flush=True)
    mx.clear_cache()
print('done', flush=True)
