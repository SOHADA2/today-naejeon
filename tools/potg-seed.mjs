// 🎬 팟지 E2E 준비/정리(실제 Firebase today/) — node tools/potg-seed.mjs seed | clean
// 순서: seed → node tools/mock-lcu.cjs potg(MOCK_LCU_CERT) → 앱 TN_HIDDEN=1 TN_FAKE_LCU=27999:testpw [TN_FAKE_CLIP=영상] + 방장 하기 → clean
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
// 🗄️ v0.1.64 투데이 내전 전용 프로젝트 = 인증 없이 씀(규칙 today/ 공개)
const get = async p => (await fetch(`${DB}/${p}.json`)).json();
const put = async (p, v) => (await fetch(`${DB}/${p}.json`, { method: 'PUT', body: JSON.stringify(v) })).status;
const del = async p => (await fetch(`${DB}/${p}.json`, { method: 'DELETE' })).status;
if (process.argv[2] === 'seed') {
  const cur = await get('today/session');
  if (cur && cur.phase && !String(cur.by || '').startsWith('테스터')) { console.log('⚠️ 실제 세션 진행 중 — 중단', cur.phase, cur.by); process.exit(1); }
  const A = ['테스터A', '테스터B'], B = ['테스터C', '테스터D', '테스터E'], ids = {};
  for (const n of [...A, ...B]) ids[n] = 'fake-' + n;
  console.log('session', await put('today/session', { phase: 'teams', teamA: A, teamB: B, mode: 'random', teamsFormedAt: Date.now() - 60000, by: '테스터A', ids }));
} else {
  for (const node of ['presence', 'accounts', 'lobby/join']) { const d = await (await fetch(`${DB}/today/${node}.json?shallow=true`)).json() || {}; for (const k of Object.keys(d).filter(k => k.startsWith('fake-'))) console.log(node, k, await del(`today/${node}/${encodeURIComponent(k)}`)); }
  const h = await get('today/host'); if (h && String(h.puuid).startsWith('fake-')) console.log('host', await del('today/host'));
  const s = await get('today/session'); if (s && String(s.by || '').startsWith('테스터')) console.log('session', await del('today/session'));
  const e = await get('today/bridge/eogStats'); if (e && (e.players || []).some(p => String(p.puuid).startsWith('fake-'))) console.log('eogStats', await del('today/bridge/eogStats'));
  for (const n of ['potg', 'clips', 'bridge/replayProbe']) console.log(n, await del(`today/${n}`));
  const days = await (await fetch(`${DB}/today/days.json?shallow=true`)).json() || {};
  for (const d of Object.keys(days)) { const m = await (await fetch(`${DB}/today/days/${d}/matches.json?shallow=true`)).json() || {};
    for (const g of Object.keys(m).filter(g => +g >= 900000 && +g < 1000000)) console.log('match', d, g, await del(`today/days/${d}/matches/${g}`)); }
}
