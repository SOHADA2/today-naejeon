// 🎞️ 예전에 저장한 팟지 mp4(≤v0.1.248 · 조각난 mp4라 윈도우·휴대폰에서 길이 0·안 열림)를 일반 mp4로 고침 — 다시 인코딩 없음(화질 그대로)
// 사용: node tools/mp4flat.cjs <파일.mp4> [나올 파일]   · 나올 파일을 안 주면 「원래이름 (고침).mp4」
const fs = require('fs'), path = require('path'), { flatten } = require('../mp4flat');
const src = process.argv[2]; if (!src) { console.log('사용: node tools/mp4flat.cjs <파일.mp4> [나올 파일]'); process.exit(1); }
const dst = process.argv[3] || src.replace(/(\.[^.\\/]+)?$/, ' (고침).mp4');
const r = flatten(fs.readFileSync(src));
if (!r.changed) { console.log('바꿀 것 없음 —', r.why); process.exit(0); }
fs.writeFileSync(dst, r.buf);
console.log('저장', path.basename(dst), (r.buf.length / 1048576).toFixed(1) + 'MB ·', r.sec + '초 ·', r.tracks.map(t => `${t.type} ${t.samples}`).join(' · '));
