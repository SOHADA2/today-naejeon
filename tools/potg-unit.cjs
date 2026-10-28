// 🎬 팟지 점수 단위 시험 — node tools/potg-unit.cjs (리포 루트에서)
const path = require('path');
const make = require(path.join(__dirname, "..", "potg.js"));
const P = make({ T: 'today', FIREBASE_DB: '', fbSet: async () => ({ ok: true }), fbDelete: async () => ({}), getJson: async () => null,
  dayKey: () => '2026-10-28', normName: s => String(s || '').trim().replace(/\s+/g, ' '), userData: '.', getPlayers: () => [], log: () => {} });
const pl = [['테스터A', '아리', 100], ['테스터B', '그레이브즈', 100], ['테스터C', '애니', 200], ['테스터D', '올라프', 200], ['테스터E', '럭스', 200]].map(([name, champ, teamId]) => ({ name, champ, teamId }));
const s = { teamA: ['테스터A', '테스터B'], teamB: ['테스터C', '테스터D', '테스터E'] };
const eog = pl.map((p, i) => ({ summonerName: p.name, championId: 100 + i }));
const K = (t, k, v, a) => ({ n: 'ChampionKill', t, k, v, a });
let pass = 0, fail = 0;
const check = (name, cond, info) => { if (cond) pass++; else { fail++; console.log('❌', name, JSON.stringify(info)); } };

// 1) 트리플킬(낮은 체력) vs 퍼블 솔로킬 → 트리플
let r = P.pickPotg({ a: { name: '테스터A', players: pl, hp: [[830, 100], [834, 40], [838, 8], [845, 30]], events: [
  { n: 'FirstBlood', t: 120, k: '테스터C' }, K(120, '테스터C', '테스터B'),
  K(834, '테스터A', '테스터C', ['테스터B']), K(837, '테스터A', '테스터D'), K(840, '테스터A', '테스터E'), { n: 'Ace', t: 840, k: '테스터A', team: 'ORDER' } ] } }, s, eog);
check('트리플', r && r.name === '테스터A' && r.label === '트리플킬' && r.kills.length === 3, r);
check('체력 태그', r && r.tags.includes('체력 8%') && r.tags.includes('에이스'), r && r.tags);
check('구간', r && r.clipFrom === 826 && r.clipTo === 843, r && [r.clipFrom, r.clipTo]);
check('팀·챔피언', r && r.team === 'teamA' && r.championId === 100 && r.kills[0].championId === 102, r);

// 2) 10초 넘게 떨어진 킬은 다른 장면
r = P.pickPotg({ a: { name: '테스터A', players: pl, hp: [], events: [K(100, '테스터A', '테스터C'), K(115, '테스터A', '테스터D')] } }, s, eog);
check('간격 분리', r && r.kills.length === 1, r);

// 3) 바론 스틸 > 솔로킬
r = P.pickPotg({ a: { name: '테스터A', players: pl, hp: [], events: [K(300, '테스터C', '테스터A'), { n: 'BaronKill', t: 1500, k: '테스터D', stolen: 1 }] } }, s, eog);
check('바론 스틸', r && r.name === '테스터D' && r.label === '바론 스틸' && r.kills.length === 0, r);

// 4) 미니언·포탑 킬, 이름#태그
r = P.pickPotg({ a: { name: '테스터A', players: pl, hp: [], events: [K(50, 'Turret_T1_L_03_A', '테스터A'), K(60, '테스터B#KR1', '테스터C#KR1')] } }, s, eog);
check('태그·포탑 무시', r && r.name === '테스터B' && r.label === '솔로킬', r);

// 5) 사건 없음
check('없음', P.pickPotg({ a: { name: 'x', players: pl, hp: [], events: [] } }, s, eog) === null);
check('raw 없음', P.pickPotg({}, s, eog) === null);
console.log(`통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
