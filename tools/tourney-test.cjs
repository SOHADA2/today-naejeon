// 🏆 대회 계산 시험(v0.1.291) — node tools/tourney-test.cjs   (서버·앱 없이 · tourney.js 순수 함수 + 운영 보드 사본이 같은지)
const fs = require('fs'), path = require('path'), T = require('../tourney.js');
let ok = 0, bad = 0;
const eq = (name, got, want) => { const a = JSON.stringify(got), b = JSON.stringify(want); if (a === b) ok++; else { bad++; console.log('✗', name, '\n   got ', a, '\n   want', b); } };
const teams = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['t' + (i + 1), { name: '팀' + (i + 1), tag: 'T' + (i + 1) }]));
const ids = n => Array.from({ length: n }, (_, i) => 't' + (i + 1));
const play = (R, res, mid, w, n) => { const m = R.matches[mid]; res[mid] = res[mid] || {}; for (let i = 0; i < n; i++) { const k = Object.keys(res[mid]).length + 1; res[mid]['g' + mid + '_' + k] = { w: m[w], day: '2026-11-28', at: k }; } };

// 시드 자리
eq('seedOrder 8', T.seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
// 4팀 싱글 = 2경기 + 결승
{ const M = T.makeSE(ids(4), 3, 5), tn = { fmt: 'se', teams: teams(4), matches: M, res: {} };
  eq('se4 경기 수', Object.keys(M).length, 3);
  eq('se4 1라운드', [M.r1m0.a, M.r1m0.b, M.r1m1.a, M.r1m1.b], ['t1', 't4', 't2', 't3']);
  eq('se4 결승 판수', M.r2m0.bo, 5);
  let R = T.resolve(tn);
  eq('se4 처음 상태', [R.matches.r1m0.state, R.matches.r2m0.state, R.byRound.map(r => r.name)], ['ready', 'wait', ['4강', '결승']]);
  play(R, tn.res, 'r1m0', 'a', 1); R = T.resolve(tn);
  eq('se4 1:0 진행', [R.matches.r1m0.state, R.matches.r1m0.sa, R.matches.r1m0.win], ['live', 1, null]);
  play(R, tn.res, 'r1m0', 'a', 1); play(R, tn.res, 'r1m1', 'b', 2); R = T.resolve(tn);
  eq('se4 결승 대진', [R.matches.r2m0.a, R.matches.r2m0.b, R.matches.r2m0.state], ['t1', 't3', 'ready']);
  play(R, tn.res, 'r2m0', 'b', 3); R = T.resolve(tn);
  eq('se4 우승', [R.champ && R.champ.id, R.allDone], ['t3', true]);
}
// 5팀 싱글 = 8강 틀 · 부전승 3
{ const M = T.makeSE(ids(5), 1), tn = { fmt: 'se', teams: teams(5), matches: M, res: {} };
  let R = T.resolve(tn);
  eq('se5 부전승', Object.values(R.matches).filter(m => m.how === 'bye').map(m => m.win).sort(), ['t1', 't2', 't3']);
  eq('se5 실제 1라운드', Object.values(R.matches).filter(m => m.r === 1 && m.state === 'ready').map(m => [m.a, m.b]), [['t4', 't5']]);
  eq('se5 4강 한쪽 확정', [R.matches.r2m0.a, R.matches.r2m0.b, R.matches.r2m0.state, R.matches.r2m1.state], ['t1', null, 'wait', 'ready']);
  eq('se5 라운드 이름', R.byRound.map(r => r.name), ['8강', '4강', '결승']);
}
// 3팀 싱글 = 4강 틀 · 1번 시드 부전승
{ const M = T.makeSE(ids(3), 3), tn = { fmt: 'se', teams: teams(3), matches: M, res: {} }; const R = T.resolve(tn);
  eq('se3', [R.matches.r1m0.how, R.matches.r1m0.win, R.matches.r2m0.a, R.matches.r2m0.state], ['bye', 't1', 't1', 'wait']); }
// 운영자가 승자 정하기(기권) · 틀린 팀이면 무시
{ const M = T.makeSE(ids(4), 3), tn = { fmt: 'se', teams: teams(4), matches: M, res: {} };
  M.r1m0.win = 't4'; M.r1m1.win = 't9'; const R = T.resolve(tn);
  eq('운영자 승자', [R.matches.r1m0.win, R.matches.r1m0.how, R.matches.r1m1.state], ['t4', 'admin', 'ready']); }
// 다른 팀 게임이 끼어도 그 경기 두 팀 것만 셈
{ const M = T.makeSE(ids(2), 3), tn = { fmt: 'se', teams: teams(2), matches: M, res: { r1m0: { x: { w: 'tX', at: 1 }, y: { w: 't2', at: 2 } } } }; const R = T.resolve(tn);
  eq('엉뚱한 게임', [R.matches.r1m0.sa, R.matches.r1m0.sb, R.byRound[0].name], [0, 1, '결승']); }
// 풀리그 4팀 = 6경기 3라운드 · 모두 한 번씩
{ const M = T.makeRR(ids(4), 1), tn = { fmt: 'rr', teams: teams(4), matches: M, res: {} };
  eq('rr4 경기 수', [Object.keys(M).length, Math.max(...Object.values(M).map(m => m.r))], [6, 3]);
  const pairs = Object.values(M).map(m => [m.a, m.b].sort().join('-')).sort();
  eq('rr4 모두 한 번씩', pairs, ['t1-t2', 't1-t3', 't1-t4', 't2-t3', 't2-t4', 't3-t4']);
  let R = T.resolve(tn);
  for (const m of Object.values(R.matches)) play(R, tn.res, m.id, [m.a, m.b].sort()[0] === m.a ? 'a' : 'b', 1);   // 번호가 작은 팀이 이김
  R = T.resolve(tn);
  eq('rr4 순위', R.standings.map(p => [p.id, p.w, p.l]), [['t1', 3, 0], ['t2', 2, 1], ['t3', 1, 2], ['t4', 0, 3]]);
  eq('rr4 우승', R.champ && R.champ.id, 't1'); }
// 풀리그 5팀(홀수) = 10경기 5라운드 · 라운드마다 2경기
{ const M = T.makeRR(ids(5), 3); eq('rr5', [Object.keys(M).length, [1, 2, 3, 4, 5].map(r => Object.values(M).filter(m => m.r === r).length)], [10, [2, 2, 2, 2, 2]]); }
// 풀리그 동률 = 승자승
{ const M = { r1m0: { r: 1, i: 0, a: 't1', b: 't2', bo: 1 }, r1m1: { r: 1, i: 1, a: 't3', b: 't1', bo: 1 }, r2m0: { r: 2, i: 0, a: 't2', b: 't3', bo: 1 } };
  const tn = { fmt: 'rr', teams: teams(3), matches: M, res: { r1m0: { g: { w: 't2', at: 1 } }, r1m1: { g: { w: 't1', at: 1 } }, r2m0: { g: { w: 't3', at: 1 } } } };
  eq('rr 3팀 물고 물림 = 이름순', T.resolve(tn).standings.map(p => p.id), ['t1', 't2', 't3']); }
// 팀 인원
eq('인원', T.rosterCount({ mem: { a: { r: 'cap' }, b: { r: '' }, c: { r: 'sub' } } }), { main: 2, sub: 1, cap: 1 });
// 운영 보드 사본
{ const a = fs.readFileSync(path.join(__dirname, '..', 'tourney.js'), 'utf8').replace(/\r\n/g, '\n'), p = path.join(__dirname, '..', 'docs', 'admin', 'tourney.js');
  const b = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
  eq('docs/admin/tourney.js = tourney.js', a === b, true); }
console.log(`대회 계산 시험 ${ok + bad}건 · 통과 ${ok} · 실패 ${bad}`); process.exit(bad ? 1 : 0);
