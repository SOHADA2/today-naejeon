# 🎬 팟지 미리보기 소리 섞기 + mp4 — potg-preview.cjs가 남긴 log.json대로
#   영상 소리 = 기록된 영상 위치를 따라 원본을 다시 읽음(슬로모션=느리고 낮게·정지=무음) × 영상 볼륨 · BGM = 기록된 위치·볼륨대로 · 효과음 = 기록된 시각(potg.js SFX 볼륨 × 설정 1)
# 사용: python tools/potg-preview-mix.py <영상.webm> <출력폴더> <out.mp4>   (리포 루트)
import sys, json, subprocess, numpy as np
FF = r"C:/Users/sbs_n/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
SR = 48000
clip, d, out = sys.argv[1], sys.argv[2], sys.argv[3]
L = json.load(open(d + '/log.json', encoding='utf-8'))
def load(f): return np.frombuffer(subprocess.run([FF, '-v', 'quiet', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout, np.float32).reshape(-1, 2).astype(np.float64)
N = int(L['dur'] * SR); mix = np.zeros((N, 2)); t = np.arange(N) / SR
s = np.array(L['s'])   # [t, v.time, v.play, v.vol, v.rate, bgm.time, bgm.play, bgm.vol]
def track(src, col_pos, col_play, col_vol):
    pos = np.interp(t, s[:, 0], s[:, col_pos]); play = np.interp(t, s[:, 0], s[:, col_play]) > 0.5; vol = np.interp(t, s[:, 0], s[:, col_vol])
    i = np.clip(pos * SR, 0, len(src) - 2); k = i.astype(int); f = (i - k)[:, None]
    y = src[k] * (1 - f) + src[k + 1] * f
    g = (play * vol)[:, None]
    # 끊김 방지: 재생/정지 바뀌는 곳 5ms 부드럽게
    g = np.convolve(g[:, 0], np.ones(240) / 240, 'same')[:, None]
    return y * g
mix += track(load(clip), 1, 2, 3)
mix += track(load('assets/bgm/potg-bgm.ogg'), 5, 6, 7)
VOL = {'intro': 0.55, 'hit': 0.45, 'slow': 0.5, 'slam': 0.65}
for e in L['ev']:
    x = load(f"assets/sfx/potg-{e['n']}.ogg") * VOL[e['n']] * e['g']; i = int(e['t'] * SR); x = x[:max(0, N - i)]; mix[i:i + len(x)] += x
mix = mix / max(1.0, np.abs(mix).max() / 0.95)
wav = d + '/mix.f32'; open(wav, 'wb').write(mix.astype(np.float32).tobytes())
subprocess.run([FF, '-v', 'error', '-y', '-framerate', str(L['fps']), '-i', d + '/frames/%05d.jpg', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', wav,
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out], check=True)
print('saved', out)
