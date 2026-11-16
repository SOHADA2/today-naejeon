// 📊 실제 아수라장에서 증강이 어떻게 뜨는지 — 우리 경기 기록으로 재기(읽기만 · 사람 이름은 안 씀) — node tools/aug-flow-report.cjs
//   「증강 뽑아 보기」(auglab/auglab.js)의 등급 확률 ODDS·ODDS_X를 이 결과로 맞춤(v0.1.209 · 라이엇은 확률을 공개하지 않음)
//   경기 기록 stats[].augments = 정산의 증강 번호(고른 순서) → 사람마다 n번째 증강의 등급을 보면:
//     · 한 판의 n번째 등급은 거의 모두 같음(= 그 판 모든 사람에게 같은 등급이 뜸) → 판마다 「가장 많은 등급」을 그 판의 n번째 등급으로 셈
//     · 5번째 증강 = K/DA 헤드라이너(카드 4장 → 증강 한 번 더) · 「전환」 증강 등 · 펜타킬 특성(3170~3176)은 증강 수에서 뺌
//   증강 등급(실버·골드·프리즘) = 이 PC에 앱이 받아 둔 %APPDATA%/today-naejeon/augments-cache.json → 없으면 CommunityDragon(느림)
const fs = require('fs'), path = require('path');
const fb = require('./fb-lib.cjs');
const pct = (a, n) => (n ? (a / n * 100).toFixed(0) : '0') + '%';
(async () => {
  let A = null;
  try { const m = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA || '', 'today-naejeon', 'augments-cache.json'), 'utf8')).map; A = {}; for (const [id, a] of Object.entries(m)) A[id] = { rar: a.rarity, head: /pentakill_(small|large)\.png$/i.test(a.icon || '') }; } catch (_) {}
  if (!A) { const list = await (await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/cherry-augments.json')).json(); A = {}; for (const a of list) A[a.id] = { rar: String(a.rarity || '').replace(/^k/, '').toLowerCase(), head: /pentakill_(small|large)\.png$/i.test(a.augmentSmallIconPath || '') }; }
  const R = { silver: 'S', gold: 'G', prismatic: 'P' }, rr = id => (A[id] ? (A[id].head ? 'H' : R[A[id].rar] || '?') : '?');
  const keys = await fb.get('days?shallow=true'), games = [];
  for (const day of Object.keys(keys || {}).sort()) {
    const d = await fb.get('days/' + day);
    for (const kind of ['matches', 'normals']) for (const m of Object.values((d && d[kind]) || {})) {
      if (!Array.isArray(m.stats) || !m.stats.some(s => (s.augments || []).length)) continue;
      games.push({ day, ps: m.stats.map(s => (s.augments || []).map(rr).join('')) });
    }
  }
  console.log(`증강 기록이 있는 판 ${games.length} · ${games.length ? games[0].day + ' ~ ' + games[games.length - 1].day : ''}`);
  const cnt = {}; let people = 0;
  for (const g of games) for (const p of g.ps) { const n = p.replace(/H/g, '').length; cnt[n] = (cnt[n] || 0) + 1; people++; }
  console.log('한 사람이 한 판에 고른 증강 수:', Object.entries(cnt).map(([k, v]) => `${k}개 ${pct(v, people)}`).join(' · '));
  const gd = [], same = [0, 0, 0, 0], tot = [0, 0, 0, 0]; let penta = 0, five = 0, ss12 = 0;
  for (const g of games) {
    const seqs = g.ps.map(p => p.replace(/H/g, '')), top = [];
    if (g.ps.some(p => p.includes('H'))) penta++;
    if (seqs.some(s => s.length >= 5)) five++;
    for (let i = 0; i < 5; i++) {
      const col = seqs.map(s => s[i]).filter(x => x && x !== '?'); if (col.length < Math.max(2, g.ps.length / 2)) break;
      const c = {}; for (const x of col) c[x] = (c[x] || 0) + 1;
      const t = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; top.push(t);
      gd[i] = gd[i] || { S: 0, G: 0, P: 0 }; gd[i][t]++;
      if (i < 4) { tot[i]++; if (new Set(col).size === 1) same[i]++; }
    }
    if (top[0] === 'S' && top[1] === 'S') ss12++;
  }
  console.log('그 판 모든 사람의 n번째 등급이 같은 판:', same.map((a, i) => `${i + 1}번째 ${a}/${tot[i]}`).join(' · '));
  console.log('n번째 선택 화면의 등급(판 기준) → auglab.js ODDS [실버, 골드, 프리즘]:');
  gd.forEach((d, i) => { const n = d.S + d.G + d.P; console.log(`  ${i + 1}번째: [${(d.S / n).toFixed(2)}, ${(d.G / n).toFixed(2)}, ${(d.P / n).toFixed(2)}]  (실버 ${d.S} · 골드 ${d.G} · 프리즘 ${d.P} · ${n}판)${i === 4 ? '  ← ODDS_X(추가 증강)' : ''}`); });
  console.log(`1·2번째가 둘 다 실버인 판 ${ss12}(규칙상 0이어야 함) · 펜타킬 헤드라이너 판 ${penta} · 5번째 증강이 나온 판 ${five}(K/DA 헤드라이너 · 전환 증강)`);
})().catch(e => { console.log('오류', e.message); process.exit(1); });
