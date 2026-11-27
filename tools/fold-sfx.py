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
#   ⚠️ v0.1.283 = 더 낮게(A1~E3) · 짧게(움직이는 순간만 · 힌트는 톡톡 두 번만) — 아래 「v0.1.283」 줄
#   ⚠️ ftHint 시각(0.35초 뒤 · 3.6초 · 22%/42%)을 바꾸면 HINT_* 도 같이 · 앱 볼륨 = desktop/fold.js SND_VOL · foldtab.html HINT_VOL
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

HARP = {'D2': ('D2', 0), 'E2': ('D2', 2), 'A2': ('A2', 0), 'C#3': ('C3', 1), 'E3': ('E3', 0), 'D3': ('C3', 2), 'F#3': ('G3', -1), 'A3': ('B3', -2), 'D4': ('D4', 0), 'F#4': ('F4', 1), 'A4': ('A4', 0)}
_h = {}
def harp(note, dur, soft=1500, tail=0.55, att=0.006):                                   # 하프 한 음 · 고음을 깎아 둥글고 따뜻하게
    if note not in _h:
        f, s = HARP[note]; _h[note] = shift(load('KSHarp_' + f + '_mf'), s)
    x = _h[note][:int(dur * SR)].copy()
    x = lp(x, np.linspace(soft, soft * 0.6, len(x)), 2)
    x *= env(len(x), [(0, 1), (dur * tail, 0.7), (dur, 0)])
    if att > 0.006: x *= np.clip(np.arange(len(x)) / (att * SR), 0, 1) ** 1.5   # 퉁기는 순간을 천천히 = 「퉁」 대신 「웅」
    return fade(x, 0.006, 0.02)

STR = {'A1c': ('susvib_D2_v1_1', -5), 'D2c': ('susvib_D2_v1_1', 0), 'D3': ('ViolaEns_susvib_D3_v1_1', 0), 'F#3': ('ViolaEns_susvib_F3_v1_1', 1), 'A3': ('ViolaEns_susvib_A3_v1_1', 0)}
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

# v0.1.283(사장님: 더 낮은 음 · 살짝 너무 김) = A장조로 더 내림(A1~E3) · 움직이는 순간만(접기 0.55초 · 펼치기 0.6초 · 힌트 = 톡톡 두 번만)
# v0.1.284(사장님: 훨씬 은은한 효과음) = 퉁기는 순간(어택)을 없앰 — 하프는 0.07~0.09초에 걸쳐 천천히 부풀고 400Hz 위를 깎아 「퉁」 대신 아주 옅은 「웅」 ·
#   소리의 몸통 = 말렛 심벌 숨결(450Hz 아래만) + 첼로 A1을 활로 부풀리듯 · 크기 -24 → -28 LUFS(힌트 -26 → -30) + 앱 볼륨 0.16 → 0.12 · 길이·박자는 v0.1.283 그대로
# ── 접기: 0~0.26초 숨결이 차오르다 닿는 순간 낮게 「웅」 하고 잦아듦
fo = np.zeros(int(0.55 * SR))
place(fo, air(0.45, [(0, 0), (0.22, 1), (0.32, 0.35), (0.45, 0)], [(0, 250), (0.24, 450), (0.45, 180)]), 0.0, 0.45)
place(fo, strings('A1c', 0.48, [(0, 0), (0.2, 1), (0.3, 0.55), (0.48, 0)], 380), 0.0, 0.6)
place(fo, harp('A2', 0.3, 380, 0.3, 0.07), 0.2, 0.3)
write('fold-out.ogg', fo, -28)

# ── 펼치기: 나오는 동안 숨결 + 첼로가 부풀었다 가라앉음 · 하프 두 음이 아주 옅게
fi = np.zeros(int(0.6 * SR))
place(fi, air(0.48, [(0, 0), (0.14, 1), (0.3, 0.4), (0.48, 0)], [(0, 220), (0.16, 450), (0.48, 250)]), 0.0, 0.4)
place(fi, strings('A1c', 0.52, [(0, 0), (0.17, 1), (0.34, 0.45), (0.52, 0)], 380), 0.02, 0.6)
place(fi, harp('A2', 0.36, 400, 0.32, 0.07), 0.05, 0.25)
place(fi, harp('E3', 0.32, 420, 0.32, 0.07), 0.12, 0.16)
write('fold-in.ogg', fi, -28)

# ── 힌트(foldtab.html ftHint · 시작 0.35초 + 3.6초 × 비율) = 바깥으로 톡톡 두 번에만 아주 옅은 「웅·웅」(첼로가 짧게 부풀고 하프가 겹침)
HINT_TAP = [0.35 + 3.6 * 0.22, 0.35 + 3.6 * 0.42]                 # 바깥으로 나가기 시작하는 순간(천천히 부푸는 만큼 앞당김)
fh = np.zeros(int((HINT_TAP[1] + 0.5) * SR))
for t, g in ((HINT_TAP[0], 0.5), (HINT_TAP[1], 0.42)):
    place(fh, strings('A1c', 0.4, [(0, 0), (0.1, 1), (0.4, 0)], 360), t, g)
    place(fh, harp('A2', 0.4, 380, 0.3, 0.09), t + 0.02, g * 0.6)
    place(fh, harp('E2', 0.4, 340, 0.3, 0.09), t + 0.03, g * 0.4)
write('fold-hint.ogg', fh, -30)
