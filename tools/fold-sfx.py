# 🔊 접기 손잡이 효과음 만들기
#   지난 흐름: v0.1.281 높은 하프 · 바람 → 282 낮은 하프 화음 + 현 합주 → 283 더 낮고 짧게 → 284 어택 없앤 「웅」
#   v0.1.285(사장님: 화살표 소리는 안 줘도 됨 · 돌 끌리는 소리처럼 「그르륵」 하게 들어가면 좋을 듯)
#   = **돌(벽돌)을 바닥에 끄는 실제 녹음**을 낮추고 느리게 + 귀로(긁는 타악기)의 「드르륵」 결을 아주 조금 · 끝은 마찰로 느려지며 잦아듦
#     접기 = 움직임(0.26초 · 가속)처럼 빨라지며 끌려 들어가다 끝에서 느려지며 멈춤 · 펼치기 = 처음 빠르게 밀려 나오다 느려지며 멈춤(0.38초 감속)
#     힌트(빛 꺾쇠) 소리는 없앰(fold-hint.ogg 지움)
#   실제 녹음만(합성음 없음) · 재료 = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE — 아래 파일(리포엔 안 넣음)
#     Miscellania Raw/Misc 1/brick_scrape.wav · brick_scrape2.wav · Percussion/Guiro-Slow_v1_Sum.wav
#     (받기 = https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/<경로> · 빈칸은 %20)
# 사용: python tools/fold-sfx.py <재료 폴더> [출력 폴더(기본 assets/sfx)]   · ffmpeg가 PATH에 있어야 함
#   → fold-out.ogg · fold-in.ogg · 앱 볼륨 = desktop/fold.js SND_VOL
import os, sys, glob, subprocess, re
import numpy as np
SR = 48000
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')

def load(name):
    m = glob.glob(os.path.join(src, '**', name + '.wav'), recursive=True)
    if not m: sys.exit('재료 없음: ' + name)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', m[0], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    return a / (np.abs(a).max() + 1e-9)

def onepole(x, fc):
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), x.shape)
    k = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += k[i] * (x[i] - s); y[i] = s
    return y
def lp(x, fc, n=2):
    for _ in range(n): x = onepole(x, fc)
    return x
def hp(x, fc): return x - lp(x, fc, 1)

def env(n, pts):                                                  # 꺾은선 [(초, 값)…]
    t = np.arange(n) / SR; xs, ys = zip(*pts); return np.interp(t, xs, ys)
def place(buf, snd, t, g=1.0):
    i = int(t * SR); n = min(len(snd), len(buf) - i)
    if n > 0: buf[i:i + n] += snd[:n] * g
def fade(x, a=0.004, b=0.05):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x

def vary(x, start, dur, speed_pts):                              # 녹음을 속도를 바꿔 가며 재생(느리면 낮고 굵게 · 빠르면 높고 잘게) = 끌리는 속도
    n = int(dur * SR); sp = env(n, speed_pts)
    pos = start * SR + np.cumsum(sp); pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)

brick = np.concatenate([load('brick_scrape'), load('brick_scrape2')])
guiro = load('Guiro-Slow_v1_Sum')
gon = np.argmax(np.abs(guiro) > 0.05)

def grind(dur, speed_pts, vol_pts, fc_pts, seed):
    # 돌 끄는 소리 = 벽돌 긁는 녹음 두 겹(다른 곳·조금 다른 속도) → 낮게(속도 0.4~0.7배) · 고음 깎음 · 귀로 = 「드르륵」 결(아주 조금)
    a = vary(brick, 0.15 + seed * 0.37, dur, speed_pts)
    b = vary(brick, 1.25 + seed * 0.21, dur, [(t, v * 0.82) for t, v in speed_pts])
    g = vary(guiro, gon / SR + 0.3 + seed * 0.2, dur, [(t, v * 0.55) for t, v in speed_pts])
    n = min(len(a), len(b), len(g)); g = g[:n] / (np.abs(g).max() + 1e-9) * np.abs(a).max()
    x = a[:n] + 0.7 * b[:n] + 0.35 * g
    x = hp(lp(x, env(n, fc_pts), 2), 70) * env(n, vol_pts)
    return fade(x, 0.012, 0.03)

def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); return float(m[-1]) if m else None
def enc(x, p):
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', '5', p], input=x.astype('<f8').tobytes(), check=True)
def write(name, x, target):                                       # 크기 = 목표 LUFS(봉우리는 -3 dBFS 넘지 않게)
    x = x / (np.abs(x).max() + 1e-9) * 0.5
    p = os.path.join(out, name); enc(x, p)
    g = 10 ** ((target - lufs(p)) / 20); x = x * min(g, 10 ** (-3 / 20) / np.abs(x).max())
    enc(x, p); print(name, f'{len(x)/SR:.2f}s', f'{lufs(p):.1f} LUFS', f'peak {20*np.log10(np.abs(x).max()):.1f}dB', os.path.getsize(p), 'B')

# ── 접기(0.26초 · 가속) = 끌려 들어가며 조금씩 빨라짐 → 클라 뒤에 닿으며 마찰로 느려지고 멈춤 · 들어갈수록 먹먹하게
fo = grind(0.42, [(0, 0.42), (0.2, 0.62), (0.27, 0.5), (0.42, 0.2)],
           [(0, 0), (0.03, 0.7), (0.2, 1), (0.27, 0.8), (0.42, 0)],
           [(0, 1500), (0.2, 1800), (0.3, 900), (0.42, 450)], 0)
write('fold-out.ogg', fo, -26)

# ── 펼치기(0.05초 뒤 · 0.38초 감속) = 처음 밀려 나올 때 빠르고 → 느려지며 멈춤
fi = np.zeros(int(0.5 * SR))
place(fi, grind(0.45, [(0, 0.66), (0.12, 0.6), (0.3, 0.4), (0.45, 0.18)],
                [(0, 0), (0.025, 1), (0.15, 0.9), (0.32, 0.45), (0.45, 0)],
                [(0, 1900), (0.15, 1600), (0.45, 600)], 1), 0.03)
write('fold-in.ogg', fi, -26)
