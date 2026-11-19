# ⚔ 선픽 줄다리기 소리(assets/sfx/firstpick.ogg) 만들기 — v0.1.230 · 실제 녹음만 섞음(합성음 없음 — 사장님: 합성음 싫음)
#   앱의 소리 결 = 팟지에 쓰는 깊은 타격음(사장님이 Suno로 만든 「Impact Sequence」 = assets/sfx/potg-hit.ogg) → 그 소리를 재료로
#   사장님이 고른 것 = 「절제해서」(B): 맞붙을 때 깊은 「쿵」 작게 → 당길 때마다 바람 「휙」(크게 당길수록 크게) + 아주 낮은 「붐」 조금
#     → 버틸 때 바람이 짧게 차오름 → 밀어낼 때 깊은 「쿵」 한 번(한 음 낮춰서) + 맑은 「띵」 옅게
#   안 고른 것(다시 만들지 말 것): 북소리(팀파니·큰북 · 「안 어울림」) · 카드/클릭 소리 · 「묵직하게」(A = 낮은 울림이 깔리고 팟지 slam으로 끝남)
#   재료: assets/sfx/potg-hit.ogg(리포) + 아래 둘을 한 폴더에
#     cymbal-crash1_mp_rr1.wav = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE/tree/master/Percussion — 거꾸로 틀어 「휙」(차오르다 끝나는 바람)
#     ding.1.ogg = OpenGameArt 「4 metal dings/rings」(StarNinjas · CC0) https://opengameart.org/content/4-metal-dingsrings — 3865Hz 부분음만 걸러 「띵」(v0.1.32에서 고른 소리)
#   사용(리포 루트): python tools/firstpick-sfx.py <재료 폴더> [출력 = assets/sfx/firstpick.ogg]   · numpy·scipy · ffmpeg(pip install imageio-ffmpeg 또는 PATH)
#   시각(초) = overlay/overlay.js TW·TW_PULLS·TW_SEG와 같은 값(두 흐름 flip/hold는 시각·크기가 같고 방향만 다름) — 바꾸면 두 곳 같이
import sys, os, subprocess, numpy as np
from scipy.signal import butter, sosfilt
SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'assets', 'sfx', 'firstpick.ogg')
try:
    import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception: FF = 'ffmpeg'
SR = 44100
TW_ENTER, TW_SHOVE, TW_COVER = 0.320, 2.300, 2.700
PULLS = [[460, 0], [720, 8], [980, -6], [1240, 12], [1500, -9], [1760, -16]]
SEG_PRE, SEG_SNAP = 0.2, 0.56
BLAST = TW_SHOVE + (TW_COVER - TW_SHOVE) * 0.22   # 단번에 밀어내는 순간
def load(p):
    x = np.frombuffer(subprocess.run([FF, '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).astype(np.float64)
    if not len(x): raise SystemExit('못 읽음: ' + p)
    return x
def onset(x, k=0.25, pre=0.002):   # 첫 타격 바로 앞에서 자름
    e = np.abs(x); i = int(np.argmax(e > e.max() * k)); return x[max(0, i - int(pre * SR)):]
def norm(x): return x / np.abs(x).max()
def fio(x, n_in, n_out):
    x = x.copy()
    if n_in: x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out: x[-n_out:] *= np.linspace(1, 0, n_out)
    return x
def bpf(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], btype='bandpass', fs=SR, output='sos'), x)
def pitch(x, r): return np.interp(np.arange(0, len(x) - 1, r), np.arange(len(x)), x)   # r < 1 = 낮고 길게
def put(mix, t, x, g):
    i = int(round(t * SR)); x = x[:max(0, len(mix) - i)]; mix[i:i + len(x)] += x * g
hit = norm(onset(load(os.path.join(ROOT, 'assets', 'sfx', 'potg-hit.ogg')), 0.2, 0.004))
cym = norm(onset(load(os.path.join(SRC, 'cymbal-crash1_mp_rr1.wav'))))
def whoosh(dur, lo=350, hi=5200):   # 거꾸로 튼 심벌 = 차오르다 끝나는 바람
    w = bpf(cym[:int(dur * SR)][::-1], lo, hi); w = w / np.abs(w).max()
    return w * np.linspace(0.05, 1, len(w)) ** 2.2
def ring(dur):   # 맑은 「띵」
    d = load(os.path.join(SRC, 'ding.1.ogg'))
    b = lambda f0, bw: (lambda s: sosfilt(s, sosfilt(s, d)))(butter(4, [f0 - bw / 2, f0 + bw / 2], btype='bandpass', fs=SR, output='sos'))
    r = norm(onset(b(3865, 180) + 0.32 * b(7450, 300), 0.35, 0.004))
    return fio(r[:int(dur * SR)], 0, int(0.25 * SR))
mix = np.zeros(int(4.2 * SR))
put(mix, TW_ENTER, fio(hit[:int(0.6 * SR)], 0, int(0.3 * SR)), 0.5)                                   # 맞붙음
for i in range(1, len(PULLS)):                                                                           # 당길 때마다
    (t0, d0), (t1, d1) = PULLS[i - 1], PULLS[i]
    big = min(1, abs(d1 - d0) / 16); at = (t0 + (t1 - t0) * SEG_PRE) / 1000; snap = at + (t1 - t0) * (SEG_SNAP - SEG_PRE) * 0.35 / 1000
    w = whoosh(0.26); put(mix, snap - len(w) / SR, fio(w, 0, int(0.012 * SR)), 0.15 + 0.13 * big)
    put(mix, snap, fio(pitch(hit, 1.0 if i % 2 else 0.84)[:int(0.5 * SR)], 0, int(0.3 * SR)), 0.1 + 0.06 * big)
r = whoosh(0.75, 250, 6500); put(mix, BLAST - 0.05 - len(r) / SR, fio(r, 0, int(0.015 * SR)), 0.24)     # 버틸 때 차오름
put(mix, BLAST, fio(pitch(hit, 0.8)[:int(1.3 * SR)], 0, int(0.7 * SR)), 0.95)                           # 밀어냄
put(mix, BLAST + 0.12, ring(1.0), 0.13)
mix = np.tanh(mix / np.abs(mix).max() * 1.5) / np.tanh(1.5) * 0.89   # 봉우리 -1dBFS(앱에서 볼륨 0.3 × 설정)
subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', '5', OUT], input=mix.astype(np.float32).tobytes(), check=True)
print('made', OUT, f'{os.path.getsize(OUT) / 1024:.1f}KB', f'{len(mix) / SR:.1f}s')
