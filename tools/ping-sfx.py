# 🔊 핑 소리 만들기(v0.1.256 · 롤 게임 파일 소리 대신 · 실제 녹음만 = 합성음 없음)
# 재료 = Kenney 「Interface Sounds」(CC0) — https://opengameart.org/content/interface-sounds (kenney_interfaceSounds.zip · 이 리포엔 안 넣음)
# 사용: python tools/ping-sfx.py <압축 푼 폴더(Audio/*.ogg가 있는 곳 또는 그 위)> [출력 폴더(기본 assets/ping/sfx)]
#   → {핑 이름}.ogg · 크기 = 약 -16 LUFS(짧은 소리라 0.6초 조용한 꼬리를 붙여 잼) · 봉우리 -1 dBFS 아래
#   핑 이름은 overlay/overlay.js PING · slot/cping.html PING과 같음 · 앱 재생 볼륨 = overlay PING_VOL(cping도 같은 값)
import os, sys, glob, subprocess, re, tempfile
try:
    import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'ping', 'sfx')
os.makedirs(out, exist_ok=True)
def find(n):
    m = glob.glob(os.path.join(src, '**', n + '.ogg'), recursive=True)
    if not m: sys.exit('재료 없음: ' + n)
    return m[0]
# 핑 → [(재료, 시작 초)] — 두 개면 겹쳐 섞음
PLAN = {
    'look':   [('bong_001', 0)],                          # 여기 봐요 = 종 「봉」
    'ready':  [('confirmation_002', 0)],                  # 준비 완료 = 확인음
    'go':     [('maximize_004', 0)],                      # 가자! = 올라가는 소리
    'good':   [('select_003', 0)],                        # 좋아요 = 선택음
    'lol':    [('pluck_001', 0), ('pluck_002', 0.13)],    # ㅋㅋ = 「뽁뽁」
    'wait':   [('tick_002', 0), ('tick_004', 0.2)],       # 잠깐만 = 「똑딱」
    'sorry':  [('minimize_005', 0)],                      # 미안 = 내려가는 소리
    'ask':    [('question_002', 0)],                      # ? = 물음 소리
    'thanks': [('glass_004', 0)],                         # 고마워 = 맑은 유리 소리
}
def run(args): return subprocess.run([FF, '-hide_banner', '-y'] + args, capture_output=True, text=True)
def lufs(path):
    r = run(['-i', path, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'])
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr); return float(m[-1]) if m else None
TARGET = -16.0
for k, parts in PLAN.items():
    tmp = os.path.join(tempfile.gettempdir(), f'tnping_{k}.wav')
    ins, flt = [], []
    for i, (n, t) in enumerate(parts):
        ins += ['-i', find(n)]; flt.append(f'[{i}:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay={int(t * 1000)}|{int(t * 1000)}[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(len(parts))) + (f'amix=inputs={len(parts)}:normalize=0' if len(parts) > 1 else 'anull') + '[m]'
    r = run(ins + ['-filter_complex', ';'.join(flt + [mix]), '-map', '[m]', tmp])
    if r.returncode: sys.exit(r.stderr[-400:])
    g = TARGET - (lufs(tmp) or TARGET)
    dst = os.path.join(out, k + '.ogg')
    r = run(['-i', tmp, '-af', f'volume={g:.2f}dB,alimiter=limit=0.89:attack=1:release=30', '-c:a', 'libvorbis', '-q:a', '5', dst])
    if r.returncode: sys.exit(r.stderr[-400:])
    print(f'{k:7s} {"+".join(n for n, _ in parts):32s} {g:+.1f}dB → {lufs(dst):.1f} LUFS')
