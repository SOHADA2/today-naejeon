# 🔊 접기 손잡이 효과음 만들기
#   v0.1.281 처음(높은 하프 한 음 · 바람) → v0.1.282(사장님: 너무 단순 · 너무 높음 · 은은해야 · 너무 큼)
#   = 낮은 음역(D2~F#4 · D장조) · 하프 화음 + 비올라·첼로 합주를 아주 여리게 깐 은은한 바탕 + 부드러운 말렛 심벌 바람 · 크기 -24~-26 LUFS(예전 -20) + 앱 볼륨도 줄임
#   실제 녹음만(합성음 없음) · 재료 = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE — 아래 파일(리포엔 안 넣음)
#     Strings/Harp/KSHarp_{D2,A2,C3,G3,B3,D4,F4,A4}_mf.wav
#     Strings/Viola Section/susvib/ViolaEns_susvib_{D3,F3,A3}_v1_1.wav · Strings/Cello Section/susvib/susvib_D2_v1_1.wav
#     VSCO 1 Percussion/varMetal/Cymbals/susp/susp_hit_softmall_roll5_long_p.wav · Percussion/cymbal-crash1_pp_rr1.wav
#     (받기 = https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/<경로> · 빈칸은 %20)
# 사용: python tools/fold-sfx.py <재료 폴더> [출력 폴더(기본 assets/sfx)]   · ffmpeg가 PATH에 있어야 함
#   fold-out.ogg  = 접기(0.26초) — 말렛 심벌 바람이 차오르다 먹먹해지며 사라짐 + 비올라 D·A가 클라 뒤로 멀어지듯 어두워짐 + 낮은 하프 「둥」(D3·A2)
#   fold-in.ogg   = 펼치기(0.38초) — 바람이 열리며 하프 D3→A3→D4→F#4 굴림 + 비올라 화음이 살짝 차오름
#   fold-hint.ogg = 손잡이 힌트(desktop/foldtab.html ftHint와 같은 박자 · 애니메이션 시작 = 0초)
#                   빛이 번지는 동안 현 합주(첼로 D2·비올라 D3·A3)가 은은하게 깔림 · 꺾쇠가 스며 나올 때 하프 D3·A3·D4 여리게 · 톡톡 = 하프 두 음 화음(A3+D4 → F#3+D4)
#   ⚠️ ftHint 시각(0.35초 뒤 · 3.6초 · 12%/22%/42%)을 바꾸면 HINT_* 도 같이 · 앱 볼륨 = desktop/fold.js SND_VOL · foldtab.html HINT_VOL
import os, sys, glob, subprocess, re, tempfile
import numpy as np
SR = 48000
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'sfx')

def load(name, trim=True):
    m = glob.glob(os.path.join(src, '**', name + '.wav'), recursive=True)
    if not m: sys.exit('재료 없음: ' + name)
    raw = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', m[0], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    if trim:
        on = np.argmax(np.abs(a) > np.abs(a).max() * 0.05)        # 앞 무음 자름
        a = a[max(0, on - 48):]
    return a / (np.abs(a).max() + 1e-9)

def shift(x, semi):                                               # 반음 단위로 높이·낮춤(다시 샘플링 = 녹음 결 그대로)
    if not semi: return x
    r = 2 ** (semi / 12); n = int(len(x) / r)
    return np.interp(np.arange(n) * r, np.arange(len(x)), x)

def onepole(x, fc):
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), x.shape)
    k = 1 - np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i in range(len(x)): s += k[i] * (x[i] - s); y[i] = s
    return y
def lp(x, fc, n=2):
    for _ in range(n): x = onepole(x, fc)
    return x
def hp(x, fc): return x - lp(x, fc, 1)

def place(buf, snd, t, g=1.0):
    i = int(t * SR); n = min(len(snd), len(buf) - i)
    if n > 0: buf[i:i + n] += snd[:n] * g

def fade(x, a=0.004, b=0.05):
    x = x.copy(); na, nb = int(a * SR), int(b * SR)
    if na: x[:na] *= np.linspace(0, 1, na)
    if nb: x[-nb:] *= np.linspace(1, 0, nb)
    return x

def env(n, pts):                                                  # 꺾은선 볼륨 [(초, 크기)…]
    t = np.arange(n) / SR; xs, ys = zip(*pts); return np.interp(t, xs, ys)

HARP = {'D2': ('D2', 0), 'A2': ('A2', 0), 'D3': ('C3', 2), 'F#3': ('G3', -1), 'A3': ('B3', -2), 'D4': ('D4', 0), 'F#4': ('F4', 1), 'A4': ('A4', 0)}
_h = {}
def harp(note, dur, soft=1500):                                   # 하프 한 음 · 고음을 깎아 둥글고 따뜻하게
    if note not in _h:
        f, s = HARP[note]; _h[note] = shift(load('KSHarp_' + f + '_mf'), s)
    x = _h[note][:int(dur * SR)].copy()
    x = lp(x, np.linspace(soft, soft * 0.6, len(x)), 2)
    x *= env(len(x), [(0, 1), (dur * 0.55, 0.7), (dur, 0)])
    return fade(x, 0.006, 0.02)

STR = {'D2c': ('susvib_D2_v1_1', 0), 'D3': ('ViolaEns_susvib_D3_v1_1', 0), 'F#3': ('ViolaEns_susvib_F3_v1_1', 1), 'A3': ('ViolaEns_susvib_A3_v1_1', 0)}
_s = {}
def strings(note, dur, pts, fc=1600):                             # 현 합주 한 음(활 긋는 첫머리는 빼고 가운데 고른 부분) · 볼륨은 pts로 천천히
    if note not in _s:
        f, s = STR[note]; a = shift(load(f, trim=False), s)
        on = np.argmax(np.abs(a) > 0.1); _s[note] = a[on + int(0.6 * SR):]
    x = _s[note][:int(dur * SR)].copy()
    x = lp(x, fc, 2) * env(len(x), pts)
    return fade(x, 0.01, 0.05)

roll = load('susp_hit_softmall_roll5_long_p', trim=False)
cym = load('cymbal-crash1_pp_rr1')
def air(dur, pts, fc_pts):                                        # 부드러운 말렛 심벌 굴림(고른 가운데 부분) = 은은한 바람 · 밝기는 시간에 따라
    on = np.argmax(np.abs(roll) > 0.2); x = roll[on + int(1.5 * SR): on + int((1.5 + dur) * SR)].copy()
    x = hp(lp(x, env(len(x), fc_pts), 2), 150) * env(len(x), pts)
    return fade(x / (np.abs(x).max() + 1e-9), 0.01, 0.05)
def suck(rise, fc):                                               # 거꾸로 튼 여린 크래시(빨려 드는 첫머리) · 아주 어둡게
    seg = cym[int(0.02 * SR): int((0.02 + rise) * SR)][::-1] * np.linspace(0, 1, int(rise * SR)) ** 2.5
    seg = hp(lp(seg, fc, 2), 200); return fade(seg / (np.abs(seg).max() + 1e-9), 0.01, 0.03)

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

# ── 접기: 0~0.26초 화면이 클라 쪽으로 빨려 들어감 → 먹먹해지며 멀어짐(클라 뒤로)
fo = np.zeros(int(1.5 * SR))
place(fo, suck(0.28, 1500), 0.0, 0.35)
place(fo, air(1.2, [(0, 0), (0.24, 1), (0.34, 0.75), (1.2, 0)], [(0, 900), (0.26, 1700), (0.5, 700), (1.2, 300)]), 0.0, 0.55)
for n, g in (('D3', 0.5), ('A3', 0.38)):
    place(fo, strings(n, 1.4, [(0, 0), (0.12, 1), (0.28, 0.9), (1.4, 0)], np.interp(np.arange(int(1.4 * SR)) / SR, [0, 0.28, 1.4], [1800, 1500, 350])), 0.0, g)
place(fo, harp('D3', 1.2, 1100), 0.26, 0.55)
place(fo, harp('A2', 1.2, 900), 0.27, 0.4)
write('fold-out.ogg', fo, -24)

# ── 펼치기: 0.05초에 창이 뜨고 0.38초 동안 미끄러져 나옴 → 바람이 열리며 하프가 아래에서 위로
fi = np.zeros(int(1.6 * SR))
place(fi, air(1.1, [(0, 0), (0.12, 1), (0.3, 0.6), (1.1, 0)], [(0, 500), (0.15, 1600), (1.1, 900)]), 0.0, 0.45)
for j, (n, g) in enumerate((('D3', 0.5), ('A3', 0.42), ('D4', 0.36), ('F#4', 0.28))):
    place(fi, harp(n, 1.3, 1600), 0.07 + j * 0.055, g)
for n, g in (('D3', 0.38), ('F#3', 0.28), ('A3', 0.3)):
    place(fi, strings(n, 1.4, [(0, 0), (0.3, 1), (0.6, 0.8), (1.4, 0)]), 0.05, g)
write('fold-in.ogg', fi, -24)

# ── 힌트(foldtab.html ftHint · 시작 0.35초 + 3.6초 × 비율)
HINT_APPEAR = 0.35 + 3.6 * 0.12 - 0.22                            # 꺾쇠가 스며 나오는 동안
HINT_TAP = [0.35 + 3.6 * 0.22 + 0.06, 0.35 + 3.6 * 0.42 + 0.06]   # 바깥으로 나가기 시작하는 순간
fh = np.zeros(int(3.5 * SR))
bed = [(0, 0), (0.55, 1), (1.6, 0.85), (2.4, 0.6), (3.0, 0)]
for n, g in (('D2c', 0.35), ('D3', 0.42), ('A3', 0.32)):
    place(fh, strings(n, 3.0, bed, 1400), 0.3, g)
place(fh, air(2.6, [(0, 0), (0.6, 1), (1.6, 0.5), (2.6, 0)], [(0, 700), (0.7, 1500), (2.6, 600)]), 0.3, 0.18)
for j, (n, g) in enumerate((('D3', 0.3), ('A3', 0.26), ('D4', 0.22))):
    place(fh, harp(n, 1.5, 1300), HINT_APPEAR + j * 0.09, g)
for t, notes, g in ((HINT_TAP[0], ('A3', 'D4'), 0.5), (HINT_TAP[1], ('F#3', 'D4'), 0.42)):
    for k, n in enumerate(notes): place(fh, harp(n, 1.4, 1500), t + k * 0.018, g * (1 if k else 0.8))
write('fold-hint.ogg', fh, -26)
