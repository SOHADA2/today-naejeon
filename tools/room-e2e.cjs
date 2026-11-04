// 🧪 실제 서버 + 숨김 앱 한 판 흐름(7단계) — 방 안 데이터(v0.1.95 방 스트림 · v0.1.110 방 사람 members) · 2단계 인증(표식 붙임)
// 준비: 앱을 숨김으로 켜서(tools/cdp.cjs 머리 주석 · 계정 「방시험A#T」) 방을 만든 뒤 방 번호를 넘김
//   node tools/cdp.cjs 9333 overlay.html "window.api.roomCreate('시험방',false,'').then(r=>JSON.stringify(r))"
//   node tools/cdp.cjs 9333 overlay.html "window.api.getRooms().then(d=>d.room&&d.room.id)"
// 사용: node tools/room-e2e.cjs <방 번호> [포트=9333]
// 확인: B 들어옴(방 사람) · B 관전(대기실) · 방장 시작 · 팀 화면 · eogStats → 방장이 경기 기록 · 투표 화면 · 다른 사람 투표
// ⚠️ 끝나면 시험 데이터 정리(관리자 tools/gapi.cjs DELETE — 경로를 하나씩 확인하고): today/days/<오늘>/matches/rt777 · rooms/<방> · roomList/<방> · presence·accounts의 fake-방시험A/B
const { execFileSync } = require('child_process'), path = require('path');
const [RID, PORT] = [process.argv[2], process.argv[3] || '9333'];
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app', K = 'AIzaSyDhVbSzNQ306LUTcPo44Ru9G4_RqV9Dl_E';
const cdp = expr => JSON.parse(JSON.parse(execFileSync('node', [path.join(__dirname, 'cdp.cjs'), PORT, 'overlay.html', expr]).toString().trim()));
let TOK = '';
const put = (p, v, m = 'PUT') => fetch(`${DB}/${p}.json?auth=${TOK}`, { method: m, body: JSON.stringify(v) });
const get = async p => (await fetch(`${DB}/${p}.json?auth=${TOK}`)).json();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (n, c, i) => { c ? pass++ : fail++; console.log(c ? '✅' : '❌', n, c ? '' : JSON.stringify(i)); };
const KB = encodeURIComponent('fake-방시험B');
(async () => {
  if (!RID) { console.log('사용: node tools/room-e2e.cjs <방 번호> [포트]'); process.exit(1); }
  TOK = (await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${K}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"returnSecureToken":true}' })).json()).idToken;
  const beat = () => put(`today/rooms/${RID}/members/${KB}`, { name: '방시험B', tag: 'T', at: Date.now(), app: '0.1.111', room: RID });
  await beat(); await sleep(2500);
  let L = cdp("window.api.getLobby().then(d=>JSON.stringify(d.members.map(m=>m.name+':'+m.st)))");
  ok('B가 들어옴(방 사람 members)', L.includes('방시험B:in'), L);
  await put(`today/rooms/${RID}/lobby/join/${KB}`, { name: '방시험B', st: 'spec', at: Date.now(), day: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10) });
  await sleep(1500);
  L = cdp("window.api.getLobby().then(d=>JSON.stringify(d.members.map(m=>m.name+':'+m.st)))");
  ok('B가 관전으로 바꿈 → 대기실 갱신', L.includes('방시험B:spec'), L);
  await put(`today/rooms/${RID}/lobby/join/${KB}`, null); await beat(); await sleep(1500);
  const st = cdp("window.api.lobbyStart().then(r=>JSON.stringify(r))");
  ok('방장 시작(2명)', st.ok, st);
  await sleep(2000);
  let v = cdp("JSON.stringify(document.getElementById('view-team').style.display)");
  ok('팀 화면으로 바뀜', v === 'flex', v);
  const s = await get(`today/rooms/${RID}/session`);
  const winA = (s.teamA || []).includes('방시험A');
  await beat();
  await put(`today/rooms/${RID}/bridge/eogStats`, { gameId: 'rt777', savedAt: Date.now(), winSide: 'blue', gameTime: 900,
    players: [{ summonerName: '방시험A', isWin: true, teamId: 100 }, { summonerName: '방시험B', isWin: false, teamId: 200 }] });
  await sleep(4000);
  const s2 = await get(`today/rooms/${RID}/session`);
  ok('경기 결과 → 방장이 바로 기록', s2.phase === 'vote' && s2.game && s2.game.id === 'rt777' && s2.game.winner === (winA ? 'teamA' : 'teamB'), { phase: s2.phase, game: s2.game });
  v = cdp("JSON.stringify(document.getElementById('view-vote').style.display)");
  ok('투표 화면', v === 'block', v);
  await put(`today/rooms/${RID}/session/votes/x`, { mvp: '방시험A', at: Date.now() }); await sleep(1500);
  const sv = cdp("window.api.getPlayers().then(d=>JSON.stringify(Object.keys((d.session&&d.session.votes)||{})))");
  ok('다른 사람 투표가 바로 들어옴', sv.includes('x'), sv);
  console.log(`통과 ${pass} · 실패 ${fail}`);
})();
