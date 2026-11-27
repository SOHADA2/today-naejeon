# 🔊 접기 손잡이 효과음 만들기 — v0.1.286 「헥스텍 슬라이드」
#   지난 흐름(사장님 의견): 281 높은 하프 → 282 하프 화음·현 합주(단순·높음·큼) → 283 낮고 짧게 → 284 어택 없앤 「웅」(더 은은하게)
#     → 285 벽돌 긁기(돌 끄는 소리 아님) → 돌문 시안(퀄리티가 떨어짐) → **「네가 생각하는 최고 퀄리티로 · 모션과 앱 톤앤매너에 맞춰」**
#   품질이 떨어졌던 원인 = 직접 짠 거친 필터(한 극 IIR)·선형 보간 음높이(뭉개짐·탁함) · 모노(납작함)
#   → 이번 = 원본 스테레오 그대로 · 음높이 = soxr 고품질 리샘플 · 필터 = STFT(시간에 따라 부드럽게 바뀌는 선형 위상) · 곡선 = 코사인(꺾임 없음)
#           · 창이 움직이는 방향으로 소리도 좌우 이동(등전력 팬) · 짧고 어두운 잔향(스테레오 확산) · 클릭·잘림 검사
#   소리 설계(앱 톤 = 롤 클라 옆 「헥스텍 로비」: 짙은 남색·금빛·빛)
#     ① 금빛 결 = 공(gong)을 아주 여리게 긁은 녹음을 낮춰 = 부드럽고 금속성인 「스우-」(마법 같은 광택)
#     ② 몸통 = 공을 세게 긁은 녹음을 9반음 낮춰 어둡게 = 공기의 무게
#     ③ 빨려 듦 = 여린 크래시 심벌을 거꾸로(접기만)
#     ④ 닿음 = 큰북(베이스 드럼) 여린 한 번을 160Hz 아래만 = 클라 뒤에 닿는 「툼」(들린다기보다 느껴지게)
#     접기 = 가속하며 클라 쪽으로 빨려 들어가고(소리도 클라 쪽으로) 닿는 순간 밝기가 닫히며 클라 뒤로 사라짐
#     펼치기 = 클라 뒤에서 「툼」 하고 밀려 나와 밝아지며 바깥쪽으로 퍼짐(감속)
#   실제 녹음만(합성 음색 없음 · 잔향만 표준 확산 잔향) · 재료 = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE (리포엔 안 넣음)
#     Percussion/gongscrape_pp.wav · gongscrape_mf.wav · cymbal-crash1_pp_rr1.wav · BDrumNewhit_v1_rr1_Sum.wav
#     (받기 = https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/<경로>)
# 사용: python tools/fold-sfx.py <재료 폴더> [출력 폴더(기본 assets/sfx)]   · ffmpeg(soxr 포함)가 PATH에 있어야 함
#   → fold-out-L/R.ogg · fold-in-L/R.ogg(L = 왼쪽 창 · 클라가 오른쪽 / R = 거울) · 앱 = desktop/fold.js SND_VOL
import os, sys, glob, subprocess, re
import numpy as np
SR = 48000
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')
rng = np.random.default_rng(286)

def load(name, semi=0.0):                                         # 스테레오 · 음높이 = asetrate + soxr(고품질)
    m = glob.glob(os.path.join(src, '**', name + '.wav'), recursive=True)
    if not m: sys.exit('재료 없음: ' + name)
    sr = int(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0', m[0]], capture_output=True, text=True).stdout.split()[0])
    af = f'asetrate={sr * 2 ** (semi / 12):.4f},aresample={SR}:resampler=soxr:precision=28'
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', m[0], '-af', af, '-ac', '2', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).astype(np.float64).reshape(-1, 2).T
    return a / (np.abs(a).max() + 1e-12)

def seg(a, t0, dur): return a[:, int(t0 * SR): int(t0 * SR) + int(dur * SR)].copy()

def curve(n, pts):                                                # 코사인으로 잇는 곡선 [(초, 값)…] = 꺾임 없음
    t = np.arange(n) / SR; xs = np.array([p[0] for p in pts]); ys = np.array([p[1] for p in pts])
    k = np.clip(np.searchsorted(xs, t, side='right') - 1, 0, len(xs) - 2)
    u = np.clip((t - xs[k]) / np.maximum(xs[k + 1] - xs[k], 1e-9), 0, 1); u = 0.5 - 0.5 * np.cos(np.pi * u)
    return ys[k] + (ys[k + 1] - ys[k]) * u

NFFT, HOP = 2048, 256
def stft_filter(x, lo_pts=None, hi_pts=None):
    # 시간에 따라 바뀌는 대역 필터(STFT · 프레임마다 부드러운 기울기 · Hann 겹쳐 더하기) · lo = 저역 통과 주파수 곡선 · hi = 고역 통과
    n = x.shape[1]; pad = NFFT
    xp = np.pad(x, ((0, 0), (pad, pad))); win = np.hanning(NFFT + 1)[:-1]
    f = np.fft.rfftfreq(NFFT, 1 / SR); y = np.zeros_like(xp); wsum = np.zeros(xp.shape[1])
    sh = lambda pts: [(0, pts[0][1])] + [(t + pad / SR, v) for t, v in pts] + [((n + 2 * pad) / SR + 1, pts[-1][1])]
    lo = curve(xp.shape[1], sh(lo_pts)) if lo_pts else None
    hi = curve(xp.shape[1], sh(hi_pts)) if hi_pts else None
    for s in range(0, xp.shape[1] - NFFT, HOP):
        c = s + NFFT // 2; g = np.ones_like(f)
        if lo is not None: g *= 1 / np.sqrt(1 + (f / lo[c]) ** 8)            # 4차 버터워스 모양(위상 없음)
        if hi is not None: g *= 1 / np.sqrt(1 + (hi[c] / np.maximum(f, 1)) ** 4)
        y[:, s:s + NFFT] += np.fft.irfft(np.fft.rfft(xp[:, s:s + NFFT] * win, axis=1) * g, NFFT, axis=1) * win
        wsum[s:s + NFFT] += win ** 2
    y /= np.maximum(wsum, 1e-6); return y[:, pad:pad + n]

def pan(x, pts):                                                  # 등전력 팬(-1 왼쪽 … +1 오른쪽) · 스테레오 폭은 유지
    p = curve(x.shape[1], pts); a = (p + 1) * np.pi / 4
    gl, gr = np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)
    return np.vstack([x[0] * np.minimum(gl, 1.25), x[1] * np.minimum(gr, 1.25)])

def reverb(x, rt=0.42, wet=0.16, pre=0.012, dark=2600):           # 짧고 어두운 확산 잔향(좌우 다른 확산)
    n = int(rt * 1.4 * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-6.91 * t / rt); ir[:, :int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    F = np.fft.rfft(ir, axis=1); f = np.fft.rfftfreq(n, 1 / SR); F *= 1 / np.sqrt(1 + (f / dark) ** 4); ir = np.fft.irfft(F, n, axis=1)
    L = x.shape[1] + n + int(pre * SR); N = 1 << int(np.ceil(np.log2(L)))
    w = np.fft.irfft(np.fft.rfft(x, N, axis=1) * np.fft.rfft(np.pad(ir, ((0, 0), (int(pre * SR), 0))), N, axis=1), N, axis=1)[:, :L]
    d = np.pad(x, ((0, 0), (0, L - x.shape[1])))
    return d + wet * w * (np.sqrt((x ** 2).mean()) / (np.sqrt((w ** 2).mean()) + 1e-12))

def place(buf, s, t, g=1.0):
    i = int(t * SR); m = min(s.shape[1], buf.shape[1] - i)
    if m > 0: buf[:, i:i + m] += s[:, :m] * g

def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r); return float(m[-1]) if m else None
def enc(x, p):
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '2', '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', '6', p], input=x.T.astype('<f8').tobytes(), check=True)
def finish(x, name, target, tail=0.06):
    x = stft_filter(x, hi_pts=[(0, 35)])                          # 아주 낮은 웅웅거림·직류 없앰
    nb = int(tail * SR); x[:, -nb:] *= (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nb)))
    na = int(0.004 * SR); x[:, :na] *= np.linspace(0, 1, na)
    x = x / (np.abs(x).max() + 1e-12) * 0.5
    p = os.path.join(out, name); enc(x, p)
    g = 10 ** ((target - lufs(p)) / 20); x = x * min(g, 10 ** (-3 / 20) / np.abs(x).max()); enc(x, p)
    d = np.abs(np.diff(x, axis=1)).max() / (np.abs(x).max() + 1e-12)   # 튐(클릭) 검사 = 이웃 샘플 차이 ÷ 봉우리
    print(f'{name} {x.shape[1]/SR:.2f}s {lufs(p):.1f} LUFS peak {20*np.log10(np.abs(x).max()):.1f}dB 튐 {d:.3f} {os.path.getsize(p)}B')

G_PP, G_MF = load('gongscrape_pp', -4), load('gongscrape_mf', -9)
CRASH = load('cymbal-crash1_pp_rr1', -2)
BD = load('BDrumNewhit_v1_rr1_Sum', -2)
bon = int(np.argmax(np.abs(BD).max(axis=0) > 0.05))

def fold_out(side):                                               # side L = 클라가 오른쪽(+) · R = 거울
    s = 1 if side == 'L' else -1; T = 0.95; buf = np.zeros((2, int(T * SR)))
    a = seg(G_PP, 0.45, 0.5)                                      # ① 금빛 결
    a = stft_filter(a, lo_pts=[(0, 2200), (0.23, 4200), (0.3, 1700), (0.5, 700)], hi_pts=[(0, 260)])
    a *= curve(a.shape[1], [(0, 0), (0.08, 0.25), (0.235, 1), (0.3, 0.55), (0.5, 0)])
    b = seg(G_MF, 1.3, 0.5)                                       # ② 몸통
    b = stft_filter(b, lo_pts=[(0, 1200), (0.24, 1800), (0.34, 650), (0.5, 380)], hi_pts=[(0, 90)])
    b *= curve(b.shape[1], [(0, 0), (0.1, 0.3), (0.24, 1), (0.34, 0.45), (0.5, 0)])
    c = seg(CRASH, 0.01, 0.26)[:, ::-1].copy()                    # ③ 빨려 듦(거꾸로 · 0.25초에 봉우리)
    c = stft_filter(c, lo_pts=[(0, 2400)], hi_pts=[(0, 380)]); c *= curve(c.shape[1], [(0, 0), (0.18, 0.6), (0.25, 1), (0.26, 0)])
    d = seg(BD, bon / SR, 0.6)                                    # ④ 닿음 「툼」
    d = stft_filter(d, lo_pts=[(0, 160)]); d *= curve(d.shape[1], [(0, 1), (0.25, 0.5), (0.6, 0)])
    mix = np.zeros((2, int(0.6 * SR)))
    place(mix, a, 0, 1.0); place(mix, b, 0, 0.55); place(mix, c, 0, 0.22)
    mix = pan(mix, [(0, -0.12 * s), (0.26, 0.55 * s), (0.6, 0.5 * s)])  # 창과 함께 클라 쪽으로
    place(buf, mix, 0); place(buf, pan(d, [(0, 0.35 * s)]), 0.238, 0.42)
    return reverb(buf, 0.42, 0.17)[:, :int(T * SR)]

def fold_in(side):
    s = 1 if side == 'L' else -1; T = 0.95; buf = np.zeros((2, int(T * SR)))
    d = seg(BD, bon / SR, 0.5)                                    # 클라 뒤에서 밀려 나오는 「툼」(여리게)
    d = stft_filter(d, lo_pts=[(0, 140)]); d *= curve(d.shape[1], [(0, 1), (0.2, 0.45), (0.5, 0)])
    a = seg(G_PP, 1.2, 0.55)
    a = stft_filter(a, lo_pts=[(0, 1300), (0.12, 4000), (0.3, 2600), (0.55, 1500)], hi_pts=[(0, 260)])
    a *= curve(a.shape[1], [(0, 0), (0.035, 0.7), (0.11, 1), (0.3, 0.45), (0.55, 0)])
    b = seg(G_MF, 2.6, 0.55)
    b = stft_filter(b, lo_pts=[(0, 600), (0.12, 1500), (0.55, 700)], hi_pts=[(0, 90)])
    b *= curve(b.shape[1], [(0, 0), (0.05, 0.6), (0.13, 1), (0.32, 0.4), (0.55, 0)])
    mix = np.zeros((2, int(0.6 * SR)))
    place(mix, a, 0.0, 1.0); place(mix, b, 0.0, 0.5)
    mix = pan(mix, [(0, 0.5 * s), (0.38, -0.08 * s), (0.6, -0.1 * s)])  # 클라 쪽에서 바깥으로
    place(buf, pan(d, [(0, 0.4 * s)]), 0.0, 0.3); place(buf, mix, 0.04)
    return reverb(buf, 0.42, 0.17)[:, :int(T * SR)]

for side in ('L', 'R'):
    finish(fold_out(side), f'fold-out-{side}.ogg', -25, 0.12)
    finish(fold_in(side), f'fold-in-{side}.ogg', -25, 0.12)
