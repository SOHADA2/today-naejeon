// 🧪 오른쪽 창(sidepanel) 캡처 장면 만들기(가짜 이름) — 오른쪽 창을 고친 뒤 화면 검사에 씀(v0.1.197 · 왼쪽 창의 ui-scenes-lobby.cjs와 짝)
// 사용(리포 루트 · 이 PC 셸은 ELECTRON_RUN_AS_NODE 끄고 = env -u ELECTRON_RUN_AS_NODE):
//   node tools/ui-scenes-side.cjs <장면.json>                                           ← 장면 파일 만들기(300·400px × 여러 상태 · 서버·롤 연결 없음)
//   ./node_modules/electron/dist/electron.exe tools/ui-shot.cjs <장면.json> <출력 폴더>   ← PNG + 글자 겹침·잘림 검사(「TODAY IN-HOUSE」 머리 배경 글자는 원래 걸림)
//   ./node_modules/electron/dist/electron.exe tools/ui-errcheck.cjs <장면.json>           ← 렌더러 실행 오류(탭을 하나씩 다 열어 봄)
// 장면 이름: hm- 홈(첫 화면) · rc- 기록 · pf- 프로필 · ag- 증강(가이드·패치·뽑기) · x- 그 밖 · 끝 숫자 = 창 폭
//   ⚠️ 가짜 api는 창이 다 뜬 뒤에 들어가서(ui-shot) 계정·판 상태는 __emit으로 넣음(창이 켤 때 부르는 getPlayers는 빈 값)
const fs = require('fs');
const out = process.argv[2];
if (!out) { console.error('사용: node tools/ui-scenes-side.cjs <장면.json>'); process.exit(1); }
const NM = ['테스터에이', '테스터비', '테스터씨', '띄어 쓴 이름', '테스터E', '열여섯글자이름열여섯글자이름가나', '테스터G', '테스터H'];
const DAY = '2026-11-13', TS = new Date(2026, 10, 13, 21, 0).getTime();
const acct = i => ({ puuid: 'p' + i, gameName: NM[i], tagLine: 'KR1' });
const st = (rank, i, w, l, mvp, manner, k, d, a) => ({ rank, name: NM[i], games: w + l, wins: w, losses: l, mvp, svp: 0, manner, k, d, a, streak: 0, best: 0 });
const today = {
  ok: true, day: DAY, today: DAY, roomName: '오늘 내전?',
  standings: [st(1, 2, 3, 0, 2, 0, 31, 12, 40), st(2, 0, 2, 1, 1, 1, 24, 15, 33), st(3, 5, 2, 1, 0, 1, 18, 17, 51), st(4, 1, 1, 2, 0, 0, 20, 21, 28), st(5, 3, 1, 2, 0, 1, 12, 19, 37), st(6, 4, 0, 3, 0, 0, 9, 24, 22)],
  matches: [
    { teamA: [NM[2], NM[0], NM[5]], teamB: [NM[1], NM[3], NM[4]], winner: 'teamA', ts: TS + 3 * 1800e3, mvp: NM[2], svp: NM[1], manner: NM[5], source: 'auto', potg: { name: NM[2], label: '트리플킬' } },
    { teamA: [NM[2], NM[1], NM[3]], teamB: [NM[0], NM[5], NM[4]], winner: 'teamA', ts: TS + 2 * 1800e3, mvp: NM[2], svp: NM[0], manner: NM[3], source: 'auto' },
    { teamA: [NM[4], NM[1], NM[3]], teamB: [NM[2], NM[0], NM[5]], winner: 'teamB', ts: TS + 1800e3, source: 'manual' },
  ],
  normals: [
    { win: true, queue: '아수라장', ts: TS, gameTime: 1320, potg: { name: NM[0] }, players: [{ name: NM[0], champId: 498, k: 12, d: 4, a: 18 }, { name: NM[1], champId: 99, k: 7, d: 6, a: 25 }, { name: NM[5], champId: 54, k: 3, d: 8, a: 30 }],
      fun: [{ k: 'carry', label: '캐리', name: NM[0], v: '피해량 32,100' }, { k: 'tank', label: '탱커', name: NM[5], v: '받은 피해 41,800' }] },
    { win: false, queue: '아수라장', ts: TS - 1800e3, gameTime: 980, players: [{ name: NM[0], champId: 22, k: 4, d: 9, a: 11 }, { name: NM[1], champId: 16, k: 1, d: 7, a: 19 }], fun: [{ k: 'tank', label: '탱커', name: NM[0], v: '받은 피해 31,200' }] },
  ],
};
const todayEmpty = { ok: true, day: DAY, today: DAY, roomName: '오늘 내전?', standings: [], matches: [], normals: [] };
const rating = (cs, cn, ms, mn) => ({ season: '시즌 3 · 26.21~', at: TS, custom: cs == null ? (cn ? { pl: cn, n: cn, w: 1 } : null) : { s: cs, n: cn, w: Math.round(cn * 0.55), wr: 0.55, kda: 3.1 }, mayhem: ms == null ? (mn ? { pl: mn, n: mn, w: 1 } : null) : { s: ms, n: mn, w: Math.round(mn * 0.5), wr: 0.5, kda: 2.7 } });
const profile = (i, me, R) => ({
  ok: true, key: 'p:p' + i, name: NM[i], tag: 'KR1', me, games: 20, wins: 11, losses: 9, mvp: 3, svp: 1, manner: 0, k: 152, d: 121, a: 301, statGames: 19, damage: 512000, gold: 251000, cs: 1040, time: 19 * 1260,
  double: 9, triple: 2, quadra: 0, penta: 0, firstBlood: 3, streak: 2, bestStreak: 4, worstStreak: -3, days: 5, first: '2026-10-28', last: DAY,
  champs: [{ id: 498, name: '자야', games: 4, wins: 3, k: 40, d: 18, a: 52 }, { id: 99, name: '럭스', games: 3, wins: 1, k: 21, d: 20, a: 61 }, { id: 54, name: '말파이트', games: 2, wins: 2, k: 6, d: 9, a: 44 }],
  augs: [{ id: 1001, games: 5, wins: 4 }, { id: 1002, games: 3, wins: 1 }],
  recent: [{ win: true, champId: 498, champ: '자야', k: 12, d: 4, a: 18, aw: ['mvp'], day: DAY }, { win: true, champId: 99, champ: '럭스', k: 7, d: 6, a: 25, aw: [], day: DAY }, { win: false, champId: 54, champ: '말파이트', k: 2, d: 8, a: 21, aw: ['svp', 'manner'], day: '2026-11-12' }, { win: false, champId: 0, champ: '', aw: [], day: '2026-11-11' }],
  best: { kills: { v: 17, champId: 498, champ: '자야', day: '2026-11-02' }, damage: { v: 48200, champId: 498, champ: '자야', day: '2026-11-02' }, kda: { v: '12.50', champId: 99, champ: '럭스', day: '2026-11-07' }, assists: { v: 34, champId: 54, champ: '말파이트', day: '2026-11-09' } },
  mates: [{ name: NM[2], games: 8, wins: 6 }, { name: NM[5], games: 5, wins: 3 }], rivals: [{ name: NM[1], games: 7, wins: 2 }],
  rating: R,
});
const profileNew = (i, me) => ({ ok: true, key: 'p:p' + i, name: NM[i], tag: 'KR1', me, games: 0, wins: 0, losses: 0, champs: [], augs: [], recent: [], best: {}, mates: [], rivals: [], rating: null });
const augs = { 1001: { name: '검을 뽑아라', icon: '', rarity: 'silver' }, 1002: { name: '마법 미사일', icon: '', rarity: 'gold' }, 1003: { name: '거인 학살자', icon: '', rarity: 'prismatic' }, 1004: { name: '열여섯 글자짜리 아주 긴 증강 이름', icon: '', rarity: 'gold' } };
const guideAll = { guide: { 498: { plans: [{ title: '', augs: [1001, 1003], why: '' }], draft: true, by: '초안', at: TS } }, champs: { 498: { name: '자야', alias: 'Xayah' }, 99: { name: '럭스', alias: 'Lux' }, 54: { name: '말파이트', alias: 'Malphite' }, 22: { name: '애쉬', alias: 'Ashe' }, 16: { name: '소라카', alias: 'Soraka' } },
  augs, seen: { 1001: 6, 1002: 4 }, ours: { 1001: { g: 6, w: 4 }, 1002: { g: 4, w: 1 }, 1004: { g: 3, w: 2 } }, gg: { p: '26.22', d: '2026-11-12', g: { 1001: [1, 0.561], 1002: [2, 0.52], 1003: [1, 0.548] } }, planMax: 6, planAugs: 6, titleMax: 20, whyMax: 80 };
const labResult = { head: 'K/DA', picks: [{ id: 1001, name: '검을 뽑아라', icon: '', rarity: 'silver', at: '3레벨' }, { id: 1002, name: '마법 미사일', icon: '', rarity: 'gold', at: '7레벨' }, { id: 1238, name: '전환: 프리즘', icon: '', rarity: 'gold', at: 'K/DA' }, { id: 1003, name: '거인 학살자', icon: '', rarity: 'prismatic', at: '전환: 프리즘', bonus: true }, { id: 1004, name: '열여섯 글자짜리 아주 긴 증강 이름', icon: '', rarity: 'gold', at: '11레벨' }, { id: 1005, name: '운명의 무기', icon: '', rarity: 'gold', at: '15레벨' }] };
const sess = (phase, extra) => Object.assign({ phase, teamA: [NM[0], NM[2], NM[5]], teamB: [NM[1], NM[3], NM[4]], spectators: [NM[6]], mode: 'draft', teamsFormedAt: TS }, extra || {});
const set = { tutorialSeen: true, tutorialDc: true, sfxOn: true, sfxVol: 1, dock: true, sidePanel: true, closeAsk: true, hotkey: 'Shift+F7' };
const J = JSON.stringify, wait = ' await new Promise(r=>setTimeout(r,450)); ';
const baseStub = { getAugments: augs, getAugGuideAll: guideAll, getAugGuideRecent: [], getSettings: set, getUpdate: { state: 'latest' } };
// me = 내 번호 · host = 내가 방장 · session = 판 상태 · cat = 열 탭 · stub = 가짜 api 값 · more = 그린 뒤 실행할 JS
const sc = (name, w, o) => ({ name: name + '-' + w, page: 'sidepanel', w, h: o.h || 720, audit: 1, wait: 900, stub: Object.assign({}, baseStub, o.stub || {}),
  js: (o.me == null ? '' : `__emit('account', ${J({ account: acct(o.me), isHost: !!o.host })}); __emit('host', ${J({ host: { name: NM[o.hostIdx == null ? 0 : o.hostIdx], alive: true, mine: !!o.host }, isHost: !!o.host })});`)
    + (o.session ? `__emit('session', ${J({ session: o.session })});` : '') + wait + (o.cat ? `switchCat(${J(o.cat)});` + wait : '') + (o.more || '') });
const S = [];
for (const w of [300, 400]) {
  const full = { getToday: today, getProfile: profile(0, true, rating(57, 20, 52, 19)) };
  // 홈(첫 화면)
  S.push(sc('hm-login', w, {}));                                                                                        // 롤 로그인 전
  S.push(sc('hm-full', w, { me: 0, stub: full }));                                                                      // 티어 + 오늘 3판
  S.push(sc('hm-new', w, { me: 0, stub: { getToday: todayEmpty, getProfile: profileNew(0, true) } }));                   // 처음 온 사람(기록 없음)
  S.push(sc('hm-place', w, { me: 5, stub: { getToday: today, getProfile: profile(5, true, rating(null, 2, null, 0)) } })); // 배치 중 + 16자 이름
  S.push(sc('hm-host-teams', w, { me: 0, host: true, session: sess('teams'), stub: full }));                            // 방장 · 게임 진행 중(직접 기록 버튼)
  S.push(sc('hm-host-pending', w, { me: 0, host: true, session: sess('teams', { pendingEog: { winSide: 'blue' } }), stub: full })); // 방장 · 이긴 팀 고르기
  S.push(sc('hm-host-vote', w, { me: 0, host: true, session: sess('vote', { game: { winner: 'teamA' }, votes: { [NM[0]]: {}, [NM[2]]: {} } }), stub: full }));
  S.push(sc('hm-host-result', w, { me: 0, host: true, session: sess('result', { game: { winner: 'teamB' }, result: { mvp: NM[1], svp: NM[0], manner: NM[5] } }), stub: full }));
  S.push(sc('hm-mem-draft', w, { me: 2, session: sess('draft', { order: ['teamA', 'teamB', 'teamB', 'teamA'], pickIdx: 1, captains: { teamA: NM[0], teamB: NM[1] } }), stub: { getToday: today, getProfile: profile(2, true, rating(71, 24, null, 3)) } }));
  // 기록
  S.push(sc('rc-full', w, { me: 0, cat: 'today', stub: full }));
  { // 🏆 v0.1.291 「대회」 탭 — 싱글 토너먼트(5팀 · 부전승 · 진행 중 · 방장 = 「이 방에서 시작」) · 풀리그(순위) · 끝난 대회(우승) · 여러 대회 고르기
    const TC = require('../tourney.js'), TN = ['불꽃', '번개', '열두글자팀이름열두글자팀', '바람', '파도'];
    const mk = (fmt, n, name, st, play) => { const ids = Array.from({ length: n }, (_, i) => 't' + (i + 1));
      const teams = Object.fromEntries(ids.map((id, i) => [id, { name: TN[i], tag: 'T' + (i + 1), mem: Object.fromEntries(NM.slice(0, i === 0 ? 7 : 5).map((nm, j) => ['p' + (i * 10 + j), { n: nm, r: j === 0 ? 'cap' : j > 4 ? 'sub' : '' }])) }]));
      if (teams.t1) teams.t1.mem.p0 = { n: NM[0], r: 'cap' };
      const t = { name, fmt, bo: 3, boF: 5, st, at: TS, teams, matches: fmt === 'rr' ? TC.makeRR(ids, 3) : TC.makeSE(ids, 3, 5), res: {} };
      for (const [mid, w, k] of play || []) { const m = TC.resolve(t).matches[mid]; t.res[mid] = t.res[mid] || {}; for (let i = 0; i < k; i++) t.res[mid]['g' + Object.keys(t.res[mid]).length] = { w: m[w], at: Object.keys(t.res[mid]).length + 1 }; }
      return t; };
    const view = (id, t, me, cur) => { const Rv = TC.resolve(t), RO = { cap: 0, '': 1, sub: 2 };
      const teams = Object.entries(t.teams).map(([k, tm]) => ({ id: k, name: tm.name, tag: tm.tag || '', mine: !!tm.mem[me], mem: Object.entries(tm.mem).map(([p2, m]) => ({ key: p2, n: m.n, r: m.r || '' })).sort((x, y) => RO[x.r] - RO[y.r]) }));
      const myTeam = (teams.find(x => x.mine) || {}).id || null;
      return { id, name: t.name, fmt: Rv.fmt, bo: t.bo, boF: t.boF, st: t.st, at: t.at, champ: Rv.champ, standings: Rv.standings, myTeam, teams,
        rounds: Rv.byRound.map(r => ({ name: r.name, matches: r.matches.filter(m => m.state !== 'void').map(m => ({ id: m.id, no: m.no, a: m.ta, b: m.tb, sa: m.sa, sb: m.sb, win: m.win, state: m.state, how: m.how, bo: m.bo, n: m.games.length, mine: !!(myTeam && (m.a === myTeam || m.b === myTeam)), cur: cur === m.id })) })) }; };
    const se = mk('se', 5, '가을 멸망전', 'live', [['r1m1', 'a', 2], ['r2m1', 'a', 1]]);
    const rr = mk('rr', 4, '큐 리그 시즌 1', 'live', [['r1m0', 'a', 2], ['r1m1', 'b', 2], ['r2m0', 'a', 1]]);
    const done = mk('se', 4, '여름 멸망전', 'done', [['r1m0', 'a', 2], ['r1m1', 'b', 2], ['r2m0', 'b', 3]]);
    const go = " await window.tourneyReload(true); switchCat('tour');" + wait;
    S.push(sc('tr-se', w, { me: 0, stub: Object.assign({}, full, { tourneyData: { ok: true, canStart: false, list: [view('a', se, 'p0')] } }), more: go }));
    S.push(sc('tr-se-host', w, { me: 0, host: true, stub: Object.assign({}, full, { tourneyData: { ok: true, canStart: true, inRoom: true, list: [view('a', se, 'p0', 'r2m1')] } }), more: go }));
    S.push(sc('tr-rr', w, { me: 0, stub: Object.assign({}, full, { tourneyData: { ok: true, canStart: false, list: [view('b', rr, 'p0'), view('a', se, 'p0'), view('c', done, 'p0')] } }), more: go }));
    S.push(sc('tr-done', w, { me: 0, stub: Object.assign({}, full, { tourneyData: { ok: true, canStart: false, list: [view('c', done, 'none')] } }), more: go + "document.querySelector('[data-team]').click();" + wait }));
    const TS2 = { id: 's_a_r2m1', bo: 3, need: 2, names: { teamA: '번개', teamB: '열두글자팀이름열두글자팀' }, wins: { teamA: 1, teamB: 0 }, n: 1, games: [], done: null, tid: 'a', mid: 'r2m1', tn: '가을 멸망전', rn: '4강 2경기' };
    S.push(sc('hm-tour-result', w, { me: 0, host: true, session: sess('result', { series: TS2, game: { winner: 'teamA' }, result: { mvp: NM[2] } }), stub: full }));
  }
  { // 🏆 v0.1.288 시리즈 — 홈 「이번 판」(진행 중 = 다음 판 n/3 · 끝 = 대기실로) · 기록 경기 카드 시리즈 줄
    const SN = { teamA: '불꽃', teamB: '열두글자팀이름열두글자팀' }, ser = (n, wa, wb, done) => ({ id: 's1', bo: 3, need: 2, names: SN, wins: { teamA: wa, teamB: wb }, n, games: [], done });
    S.push(sc('hm-host-result-ser', w, { me: 0, host: true, session: sess('result', { series: ser(1, 0, 1, null), game: { winner: 'teamB' }, result: { mvp: NM[1] } }), stub: full }));
    S.push(sc('hm-host-result-serdone', w, { me: 0, host: true, session: sess('result', { series: ser(3, 2, 1, 'teamA'), game: { winner: 'teamA' }, result: { mvp: NM[2] } }), stub: full }));
    S.push(sc('hm-teams-ser', w, { me: 1, session: sess('teams', { series: ser(1, 1, 0, null) }), stub: full }));
    const tser = JSON.parse(JSON.stringify(today)); tser.matches[0].series = { id: 's1', bo: 3, n: 2, names: SN, wins: { teamA: 2, teamB: 0 }, done: 'teamA' }; tser.matches[1].series = { id: 's1', bo: 3, n: 1, names: SN, wins: { teamA: 1, teamB: 0 }, done: null };
    S.push(sc('rc-ser', w, { me: 0, cat: 'today', stub: { getToday: tser, getProfile: full.getProfile } }));
  }
  S.push(sc('rc-empty', w, { me: 0, cat: 'today', stub: { getToday: todayEmpty, getProfile: profileNew(0, true) } }));
  // 프로필
  S.push(sc('pf-me', w, { me: 0, cat: 'profile', stub: full }));
  S.push(sc('pf-other', w, { me: 0, cat: 'profile', stub: { getToday: today, getProfile: profile(5, false, rating(88, 31, 63, 12)) }, more: `openProfile({ name: ${J(NM[5])} });` + wait }));
  S.push(sc('pf-private', w, { me: 0, cat: 'profile', stub: { getToday: today, getProfile: { ok: true, private: true, key: 'p:p5', name: NM[5], tag: 'KR1', me: false } }, more: `openProfile({ name: ${J(NM[5])} });` + wait }));   // 🔒 v0.1.253 기록 비공개
  S.push(sc('pf-new', w, { me: 0, cat: 'profile', stub: { getToday: todayEmpty, getProfile: profileNew(0, true) } }));
  // 증강(가이드 · 패치 · 뽑기)
  S.push(sc('ag-guide', w, { me: 0, cat: 'aug', stub: full }));
  S.push(sc('ag-lab', w, { me: 0, cat: 'lab', stub: full }));
  S.push(sc('ag-lab-done', w, { me: 0, cat: 'lab', stub: full, more: `__emit('auglabResult', ${J(labResult)});` + wait }));
  // 그 밖
  S.push(sc('x-short', w, { me: 0, host: true, session: sess('teams'), stub: full, h: 560 }));                          // 낮은 창
}
fs.writeFileSync(out, J(S));
console.log('장면', S.length, '개 →', out);
