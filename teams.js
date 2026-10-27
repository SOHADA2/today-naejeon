// ── ⚔️ 팀 짜기 알고리즘 — 홈페이지(aram/index.html) makeTeams 1:1 이식 ──────
// 원본: makeTeams(~L16296) · getWinRateScore(~L14554) · calcStats(~L14537) · shuffle(~L16021) · normName(~L14453)
// ⚠️ 홈페이지와 결과 분포가 동일해야 함(둘 다 랜덤성 포함) — 로직·상수(TOL 0.12·시도 16회·그리디 200회)를 바꾸지 말 것.
// 홈페이지가 바뀌면 여기도 같이 갱신(핸드오프 CLAUDE.md 참조).

// 홈페이지 normName: trim + 연속 공백 1칸(소문자화 아님! 오버레이 LP매칭용 norm과 다름)
const normName = n => String(n).trim().replace(/\s+/g, ' ');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 시즌 승/패 집계 (m.season ?? 0 === season 인 매치만)
function calcStats(matches, name, season) {
  const key = normName(name);
  let wins = 0, total = 0;
  for (const m of Object.values(matches || {})) {
    if (!m || (m.season ?? 0) !== season) continue;
    const inA = m.teamA && m.teamA.some(n => normName(n) === key);
    const inB = m.teamB && m.teamB.some(n => normName(n) === key);
    if (inA || inB) {
      total++;
      if ((m.winner === 'blue' && inA) || (m.winner === 'red' && inB)) wins++;
    }
  }
  return { wins, losses: total - wins, total, wr: total > 0 ? wins / total : null };
}

// 승률 기반 점수 — 판수 적을수록 0.5(50%)에 수렴하는 신뢰도 가중치
function getWinRateScore(matches, name, season) {
  const s = calcStats(matches, name, season);
  if (s.total === 0) return 0.5;
  const trust = s.total / (s.total + 10);
  return s.wr * trust + 0.5 * (1 - trust);
}

// 팀 짜기 본체 — 홈페이지 makeTeams "일반 매치" 분기와 동일
//   names: 참가자 이름 배열 / mode: 'balance'|'random' / matches: /matches 스냅샷 / season: CURRENT_SEASON
//   prevTeamA/B: 직전 팀(전판 회피용·session에서) / spectatorExclude: 관전 제외 이름 배열(선택)
// 반환: { teamA, teamB, teamSize, spectators } (전부 이름 문자열)
function buildTeams({ names, mode, matches, season, prevTeamA, prevTeamB, spectatorExclude }) {
  if (!Array.isArray(names) || names.length < 4) throw new Error('일반 매치엔 최소 4명이 필요해요! (현재 ' + (names ? names.length : 0) + '명)');
  let pool = names.map(n => ({ name: n }));

  // 5v5 최대 — 10명 초과는 관전자로, 그 후 홀수이면 1명 추가 관전자 (관전 제외 설정자는 마지막 순위)
  const excludeSet = new Set((spectatorExclude || []).map(normName));
  const _pickSpectator = pool => {
    const preferred = pool.filter(p => !excludeSet.has(normName(p.name)));
    const src = preferred.length > 0 ? preferred : pool;
    const chosen = src[Math.floor(Math.random() * src.length)];
    pool.splice(pool.indexOf(chosen), 1);
    return chosen;
  };
  const spectators = [];
  while (pool.length > 10) spectators.push(_pickSpectator(pool));
  if (pool.length % 2 !== 0) spectators.push(_pickSpectator(pool));
  const teamSize = pool.length / 2;

  let A, B;
  if (mode === 'random') {
    const s = shuffle(pool); A = s.slice(0, teamSize); B = s.slice(teamSize);
  } else {
    // 🎯 승률 기반 밸런스 — 랜덤 시작 16회 밸런싱 후, 균형 허용오차(0.12) 내 후보 중 '전판과 다른' 조합 우선
    // 점수 메모이즈: 같은 이름=같은 점수(순수함수)라 결과·분포 완전 동일, 매치 전체 재스캔(빌드당 ~수백만 회)만 제거
    const _scoreCache = new Map();
    const _score = name => { let v = _scoreCache.get(name); if (v === undefined) { v = getWinRateScore(matches, name, season); _scoreCache.set(name, v); } return v; };
    const sc = arr => arr.reduce((s, p) => s + _score(p.name), 0);
    const _pkey = (a, b) => { const na = (a || []).map(p => normName(p.name || p)).sort().join(','), nb = (b || []).map(p => normName(p.name || p)).sort().join(','); return na < nb ? na + '|' + nb : nb + '|' + na; };
    const prevKey = _pkey(prevTeamA || [], prevTeamB || []);
    const _balanceOnce = () => {
      const s = shuffle([...pool]); const cA = [], cB = [];
      s.forEach((p, i) => (i % 2 === 0 ? cA : cB).push(p));
      for (let i = 0; i < 200; i++) {
        const ia = Math.floor(Math.random() * cA.length), ib = Math.floor(Math.random() * cB.length);
        const before = Math.abs(sc(cA) - sc(cB));
        [cA[ia], cB[ib]] = [cB[ib], cA[ia]];
        if (Math.abs(sc(cA) - sc(cB)) > before) [cA[ia], cB[ib]] = [cB[ib], cA[ia]];
      }
      return { A: cA, B: cB, diff: Math.abs(sc(cA) - sc(cB)), key: _pkey(cA, cB) };
    };
    const cands = []; for (let r = 0; r < 16; r++) cands.push(_balanceOnce());
    const minDiff = Math.min(...cands.map(c => c.diff));
    const TOL = 0.12;
    const within = cands.filter(c => c.diff <= minDiff + TOL);
    const fresh = within.filter(c => c.key !== prevKey);
    const pickFrom = fresh.length ? fresh : within;
    const chosen = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    A = chosen.A; B = chosen.B;
  }
  return { teamA: A.map(p => p.name), teamB: B.map(p => p.name), teamSize, spectators: spectators.map(p => p.name) };
}

module.exports = { buildTeams, normName, getWinRateScore, calcStats, shuffle };
