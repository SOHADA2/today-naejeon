// 🧪 가짜 롤 클라이언트(LCU) — 투데이 내전 브릿지가 정산 결과를 놓치지 않는지 시험
// 사용: node tools/mock-lcu.cjs <시나리오> (fastexit | skip | closed | replay)   포트 27999 · 비번 testpw
//   replay = fastexit + 리플레이(v0.1.29 리플레이 확인): 정보 없음(404) → 만들기 요청 → checking → download → (방장 앱이 받기) → downloading → watch + 가짜 .rofl
//   ⚠️ replay는 앱을 방장으로 만들어야 받기까지 감(아니면 download에서 끝) · 결과 = today/bridge/replayProbe/{gameId}
//   potg = fastexit + 가짜 라이브 클라이언트(2999, 게임 중만): 830초부터 테스터A가 4·7·10초에 3킬+에이스, 체력 100→8% (v0.1.30 팟지)
//     → 앱이 방장이고 today/session 이 teams(1팀 A·B / 2팀 C·D·E)여야 기록·팟지까지 감 · 결과 = today/session/potg
// 앱: TN_HIDDEN=1 TN_FAKE_LCU=27999:testpw 로 실행(개발 실행만). 인증서 = MOCK_LCU_CERT 폴더의 key.pem/cert.pem
//   만들기: openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 2 -subj /CN=127.0.0.1  (Git Bash는 MSYS_NO_PATHCONV=1)
// ⚠️ 실제 Firebase today/bridge/eogStats에 씀 → 끝나면 today/ 테스트 데이터 삭제
const https = require('https'), fs = require('fs'), path = require('path');
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app';
const scen = process.argv[2] || 'fastexit';
const GID = 900000 + Math.floor(Math.random() * 99999);
let phase = 'Lobby', eogOn = false, histOn = false, up = true;
const names = scen === 'potg' ? ['테스터A', '테스터B', '테스터C', '테스터D', '테스터E'] : ['테스터A', '테스터B', '테스터C', '테스터D'];
const eogBlock = () => ({ gameId: GID, gameLength: 1234, teams: [100, 200].map(tid => ({ teamId: tid, isWinningTeam: tid === 100,
  players: names.filter((_, i) => (i < 2) === (tid === 100)).map((n, i) => ({ riotIdGameName: n, puuid: 'fake-' + n, championId: tid === 100 ? 103 + i : 1 + i, championName: '챔프' + n,
    stats: { CHAMPIONS_KILLED: 5 + i, NUM_DEATHS: 2, ASSISTS: 7, TOTAL_DAMAGE_DEALT_TO_CHAMPIONS: 20000 } })) })) });
const history = () => ({ gameId: GID, gameType: 'CUSTOM_GAME', gameVersion: '16.21.123.4567', queueId: 0, gameDuration: 1234,
  participantIdentities: names.map((n, i) => ({ participantId: i + 1, player: { gameName: n, puuid: 'fake-' + n } })),
  participants: names.map((n, i) => ({ participantId: i + 1, teamId: i < 2 ? 100 : 200, championId: i < 2 ? 103 + i : 1 + i,
    stats: { kills: 5 + i, deaths: 2, assists: 7, totalDamageDealtToChampions: 20000, goldEarned: 11000, totalMinionsKilled: 30, win: i < 2 } })),
  teams: [{ teamId: 100, win: 'Win' }, { teamId: 200, win: 'Fail' }] });
const ROFL_DIR = path.join(require('os').tmpdir(), 'mock-replays');
let rep = null, repAt = 0;   // 리플레이 상태(null = 정보 없음 404)
const repState = () => { if (rep === 'checking' && Date.now() - repAt > 4000) rep = 'download';
  if (rep === 'downloading' && Date.now() - repAt > 3000) { rep = 'watch'; fs.mkdirSync(ROFL_DIR, { recursive: true }); fs.writeFileSync(path.join(ROFL_DIR, 'KR-' + GID + '.rofl'), Buffer.alloc(3 * 1048576)); }
  return rep; };
const routes = {
  '/lol-replays/v1/configuration': () => ({ isReplaysEnabled: true, isPatching: false, isReplaysForEndOfGameEnabled: true, isReplaysForMatchHistoryEnabled: true, minServerVersion: '16.21' }),
  ['/lol-replays/v1/metadata/' + GID]: () => { const st = repState(); return st ? { gameId: GID, state: st, downloadProgress: 0 } : null; },
  '/lol-replays/v1/rofls/path': () => ROFL_DIR,
  ['POST /lol-replays/v1/rofls/' + GID + '/download/graceful']: () => { if (rep === 'download') { rep = 'downloading'; repAt = Date.now(); } return {}; },
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
  if (req.method === 'POST' && p.startsWith('/lol-replays/v1/metadata/' + GID + '/create/')) { if (!rep) { rep = 'checking'; repAt = Date.now(); } log('리플레이 정보 만들기 요청: ' + decodeURIComponent(p.split('/create/')[1])); }
  const f = routes[req.method === 'POST' ? 'POST ' + p : p] || (req.method === 'POST' ? () => ({}) : null); const v = f ? f() : null;
  if (req.method === 'POST' && p.includes('/download')) log('리플레이 받기 요청');
  if (!up) { req.socket.destroy(); return; }
  if (v == null) { res.writeHead(404); res.end('{}'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v));
});
const t0 = Date.now(), log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 🎬 가짜 라이브 클라이언트(2999) — potg 시나리오 · 게임 중(InProgress)만 응답
let liveAt = 0;
const gt = () => 830 + (Date.now() - liveAt) / 1000;
const LIVE = {
  '/liveclientdata/playerlist': () => names.map((n, i) => ({ riotIdGameName: n, riotId: n + '#KR1', championName: ['아리', '그레이브즈', '애니', '올라프', '럭스'][i], team: i < 2 ? 'ORDER' : 'CHAOS', isBot: false })),
  '/liveclientdata/gamestats': () => ({ gameTime: gt(), gameMode: 'CLASSIC' }),
  '/liveclientdata/activeplayer': () => { const t = gt() - 830; const hp = t < 3 ? 100 : t < 9 ? Math.max(8, 100 - (t - 3) * 16) : 30;
    return { riotId: '테스터A#KR1', riotIdGameName: '테스터A', championStats: { currentHealth: hp * 20, maxHealth: 2000 } }; },
  '/liveclientdata/eventdata': () => ({ Events: [
    { EventID: 0, EventName: 'GameStart', EventTime: 0 },
    { EventID: 1, EventName: 'FirstBlood', EventTime: 120, Recipient: '테스터C' },
    { EventID: 2, EventName: 'ChampionKill', EventTime: 120, KillerName: '테스터C', VictimName: '테스터B', Assisters: [] },
    { EventID: 3, EventName: 'DragonKill', EventTime: 600, KillerName: '테스터D', Stolen: 'True', DragonType: 'Fire' },
    { EventID: 4, EventName: 'ChampionKill', EventTime: 834, KillerName: '테스터A', VictimName: '테스터C', Assisters: ['테스터B'] },
    { EventID: 5, EventName: 'ChampionKill', EventTime: 837, KillerName: '테스터A', VictimName: '테스터D', Assisters: [] },
    { EventID: 6, EventName: 'Multikill', EventTime: 837, KillerName: '테스터A', KillStreak: 2 },
    { EventID: 7, EventName: 'ChampionKill', EventTime: 840, KillerName: '테스터A', VictimName: '테스터E', Assisters: [] },
    { EventID: 8, EventName: 'Multikill', EventTime: 840, KillerName: '테스터A', KillStreak: 3 },
    { EventID: 9, EventName: 'Ace', EventTime: 840, Acer: '테스터A', AcingTeam: 'ORDER' },
  ].filter(e => e.EventTime <= gt()) }),
};
if (scen === 'potg') https.createServer({ key: fs.readFileSync(path.join(CERT, 'key.pem')), cert: fs.readFileSync(path.join(CERT, 'cert.pem')) }, (req, res) => {
  const f = phase === 'InProgress' && LIVE[req.url.split('?')[0]];
  if (!f) { res.writeHead(404); res.end('{}'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(f()));
}).listen(2999, '127.0.0.1');
srv.listen(27999, '127.0.0.1', async () => {
  log(`가짜 LCU 시작 · 시나리오=${scen} · gameId=${GID}`);
  await sleep(6000);
  phase = 'InProgress'; liveAt = Date.now(); log('게임 시작(InProgress)');
  await sleep(scen === 'potg' ? 16000 : 5000);
  if (scen === 'fastexit' || scen === 'replay' || scen === 'potg') {
    phase = 'EndOfGame'; eogOn = true; log('정산 화면(EndOfGame) — 결과 있음');
    await sleep(1200);
    phase = 'Lobby'; eogOn = false; if (scen === 'replay') histOn = true; log('1.2초 만에 로비로 나감 — 정산 결과 사라짐');
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
      if (scen === 'potg') {   // 🎬 팟지 기다림
        for (let j = 0; j < 40; j++) { await sleep(2000); const p = await (await fetch(`${DB}/today/session/potg.json`)).json();
          if (p && p.gameId === String(GID)) { log('🎬 팟지: ' + JSON.stringify(p).slice(0, 600)); await sleep(+(process.env.MOCK_HOLD || 0)); process.exit(p.none ? 1 : 0); } }
        log('❌ 팟지 없음'); process.exit(1);
      }
      if (scen !== 'replay') process.exit(0);
      for (let j = 0; j < 30; j++) {   // 🎬 리플레이 확인 기록 기다림
        await sleep(3000);
        const pr = await (await fetch(`${DB}/today/bridge/replayProbe/${GID}.json`)).json();
        const r = pr && Object.values(pr)[0];
        if (r && r.done != null) { log('🎬 리플레이 확인 기록: ' + JSON.stringify(r)); process.exit(r.result.startsWith('ok') ? 0 : 1); }
      }
      log('❌ 리플레이 확인 기록 없음'); process.exit(1);
    }
  }
  log('❌ 40초 안에 저장 안 됨'); process.exit(1);
});
