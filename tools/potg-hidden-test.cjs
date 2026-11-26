// 🙈 이름 숨긴 사람 시험(v0.1.254 · 라이엇 정책 「cannot identify players who are deliberately hidden」) — node tools/potg-hidden-test.cjs
//   우리 앱 사람(내전 팀 명단 · 일반 판 우리 팀)이 이름을 숨겼으면 예전처럼 실제 이름으로 바로잡음(본인이 앱에 들어온 사람)
//   모르는 사람(일반 판 상대)이 이름을 숨겼으면 챔피언 이름 그대로 · 챔피언 번호는 챔피언 이름으로 찾음(리플레이 카메라용)
const path = require('path');
const make = require(path.join(__dirname, '..', 'potg.js'));
const P = make({ T: 'today', FIREBASE_DB: '', fbSet: async () => ({ ok: true }), fbDelete: async () => ({}), getJson: async () => null,
  dayKey: () => '2026-11-26', normName: s => String(s || '').trim().replace(/\s+/g, ' '), userData: '.', getPlayers: () => [], log: () => {} });
let pass = 0, fail = 0;
const check = (name, cond, info) => { if (cond) { pass++; console.log('✅', name); } else { fail++; console.log('❌', name, JSON.stringify(info)); } };
const K = (t, k, v, a) => ({ n: 'ChampionKill', t, k, v, a });
// 「숨김」 = 게임 중 기록에 챔피언 이름(쉔)으로만 옴 · 정산에는 실제 이름
const pl = [{ name: '테스터A', champ: '아크샨', teamId: 100 }, { name: '테스터B', champ: '럭스', teamId: 100 }, { name: '쉔', champ: '쉔', teamId: 200 }, { name: '테스터D', champ: '올라프', teamId: 200 }];
const eog = [{ summonerName: '테스터A', championName: '아크샨', championId: 166 }, { summonerName: '테스터B', championName: '럭스', championId: 99 },
  { summonerName: '숨긴사람', championName: '쉔', championId: 98 }, { summonerName: '테스터D', championName: '올라프', championId: 2 }];
const raws = { a: { name: '테스터A', players: pl, hp: [], events: [K(500, '테스터A', '쉔'), K(503, '테스터A', '테스터D')] } };

// ① 일반 판 · 숨긴 사람 = 모르는 상대 → 챔피언 이름 그대로 · 번호 98
let r = P.pickPotg(raws, { teamA: [], teamB: [] }, eog, { only: ['테스터A', '테스터B'] });
const v = r && r.kills.find(k => k.championId === 98);
check('모르는 상대 = 챔피언 이름 그대로', v && v.victim === '쉔', r && r.kills);
check('모르는 상대 = 챔피언 번호(카메라용)', v && v.championId === 98, r && r.kills);
check('실제 이름이 카드 어디에도 없음', r && !JSON.stringify(r).includes('숨긴사람'), r);

// ② 내전 · 숨긴 사람 = 우리 방 사람(팀 명단) → 예전처럼 실제 이름
r = P.pickPotg(raws, { teamA: ['테스터A', '테스터B'], teamB: ['숨긴사람', '테스터D'] }, eog);
const v2 = r && r.kills.find(k => k.championId === 98);
check('우리 방 사람 = 실제 이름(예전과 같음)', v2 && v2.victim === '숨긴사람', r && r.kills);
check('우리 방 사람 = 팀 판정', r && r.team === 'teamA', r && r.team);

console.log(`통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
