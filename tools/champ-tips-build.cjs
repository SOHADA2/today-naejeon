// 🍯 챔피언·증강 꿀팁 만들기 — node tools/champ-tips-build.cjs
//  tools/champ-tips.src.json(이름으로 쓴 원본) → docs/data/tips.json(번호) · 홈페이지(GitHub Pages)로 앱이 읽음 → 앱 업데이트 없이 고칠 수 있음
//  증강 = 지금 시즌에 있는 것만(aramgg 전체 등급 docs/data/aramgg/index.json 또는 최근 패치 노트 신규) — 삭제된 증강(치명적 미사일·드롭킥 등)은 빼고 경고
//  이름 → 번호 = CommunityDragon 한국어(챔피언 champion-summary · 증강 cherry-augments 1000번 이상 · 아이템 items 1만 미만)
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..'), CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/';
const norm = s => String(s || '').replace(/\s+/g, '').toLowerCase();
(async () => {
  const src = JSON.parse(fs.readFileSync(path.join(__dirname, 'champ-tips.src.json'), 'utf8'));
  const [champs, augs, items] = await Promise.all(['champion-summary.json', 'cherry-augments.json', 'items.json'].map(f => fetch(CD + f).then(r => r.json())));
  const idx = JSON.parse(fs.readFileSync(path.join(R, 'docs/data/aramgg/index.json'), 'utf8'));
  let pat = { patches: [] }; try { pat = JSON.parse(fs.readFileSync(path.join(R, 'docs/data/aramgg/patches.json'), 'utf8')); } catch (_) {}
  const live = new Set([...Object.keys(idx.g || {}), ...(pat.patches[0] ? pat.patches[0].added.map(a => String(a.id)) : [])]);
  const C = new Map(champs.filter(c => c.id > 0 && c.id < 10000).map(c => [norm(c.name), c.id]));
  const A = new Map(); for (const a of augs) if (a.id >= 1000 && a.nameTRA && !A.has(norm(a.nameTRA)) || (a.id >= 1000 && live.has(String(a.id)))) A.set(norm(a.nameTRA), a.id);   // 같은 이름이면 지금 시즌 것 우선
  const I = new Map(); for (const i of items.filter(i => i.id < 10000 && i.priceTotal > 0).sort((x, y) => x.id - y.id)) if (!I.has(norm(i.name))) I.set(norm(i.name), i.id);
  const warn = [];
  const ch = n => { const id = C.get(norm(n)); if (!id) warn.push(`챔피언 없음: ${n}`); return id; };
  const au = (n, where) => { const id = A.get(norm(n)); if (!id) { warn.push(`증강 없음: ${n} (${where})`); return null; } if (!live.has(String(id))) { warn.push(`지금 시즌에 없음(뺌): ${n} #${id} (${where})`); return null; } return id; };
  const it = (n, where) => { const id = I.get(norm(n)); if (!id) warn.push(`아이템 없음: ${n} (${where})`); return id || null; };
  const out = { v: 1, at: Date.now(), src: 'aramgg.com 블로그 가이드를 읽고 정리(2026-11-07)', champs: {}, augs: {} };
  for (const [n, x] of Object.entries(src.champs)) {
    const id = ch(n); if (!id) continue;
    const core = (x.core || []).map(a => au(a, n)).filter(Boolean);
    if (!core.length) { warn.push(`핵심 증강이 다 빠짐: ${n}`); continue; }
    out.champs[id] = Object.assign({ build: x.build, core, tip: x.tip }, (x.avoid || []).length ? { avoid: x.avoid.map(a => au(a, n + ' 피할')).filter(Boolean) } : {}, (x.items || []).length ? { items: x.items.map(i => it(i, n)).filter(Boolean) } : {});
  }
  for (const [n, x] of Object.entries(src.augs)) {
    const id = au(n, '증강 팁'); if (!id) continue;
    out.augs[id] = Object.assign({ tip: x.tip }, (x.good || []).length ? { good: x.good.map(ch).filter(Boolean) } : {}, (x.bad || []).length ? { bad: x.bad.map(ch).filter(Boolean) } : {});
  }
  fs.writeFileSync(path.join(R, 'docs/data/tips.json'), JSON.stringify(out));
  console.log(`챔피언 ${Object.keys(out.champs).length} · 증강 ${Object.keys(out.augs).length}`);
  for (const w of warn) console.log('  ⚠️', w);
})();
