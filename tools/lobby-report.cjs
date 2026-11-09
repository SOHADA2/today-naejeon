// 🪑 롤 대기방 응답 모양 보기(v0.1.51) — 각 앱이 사용자 설정 게임 방에서 남긴 today/bridge/lobbyProbe 출력(읽기만)
// 마커 「자리 확인」이 쓰는 필드: gameConfig.customTeam100 / customTeam200 / customSpectators 안에 내 puuid가 있는지
const { get } = require('./fb-lib.cjs');   // 🔐 2026-11-09: 익명 로그인 표식 · ⚠️ 조사 끝나 v0.1.99부터 안 쌓임(옛 기록은 백업 파일)
(async () => {
  const all = await get('bridge/lobbyProbe');
  if (!all) { console.log('아직 기록 없음 — v0.1.51 이상 앱을 켜고 롤에서 사용자 설정 게임 방을 만들면 생겨요(게임은 안 해도 됨)'); return; }
  for (const r of Object.values(all)) {
    const ok = r.seat != null;
    console.log(`\n■ ${r.name || '?'} · v${r.appVer} · ${new Date(r.at).toLocaleString('ko-KR')} → 자리 ${ok ? r.seat : '못 찾음'} ${ok ? '✅' : '❌'}`);
    console.log(`  팀100 ${r.team100} · 팀200 ${r.team200} · 관전 ${r.spec} · members ${r.members} · 내 puuid ${r.hasPuuid ? '있음' : '없음'} (100:${r.meIn100} 200:${r.meIn200} 관전:${r.meInSpec})`);
    console.log(`  lobby 키: ${(r.lbKeys || []).join(', ')}`);
    console.log(`  gameConfig 키: ${(r.gcKeys || []).join(', ')}`);
    console.log(`  localMember 키: ${(r.localKeys || []).join(', ')}`);
    console.log(`  멤버 키: ${(r.memberKeys || []).join(', ')}`);
  }
})();
