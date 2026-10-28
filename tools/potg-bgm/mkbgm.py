# 🎵 팟지 BGM — 「레전드 장면」 에픽 오케스트라 (VSCO-2 CE 실제 악기 녹음, CC0)
# bed.ogg   = 8초 무한 반복(D단조 i–VI–III–VII: Dm Bb F C · 120bpm) — 저음 현 스피카토 8분 오스티나토 + 팀파니 + 큰북 + 호른 화음
# climax.ogg = 상승(2.5초, A 딸림화음 + 팀파니·스네어 롤 + 심벌 크레센도) → 2.5초에 「쾅」 D장조(승리) 총주 + 공 → 긴 울림
import sys; sys.path.insert(0, '.')
from lib import *
P = r'_([A-G]#?\d)_'
CB, VC, VA, VN = 'Strings/Solo Contrabass/Spic', 'Strings/Cello Section/spic', 'Strings/Viola Section/spic', 'Strings/Violin Section/Spic'
HN, TB, TU, TP = 'Brass/F Horn/sus', 'Brass/Tenor Trombone/sus', 'Brass/Tuba/sus', 'Brass/Trumpet/sus'
VNS, VAS, VCS = 'Strings/Violin Section/susVib', 'Strings/Viola Section/susvib', 'Strings/Cello Section/susvib'
PC = V + 'Percussion/'
def perc(f): return load(PC + f)
BEAT = 0.5; BAR = 2.0
def swell(x, a=0.6):   # 서서히 커지는 시작
    n = min(len(x), int(a * SR)); x = x.copy(); x[:n] *= np.linspace(0, 1, n)[:, None] ** 1.5; return x
# ── bed ─────────────────────────────────
L = 8.0; bed = np.zeros((int((L + 4) * SR), 2), np.float32)
chords = [('D', ['D', 'F', 'A']), ('A#', ['A#', 'D', 'F']), ('F', ['F', 'A', 'C']), ('C', ['C', 'E', 'G'])]
for b, (root, tones) in enumerate(chords):
    t0 = b * BAR
    r2 = nm(root + '2'); r1 = r2 - 12
    for i in range(8):   # 8분 오스티나토 · 강박(1, 2.5, 4) 강세
        t = t0 + i * 0.25; acc = 1.0 if i in (0, 3, 6) else 0.55
        add(bed, note(CB, P, r1 + (12 if r1 < 26 else 0), 'v3', 0.22), t, 0.55 * acc)
        add(bed, note(VC, P, r2, 'v2', 0.22), t, 0.5 * acc)
        add(bed, note(VA, P, r2 + 12 + (7 if i % 2 else 0), 'v2', 0.2), t, 0.22 * acc)
    for t, g in ((0, 1.0), (1.5, 0.7)): add(bed, perc('Timpani/Timpani2_Hit_v4_rr1_Sum.wav'), t0 + t, 0.5 * g)
    add(bed, perc('BDrumNewhit_v5_rr1_Sum.wav'), t0, 0.45)
    add(bed, perc('BDrumNewhit_v5_rr1_Sum.wav'), t0 + 1.0, 0.25)
    for k, n in enumerate(tones):   # 호른 화음(마디 길이, 부드럽게 시작)
        m = nm(n + '3') if k else nm(n + '3')
        add(bed, swell(note(HN, P, m + (12 if k == 2 and m < nm('C4') else 0), 'v2', BAR + 0.1, 0.3), 0.5), t0, 0.16)
    if b >= 2:   # 뒤 두 마디는 바이올린 높은 지속음(올라가는 느낌)
        add(bed, swell(note(VNS, P, nm(tones[1] + '5'), 'v2', BAR + 0.1, 0.3), 0.8), t0, 0.12)
# 반복 이음매: 8초 뒤 꼬리를 앞에 겹쳐 접음
tail = bed[int(L * SR):].copy(); bed = bed[:int(L * SR)]; bed[:len(tail)] += tail
# ── climax ──────────────────────────────
HIT = 2.5; cl = np.zeros((int((HIT + 7) * SR), 2), np.float32)
roll = perc('Timpani/Rolls/Timpani3_Roll_v5_rr1_Sum.wav')[: int(HIT * SR)].copy(); roll *= np.linspace(0.15, 1, len(roll))[:, None] ** 2
add(cl, roll, 0, 0.7)
sn = perc('Snare2-rollNS_v5_rr1_Sum.wav')
sn = np.concatenate([sn] * (1 + int(HIT * SR) // len(sn)))[: int(HIT * SR)].copy(); sn *= np.linspace(0.05, 1, len(sn))[:, None] ** 2.2
add(cl, sn, 0, 0.35)
cr = perc('susCymb1-cresc-Short_v1.wav'); pk = int(np.argmax(np.abs(cr).max(1))); add(cl, cr[:pk], HIT - pk / SR, 0.55)
for n, inst, v, g in (('A2', TB, 'v2', 0.3), ('E3', TB, 'v2', 0.25), ('C#4', HN, 'v2', 0.2), ('A3', HN, 'v2', 0.2), ('A1', TU, 'v2', 0.35)):
    x = note(inst, P, nm(n), v, HIT - 0.12, 0.08); x *= np.linspace(0.1, 1, len(x))[:, None] ** 2; add(cl, x, 0, g)
for i in range(10):   # 현 스피카토 16분 상승(A음 반복, 점점 셈)
    t = HIT - 1.25 + i * 0.125; add(cl, note(VC, P, nm('A2'), 'v2', 0.12), t, 0.25 + 0.04 * i); add(cl, note(VN, P, nm('A4') + (i // 4) * 2, 'v2', 0.12), t, 0.1 + 0.025 * i)
# 「쾅」 = D장조 총주
for f, g in (('gongHit_fff.wav', 0.6), ('BDrumNewhit_v7_rr1_Sum.wav', 0.9), ('Timpani/Timpani1_Hit_v3_rr1_Sum.wav', 0.8), ('cymbal-crash1_ff_rr1.wav', 0.5)): add(cl, perc(f), HIT, g)
SUS = 5.5
for n, inst, v, g in (('D1', TU, 'v2', 0.5), ('D2', TB, 'v2', 0.4), ('A2', TB, 'v2', 0.35), ('F#3', TB, 'v2', 0.3), ('D3', HN, 'v2', 0.28), ('A3', HN, 'v2', 0.28), ('F#4', HN, 'v2', 0.24),
                      ('D4', TP, None, 0.22), ('F#4', TP, None, 0.2), ('A4', TP, None, 0.2), ('D5', VNS, 'v2', 0.16), ('A4', VAS, 'v2', 0.14), ('D3', VCS, 'v3', 0.22)):
    x = note(inst, P, nm(n), v, SUS, 1.2); x *= np.concatenate([np.ones(int(1.0 * SR)), np.linspace(1, 0.35, max(0, len(x) - int(1.0 * SR)))])[:len(x), None]; add(cl, x, HIT, g)
add(cl, note(CB, P, nm('D1') + 12, 'v3', 0.5), HIT, 0.6)
def out(name, x, loop=False):
    x = x / np.abs(x).max() * 0.9
    x.astype(np.float32).tofile(name + '.raw')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', name + '.raw', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'libvorbis', '-q:a', '4', name + '.ogg'], check=True)
out('bed', bed); out('climax', cl)
# 미리 듣기: bed 2번 → climax(쾅이 12초에)
prev = np.zeros((int(20 * SR), 2), np.float32)
b2 = load(os.path.abspath('bed.ogg')); c2 = load(os.path.abspath('climax.ogg'))
add(prev, np.concatenate([b2, b2])[: int((12 - HIT + 0.1) * SR)], 0, 1); add(prev, c2, 12 - HIT, 1)
prev = prev / np.abs(prev).max() * 0.9; prev.tofile('prev.raw')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', 'prev.raw', '-c:a', 'libmp3lame', '-b:a', '160k', 'bgm_preview.mp3'], check=True)
print('ok', len(bed) / SR, len(cl) / SR)
