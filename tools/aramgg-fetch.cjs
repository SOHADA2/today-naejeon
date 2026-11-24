// 🧭 aramgg.com에서 증강 패치 노트·설명·지금 시즌 증강 목록 받기 → docs/data/aramgg/(홈페이지 GitHub Pages로 앱이 읽음)
//   ⚖️ v0.1.246: 증강 등급·승률·챔피언별 통계·조합 승률은 **안 받고 안 올림**(라이엇 정책: 증강 승률 표시 금지) — 예전 c/{챔피언}.json·index.json g(등급·승률)는 없앰
//   받는 것(하루 요청 2번): /ko/new-augments(패치 노트) · /ko/augments(증강 카드 = 설명 글 + 지금 시즌에 있는 증강 번호)
//   약관 = 과도한 속도의 수집·재판매 금지 → 하루 한 번(aramgg.yml) · 출처 표시(앱 화면 「aramgg.com」+ 원문 링크)
// 사용: node tools/aramgg-fetch.cjs [출력 폴더=docs/data/aramgg]   · 바뀐 게 없으면 파일 그대로
//       node tools/aramgg-fetch.cjs --augments=<받아 둔 /ko/augments HTML>   ← 그 파일로 desc.json·index.json만 만듦(시험)
// 출력: index.json = {p:최신 패치, at, n:증강 수, src, ids:[지금 시즌 증강 번호]} — 「증강 뽑아 보기」·꿀팁 검사가 씀
//       desc.json = {at, src, d:{증강 id: 설명 글}} — 증강 카드에 쓰는 짧은 설명(v0.1.209 「증강 뽑아 보기」 · /ko/augments 카드의 title)
const fs = require('fs'), path = require('path');
const BASE = 'https://aramgg.com';
const OUT = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '..', 'docs', 'data', 'aramgg');
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) today-naejeon-augment-guide (+https://sohada2.github.io/today-naejeon/)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u, json) {
  for (let k = 0; k < 3; k++) {
    try { const r = await fetch(BASE + u, { headers: UA }); if (r.ok) return json ? r.json() : r.text(); console.log('  HTTP', r.status, u); } catch (e) { console.log('  오류', e.message, u); }
    await sleep(3000 * (k + 1));
  }
  return null;
}
// 📰 v0.1.144 패치 노트(/ko/new-augments · 하루 한 번) → patches.json = {at, src, patches:[{patch, date, link, added:[{id, name, rarity, desc}], changes:[{id, name, lines:[{k, from, to}]}], notes:[{title, items:[…]}]}]}
//   사장님: 사이트에 최신 패치 노트가 잘 정리돼 있음 → 우리 앱 「패치」 탭(증강 아래)에서 보게 · 출처 aramgg.com + 원문 링크
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
const txt = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&[#\w]+;/g, m => ENT[m] || m).replace(/\s+/g, ' ').trim();
const RAR = { '골드': 'gold', '실버': 'silver', '프리즘': 'prismatic' };
function parsePatches(html) {
  const out = [], starts = [...html.matchAll(/<section[^>]*data-patch-changelog[^>]*>/g)].map(m => m.index);
  starts.forEach((st, i) => {
    const sec = html.slice(st, starts[i + 1] || html.indexOf('</main>', st) > 0 ? (starts[i + 1] || html.indexOf('</main>', st)) : st + 200000);
    const patch = (/<h2[^>]*>\s*패치\s*([\d.]+)/.exec(sec) || [])[1]; if (!patch) return;
    const date = (/<time[^>]*datetime="([^"]+)"/.exec(sec) || [])[1] || '';
    const link = (/href="(\/ko\/patch-notes\/[^"]+)"/.exec(sec) || [])[1] || '';
    const added = [];
    for (const m of sec.matchAll(/<a href="\/ko\/augments\/(\d+)"[^>]*data-added-augment-card[^>]*>([\s\S]*?)<\/a>/g)) {
      const b = m[2], name = txt((/<strong[^>]*>([\s\S]*?)<\/strong>/.exec(b) || [])[1]);
      const rar = txt((/<\/strong>\s*<span[^>]*>([\s\S]*?)<\/span>/.exec(b) || [])[1]);
      const desc = txt((/<p[^>]*data-added-augment-summary[^>]*>([\s\S]*?)<\/p>/.exec(b) || [])[1]);
      if (name) added.push({ id: +m[1], name, rarity: RAR[rar] || '', desc: desc.slice(0, 300) });
    }
    const changes = [];
    for (const m of sec.matchAll(/<article[^>]*>([\s\S]*?)<\/article>/g)) {
      const b = m[1], a = /<a href="\/ko\/augments\/(\d+)"[^>]*>([\s\S]*?)<\/a>/.exec(b); if (!a) continue;
      const lines = [];
      for (const p of b.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
        const x = p[1];
        const kv = /<span[^>]*>([\s\S]*?)<\/span>\s*<del[^>]*>([\s\S]*?)<\/del>[\s\S]*?<strong[^>]*>([\s\S]*?)<\/strong>/.exec(x);
        if (kv) { lines.push({ k: txt(kv[1]).replace(/:\s*$/, ''), from: txt(kv[2]), to: txt(kv[3]) }); continue; }
        const bf = /<span[^>]*>\s*변경 전:\s*<\/span>\s*<del[^>]*>([\s\S]*?)<\/del>/.exec(x); if (bf) { lines.push({ k: '', from: txt(bf[1]), to: null }); continue; }
        const af = /<span[^>]*>\s*변경 후:\s*<\/span>([\s\S]*)/.exec(x);
        if (af) { const last = lines[lines.length - 1]; if (last && last.to === null) last.to = txt(af[1]); else lines.push({ k: '', from: '', to: txt(af[1]) }); }
      }
      for (const l of lines) { if (l.from === '-') l.from = ''; if (l.to == null) l.to = ''; }
      if (lines.length) changes.push({ id: +a[1], name: txt(a[2]), lines: lines.slice(0, 8) });
    }
    const notes = [];
    for (const m of sec.matchAll(/<section[^>]*data-patch-manual-section[^>]*>([\s\S]*?)<\/section>/g)) {
      const title = txt((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(m[1]) || [])[1]);
      const items = [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(x => txt(x[1])).filter(Boolean).slice(0, 20);
      if (title && items.length) notes.push({ title, items });
    }
    out.push({ patch, date, link: link ? 'https://aramgg.com' + link : '', added, changes, notes });
  });
  return out.slice(0, 4);
}
function parseIds(html) {   // 지금 시즌에 있는 증강 번호(/ko/augments 카드 링크) — 등급·승률은 안 읽음
  return [...new Set([...html.matchAll(/<article[^>]*>\s*<a href="\/ko\/augments\/(\d+)"/g)].map(m => +m[1]))].sort((a, b) => a - b);
}
function writeIndex(ids, patch) {   // 내용이 같으면 파일 안 바꿈
  const f = path.join(OUT, 'index.json');
  if (ids.length < 50) { console.log('증강 목록 못 읽음(' + ids.length + '개) — 그대로'); return; }
  let old = null; try { old = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) {}
  const p = patch || (old && old.p) || '';
  if (old && old.p === p && JSON.stringify(old.ids) === JSON.stringify(ids)) { console.log('증강 목록', ids.length, '개 · 그대로'); return; }
  fs.writeFileSync(f, JSON.stringify({ p, at: Date.now(), n: ids.length, src: 'aramgg.com', ids }));
  console.log('증강 목록', ids.length, '개 · 저장 · 패치', p);
}
// 📝 v0.1.209 증강 설명(/ko/augments 카드 링크의 title = 게임 안 카드 설명 글 · <keyword>·<br> 같은 표시는 떼고 글만 · 줄바꿈은 살림)
function parseDesc(html) {
  const d = {};
  for (const m of html.matchAll(/<a href="\/ko\/augments\/(\d+)"[^>]*\btitle="([^"]*)"/g)) {
    const t = String(m[2]).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&[#\w]+;/g, x => ENT[x] || x).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, 400);
    if (t && !d[m[1]]) d[m[1]] = t;
  }
  return d;
}
function writeDesc(html) {   // 내용이 같으면 파일 안 바꿈(매일 쓸데없는 커밋 X)
  const d = parseDesc(html), n = Object.keys(d).length, f = path.join(OUT, 'desc.json');
  if (n < 50) { console.log('증강 설명 못 읽음(' + n + '개) — 그대로'); return; }
  let same = false; try { same = JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8')).d) === JSON.stringify(d); } catch (_) {}
  if (!same) fs.writeFileSync(f, JSON.stringify({ at: Date.now(), src: 'aramgg.com', d }));
  console.log('증강 설명', n, '개', same ? '· 그대로' : '· 저장');
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const latest = () => { try { return (JSON.parse(fs.readFileSync(path.join(OUT, 'patches.json'), 'utf8')).patches[0] || {}).patch || ''; } catch (_) { return ''; } };
  { const af = (process.argv.find(a => a.startsWith('--augments=')) || '').split('=')[1]; if (af) { const h = fs.readFileSync(af, 'utf8'); writeDesc(h); writeIndex(parseIds(h), latest()); return; } }   // 받아 둔 HTML로
  { // 📰 패치 노트 먼저(요청 1번) · --patches=파일 이면 그 HTML로만(시험)
    const pf = (process.argv.find(a => a.startsWith('--patches=')) || '').split('=')[1];
    const ph = pf ? fs.readFileSync(pf, 'utf8') : await get('/ko/new-augments');
    const P = ph ? parsePatches(ph) : [];
    let same = false; try { same = JSON.stringify(JSON.parse(fs.readFileSync(path.join(OUT, 'patches.json'), 'utf8')).patches) === JSON.stringify(P); } catch (_) {}   // 같으면 안 바꿈(매일 쓸데없는 커밋 X)
    if (P.length && !same) { fs.writeFileSync(path.join(OUT, 'patches.json'), JSON.stringify({ at: Date.now(), src: 'aramgg.com', patches: P })); console.log('패치 노트', P.map(p => `${p.patch}(신규 ${p.added.length} · 조정 ${p.changes.length} · 메모 ${p.notes.length})`).join(' / ')); }
    else console.log(P.length ? '패치 노트 그대로' : '패치 노트 못 읽음 — 그대로');
    if (pf) return;
  }
  await sleep(1500);
  const html = await get('/ko/augments');
  if (!html) { console.log('증강 페이지 못 받음 — 그대로'); process.exit(1); }
  writeDesc(html);
  writeIndex(parseIds(html), latest());
})();
