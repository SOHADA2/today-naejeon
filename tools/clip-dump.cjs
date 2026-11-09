// 🎬 팟지 영상 받아서 파일로(읽기만) — 점검 작업이 ffprobe·장면 캡처로 영상 내용 확인할 때 씀
// 사용: node tools/clip-dump.cjs [날짜] 출력폴더
// 2026-11-09: 익명 로그인 표식(서버 2단계 규칙) · 영상 = 경기 기록(내전 matches · 같이 한 일반 판 normals)의 potg.clip / potg.hero.clip
//   GitHub(meta.gh · 영상 중계 통과)와 옛 Firebase 조각(meta.n) 둘 다 · 숨은 영웅 = {게임번호}h.webm
const fs = require('fs'), path = require('path');
const fb = require('./fb-lib.cjs');
const dayKey = (t = Date.now()) => { const d = new Date(t - 6 * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
(async () => {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2] || '') ? process.argv[2] : dayKey(), out = process.argv[3] || (/^\d{4}-/.test(process.argv[2] || '') ? 'clips' : process.argv[2]) || 'clips';
  fs.mkdirSync(out, { recursive: true });
  let n = 0;
  for (const kind of ['matches', 'normals']) {
    const ms = await fb.get(`days/${day}/${kind}`) || {};
    for (const [gid, m] of Object.entries(ms)) {
      const p = (m && m.potg) || {};
      for (const [meta, name, scene] of [[p.clip, gid, p], [p.hero && p.hero.clip, gid + 'h', p.hero || {}]]) {
        if (!meta || !(meta.gh || meta.n)) continue;
        try {
          const buf = await fb.clipBytes(meta), f = path.join(out, `${name}.webm`);
          fs.writeFileSync(f, buf); n++;
          fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify({ kind, size: buf.length, metaSize: meta.size, from: meta.gh ? 'github' : 'firebase', clipFrom: scene.clipFrom, clipTo: scene.clipTo, t0: scene.t0, t1: scene.t1, name: scene.name, champ: scene.champ, kills: (scene.kills || []).map(k => k.t) }));
          console.log(`${name} · ${kind === 'normals' ? '일반 판' : '내전'} · ${(buf.length / 1048576).toFixed(1)}MB(${meta.gh ? 'GitHub' : 'Firebase'}) · ${scene.name || ''} 장면 ${scene.clipFrom}~${scene.clipTo}초 · 킬 ${(scene.kills || []).map(k => k.t).join(', ')}`);
        } catch (e) { console.log(`${name} 받기 실패: ${e.message}`); }
      }
    }
  }
  if (!n) console.log(`${day} 영상 없음`);
})().catch(e => console.log('실패:', e.message));
