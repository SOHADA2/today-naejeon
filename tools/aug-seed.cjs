// 🧭 증강 가이드 초안 넣기 — tools/aug-draft.json(챔피언별 플랜 초안) → today/augGuide/champs/{id} (draft:true)
// 사람이 이미 저장한 챔피언(draft 아님)은 플랜을 건너뛰고 「이번 패치 등급」(top)만 바꿈 · 초안끼리는 새 초안으로 바꿈 · GitHub Actions(aug-seed.yml)에서 실행(원격 세션은 Firebase가 막혀 있음)
// 사용: node tools/aug-seed.cjs [--dry]
const fs = require('fs'), path = require('path');
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app/today/augGuide/champs';
const dry = process.argv.includes('--dry');
(async () => {
  const draft = JSON.parse(fs.readFileSync(path.join(__dirname, 'aug-draft.json'), 'utf8'));
  const cur = (await (await fetch(`${DB}.json`)).json()) || {};
  let put = 0, skip = 0;
  for (const [id, g] of Object.entries(draft.champs)) {
    const c = cur[id];
    if (c && !c.draft && c.plans && c.plans.length) {   // 사람이 저장한 플랜은 그대로 · 「이번 패치 등급」(top)만 새것으로
      skip++;
      for (const k of ['top', 'tiers', 'avoid']) if (g[k] && !dry) { const r = await fetch(`${DB}/${id}/${k}.json`, { method: 'PUT', body: JSON.stringify(g[k]) }); if (!r.ok) console.log('등급 실패', id, k, r.status); }
      console.log('플랜 건너뜀(사람이 저장함) · 등급만', id); continue;
    }
    const body = { plans: g.plans, draft: true, src: draft.src, at: Date.now(), by: '초안' };
    for (const k of ['top', 'tiers', 'avoid']) if (g[k]) body[k] = g[k];
    if (!dry) { const r = await fetch(`${DB}/${id}.json`, { method: 'PUT', body: JSON.stringify(body) }); if (!r.ok) { console.log('실패', id, r.status); continue; } }
    put++;
  }
  if (draft.global && !dry) { const r = await fetch(DB.replace(/\/champs$/, '/global.json'), { method: 'PUT', body: JSON.stringify(draft.global) }); console.log('전체 등급', r.status, Object.keys(draft.global.t).length); }   // 🎯 증강 순위용 전체 등급표
  console.log(`초안 넣음 ${put} · 건너뜀 ${skip}${dry ? ' (dry)' : ''}`);
})();
