# 🪙 동전 소리(assets/sfx/coin-samira.ogg) 섞기 — v0.1.32. 재료 = OpenGameArt CC0 묶음을 %TEMP%/samira/sfx/cand 에 풀어 둠(출처·파일명 = assets/sfx/CREDITS.txt)
# 사용: python tools/coin-sfx-mix.py <출력폴더>  → coin-samira5A/B/C.ogg + 「띵~」만 mp3 · ffmpeg 경로(FF)는 PC에 맞게
# v0.1.32 동전 「띵~」 다시 섞기 — 철판 같던 금속 타격(bfh1_metal_hit_01/06)과 ding의 저음·잡음 걷어냄
# 울림 = ding.1(OpenGameArt starninjas CC0)에서 가장 오래 우는 3865Hz 부분음만 좁게 걸러냄(+7450Hz 반짝임 -10dB)
# 튕기는 순간 = 실제 동전 부딪힘 「틱」(12 coin sound effects c12_coin.12, CC0) — 사용: python coin_mix5.py <출력폴더>
import sys, os, subprocess, numpy as np
from scipy.signal import butter, sosfilt
FF = r"C:/Users/sbs_n/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
SR = 44100
C = os.path.join(os.environ['TEMP'], 'samira', 'sfx', 'cand')
OUT = sys.argv[1]
def load(f, af=None):
    cmd = [FF, '-v', 'quiet', '-i', f] + (['-af', af] if af else []) + ['-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.float32).astype(np.float64)
def bp(x, f0, bw, order=4):
    sos = butter(order, [f0 - bw / 2, f0 + bw / 2], btype='bandpass', fs=SR, output='sos')
    return sosfilt(sos, sosfilt(sos, x))
def ring(pitch=1.0, shimmer=0.32):
    d = load(os.path.join(C, 'ding_ding.1.ogg'))
    r = bp(d, 3865, 180) + shimmer * bp(d, 7450, 300)
    env = np.abs(r); on = int(np.argmax(env > env.max() * 0.35)); r = r[max(0, on - int(0.004 * SR)):]   # 조용한 들어감 잘라 튕기는 순간 바로 울림
    if pitch != 1.0: r = np.interp(np.arange(0, len(r) - 1, pitch), np.arange(len(r)), r)
    return r / np.abs(r).max()
def fade(x, n_in, n_out):
    x = x.copy()
    if n_in: x[:n_in] *= np.linspace(0, 1, n_in)
    if n_out: x[-n_out:] *= np.linspace(1, 0, n_out)
    return x
def build(name, R, ring_gain=0.4, tick='c12_coin.12.ogg', tick_gain=0.5):
    mix = np.zeros(int(6.0 * SR))
    def put(t, x, g):
        i = int(round((t + 0.4) * SR)); x = x[:max(0, len(mix) - i)]; mix[i:i + len(x)] += x * g   # +0.4 = 사미라 등장(INTRO) · 아래 시각은 Taunt 기준
    pk = lambda f, af=None: (lambda a: a / np.abs(a).max())(load(os.path.join(C, f), af))
    put(0.03, pk('cloth1.ogg'), 0.13)
    put(0.16, pk(tick), tick_gain)                                   # 엄지로 튕김 「틱」
    put(0.162, fade(R[:int(0.478 * SR)], 0, int(0.015 * SR)), ring_gain)   # 「띵~」 → 손에 잡히는 0.64초에 끊김
    put(0.64, pk('handleSmallLeather.ogg'), 1.5); put(0.65, pk('metalClick.ogg'), 0.5)
    put(0.76, pk('blade_02.ogg'), 0.22); put(0.77, pk('cloth2.ogg'), 0.15)
    put(1.16, pk('cloth3.ogg'), 0.16); put(2.33, pk('cloth4.ogg'), 0.16)
    put(2.91, pk(tick), tick_gain * 0.9)                             # 화면 쪽으로 튕김 「틱」
    put(2.912, fade(R[:int(0.46 * SR)], 0, int(0.2 * SR)), ring_gain * 1.05)   # 「띵~」 날아가며 꽂히기(3.38) 전에 잦아듦
    put(2.94, pk('blade_01.ogg'), 0.5)
    put(3.38, pk('bfh1_hit_07.ogg'), 0.9); put(3.39, pk('glass_breaking.wav', 'lowpass=f=7500'), 0.95)
    put(3.66, pk('cloth1.ogg'), 0.1); put(4.08, pk('metalLatch.ogg'), 0.45); put(4.43, pk('metalClick.ogg'), 0.5)
    raw = (mix / max(1.0, np.abs(mix).max())).astype(np.float32).tobytes()
    out = os.path.join(OUT, name)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', str(SR), '-ac', '2', '-c:a', 'libvorbis', '-q:a', '4', out], input=raw, check=True)
    # 「띵~」만 따로(비교용)
    solo = np.zeros(int(1.4 * SR)); t = c12 = pk(tick); solo[:len(t)] += t * tick_gain; solo[int(0.002 * SR):int(0.002 * SR) + int(1.2 * SR)] += fade(R[:int(1.2 * SR)], 0, int(0.3 * SR)) * ring_gain
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'loudnorm=I=-18:TP=-2', '-ar', str(SR), '-c:a', 'libmp3lame', '-q:a', '3', out.replace('.ogg', '-ting.mp3')], input=(solo / np.abs(solo).max()).astype(np.float32).tobytes(), check=True)
    print('saved', out)
build('coin-samira5A.ogg', ring(1.0, 0.32))          # A: 3.9kHz 맑은 띵 + 살짝 반짝임
build('coin-samira5B.ogg', ring(1.0, 0.0))           # B: 3.9kHz 음 하나만(가장 순수)
build('coin-samira5C.ogg', ring(1.25, 0.32))         # C: 한 음 높게(4.8kHz) 더 가늘게
