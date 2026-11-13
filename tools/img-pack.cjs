// 📦 그림 묶음 만들기(v0.1.205 · 사장님: 그림을 프로그램에 받아 놓고 쓰면 안 되나) — 챔피언 아이콘 + 아수라장 증강 그림을 assets/imgpack/ 에 넣음
//   앱(imgcache.js)은 CommunityDragon 그림 주소를 「묶음 → PC에 저장해 둔 것 → 인터넷」 순서로 찾음 → 묶음에 있으면 인터넷 없이 바로
//   파일 이름 = imgcache.js packName(경로) 와 같은 규칙(raw.communitydragon.org/ 뒤 경로를 소문자로 sha1 앞 24자 + 확장자) · ⚠️ 규칙을 바꾸면 두 곳 같이
//   챔피언 아이콘 = Data Dragon(빠름 · 내용은 CommunityDragon champion-icons와 같은 그림) · 증강 = CommunityDragon(한 장 ~20초라 여러 장을 동시에)
//   언제 다시 돌리나: 새 챔피언이 나오거나 새 증강이 생긴 패치 뒤(없는 그림은 앱이 인터넷에서 받아 PC에 저장하니 급하진 않음)
// 사용(리포 루트): node tools/img-pack.cjs   → 받은 수·크기 출력 · 이미 있는 파일은 건너뜀(--all = 전부 다시)
const fs = require('fs'), path = require('path'), crypto = require('crypto'), https = require('https');
const OUT = path.join(__dirname, '..', 'assets', 'imgpack');
const CD = 'https://raw.communitydragon.org/', DD = 'https://ddragon.leagueoflegends.com/';
const CHAMP = 'latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/';
const AUG_BASE = 'latest/plugins/rcp-be-lol-game-data/global/default';   // main.js AUG_ICON_BASE와 같은 곳(augmentSmallIconPath의 /lol-game-data/assets 뒤를 소문자로)
const ALL = process.argv.includes('--all');
const packName = rest => crypto.createHash('sha1').update(rest.toLowerCase()).digest('hex').slice(0, 24) + ((rest.match(/\.(png|jpe?g|webp|gif|svg)$/i) || ['.img'])[0].toLowerCase());
function get(url, ms) {
  return new Promise((res, rej) => {
    const req = https.get(url, { headers: { 'User-Agent': 'today-naejeon-img-pack' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return get(new URL(r.headers.location, url).href, ms).then(res, rej); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b)));
    });
    req.on('error', rej); req.setTimeout(ms || 60000, () => req.destroy(new Error('시간 초과')));
  });
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } })); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];   // [CommunityDragon 경로(이름 규칙용), 받을 주소, 설명]
  // ① 챔피언 아이콘
  const v = JSON.parse((await get(DD + 'api/versions.json', 20000)).toString())[0];
  const champs = JSON.parse((await get(`${DD}cdn/${v}/data/en_US/champion.json`, 30000)).toString()).data;
  for (const c of Object.values(champs)) jobs.push([CHAMP + Number(c.key) + '.png', `${DD}cdn/${v}/img/champion/${c.id}.png`, '챔피언 ' + c.id]);
  console.log(`Data Dragon ${v} · 챔피언 ${Object.keys(champs).length}명`);
  // ② 아수라장 증강(번호 1000 이상) — CommunityDragon 목록(느림)
  console.log('증강 목록 받는 중(CommunityDragon · ~20초)…');
  // CommunityDragon은 가끔 522(서버 쪽 시간 초과) → 3번 시도 · 그래도 안 되면 앱이 이 PC에 받아 둔 증강 목록(%APPDATA%/today-naejeon/augments-cache.json)
  let augs = null;
  for (let k = 0; k < 3 && !augs; k++) {
    try { augs = JSON.parse((await get(CD + 'latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/cherry-augments.json', 120000)).toString()); }
    catch (e) { console.log(`  증강 목록 실패(${k + 1}/3): ${e.message}`); }
  }
  let na = 0;
  if (augs) for (const a of augs) {
    if (!(a.id >= 1000) || !a.augmentSmallIconPath) continue;
    const rest = AUG_BASE + a.augmentSmallIconPath.replace('/lol-game-data/assets', '').toLowerCase();
    jobs.push([rest, CD + rest, '증강 ' + a.id]); na++;
  } else {
    const f = path.join(process.env.APPDATA || '', 'today-naejeon', 'augments-cache.json');
    try {
      const m = JSON.parse(fs.readFileSync(f, 'utf8')).map || {};
      for (const [id, a] of Object.entries(m)) if (Number(id) >= 1000 && a && a.icon && a.icon.startsWith(CD)) { const rest = a.icon.slice(CD.length); jobs.push([rest, a.icon, '증강 ' + id]); na++; }
      console.log('  → 이 PC에 받아 둔 증강 목록을 씀');
    } catch (e) { console.log('  → 받아 둔 증강 목록도 없음(앱을 한 번 켜고 다시) · 증강은 건너뜀'); }
  }
  console.log(`증강 ${na}개`);
  let got = 0, skip = 0, fail = 0, bytes = 0; const t0 = Date.now(); const fails = [];
  await pool(jobs, 32, async ([rest, url, what]) => {
    const f = path.join(OUT, packName(rest));
    if (!ALL && fs.existsSync(f) && fs.statSync(f).size > 0) { skip++; bytes += fs.statSync(f).size; return; }
    for (let k = 0; k < 2; k++) {
      try { const b = await get(url, 90000); if (!b.length) throw new Error('빈 파일'); fs.writeFileSync(f, b); got++; bytes += b.length; return; }
      catch (e) { if (k) { fail++; fails.push(`${what}: ${e.message}`); } }
    }
  });
  const files = fs.readdirSync(OUT).length;
  console.log(`받음 ${got} · 이미 있음 ${skip} · 실패 ${fail} · 묶음 파일 ${files}개 · ${(bytes / 1024 / 1024).toFixed(2)}MB · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  if (fails.length) console.log('실패:', fails.slice(0, 10).join(' | '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('오류:', e.message); process.exit(1); });
