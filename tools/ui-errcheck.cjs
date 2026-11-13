// 렌더러 실행 오류 검사 — 실제 overlay.html(왼쪽 창)·sidepanel.html(오른쪽 창 · v0.1.197)을 가짜 api로 띄우고(화면 밖) 상태를 바꿔 가며 콘솔 오류·예외를 모음
// 사용(리포 루트 · ELECTRON_RUN_AS_NODE 끄고): electron tools/ui-errcheck.cjs <장면.json> [장면.json …]   (장면 = tools/ui-shot.cjs와 같은 형식 · overlay·sidepanel)
//   화면을 크게 고친 뒤 ui-shot(겹침·잘림)과 같이 돌릴 것 — ui-shot은 렌더러 예외를 안 보여 줌(v0.1.196)
const { app, BrowserWindow } = require('electron');
const fs = require('fs'), path = require('path');
const repo = path.join(__dirname, '..'), files = process.argv.slice(2).filter(a => /.json$/i.test(a));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  let bad = 0, n = 0;
  for (const f of files) for (const s of JSON.parse(fs.readFileSync(f, 'utf8'))) {
    if (s.page !== 'overlay' && s.page !== 'sidepanel') continue;
    const side = s.page === 'sidepanel';
    n++;
    const win = new BrowserWindow({ width: s.w, height: s.h, show: false, frame: false, transparent: !side,
      webPreferences: { offscreen: true, contextIsolation: false, nodeIntegration: false, preload: path.join(repo, 'tools', 'ui-stub-preload.js') } });
    win.webContents.setAudioMuted(true);
    const errs = [];
    win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 3 && !/Failed to load resource|net::ERR/.test(msg)) errs.push(`${msg} (${path.basename(String(src))}:${line})`); });
    win.webContents.on('dom-ready', () => win.webContents.executeJavaScript(`window.addEventListener('error', e => console.error('UNCAUGHT ' + e.message)); window.addEventListener('unhandledrejection', e => console.error('REJECT ' + (e.reason && e.reason.message || e.reason))); Object.assign(window.__stub, ${JSON.stringify(s.stub || {})}); 0`).catch(() => {}));
    for (let k = 0; k < 3; k++) { try { await win.loadFile(path.join(repo, s.page, s.page + '.html')); break; } catch (e) { await new Promise(r => setTimeout(r, 400)); } }
    await new Promise(r => setTimeout(r, 700));
    try { await win.webContents.executeJavaScript(`(async () => { ${s.js || ''} })().then(() => 0)`); } catch (e) { errs.push('scene js: ' + e.message); }
    // 다시 그리기(같은 데이터) + 방장 여부 뒤집기 → 상태가 바뀔 때 터지는 오류
    // 오른쪽 창 = 탭을 하나씩 다 열어 봄(홈 · 기록 · 프로필 · 증강 가이드 · 패치 노트 · 뽑아 보기) + 방장 여부 뒤집기
    if (side) try { await win.webContents.executeJavaScript(`(async () => { const w = ms => new Promise(r => setTimeout(r, ms)); for (const c of ['today', 'profile', 'aug', 'patch', 'lab', 'home']) { switchCat(c); await w(180); } _isHost = !_isHost; drawHome(); _isHost = !_isHost; drawHome(); })().then(() => 0)`); } catch (e) { errs.push('tabs: ' + e.message); }
    if (!side) try { await win.webContents.executeJavaScript(`(async () => { if (typeof render === 'function') { render(); render(); } if (typeof lobbyData !== 'undefined' && lobbyData) { myIsHost = !myIsHost; render(); myIsHost = !myIsHost; render(); } })().then(() => 0)`); } catch (e) { errs.push('rerender: ' + e.message); }
    await new Promise(r => setTimeout(r, 300));
    if (errs.length) { bad++; console.log('✗', s.name, '\n   ' + [...new Set(errs)].join('\n   ')); }
    win.destroy();
  }
  console.log(`검사 ${n}장면 · 오류 난 장면 ${bad}`);
  app.exit(bad ? 1 : 0);
});
