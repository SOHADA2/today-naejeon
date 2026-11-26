# 🔊 핑 소리 만들기(v0.1.257 · 사장님: Kenney 인터페이스 소리는 기계음 느낌 → 스케치 컨셉에 맞게 다시)
#   실제 악기 녹음만(합성음 없음) = 마림바·실로폰·글로켄슈필·바이올린 피치카토·나무 블록(슬릿 드럼)
#   재료 = VSCO-2 Community Edition(CC0) https://github.com/sgossner/VSCO-2-CE — 아래 FILES 10개(리포엔 안 넣음)
#     Percussion/Marimba/Marimba_hit_Outrigger_C6_loud_01.wav · Percussion/Xylo/Xylo_Medium_C6_ff_01_far.wav
#     Percussion/Glock/glock_medium_C6.wav · glock_medium_C7.wav · Strings/Solo Violin/Pizz/LLVln_Pizz_C5_f_RR1.wav · LLVln_Pizz_E5_f_RR1.wav
#     VSCO 1 Percussion/varWood/log_drum/slitdrum0_ff_1.wav · slitdrum1_ff_1.wav
#     (받기 = https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/<경로> · 빈칸은 %20)
# 사용: python tools/ping-sfx.py <재료 폴더> [출력 폴더(기본 assets/ping/sfx)]
#   → {핑 이름}.ogg · 음 높이 = 같은 녹음을 반음 단위로 올리고 내림(asetrate) · 앞 무음 잘라 바로 울림 · 크기 약 -16 LUFS
import os, sys, glob, subprocess, re, tempfile
try:
    import imageio_ffmpeg; FF = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FF = 'ffmpeg'
src = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'ping', 'sfx')
os.makedirs(out, exist_ok=True)
FILES = { 'M': 'Marimba_hit_Outrigger_C6_loud_01', 'X': 'Xylo_Medium_C6_ff_01_far', 'G': 'glock_medium_C6', 'G7': 'glock_medium_C7',
          'PC': 'LLVln_Pizz_C5_f_RR1', 'PE': 'LLVln_Pizz_E5_f_RR1', 'L0': 'slitdrum0_ff_1', 'L1': 'slitdrum1_ff_1' }
# 핑 → [(재료, 반음, 시작 초, 크기, 길이 초)]
PLAN = {
    'look':   [('M', 0, 0, 1.0, 0.7), ('G7', 0, 0.015, 0.22, 0.6)],                                          # 여기 봐요 = 마림바 「똥~」 + 글로켄 반짝
    'ready':  [('M', -5, 0, 0.9, 0.35), ('M', 0, 0.1, 1.0, 0.7)],                                             # 준비 완료 = 「또롱!」(4도 위로)
    'go':     [('X', 0, 0, 0.8, 0.25), ('X', 4, 0.065, 0.85, 0.25), ('X', 7, 0.13, 0.9, 0.3), ('X', 12, 0.195, 1.0, 0.6)],   # 가자! = 실로폰 「또로로롱↑」
    'good':   [('G', 7, 0, 0.9, 0.9), ('M', 0, 0, 0.45, 0.5)],                                               # 좋아요 = 글로켄 「띵!」 + 마림바 받침
    'lol':    [('PE', 7, 0, 0.9, 0.18), ('PE', 9, 0.085, 0.9, 0.18), ('PE', 7, 0.17, 0.9, 0.18), ('PE', 12, 0.255, 1.0, 0.35)],   # ㅋㅋ = 피치카토 「티리티링」
    'wait':   [('L1', 0, 0, 1.0, 0.35), ('L0', 0, 0.26, 0.9, 0.4)],                                           # 잠깐만 = 나무 블록 「똑. 딱.」
    'sorry':  [('M', 4, 0, 0.8, 0.4), ('M', 0, 0.16, 0.7, 0.8)],                                              # 미안 = 「또롱↓」
    'ask':    [('PC', 12, 0, 0.85, 0.2), ('PC', 17, 0.12, 1.0, 0.45)],                                        # ? = 피치카토 「응?」(4도 위로)
    'thanks': [('G', 7, 0, 0.6, 0.5), ('G', 4, 0.08, 0.6, 0.5), ('G', 12, 0.16, 0.75, 1.0)],                 # 고마워 = 글로켄 「띠리링~」
}
def find(n):
    m = glob.glob(os.path.join(src, '**', n + '.wav'), recursive=True)
    if not m: sys.exit('재료 없음: ' + n)
    return m[0]
def run(args): return subprocess.run([FF, '-hide_banner', '-y'] + args, capture_output=True, text=True)
def rate(path):
    m = re.search(r'(\d{4,6}) Hz', run(['-i', path]).stderr); return int(m.group(1)) if m else 44100
def lufs(path):
    r = run(['-i', path, '-af', 'apad=pad_dur=0.6,ebur128', '-f', 'null', '-'])
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', r.stderr); return float(m[-1]) if m else None
TARGET = -16.0
for k, notes in PLAN.items():
    tmp = os.path.join(tempfile.gettempdir(), f'tnping_{k}.wav')
    ins, flt = [], []
    for i, (f, st, t, g, d) in enumerate(notes):
        p = find(FILES[f]); sr = rate(p); ins += ['-i', p]
        flt.append(f'[{i}:a]aformat=channel_layouts=stereo,silenceremove=start_periods=1:start_threshold=-48dB,'
                   f'asetrate={sr * 2 ** (st / 12):.1f},aresample=44100,atrim=0:{d},afade=t=out:st={d * 0.55:.3f}:d={d * 0.45:.3f},'
                   f'volume={g},adelay={int(t * 1000)}|{int(t * 1000)}[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(len(notes))) + (f'amix=inputs={len(notes)}:normalize=0' if len(notes) > 1 else 'anull') + '[m]'
    r = run(ins + ['-filter_complex', ';'.join(flt + [mix]), '-map', '[m]', tmp])
    if r.returncode: sys.exit(r.stderr[-600:])
    gain = TARGET - (lufs(tmp) or TARGET)
    dst = os.path.join(out, k + '.ogg')
    r = run(['-i', tmp, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.8:attack=1:release=30', '-c:a', 'libvorbis', '-q:a', '5', dst])
    if r.returncode: sys.exit(r.stderr[-600:])
    print(f'{k:7s} 음 {len(notes)}개  {gain:+.1f}dB → {lufs(dst):.1f} LUFS')
