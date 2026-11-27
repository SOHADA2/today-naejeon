# 🔊 접기 손잡이 효과음 만들기(v0.1.281 · 사장님: 아주 자연스럽게 효과음도)
#   실제 녹음만(합성음 없음) = 크래시 심벌 아주 여리게(pp) · 하프(KS Harp)
#   재료 = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE — 아래 FILES(리포엔 안 넣음)
#     Percussion/cymbal-crash1_pp_rr1.wav · Strings/Harp/KSHarp_D4_mf.wav · KSHarp_G5_mf.wav · KSHarp_B5_mf.wav · KSHarp_D6_mf.wav
#     (받기 = https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/<경로>)
# 사용: python tools/fold-sfx.py <재료 폴더> [출력 폴더(기본 assets/sfx)]   · ffmpeg가 PATH에 있어야 함
#   fold-out.ogg  = 접기(0.26초 가속) — 거꾸로 튼 심벌 바람 「스윽」이 끝에서 먹먹해지며 클라 뒤로 사라짐 + 아주 작은 낮은 하프 「둥」
#   fold-in.ogg   = 펼치기(0.38초 감속) — 바람이 앞에서 밝게 지나감 + 하프 한 음
#   fold-hint.ogg = 손잡이 힌트(desktop/foldtab.html ftHint와 같은 박자 · 애니메이션 시작 = 0초)
#                   0.6초 꺾쇠가 스며 나옴 = 하프 세 음을 여리게 굴림 · 1.20·1.92초 바깥으로 톡톡 = 하프 「팅·팅」
#   ⚠️ ftHint 시각(0.35초 뒤 · 3.6초 · 22%/42% = 바깥으로 나가기 시작)을 바꾸면 HINT_* 도 같이
import os, sys, glob, subprocess
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
    on = np.argmax(np.abs(a) > np.abs(a).max() * 0.05)          # 앞 무음 자름
    return a[max(0, on - 48):]

def onepole(x, fc):                                               # 한 극 저역 통과(fc = 배열 또는 숫자 · 시간에 따라 바뀜)
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

def pluck(h, dur, soft=2600):                                     # 하프 한 음 · 줄 퉁기는 순간을 살짝 둥글게(소리 결은 그대로)
    s = h[:int(dur * SR)].copy()
    s = lp(s, np.linspace(soft, soft * 1.6, len(s)), 1)
    env = np.ones(len(s)); tail = int(min(0.25, dur * 0.5) * SR); env[-tail:] = np.linspace(1, 0, tail) ** 1.5
    return fade(s * env, 0.002, 0.01)

cym = load('cymbal-crash1_pp_rr1')
H = {k: load('KSHarp_' + k + '_mf') for k in ('D4', 'G5', 'B5', 'D6')}

def whoosh(rise, fall, peak_fc, end_fc, gain=1.0):
    # 거꾸로 튼 심벌(차오름 rise초) → 그대로 이어지는 꼬리(fall초) · 고음은 깎아 바람처럼 · 끝 쪽 밝기 end_fc
    seg = cym[int(0.02 * SR): int((0.02 + rise) * SR)][::-1]      # 맨 앞 때리는 순간(0.02초)은 빼서 「챙」 없이
    seg = seg * np.linspace(0, 1, len(seg)) ** 2.2
    tail = cym[int(0.02 * SR): int((0.02 + fall) * SR)].copy()
    tail *= np.exp(-np.linspace(0, 5.5, len(tail)))
    x = np.concatenate([seg, tail])
    fc = np.concatenate([np.linspace(peak_fc * 0.45, peak_fc, len(seg)), np.linspace(peak_fc, end_fc, len(tail))])
    x = hp(lp(x, fc, 2), 180)
    return fade(x / (np.abs(x).max() + 1e-9) * gain, 0.01, 0.06)

def write(name, x, peak_db):
    x = x / (np.abs(x).max() + 1e-9) * (10 ** (peak_db / 20))
    p = os.path.join(out, name)
    subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-c:a', 'libvorbis', '-q:a', '5', p], input=x.astype('<f8').tobytes(), check=True)
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', p, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = [l for l in r.splitlines() if l.strip().startswith('I:')]
    print(name, f'{len(x)/SR:.2f}s', I[-1].strip() if I else '', os.path.getsize(p), 'B')

# ── 접기: 0~0.26초 화면이 클라 쪽으로 빨려 들어감(가속) → 끝에서 먹먹해지며 사라짐(클라 뒤로)
fo = np.zeros(int(0.95 * SR))
place(fo, whoosh(0.30, 0.45, 5200, 650), 0.0)
place(fo, lp(pluck(H['D4'], 0.6, 1400), 900, 2), 0.25, 0.22)     # 들어가 닿는 아주 작은 「둥」(먹먹하게)
write('fold-out.ogg', fo, -3)

# ── 펼치기: 0.05초에 창이 뜨고 0.38초 동안 미끄러져 나옴(감속) → 바람이 앞에서 밝게 + 하프 한 음
fi = np.zeros(int(1.1 * SR))
place(fi, whoosh(0.16, 0.5, 4200, 2600, 0.85), 0.0)
place(fi, pluck(H['B5'], 0.9), 0.15, 0.30)
write('fold-in.ogg', fi, -3)

# ── 힌트(foldtab.html ftHint · 시작 0.35초 + 3.6초 × 비율)
HINT_APPEAR = 0.35 + 3.6 * 0.12 - 0.20                             # 꺾쇠가 스며 나오는 동안 굴림
HINT_TAP = [0.35 + 3.6 * 0.22 + 0.06, 0.35 + 3.6 * 0.42 + 0.06]   # 바깥으로 나가기 시작하는 순간
fh = np.zeros(int(3.2 * SR))
for j, k in enumerate(('G5', 'B5', 'D6')):
    place(fh, pluck(H[k], 1.0, 2200), HINT_APPEAR + j * 0.07, 0.16 + j * 0.03)
place(fh, pluck(H['D6'], 1.1), HINT_TAP[0], 0.42)
place(fh, pluck(H['D6'], 1.1), HINT_TAP[1], 0.34)
write('fold-hint.ogg', fh, -3)
