// 🧪 가짜 롤 클라이언트(LCU) — 투데이 내전 브릿지가 정산 결과를 놓치지 않는지 시험
// 사용: node tools/mock-lcu.cjs <시나리오> (fastexit | skip | closed)   포트 27999 · 비번 testpw
// 앱: TN_HIDDEN=1 TN_FAKE_LCU=27999:testpw 로 실행(개발 실행만). 인증서 = MOCK_LCU_CERT 폴더의 key.pem/cert.pem
//   만들기: openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 2 -subj /CN=127.0.0.1  (Git Bash는 MSYS_NO_PATHCONV=1)
// ⚠️ 실제 Firebase today/bridge/eogStats에 씀 → 끝나면 today/ 테스트 데이터 삭제
const https = require('https'), fs = require('fs'), path = require('path');
const DB = 'https://aramchaos-ca022-default-rtdb.asia-southeast1.firebasedatabase.app';
const scen = process.argv[2] || 'fastexit';
const GID = 900000 + Math.floor(Math.random() * 99999);
let phase = 'Lobby', eogOn = false, histOn = false, up = true;
const names = ['테스터A', '테스터B', '테스터C', '테스터D'];
const eogBlock = () => ({ gameId: GID, gameLength: 1234, teams: [100, 200].map(tid => ({ teamId: tid, isWinningTeam: tid === 100,
  players: names.filter((_, i) => (i < 2) === (tid === 100)).map((n, i) => ({ riotIdGameName: n, puuid: 'fake-' + n, championId: tid === 100 ? 103 + i : 1 + i, championName: '챔프' + n,
    stats: { CHAMPIONS_KILLED: 5 + i, NUM_DEATHS: 2, ASSISTS: 7, TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 20000 } })) })) });
const history = () => ({ gameId: GID, gameType: 'CUSTOM_GAME', gameDuration: 1234,
  participantIdentities: names.map((n, i) => ({ participantId: i + 1, player: { gameName: n, puuid: 'fake-' + n } })),
  participants: names.map((n, i) => ({ participantId: i + 1, teamId: i < 2 ? 100 : 200, championId: i < 2 ? 103 + i : 1 + i,
    stats: { kills: 5 + i, deaths: 2, assists: 7, totalDamageDealtToChampions: 20000, goldEarned: 11000, totalMinionsKilled: 30, win: i < 2 } })),
  teams: [{ teamId: 100, win: 'Win' }, { teamId: 200, win: 'Fail' }] });
const routes = {
  '/lol-gameflow/v1/gameflow-phase': () => phase,
  '/lol-gameflow/v1/session': () => ({ gameData: { gameId: GID, isCustomGame: true, teamOne: [], teamTwo: [] } }),
  '/lol-summoner/v1/current-summoner': () => ({ puuid: 'fake-테스터A', gameName: '테스터A', tagLine: 'KR1' }),
  '/lol-end-of-game/v1/eog-stats-block': () => eogOn ? eogBlock() : null,
  ['/lol-match-history/v1/games/' + GID]: () => histOn ? history() : null,
  '/lol-game-data/assets/v1/champion-summary.json': () => [{ id: 103, name: '아리' }, { id: 104, name: '그레이브즈' }, { id: 1, name: '애니' }, { id: 2, name: '올라프' }],
};
const hits = {};
const CERT = process.env.MOCK_LCU_CERT || __dirname;
const srv = https.createServer({ key: fs.readFileSync(path.join(CERT, 'key.pem')), cert: fs.readFileSync(path.join(CERT, 'cert.pem')) }, (req, res) => {
  const p = req.url.split('?')[0]; hits[p] = (hits[p] || 0) + 1;
  const f = routes[p]; const v = f ? f() : null;
  if (!up) { req.socket.destroy(); return; }
  if (v == null) { res.writeHead(404); res.end('{}'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v));
});
const t0 = Date.now(), log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
srv.listen(27999, '127.0.0.1', async () => {
  log(`가짜 LCU 시작 · 시나리오=${scen} · gameId=${GID}`);
  await sleep(6000);
  phase = 'InProgress'; log('게임 시작(InProgress)');
  await sleep(5000);
  if (scen === 'fastexit') {
    phase = 'EndOfGame'; eogOn = true; log('정산 화면(EndOfGame) — 결과 있음');
    await sleep(1200);
    phase = 'Lobby'; eogOn = false; log('1.2초 만에 로비로 나감 — 정산 결과 사라짐');
  } else if (scen === 'skip') {
    phase = 'Lobby'; log('정산 화면 못 잡고 바로 로비 — 전적은 6초 뒤에 생김');
    await sleep(6000); histOn = true; log('전적(매치 기록)에 이 판 생김');
  } else if (scen === 'closed') {
    up = false; log('게임 끝나자마자 롤 클라이언트 종료(응답 없음)');
    await sleep(20000);
    up = true; phase = 'Lobby'; histOn = true; log('롤 다시 켬 — 전적에 이 판 있음');
  }
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const e = await (await fetch(`${DB}/today/bridge/eogStats.json`)).json();
    if (e && e.gameId === GID) {
      log(`✅ 저장됨 · 출처=${e.source || '정산 화면'} · 승리=${e.winSide} · ${e.players.map(p => `${p.summonerName}(${p.championName} ${p.kills}/${p.deaths}/${p.assists}${p.isWin ? ' 승' : ''})`).join(', ')}`);
      log(`LCU 호출 수: 정산 ${hits['/lol-end-of-game/v1/eog-stats-block'] || 0} · 전적 ${hits['/lol-match-history/v1/games/' + GID] || 0}`);
      process.exit(0);
    }
  }
  log('❌ 40초 안에 저장 안 됨'); process.exit(1);
});
