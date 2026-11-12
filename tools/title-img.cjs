// 🔤 제목 그림 만들기(v0.1.178) — 「투데이 내전」을 리틱체(REATIC Narrow Bold)로 그려 PNG로 · electron tools/title-img.cjs
//   ⚠️ 리틱체 라이선스 = 이미지·영상 제작은 자유 / 글꼴 파일 재배포·수정 금지 → 글꼴 파일은 리포·앱에 넣지 않고 **그림만** 넣음
//   글꼴은 이 PC에 깔려 있어야 함(%LOCALAPPDATA%\Microsoft\Windows\Fonts\REATIC-NarrowBold.otf · 없으면 그만둠)
//   나오는 것 = assets/title/title-ink.png(전부 밝은 글자색) · title-two.png(「내전」만 밝은 금색) · 글자 높이 330px로 크게 그려 화면에선 줄여 씀
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const font = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Windows', 'Fonts', 'REATIC-NarrowBold.otf');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  if (!fs.existsSync(font)) { console.log('리틱체가 이 PC에 없습니다: ' + font); app.exit(1); return; }
  const out = path.join(__dirname, '..', 'assets', 'title'); fs.mkdirSync(out, { recursive: true });
  const html = `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:R;src:url('${pathToFileURL(font).href}')}
    html,body{margin:0;background:transparent} span{display:inline-block;font-family:R;font-size:330px;line-height:1.16;padding:0 12px;white-space:nowrap;color:#F0E6D2} span i{font-style:normal;color:#F0D79A}</style>
    <div><span id="ink">투데이 내전</span></div><div><span id="two">투데이 <i>내전</i></span></div>`;
  const tmp = path.join(app.getPath('temp'), 'tn-title.html'); fs.writeFileSync(tmp, html);
  const win = new BrowserWindow({ width: 2200, height: 900, show: false, frame: false, transparent: true, webPreferences: { offscreen: true, webSecurity: false } });
  await win.loadFile(tmp);
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => 0)');
  await new Promise(r => setTimeout(r, 600));
  for (const id of ['ink', 'two']) {
    const r = JSON.parse(await win.webContents.executeJavaScript(`JSON.stringify((b => ({ x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width), height: Math.ceil(b.height) }))(document.getElementById('${id}').getBoundingClientRect()))`));
    const img = await win.webContents.capturePage(r);
    fs.writeFileSync(path.join(out, `title-${id}.png`), img.toPNG());
    console.log(id, JSON.stringify(img.getSize()));
  }
  app.exit(0);
});
