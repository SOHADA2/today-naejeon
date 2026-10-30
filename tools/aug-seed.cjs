// 🧭 증강 가이드 초안 넣기 — tools/aug-draft.json(챔피언별 플랜 초안) → today/augGuide/champs/{id} (draft:true)
// 사람이 이미 저장한 챔피언(draft 아님)은 건너뜀 · 초안끼리는 새 초안으로 바꿈 · GitHub Actions(aug-seed.yml)에서 실행(원격 세션은 Firebase가 막혀 있음)
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
    if (c && !c.draft && c.plans && c.plans.length) { skip++; console.log('건너뜀(사람이 저장함)', id); continue; }
    const body = { plans: g.plans, draft: true, src: draft.src, at: Date.now(), by: '초안' };
    if (!dry) { const r = await fetch(`${DB}/${id}.json`, { method: 'PUT', body: JSON.stringify(body) }); if (!r.ok) { console.log('실패', id, r.status); continue; } }
    put++;
  }
  console.log(`초안 넣음 ${put} · 건너뜀 ${skip}${dry ? ' (dry)' : ''}`);
})();
