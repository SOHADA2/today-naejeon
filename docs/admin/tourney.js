// 🏆 대회 핵심 계산(v0.1.291) — 대진 만들기(싱글 토너먼트·풀리그) · 점수·진출·순위 계산 · 순수 함수(서버·화면 없음)
//   쓰는 곳 = 앱 main.js(require) · 운영 보드 docs/admin/tourney.js(같은 파일의 사본 · <script> → window.tnTourney)
//   ⚠️ 이 파일을 고치면 docs/admin/tourney.js에도 그대로 복사(tools/tourney-test.cjs가 두 파일이 같은지 검사)
//   대회 = { name, fmt: 'se'|'rr', bo, boF(결승 판수 · se만), st: 'draft'|'live'|'done', at, by,
//            teams: { 팀id: { name, tag, seed, mem: { puuid: { n: 이름, r: 'cap'|'sub'|'' } } } },
//            matches: { 경기id: { r: 라운드(1~), i: 그 라운드 안 순서(0~), a, b(팀id · se 2라운드부터는 없음), fa, fb(앞 경기 id = 그 승자가 올라옴), bo, win(운영자가 정한 승자 팀id · 기권·부전승) } },
//            res: { 경기id: { 게임번호: { w: 이긴 팀id, day, at, n } } } }   ← res만 선수(방장 앱)가 씀 · 나머지는 운영자
//   ⚖️ 라이엇 규정(2025-05-29 General Policies): 시드는 무작위·운영자 손으로만(MMR·ELO 같은 점수로 시드 금지)
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.tnTourney = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  const need = bo => Math.ceil((Number(bo) || 1) / 2);
  const BO_KO = bo => bo === 5 ? '5판 3선승' : bo === 3 ? '3판 2선승' : '단판';
  const roundName = (fmt, r, rounds) => { if (fmt === 'rr') return r + '라운드'; const left = rounds - r; return left === 0 ? '결승' : left === 1 ? '4강' : left === 2 ? '8강' : left === 3 ? '16강' : Math.pow(2, left + 1) + '강'; };
  // 시드 자리(1 vs 꼴찌 · 2 vs 그다음…) — 크기 n(2의 거듭제곱)의 표준 대진 순서
  function seedOrder(n) { let o = [1]; while (o.length < n) { const m = o.length * 2 + 1, x = []; for (const s of o) x.push(s, m - s); o = x; } return o; }
  // 싱글 토너먼트 — ids = 시드 순서(1번 시드부터) · 팀 수가 2의 거듭제곱이 아니면 높은 시드가 부전승(1라운드 경기에 bye)
  function makeSE(ids, bo, boF) {
    const n = ids.length; if (n < 2) throw new Error('팀이 2개 이상이어야 합니다');
    let size = 1; while (size < n) size *= 2;
    const rounds = Math.log2(size), ord = seedOrder(size), M = {};
    for (let i = 0; i < size / 2; i++) {
      const a = ids[ord[i * 2] - 1] || null, b = ids[ord[i * 2 + 1] - 1] || null;
      const m = { r: 1, i, bo: rounds === 1 ? (boF || bo) : bo }; if (a) m.a = a; if (b) m.b = b; if (!a || !b) m.bye = true;
      M['r1m' + i] = m;
    }
    for (let r = 2; r <= rounds; r++) for (let i = 0; i < size / Math.pow(2, r); i++)
      M['r' + r + 'm' + i] = { r, i, bo: r === rounds ? (boF || bo) : bo, fa: 'r' + (r - 1) + 'm' + (i * 2), fb: 'r' + (r - 1) + 'm' + (i * 2 + 1) };
    return M;
  }
  // 풀리그 — 모든 팀이 한 번씩(원 돌리기) · 홀수면 한 팀씩 쉼
  function makeRR(ids, bo) {
    const n0 = ids.length; if (n0 < 2) throw new Error('팀이 2개 이상이어야 합니다');
    const arr = ids.slice(); if (arr.length % 2) arr.push(null);
    const n = arr.length, M = {};
    for (let r = 0; r < n - 1; r++) {
      let k = 0;
      for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a && b) { M['r' + (r + 1) + 'm' + k] = { r: r + 1, i: k, a: r % 2 ? b : a, b: r % 2 ? a : b, bo }; k++; } }
      arr.splice(1, 0, arr.pop());
    }
    return M;
  }
  // 계산 — 경기마다 두 팀·점수·승자·상태 · 라운드 묶음 · (풀리그) 순위 · 우승
  function resolve(T) {
    const teams = (T && T.teams) || {}, MS = (T && T.matches) || {}, RES = (T && T.res) || {}, out = {}, fmt = T && T.fmt === 'rr' ? 'rr' : 'se';
    const ids = Object.keys(MS).sort((x, y) => (MS[x].r - MS[y].r) || (MS[x].i - MS[y].i));
    const rounds = ids.reduce((mx, k) => Math.max(mx, MS[k].r || 1), 0);
    const tm = id => (id && teams[id]) ? { id, name: teams[id].name || '?', tag: teams[id].tag || '' } : null;
    for (const id of ids) {   // 라운드 순서라 앞 경기가 먼저 계산돼 있음
      const m = MS[id], bo = Number(m.bo) || 1, nd = need(bo);
      const a = m.a || (m.fa && out[m.fa] && out[m.fa].win) || null, b = m.b || (m.fb && out[m.fb] && out[m.fb].win) || null;
      const games = Object.entries(RES[id] || {}).filter(([, g]) => g && g.w).map(([gid, g]) => ({ gid, w: g.w, day: g.day || null, at: g.at || 0, n: g.n || 0 })).sort((x, y) => x.at - y.at);
      const sa = games.filter(g => g.w === a).length, sb = games.filter(g => g.w === b).length;
      // 부전승 = 한쪽 자리가 비었고 앞 경기도 없음(1라운드 bye) · 또는 앞 경기가 「둘 다 없음」으로 끝난 경우
      const emptyA = !a && (!m.fa || (out[m.fa] && out[m.fa].state === 'void')), emptyB = !b && (!m.fb || (out[m.fb] && out[m.fb].state === 'void'));
      let win = null, state = 'wait', how = null;
      if (m.win && (m.win === a || m.win === b)) { win = m.win; state = 'done'; how = 'admin'; }
      else if (a && b) { if (sa >= nd) { win = a; state = 'done'; } else if (sb >= nd) { win = b; state = 'done'; } else state = games.length ? 'live' : 'ready'; }
      else if (a && emptyB) { win = a; state = 'done'; how = 'bye'; }
      else if (b && emptyA) { win = b; state = 'done'; how = 'bye'; }
      else if (emptyA && emptyB) state = 'void';
      out[id] = { id, r: m.r, i: m.i, bo, need: nd, a, b, ta: tm(a), tb: tm(b), sa, sb, games, win, lose: win ? (win === a ? b : a) : null, state, how, rn: roundName(fmt, m.r, rounds), no: m.i + 1 };
    }
    const byRound = [];
    for (let r = 1; r <= rounds; r++) byRound.push({ r, name: roundName(fmt, r, rounds), matches: ids.filter(k => MS[k].r === r).map(k => out[k]) });
    let standings = null, champ = null;
    const real = ids.map(k => out[k]).filter(m => m.how !== 'bye' && m.state !== 'void');
    const allDone = real.length > 0 && real.every(m => m.state === 'done');
    if (fmt === 'rr') {
      const P = {}; for (const id of Object.keys(teams)) P[id] = { id, name: teams[id].name || '?', tag: teams[id].tag || '', w: 0, l: 0, gw: 0, gl: 0, beat: {} };
      for (const m of real) { if (!P[m.a] || !P[m.b]) continue; P[m.a].gw += m.sa; P[m.a].gl += m.sb; P[m.b].gw += m.sb; P[m.b].gl += m.sa;
        if (m.state === 'done' && m.win) { P[m.win].w++; P[m.lose].l++; P[m.win].beat[m.lose] = 1; } }
      // 순위 = 시리즈 승 → 판 득실 → (딱 두 팀만 같으면) 승자승 → 이긴 판 수 → 이름
      const key = p => p.w + '|' + (p.gw - p.gl), cnt = {}; for (const p of Object.values(P)) cnt[key(p)] = (cnt[key(p)] || 0) + 1;
      standings = Object.values(P).sort((x, y) => (y.w - x.w) || ((y.gw - y.gl) - (x.gw - x.gl)) || (cnt[key(x)] === 2 ? (y.beat[x.id] || 0) - (x.beat[y.id] || 0) : 0) || (y.gw - x.gw) || String(x.name).localeCompare(String(y.name), 'ko'));
      standings.forEach((p, i) => { p.rank = i + 1; delete p.beat; });
      if (allDone && standings.length) champ = standings[0].id;
    } else { const f = ids.length ? out[ids[ids.length - 1]] : null; if (f && f.state === 'done') champ = f.win; }
    return { fmt, rounds, byRound, matches: out, standings, champ: champ ? tm(champ) : null, allDone };
  }
  // 팀 인원 검사 — 선수 5명(팀장 포함) + 후보 2명까지
  const MAIN_MAX = 5, SUB_MAX = 2;
  function rosterCount(team) { const mem = Object.values((team && team.mem) || {}); const sub = mem.filter(x => x && x.r === 'sub').length; return { main: mem.length - sub, sub, cap: mem.filter(x => x && x.r === 'cap').length }; }
  return { need, BO_KO, roundName, seedOrder, makeSE, makeRR, resolve, rosterCount, MAIN_MAX, SUB_MAX };
});
