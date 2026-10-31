// 🎯 증강 순위(v0.1.78) 개발용 자료 — 아수라장 증강(번호 1000+) 아이콘 전부(작은·큰) + cherry-augments 원본 키 + arammayhem 증강 등급표 페이지
// GitHub Actions(web-fetch.yml, tools/.web-fetch 첫 줄 augicons)에서 실행 → web-out 브랜치 out/augicons · 읽기만
const fs = require('fs'), path = require('path');
const OUT = path.join(process.argv[2] || 'out', 'augicons');
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global';
const UA = 'Mozilla/5.0 (today-naejeon augment guide research; github.com/SOHADA2/today-naejeon)';
const get = async (u, kind) => { try { const r = await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } }); if (!r.ok) return { status: r.status }; return { status: r.status, body: kind === 'json' ? await r.json() : kind === 'bin' ? Buffer.from(await r.arrayBuffer()) : await r.text() }; } catch (e) { return { status: 0 }; } };
const asset = p => `${CD}/default${String(p || '').replace('/lol-game-data/assets', '').toLowerCase()}`;
(async () => {
  fs.mkdirSync(path.join(OUT, 'small'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'large'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
  const augs = (await get(`${CD}/ko_kr/v1/cherry-augments.json`, 'json')).body || [];
  fs.writeFileSync(path.join(OUT, 'cherry-augments.json'), JSON.stringify(augs));
  console.log('증강', augs.length, '키', Object.keys(augs[0] || {}).join(','));
  let n = 0;
  for (const a of augs.filter(a => a.id >= 1000)) {
    for (const [k, dir] of [['augmentSmallIconPath', 'small'], ['augmentLargeIconPath', 'large']]) {
      if (!a[k]) continue;
      const r = await get(asset(a[k]), 'bin'); if (r.body) { fs.writeFileSync(path.join(OUT, dir, a.id + '.png'), r.body); n++; }
    }
  }
  console.log('아이콘', n);
  for (const [name, u] of [['tier', 'https://arammayhem.com/ko-kr/augments/'], ['tierlist', 'https://arammayhem.com/ko-kr/augment-tier-list/'], ['tierlist2', 'https://arammayhem.com/ko-kr/tier-list/augments/']]) {
    const r = await get(u); console.log(r.status, u); if (r.body) fs.writeFileSync(path.join(OUT, 'pages', name + '.html'), r.body);
    await new Promise(r => setTimeout(r, 1500));
  }
})();
