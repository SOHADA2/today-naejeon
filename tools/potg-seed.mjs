// 🎬 팟지 E2E 준비/정리(실제 Firebase today/) — node tools/potg-seed.mjs seed [방번호] | clean [--yes]
// 순서: 앱에서 방 만들기 → seed(그 방 session에 1팀 테스터A·B / 2팀 C·D·E) → node tools/mock-lcu.cjs potg(MOCK_LCU_CERT)
//       → 앱 TN_HIDDEN=1 TN_FAKE_LCU=27999:testpw [TN_FAKE_CLIP=영상] + 방장 → clean(먼저 지울 목록만 보여 줌 · --yes면 지움)
// 2026-11-09: 익명 로그인 표식(서버 2단계 규칙) · v0.1.94~ 판 데이터는 rooms/{방}/… · 방 = 인자 또는 env TN_ROOM 또는 가장 최근 방
//   ⚠️ 지우기는 시험 표식이 붙은 것만(fake- 계정 · by 테스터 · 게임 번호 900000~999999) · 규칙이 막는 건 실패로 남음(관리자 = tools/gapi.cjs)
import { createRequire } from 'node:module';
const fb = createRequire(import.meta.url)('./fb-lib.cjs');
const isTest = g => +g >= 900000 && +g < 1000000;
if (process.argv[2] === 'seed') {
  const rid = process.argv[3] || await fb.room();
  if (!rid) { console.log('⚠️ 방이 없음 — 앱에서 방을 만들고 다시'); process.exit(1); }
  const cur = await fb.get(`rooms/${rid}/session`);
  if (cur && cur.phase && !String(cur.by || '').startsWith('테스터')) { console.log('⚠️ 실제 판 진행 중 — 중단', rid, cur.phase, cur.by); process.exit(1); }
  const A = ['테스터A', '테스터B'], B = ['테스터C', '테스터D', '테스터E'], ids = {};
  for (const n of [...A, ...B]) ids[n] = 'fake-' + n;
  console.log('방', rid, 'session', await fb.put(`rooms/${rid}/session`, { phase: 'teams', teamA: A, teamB: B, mode: 'random', teamsFormedAt: Date.now() - 60000, by: '테스터A', ids }));
} else if (process.argv[2] === 'clean') {
  const yes = process.argv.includes('--yes'), plan = [];
  for (const node of ['presence', 'accounts']) for (const k of Object.keys(await fb.get(`${node}?shallow=true`) || {})) if (k.startsWith('fake-')) plan.push(`${node}/${encodeURIComponent(k)}`);
  for (const rid of Object.keys(await fb.get('rooms?shallow=true') || {})) {
    for (const node of ['members', 'lobby/join']) for (const k of Object.keys(await fb.get(`rooms/${rid}/${node}?shallow=true`) || {})) if (k.startsWith('fake-')) plan.push(`rooms/${rid}/${node}/${encodeURIComponent(k)}`);
    const h = await fb.get(`rooms/${rid}/host`); if (h && String(h.puuid).startsWith('fake-')) plan.push(`rooms/${rid}/host`);
    const s = await fb.get(`rooms/${rid}/session`); if (s && String(s.by || '').startsWith('테스터')) plan.push(`rooms/${rid}/session`);
    const e = await fb.get(`rooms/${rid}/bridge/eogStats`); if (e && (e.players || []).some(p => String(p.puuid).startsWith('fake-'))) plan.push(`rooms/${rid}/bridge/eogStats`);
  }
  for (const d of Object.keys(await fb.get('days?shallow=true') || {})) for (const kind of ['matches', 'normals'])
    for (const g of Object.keys(await fb.get(`days/${d}/${kind}?shallow=true`) || {})) if (isTest(g)) plan.push(`days/${d}/${kind}/${g}`);
  for (const d of Object.keys(await fb.get('potg/raw?shallow=true') || {})) for (const g of Object.keys(await fb.get(`potg/raw/${d}?shallow=true`) || {}))
    if (isTest(g)) for (const k of Object.keys(await fb.get(`potg/raw/${d}/${g}?shallow=true`) || {})) plan.push(`potg/raw/${d}/${g}/${encodeURIComponent(k)}`);
  if (!plan.length) { console.log('지울 시험 데이터 없음'); process.exit(0); }
  for (const p of plan) console.log(yes ? `${p} → ${await fb.del(p)}` : `(지울 것) ${p}`);
  if (!yes) console.log(`\n${plan.length}개 · 정말 지우려면 --yes`);
} else console.log('사용: node tools/potg-seed.mjs seed [방번호] | clean [--yes]');
