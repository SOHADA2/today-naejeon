// 🎞️ 홈페이지 오프닝 편집(docs/img/aram-open.mp4) — 찍은 장면을 맵마다 이어 붙임(흰 섬광·가로 흐림 전환 · 색 보정) · node tools/aram-open/edit.cjs <장면 폴더> <출력.mp4>
//   장면 폴더 안: take1 = 필트오버 8445501097(shots-ice.cjs를 1092로) · take2 = 얼음(shots-ice.cjs 498) · take4 = 아이오니아 · take5 = 포탄
const { execFileSync } = require('child_process'), path = require('path');
const S = process.argv[2], out = process.argv[3];
const segs = [   // [파일, 시작, 끝, 배속, 다음으로 넘어가는 효과, 효과 길이]
  ['take2/16-22_KR-8445370954_02.webm', 0.0, 1.9, 1.0, 'fadewhite', 0.16],   // 얼음 칼바람 · 하늘에서 다리 전체
  ['take1/16-22_KR-8445501097_01.webm', 5.4, 6.9, 1.25, 'fadewhite', 0.16],  // 필트오버 다리 · 다리 위를 날아감
  ['take4/16-22_KR-8445654607_01.webm', 4.2, 5.7, 1.3, 'fade', 0.22],        // 아이오니아 벚꽃 · 낮게
  ['take4/16-22_KR-8445654607_02.webm', 2.0, 3.1, 1.1, 'fadewhite', 0.16],   // 아이오니아 · 하늘에서
  ['take2/16-22_KR-8445370954_01.webm', 8.4, 10.4, 1.45, 'fadewhite', 0.16], // 얼음 · 한타 위로 솟음
  ['take5/16-22_KR-8445370954_02.webm', 0.15, 1.35, 1.0, 'hblur', 0.24],     // 자야 · 대포 옆 → 날아오름(0.45배)
  ['take5/16-22_KR-8445370954_02.webm', 2.35, 4.1, 1.0, null, 0],            // 자야 · 위에서 쫓음
];
const args = ['-v', 'error', '-y'], f = [];
segs.forEach(([file], i) => args.push('-i', path.join(S, file)));
segs.forEach(([, a, b, sp], i) => f.push(`[${i}:v]trim=${a}:${b},setpts=(PTS-STARTPTS)/${sp},fps=30,scale=1920:1080,setsar=1,settb=AVTB[s${i}]`));
let prev = 's0', len = (segs[0][2] - segs[0][1]) / segs[0][3];
for (let i = 1; i < segs.length; i++) {
  const [, a, b, sp] = segs[i], [, , , , tr, td] = segs[i - 1], d = (b - a) / sp, off = len - td;
  f.push(`[${prev}][s${i}]xfade=transition=${tr}:duration=${td}:offset=${off.toFixed(3)}[x${i}]`);
  prev = `x${i}`; len = off + d;
}
f.push(`[${prev}]eq=contrast=1.07:saturation=1.12:brightness=-0.01,colorbalance=bs=0.04:bm=0.02,vignette=PI/5,scale=1600:-2,format=yuv420p[v]`);
args.push('-filter_complex', f.join(';'), '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-movflags', '+faststart', out);
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log('길이(계산)', len.toFixed(2), '초 → ', out);
