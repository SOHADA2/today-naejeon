// 🔤 제목 그림 만들기(v0.1.178~) — 고정 제목 문구를 리틱체(REATIC Narrow Bold)로 그려 투명 PNG로 · electron tools/title-img.cjs
//   ⚠️ 리틱체 라이선스 = 이미지·영상 제작은 자유 / 글꼴 파일 재배포·수정 금지 → 글꼴 파일은 리포·앱에 넣지 않고 **그림만** 넣음
//   글꼴은 이 PC에 깔려 있어야 함(%LOCALAPPDATA%\Microsoft\Windows\Fonts\REATIC-NarrowBold.otf · 없으면 그만둠)
//   글자 높이 330px(영문 작은 줄은 160px)로 크게 그려 화면에선 줄여 씀 · 그림 상자 높이 = 글자 크기 × 1.16 → 화면에서 height:1.16em이면 원래 글자 크기와 같음
//   문구를 더하려면 ITEMS에 한 줄(바뀌는 글자 — 닉네임·날짜·숫자 — 는 그림으로 못 만듦)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const font = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts', 'REATIC-NarrowBold.otf');
const INK = '#F0E6D2', GOLD_HI = '#F0D79A', WEB_INK = '#ece6da', WEB_GOLD = '#d6b36a';
const ITEMS = [   // [저장할 곳(리포 기준), 내용(HTML · <i> = 강조색), 글자색, 강조색, 글자 크기, 자간]
  ['assets/title/title-ink.png', '투데이 내전', INK, INK, 330, 0],                       // 게임 시작 포스터 · 홈 화면 머리
  ['assets/title/title-two.png', '투데이 <i>내전</i>', INK, GOLD_HI, 330, 0],             // 게임 시작 제목 카드
  ['assets/title/potg-en.png', 'PLAY OF THE GAME', GOLD_HI, GOLD_HI, 160, 0.2],          // 팟지 소개 윗줄
  ['assets/title/unsung-en.png', 'UNSUNG HERO', GOLD_HI, GOLD_HI, 160, 0.2],             // 숨은 영웅 소개 윗줄
  ['docs/img/title-1.png', '오늘 모인 사람끼리,', WEB_INK, WEB_GOLD, 330, 0],             // 홈페이지 큰 제목 첫 줄
  ['docs/img/title-2.png', '롤 <i>내전</i> 한 판.', WEB_INK, WEB_GOLD, 330, 0],           // 홈페이지 큰 제목 둘째 줄
];
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  if (!fs.existsSync(font)) { console.log('리틱체가 이 PC에 없습니다: ' + font); app.exit(1); return; }
  const repo = path.join(__dirname, '..');
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:R;src:url('${pathToFileURL(font).href}')}
    html,body{margin:0;background:transparent} span{display:inline-block;font-family:R;line-height:1.16;padding:0 12px;white-space:nowrap} span i{font-style:normal}</style>`
    + ITEMS.map(([, tx, c, c2, sz, ls], i) => `<div><span id="t${i}" style="font-size:${sz}px;color:${c};letter-spacing:${ls}em"><style>#t${i} i{color:${c2}}</style>${tx}</span></div>`).join('');
  const tmp = path.join(app.getPath('temp'), 'tn-title.html'); fs.writeFileSync(tmp, html);
  const win = new BrowserWindow({ width: 2500, height: 1300, show: false, frame: false, transparent: true, webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(tmp);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => 0)');
  await new Promise(r => setTimeout(r, 600));
  for (let i = 0; i < ITEMS.length; i++) {
    await win.webContents.executeJavaScript(`document.querySelectorAll('div').forEach((d, k) => d.style.display = k === ${i} ? '' : 'none'); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(0))))`);
    await new Promise(r => setTimeout(r, 250));
    const r = JSON.parse(await win.webContents.executeJavaScript(`JSON.stringify((b => ({ x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) }))(document.getElementById('t${i}').getBoundingClientRect()))`));
    const img = await win.webContents.capturePage(r), out = path.join(repo, ITEMS[i][0]);
    fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, img.toPNG());
    console.log(ITEMS[i][0], JSON.stringify(img.getSize()), (img.getSize().width / img.getSize().height * 1.16).toFixed(2) + 'em');
  }
  app.exit(0);
});
