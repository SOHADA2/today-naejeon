// 📅 날짜별 경기 기록 점검(읽기만) — today/days 에 어떤 날짜에 몇 판이 저장됐는지 + 판마다 요약
// 사용: node tools/days-report.cjs
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app/today';
const get = async p => { const [a, q] = p.split('?'); const r = await fetch(`${DB}/${a}.json${q ? '?' + q : ''}`); return r.ok ? r.json() : null; };
const when = t => t ? new Date(t).toLocaleString('ko-KR') : '-';
(async () => {
  const days = await get('days?shallow=true');   // 날짜 목록만
  const keys = Object.keys(days || {}).sort();
  console.log(`📅 저장된 날짜 ${keys.length}개: ${keys.join(', ') || '없음'}`);
  for (const day of keys) {
    const node = await get(`days/${day}?shallow=true`);
    const ms = await get(`days/${day}/matches`);
    const list = Object.entries(ms || {}).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
    console.log(`\n■ ${day} · 하위 노드 [${Object.keys(node || {}).join(', ')}] · 경기 ${list.length}판`);
    for (const [gid, m] of list) console.log(`  - ${gid} · ${when(m.ts)} · ${m.source || '?'} · ${(m.teamA || []).join('/')} vs ${(m.teamB || []).join('/')} · 승 ${m.winner || '?'} · 투표마감 ${m.mvp || m.manner ? 'O' : 'X'}`);
  }
  const s = await get('session');
  if (s) console.log(`\n지금 판: phase ${s.phase} · day ${s.day} · game ${s.game ? `${s.game.id}(${s.game.day})` : '-'} · lastGameId ${s.lastGameId || '-'} · teamsFormedAt ${when(s.teamsFormedAt)}`);
  const pres = await get('presence');   // 지금 켜져 있는 앱(20초마다 갱신 · 60초 넘으면 꺼진 것)
  const now = Date.now(), on = Object.values(pres || {}).filter(p => p && now - (p.at || 0) < 60000);
  console.log(`\n지금 켜진 앱 ${on.length}개: ${on.map(p => `${p.name} v${p.app || '?'}${p.host ? '(방장)' : ''}`).join(', ') || '없음'}`);
  const off = Object.values(pres || {}).filter(p => p && now - (p.at || 0) >= 60000);
  if (off.length) console.log(`최근에 꺼진 앱: ${off.map(p => `${p.name} v${p.app || '?'} · ${when(p.at)}`).join(', ')}`);
  const eog = await get('bridge/eogStats');
  if (eog) console.log(`마지막 정산: game ${eog.gameId} · ${when(eog.savedAt)} · source ${eog.source || 'eog'}`);
})().catch(e => console.log('읽기 실패:', e.message));
