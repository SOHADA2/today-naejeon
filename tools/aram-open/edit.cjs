// 🎞️ 홈페이지 오프닝 편집(docs/img/aram-open.mp4) — 찍은 장면을 맵마다 이어 붙임(흰 섬광·가로 흐림 전환 · 색 보정) · node tools/aram-open/edit.cjs <장면 폴더> <출력.mp4>
//   장면 폴더 안: take1 = 필트오버 8445501097(shots-ice.cjs를 1092로) · take2 = 얼음(shots-ice.cjs 498) · take4 = 아이오니아 · take5 = 포탄
const { execFileSync } = require('child_process'), path = require('path');
const S = process.argv[2], out = process.argv[3];
// ⚠️ 2026-11-05 버벅임(사장님): ① fps=30으로 맞추면 원본(실제 ~29장/초)에 0.3초마다 같은 프레임이 끼고 ② 1.3~1.45배로 돌리면 프레임을 고르지 않게 버림
//   → 프레임 번호로 다시 매김(setpts=N/30) · 배속은 편집에서 안 함(빠르게/느리게는 리플레이 playbackSpeed로 찍을 때) · 측정 = 이웃 프레임 차이 튐 4~5%(원본과 같음)
const segs = [   // [파일, 시작, 끝(다시 매긴 초), 다음으로 넘어가는 효과, 효과 길이]
  ['take2/16-22_KR-8445370954_02.webm', 0.0, 1.9, 'fadewhite', 0.16],   // 얼음 칼바람 · 하늘에서 다리 전체
  ['take1/16-22_KR-8445501097_01.webm', 4.5, 5.7, 'fadewhite', 0.16],   // 필트오버 다리 · 다리 위를 날아감(⚠️ 6.6초 = 동선 이음매라 피함)
  ['take4/16-22_KR-8445654607_02.webm', 2.0, 3.0, 'fadewhite', 0.16],   // 아이오니아 벚꽃 · 하늘에서
  ['take2/16-22_KR-8445370954_01.webm', 8.7, 10.3, 'fadewhite', 0.16],  // 얼음 · 한타 위로 솟음
  ['take6/16-22_KR-8445370954_01.webm', 0.9, 5.9, null, 0],             // 자야 포탄: 멀리서 대포 → 0.4배 발사·내려와 옆에 붙음 → 나란히 날아감 → 착지하면 돌며 멀어짐
];
const args = ['-v', 'error', '-y'], f = [];
segs.forEach(([file], i) => args.push('-i', path.join(S, file)));
segs.forEach(([, a, b], i) => f.push(`[${i}:v]setpts=N/30/TB,trim=${a}:${b},setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,settb=AVTB,fps=30[s${i}]`));   // 다시 매긴 뒤라 fps=30은 그대로 통과
let prev = 's0', len = segs[0][2] - segs[0][1];
for (let i = 1; i < segs.length; i++) {
  const [, a, b] = segs[i], [, , , tr, td] = segs[i - 1], d = b - a, off = len - td;
  f.push(`[${prev}][s${i}]xfade=transition=${tr}:duration=${td}:offset=${off.toFixed(3)}[x${i}]`);
  prev = `x${i}`; len = off + d;
}
f.push(`[${prev}]eq=contrast=1.07:saturation=1.12:brightness=-0.01,colorbalance=bs=0.04:bm=0.02,vignette=PI/5,scale=1600:-2,format=yuv420p[v]`);
args.push('-filter_complex', f.join(';'), '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('길이(계산)', len.toFixed(2), '초 → ', out);
