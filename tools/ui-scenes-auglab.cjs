// 🧪 「증강 뽑아 보기」 가운데 창(auglab/) 캡처 장면 만들기(v0.1.209) — 실제 증강 이름·그림·설명으로(서버·롤 연결 없음)
// 사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고):
//   node tools/ui-scenes-auglab.cjs <장면.json>
//   ./node_modules/electron/dist/electron.exe tools/ui-shot.cjs <장면.json> <출력 폴더>      ← PNG + 글자 겹침·잘림 검사
//   ./node_modules/electron/dist/electron.exe tools/ui-errcheck.cjs <장면.json>              ← 실행 오류
// 증강 이름·등급·그림 주소 = 이 PC에 앱이 받아 둔 %APPDATA%/today-naejeon/augments-cache.json(없으면 CommunityDragon에서 받음 · 느림) · 설명 = docs/data/aramgg/desc.json
// 그림 = assets/imgpack(앱에 넣어 둔 증강 그림 · imgcache.js packName 규칙)에 있으면 그 파일로 → 인터넷 없이 찍힘
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const out = process.argv[2];
if (!out) { console.error('사용: node tools/ui-scenes-auglab.cjs <장면.json>'); process.exit(1); }
const R = path.join(__dirname, '..');
const packName = rest => crypto.createHash('sha1').update(rest.toLowerCase()).digest('hex').slice(0, 24) + ((rest.match(/\.(png|jpe?g|webp|gif|svg)$/i) || ['.img'])[0].toLowerCase());
const local = url => { const rest = String(url || '').replace(/^https:\/\/raw\.communitydragon\.org\//, ''), f = path.join(R, 'assets', 'imgpack', packName(rest)); return fs.existsSync(f) ? 'file:///' + f.replace(/\\/g, '/') : url; };
(async () => {
  let map = null;
  try { map = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA || '', 'today-naejeon', 'augments-cache.json'), 'utf8')).map; } catch (_) {}
  if (!map) {
    const list = await (await fetch('https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/ko_kr/v1/cherry-augments.json')).json();
    map = {}; for (const a of list) map[a.id] = { name: String(a.nameTRA || '').trim(), rarity: String(a.rarity || '').replace(/^k/, '').toLowerCase(), icon: a.augmentSmallIconPath ? 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default' + a.augmentSmallIconPath.replace('/lol-game-data/assets', '').toLowerCase() : '' };
  }
  const desc = JSON.parse(fs.readFileSync(path.join(R, 'docs/data/aramgg/desc.json'), 'utf8')).d, gi = JSON.parse(fs.readFileSync(path.join(R, 'docs/data/aramgg/index.json'), 'utf8')), g = Array.isArray(gi.ids) ? Object.fromEntries(gi.ids.map(x => [x, 1])) : gi.g;
  const list = Object.keys(g).filter(id => map[id] && /^(silver|gold|prismatic)$/.test(map[id].rarity)).map(id => ({ id: +id, name: map[id].name, icon: local(map[id].icon), rarity: map[id].rarity, desc: desc[id] || '' }));
  const penta = [[3170, '헤비', 'Q'], [3171, '파워', 'W'], [3172, '스래시', 'E'], [3173, '둠', 'R']].map(([id, name, key]) => ({ id, name, key, icon: local((map[id] || {}).icon) }));
  const POOL = { patch: '26.22', list, penta };
  const long = { patch: '26.22', penta, list: ['silver', 'gold', 'prismatic'].flatMap(r => list.filter(a => a.rarity === r).sort((a, b) => b.desc.length - a.desc.length).slice(0, 14)) };   // 설명이 가장 긴 것들만(글 넘침 확인)
  const w = ms => ` await new Promise(r => setTimeout(r, ${ms}));`;
  const load = (pool, opt) => `__labLoad(${JSON.stringify(pool)}, ${JSON.stringify(opt)});` + w(900);
  const pickAll = `for (let k = 0; k < 9 && document.querySelector('#lab .card'); k++) { __labPick(k % 3); ${w(1250).trim()} }`;
  const S = [], sc = (name, W, H, js) => S.push({ name, page: 'auglab', w: W, h: H, audit: 1, wait: 900, js });
  for (const [W, H] of [[1280, 720], [1024, 576], [1600, 900]]) {
    const z = W;
    sc('lab-start-' + z, W, H, load(POOL, { head: 'disco', tiers: ['prismatic', 'gold', 'silver', 'gold'] }));                                   // 게임 시작 · 3레벨 · 프리즘 3장
    sc('lab-reroll-' + z, W, H, load(POOL, { head: 'true', tiers: ['gold', 'gold', 'silver', 'gold'] }) + '__labReroll(0); __labReroll(2);' + w(800));   // 두 장 다시 뽑음 = 그 버튼만 흐림
    sc('lab-cmd-' + z, W, H, load(POOL, { head: 'cmd', tiers: ['gold', 'silver', 'gold', 'silver'] }) + '__labReroll(1);' + w(800));                // 커맨드 라인 = 가운데를 한 등급 위(프리즘)로 · 나머지는 보통 다시 뽑기
    sc('lab-penta-' + z, W, H, load(POOL, { head: 'penta', tiers: ['silver', 'gold', 'gold', 'prismatic'] }) + '__labPick(1);' + w(1300));           // 펜타킬 = 첫 증강 뒤 스킬 강화 고르기
    sc('lab-kda-' + z, W, H, load(POOL, { head: 'kda', tiers: ['gold', 'prismatic', 'silver', 'gold'] }) + '__labPick(0);' + w(1250) + '__labPick(2);' + w(1250));   // 두 번 고른 뒤 = 아래 「내 증강」 칸
    sc('lab-long-' + z, W, H, load(long, { head: 'heart', tiers: ['gold', 'silver', 'prismatic', 'gold'] }));                                     // 설명이 긴 증강
    sc('lab-done-' + z, W, H, load(POOL, { head: 'kda', tiers: ['gold', 'prismatic', 'silver', 'gold'] }) + pickAll + w(400));                       // 끝 = 이번 판 증강(5개)
    sc('lab-done-penta-' + z, W, H, load(long, { head: 'penta', tiers: ['gold', 'prismatic', 'silver', 'gold'] }) + pickAll + w(400));               // 끝 = 증강 4 + 스킬 강화 2 · 긴 설명
  }
  fs.writeFileSync(out, JSON.stringify(S));
  console.log('장면', S.length, '개 →', out, '· 증강', list.length, '개 · 그림이 묶음에 있는 것', list.filter(a => a.icon.startsWith('file:')).length);
})();
