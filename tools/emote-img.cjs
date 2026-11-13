// 😀 롤 감정표현 그림 받아 앱에 넣기(v0.1.203 · 사장님: 대기실 이모티콘을 롤 감정표현으로)
// 사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): ./node_modules/electron/dist/electron.exe tools/emote-img.cjs [--from <폴더>] [번호 …]
//   아래 EMOTES의 그림(CommunityDragon · 256×256 투명 PNG)을 받아 128×128로 줄여 `assets/emote/{번호}.png`에 저장(화면에선 26~46px로 보임)
//   --from <폴더> = 서버 대신 그 폴더의 `{번호}.png`를 씀(서버가 느릴 때 · 이미 받아 둔 원본) · 번호를 주면 그것만
//   ⚠️ 대기실에 쓰는 것 = overlay/overlay.js `EMO`(보내는 글자 · 뜻 · 여기 번호) — 감정표현을 바꾸려면 여기 EMOTES에 더하고 이 도구를 돌린 뒤 EMO의 번호를 바꿈
//   번호·이름·경로 = CommunityDragon `plugins/rcp-be-lol-game-data/global/default/v1/summoner-emotes.json`(2,447종 · inventoryIcon의 `/lol-game-data/assets/` 뒤를 소문자로)
//   ⚠️ 라이엇 자료(챔피언 그림·티어 문장·사미라 모델과 같은 취급) · 서버가 느려 한 장에 20초 넘게 걸리거나 522가 날 수 있음(다시 돌리면 됨)
const { app, nativeImage } = require('electron');
const fs = require('fs'), path = require('path');
const EMOTES = {
  // 지금 쓰는 8개(overlay.js EMO)
  1505: ['M\'Pengu', 'ASSETS/Loadouts/SummonerEmotes/Flairs/Penguin_Happy_Greetings_Inventory.png'],            // 인사
  1459: ['Nice', 'ASSETS/Loadouts/SummonerEmotes/Flairs/Thumb_Happy_Up_Inventory.png'],                          // 좋아요
  3159: ['Okay', 'ASSETS/Loadouts/SummonerEmotes/Champions/Rammus/EM_Rammus_Ok_Inventory.png'],                  // 준비 완료
  3173: ['Snoozy Poro', 'ASSETS/Loadouts/SummonerEmotes/Events/PoolParty/EM_Pool_Party_Poro_01_Inventory.png'],  // 잠깐만요
  3177: ['Wahaha', 'ASSETS/Loadouts/SummonerEmotes/Champions/Jinx/EM_Jinx_Joy_Inventory.png'],                   // ㅋㅋ
  3155: ['Bee Sad', 'ASSETS/Loadouts/SummonerEmotes/Flairs/EM_Bee_Sad_Inventory.png'],                           // ㅠㅠ
  1474: ['Let\'s Do This', 'ASSETS/Loadouts/SummonerEmotes/Champions/LeeSin/LeeSin_Happy_Cheers_Inventory.png'],        // 가자
  1468: ['Does Not Compute', 'ASSETS/Loadouts/SummonerEmotes/Champions/Blitzcrank/Blitzcrank_Sad_Confused_Inventory.png'],   // ?
  // 바꿔 쓸 만한 것(받아 두지는 않음): 3154 Bee Mad · 3153 Bee Happy · 1506 D'Pengu · 1495 Surrender at 20 · 1469 Much Love · 1464 Clean · 3158 Go Team! · 3133 Hype Kitty · 1457 Sad Kitten · 3145 Everything is Okay · 1490 Hoppin' Mad
};
const CD = 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/';
const args = process.argv.slice(2), fi = args.indexOf('--from'), FROM = fi >= 0 ? args[fi + 1] : null;
const ASK = args.filter((a, i) => /^\d+$/.test(a) && i !== fi + 1), IDS = ASK.length ? ASK : Object.keys(EMOTES);
const out = path.join(__dirname, '..', 'assets', 'emote');
async function get(url) {
  for (let k = 0; k < 3; k++) {
    const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 90000);
    try { const r = await fetch(url, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
    catch (e) { console.log('  다시 시도', k + 1, e.message); } finally { clearTimeout(tm); }
  }
  return null;
}
let _list = null;
async function pathOf(id) {   // 경로를 안 적어 둔 번호 = 목록(640KB)에서 찾음
  const e = EMOTES[id];
  if (e && e[1]) return e[1];
  if (!_list) { const b = await get(CD + 'v1/summoner-emotes.json'); _list = b ? JSON.parse(b.toString('utf8')) : []; }
  const m = _list.find(x => String(x.id) === String(id));
  return m ? m.inventoryIcon.replace('/lol-game-data/assets/', '') : null;
}
app.whenReady().then(async () => {
  fs.mkdirSync(out, { recursive: true });
  let bad = 0;
  for (const id of IDS) {
    let buf = null;
    if (FROM) { try { buf = fs.readFileSync(path.join(FROM, id + '.png')); } catch (_) {} }
    else { const p = await pathOf(id); buf = p ? await get(CD + p.toLowerCase()) : null; }
    const img = buf ? nativeImage.createFromBuffer(buf) : null, s = img ? img.getSize() : {};
    if (!s.width) { bad++; console.log('✗', id, '못 받음'); continue; }
    const png = (s.width > 128 ? img.resize({ width: 128, height: 128, quality: 'best' }) : img).toPNG();
    fs.writeFileSync(path.join(out, id + '.png'), png);
    console.log('✓', id, (EMOTES[id] || ['?'])[0], s.width + '×' + s.height, '→ 128', Math.round(png.length / 1024) + 'KB');
  }
  console.log(bad ? `못 받은 것 ${bad}장 — 번호를 붙여 다시 돌려 주세요` : `${IDS.length}장 저장 → assets/emote/`);
  app.exit(bad ? 1 : 0);
});
