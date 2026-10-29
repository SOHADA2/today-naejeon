// 🖼️ 화면 캡처(서버·롤 연결 없이) — 왼쪽/오른쪽 창을 화면 밖(offscreen)에 띄우고 가짜 api로 상황을 넣어 PNG로
// 사용(리포 루트, ELECTRON_RUN_AS_NODE 끄고): electron tools/ui-shot.cjs <장면.json> <출력폴더>   (장면에 audit:1이면 글자 겹침·잘림 검사 결과도 출력)
//   장면.json = [{ name, page: 'overlay'|'sidepanel', w, h, stub: {getSettings: {...}, ...}, js: "__emit('lobby', {...})" }, ...]
//   js는 페이지가 뜬 뒤 실행(문자열) · 끝에 0.6초 기다렸다 캡처
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const [sceneFile, outDir] = process.argv.slice(-2);
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});   // 장면마다 창을 닫아도 꺼지지 않게
app.whenReady().then(async () => {
  const repo = path.join(__dirname, '..'), scenes = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const s of scenes) {
    const win = new BrowserWindow({ width: s.w, height: s.h, show: false, frame: false, transparent: s.page === 'overlay',
      webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, preload: path.join(__dirname, 'ui-stub-preload.js') } });
    win.webContents.setAudioMuted(true);
    win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(`Object.assign(window.__stub, ${JSON.stringify(s.stub || {})}); 0`).catch(() => {}));
    for (let k = 0; k < 3; k++) { try { await win.loadFile(path.join(repo, s.page, s.page + '.html')); break; } catch (e) { await new Promise(r => setTimeout(r, 500)); } }   // 가끔 첫 로드가 ERR_FAILED → 다시
    await new Promise(r => setTimeout(r, 900));
    try { await win.webContents.executeJavaScript(`(async () => { ${s.js || ''} })().then(() => 0)`); } catch (e) { console.log('js 오류', s.name, e.message); }
    await new Promise(r => setTimeout(r, s.wait || 700));
    if (s.audit) {   // 🔍 글자 겹침·잘림 검사(tools/ui-audit.js) — overlap·clipped가 0이어야 통과
      await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'ui-audit.js'), 'utf8') + ';0');
      const a = JSON.parse(await win.webContents.executeJavaScript('JSON.stringify(__audit())'));
      console.log(`audit ${s.name}: 겹침 ${a.overlap.length} · 잘림 ${a.clipped.length} · 꺾임 ${(a.wrapped || []).length} · …줄임 ${a.ellipsis}`, a.overlap.length || a.clipped.length || (a.wrapped || []).length ? JSON.stringify(a).slice(0, 600) : '');
    }
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, s.name + '.png'), img.toPNG());
    console.log('saved', s.name, img.getSize());
    win.destroy();
  }
  app.exit(0);
});
