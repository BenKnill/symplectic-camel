"""Join narration clips (edge trims, fades, controlled pauses), master loudness, and emit timing.js + SRT.

Selection: clips/NNN-seed{S}.wav where S comes from selection.json (default 42).
"""
import hashlib, json, subprocess
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
script = json.loads((HERE / 'script.json').read_text())
sel_path = HERE / 'selection.json'
selection = json.loads(sel_path.read_text()) if sel_path.exists() else {}
GAP = {'clause': 0.2, 'sentence': 0.55, 'paragraph': 0.8}

out, t, sr = [], 0.0, None
beats, lines = {}, []
idx = 0

def silence(sec):
    global t
    n = round(sec * sr); out.append(np.zeros(n, dtype=np.float32)); t += n / sr

for b in script['beats']:
    if sr is None:
        l0 = b['lines'][0]['say']; sr = sf.info(HERE / f'clips/{hashlib.sha1(l0.encode()).hexdigest()[:12]}-seed42.wav').samplerate
    silence(b.get('pad_before', 0.3))
    bstart = t - b.get('pad_before', 0.3)
    blines = []
    for k, l in enumerate(b['lines']):
        h = hashlib.sha1(l['say'].encode()).hexdigest()[:12]; seed = selection.get(h, 42)
        a, rate = sf.read(HERE / f'clips/{h}-seed{seed}.wav', dtype='float32')
        assert rate == sr
        hop = round(.01 * sr); n = len(a) // hop
        rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1))
        act = np.flatnonzero(rms > max(1e-5, float(rms.max()) * 10 ** (-55 / 20)))
        head = max(0, int(act[0] * hop) - round(.08 * sr)); end = min(len(a), int((act[-1] + 1) * hop) + round(.12 * sr))
        clip = a[head:end].copy(); f = round(.004 * sr); clip[:f] *= np.linspace(0, 1, f); clip[-f:] *= np.linspace(1, 0, f)
        start = t; out.append(clip); t += len(clip) / sr
        rec = dict(index=idx, clip=h, beat=b['id'], show=l['show'], say=l['say'], start=round(start + 0.06, 3), end=round(t - 0.1, 3))
        blines.append(rec); lines.append(rec); idx += 1
        if k < len(b['lines']) - 1:
            silence(GAP[l['b']])
    silence(b.get('pad_after', 0.8))
    beats[b['id']] = dict(start=round(bstart, 3), end=round(t, 3), lines=blines)

raw = np.concatenate(out)
sf.write(HERE / 'narration-raw.wav', raw, sr, subtype='FLOAT')
r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(HERE / 'narration-raw.wav'), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True, check=True)
loud = json.JSONDecoder().raw_decode(r.stderr[r.stderr.rfind('{'):])[0]
gain = min(-16 - float(loud['input_i']), -1.5 - float(loud['input_tp']))
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(HERE / 'narration-raw.wav'), '-af', f'volume={gain}dB',
                '-ar', '48000', '-c:a', 'pcm_s24le', str(HERE / 'narration.wav')], check=True)

timing = dict(duration=round(t, 3), beats=beats, lines=lines)
(HERE / 'timing.json').write_text(json.dumps(timing, indent=1, ensure_ascii=False))
(HERE / 'timing.js').write_text('window.TIMING = ' + json.dumps(timing, ensure_ascii=False) + ';\n')

def ts(x):
    ms = round(x * 1000); return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
srt = []
for i, l in enumerate(lines):
    nxt = lines[i + 1]['start'] if i + 1 < len(lines) else l['end'] + 1
    until = nxt if nxt - l['end'] < 0.9 else l['end'] + 0.35
    srt.append(f'{i+1}\n{ts(l["start"] - 0.08)} --> {ts(until - 0.02)}\n{l["show"]}\n')
(HERE / 'symplectic-camel.srt').write_text('\n'.join(srt))
print(f'duration {t:.1f}s, {len(lines)} lines, gain {gain:.1f} dB')
