// 🌐 증강 가이드 초안용 자료 받기(GitHub Actions에서 실행 — 원격 작업 세션은 네트워크 정책으로 이 사이트들이 막혀 있음)
// 우리 기록(today/days 내전·같이 한 일반 판)에 자주 나온 챔피언 TOP N → 각 챔피언 아수라장 증강 페이지 + 증강 목록(이름·등급·설명)을 out/에
// 사용: node tools/web-fetch.cjs [N=30] [out]   · 읽기만(Firebase·사이트) · 사이트 부담 없게 페이지 사이 1.5초 쉼
// ⚠️ 받은 자료는 초안 작성용 참고 — 통계·티어표를 그대로 앱에 옮기지 않음(제 말로 정리한 플랜만 today/augGuide에 draft로)
const fs = require('fs'), path = require('path');
const DB = 'https://today-naejeon-sohada-default-rtdb.asia-southeast1.firebasedatabase.app/today';
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1';
const N = Number(process.argv[2]) || 30, OUT = process.argv[3] || 'out';
const UA = 'Mozilla/5.0 (today-naejeon augment guide research; github.com/SOHADA2/today-naejeon)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, json) {
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' } }); if (!r.ok) return { status: r.status }; return { status: r.status, body: json ? await r.json() : await r.text() }; }
  catch (e) { return { status: 0, err: String(e) }; }
}
const text = html => html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
(async () => {
  fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
  const days = (await get(`${DB}/days.json`, true)).body || {};
  const cnt = {};
  for (const d of Object.values(days)) for (const kind of ['matches', 'normals']) for (const m of Object.values((d && d[kind]) || {})) for (const st of (m && m.stats) || []) if (st && st.championId) cnt[st.championId] = (cnt[st.championId] || 0) + 1;
  const seenAug = {}; for (const d of Object.values(days)) for (const kind of ['matches', 'normals']) for (const m of Object.values((d && d[kind]) || {})) for (const st of (m && m.stats) || []) for (const a of (st && st.augments) || []) seenAug[a] = (seenAug[a] || 0) + 1;
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'seen-augs.json'), JSON.stringify(seenAug));   // 우리 기록에 실제로 나온 증강 번호(같은 이름 두 번호 중 어느 쪽이 아수라장인지 확인용)
  const champs = (await get(`${CD}/champion-summary.json`, true)).body || [];
  const byId = {}; for (const c of champs) if (c.id > 0) byId[c.id] = c;
  let top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id: +id, n, name: (byId[id] || {}).name, alias: (byId[id] || {}).alias })).filter(c => c.alias);
  if (N >= 999) { const have = new Set(top.map(c => c.id)); for (const c of Object.values(byId)) if (!have.has(c.id) && c.alias) top.push({ id: c.id, n: 0, name: c.name, alias: c.alias }); }   // 999 = 전체 챔피언(기록에 없는 것까지)
  top = top.slice(0, N);
  console.log(`기록 속 챔피언 ${Object.keys(cnt).length}종 → TOP ${top.length}:`, top.map(c => `${c.name}(${c.n})`).join(' · '));
  const augs = (await get(`${CD}/cherry-augments.json`, true)).body || [];
  fs.writeFileSync(path.join(OUT, 'augments.json'), JSON.stringify(augs.map(a => ({ id: a.id, name: a.nameTRA, rarity: a.rarity, desc: String(a.descriptionTRA || a.desc || '').replace(/<[^>]+>/g, '') })), null, 0));
  console.log('증강', augs.length, '개 · 키 예시', Object.keys(augs[0] || {}).join(','));
  const log = [];
  const save = async (name, url) => {
    const r = await get(url); log.push({ name, url, status: r.status, bytes: r.body ? r.body.length : 0 });
    if (r.body) { fs.writeFileSync(path.join(OUT, 'pages', name + '.txt'), text(r.body)); fs.writeFileSync(path.join(OUT, 'pages', name + '.html'), r.body); }
    console.log(r.status, url); await sleep(1500);
  };
  for (const c of top) await save('am-' + c.alias.toLowerCase(), `https://arammayhem.com/ko-kr/champions/${c.alias.toLowerCase()}`);
  await save('gamesgg-sets', 'https://games.gg/league-of-legends/guides/aram-mayhem-augment-tier-list-set-combos/');
  await save('wiki-augments', 'https://wiki.leagueoflegends.com/en-us/ARAM_Mayhem/Augments');
  fs.writeFileSync(path.join(OUT, 'top.json'), JSON.stringify(top, null, 1));
  fs.writeFileSync(path.join(OUT, 'log.json'), JSON.stringify(log, null, 1));
})();
