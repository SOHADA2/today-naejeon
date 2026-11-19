# 🪙 선픽 동전 소리(assets/sfx/coin-flip.ogg) 만들기 — v0.1.229(사미라 없이 동전만: 튕김 → 빙글 → 결과 면에서 딱 멈춤)
#   실제 녹음만 섞음(합성음 없음 — 사장님: 합성음 싫음) · 재료 = OpenGameArt CC0(StarNinjas) 두 묶음:
#     「4 metal dings/rings」 https://opengameart.org/content/4-metal-dingsrings (ding_-_starninjas.zip → ding.1.ogg)
#     「12 Coin Sound Effects」 https://opengameart.org/node/123368 (coins_-_starninjas.zip → coin.12.ogg · coin.5.ogg · coin.2.ogg)
#   사용: 두 묶음을 한 폴더에 풀고  python tools/coin-flip-sfx.py <재료 폴더> <출력.ogg> [ffmpeg 경로]
#     ffmpeg = 이 PC는 pip install imageio-ffmpeg 안의 실행 파일(없으면 PATH의 ffmpeg) · numpy·scipy 필요
#   시각(초) = overlay/coin3d.js 와 같게: FLICK 0.34(튕김) · STOP 1.62(멈춤) — 바꾸면 두 곳 같이
#   소리: 0.34 「틱」(coin.12) + 「띵~」(ding.1에서 3865Hz 부분음만 좁게 거른 맑은 울림 = v0.1.32에서 고른 소리 · 돌 때처럼 아주 살짝 떨림) → 1.62에 울림이 끊기며 「착」(coin.5를 낮춰 둔탁하게 + coin.2 살짝)
import sys, os, subprocess, glob, numpy as np
from scipy.signal import butter, sosfilt, sosfiltfilt, hilbert
SRC, OUT = sys.argv[1], sys.argv[2]
def find_ff():
    if len(sys.argv) > 3: return sys.argv[3]
    try:
        import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception: return 'ffmpeg'
FF, SR = find_ff(), 44100
FLICK, STOP, LEN = 0.34, 1.62, 2.3
def load(name, af=None):
    cmd = [FF, '-v', 'quiet', '-i', os.path.join(SRC, name)] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    x = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).astype(np.float64)
    if not len(x): raise SystemExit('못 읽음: ' + name)
    return x
def bp(x, f0, bw, order=4):
    sos = butter(order, [f0 - bw / 2, f0 + bw / 2], btype='bandpass', fs=SR, output='sos')
    return sosfilt(sos, sosfilt(sos, x))
def lp(x, fc, order=4): return sosfilt(butter(order, fc, btype='lowpass', fs=SR, output='sos'), x)
def onset(x, k=0.2, pre=0.003):   # 첫 타격 바로 앞에서 자름
    e = np.abs(x); i = int(np.argmax(e > e.max() * k)); return x[max(0, i - int(pre * SR)):]
def norm(x): return x / np.abs(x).max()
def pitch(x, r): return np.interp(np.arange(0, len(x) - 1, r), np.arange(len(x)), x)   # r < 1 = 낮고 길게
def fade(x, n_in=0, n_out=0):
    x = x.copy()
    if n_in: x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out: x[-n_out:] *= np.linspace(1, 0, n_out)
    return x
mix = np.zeros(int(LEN * SR))
def put(t, x, g):
    i = int(round(t * SR)); x = x[:max(0, len(mix) - i)]; mix[i:i + len(x)] += x * g
# 튕김 「틱」
put(FLICK, norm(onset(load('coin.12.ogg'))), 0.5)
# 「띵~」 = ding.1의 3865Hz 부분음(+7450Hz 반짝임 조금) · 자연스럽게 줄어들다 멈추는 순간 끊김 · 도는 동안 9Hz로 아주 살짝 떨림(면이 번갈아 보이는 박자)
d = load('ding.1.ogg')
r = bp(d, 3865, 180) + 0.32 * bp(d, 7450, 300)
r = norm(onset(r, 0.35, 0.004))
n = int((STOP - FLICK - 0.002) * SR); r = r[:n]
# 울림은 0.5초면 거의 안 들릴 만큼 줄어듦(재 보니 -22dB) → 도는 1.3초 내내 들리게 줄어드는 폭만 눌러 줌(압축 · 소리 자체는 녹음 그대로) → 멈추는 순간 「뚝」 끊기는 게 들림
env = np.abs(hilbert(r)); env = sosfiltfilt(butter(2, 25, btype='lowpass', fs=SR, output='sos'), env); env = np.maximum(env / env.max(), 1e-3)
r = norm(r * env ** -0.55)
tt = np.arange(len(r)) / SR
r = r * (1 - 0.16 * (0.5 - 0.5 * np.cos(2 * np.pi * 9.0 * tt)))
put(FLICK + 0.002, fade(r, 0, int(0.022 * SR)), 0.42)
# 멈춤 「착」 = 동전이 손바닥에 잡히듯 짧고 둔탁하게
c5 = norm(onset(lp(pitch(load('coin.5.ogg'), 0.62), 6500)))
c5 = fade(c5[:int(0.20 * SR)], 0, int(0.12 * SR))
put(STOP, c5, 0.62)
put(STOP + 0.001, fade(norm(onset(load('coin.2.ogg')))[:int(0.09 * SR)], 0, int(0.06 * SR)), 0.16)
mix = fade(mix, 0, int(0.05 * SR))
pk = np.abs(mix).max(); mix = np.tanh(mix / pk * 1.5) / np.tanh(1.5) * 0.89   # 「틱」 봉우리만 살짝 눌러 전체를 키움(예전 동전 소리와 비슷한 크기 · 봉우리 -1dBFS · 앱에서 볼륨 0.3 × 설정)
raw = (np.clip(mix, -1, 1).astype(np.float32)).tobytes()
subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libvorbis', '-q:a', '5', OUT], input=raw, check=True)
print('만듦', OUT, f'{os.path.getsize(OUT) / 1024:.1f}KB', f'{LEN}초')
