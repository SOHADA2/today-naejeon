// 🧭 증강 가이드용 — arammayhem.com 챔피언별 「콤보」 전체(목록 페이지 + 콤보마다 상세 페이지)를 받아 out/combos에
// 이유: 챔피언 페이지 카드엔 제목·티어뿐이라 콤보에 든 증강·패치·출처를 알려면 상세 페이지가 필요 · 읽기만 · 요청 사이 1.2초
// 사용: node tools/combo-fetch.cjs out   (GitHub Actions web-fetch.yml에서 `tools/.web-fetch` 첫 줄이 combos일 때)
const fs = require('fs'), path = require('path');
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1';
const OUT = path.join(process.argv[2] || 'out', 'combos');
const UA = 'Mozilla/5.0 (today-naejeon augment guide research; github.com/SOHADA2/today-naejeon)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, json) {
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } }); if (!r.ok) return { status: r.status }; return { status: r.status, body: json ? await r.json() : await r.text() }; }
  catch (e) { return { status: 0, err: String(e) }; }
}
(async () => {
  fs.mkdirSync(path.join(OUT, 'list'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'detail'), { recursive: true });
  const champs = ((await get(`${CD}/champion-summary.json`, true)).body || []).filter(c => c.id > 0 && c.alias);
  const augs = (await get(`${CD}/cherry-augments.json`, true)).body || [];
  fs.writeFileSync(path.join(OUT, 'augments.json'), JSON.stringify(augs.map(a => ({ id: a.id, name: a.nameTRA, rarity: a.rarity, icon: a.augmentSmallIconPath }))));
  const log = [], seen = new Set();
  for (const c of champs) {
    const a = c.alias.toLowerCase(), url = `https://arammayhem.com/ko-kr/combo/champion/${a}/`;
    const r = await get(url); log.push({ kind: 'list', champ: c.id, alias: a, url, status: r.status });
    console.log(r.status, url);
    if (r.body) {
      fs.writeFileSync(path.join(OUT, 'list', a + '.html'), r.body);
      const links = [...new Set([...r.body.matchAll(/href="(\/ko-kr\/combo\/[a-z0-9-]+\/)"/g)].map(m => m[1]).filter(l => !/\/combo\/(augment|champion)\//.test(l)))];
      for (const l of links) {
        if (seen.has(l)) continue; seen.add(l);
        await sleep(1200);
        const d = await get('https://arammayhem.com' + l); log.push({ kind: 'detail', champ: c.id, alias: a, url: l, status: d.status });
        if (d.body) fs.writeFileSync(path.join(OUT, 'detail', l.split('/').filter(Boolean).pop() + '.html'), d.body);
      }
    }
    await sleep(1200);
  }
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 1));
  console.log('목록', log.filter(x => x.kind === 'list' && x.status === 200).length, '· 상세', log.filter(x => x.kind === 'detail' && x.status === 200).length);
})();
