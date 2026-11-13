// 🏅 롤 티어 문장 그림 받아 앱에 넣기(v0.1.199 · 사장님: 받는 서버가 느려 프로필에 문장이 늦게 뜸 → 앱에 넣어 바로 뜨게)
// 사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): ./node_modules/electron/dist/electron.exe tools/rank-emblems.cjs [티어 이름 …]   (이름을 주면 그 티어만 — 못 받은 것만 다시 받을 때 · 예: iron)
//   CommunityDragon `rcp-fe-lol-static-assets/global/default/ranked-emblem/emblem-{티어}.png`(16:9 투명 · 큰 그림) 10장을 받아
//   가로 1280으로 줄여 `assets/rank/emblem-{티어}.png`에 저장(화면에선 문장 부분이 62~120px로 보임 — 1280이면 2배 화면에서도 선명)
//   ⚠️ 그림 비율(16:9)·문장 위치는 그대로라 overlay/tierreveal.js `EMB` 실측 값은 안 바꿔도 됨 · 서버가 느려 한 장에 20초 넘게 걸릴 수 있음
//   ⚠️ 롤 패치로 문장 그림이 바뀌면 다시 돌릴 것(거의 안 바뀜) · 라이엇 자료(다른 챔피언 그림·사미라 모델과 같은 취급)
const { app, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
const ALL = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'];
const ASK = process.argv.slice(2).filter(a => ALL.includes(a)), TIERS = ASK.length ? ASK : ALL;
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/ranked-emblem/';
const out = path.join(__dirname, '..', 'assets', 'rank');
async function get(url) {
  for (let k = 0; k < 3; k++) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 150000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { console.log('  다시 시도', k + 1, e.message); } finally { clearTimeout(tm); }
  }
  return null;
}
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  let bad = 0;
  await Promise.all(TIERS.map(async t => {
    const buf = await get(CD + 'emblem-' + t + '.png');
    if (!buf) { bad++; console.log('✗', t, '못 받음'); return; }
    const img = nativeImage.createFromBuffer(buf), s = img.getSize();
    if (!s.width) { bad++; console.log('✗', t, '그림이 아님'); return; }
    const small = s.width > 1280 ? img.resize({ width: 1280, quality: 'best' }) : img, png = small.toPNG();
    fs.writeFileSync(path.join(out, 'emblem-' + t + '.png'), png);
    console.log('✓', t, s.width + '×' + s.height, '→', small.getSize().width + '×' + small.getSize().height, Math.round(buf.length / 1024) + 'KB →', Math.round(png.length / 1024) + 'KB');
  }));
  console.log(bad ? `못 받은 것 ${bad}장 — 그 티어 이름을 붙여 다시 돌려 주세요` : `${TIERS.length}장 저장 → assets/rank/`);
  app.exit(bad ? 1 : 0);
});
