# 🎵 팟지 BGM·효과음 만들기(v0.1.40) — 사장님이 수노로 만든 원곡 2개에서 잘라냄
#   BGM = 「Victory Strike」 116~170초 → assets/bgm/potg-bgm.ogg (원곡 154.9초 「터짐」 = 파일 38.9초 → potg.js BGM_DROP)
#   효과음 = 「Impact Sequence」(한 곡에 이어진 효과음 묶음)에서 4개 → assets/sfx/potg-intro·hit·slow·slam.ogg
#   구간은 스펙트로그램으로 찾음(타격 = 저음 40~200Hz가 확 뛰는 곳). 각 파일 안 「타격 시각」은 potg.js SFX_HIT와 같아야 함
# 사용: python tools/potg-audio.py "<Victory Strike.mp3>" "<Impact Sequence.mp3>"   (리포 루트에서 · ffmpeg 경로 FF는 PC에 맞게)
import sys, subprocess, numpy as np
FF = r"C:/Users/sbs_n/AppData/Roaming/Python/Python314/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe"
SR = 44100
def load(f, a, b):
    raw = subprocess.run([FF, '-v', 'quiet', '-ss', str(a), '-t', str(b - a), '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def fade(x, fin, fout):
    x = x.copy(); n1, n2 = int(fin * SR), int(fout * SR)
    if n1: x[:n1] *= np.linspace(0, 1, n1)[:, None]
    if n2: x[-n2:] *= (np.linspace(1, 0, n2) ** 2)[:, None]
    return x
def save(x, out, loud=None, peak_db=-1.0):
    x = x / np.abs(x).max() * 10 ** (peak_db / 20)
    af = ['-af', f'loudnorm=I={loud}:TP=-1.5:LRA=11'] if loud else []
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-'] + af + ['-ar', str(SR), '-c:a', 'libvorbis', '-q:a', '5', out], input=x.astype(np.float32).tobytes(), check=True)
    print('saved', out, f'{len(x) / SR:.2f}s')
bgm, sfx = sys.argv[1], sys.argv[2]
save(fade(load(bgm, 116.0, 170.0), 1.0, 3.0), 'assets/bgm/potg-bgm.ogg', loud=-16)
save(fade(load(sfx, 1.00, 4.60), 0.005, 1.2), 'assets/sfx/potg-intro.ogg')   # 타격 0.15초
save(fade(load(sfx, 12.30, 13.40), 0.005, 0.6), 'assets/sfx/potg-hit.ogg')   # 타격 0.06초
save(fade(load(sfx, 5.15, 7.00), 0.02, 0.6), 'assets/sfx/potg-slow.ogg')     # 느려지는 떨림 → 타격 1.03초
save(fade(load(sfx, 20.30, 23.90), 0.005, 1.5), 'assets/sfx/potg-slam.ogg')  # 타격 0.07초 + 잔향
