// ── 🏅 전적 기반 점수(v0.1.111 · 사장님: 솔로 랭크 티어 + 칼바람 점수 + 아수라장 점수 — 한 사람당 3개 · v0.1.114부터 아수라장 내전·아수라장 일반 2개) ─────────────
// 각자 앱이 자기 롤 클라이언트(LCU)에서 조용히 읽음(화면·마우스 안 건드림) → today/ratings/{puuid}에 요약만 올림 → 프로필에서 누구 것이든 봄
//  · 솔로 랭크 = 공식 티어 그대로(/lol-ranked/v1/current-ranked-stats · 솔로 없으면 자유 랭크)
//  · 칼바람(큐 450)·아수라장(큐 2400 · 모드 KIWI) = 최근 전적(/lol-match-history/v1/products/lol/current-summoner/matches)에서 각 40판까지
//    판마다 상세(/lol-match-history/v1/games/{id} · 10명)로 팀 안 딜 순위·킬 관여·KDA → 경기력 · 상세는 userData에 보관(한 번만 받음)
//  · 점수 0~100 = 승률(판 수 적으면 50% 쪽으로 당김) 55% + 경기력 45% · 최근 판일수록 무게(0.96^n) · 5판 안 되면 「배치 중 n/5」
//  · 등급 = S+ S A+ A B+ B C+ C D(공식 랭크와 헷갈리지 않게 글자 등급 · 「MMR」이라 부르지 않음 — 라이엇 정책)
//  ⚠️ 실기(2026-11-04 집 PC): 롤 전적 목록은 begIndex/endIndex를 **무시하고 늘 최근 20판**만 줌(current-summoner·puuid 주소 둘 다 · 0~199도 20판)
//    → 첫 쪽에서 새 판이 없으면 그만 읽음 + 받은 판 요약을 이 PC에 **모아 둠**(큐마다 최근 40판 · 예전엔 이번 목록에 없는 판을 지워 20판을 못 넘었음)
//  ⚙️ v0.1.114(사장님): **아수라장 일반**(매칭 큐 2400)과 **아수라장 내전**(사용자 설정 게임 · 실측 큐 3270 · gameType CUSTOM_GAME · 모드 KIWI)을 따로 ·
//    솔로 랭크·칼바람은 뺌(안 읽고 안 올림 · 서버 규칙은 옛 앱 때문에 그 칸들을 그대로 허용)
//    → v0.1.115: 내전은 롤 전적이 아니라 우리 서버 경기 기록으로(아래 inhouseScore · 프로필에서 계산) · 롤 전적에선 아수라장 일반만 모음(내전 판별은 일반에서 빼려고만)
//  🗓️ 2026-11-06(사장님: 20판밖에 안 들어감 → 투데이 내전으로 한 판은 전부 · 아수라장 **큰 업데이트마다 기준점**이 바뀌니 그때부터 계속 누적)
//    → SEASON(아래) 시작 뒤 판만 · 판 수 상한 없음(예전 40판) · 아수라장 일반 = 롤 전적(이 PC에 계속 모아 둠) + 투데이 내전이 서버에 기록한 「같이 한 일반 판」(main이 extra로 넘김)
//    ⚠️ 다음 큰 업데이트(시즌) 때 SEASON만 바꾸면 모두 그 날부터 새로 쌓임(잔바리 패치 = 증강 몇 개·수치 조정은 안 바꿈)
const fs = require('fs'), path = require('path');
const SEASON = { name: '시즌 3', patch: '26.21', since: Date.parse('2026-10-21T00:00:00+09:00') };   // 아수라장 시즌 3 = 패치 26.21(2026-10-21 · 증강 35개 추가·14개 삭제) · 26.22는 증강 2개 추가 = 잔바리
const Q = { mayhem: 1 };   // 모아 두는 큐(이름만 · 판별은 queueOf)
const MAX_GAMES = 2000, MIN_GAMES = 5, PAGE = 20, MAX_PAGES = 10;   // MAX_GAMES = 이 PC 보관 파일 안전 상한(시즌 안 판은 사실상 전부)
const GRADES = [[75, 'S+'], [70, 'S'], [65, 'A+'], [60, 'A'], [55, 'B+'], [50, 'B'], [45, 'C+'], [40, 'C'], [-1, 'D']];
const gradeOf = s => GRADES.find(([min]) => s >= min)[1];
// v0.1.113: 화면은 글자 등급 대신 롤 티어 이름(사장님: 롤 티어표처럼) — 8점마다 한 티어 · 2점마다 한 단계(4 → 1) · 마스터부터 단계 없음
//   ⚠️ sidepanel.js `scoreTier`와 같은 표(렌더러는 이 파일을 못 불러서 두 군데 · 바꾸면 둘 다)
const SCORE_TIERS = [[90, 'CHALLENGER'], [84, 'GRANDMASTER'], [78, 'MASTER'], [70, 'DIAMOND'], [62, 'EMERALD'], [54, 'PLATINUM'], [46, 'GOLD'], [38, 'SILVER'], [30, 'BRONZE']];   // v0.1.200(사장님: 아이언은 없애도 됨) — 가장 낮은 티어 = 브론즈(30점 아래는 전부 브론즈 4)
function tierOf(s) {
  const f = SCORE_TIERS.findIndex(([lo]) => s >= lo), i = f < 0 ? SCORE_TIERS.length - 1 : f, [lo, tier] = SCORE_TIERS[i];
  return { tier, div: ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? null : Math.max(1, 4 - Math.max(0, Math.floor((s - lo) / 2))), rank: SCORE_TIERS.length - 1 - i };   // rank = 브론즈 0 ~ 챌린저 8
}
const r3 = v => Math.round(v * 1000) / 1000;

function queueOf(g) {   // 이 판이 아수라장 내전(custom)/아수라장 일반(mayhem)인지 — 내전을 먼저(같은 KIWI 모드라서)
  const q = g.queueId == null ? null : Number(g.queueId);
  if (q === 3270 || (g.gameType === 'CUSTOM_GAME' && g.gameMode === 'KIWI')) return 'custom';
  if (q === 2400 || (q == null && g.gameMode === 'KIWI')) return 'mayhem';
  return null;
}
// 상세(10명) → 나 한 사람 요약 { q, t, win, k, d, a, dr(팀 안 딜 순위 0~1 · 1 = 1등), kp(킬 관여), sec }
function compactGame(g, puuid) {
  const q = queueOf(g); if (!q || !Array.isArray(g.participants)) return null;
  const who = {}; for (const pi of g.participantIdentities || []) who[pi.participantId] = (pi.player || {}).puuid;
  const me = g.participants.find(p => who[p.participantId] === puuid); if (!me) return null;
  const team = g.participants.filter(p => p.teamId === me.teamId), s = me.stats || {};
  const dmg = p => (p.stats && p.stats.totalDamageDealtToChampions) || 0;
  const above = team.filter(p => dmg(p) > dmg(me)).length, tie = team.filter(p => p !== me && dmg(p) === dmg(me)).length;   // 딜 같은 팀원은 반씩
  const teamKills = team.reduce((x, p) => x + ((p.stats && p.stats.kills) || 0), 0);
  return { q, t: g.gameCreation || 0, win: !!s.win, k: s.kills || 0, d: s.deaths || 0, a: s.assists || 0,
    dr: team.length > 1 ? r3(1 - (above + tie / 2) / (team.length - 1)) : 0.5, kp: teamKills ? r3(Math.min(1, ((s.kills || 0) + (s.assists || 0)) / teamKills)) : 0, sec: g.gameDuration || 0 };
}
// 한 큐 점수 — games = 최신순 요약
function scoreQueue(games) {
  const n = games.length;
  if (!n) return null;
  const wins = games.filter(g => g.win).length;
  if (n < MIN_GAMES) return { pl: n, n, w: wins };   // 배치 중
  let sw = 0, sWin = 0, sPerf = 0, k = 0, d = 0, a = 0;
  games.forEach((g, i) => {
    const w = Math.pow(0.96, i), kda = (g.k + g.a) / Math.max(1, g.d);
    sw += w; sWin += w * (g.win ? 1 : 0);
    sPerf += w * (0.4 * g.dr + 0.3 * g.kp + 0.3 * (kda / (kda + 3)));
    k += g.k; d += g.d; a += g.a;
  });
  const bayes = (sWin + 3 * 0.5) / (sw + 3), perf = sPerf / sw;
  const s = Math.round(100 * (0.55 * bayes + 0.45 * perf));
  return { s, gr: gradeOf(s), n, w: wins, wr: r3(wins / n), kda: Math.round((k + a) / Math.max(1, d) * 100) / 100 };
}
function soloOf(rk) {   // 공식 랭크 → {tier, div, lp, w, l, q}(솔로 우선 · 없으면 자유)
  if (!rk) return null;
  const list = Array.isArray(rk.queues) ? rk.queues : Object.values(rk.queueMap || {});
  for (const qt of ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR']) {
    const x = list.find(v => v && v.queueType === qt) || (rk.queueMap && rk.queueMap[qt]);
    if (x && x.tier && x.tier !== 'NONE' && x.tier !== 'UNRANKED') return { tier: String(x.tier).slice(0, 20), div: x.division && x.division !== 'NA' ? String(x.division).slice(0, 4) : null, lp: Number(x.leaguePoints) || 0, w: Number(x.wins) || 0, l: Number(x.losses) || 0, q: qt === 'RANKED_SOLO_5x5' ? 'solo' : 'flex' };
  }
  return null;
}

// 🏠 v0.1.115: 아수라장 **내전** 점수 = 우리 서버 경기 기록(today/days/*/matches · 이 앱으로 진행·기록한 판만 · 처음 기록부터 전부)
//   (사장님: 했던 기록은 모두 적용 · 내전은 이 앱을 통해 진행한 것만) — 롤 전적의 사용자 설정 게임(큐 3270)은 이제 안 셈(앱 밖 커스텀까지 섞이고 최근 20판뿐이라)
//   아수라장 판 = 그 판 선수 중 누구든 증강이 있음(칼바람 내전이 생기면 빠짐) · 한 판 요약은 롤 전적과 같은 모양 → scoreQueue 그대로(최근 판일수록 크게)
//   records = [{ ts, stats(10명), me(이 사람 stats 한 줄), win }] 시간순 아무거나
//   v2026-11-06: 시즌(SEASON) 시작 뒤 판만
function statGame(r) {   // 서버 기록 한 판(10명 stats · 투데이 내전 형식) → 요약(롤 전적 요약과 같은 모양) · 아수라장(누구든 증강 있음)이 아니거나 시즌 전이면 null
  const all = Array.isArray(r.stats) ? r.stats : [], me = r.me;
  if (!me || (r.ts || 0) < SEASON.since || !all.some(p => Array.isArray(p.augments) && p.augments.length)) return null;
  const team = all.filter(p => p.teamId === me.teamId), dmg = p => p.damage || 0;
  const above = team.filter(p => dmg(p) > dmg(me)).length, tie = team.filter(p => p !== me && dmg(p) === dmg(me)).length;
  const teamKills = team.reduce((x, p) => x + (p.kills || 0), 0);
  return { t: r.ts || 0, win: !!r.win, k: me.kills || 0, d: me.deaths || 0, a: me.assists || 0,
    dr: team.length > 1 ? r3(1 - (above + tie / 2) / (team.length - 1)) : 0.5, kp: teamKills ? r3(Math.min(1, ((me.kills || 0) + (me.assists || 0)) / teamKills)) : 0 };
}
function inhouseScore(records) {
  const games = (records || []).map(statGame).filter(Boolean);
  return scoreQueue(games.sort((x, y) => y.t - x.t));
}
// 🎮 투데이 내전이 기록한 「같이 한 일반 판」(today/days/*/normals) 중 이 사람 아수라장 일반 판 → [{id, …요약}] (collect의 extra)
function normalGames(normals, puuid) {
  const out = [];
  for (const g of normals || []) {
    if (!g || !(Number(g.queueId) === 2400 || g.gameMode === 'KIWI')) continue;
    const me = (g.stats || []).find(p => p && p.puuid === puuid); if (!me) continue;
    const c = statGame({ ts: g.ts, stats: g.stats, me, win: me.isWin != null ? !!me.isWin : (Number(g.side) === Number(me.teamId) ? !!g.win : !g.win) });
    if (c) out.push(Object.assign({ id: String(g.gameId), q: 'mayhem' }, c));
  }
  return out;
}

module.exports = makeRating;
makeRating.tierOf = tierOf;
makeRating.inhouseScore = inhouseScore;
makeRating.normalGames = normalGames;
// v0.1.175: 서버 「같이 한 일반 판」만으로 매긴 아수라장 일반 점수(앱을 안 켠 친구용 · 한 판 기록에 10명이 다 있음)
makeRating.serverMayhem = (normals, puuid) => scoreQueue(normalGames(normals, puuid).sort((x, y) => y.t - x.t));
makeRating.SEASON = SEASON;
function makeRating(d) {   // d = { lcuGet(path) → data|null, userData, log }
  const cacheFile = path.join(d.userData, 'rating-games.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) || {}; } catch (_) {}
  async function collect(puuid, extra) {   // extra = normalGames(서버 「같이 한 일반 판」) — 롤 전적과 같은 판(gameId)이면 롤 전적 쪽을 씀
    const list = [], ids = new Set();
    for (let p = 0; p < MAX_PAGES; p++) {   // 최근 전적 목록(한 번에 20판씩 — 실제로는 롤이 늘 같은 최근 20판을 줌)
      const r = await d.lcuGet(`/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${p * PAGE}&endIndex=${(p + 1) * PAGE}`).catch(() => null);
      const games = (r && r.games && r.games.games) || [];
      let fresh = 0; for (const g of games) if (g && !ids.has(g.gameId)) { ids.add(g.gameId); list.push(g); fresh++; }
      if (games.length < PAGE || !fresh) break;   // 새 판이 없으면 그만(같은 20판 반복)
    }
    const seen = new Set(), want = { mayhem: [] };
    for (const g of list.sort((x, y) => (y.gameCreation || 0) - (x.gameCreation || 0))) {
      const q = queueOf(g); if (!want[q] || seen.has(g.gameId) || (g.gameCreation || 0) < SEASON.since) continue;   // 내전(custom)은 안 모음 · 시즌 전 판은 안 셈
      seen.add(g.gameId); want[q].push(g.gameId);
    }
    let fetched = 0;
    for (const id of want.mayhem) {   // 상세 = 처음 한 번만(판 기록은 안 바뀜)
      if (cache[id] && cache[id].p === puuid) continue;
      const g = await d.lcuGet(`/lol-match-history/v1/games/${id}`).catch(() => null);
      const c = g && compactGame(g, puuid);
      if (c) { cache[id] = Object.assign({ p: puuid }, c); fetched++; }
    }
    // 모아 둔 판 = 이번에 받은 판 + 예전에 받아 둔 판(롤이 최근 20판만 줘서 지난 판은 여기 모아 둔 게 유일한 기록) · 시즌 전 판은 지움(상한 = 안전용 MAX_GAMES)
    const pool = q => Object.entries(cache).filter(([, c]) => c && c.p === puuid && c.q === q).sort((x, y) => y[1].t - x[1].t);
    for (const q of Object.keys(Q)) for (const [id, c] of pool(q)) if (c.t < SEASON.since) delete cache[id];
    for (const q of Object.keys(Q)) for (const [id] of pool(q).slice(MAX_GAMES)) delete cache[id];
    for (const [id, c] of Object.entries(cache)) if (c && c.p === puuid && !Q[c.q]) delete cache[id];   // 예전 칼바람(aram) 요약 등 이제 안 쓰는 큐
    try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch (_) {}
    // + 서버 「같이 한 일반 판」(롤 전적에 없는 판만 · 다른 PC에서 했거나 앱이 롤 전적을 못 읽었던 판)
    const lcu = pool('mayhem'), have = new Set(lcu.map(([id]) => String(id)));
    const add = (extra || []).filter(c => c && c.q === 'mayhem' && !have.has(String(c.id)) && c.t >= SEASON.since);
    const games = [...lcu.map(([, c]) => c), ...add].sort((x, y) => y.t - x.t);
    const out = { at: Date.now(), v: 3, mayhem: scoreQueue(games), src: { list: list.length, mayhem: games.length } };
    const lab = x => x ? (x.gr ? `${x.s}점(${x.n}판)` : '배치 ' + x.pl) : '-';
    d.log(`🏅 점수(아수라장 ${SEASON.name} · ${SEASON.patch}~) — 전적 목록 ${list.length}판(이번에 아수라장 일반 ${want.mayhem.length} · 새로 받은 상세 ${fetched}) · 모아 둔 롤 전적 ${lcu.length} + 투데이 내전 기록 ${add.length} · 아수라장 일반 ${lab(out.mayhem)}`);
    return out;
  }
  return { collect, _compactGame: compactGame, _scoreQueue: scoreQueue, _soloOf: soloOf, _gradeOf: gradeOf };
}
