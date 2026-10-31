// ── 🎯 증강 순위(v0.1.78 · 설정에서 켠 사람만) — 지금 뜬 증강 3개 알아내기·순위 매기기(계산만 · Electron 없이도 돎) ──
// 롤은 「지금 뜬 증강 3개」를 앱에 안 알려줌 → 게임 화면 가운데를 캡처해 Windows 내장 글자 읽기(OCR, main augOcr)로 카드의 **증강 이름**을 읽음
//  · 아이콘으로 맞추는 건 버림: 카드용 큰 그림은 322개 중 67개만 있고 비슷한 그림(불꽃·방패)이 많아 구분이 안 됨(2026-10-31 확인)
//  · 이름 줄 찾기(findCards): 읽은 줄마다 증강 이름과 비교(공백·기호 빼고 · 글자 1~2개 틀려도 · 줄에 다른 글이 붙어도) →
//    같은 높이(화면 높이 6% 안)에 서로 다른 증강 2~3개가 가로로 떨어져 있으면 「증강 고르는 화면」 · 리롤로 하나 바뀌면 다음 읽기에서 바로 반영
//  · 순위(rankAugs): 그 챔피언 이번 패치 등급 > 전체 등급 > 모름 · 콤보 +·함정 −·우리 기록 ± → 1·2·3위와 짧은 이유
const clean = s => String(s || '').replace(/[\s.,!?·:;'"`~()[\]{}<>\-_/\\|+*=]/g, '').toLowerCase();
function lev(a, b) {
  if (a === b) return 0; const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// names = [{id, name}] (아수라장 증강 · 같은 이름 여럿이면 첫 번호) → 찾기 사전
function nameIndex(names) {
  const by = new Map();
  for (const a of names.slice().sort((p, q) => (p.id < 1000) - (q.id < 1000) || p.id - q.id)) {   // 같은 이름이면 1000 이상 중 작은 번호(자료 만들 때와 같은 규칙)
    const k = clean(a.name); if (k.length >= 2 && !by.has(k)) by.set(k, a.id);
  }
  return { by, keys: [...by.keys()].sort((a, b) => b.length - a.length) };
}
function matchLine(ix, text) {   // OCR 한 줄 → {id, key, score} 또는 null
  const t = clean(text); if (t.length < 2) return null;
  if (ix.by.has(t)) return { id: ix.by.get(t), key: t, score: 1 };
  let best = null;
  for (const k of ix.keys) {
    let sc = 0;
    if (k.length >= 3 && t.includes(k)) sc = 0.92 * Math.min(1, k.length / t.length + 0.3);   // 줄에 이름 + 다른 글
    else if (Math.abs(k.length - t.length) <= 2) { const d = lev(k, t); sc = 1 - d / Math.max(k.length, t.length); }
    if (sc > (best ? best.score : 0)) best = { id: ix.by.get(k), key: k, score: sc };
  }
  return best && best.score >= (best.key.length <= 3 ? 0.99 : 0.72) ? best : null;
}
// lines = [{text, x, y, w, h}] (캡처 영상 좌표) · H = 캡처 높이 → {cards:[{id, x, y, w, h, score}]} (왼쪽부터) 또는 null
function findCards(ix, lines, H) {
  const hits = [];
  for (const L of lines || []) { const m = matchLine(ix, L.text); if (m) hits.push(Object.assign({ x: L.x, y: L.y, w: L.w, h: L.h }, m)); }
  let best = null;
  for (const a of hits) {   // a와 같은 높이에 있는 서로 다른 증강 묶음
    const row = hits.filter(b => Math.abs((b.y + b.h / 2) - (a.y + a.h / 2)) < H * 0.06);
    const pick = []; for (const b of row.sort((p, q) => q.score - p.score)) if (!pick.some(p => p.id === b.id) && !pick.some(p => Math.abs((p.x + p.w / 2) - (b.x + b.w / 2)) < H * 0.12)) pick.push(b);
    if (pick.length >= 2 && (!best || pick.length > best.length || (pick.length === best.length && pick.reduce((s, p) => s + p.score, 0) > best.reduce((s, p) => s + p.score, 0)))) best = pick.slice(0, 3);
  }
  return best ? { cards: best.sort((p, q) => p.x - q.x) } : null;
}

const TS = { 'S+': 10, S: 9, 'S-': 8, 'A+': 7, A: 6, 'A-': 5, 'B+': 4, B: 3, 'B-': 2, C: 1, D: 0 };
// g = 그 챔피언 augGuide 칸({tiers?, top?, plans?, avoid?}) · globalT = {id: tier} · rec = {id: {g, w}} · globalR = {id: 전체 순위} → [{id, rank, score, why}]
// v0.1.85: 순위가 일관성 없음(사장님 · 「자료 없음」이 B- 위 2위) → 자료 있는 증강끼리만 1·2·3위 · 자료 없는 건 rank null(「등급 없음」)
//   이유 글은 「기준 등급」 한 모양(「신 짜오 S-」「전체 B-」) · opt.champName = 내 챔피언 이름
function rankAugs(ids, g, globalT, rec, globalR, opt) {
  const champName = (opt && opt.champName) || '이 챔피언';
  g = g || {};
  const champT = Object.assign({}, (g.tiers && g.tiers.t) || {}); for (const x of (g.top && g.top.augs) || []) if (champT[x.id] == null) champT[x.id] = x.tier;
  const avoid = new Set(g.avoid || []);
  const rows = ids.map(id => {
    // tier = 등급 글자(S+…D) · scope = 그 등급의 기준(챔피언 이름/전체) · extra = 덧붙임(콤보·함정·우리 기록) — 배지는 순위(크게)·등급 칩·기준 순(v0.1.85)
    let score, tier = null, scope = '', known = true;
    const extra = [];
    if (TS[champT[id]] != null) { score = 10 + TS[champT[id]]; tier = champT[id]; scope = champName; }
    else if (globalT && TS[globalT[id]] != null) { score = TS[globalT[id]]; tier = globalT[id]; scope = '전체'; }
    else { score = 3; known = false; }
    const combo = (g.plans || []).find(p => (p.augs || []).includes(id) && (p.augs || []).length > 1);
    if (combo) { score += 1 + (TS[combo.tier] != null ? TS[combo.tier] : 6) / 10; extra.push('콤보'); }
    if (avoid.has(id)) { score -= 8; extra.unshift('함정'); known = true; }
    const r = rec && rec[id]; if (r && r.g >= 2) { score += (r.w / r.g - 0.5) * 4; extra.push(`우리 ${r.g}판 ${r.w}승`); known = true; }
    if (globalR && globalR[id]) score -= globalR[id] / 10000;   // 동점이면 사이트 전체 순위가 높은 쪽(1~204위)
    const why = [tier ? `${scope} ${tier}` : known ? '' : '등급 없음'].concat(extra).filter(Boolean).join(' · ');
    return { id, score: Math.round(score * 10000) / 10000, why, known, tier, scope, extra };
  });
  const order = rows.filter(r => r.known).sort((a, b) => b.score - a.score);
  for (const r of rows) r.rank = r.known ? order.findIndex(o => o.score === r.score) + 1 : null;   // 점수가 같으면 같은 등수 · 자료 없으면 순위 없음
  return rows;
}
module.exports = { clean, lev, nameIndex, matchLine, findCards, rankAugs, TS };
