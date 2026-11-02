// 🧭 aramgg.com 증강 통계 받기(v0.1.100 · 증강 가이드·증강 순위의 기본 자료) → docs/data/aramgg/(홈페이지 GitHub Pages로 앱이 읽음)
//   aramgg = Tencent(중국 서버) 공개 통계 + aramgg 클라이언트 업로드 · 매일 갱신 · 증강 번호 = 라이엇 cherry-augments 번호와 같음
//   받는 것: /ko/augments(전체 증강 등급 T1~T5·승률 — HTML) · /data/champions-stats.json(챔피언 목록) · /data/champion-details/{id}.json(챔피언별 증강 등급·승률·픽률 + 3개 조합)
//   약관 = 과도한 속도의 수집·재판매 금지 → 하루 한 번(aramgg.yml) · 요청 사이 1.2초 쉼 · 출처 표시(앱 화면 「aramgg.com」+ 원문 링크)
// 사용: node tools/aramgg-fetch.cjs [출력 폴더=docs/data/aramgg] [--only=498,17]   · 바뀐 게 없으면(같은 날짜) 파일 그대로
// 출력: index.json = {p:패치, d:자료 날짜, at, n:챔피언 수, g:{증강 id:[등급 1~5, 승률|null]}}
//       c/{championId}.json = {p, d, t:[챔피언 등급, 승률, 픽률, 순위], a:{증강 id:[등급, 승률|null, 픽률, 사이트 순위]}, c:[[[증강 3개], 승률, 게임 수] ≤5]}
const fs = require('fs'), path = require('path');
const BASE = 'https://aramgg.com';
const OUT = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'docs', 'data', 'aramgg');
const ONLY = ((process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '').split(',').filter(Boolean);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) today-naejeon-augment-guide (+https://sohada2.github.io/today-naejeon/)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = v => v == null || v === '' || isNaN(+v) ? null : +v;
const r4 = v => v == null ? null : Math.round(v * 10000) / 10000;
const patchOf = v => { const m = /^(\d+)\.(\d+)/.exec(String(v || '')); return m ? `${+m[1] < 20 ? +m[1] + 10 : +m[1]}.${m[2]}` : ''; };   // 라이엇 내부 16.21 = 화면 표기 26.21
async function get(u, json) {
  for (let k = 0; k < 3; k++) {
    try { const r = await fetch(BASE + u, { headers: UA }); if (r.ok) return json ? r.json() : r.text(); console.log('  HTTP', r.status, u); } catch (e) { console.log('  오류', e.message, u); }
    await sleep(3000 * (k + 1));
  }
  return null;
}
function parseGlobal(html) {   // 전체 증강 등급표: T1~T5 제목 뒤 카드(<article> … /ko/augments/{id} … 승률 n%)
  const heads = [...html.matchAll(/>T([1-5])</g)].map(m => ({ at: m.index, t: +m[1] }));
  const g = {};
  for (const m of html.matchAll(/<article[^>]*>\s*<a href="\/ko\/augments\/(\d+)"/g)) {
    const h = heads.filter(x => x.at < m.index).pop(); if (!h) continue;
    const seg = html.slice(m.index, m.index + 3000), w = /승률<\/span>\s*<span[^>]*>([\d.]+)%/.exec(seg);
    if (!g[m[1]]) g[m[1]] = [h.t, w ? r4(+w[1] / 100) : null];
  }
  return g;
}
function compactChamp(d, st) {
  const raw = d && d.championAugments && d.championAugments[0] && d.championAugments[0][1];
  const x = typeof raw === 'string' ? JSON.parse(raw) : raw; if (!x || !x.augments) return null;
  const a = {};
  for (const [id, v] of Object.entries(x.augments)) { const t = num(v.tier); if (t >= 1 && t <= 5) a[id] = [t, r4(num(v.win_rate)), r4(num(v.pick_rate)), num(v.rank)]; }
  const c = Object.entries(x.augment_trios || {}).map(([k, v]) => [k.split(':').map(Number), r4(num(v.win_rate)), num(v.num_games)])
    .filter(t => t[0].length === 3 && t[1] != null && t[2] >= 1).sort((p, q) => q[1] - p[1]).slice(0, 30);   // v0.1.101: 5 → 30(증강 순위 배지 「🔗 조합」이 카드마다 찾아 씀 · 가이드 「추천 콤보」는 main이 앞 5개만)
  compactChamp.trios = (compactChamp.trios || 0) + Object.keys(x.augment_trios || {}).length;
  const mh = x.match_history || {};
  return { p: patchOf(mh.game_patch || (st && st.version)), d: mh.date || (st && st.date) || '', t: st ? [num(st.tier), r4(num(st.winRate)), r4(num(st.pickRate)), num(st.rank)] : null, a, c };
}
(async () => {
  fs.mkdirSync(path.join(OUT, 'c'), { recursive: true });
  const html = await get('/ko/augments'); const g = html ? parseGlobal(html) : {};
  // 🔎 증강 하나짜리 페이지에 「같이 고른 증강」 같은 짝 자료가 있는지(2026-11-02 · 조합 자료가 챔피언당 5개뿐이라)
  for (const u of ['/ko/augments/1373', '/data/augment-details/1373.json', '/data/augments/1373.json', '/data/augment-pairs.json', '/data/augment-trios.json']) {
    await sleep(1200);
    try {
      const r = await fetch(BASE + u, { headers: UA }); const t = r.ok ? await r.text() : '';
      const hits = [...t.matchAll(/(trio|pair|duo|synerg|combo|together|함께|조합|시너지|같이)/gi)].slice(0, 6).map(m => JSON.stringify(t.slice(Math.max(0, m.index - 80), m.index + 120)));
      const js = [...t.matchAll(/["'](\/data\/[^"']+)["']/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 20);
      console.log(`🔎 ${u} → ${r.status} · ${t.length}자 · data 주소 ${js.join(' ')}`); for (const h of hits) console.log('   ', h);
    } catch (e) { console.log(`🔎 ${u} → 오류 ${e.message}`); }
  }
  console.log('전체 증강 등급', Object.keys(g).length);
  const stats = await get('/data/champions-stats.json', true);
  if (!Array.isArray(stats) || !stats.length) { console.log('챔피언 목록 못 받음 — 그만'); process.exit(1); }
  const byId = new Map(stats.map(s => [String(s.championId), s]));
  let ok = 0, fail = 0, patch = '', date = '';
  for (const id of ONLY.length ? ONLY : [...byId.keys()]) {
    await sleep(1200);
    const d = await get(`/data/champion-details/${id}.json`, true);
    if (!globalThis._probed && d) {   // 🔎 자료 구조를 한 번 로그로(사이트가 조합 말고 다른 짝 자료를 주는지 · Actions 기록에서 확인)
      globalThis._probed = 1;
      const raw = d.championAugments && d.championAugments[0] && d.championAugments[0][1], x = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const shape = (o, dep = 0) => o && typeof o === 'object' ? (Array.isArray(o) ? `[${o.length}]` + (o.length ? shape(o[0], dep + 1) : '') : dep > 2 ? '{…}' : '{' + Object.keys(o).slice(0, 12).map(k => k + ':' + shape(o[k], dep + 1)).join(', ') + (Object.keys(o).length > 12 ? ` …+${Object.keys(o).length - 12}` : '') + '}') : typeof o;
      console.log('🔎 champion-details 맨 위:', Object.keys(d).join(', '));
      console.log('🔎 championAugments[0][1] 칸:', x ? Object.keys(x).map(k => `${k}(${x[k] && typeof x[k] === 'object' ? Object.keys(x[k]).length : typeof x[k]})`).join(', ') : '없음');
      for (const k of Object.keys(x || {})) if (k !== 'augments') console.log(`🔎 ${k} =`, JSON.stringify(x[k]).slice(0, 600));
      console.log('🔎 구조:', shape(d).slice(0, 1500));
    }
    const c = d && compactChamp(d, byId.get(id));
    if (!c || !Object.keys(c.a).length) { fail++; continue; }
    patch = patch || c.p; date = c.d > date ? c.d : date;
    fs.writeFileSync(path.join(OUT, 'c', `${id}.json`), JSON.stringify(c)); ok++;
  }
  if (!ok) { console.log('챔피언 자료 0개 — index 안 바꿈'); process.exit(1); }
  if (!ONLY.length) fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ p: patch, d: date, at: Date.now(), n: ok, src: 'aramgg.com', g }));
  console.log(`챔피언 ${ok}개 · 실패 ${fail} · 패치 ${patch} · 자료 날짜 ${date} · 사이트 조합 ${compactChamp.trios || 0}개`);
})();
