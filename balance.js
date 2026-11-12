// ⚖️ 밸런스 팀 짜기(v0.1.174 · 사장님: 정확한 티어로 팀을 짜야 함) — 아수라장 티어 점수(0~100)로 두 팀 합이 비슷하게
//   teams.js(홈페이지 makeTeams 1:1 이식 · 상수 고정)는 그대로 두고 따로 만듦.
//   점수 = 아수라장 내전 점수(우리 서버 경기 기록)와 아수라장 일반 점수(각자 롤 전적)를 판 수(각 20판까지)로 가중 평균
//     · 둘 다 없으면(배치 중·앱 없는 손님) 50점(가운데) · 근거: 2026-11-09 되짚어 보기 = 내전 식 68% · 일반 75% 맞힘 · 오차 한 티어쯤
//   나누기 = 10명 이하라 모든 조합을 다 봄(5:5 = 126가지) → 가장 고른 조합에서 TOL점 안쪽인 조합들 중 무작위(매번 같은 팀이 안 나오게)
//     · 직전 판과 같은 조합은 다른 후보가 있으면 뺌 · 인원이 홀수거나 10명 넘으면 무작위로 관전(랜덤 방식과 같음)
const TOL = 2.5;      // 두 팀 합 차이: 가장 고른 조합 + 이 점수 안이면 후보
const CAP = 20;       // 가중치로 치는 판 수 상한
const BASE = 50;      // 자료 없는 사람

// x = scoreQueue 결과({s, n, …} 또는 배치 중 {pl}) → 점수 있음?
const has = x => !!(x && x.s != null && x.n >= 1);
function playerScore(inhouse, mayhem) {
  const a = has(inhouse) ? Math.min(inhouse.n, CAP) : 0, b = has(mayhem) ? Math.min(mayhem.n, CAP) : 0;
  if (!a && !b) return { s: BASE, known: false };
  return { s: Math.round(((a ? inhouse.s * a : 0) + (b ? mayhem.s * b : 0)) / (a + b) * 10) / 10, known: true };
}

const keyOf = (A, B) => { const a = [...A].sort().join(','), b = [...B].sort().join(','); return a < b ? a + '|' + b : b + '|' + a; };
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// names = 참가자 이름 · scores = {이름: 점수} · prevA/prevB = 직전 팀
// 반환 { teamA, teamB, spectators, sumA, sumB, diff, cands(후보 수) }
function balanceTeams({ names, scores, prevA, prevB, rnd }) {
  const R = rnd || Math.random;
  let pool = shuffle(names);
  const spectators = [];
  while (pool.length > 10) spectators.push(pool.pop());
  if (pool.length % 2) spectators.push(pool.pop());
  const n = pool.length, half = n / 2, sc = x => (scores && scores[x] != null ? scores[x] : BASE);
  const total = pool.reduce((s, x) => s + sc(x), 0);
  const all = [];
  // 첫 사람은 늘 A에 둠(같은 나누기를 두 번 세지 않게) → 나머지에서 half-1명 고르기
  const pick = (start, chosen, sum) => {
    if (chosen.length === half) { all.push({ A: chosen.slice(), d: Math.abs(total - 2 * sum) }); return; }
    for (let i = start; i <= n - (half - chosen.length); i++) { chosen.push(i); pick(i + 1, chosen, sum + sc(pool[i])); chosen.pop(); }
  };
  if (n >= 2) pick(1, [0], sc(pool[0]));
  const min = Math.min(...all.map(c => c.d));
  const within = all.filter(c => c.d <= min + TOL).map(c => {
    const A = c.A.map(i => pool[i]), set = new Set(c.A), B = pool.filter((_, i) => !set.has(i));
    return { A, B, d: c.d, key: keyOf(A, B) };
  });
  const prevKey = (prevA && prevB && prevA.length && prevB.length) ? keyOf(prevA, prevB) : null;
  const fresh = within.filter(c => c.key !== prevKey), from = fresh.length ? fresh : within;
  const c = from[Math.floor(R() * from.length)];
  // 어느 쪽이 1팀인지도 무작위
  const flip = R() < 0.5, teamA = flip ? c.B : c.A, teamB = flip ? c.A : c.B;
  const sum = t => Math.round(t.reduce((s, x) => s + sc(x), 0) * 10) / 10;
  return { teamA, teamB, spectators, sumA: sum(teamA), sumB: sum(teamB), diff: Math.round(c.d * 10) / 10, min: Math.round(min * 10) / 10, cands: within.length };
}

module.exports = { balanceTeams, playerScore, TOL, BASE };
