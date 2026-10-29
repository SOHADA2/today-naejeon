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
check('구간', r && r.clipFrom === 829 && r.clipTo === 843, r && [r.clipFrom, r.clipTo]);
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

// 6) 딜량: 비슷한 솔로킬 둘이면 딜량 압도 1위 쪽 · 펜타킬은 딜량과 상관없이 이김
const eogD = pl.map((p, i) => ({ summonerName: p.name, championId: 100 + i, damage: p.name === '테스터C' ? 60000 : 20000 }));
r = P.pickPotg({ a: { name: '테스터A', players: pl, hp: [], events: [K(300, '테스터A', '테스터D'), K(300, '테스터C', '테스터B')] } }, s, eogD);
check('딜량 우선', r && r.name === '테스터C' && r.tags.includes('딜량 1위 60,000'), r);
// ── 숨은 영웅(v0.1.44) ──
const A = ['가1','가2','가3','가4','가5'], B = ['나1','나2','나3','나4','나5'];
const pl5 = A.map((n,i)=>({name:n,champ:'A'+i,teamId:100})).concat(B.map((n,i)=>({name:n,champ:'B'+i,teamId:200})));
const s5 = { teamA: A, teamB: B };
const eog5 = (extra) => pl5.map((p,i)=>Object.assign({ summonerName:p.name, championId:200+i, teamId:p.teamId, taken:20000, mitig:5000, healMates:0, cc:10 }, (extra||{})[p.name]||{}));
const raw = (hp, events) => { const o = {}; for (const p of pl5) o[p.name] = { name:p.name, players:pl5, hp:(hp[p.name]||[[500,100]]), events }; return o; };
// 1) 광역 이니시: 나1이 적 3명을 한꺼번에 · CC 압도 1위
let ev = [K(601,'나2','가1',['나1','나3']), K(603,'나4','가2',['나1']), K(605,'나2','가3',['나1','나5'])];
let hp = { 가1:[[590,100],[598,80],[601,0]], 가2:[[590,100],[598.5,70],[603,0]], 가3:[[590,100],[599,75],[605,0]] };
r = P.pickHero(raw(hp, ev), s5, eog5({ 나1:{ cc:60 } }), '나2');
check('이니시', r && r.kind==='engage' && r.name==='나1' && r.hits.length===3 && r.tags[0]==='적 3명 동시 적중', r);
check('이니시 구간', r && r.clipFrom<=598 && r.clipTo>=601 && r.clipTo-r.clipFrom<=13, r && [r.clipFrom,r.clipTo,r.peak]);
check('판 지표', r && r.stats.some(x=>x.label==='CC 건 시간' && x.ratio===6), r && r.stats);
// 2) 버티기: 나3이 체력 받아내고 생존(광역 없음)
hp = { 나3:[[590,100],[599,70],[601,40],[603,12],[606,35]] };
r = P.pickHero(raw(hp, ev), s5, eog5({ 나3:{ taken:60000 } }), '나2');
check('버티기', r && r.kind==='tank' && r.name==='나3' && r.minHp===12 && r.taken===88 && r.peak===603, r);
// 3) 세이브: 가4가 20%까지 떨어졌다 회복 · 가5 힐 압도
ev = [K(701,'가1','나1',['가5']), K(703,'가2','나2',['가5'])];
hp = { 가4:[[690,100],[699,45],[700,20],[702,65]], 가1:[[690,100],[700,80],[702,95]] };
r = P.pickHero(raw(hp, ev), s5, eog5({ 가5:{ healMates:18000 } }), '가1');
check('세이브', r && r.kind==='save' && r.name==='가5' && r.ally && r.ally.name==='가4' && r.ally.low===20, r);
// 4) 지는 한타·작은 장면은 안 뽑음
ev = [K(801,'나1','가1')];
check('없음(작음)', P.pickHero(raw({}, ev), s5, eog5(), '나1') === null);
// 5) 한타 설계: 어시 4
ev = [K(901,'가1','나1',['가3']), K(903,'가2','나2',['가3']), K(905,'가1','나3',['가3']), K(907,'가4','나4',['가3'])];
r = P.pickHero(raw({}, ev), s5, eog5(), '가1');
check('한타 설계', r && r.kind==='play' && r.name==='가3' && r.assists.length===4, r);
console.log(`통과 ${pass} · 실패 ${fail}`); process.exit(fail ? 1 : 0);
