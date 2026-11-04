// ── 🏅 전적 기반 점수(v0.1.111 · 사장님: 솔로 랭크 티어 + 칼바람 점수 + 아수라장 점수 — 한 사람당 3개) ─────────────
// 각자 앱이 자기 롤 클라이언트(LCU)에서 조용히 읽음(화면·마우스 안 건드림) → today/ratings/{puuid}에 요약만 올림 → 프로필에서 누구 것이든 봄
//  · 솔로 랭크 = 공식 티어 그대로(/lol-ranked/v1/current-ranked-stats · 솔로 없으면 자유 랭크)
//  · 칼바람(큐 450)·아수라장(큐 2400 · 모드 KIWI) = 최근 전적(/lol-match-history/v1/products/lol/current-summoner/matches)에서 각 40판까지
//    판마다 상세(/lol-match-history/v1/games/{id} · 10명)로 팀 안 딜 순위·킬 관여·KDA → 경기력 · 상세는 userData에 보관(한 번만 받음)
//  · 점수 0~100 = 승률(판 수 적으면 50% 쪽으로 당김) 55% + 경기력 45% · 최근 판일수록 무게(0.96^n) · 5판 안 되면 「배치 중 n/5」
//  · 등급 = S+ S A+ A B+ B C+ C D(공식 랭크와 헷갈리지 않게 글자 등급 · 「MMR」이라 부르지 않음 — 라이엇 정책)
//  ⚠️ 실기(2026-11-04 집 PC): 롤 전적 목록은 begIndex/endIndex를 **무시하고 늘 최근 20판**만 줌(current-summoner·puuid 주소 둘 다 · 0~199도 20판)
//    → 첫 쪽에서 새 판이 없으면 그만 읽음 + 받은 판 요약을 이 PC에 **모아 둠**(큐마다 최근 40판 · 예전엔 이번 목록에 없는 판을 지워 20판을 못 넘었음)
const fs = require('fs'), path = require('path');
const Q = { aram: { ids: [450], modes: ['ARAM'] }, mayhem: { ids: [2400], modes: ['KIWI'] } };
const MAX_GAMES = 40, MIN_GAMES = 5, PAGE = 20, MAX_PAGES = 10;
const GRADES = [[75, 'S+'], [70, 'S'], [65, 'A+'], [60, 'A'], [55, 'B+'], [50, 'B'], [45, 'C+'], [40, 'C'], [-1, 'D']];
const gradeOf = s => GRADES.find(([min]) => s >= min)[1];
const r3 = v => Math.round(v * 1000) / 1000;

function queueOf(g) {   // 이 판이 칼바람/아수라장인지
  for (const [k, q] of Object.entries(Q)) if (q.ids.includes(Number(g.queueId)) || (g.queueId == null && q.modes.includes(g.gameMode))) return k;
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

module.exports = function makeRating(d) {   // d = { lcuGet(path) → data|null, userData, log }
  const cacheFile = path.join(d.userData, 'rating-games.json');
  let cache = {}; try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) || {}; } catch (_) {}
  async function collect(puuid) {
    const rk = await d.lcuGet('/lol-ranked/v1/current-ranked-stats').catch(() => null);
    const list = [], ids = new Set();
    for (let p = 0; p < MAX_PAGES; p++) {   // 최근 전적 목록(한 번에 20판씩 — 실제로는 롤이 늘 같은 최근 20판을 줌)
      const r = await d.lcuGet(`/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${p * PAGE}&endIndex=${(p + 1) * PAGE}`).catch(() => null);
      const games = (r && r.games && r.games.games) || [];
      let fresh = 0; for (const g of games) if (g && !ids.has(g.gameId)) { ids.add(g.gameId); list.push(g); fresh++; }
      const have = { aram: 0, mayhem: 0 }; for (const g of list) { const q = queueOf(g); if (q) have[q]++; }
      if (games.length < PAGE || !fresh || (have.aram >= MAX_GAMES && have.mayhem >= MAX_GAMES)) break;   // 새 판이 없으면 그만(같은 20판 반복)
    }
    const seen = new Set(), want = { aram: [], mayhem: [] };
    for (const g of list.sort((x, y) => (y.gameCreation || 0) - (x.gameCreation || 0))) {
      const q = queueOf(g); if (!q || seen.has(g.gameId) || want[q].length >= MAX_GAMES) continue;
      seen.add(g.gameId); want[q].push(g.gameId);
    }
    let fetched = 0;
    for (const id of [...want.aram, ...want.mayhem]) {   // 상세 = 처음 한 번만(판 기록은 안 바뀜)
      if (cache[id] && cache[id].p === puuid) continue;
      const g = await d.lcuGet(`/lol-match-history/v1/games/${id}`).catch(() => null);
      const c = g && compactGame(g, puuid);
      if (c) { cache[id] = Object.assign({ p: puuid }, c); fetched++; }
    }
    // 모아 둔 판 = 이번에 받은 판 + 예전에 받아 둔 판(롤이 최근 20판만 줘서 지난 판은 여기 모아 둔 게 유일한 기록) · 큐마다 최근 40판만 남김
    const pool = q => Object.entries(cache).filter(([, c]) => c && c.p === puuid && c.q === q).sort((x, y) => y[1].t - x[1].t);
    for (const q of Object.keys(Q)) for (const [id] of pool(q).slice(MAX_GAMES)) delete cache[id];
    try { fs.writeFileSync(cacheFile, JSON.stringify(cache)); } catch (_) {}
    const mine = q => pool(q).map(([, c]) => c);
    const out = { at: Date.now(), v: 1, solo: soloOf(rk), aram: scoreQueue(mine('aram')), mayhem: scoreQueue(mine('mayhem')),
      src: { list: list.length, aram: mine('aram').length, mayhem: mine('mayhem').length, ranked: !!rk } };
    d.log(`🏅 점수 — 전적 목록 ${list.length}판(이번에 칼바람 ${want.aram.length} · 아수라장 ${want.mayhem.length} · 새로 받은 상세 ${fetched} · 모아 둔 칼바람 ${out.src.aram} · 아수라장 ${out.src.mayhem}) · 솔로 ${out.solo ? out.solo.tier + ' ' + (out.solo.div || '') : '없음'} · 칼바람 ${out.aram ? (out.aram.gr || '배치 ' + out.aram.pl) : '-'} · 아수라장 ${out.mayhem ? (out.mayhem.gr || '배치 ' + out.mayhem.pl) : '-'}`);
    return out;
  }
  return { collect, _compactGame: compactGame, _scoreQueue: scoreQueue, _soloOf: soloOf, _gradeOf: gradeOf };
};
