// 🎬 리플레이 확인 결과 보기(v0.1.29) — 실제 내전이 끝난 뒤 각 앱이 남긴 today/bridge/replayProbe 를 사람이 읽기 좋게 출력
// 사용: node tools/replay-report.cjs        (읽기만 함)
// 판정: result ok-watch = 방장 PC가 실제로 받아 파일까지 확인(팟지 리플레이 가능) · ok-download = 받을 수 있음까지 확인(방장 아닌 PC)
//       missingOrExpired / unsupported / incompatible / error / timeout = 안 됨(steps·create로 어디서 막혔는지 확인)
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
(async () => {
  const all = await (await fetch(`${DB}/today/bridge/replayProbe.json`)).json();
  if (!all) { console.log('아직 기록 없음 — v0.1.29 이상으로 내전 한 판 끝나면 생겨요'); return; }
  for (const [gameId, pcs] of Object.entries(all)) {
    console.log(`\n■ 게임 ${gameId}`);
    for (const r of Object.values(pcs || {})) {
      const when = new Date(r.at).toLocaleString('ko-KR');
      console.log(`  - ${r.name || '?'}${r.host ? ' (방장)' : ''} · v${r.appVer} · ${when} · 결과 ${r.result}${r.done != null ? ` (${r.done}초)` : ''}`);
      console.log(`    상태 변화: ${(r.steps || []).map(s => `${s.t}초 ${s.state}`).join(' → ') || '-'}`);
      if (r.create) console.log(`    정보 만들기: ${JSON.stringify(r.create)}`);
      if (r.download) console.log(`    받기 요청: ${JSON.stringify(r.download)}`);
      if (r.file) console.log(`    파일: ${JSON.stringify(r.file)}`);
      console.log(`    클라 설정: ${JSON.stringify(r.config || {})} · game.cfg EnableReplayApi=${r.cfg || '-'}`);
    }
  }
})();
